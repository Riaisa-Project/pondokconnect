#!/bin/bash
# Uji E2E PSB di database KLONAN, instance api pakai image produksi.
# Produksi tidak pernah ditulis: hanya dump + CREATE DATABASE + DROP database uji.
set -uo pipefail
D="sudo -n docker"
DB="pondokconnect_db"
UJI="pondokconnect_uji"
TS=$(date +%Y%m%d-%H%M%S)
OUT=/home/ubuntu/herdr-out
LOG="$OUT/psb-e2e-$TS.log"
mkdir -p /home/ubuntu/backups
exec > >(tee "$LOG") 2>&1

cleanup() {
  echo "== teardown =="
  $D rm -f pondokconnect-uji >/dev/null 2>&1 || true
  $D exec -i pondokconnect-db-1 sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" 2>/dev/null' <<SQL
DROP DATABASE IF EXISTS \`$UJI\`;
SQL
  rm -f /tmp/uji.env
  echo "sisa container uji: $($D ps -a --format '{{.Names}}' | grep -c pondokconnect-uji || true)"
}
trap cleanup EXIT

echo "== 1. backup produksi (dump) =="
$D exec pondokconnect-db-1 sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --single-transaction --routines --triggers "$MYSQL_DATABASE" 2>/dev/null' > /home/ubuntu/backups/prod-$TS.sql
sudo -n chown ubuntu:ubuntu /home/ubuntu/backups/prod-$TS.sql
echo "dump: $(wc -c < /home/ubuntu/backups/prod-$TS.sql) byte"

echo "== 2. snapshot produksi sebelum =="
snap() {
  $D exec -i pondokconnect-db-1 sh -c 'mysql -N -B -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" 2>/dev/null' <<'SQL'
SELECT 'ponpes1', id, pendaftaran_dibuka, konsultasi_dibuka, kuota_putra, kuota_putri, user_admin_id FROM ponpes WHERE id=1;
SELECT 'counts', (SELECT COUNT(*) FROM pendaftaran_santri), (SELECT COUNT(*) FROM gelombang_psb), (SELECT COUNT(*) FROM seleksi_tahapan), (SELECT COUNT(*) FROM daftar_ulang), (SELECT COUNT(*) FROM audit_logs), (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM ponpes);
SELECT 'maxids', (SELECT COALESCE(MAX(id),0) FROM pendaftaran_santri), (SELECT COALESCE(MAX(id),0) FROM gelombang_psb);
SELECT 'alembic', version_num FROM alembic_version;
SQL
}
snap > /tmp/snap-before.txt; cat /tmp/snap-before.txt

echo "== 3. buat database uji + kloning =="
DBUSER=$($D exec pondokconnect-db-1 sh -c 'printf %s "$MYSQL_USER"')
$D exec -i pondokconnect-db-1 sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" 2>/dev/null' <<SQL
DROP DATABASE IF EXISTS \`$UJI\`;
CREATE DATABASE \`$UJI\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`$UJI\`.* TO '$DBUSER'@'%';
FLUSH PRIVILEGES;
SQL
$D exec -i pondokconnect-db-1 sh -c "mysql -u'$DBUSER' -p\"\$MYSQL_PASSWORD\" $UJI 2>/dev/null" < /home/ubuntu/backups/prod-$TS.sql
echo "tabel uji: $($D exec -i pondokconnect-db-1 sh -c "mysql -N -B -u'$DBUSER' -p\"\$MYSQL_PASSWORD\" $UJI -e 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"$UJI\"' 2>/dev/null")"
# Hanya klonan: aktifkan akun admin tanpa paksa ganti password.
$D exec -i pondokconnect-db-1 sh -c "mysql -u'$DBUSER' -p\"\$MYSQL_PASSWORD\" $UJI 2>/dev/null" <<'SQL'
UPDATE users SET must_change_password = 0 WHERE email = 'admin01@pondokconnect.id';
UPDATE ponpes SET pendaftaran_dibuka = 1, konsultasi_dibuka = 1 WHERE id = 1;
SQL

echo "== 4. siapkan env container uji =="
PRODURL=$($D exec pondokconnect-api-1 printenv DATABASE_URL)
UJIURL=${PRODURL/$DB/$UJI}
IMAGE=$($D inspect pondokconnect-api-1 --format '{{.Config.Image}}')
$D inspect pondokconnect-api-1 --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -vE '^(DATABASE_URL|PORT|API_PORT|PUBLIC_FRONTEND_URL)=' > /tmp/uji.env
{
  echo "DATABASE_URL=$UJIURL"
  echo "PORT=8099"
  echo "API_PORT=8099"
  echo "PUBLIC_FRONTEND_URL=http://127.0.0.1:8099"
} >> /tmp/uji.env
chmod 600 /tmp/uji.env
echo "image: $IMAGE  (env: $(wc -l < /tmp/uji.env) baris)"

echo "== 5. jalankan container uji =="
$D run -d --rm --name pondokconnect-uji --network pondokconnect_default -p 127.0.0.1:8099:8099 --env-file /tmp/uji.env "$IMAGE" >/dev/null
for i in $(seq 1 60); do
  code=$(curl -s -o /tmp/health-uji.json -w '%{http_code}' -m 5 http://127.0.0.1:8099/api/health || true)
  if [ "$code" = "200" ]; then echo "health 200 setelah ${i}s: $(cat /tmp/health-uji.json)"; break; fi
  sleep 2
done
if [ "$code" != "200" ]; then echo "FATAL container uji tidak sehat"; $D logs --tail 40 pondokconnect-uji; exit 1; fi

echo "== 6. e2e PSB =="
LINE=$($D exec pondokconnect-api-1 sh -c 'grep -m1 "^admin01@" /app/storage/private/akun-produksi.txt')
export ADMIN_LINE="${LINE%% *}"
export ADMIN_PASSWORD="${LINE#*- }"
export E2E_BASE=http://127.0.0.1:8099
python3 "$OUT/psb_e2e.py"
RC=$?

echo "== 7. snapshot produksi sesudah (sebelum teardown) =="
snap > /tmp/snap-after.txt; cat /tmp/snap-after.txt
if diff -u /tmp/snap-before.txt /tmp/snap-after.txt > /tmp/snap.diff; then
  echo "PRODUKSI TIDAK BERUBAH (snapshot identik)"
else
  echo "PERINGATAN: snapshot produksi berbeda"; cat /tmp/snap.diff
fi
echo "== log e2e: $LOG =="
exit $RC
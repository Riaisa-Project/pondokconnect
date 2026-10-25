"""Create a local development .env without printing or replacing secrets."""

import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parent.parent
password = secrets.token_hex(24)
content = (root / ".env.example").read_text().replace("CHANGE_ME_HEX_RANDOM", password)
content = content.replace(f"MYSQL_ROOT_PASSWORD={password}", f"MYSQL_ROOT_PASSWORD={secrets.token_hex(24)}")
content = content.replace("CHANGE_ME_GENERATE_AT_LEAST_32_RANDOM_CHARACTERS", secrets.token_hex(48))
try:
    descriptor = os.open(root / ".env", os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
except FileExistsError:
    print(".env sudah ada; tidak diubah.")
else:
    with os.fdopen(descriptor, "w") as stream:
        stream.write(content)
    print(".env lokal dibuat dengan kredensial acak.")

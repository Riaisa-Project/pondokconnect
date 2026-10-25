import { PageHeading } from '../components/UI'
import { useFeatures } from '../lib/hooks'
export default function Privacy() {
  const features = useFeatures()
  return (
    <div className="container section narrow prose">
      <PageHeading
        eyebrow="PRIVASI & PENGGUNAAN DATA"
        title="Kenali bagaimana data Anda digunakan."
      >
        {features.data?.demo
          ? 'Pondok Connect pada lingkungan ini adalah proyek akademik dengan data simulasi.'
          : 'Kenali data yang dibutuhkan setiap layanan dan siapa yang dapat mengaksesnya.'}
      </PageHeading>
      <h2>Pendaftaran santri</h2>
      <p>
        Data calon santri, NIK, kontak wali, dan lampiran digunakan untuk proses
        seleksi. Berkas dapat diakses pengurus pesantren tujuan. Pelacakan
        publik hanya menampilkan referensi dan status; kartu PDF memuat nama
        santri dan pesantren.
      </p>
      <h2>Bantuan membaca dokumen</h2>
      <p>
        {features.data?.ocr_available
          ? 'Bantuan OCR tersedia melalui Groq.'
          : 'Bantuan OCR melalui Groq hanya tersedia saat layanan diaktifkan.'}{' '}
        OCR bersifat opsional. Gambar dikirim ke Groq untuk dibaca hanya setelah
        persetujuan Anda. Gambar dan hasil OCR tidak disimpan oleh endpoint OCR
        portal. Periksa hasilnya sebelum mengisi formulir. Pengiriman lampiran
        pendaftaran dilakukan terpisah dan menyimpan berkas secara privat untuk
        pengurus pesantren tujuan.
      </p>
      <h2>Laporan perlindungan santri</h2>
      <p>
        Isi laporan dan bukti hanya dapat diakses akun Satgas. Mode rahasia
        menghapus nama dan kontak pada kolom identitas, tetapi tidak menghapus
        identitas yang Anda tulis dalam uraian atau lampiran.{' '}
        {features.data?.demo &&
          'Jangan menyertakan data korban nyata untuk mencoba portal demo ini.'}
      </p>
      <h2>Konsultasi dan kode akses</h2>
      <p>
        Nama, kontak, dan percakapan tersedia bagi pengurus pesantren tujuan.
        Tiket laporan, nomor registrasi, dan kode sesi chat bertindak sebagai
        akses ke layanan terkait. Simpan secara pribadi. Sesi chat pada browser
        tidak disimpan setelah halaman dimuat ulang.
      </p>
      <h2>Akun pengelola</h2>
      <p>
        Token login disimpan pada sesi tab browser. Logout menghapus token dan
        cache data frontend. Ganti atau reset password membatalkan token lama.
        Penggunaan akun harus sesuai kewenangan masing-masing pengelola.
      </p>
      <h2>Layanan peta</h2>
      <p>
        Peta 2D menggunakan tile OpenStreetMap yang dimuat dari server pihak
        ketiga. Peta 3D merupakan ilustrasi wilayah, bukan peta batas
        administratif resmi. Font dimuat secara lokal dari aplikasi.
      </p>
      <h2>Penggunaan layanan</h2>
      <p>
        Halaman ini menjelaskan perilaku implementasi, bukan pernyataan
        kepatuhan hukum atau kebijakan resmi Kementerian Agama. Hubungi
        pengelola layanan untuk permintaan koreksi atau penghapusan data,
        penjelasan masa penyimpanan, dan tindak lanjut layanan.
      </p>
    </div>
  )
}

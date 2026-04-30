# API Documentation & Postman Collection

Folder ini berisi koleksi Postman yang lengkap untuk menguji API **Evaluasi MI**.

## File
- `collection.json`: Koleksi semua endpoint API (Auth, Admin, Dosen, Fasilitas, Evaluasi).
- `environment.json`: Variabel environment untuk URL server dan token otomatis.

## Cara Menggunakan
1. Buka Postman.
2. Klik **Import** dan pilih kedua file di folder ini.
3. Pilih Environment **Evaluasi MI Local**.
4. Jalankan request **01. Authentication > Login**. Script otomatis akan menyimpan token ke environment, sehingga Anda bisa langsung menjalankan endpoint lainnya tanpa setting manual.

## Struktur Database yang Dicakup
- **Users**: Registrasi, login, profile, reset password.
- **Dosen**: Manajemen dosen dan mata kuliah.
- **Fasilitas**: Manajemen fasilitas sarana prasarana.
- **Periode Evaluasi**: Aktivasi dan pengaturan periode.
- **Pernyataan**: Manajemen instrumen kuesioner.
- **Evaluasi**: Proses pengisian evaluasi dan statistik.

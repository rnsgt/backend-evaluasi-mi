import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Starting Prisma seeding...\n');

    await prisma.evaluasi_detail.deleteMany();
    await prisma.evaluasi_dosen.deleteMany();
    await prisma.evaluasi_fasilitas.deleteMany();

    // 1. Seed Users (1 Admin + 1 Test Mahasiswa)
    console.log('📝 Seeding users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Delete existing users first
    await prisma.users.deleteMany();
    
    const admin = await prisma.users.create({
      data: {
        nim: null,
        nama: 'Admin Evaluasi',
        email: 'admin@evaluasi.com',
        password: hashedPassword,
        role: 'admin',
        prodi: null,
        angkatan: null,
      }
    });
    console.log('✅ Admin user created:', admin.email);

    const mahasiswa = await prisma.users.create({
      data: {
        nim: '210101001',
        nama: 'Ahmad Fauzi',
        email: '210101001@student.ac.id',
        password: hashedPassword,
        role: 'mahasiswa',
        prodi: 'Teknik Informatika',
        angkatan: '2021',
      }
    });
    console.log('✅ Mahasiswa user created:', mahasiswa.email);

    // 2. Seed Periode Evaluasi
    console.log('\n📝 Seeding periode evaluasi...');
    await prisma.periode_evaluasi.deleteMany();
    
    const periode = await prisma.periode_evaluasi.create({
      data: {
        nama: 'Evaluasi Gasal 2024/2025',
        tahun_ajaran: '2024/2025',
        semester: 'Ganjil',
        tanggal_mulai: new Date('2024-09-01'),
        tanggal_akhir: new Date('2025-01-31'),
        batas_evaluasi: new Date('2025-01-15'),
        status: 'aktif',
        keterangan: 'Periode evaluasi semester gasal tahun ajaran 2024/2025'
      }
    });
    console.log('✅ Periode evaluasi created:', periode.nama);

    // 3. Seed Dosen
    console.log('\n📝 Seeding dosen...');
    await prisma.dosen.deleteMany();
    
    const dosen = await prisma.dosen.create({
      data: {
        nip: '197801012005011001',
        nama: 'Dr. Ir. Bambang Wijaya, M.Kom',
        email: 'bambang.wijaya@university.ac.id',
      }
    });
    console.log('✅ Dosen created:', dosen.nama);

    // 4. Seed Fasilitas
    console.log('\n📝 Seeding fasilitas...');
    await prisma.fasilitas.deleteMany();
    
    const fasilitas = await prisma.fasilitas.create({
      data: {
        kode: 'RUANG-001',
        nama: 'Ruang Kelas 1.1',
        kategori: 'Ruang Kelas',
        lokasi: 'Gedung A Lantai 1',
        kapasitas: 50,
      }
    });
    console.log('✅ Fasilitas created:', fasilitas.nama);

    // 5. Seed Pernyataan Dosen
    console.log('\n📝 Seeding pernyataan dosen...');
    await prisma.pernyataan_dosen.deleteMany();

    const pernyataanDosenData = [
      { id: 1, urutan: 1, kategori: 'Penguasaan Materi', pernyataan: 'Dosen menguasai materi dengan baik' },
      { id: 2, urutan: 2, kategori: 'Penguasaan Materi', pernyataan: 'Dosen memberikan penjelasan yang mudah dipahami' },
      { id: 3, urutan: 3, kategori: 'Penguasaan Materi', pernyataan: 'Dosen mampu menjawab pertanyaan mahasiswa dengan jelas' },
      { id: 4, urutan: 4, kategori: 'Penguasaan Materi', pernyataan: 'Dosen menggunakan contoh-contoh yang relevan' },
      { id: 5, urutan: 5, kategori: 'Metode Pengajaran', pernyataan: 'Metode pengajaran yang digunakan menarik' },
      { id: 6, urutan: 6, kategori: 'Metode Pengajaran', pernyataan: 'Dosen menggunakan media pembelajaran yang variatif' },
      { id: 7, urutan: 7, kategori: 'Metode Pengajaran', pernyataan: 'Dosen mendorong mahasiswa untuk aktif di kelas' },
      { id: 8, urutan: 8, kategori: 'Metode Pengajaran', pernyataan: 'Materi yang diajarkan sesuai dengan RPS' },
      { id: 9, urutan: 9, kategori: 'Komunikasi', pernyataan: 'Dosen berkomunikasi dengan sopan dan ramah' },
      { id: 10, urutan: 10, kategori: 'Komunikasi', pernyataan: 'Dosen responsif terhadap pertanyaan mahasiswa' },
      { id: 11, urutan: 11, kategori: 'Penilaian', pernyataan: 'Sistem penilaian yang diterapkan jelas dan transparan' },
      { id: 12, urutan: 12, kategori: 'Penilaian', pernyataan: 'Dosen memberikan feedback terhadap tugas/ujian' },
      { id: 13, urutan: 13, kategori: 'Penilaian', pernyataan: 'Penilaian yang diberikan objektif dan adil' },
      { id: 14, urutan: 14, kategori: 'Kedisiplinan', pernyataan: 'Dosen hadir tepat waktu' },
      { id: 15, urutan: 15, kategori: 'Kedisiplinan', pernyataan: 'Dosen memanfaatkan waktu perkuliahan dengan efektif' },
    ];

    for (const item of pernyataanDosenData) {
      await prisma.pernyataan_dosen.create({ data: item });
    }
    console.log(`✅ Pernyataan dosen created (${pernyataanDosenData.length})`);

    // 6. Seed Pernyataan Fasilitas
    console.log('\n📝 Seeding pernyataan fasilitas...');
    await prisma.pernyataan_fasilitas.deleteMany();

    const pernyataanFasilitasData = [
      { id: 1, urutan: 1, kategori: 'Kebersihan', pernyataan: 'Fasilitas selalu dalam kondisi bersih dan terawat' },
      { id: 3, urutan: 2, kategori: 'Kebersihan', pernyataan: 'Area sekitar fasilitas bebas dari sampah dan kotoran' },
      { id: 4, urutan: 3, kategori: 'Kelengkapan', pernyataan: 'Peralatan/perlengkapan yang tersedia berfungsi dengan baik' },
      { id: 5, urutan: 4, kategori: 'Kelengkapan', pernyataan: 'Jumlah peralatan/perlengkapan memadai untuk jumlah pengguna' },
      { id: 6, urutan: 5, kategori: 'Kelengkapan', pernyataan: 'Fasilitas pendukung (AC, proyektor, dll) tersedia dan berfungsi' },
      { id: 7, urutan: 6, kategori: 'Kenyamanan', pernyataan: 'Pencahayaan di fasilitas ini sudah memadai' },
      { id: 8, urutan: 7, kategori: 'Kenyamanan', pernyataan: 'Suhu ruangan nyaman untuk aktivitas' },
      { id: 11, urutan: 8, kategori: 'Aksesibilitas', pernyataan: 'Lokasi fasilitas mudah dijangkau' },
      { id: 12, urutan: 9, kategori: 'Aksesibilitas', pernyataan: 'Fasilitas dapat digunakan sesuai jadwal yang ditentukan' },
    ];

    for (const item of pernyataanFasilitasData) {
      await prisma.pernyataan_fasilitas.create({ data: item });
    }
    console.log(`✅ Pernyataan fasilitas created (${pernyataanFasilitasData.length})`);

    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('pernyataan_dosen', 'id'), (SELECT COALESCE(MAX(id), 1) FROM pernyataan_dosen))`;
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('pernyataan_fasilitas', 'id'), (SELECT COALESCE(MAX(id), 1) FROM pernyataan_fasilitas))`;

    console.log('\n✅ ✅ ✅ Database seeding completed successfully!');
    console.log('\n🔐 Test Account:');
    console.log('   Email: admin@evaluasi.com');
    console.log('   Password: password123');
    console.log('   Role: admin\n');
    console.log('   Email: 210101001@student.ac.id');
    console.log('   Password: password123');
    console.log('   Role: mahasiswa\n');

  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

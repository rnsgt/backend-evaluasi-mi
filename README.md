# Backend API - Evaluasi Akademik MI

Backend REST API untuk aplikasi Evaluasi Akademik MI menggunakan Node.js, Express, dan PostgreSQL.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 atau lebih baru)
- PostgreSQL (v12 atau lebih baru)
- npm atau yarn

### Installation

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Setup environment variables:**
```bash
cp .env.example .env
```

Edit file `.env` dan sesuaikan konfigurasi database Anda:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=evaluasi_mi
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key

# Prisma akan construct DATABASE_URL dari variabel ini
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/evaluasi_mi?schema=public"
```

3. **Create database:**
```bash
# Login ke PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE evaluasi_mi;

# Exit
\q
```

4. **Setup database schema dengan Prisma:**
```bash
# Apply migrations (akan create semua tables)
npx prisma migrate deploy
```

5. **Seed sample data (optional):**
```bash
npm run seed
```

6. **Start server:**
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server akan berjalan di `http://localhost:3000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register mahasiswa baru
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (requires auth)
- `PUT /api/auth/change-password` - Change password (requires auth)

### Dosen
- `GET /api/dosen` - Get all dosen dengan mata kuliah
- `GET /api/dosen/:id` - Get dosen by ID

### Fasilitas
- `GET /api/fasilitas` - Get all fasilitas
- `GET /api/fasilitas/:id` - Get fasilitas by ID

### Periode
- `GET /api/periode/active` - Get active periode
- `GET /api/periode` - Get all periode (admin only)
- `POST /api/periode` - Create periode (admin only)
- `PUT /api/periode/:id` - Update periode (admin only)
- `PUT /api/periode/:id/activate` - Activate periode (admin only)
- `DELETE /api/periode/:id` - Delete periode (admin only)

### Evaluasi
- `GET /api/evaluasi/pernyataan/dosen` - Get pernyataan evaluasi dosen
- `GET /api/evaluasi/pernyataan/fasilitas` - Get pernyataan evaluasi fasilitas
- `POST /api/evaluasi/dosen` - Submit evaluasi dosen
- `POST /api/evaluasi/fasilitas` - Submit evaluasi fasilitas
- `GET /api/evaluasi/riwayat` - Get riwayat evaluasi mahasiswa
- `GET /api/evaluasi/statistik` - Get statistik mahasiswa

### Admin
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/laporan` - Get laporan evaluasi (with filters)

## 🔐 Authentication

API menggunakan JWT (JSON Web Token) untuk authentication. 

**Header format:**
```
Authorization: Bearer <token>
```

**Token didapat dari:**
- Response login endpoint
- Response register endpoint

## 📝 Sample Requests

### Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nim": "210101001",
    "nama": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "prodi": "Teknik Informatika",
    "angkatan": "2021"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Submit Evaluasi Dosen
```bash
curl -X POST http://localhost:3000/api/evaluasi/dosen \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "dosen_id": 1,
    "mata_kuliah_id": 1,
    "periode_id": 1,
    "komentar": "Dosen sangat baik",
    "jawaban": [
      {"pernyataan_id": 1, "nilai": 5},
      {"pernyataan_id": 2, "nilai": 4}
    ]
  }'
```

## 🗄️ Database Schema & Prisma Migrations

Backend sekarang menggunakan **Prisma ORM** untuk database management yang lebih baik, dengan support untuk:
- Type-safe database queries
- Automated migrations
- Easy schema versioning

Lihat file `migrations/schema.sql` untuk detail lengkap struktur database.

**Main Tables:**
- `users` - Data mahasiswa & admin
- `dosen` - Data dosen
- `mata_kuliah` - Data mata kuliah
- `fasilitas` - Data fasilitas kampus
- `periode_evaluasi` - Periode evaluasi
- `pernyataan_dosen` - Pernyataan evaluasi dosen
- `pernyataan_fasilitas` - Pernyataan evaluasi fasilitas
- `evaluasi_dosen` - Data evaluasi dosen
- `evaluasi_fasilitas` - Data evaluasi fasilitas
- `evaluasi_detail` - Detail jawaban evaluasi

### Prisma Setup

Prisma sudah dikonfigurasi dengan introspected schema dari database yang ada. Konfigurasi ada di:
- `prisma/schema.prisma` - Schema definition
- `prisma/migrations/` - Migration history
- `.env` - `DATABASE_URL` untuk koneksi

### Menggunakan Prisma Migrations

#### 1. **Create a new migration** (saat ada perubahan schema)
```bash
# Buat migration baru dengan nama deskriptif
npx prisma migrate dev --name add_new_field

# Contoh:
# npx prisma migrate dev --name add_user_phone_number
```

Prisma akan:
1. Mendeteksi perubahan di `schema.prisma`
2. Generate migration file di `prisma/migrations/`
3. Apply migration ke database
4. Re-generate Prisma Client

#### 2. **Apply existing migrations** (di production/baru pull)
```bash
# Terapkan semua pending migrations
npx prisma migrate deploy

# Dengan dry-run untuk preview:
npx prisma migrate deploy --dry-run
```

#### 3. **Reset local database** (development only - HAPUS SEMUA DATA!)
```bash
# Reset database dan re-apply semua migrations
npx prisma migrate reset

# Dengan seed:
npx prisma migrate reset --skip-seed
```

#### 4. **Inspect database dengan Prisma Studio** (UI interactive)
```bash
npx prisma studio
```

Buka browser ke `http://localhost:5555` untuk browse & edit data.

### Migration Workflow

**Development:**
1. Edit `prisma/schema.prisma` jika ada perubahan schema
2. Jalankan `npx prisma migrate dev --name <description>`
3. Test di local
4. Commit `.prisma/schema.prisma` dan migration files ke git

**Production Deployment:**
1. Pull latest code (termasuk migration files)
2. Run `npx prisma migrate deploy` sebelum start aplikasi
3. Aplikasi akan berjalan dengan schema terbaru

### Best Practices

- ✅ Always use named migrations: `--name add_field_reason`
- ✅ Test migrations di local sebelum production
- ✅ Commit schema.prisma dan migrations/ bersama source code
- ✅ Jangan edit migration files setelah deployed
- ✅ Gunakan `prisma migrate deploy` untuk production (bukan `dev`)
- ❌ Jangan gunakan `prisma db push` di production
- ❌ Jangan gunakan `prisma migrate reset` di production

### Troubleshooting

**"Schema not in sync" error:**
```bash
# Re-introspect dari database (jika schema berubah dari luar Prisma)
npx prisma db pull
```

**Migration failed:**
```bash
# Lihat status migrations
npx prisma migrate status

# Resolve failed migration (jika yakin yang benar)
npx prisma migrate resolve --rolled-back <migration_name>
```

## 🗄️ Database Schema

## 🧪 Testing

Gunakan Postman atau Thunder Client untuk testing API.

**Test Credentials:**
- Admin: `admin@evaluasi.com` / `admin123`
- Mahasiswa: `210101001@student.ac.id` / `mahasiswa123`

## 🔧 Troubleshooting

**Database connection error:**
- Pastikan PostgreSQL running
- Cek credentials di file `.env`
- Cek firewall/port 5432

**JWT error:**
- Generate JWT secret baru: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Update `JWT_SECRET` di `.env`

**Port already in use:**
- Ubah `PORT` di `.env`
- Atau stop process yang menggunakan port 3000

## 📦 Dependencies

- **express** - Web framework
- **pg** - PostgreSQL client
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **cors** - CORS middleware
- **dotenv** - Environment variables
- **express-validator** - Request validation

## 📜 License

MIT

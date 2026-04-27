-- CreateTable users
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "nim" VARCHAR(20),
    "nama" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) DEFAULT 'mahasiswa',
    "prodi" VARCHAR(100),
    "angkatan" VARCHAR(10),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_nim_key" UNIQUE ("nim"),
    CONSTRAINT "users_email_key" UNIQUE ("email")
);

-- CreateTable dosen
CREATE TABLE IF NOT EXISTS "dosen" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "nip" VARCHAR(30) NOT NULL,
    "nama" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100),
    "foto" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dosen_nip_key" UNIQUE ("nip")
);

-- CreateTable periodo_evaluasi
CREATE TABLE IF NOT EXISTS "periodo_evaluasi" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "nama" VARCHAR(100) NOT NULL,
    "tahun_ajaran" VARCHAR(20) NOT NULL,
    "semester" VARCHAR(20) NOT NULL,
    "tanggal_mulai" DATE NOT NULL,
    "tanggal_akhir" DATE NOT NULL,
    "batas_evaluasi" DATE,
    "status" VARCHAR(20) DEFAULT 'tidak_aktif',
    "keterangan" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable fasilitas
CREATE TABLE IF NOT EXISTS "fasilitas" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "kode" VARCHAR(20) NOT NULL,
    "nama" VARCHAR(100) NOT NULL,
    "kategori" VARCHAR(50) NOT NULL,
    "lokasi" VARCHAR(100),
    "kapasitas" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fasilitas_kode_key" UNIQUE ("kode")
);

CREATE TABLE IF NOT EXISTS "mata_kuliah" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "kode" VARCHAR(20) NOT NULL,
    "nama" VARCHAR(100) NOT NULL,
    "sks" INTEGER NOT NULL,
    "semester" INTEGER,
    "dosen_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mata_kuliah_kode_key" UNIQUE ("kode"),
    CONSTRAINT "mata_kuliah_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS "pernyataan_dosen" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "kategori" VARCHAR(50) NOT NULL,
    "pernyataan" TEXT NOT NULL,
    "urutan" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "pernyataan_fasilitas" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "kategori" VARCHAR(50) NOT NULL,
    "pernyataan" TEXT NOT NULL,
    "urutan" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "evaluasi_dosen" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "dosen_id" INTEGER NOT NULL,
    "mata_kuliah_id" INTEGER NOT NULL,
    "periode_id" INTEGER NOT NULL,
    "komentar" TEXT,
    "status" VARCHAR(20) DEFAULT 'submitted',
    "submitted_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluasi_dosen_user_id_dosen_id_mata_kuliah_id_periode_id_key" UNIQUE ("user_id", "dosen_id", "mata_kuliah_id", "periode_id"),
    CONSTRAINT "evaluasi_dosen_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "evaluasi_dosen_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "evaluasi_dosen_mata_kuliah_id_fkey" FOREIGN KEY ("mata_kuliah_id") REFERENCES "mata_kuliah" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "evaluasi_dosen_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periodo_evaluasi" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS "evaluasi_fasilitas" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "fasilitas_id" INTEGER NOT NULL,
    "periode_id" INTEGER NOT NULL,
    "komentar" TEXT,
    "status" VARCHAR(20) DEFAULT 'submitted',
    "submitted_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluasi_fasilitas_user_id_fasilitas_id_periode_id_key" UNIQUE ("user_id", "fasilitas_id", "periode_id"),
    CONSTRAINT "evaluasi_fasilitas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "evaluasi_fasilitas_fasilitas_id_fkey" FOREIGN KEY ("fasilitas_id") REFERENCES "fasilitas" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "evaluasi_fasilitas_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periodo_evaluasi" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS "evaluasi_detail" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "evaluasi_dosen_id" INTEGER,
    "evaluasi_fasilitas_id" INTEGER,
    "pernyataan_dosen_id" INTEGER,
    "pernyataan_fasilitas_id" INTEGER,
    "nilai" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluasi_detail_evaluasi_dosen_id_fkey" FOREIGN KEY ("evaluasi_dosen_id") REFERENCES "evaluasi_dosen" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "evaluasi_detail_evaluasi_fasilitas_id_fkey" FOREIGN KEY ("evaluasi_fasilitas_id") REFERENCES "evaluasi_fasilitas" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "evaluasi_detail_pernyataan_dosen_id_fkey" FOREIGN KEY ("pernyataan_dosen_id") REFERENCES "pernyataan_dosen" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "evaluasi_detail_pernyataan_fasilitas_id_fkey" FOREIGN KEY ("pernyataan_fasilitas_id") REFERENCES "pernyataan_fasilitas" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_nim_idx" ON "users"("nim");
CREATE UNIQUE INDEX "users_nim_key" ON "users"("nim");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE UNIQUE INDEX "dosen_nip_key" ON "dosen"("nip");
CREATE INDEX "idx_dosen_nip" ON "dosen"("nip");
CREATE INDEX "idx_mata_kuliah_dosen" ON "mata_kuliah"("dosen_id");
CREATE UNIQUE INDEX "mata_kuliah_kode_key" ON "mata_kuliah"("kode");
CREATE UNIQUE INDEX "fasilitas_kode_key" ON "fasilitas"("kode");
CREATE INDEX "idx_periode_status" ON "periodo_evaluasi"("status");
CREATE INDEX "idx_evaluasi_dosen_user" ON "evaluasi_dosen"("user_id");
CREATE INDEX "idx_evaluasi_dosen_periode" ON "evaluasi_dosen"("periode_id");
CREATE UNIQUE INDEX "evaluasi_dosen_user_id_dosen_id_mata_kuliah_id_periode_id_key" ON "evaluasi_dosen"("user_id", "dosen_id", "mata_kuliah_id", "periode_id");
CREATE INDEX "idx_evaluasi_fasilitas_user" ON "evaluasi_fasilitas"("user_id");
CREATE INDEX "idx_evaluasi_fasilitas_periode" ON "evaluasi_fasilitas"("periode_id");
CREATE UNIQUE INDEX "evaluasi_fasilitas_user_id_fasilitas_id_periode_id_key" ON "evaluasi_fasilitas"("user_id", "fasilitas_id", "periode_id");

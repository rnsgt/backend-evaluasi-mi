import { PrismaClient } from '@prisma/client';

// Instantiate Prisma Client
const prisma = new PrismaClient();

let dbConnected = false;

// Test connection function
const testConnection = async () => {
  try {
    // Test connection to database
    await prisma.$queryRaw`SELECT NOW()`;
    dbConnected = true;
    console.log('✅ Database connected successfully');
    console.log(`📊 Database: ${process.env.DB_NAME || 'evaluasi_mi'}`);
  } catch (error) {
    dbConnected = false;
    console.error('❌ Database connection failed:', error.message);
    console.error('⚠️ Backend tetap berjalan (degraded mode), namun endpoint yang butuh database akan gagal sampai DB aktif.');
    console.error(`🔎 Cek konfigurasi: DB_HOST=${process.env.DB_HOST || 'localhost'}, DB_PORT=${process.env.DB_PORT || '5432'}, DB_NAME=${process.env.DB_NAME || 'evaluasi_mi'}`);
  }
};

const isDatabaseConnected = () => dbConnected;

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export {
  prisma,
  testConnection,
  isDatabaseConnected,
};

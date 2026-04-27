import { PrismaClient } from '@prisma/client';

// Instantiate Prisma Client
const prisma = new PrismaClient();

let dbConnected = false;

// Test connection function
const testConnection = async () => {
  try {
    // Test connection to database
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
    console.log('✅ Database connected successfully');
    
    // Log info (hiding sensitive parts)
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl) {
      const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
      console.log(`📊 Database URL: ${maskedUrl}`);
    } else {
      console.log(`📊 Database: ${process.env.DB_NAME || 'evaluasi_mi'} at ${process.env.DB_HOST || 'localhost'}`);
    }
  } catch (error) {
    dbConnected = false;
    console.error('❌ Database connection failed:', error.message);
    
    // Provide diagnostic info for Vercel
    if (process.env.VERCEL) {
      console.error('💡 Tip: Ensure DATABASE_URL is set in Vercel project settings.');
      console.error('💡 Tip: If using a local database, Vercel cannot reach it. Use a cloud DB like Supabase/Neon.');
    }
    
    console.error(`🔎 Diagnostic: DB_HOST=${process.env.DB_HOST || 'not set'}, DB_URL_PRESENT=${!!process.env.DATABASE_URL}`);
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

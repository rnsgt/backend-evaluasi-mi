import 'dotenv/config';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Cleaning up database tables...');
  
  try {
    // Order matters because of foreign keys
    console.log('- Deleting evaluasi_detail...');
    await prisma.evaluasi_detail.deleteMany();
    
    console.log('- Deleting evaluasi_dosen...');
    await prisma.evaluasi_dosen.deleteMany();
    
    console.log('- Deleting evaluasi_fasilitas...');
    await prisma.evaluasi_fasilitas.deleteMany();
    
    console.log('- Deleting mata_kuliah...');
    await prisma.mata_kuliah.deleteMany();
    
    console.log('- Deleting dosen...');
    await prisma.dosen.deleteMany();
    
    console.log('- Deleting fasilitas...');
    await prisma.fasilitas.deleteMany();
    
    console.log('Cleanup successful!');
  } catch (error) {
    console.error('Cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

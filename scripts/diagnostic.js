import 'dotenv/config';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
const { Pool } = pkg;

async function runDiagnostic() {
  console.log('--- START DIAGNOSTIC ---');
  
  const connectionString = process.env.DATABASE_URL;
  console.log('Connecting to:', connectionString ? 'URL Found' : 'URL NOT FOUND');
  
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('1. Testing Connection...');
    await prisma.$connect();
    console.log('✅ Connection OK');

    console.log('2. Testing Query (dosen.count)...');
    const count = await prisma.dosen.count();
    console.log('✅ Count OK:', count);

    console.log('3. Testing Create Dosen...');
    const testDosen = await prisma.dosen.create({
      data: {
        nip: 'TEST-' + Date.now(),
        nama: 'Test Dosen Diagnostic',
        email: 'test' + Date.now() + '@example.com'
      }
    });
    console.log('✅ Create Dosen OK:', testDosen.id);

    console.log('4. Testing Create Mata Kuliah...');
    const testMK = await prisma.mata_kuliah.create({
      data: {
        kode: 'MK-DIAG-' + Math.random().toString(36).substring(2, 5).toUpperCase(),
        nama: 'Diagnostic Subject',
        dosen_id: testDosen.id
      }
    });
    console.log('✅ Create Mata Kuliah OK:', testMK.id);

    console.log('5. Testing Dashboard Raw Query...');
    const dashboardQuery = await prisma.$queryRaw`SELECT COUNT(*) FROM dosen`;
    console.log('✅ Raw Query OK:', dashboardQuery);

    console.log('6. Testing Laporan Aggregation...');
    // This is often where it fails due to numeric/float issues
    const avgQuery = await prisma.$queryRaw`SELECT AVG(id) FROM dosen`;
    console.log('✅ AVG Query OK:', avgQuery);

    console.log('--- DIAGNOSTIC SUCCESSFUL ---');
  } catch (error) {
    console.error('❌ DIAGNOSTIC FAILED!');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    if (error.meta) console.error('Error Meta:', JSON.stringify(error.meta, null, 2));
    if (error.stack) console.error('Stack Trace:', error.stack);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runDiagnostic();

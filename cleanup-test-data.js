const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupTestData() {
  try {
    console.log('🧹 Starting cleanup of test evaluation data...\n');

    // Get counts before cleanup
    const beforeDosen = await prisma.evaluasi_dosen.count();
    const beforeFasilitas = await prisma.evaluasi_fasilitas.count();
    const beforeDetail = await prisma.evaluasi_detail.count();

    console.log('📊 Before cleanup:');
    console.log(`  - Evaluasi Dosen: ${beforeDosen}`);
    console.log(`  - Evaluasi Fasilitas: ${beforeFasilitas}`);
    console.log(`  - Evaluasi Detail: ${beforeDetail}\n`);

    // Delete all evaluation data (cascade delete will handle evaluasi_detail)
    const deletedDosen = await prisma.evaluasi_dosen.deleteMany({});
    const deletedFasilitas = await prisma.evaluasi_fasilitas.deleteMany({});
    
    console.log('✅ Cleanup completed:');
    console.log(`  - Deleted Evaluasi Dosen: ${deletedDosen.count}`);
    console.log(`  - Deleted Evaluasi Fasilitas: ${deletedFasilitas.count}\n`);

    // Get counts after cleanup
    const afterDosen = await prisma.evaluasi_dosen.count();
    const afterFasilitas = await prisma.evaluasi_fasilitas.count();
    const afterDetail = await prisma.evaluasi_detail.count();

    console.log('📊 After cleanup:');
    console.log(`  - Evaluasi Dosen: ${afterDosen}`);
    console.log(`  - Evaluasi Fasilitas: ${afterFasilitas}`);
    console.log(`  - Evaluasi Detail: ${afterDetail}\n`);

    console.log('✨ Test data cleanup finished successfully!');
    console.log('\n⚠️  Note: Data is now clean. Any new evaluations must be fresh inputs.\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTestData();

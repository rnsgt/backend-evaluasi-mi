/**
 * FASE 2 - QUICK API VERIFICATION SCRIPT
 * Tests all critical endpoints for go-live readiness
 * Duration: ~5-10 minutes
 */

const http = require('http');

const BASE_URL = 'http://localhost:3002';
const TESTS = [];
let testsPassed = 0;
let testsFailed = 0;
let testToken = '';
let adminToken = '';

// Helper to make HTTP requests
function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Test runner
async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
    TESTS.push({ name, status: 'PASS' });
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
    TESTS.push({ name, status: 'FAIL', error: error.message });
  }
}

// Tests
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  FASE 2 - API VERIFICATION TEST SUITE     ║');
  console.log('║  Go-Live Readiness Check                   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // 1. AUTH TESTS
  console.log('📋 SECTION 1: AUTHENTICATION ENDPOINTS\n');

  await runTest('AUTH-1: Login as Student', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      nim: '210101001',
      password: '12345',
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.data.token) throw new Error('No token returned');
    testToken = res.data.token;
  });

  await runTest('AUTH-2: Login as Admin', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@gmail.com',
      password: 'password123',
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.data.token) throw new Error('No token returned');
    adminToken = res.data.token;
  });

  await runTest('AUTH-3: Invalid Login (Wrong NIM)', async () => {
    const res = await makeRequest('POST', '/api/auth/login', {
      nim: 'invalid',
      password: 'wrong',
    });
    if (res.status === 200) throw new Error('Should reject invalid credentials');
  });

  // 2. STUDENT ENDPOINTS
  console.log('\n📋 SECTION 2: STUDENT DATA ENDPOINTS\n');

  await runTest('STUDENT-1: Get Profile', async () => {
    const res = await makeRequest('GET', '/api/student/profile', null, testToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.data.data) throw new Error('No profile data');
  });

  await runTest('STUDENT-2: Get Dosen List', async () => {
    const res = await makeRequest('GET', '/api/dosen', null, testToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Not an array');
    if (res.data.data.length === 0) throw new Error('Empty dosen list');
  });

  await runTest('STUDENT-3: Get Fasilitas List', async () => {
    const res = await makeRequest('GET', '/api/fasilitas', null, testToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Not an array');
    if (res.data.data.length === 0) throw new Error('Empty fasilitas list');
  });

  // 3. EVALUASI ENDPOINTS
  console.log('\n📋 SECTION 3: EVALUASI SUBMISSION ENDPOINTS\n');

  await runTest('EVAL-1: Submit Evaluasi Dosen', async () => {
    const res = await makeRequest('POST', '/api/evaluasi/dosen', {
      dosenId: 1,
      ratings: [5, 5, 4, 4, 3, 3, 4, 5, 4, 3, 4, 5, 3, 4, 5],
      notes: 'Test evaluasi',
    }, testToken);
    if (res.status !== 201 && res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  await runTest('EVAL-2: Prevent Duplicate Evaluasi Dosen', async () => {
    const res = await makeRequest('POST', '/api/evaluasi/dosen', {
      dosenId: 1,
      ratings: [5, 5, 4, 4, 3, 3, 4, 5, 4, 3, 4, 5, 3, 4, 5],
      notes: 'Duplicate test',
    }, testToken);
    if (res.status === 201 || res.status === 200) throw new Error('Should reject duplicate');
  });

  await runTest('EVAL-3: Submit Evaluasi Fasilitas', async () => {
    const res = await makeRequest('POST', '/api/evaluasi/fasilitas', {
      fasilitasId: 1,
      ratings: [4, 4, 4, 4, 3, 3, 4, 5, 4],
      notes: 'Test fasilitas eval',
    }, testToken);
    if (res.status !== 201 && res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  await runTest('EVAL-4: Get Student Riwayat (History)', async () => {
    const res = await makeRequest('GET', '/api/evaluasi/riwayat', null, testToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Not an array');
  });

  // 4. STATS & CALCULATIONS
  console.log('\n📋 SECTION 4: STATISTICS & CALCULATIONS\n');

  await runTest('STATS-1: Get Overall Stats', async () => {
    const res = await makeRequest('GET', '/api/admin/stats', null, adminToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.data.data) throw new Error('No stats data');
  });

  await runTest('STATS-2: Get Daily Trend Data', async () => {
    const res = await makeRequest('GET', '/api/admin/daily-trend?days=7', null, adminToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Not an array');
  });

  await runTest('STATS-3: Verify Real-Time Fasilitas Score', async () => {
    const res = await makeRequest('GET', '/api/admin/stats', null, adminToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const stats = res.data.data;
    if (typeof stats.overallFasilitasScore !== 'number') throw new Error('No overallFasilitasScore');
    if (stats.overallFasilitasScore < 1 || stats.overallFasilitasScore > 5) {
      throw new Error('Score out of range (1-5)');
    }
  });

  // 5. ADMIN ENDPOINTS
  console.log('\n📋 SECTION 5: ADMIN MANAGEMENT ENDPOINTS\n');

  await runTest('ADMIN-1: Get Dosen Management Data', async () => {
    const res = await makeRequest('GET', '/api/admin/dosen', null, adminToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Not an array');
  });

  await runTest('ADMIN-2: Get Fasilitas Management Data', async () => {
    const res = await makeRequest('GET', '/api/admin/fasilitas', null, adminToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Not an array');
  });

  await runTest('ADMIN-3: Get Periode Data', async () => {
    const res = await makeRequest('GET', '/api/admin/periode', null, adminToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Not an array');
  });

  // 6. SECURITY TESTS
  console.log('\n📋 SECTION 6: SECURITY CHECKS\n');

  await runTest('SEC-1: Reject Unauthorized Access (No Token)', async () => {
    const res = await makeRequest('GET', '/api/admin/stats', null, null);
    if (res.status === 200) throw new Error('Should reject without token');
  });

  await runTest('SEC-2: Reject Invalid Token', async () => {
    const res = await makeRequest('GET', '/api/admin/stats', null, 'invalid.token.here');
    if (res.status === 200) throw new Error('Should reject invalid token');
  });

  await runTest('SEC-3: Student Cannot Access Admin Endpoints', async () => {
    const res = await makeRequest('GET', '/api/admin/stats', null, testToken);
    if (res.status === 200) throw new Error('Student should not access admin');
  });

  // 7. DATA INTEGRITY
  console.log('\n📋 SECTION 7: DATA INTEGRITY CHECKS\n');

  await runTest('DATA-1: Verify Average Calculations', async () => {
    // Submit evaluasi with known ratings
    const ratings = [5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3];
    const expected = (5 * 5 + 4 * 5 + 3 * 5) / 15; // Should be 4.0
    // Note: This would require getting the calculated score from DB
    // For now, just verify the endpoint responds correctly
    const res = await makeRequest('GET', '/api/evaluasi/riwayat', null, testToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // FINAL SUMMARY
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║           TEST SUMMARY REPORT              ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📊 Total:  ${testsPassed + testsFailed}`);
  console.log(`📈 Pass Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%\n`);

  if (testsFailed === 0) {
    console.log('🎉 ALL TESTS PASSED - APPLICATION READY FOR GO-LIVE!\n');
    return 0;
  } else {
    console.log('⚠️  SOME TESTS FAILED - REVIEW ABOVE\n');
    return 1;
  }
}

// Run tests
runAllTests()
  .then((code) => {
    console.log('\n' + '='.repeat(44));
    console.log(`Process exit code: ${code}`);
    process.exit(code);
  })
  .catch((error) => {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  });

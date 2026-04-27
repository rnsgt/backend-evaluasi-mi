#!/usr/bin/env powershell

# Debug script for evaluasi fasilitas endpoint

Write-Host "=== Testing Evaluasi Fasilitas Endpoint ===" -ForegroundColor Cyan

# 1. Login
Write-Host "`n[1] Mahasiswa login..." -ForegroundColor Yellow
$loginResp = Invoke-RestMethod -Method Post -Uri 'http://localhost:3002/api/auth/login' `
  -ContentType 'application/json' `
  -Body '{"identifier":"210101001","password":"password123"}'

if (-not $loginResp.data.token) {
  Write-Host "ERROR: Login failed" -ForegroundColor Red
  exit 1
}

$token = $loginResp.data.token
Write-Host "✓ Token: $($token.Substring(0, 30))..." -ForegroundColor Green

# 2. Get pernyataan fasilitas
Write-Host "`n[2] Getting pernyataan fasilitas..." -ForegroundColor Yellow
$pernyataanResp = Invoke-RestMethod -Method Get -Uri 'http://localhost:3002/api/evaluasi/pernyataan/fasilitas' `
  -Headers @{Authorization="Bearer $token"}

Write-Host "Pernyataan fasilitas:" -ForegroundColor Green
$pernyataanResp.data | ForEach-Object {
  Write-Host "  ID: $($_.id), Kategori: $($_.kategori), Pernyataan: $($_.pernyataan)"
}

$pernyataanId = $pernyataanResp.data[0].id
Write-Host "Using pernyataan_id: $pernyataanId" -ForegroundColor Cyan

# 3. Get fasilitas (from PilihFasilitasScreen data or API)
Write-Host "`n[3] Getting fasilitas..." -ForegroundColor Yellow
# For testing, we'll use hardcoded fasilitas_id from seed (should be 1 or 17)
$fasilitasId = 1  # Try with 1 first
$periodeId = 1

Write-Host "Using fasilitas_id: $fasilitasId, periode_id: $periodeId" -ForegroundColor Cyan

# 4. Prepare jawaban data
Write-Host "`n[4] Preparing jawaban data..." -ForegroundColor Yellow
$jawaban = @(
  @{pernyataan_id = $pernyataanId; nilai = 5}
)
Write-Host "Jawaban: $($jawaban | ConvertTo-Json)" -ForegroundColor Cyan

# 5. Prepare evaluasi data
$evaluasiData = @{
  fasilitas_id = $fasilitasId
  periode_id = $periodeId
  komentar = "Test evaluasi fasilitas"
  jawaban = $jawaban
} | ConvertTo-Json

Write-Host "`n[5] Request body:" -ForegroundColor Yellow
Write-Host $evaluasiData -ForegroundColor Cyan

# 6. Submit evaluasi
Write-Host "`n[6] Submitting evaluasi fasilitas..." -ForegroundColor Yellow

try {
  $result = Invoke-RestMethod -Method Post -Uri 'http://localhost:3002/api/evaluasi/fasilitas' `
    -Headers @{Authorization="Bearer $token"} `
    -ContentType 'application/json' `
    -Body $evaluasiData

  Write-Host "✓ SUCCESS!" -ForegroundColor Green
  Write-Host $result | ConvertTo-Json -Depth 5
} catch {
  Write-Host "✗ ERROR!" -ForegroundColor Red
  $statusCode = $_.Exception.Response.StatusCode.value__
  Write-Host "Status Code: $statusCode" -ForegroundColor Red
  
  if ($_.ErrorDetails.Message) {
    Write-Host "Error Details:" -ForegroundColor Red
    Write-Host $_.ErrorDetails.Message -ForegroundColor Red
  } else {
    Write-Host "Exception: $($_.Exception.Message)" -ForegroundColor Red
  }
  
  # Try alternate fasilitas_id
  if ($statusCode -in @(400, 404, 500)) {
    Write-Host "`nTrying with fasilitas_id = 17..." -ForegroundColor Yellow
    $evaluasiData2 = @{
      fasilitas_id = 17
      periode_id = $periodeId
      komentar = "Test with id 17"
      jawaban = $jawaban
    } | ConvertTo-Json

    try {
      $result2 = Invoke-RestMethod -Method Post -Uri 'http://localhost:3002/api/evaluasi/fasilitas' `
        -Headers @{Authorization="Bearer $token"} `
        -ContentType 'application/json' `
        -Body $evaluasiData2

      Write-Host "✓ SUCCESS with fasilitas_id = 17!" -ForegroundColor Green
      Write-Host $result2 | ConvertTo-Json -Depth 5
    } catch {
      Write-Host "✗ Also failed with fasilitas_id = 17" -ForegroundColor Red
      Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
  }
}

Write-Host "`nTest completed." -ForegroundColor Cyan

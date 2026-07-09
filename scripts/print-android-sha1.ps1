$keystore = Join-Path $env:USERPROFILE ".android\debug.keystore"
$keytool = $env:JAVA_HOME

if ($keytool) {
  $keytool = Join-Path $keytool "bin\keytool.exe"
} else {
  $candidates = @(
    "F:\Java\jdk-23\bin\keytool.exe",
    "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      $keytool = $candidate
      break
    }
  }
}

if (-not (Test-Path $keystore)) {
  Write-Host "Chua co debug.keystore. Tao moi..."
  if (-not $keytool -or -not (Test-Path $keytool)) {
    Write-Error "Khong tim thay keytool."
    exit 1
  }
  & $keytool -genkeypair -v `
    -keystore $keystore `
    -alias androiddebugkey `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storepass android `
    -keypass android `
    -dname "CN=Android Debug,O=Android,C=US"
}

if (-not $keytool -or -not (Test-Path $keytool)) {
  Write-Error "Khong tim thay keytool."
  exit 1
}

Write-Host ""
Write-Host "SHA-1 debug (them vao Firebase -> Project settings -> Android app):"
& $keytool -list -v `
  -keystore $keystore `
  -alias androiddebugkey `
  -storepass android `
  -keypass android | Select-String -Pattern "SHA1:"

Write-Host ""
Write-Host "Sau khi them SHA-1: tai lai google-services.json -> npx expo run:android"

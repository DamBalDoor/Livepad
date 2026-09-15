$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $root
$maria = Join-Path $root ".tools\mariadb-11.4.7-winx64"
$datadir = Join-Path $maria "data"
$mysqld = Join-Path $maria "bin\mysqld.exe"
$mysql = Join-Path $maria "bin\mysql.exe"
$installDb = Join-Path $maria "bin\mysql_install_db.exe"

if (-not (Test-Path $mysqld)) {
  throw "Portable MariaDB not found at $maria. Prefer: docker compose up -d mysql"
}

if (-not (Test-Path (Join-Path $datadir "mysql"))) {
  & $installDb --datadir=$datadir --password=
}

$running = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if (-not $running) {
  Start-Process -FilePath $mysqld -ArgumentList "--datadir=$datadir","--port=3306","--bind-address=127.0.0.1" -WindowStyle Hidden
  $ok = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
      & $mysql -u root --protocol=TCP -h 127.0.0.1 -e "SELECT 1;" | Out-Null
      $ok = $true
      break
    } catch {}
  }
  if (-not $ok) { throw "MariaDB did not start on port 3306" }
}

& $mysql -u root --protocol=TCP -h 127.0.0.1 -e @"
CREATE DATABASE IF NOT EXISTS livepad CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'livepad'@'127.0.0.1' IDENTIFIED BY 'livepad';
CREATE USER IF NOT EXISTS 'livepad'@'localhost' IDENTIFIED BY 'livepad';
GRANT ALL PRIVILEGES ON livepad.* TO 'livepad'@'127.0.0.1';
GRANT ALL PRIVILEGES ON livepad.* TO 'livepad'@'localhost';
FLUSH PRIVILEGES;
"@

Write-Output "MariaDB ready on 127.0.0.1:3306 (database livepad)"

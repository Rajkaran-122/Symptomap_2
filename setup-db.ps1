# Setup PostgreSQL database and user for SymptoMap

$psqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$pgBinPath = 'C:\Program Files\PostgreSQL\18\bin'
$env:PGPASSWORD = ''

Write-Host 'Setting up PostgreSQL for SymptoMap...' -ForegroundColor Cyan

# Step 1: Drop existing resources if they exist
Write-Host 'Step 1: Dropping existing database and user...' -ForegroundColor Yellow
& $psqlPath -U postgres -c 'DROP DATABASE IF EXISTS symptomap;' 2>&1 | Select-Object -First 5
& $psqlPath -U postgres -c 'DROP USER IF EXISTS symptomap;' 2>&1 | Select-Object -First 5

# Step 2: Create symptomap user
Write-Host 'Step 2: Creating symptomap user...' -ForegroundColor Yellow
& $psqlPath -U postgres -c 'CREATE USER symptomap WITH PASSWORD '"'"'password'"'"';' 2>&1

# Step 3: Create symptomap database
Write-Host 'Step 3: Creating symptomap database...' -ForegroundColor Yellow
& $psqlPath -U postgres -c 'CREATE DATABASE symptomap OWNER symptomap;' 2>&1

# Step 4: Grant privileges
Write-Host 'Step 4: Granting privileges...' -ForegroundColor Yellow
& $psqlPath -U postgres -d symptomap -c 'GRANT ALL PRIVILEGES ON SCHEMA public TO symptomap;' 2>&1
& $psqlPath -U postgres -d symptomap -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO symptomap;' 2>&1
& $psqlPath -U postgres -d symptomap -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO symptomap;' 2>&1

# Step 5: Verify connection
Write-Host 'Step 5: Verifying connection...' -ForegroundColor Yellow
$env:PGPASSWORD = 'password'
$result = & $psqlPath -U symptomap -d symptomap -c 'SELECT version();' 2>&1

if ($result -match 'PostgreSQL') {
    Write-Host 'PostgreSQL database setup successful!' -ForegroundColor Green
    $result | Select-Object -First 3
} else {
    Write-Host 'Connection verification failed!' -ForegroundColor Red
    $result
}

Write-Host 'Database setup complete!' -ForegroundColor Green

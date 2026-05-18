param(
  [string]$BaseUrl = $env:E2E_BASE_URL,
  [string]$SuperEmail = $env:E2E_SUPER_EMAIL,
  [string]$SuperPassword = $env:E2E_SUPER_PASSWORD
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "1/5 Validando Python"
Push-Location "$root\backend"
python -m py_compile main.py
Pop-Location

Write-Host "2/5 Validando JavaScript"
$jsFiles = @(
  "frontend\super-admin\app.js",
  "frontend\r\admin\app.js",
  "frontend\r\caixa\app.js",
  "frontend\r\garcom\app.js",
  "frontend\r\mesa\app.js",
  "frontend\r\tv\app.js",
  "frontend\shared\auth.js",
  "frontend\shared\tenant.js",
  "frontend\shared\config.js"
)
foreach ($file in $jsFiles) {
  node --check (Join-Path $root $file)
}

Write-Host "3/5 Validando JSON da Vercel"
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log('vercel.json ok')" (Join-Path $root "frontend\vercel.json")

Write-Host "4/5 Rodando E2E de producao"
& (Join-Path $PSScriptRoot "e2e-production.ps1") -BaseUrl $BaseUrl -SuperEmail $SuperEmail -SuperPassword $SuperPassword

Write-Host "5/5 Predeploy OK"

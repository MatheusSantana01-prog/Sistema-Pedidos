param(
  [string]$OutputDir = $env:BACKUP_OUTPUT_DIR,
  [string]$BaseUrl = $env:E2E_BASE_URL,
  [string]$SuperEmail = $env:E2E_SUPER_EMAIL,
  [string]$SuperPassword = $env:E2E_SUPER_PASSWORD
)

$ErrorActionPreference = "Stop"
if (-not $BaseUrl) { $BaseUrl = "https://frontend-teal-nine-80.vercel.app" }
if (-not $SuperEmail) { $SuperEmail = "admin@restaurante.com" }
if (-not $SuperPassword) { $SuperPassword = "admin123" }
if (-not $OutputDir) { $OutputDir = Join-Path $PSScriptRoot "backups" }

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function Invoke-Json($Method, $Uri, $Body = $null, $Token = $null) {
  $headers = @{}
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $params = @{ Method = $Method; Uri = $Uri; Headers = $headers; ContentType = "application/json" }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 30) }
  Invoke-RestMethod @params
}

$super = Invoke-Json POST "$BaseUrl/api/auth/login" @{ email = $SuperEmail; senha = $SuperPassword }
$backup = Invoke-Json GET "$BaseUrl/api/super-admin/backup" $null $super.token
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$path = Join-Path $OutputDir "platform-backup-$stamp.json"
$backup | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $path -Encoding UTF8

[pscustomobject]@{
  ok = $true
  path = $path
  restaurants = $backup.counts.restaurants
  orders = $backup.counts.orders
  version = $backup.version
} | ConvertTo-Json

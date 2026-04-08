param(
  [string]$EnvFilePath = ".env"
)

function Import-DotEnvFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }

    if ($line.StartsWith('export ')) {
      $line = $line.Substring(7).Trim()
    }

    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }

    $key = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($key, $value, 'Process')
  }
}

$ErrorActionPreference = "Stop"

$envCandidates = @(
  (Join-Path (Get-Location) $EnvFilePath),
  (Join-Path $PSScriptRoot "..\..\$EnvFilePath")
)

$loadedEnvPath = $null
foreach ($candidate in $envCandidates | Select-Object -Unique) {
  if (Test-Path $candidate) {
    Import-DotEnvFile -Path $candidate
    $loadedEnvPath = (Resolve-Path $candidate).Path
    break
  }
}

if (-not $loadedEnvPath) {
  Write-Host "ERROR: Could not find env file '$EnvFilePath'." -ForegroundColor Red
  Write-Host "Tried current directory and repo root." -ForegroundColor Yellow
  Write-Host "Create one from infra/azure/.env.azure.example" -ForegroundColor Yellow
  exit 1
}

Write-Host "Loaded env from: $loadedEnvPath" -ForegroundColor Green

$ResourceGroup = if ($env:AZURE_RESOURCE_GROUP) { $env:AZURE_RESOURCE_GROUP } else { 'rg-cash-book-dev' }
$ApiAppName = if ($env:AZURE_API_APP_NAME) { $env:AZURE_API_APP_NAME } else { 'cashbookapi-akash-2026' }
$ApiBaseUrl = if ($env:AZURE_API_BASE_URL) { $env:AZURE_API_BASE_URL } else { "https://$ApiAppName.azurewebsites.net" }

$ClientUrl = $env:CLIENT_URL
$MongodbUri = $env:MONGODB_URI
$JwtSecret = $env:JWT_SECRET

$JwtAccessExpiry = if ($env:JWT_ACCESS_EXPIRY) { $env:JWT_ACCESS_EXPIRY } else { '15m' }
$JwtRefreshExpiry = if ($env:JWT_REFRESH_EXPIRY) { $env:JWT_REFRESH_EXPIRY } else { '7d' }
$BcryptRounds = if ($env:BCRYPT_ROUNDS) { $env:BCRYPT_ROUNDS } else { '10' }
$RateLimitTtl = if ($env:RATE_LIMIT_TTL) { $env:RATE_LIMIT_TTL } else { '60' }
$RateLimitMax = if ($env:RATE_LIMIT_MAX) { $env:RATE_LIMIT_MAX } else { '100' }

$GoogleClientId = if ($env:GOOGLE_CLIENT_ID) { $env:GOOGLE_CLIENT_ID } else { '' }
$GoogleClientSecret = if ($env:GOOGLE_CLIENT_SECRET) { $env:GOOGLE_CLIENT_SECRET } else { '' }
$GoogleCallbackUrl = if ($env:GOOGLE_CALLBACK_URL) { $env:GOOGLE_CALLBACK_URL } else { "$ApiBaseUrl/api/auth/google/callback" }

$GitHubClientId = if ($env:GITHUB_CLIENT_ID) { $env:GITHUB_CLIENT_ID } else { '' }
$GitHubClientSecret = if ($env:GITHUB_CLIENT_SECRET) { $env:GITHUB_CLIENT_SECRET } else { '' }
$GitHubCallbackUrl = if ($env:GITHUB_CALLBACK_URL) { $env:GITHUB_CALLBACK_URL } else { "$ApiBaseUrl/api/auth/github/callback" }

$AcsEmailConnectionString = if ($env:ACS_EMAIL_CONNECTION_STRING) { $env:ACS_EMAIL_CONNECTION_STRING } else { '' }
$AcsEmailSenderAddress = if ($env:ACS_EMAIL_SENDER_ADDRESS) { $env:ACS_EMAIL_SENDER_ADDRESS } else { '' }

if (-not $ClientUrl) {
  Write-Host "ERROR: CLIENT_URL is required in .env" -ForegroundColor Red
  exit 1
}
if (-not $MongodbUri) {
  Write-Host "ERROR: MONGODB_URI is required in .env" -ForegroundColor Red
  exit 1
}
if (-not $JwtSecret) {
  Write-Host "ERROR: JWT_SECRET is required in .env" -ForegroundColor Red
  exit 1
}

Write-Host "`n==== Configuring app settings on [$ApiAppName] ====" -ForegroundColor Cyan

az webapp config appsettings set `
  --resource-group $ResourceGroup `
  --name $ApiAppName `
  --settings `
    NODE_ENV=production `
    PORT=8080 `
    "MONGODB_URI=$MongodbUri" `
    "JWT_SECRET=$JwtSecret" `
    "JWT_ACCESS_EXPIRY=$JwtAccessExpiry" `
    "JWT_REFRESH_EXPIRY=$JwtRefreshExpiry" `
    "CLIENT_URL=$ClientUrl" `
    "CORS_ORIGIN=$ClientUrl" `
    "BCRYPT_ROUNDS=$BcryptRounds" `
    "RATE_LIMIT_TTL=$RateLimitTtl" `
    "RATE_LIMIT_MAX=$RateLimitMax" `
    "GOOGLE_CLIENT_ID=$GoogleClientId" `
    "GOOGLE_CLIENT_SECRET=$GoogleClientSecret" `
    "GOOGLE_CALLBACK_URL=$GoogleCallbackUrl" `
    "GITHUB_CLIENT_ID=$GitHubClientId" `
    "GITHUB_CLIENT_SECRET=$GitHubClientSecret" `
    "GITHUB_CALLBACK_URL=$GitHubCallbackUrl" `
    "ACS_EMAIL_CONNECTION_STRING=$AcsEmailConnectionString" `
    "ACS_EMAIL_SENDER_ADDRESS=$AcsEmailSenderAddress" `
  -o none

if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAILED] Could not apply app settings." -ForegroundColor Red
  exit 1
}

Write-Host "`nApp settings applied successfully!" -ForegroundColor Green
Write-Host "API URL    : $ApiBaseUrl" -ForegroundColor Yellow
Write-Host "Client URL : $ClientUrl`n" -ForegroundColor Yellow
Write-Host "Next: run .\infra\azure\export-github-secrets.ps1 -EnvFilePath $EnvFilePath" -ForegroundColor Cyan
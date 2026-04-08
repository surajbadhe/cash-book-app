# =============================================================
# EDIT THESE VALUES before running
# =============================================================
$ResourceGroup    = "rg-cash-book-dev"
$ApiAppName       = "cashbookapi-akash-2026"
$ClientUrl        = "https://lemon-moss-0924fe500.6.azurestaticapps.net"
$MongodbUri       = "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/cashflow?retryWrites=true&w=majority"
$JwtSecret        = "REPLACE_WITH_LONG_RANDOM_SECRET"
$JwtAccessExpiry  = "15m"
$JwtRefreshExpiry = "7d"
$BcryptRounds     = "10"
$RateLimitTtl     = "60"
$RateLimitMax     = "100"
# OAuth -- leave empty strings if not using
$GoogleClientId     = ""
$GoogleClientSecret = ""
$GitHubClientId     = ""
$GitHubClientSecret = ""
# =============================================================

$ErrorActionPreference = "Stop"
$ApiBaseUrl = "https://$ApiAppName.azurewebsites.net"

# Validate required values
if ($MongodbUri -like "*USER:PASSWORD*") {
    Write-Host "ERROR: Update MONGODB_URI with your real Atlas connection string." -ForegroundColor Red
    Write-Host "  Get it from: Atlas dashboard -> cluster -> Connect -> Drivers" -ForegroundColor Yellow
    exit 1
}
if ($JwtSecret -eq "REPLACE_WITH_LONG_RANDOM_SECRET") {
    Write-Host "ERROR: Set JWT_SECRET to a long random string." -ForegroundColor Red
    Write-Host "  Generate one:" -ForegroundColor Yellow
    Write-Host "  [System.Convert]::ToBase64String((1..48 | %{[byte](Get-Random -Max 256)}))" -ForegroundColor Yellow
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
    "GOOGLE_CALLBACK_URL=$ApiBaseUrl/api/auth/google/callback" `
    "GITHUB_CLIENT_ID=$GitHubClientId" `
    "GITHUB_CLIENT_SECRET=$GitHubClientSecret" `
    "GITHUB_CALLBACK_URL=$ApiBaseUrl/api/auth/github/callback" `
  -o none

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAILED] Could not apply app settings." -ForegroundColor Red; exit 1
}

Write-Host "`n  App settings applied successfully!" -ForegroundColor Green
Write-Host "  API URL    : $ApiBaseUrl" -ForegroundColor Yellow
Write-Host "  Client URL : $ClientUrl`n" -ForegroundColor Yellow
Write-Host "Next: run .\infra\azure\export-github-secrets.ps1" -ForegroundColor Cyan
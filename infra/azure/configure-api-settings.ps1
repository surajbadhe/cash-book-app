param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory = $true)]
    [string]$ApiAppName,

    [Parameter(Mandatory = $true)]
    [string]$ClientUrl,

    [Parameter(Mandatory = $true)]
    [string]$MongoDbUri,

    [Parameter(Mandatory = $true)]
    [string]$JwtSecret,

    [string]$JwtAccessExpiry = '15m',
    [string]$JwtRefreshExpiry = '7d',
    [int]$BcryptRounds = 10,
    [int]$RateLimitTtl = 60,
    [int]$RateLimitMax = 100,
    [string]$GoogleClientId = '',
    [string]$GoogleClientSecret = '',
    [string]$GitHubClientId = '',
    [string]$GitHubClientSecret = ''
)

$ErrorActionPreference = 'Stop'
$apiBaseUrl = "https://$ApiAppName.azurewebsites.net"

Write-Host "Configuring Azure App Service settings for $ApiAppName..." -ForegroundColor Cyan

az webapp config appsettings set `
  --resource-group $ResourceGroup `
  --name $ApiAppName `
  --settings `
    NODE_ENV=production `
    PORT=8080 `
    MONGODB_URI="$MongoDbUri" `
    JWT_SECRET="$JwtSecret" `
    JWT_ACCESS_EXPIRY="$JwtAccessExpiry" `
    JWT_REFRESH_EXPIRY="$JwtRefreshExpiry" `
    CLIENT_URL="$ClientUrl" `
    CORS_ORIGIN="$ClientUrl" `
    BCRYPT_ROUNDS="$BcryptRounds" `
    RATE_LIMIT_TTL="$RateLimitTtl" `
    RATE_LIMIT_MAX="$RateLimitMax" `
    GOOGLE_CLIENT_ID="$GoogleClientId" `
    GOOGLE_CLIENT_SECRET="$GoogleClientSecret" `
    GOOGLE_CALLBACK_URL="$apiBaseUrl/api/auth/google/callback" `
    GITHUB_CLIENT_ID="$GitHubClientId" `
    GITHUB_CLIENT_SECRET="$GitHubClientSecret" `
    GITHUB_CALLBACK_URL="$apiBaseUrl/api/auth/github/callback" | Out-Null

Write-Host "Done." -ForegroundColor Green
Write-Host "API Base URL: $apiBaseUrl" -ForegroundColor Yellow
Write-Host "Client URL: $ClientUrl" -ForegroundColor Yellow

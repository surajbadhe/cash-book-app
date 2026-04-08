param(
  [string]$EnvFilePath = ".env",
  [string]$OutputDir = ".azure"
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
$StaticWebAppName = if ($env:AZURE_STATIC_WEB_APP_NAME) { $env:AZURE_STATIC_WEB_APP_NAME } else { 'cashbookweb-akash-2026' }
$ApiBaseUrl = if ($env:AZURE_API_BASE_URL) { $env:AZURE_API_BASE_URL } else { "https://$ApiAppName.azurewebsites.net" }

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$publishProfilePath = Join-Path $OutputDir "api-publish-profile.xml"

Write-Host "`n==== Fetching API publish profile ====" -ForegroundColor Cyan
$publishProfile = az webapp deployment list-publishing-profiles `
  --resource-group $ResourceGroup `
  --name $ApiAppName `
  --xml
if ($LASTEXITCODE -ne 0) { Write-Host "[FAILED] Could not fetch publish profile" -ForegroundColor Red; exit 1 }
[System.IO.File]::WriteAllText((Resolve-Path $OutputDir).Path + "\api-publish-profile.xml", $publishProfile)
Write-Host "Saved to $publishProfilePath" -ForegroundColor Green

Write-Host "`n==== Fetching Static Web App token ====" -ForegroundColor Cyan
$staticToken = az staticwebapp secrets list `
  --resource-group $ResourceGroup `
  --name $StaticWebAppName `
  --query properties.apiKey `
  -o tsv
if ($LASTEXITCODE -ne 0) { Write-Host "[FAILED] Could not fetch static web app token" -ForegroundColor Red; exit 1 }

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " ADD THESE 4 SECRETS TO GITHUB" -ForegroundColor Green
Write-Host " Repo: Settings -> Secrets and variables -> Actions -> New" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  AZURE_API_APP_NAME" -ForegroundColor Yellow
Write-Host "  $ApiAppName"
Write-Host ""
Write-Host "  AZURE_API_BASE_URL" -ForegroundColor Yellow
Write-Host "  $ApiBaseUrl"
Write-Host ""
Write-Host "  AZURE_API_PUBLISH_PROFILE" -ForegroundColor Yellow
Write-Host "  (paste full contents of $publishProfilePath)"
Write-Host ""
Write-Host "  AZURE_STATIC_WEB_APPS_API_TOKEN" -ForegroundColor Yellow
Write-Host "  $staticToken"
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green

# If GitHub CLI is installed, offer to set secrets automatically
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "`nGitHub CLI detected. Setting secrets automatically..." -ForegroundColor Cyan
    gh secret set AZURE_API_APP_NAME --body $ApiAppName
    gh secret set AZURE_API_BASE_URL --body $ApiBaseUrl
    gh secret set AZURE_API_PUBLISH_PROFILE --body (Get-Content $publishProfilePath -Raw)
    gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --body $staticToken
    Write-Host "All secrets set via GitHub CLI!" -ForegroundColor Green
} else {
    Write-Host "Tip: Install GitHub CLI (gh) to set secrets automatically next time." -ForegroundColor DarkGray
}
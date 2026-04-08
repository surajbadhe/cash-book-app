# =============================================================
# No edits needed ? values match bootstrap.ps1
# =============================================================
$ResourceGroup     = "rg-cash-book-dev"
$ApiAppName        = "cashbookapi-akash-2026"
$StaticWebAppName  = "cashbookweb-akash-2026"
$OutputDir         = ".azure"
# =============================================================

$ErrorActionPreference = "Stop"
$ApiBaseUrl = "https://$ApiAppName.azurewebsites.net"

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
    gh secret set AZURE_API_PUBLISH_PROFILE < $publishProfilePath
    gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --body $staticToken
    Write-Host "All secrets set via GitHub CLI!" -ForegroundColor Green
} else {
    Write-Host "Tip: Install GitHub CLI (gh) to set secrets automatically next time." -ForegroundColor DarkGray
}
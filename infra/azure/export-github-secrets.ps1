param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory = $true)]
    [string]$ApiAppName,

    [Parameter(Mandatory = $true)]
    [string]$StaticWebAppName,

    [string]$OutputDir = '.azure'
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$publishProfilePath = Join-Path $OutputDir 'api-publish-profile.xml'
$apiBaseUrl = "https://$ApiAppName.azurewebsites.net"
$publishProfile = az webapp deployment list-publishing-profiles `
  --resource-group $ResourceGroup `
  --name $ApiAppName `
  --xml

$publishProfile | Out-File -FilePath $publishProfilePath -Encoding utf8

$staticWebAppToken = az staticwebapp secrets list `
  --resource-group $ResourceGroup `
  --name $StaticWebAppName `
  --query properties.apiKey `
  --output tsv

Write-Host "GitHub Secrets to create:" -ForegroundColor Cyan
Write-Host "AZURE_API_APP_NAME=$ApiAppName"
Write-Host "AZURE_API_BASE_URL=$apiBaseUrl"
Write-Host "AZURE_API_PUBLISH_PROFILE=<contents of $publishProfilePath>"
Write-Host "AZURE_STATIC_WEB_APPS_API_TOKEN=$staticWebAppToken"
Write-Host ""
Write-Host "If GitHub CLI is installed, run:" -ForegroundColor Yellow
Write-Host "gh secret set AZURE_API_APP_NAME --body '$ApiAppName'"
Write-Host "gh secret set AZURE_API_BASE_URL --body '$apiBaseUrl'"
Write-Host "gh secret set AZURE_API_PUBLISH_PROFILE < '$publishProfilePath'"
Write-Host "gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --body '$staticWebAppToken'"

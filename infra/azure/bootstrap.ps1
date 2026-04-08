param(
  [string]$ResourceGroupLocation = "centralindia",
  [string]$AppServiceLocation = "centralindia",
  [string]$StaticWebAppLocation = "eastasia",
  [string]$ResourceGroup = "rg-cash-book-dev",
  [string]$StaticWebAppName = "cash-book-web-dev",
  [string]$ApiAppName = "cash-book-api-dev",
  [string]$AppServicePlan = "asp-cash-book-dev",
  [string]$Sku = "B1",
  [string]$StaticWebAppSku = "Free",
  [string]$Runtime = "NODE:20-lts"
)

$ErrorActionPreference = 'Stop'

Write-Host "Creating resource group..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $ResourceGroupLocation | Out-Null

Write-Host "Creating App Service plan..." -ForegroundColor Cyan
az appservice plan create `
  --name $AppServicePlan `
  --resource-group $ResourceGroup `
  --location $AppServiceLocation `
  --sku $Sku `
  --is-linux | Out-Null

Write-Host "Creating API Web App..." -ForegroundColor Cyan
az webapp create `
  --name $ApiAppName `
  --resource-group $ResourceGroup `
  --plan $AppServicePlan `
  --runtime $Runtime | Out-Null

Write-Host "Setting startup command..." -ForegroundColor Cyan
az webapp config set `
  --name $ApiAppName `
  --resource-group $ResourceGroup `
  --startup-file "node dist/main.js" | Out-Null

Write-Host "Creating Static Web App..." -ForegroundColor Cyan
az staticwebapp create `
  --name $StaticWebAppName `
  --resource-group $ResourceGroup `
  --location $StaticWebAppLocation `
  --sku $StaticWebAppSku | Out-Null

$staticWebAppHost = az staticwebapp show `
  --name $StaticWebAppName `
  --resource-group $ResourceGroup `
  --query defaultHostname `
  --output tsv

Write-Host "\nAzure resources created." -ForegroundColor Green
Write-Host "API URL: https://$ApiAppName.azurewebsites.net" -ForegroundColor Yellow
Write-Host "Web URL: https://$staticWebAppHost" -ForegroundColor Yellow
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Set app settings on the API Web App from infra/azure/appsettings.example.txt" -ForegroundColor Yellow
Write-Host "2. Add GitHub secrets used by .github/workflows/*" -ForegroundColor Yellow
Write-Host "3. Re-run the two GitHub Actions workflows" -ForegroundColor Yellow

param(
  [string]$ResourceGroup        = "rg-cash-book-dev",
  [string]$ResourceGroupLocation = "centralindia",
  [string]$AppServicePlan       = "asp-cash-book-dev",
  [string]$AppServiceLocation   = "centralindia",
  [string]$AppServiceSku        = "B1",
  [string]$ApiAppName           = "cashbookapi-akash-2026",
  [string]$StaticWebAppName     = "cashbookweb-akash-2026",
  [string]$StaticWebAppLocation = "eastasia",
  [string]$StaticWebAppSku      = "Free",
  [string]$Runtime              = "NODE:20-lts"
)

$ErrorActionPreference = "Stop"

Write-Host "`n==== STEP 0: Verifying Azure login ====" -ForegroundColor Cyan
$sub = az account show --query name -o tsv 2>&1
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($sub)) {
    Write-Host "ERROR: Not logged in. Run: az login" -ForegroundColor Red; exit 1
}
Write-Host "Logged in. Subscription: $sub" -ForegroundColor Green

Write-Host "`n==== STEP 1: Resource group [$ResourceGroup in $ResourceGroupLocation] ====" -ForegroundColor Cyan
az group create --name $ResourceGroup --location $ResourceGroupLocation -o table
if ($LASTEXITCODE -ne 0) { Write-Host "[FAILED] Step 1" -ForegroundColor Red; exit 1 }

Write-Host "`n==== STEP 2: App Service plan [$AppServicePlan] ====" -ForegroundColor Cyan
az appservice plan create --name $AppServicePlan --resource-group $ResourceGroup --location $AppServiceLocation --sku $AppServiceSku --is-linux -o table
if ($LASTEXITCODE -ne 0) { Write-Host "[FAILED] Step 2 - plan name may already exist, try a different name" -ForegroundColor Red; exit 1 }

Write-Host "`n==== STEP 3: API Web App [$ApiAppName] ====" -ForegroundColor Cyan
az webapp create --name $ApiAppName --resource-group $ResourceGroup --plan $AppServicePlan --runtime $Runtime -o table
if ($LASTEXITCODE -ne 0) { Write-Host "[FAILED] Step 3 - app name must be globally unique on Azure" -ForegroundColor Red; exit 1 }

Write-Host "`n==== STEP 4: Set API startup command ====" -ForegroundColor Cyan
az webapp config set --name $ApiAppName --resource-group $ResourceGroup --startup-file "node dist/main.js" -o none
if ($LASTEXITCODE -ne 0) { Write-Host "[FAILED] Step 4" -ForegroundColor Red; exit 1 }
Write-Host "Done." -ForegroundColor Green

Write-Host "`n==== STEP 5: Static Web App [$StaticWebAppName in $StaticWebAppLocation] ====" -ForegroundColor Cyan
az staticwebapp create --name $StaticWebAppName --resource-group $ResourceGroup --location $StaticWebAppLocation --sku $StaticWebAppSku -o table
if ($LASTEXITCODE -ne 0) { Write-Host "[FAILED] Step 5 - name must be globally unique. Supported: westus2 centralus eastus2 westeurope eastasia" -ForegroundColor Red; exit 1 }

Write-Host "`n==== STEP 6: Getting Static Web App URL ====" -ForegroundColor Cyan
$webHost = az staticwebapp show --name $StaticWebAppName --resource-group $ResourceGroup --query defaultHostname -o tsv

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " ALL RESOURCES CREATED SUCCESSFULLY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host " API URL : https://$ApiAppName.azurewebsites.net" -ForegroundColor Yellow
Write-Host " Web URL : https://$webHost" -ForegroundColor Yellow
Write-Host "============================================================`n" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit infra\azure\configure-api-settings.cmd and set:"
Write-Host "       CLIENT_URL  = https://$webHost"
Write-Host "       MONGODB_URI = your Atlas connection string"
Write-Host "       JWT_SECRET  = a long random string"
Write-Host "  2. Run: infra\azure\configure-api-settings.cmd"
Write-Host "  3. Run: infra\azure\export-github-secrets.cmd"
Write-Host "  4. Add the printed secrets to GitHub repo Settings -> Secrets"
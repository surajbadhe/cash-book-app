param(
    [string]$ResourceGroup = "rg-cash-book-dev",
    [string]$StaticWebAppName = "",
    [string]$ApiAppName = "",
    [string]$AppServicePlan = "",
    [switch]$DeleteResourceGroup
)

$ErrorActionPreference = 'Stop'

if ($DeleteResourceGroup) {
    Write-Host "Deleting resource group $ResourceGroup ..." -ForegroundColor Yellow
    az group delete --name $ResourceGroup --yes --no-wait
    Write-Host "Delete request submitted for resource group $ResourceGroup." -ForegroundColor Green
    exit 0
}

if ($StaticWebAppName) {
    Write-Host "Deleting Static Web App $StaticWebAppName ..." -ForegroundColor Yellow
    az staticwebapp delete --name $StaticWebAppName --resource-group $ResourceGroup --yes
}

if ($ApiAppName) {
    Write-Host "Deleting App Service $ApiAppName ..." -ForegroundColor Yellow
    az webapp delete --name $ApiAppName --resource-group $ResourceGroup
}

if ($AppServicePlan) {
    Write-Host "Deleting App Service plan $AppServicePlan ..." -ForegroundColor Yellow
    az appservice plan delete --name $AppServicePlan --resource-group $ResourceGroup --yes
}

Write-Host "Cleanup completed." -ForegroundColor Green

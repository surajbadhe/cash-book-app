@echo off
setlocal

set RESOURCE_GROUP=rg-cash-book-dev
set STATIC_WEB_APP_NAME=cashbookweb-akash-2026
set API_APP_NAME=cashbookapi-akash-2026
set APP_SERVICE_PLAN=asp-cash-book-dev

if /I "%1"=="group" (
  echo Deleting resource group %RESOURCE_GROUP% ...
  az group delete --name "%RESOURCE_GROUP%" --yes --no-wait
  exit /b %errorlevel%
)

echo Deleting Static Web App...
az staticwebapp delete --name "%STATIC_WEB_APP_NAME%" --resource-group "%RESOURCE_GROUP%" --yes

echo Deleting API Web App...
az webapp delete --name "%API_APP_NAME%" --resource-group "%RESOURCE_GROUP%"

echo Deleting App Service plan...
az appservice plan delete --name "%APP_SERVICE_PLAN%" --resource-group "%RESOURCE_GROUP%" --yes

echo Cleanup completed.
endlocal

@echo off
setlocal enabledelayedexpansion

:: =============================================================
:: EDIT THESE VALUES — app names must be globally unique on Azure
:: =============================================================
set RESOURCE_GROUP=rg-cash-book-dev
set RESOURCE_GROUP_LOCATION=centralindia
set APP_SERVICE_PLAN=asp-cash-book-dev
set APP_SERVICE_LOCATION=centralindia
set APP_SERVICE_SKU=B1
set API_APP_NAME=cashbookapi-akash-2026
set STATIC_WEB_APP_NAME=cashbookweb-akash-2026
set STATIC_WEB_APP_LOCATION=eastasia
set STATIC_WEB_APP_SKU=Free
set RUNTIME=NODE:20-lts
:: =============================================================

echo.
echo ==== STEP 0: Verifying Azure login ====
for /f "delims=" %%i in ('az account show --query name -o tsv 2^>^&1') do set SUBSCRIPTION=%%i
if "!SUBSCRIPTION!"=="" ( echo ERROR: Not logged in. Run: az login & exit /b 1 )
echo Logged in. Subscription: !SUBSCRIPTION!

echo.
echo ==== STEP 1: Resource group [%RESOURCE_GROUP% in %RESOURCE_GROUP_LOCATION%] ====
az group create --name "%RESOURCE_GROUP%" --location "%RESOURCE_GROUP_LOCATION%" -o table || ( echo [FAILED] Step 1 & exit /b 1 )

echo.
echo ==== STEP 2: App Service plan [%APP_SERVICE_PLAN%] ====
az appservice plan create --name "%APP_SERVICE_PLAN%" --resource-group "%RESOURCE_GROUP%" --location "%APP_SERVICE_LOCATION%" --sku "%APP_SERVICE_SKU%" --is-linux -o table || ( echo [FAILED] Step 2 - try a different APP_SERVICE_PLAN name & exit /b 1 )

echo.
echo ==== STEP 3: API Web App [%API_APP_NAME%] ====
az webapp create --name "%API_APP_NAME%" --resource-group "%RESOURCE_GROUP%" --plan "%APP_SERVICE_PLAN%" --runtime "%RUNTIME%" -o table || ( echo [FAILED] Step 3 - API_APP_NAME must be globally unique & exit /b 1 )

echo.
echo ==== STEP 4: Set API startup command ====
az webapp config set --name "%API_APP_NAME%" --resource-group "%RESOURCE_GROUP%" --startup-file "node dist/main.js" -o none || ( echo [FAILED] Step 4 & exit /b 1 )

echo.
echo ==== STEP 5: Static Web App [%STATIC_WEB_APP_NAME% in %STATIC_WEB_APP_LOCATION%] ====
az staticwebapp create --name "%STATIC_WEB_APP_NAME%" --resource-group "%RESOURCE_GROUP%" --location "%STATIC_WEB_APP_LOCATION%" --sku "%STATIC_WEB_APP_SKU%" -o table || ( echo [FAILED] Step 5 - STATIC_WEB_APP_NAME must be globally unique & exit /b 1 )

echo.
echo ==== STEP 6: Getting Static Web App URL ====
for /f "delims=" %%i in ('az staticwebapp show --name "%STATIC_WEB_APP_NAME%" --resource-group "%RESOURCE_GROUP%" --query defaultHostname -o tsv') do set STATIC_WEB_APP_HOST=%%i

echo.
echo ============================================================
echo  ALL RESOURCES CREATED SUCCESSFULLY
echo ============================================================
echo  API URL : https://%API_APP_NAME%.azurewebsites.net
echo  Web URL : https://!STATIC_WEB_APP_HOST!
echo ============================================================
echo.
echo  Next - create/update .env ^(or copy infra\azure\.env.azure.example to .env^) and set:
echo    CLIENT_URL  = https://!STATIC_WEB_APP_HOST!
echo    MONGODB_URI = your Atlas connection string
echo    JWT_SECRET  = a long random string
echo.
echo  Then run: powershell -ExecutionPolicy Bypass -File infra\azure\configure-api-settings.ps1
echo  Then run: powershell -ExecutionPolicy Bypass -File infra\azure\export-github-secrets.ps1
echo ============================================================

endlocal
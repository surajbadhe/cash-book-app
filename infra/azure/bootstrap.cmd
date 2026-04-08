@echo off
setlocal enabledelayedexpansion

:: =============================================================
:: EDIT THESE VALUES — app names must be globally unique on Azure
:: Tip: add your initials / year to make them unique
:: e.g. cashbookapiab2026, cashbookwebab2026, asp-cashbook-ab26
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

:: Node runtime — list all with: az webapp list-runtimes --os linux
set RUNTIME=NODE:20-lts

:: =============================================================

echo.
echo ==== STEP 0: Verifying Azure login ====
for /f "delims=" %%i in ('az account show --query name -o tsv 2^>^&1') do set SUBSCRIPTION=%%i
if "!SUBSCRIPTION!"=="" (
  echo ERROR: Not logged in. Run: az login
  exit /b 1
)
echo Logged in. Subscription: !SUBSCRIPTION!

echo.
echo ==== STEP 1: Resource group [%RESOURCE_GROUP% in %RESOURCE_GROUP_LOCATION%] ====
az group create --name "%RESOURCE_GROUP%" --location "%RESOURCE_GROUP_LOCATION%" -o table
if %errorlevel% neq 0 goto :fail1

echo.
echo ==== STEP 2: App Service plan [%APP_SERVICE_PLAN%] ====
az appservice plan create ^
  --name "%APP_SERVICE_PLAN%" ^
  --resource-group "%RESOURCE_GROUP%" ^
  --location "%APP_SERVICE_LOCATION%" ^
  --sku "%APP_SERVICE_SKU%" ^
  --is-linux ^
  -o table
if %errorlevel% neq 0 goto :fail2

echo.
echo ==== STEP 3: API Web App [%API_APP_NAME%] ====
az webapp create ^
  --name "%API_APP_NAME%" ^
  --resource-group "%RESOURCE_GROUP%" ^
  --plan "%APP_SERVICE_PLAN%" ^
  --runtime "%RUNTIME%" ^
  -o table
if %errorlevel% neq 0 goto :fail3

echo.
echo ==== STEP 4: Set API startup command ====
az webapp config set ^
  --name "%API_APP_NAME%" ^
  --resource-group "%RESOURCE_GROUP%" ^
  --startup-file "node dist/main.js" ^
  -o none
if %errorlevel% neq 0 goto :fail4

echo.
echo ==== STEP 5: Static Web App [%STATIC_WEB_APP_NAME% in %STATIC_WEB_APP_LOCATION%] ====
az staticwebapp create ^
  --name "%STATIC_WEB_APP_NAME%" ^
  --resource-group "%RESOURCE_GROUP%" ^
  --location "%STATIC_WEB_APP_LOCATION%" ^
  --sku "%STATIC_WEB_APP_SKU%" ^
  -o table
if %errorlevel% neq 0 goto :fail5

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
echo  Next step - edit configure-api-settings.cmd and set:
echo    CLIENT_URL  = https://!STATIC_WEB_APP_HOST!
echo    MONGODB_URI = your Atlas connection string
echo    JWT_SECRET  = a long random string
echo.
echo  Then run: infra\azure\configure-api-settings.cmd
echo  Then run: infra\azure\export-github-secrets.cmd
echo ============================================================
goto :end

:fail1
echo.
echo [FAILED] Step 1 - Resource group creation failed.
exit /b 1

:fail2
echo.
echo [FAILED] Step 2 - App Service plan creation failed.
echo TIP: The plan name may already exist in Azure. Try changing APP_SERVICE_PLAN to a unique name.
exit /b 1

:fail3
echo.
echo [FAILED] Step 3 - API Web App creation failed.
echo TIP: App names must be globally unique across all Azure. Change API_APP_NAME.
echo TIP: Check runtime format with: az webapp list-runtimes --os linux
exit /b 1

:fail4
echo.
echo [FAILED] Step 4 - Setting startup command failed.
exit /b 1

:fail5
echo.
echo [FAILED] Step 5 - Static Web App creation failed.
echo TIP: Name must be globally unique. Change STATIC_WEB_APP_NAME.
echo TIP: Supported locations: westus2, centralus, eastus2, westeurope, eastasia
exit /b 1

:end
endlocal


echo.
echo ==== STEP 0: Verifying Azure login ====
for /f "delims=" %%i in ('az account show --query name -o tsv 2^>^&1') do set SUBSCRIPTION=%%i
if "%SUBSCRIPTION%"=="" (
  echo ERROR: Not logged in. Run: az login
  exit /b 1
)
echo Logged in. Subscription: %SUBSCRIPTION%

echo.
echo ==== STEP 1: Resource group (%RESOURCE_GROUP% in %RESOURCE_GROUP_LOCATION%) ====
az group create --name "%RESOURCE_GROUP%" --location "%RESOURCE_GROUP_LOCATION%" -o table
if %errorlevel% neq 0 ( echo FAILED step 1 & exit /b 1 )

echo.
echo ==== STEP 2: App Service plan (%APP_SERVICE_PLAN%) ====
az appservice plan create --name "%APP_SERVICE_PLAN%" --resource-group "%RESOURCE_GROUP%" --location "%APP_SERVICE_LOCATION%" --sku "%APP_SERVICE_SKU%" --is-linux -o table
if %errorlevel% neq 0 ( echo FAILED step 2 - plan name may already exist, try a different name & exit /b 1 )

echo.
echo ==== STEP 3: API Web App (%API_APP_NAME%) ====
az webapp create --name "%API_APP_NAME%" --resource-group "%RESOURCE_GROUP%" --plan "%APP_SERVICE_PLAN%" --runtime "%RUNTIME%" -o table
if %errorlevel% neq 0 ( echo FAILED step 3 - app name must be globally unique on Azure & exit /b 1 )

echo.
echo ==== STEP 4: Set API startup command ====
az webapp config set --name "%API_APP_NAME%" --resource-group "%RESOURCE_GROUP%" --startup-file "node dist/main.js" -o none
if %errorlevel% neq 0 ( echo FAILED step 4 & exit /b 1 )

echo.
echo ==== STEP 5: Static Web App (%STATIC_WEB_APP_NAME% in %STATIC_WEB_APP_LOCATION%) ====
az staticwebapp create --name "%STATIC_WEB_APP_NAME%" --resource-group "%RESOURCE_GROUP%" --location "%STATIC_WEB_APP_LOCATION%" --sku "%STATIC_WEB_APP_SKU%" -o table
if %errorlevel% neq 0 ( echo FAILED step 5 - web app name must be globally unique & exit /b 1 )

echo.
echo ==== STEP 6: Getting Static Web App URL ====
for /f "delims=" %%i in ('az staticwebapp show --name "%STATIC_WEB_APP_NAME%" --resource-group "%RESOURCE_GROUP%" --query defaultHostname -o tsv') do set STATIC_WEB_APP_HOST=%%i

echo.
echo ============================================================
echo  ALL RESOURCES CREATED SUCCESSFULLY
echo ============================================================
echo  API URL : https://%API_APP_NAME%.azurewebsites.net
echo  Web URL : https://%STATIC_WEB_APP_HOST%
echo ============================================================
echo.
echo  Next step — edit configure-api-settings.cmd and set:
echo    CLIENT_URL = https://%STATIC_WEB_APP_HOST%
echo    MONGODB_URI = your Atlas connection string
echo    JWT_SECRET  = a long random string
echo.
echo  Then run: configure-api-settings.cmd
echo  Then run: export-github-secrets.cmd
echo ============================================================

endlocal

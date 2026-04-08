@echo off
setlocal

set RESOURCE_GROUP=rg-cash-book-dev
set API_APP_NAME=cashbookapi-akash-2026
set STATIC_WEB_APP_NAME=cashbookweb-akash-2026
set OUTPUT_DIR=.azure

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

set API_BASE_URL=https://%API_APP_NAME%.azurewebsites.net
set PUBLISH_PROFILE_PATH=%OUTPUT_DIR%\api-publish-profile.xml

az webapp deployment list-publishing-profiles --resource-group "%RESOURCE_GROUP%" --name "%API_APP_NAME%" --xml > "%PUBLISH_PROFILE_PATH%"
for /f %%i in ('az staticwebapp secrets list --resource-group "%RESOURCE_GROUP%" --name "%STATIC_WEB_APP_NAME%" --query properties.apiKey -o tsv') do set STATIC_WEB_APP_TOKEN=%%i

echo GitHub Secrets to create:
echo AZURE_API_APP_NAME=%API_APP_NAME%
echo AZURE_API_BASE_URL=%API_BASE_URL%
echo AZURE_API_PUBLISH_PROFILE=^(contents of %PUBLISH_PROFILE_PATH%^)
echo AZURE_STATIC_WEB_APPS_API_TOKEN=%STATIC_WEB_APP_TOKEN%

endlocal

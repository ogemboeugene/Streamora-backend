@echo off
REM Streamora Deployment Setup Script for Windows
REM This script helps you set up the required GitHub secrets for deployment

echo 🚀 Streamora Deployment Setup
echo ===============================
echo.

REM Check if GitHub CLI is installed
gh --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ GitHub CLI is not installed. Please install it first:
    echo    https://cli.github.com/
    pause
    exit /b 1
)

REM Check if user is logged in to GitHub CLI
gh auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Please login to GitHub CLI first:
    echo    gh auth login
    pause
    exit /b 1
)

echo ✅ GitHub CLI is ready
echo.

echo 📝 Setting up Backend Secrets...
echo --------------------------------

echo Setting up: AZURE_BACKEND_APP_NAME
echo Description: Your Azure Web App name for the backend
set /p backend_app_name="Enter value for AZURE_BACKEND_APP_NAME: "
if not "%backend_app_name%"=="" (
    echo %backend_app_name% | gh secret set AZURE_BACKEND_APP_NAME
    echo ✅ Secret AZURE_BACKEND_APP_NAME has been set
) else (
    echo ⚠️  Skipping AZURE_BACKEND_APP_NAME (empty value)
)
echo.

echo Setting up: AZURE_BACKEND_PUBLISH_PROFILE
echo Description: Azure Web App publish profile XML content
echo NOTE: This is a large XML content. You can paste it here or set it manually in GitHub.
set /p backend_profile="Enter value for AZURE_BACKEND_PUBLISH_PROFILE (or press Enter to skip): "
if not "%backend_profile%"=="" (
    echo %backend_profile% | gh secret set AZURE_BACKEND_PUBLISH_PROFILE
    echo ✅ Secret AZURE_BACKEND_PUBLISH_PROFILE has been set
) else (
    echo ⚠️  Skipping AZURE_BACKEND_PUBLISH_PROFILE (set this manually in GitHub)
)
echo.

echo 📝 Setting up Frontend Secrets...
echo ---------------------------------

echo Setting up: AZURE_STATIC_WEB_APPS_API_TOKEN
echo Description: Azure Static Web Apps deployment token
set /p frontend_token="Enter value for AZURE_STATIC_WEB_APPS_API_TOKEN: "
if not "%frontend_token%"=="" (
    echo %frontend_token% | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN
    echo ✅ Secret AZURE_STATIC_WEB_APPS_API_TOKEN has been set
) else (
    echo ⚠️  Skipping AZURE_STATIC_WEB_APPS_API_TOKEN (empty value)
)
echo.

echo Setting up: REACT_APP_API_URL
echo Description: Backend API URL (e.g., https://your-app.azurewebsites.net)
set /p api_url="Enter value for REACT_APP_API_URL: "
if not "%api_url%"=="" (
    echo %api_url% | gh secret set REACT_APP_API_URL
    echo ✅ Secret REACT_APP_API_URL has been set
) else (
    echo ⚠️  Skipping REACT_APP_API_URL (empty value)
)
echo.

echo Setting up: REACT_APP_TMDB_API_KEY
echo Description: TMDB API key for movie data
set /p tmdb_key="Enter value for REACT_APP_TMDB_API_KEY: "
if not "%tmdb_key%"=="" (
    echo %tmdb_key% | gh secret set REACT_APP_TMDB_API_KEY
    echo ✅ Secret REACT_APP_TMDB_API_KEY has been set
) else (
    echo ⚠️  Skipping REACT_APP_TMDB_API_KEY (empty value)
)
echo.

echo 🎉 Setup Complete!
echo ==================
echo.
echo Next steps:
echo 1. Push your code to the main branch
echo 2. GitHub Actions will automatically deploy when you push changes to:
echo    - server/ folder → Backend deployment
echo    - client/ folder → Frontend deployment
echo.
echo 3. Monitor deployments in the Actions tab of your GitHub repository
echo.
echo For detailed instructions, see DEPLOYMENT.md
echo.
pause

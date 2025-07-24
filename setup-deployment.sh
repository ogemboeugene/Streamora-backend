#!/bin/bash

# Streamora Deployment Setup Script
# This script helps you set up the required GitHub secrets for deployment

echo "🚀 Streamora Deployment Setup"
echo "==============================="
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI is not installed. Please install it first:"
    echo "   https://cli.github.com/"
    exit 1
fi

# Check if user is logged in to GitHub CLI
if ! gh auth status &> /dev/null; then
    echo "❌ Please login to GitHub CLI first:"
    echo "   gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is ready"
echo ""

# Function to set a secret
set_secret() {
    local name=$1
    local description=$2
    
    echo "Setting up: $name"
    echo "Description: $description"
    read -s -p "Enter value for $name: " value
    echo ""
    
    if [ -n "$value" ]; then
        gh secret set "$name" -b "$value"
        echo "✅ Secret $name has been set"
    else
        echo "⚠️  Skipping $name (empty value)"
    fi
    echo ""
}

echo "📝 Setting up Backend Secrets..."
echo "--------------------------------"

set_secret "AZURE_BACKEND_APP_NAME" "Your Azure Web App name for the backend"
set_secret "AZURE_BACKEND_PUBLISH_PROFILE" "Azure Web App publish profile XML content"

echo ""
echo "📝 Setting up Frontend Secrets..."
echo "---------------------------------"

set_secret "AZURE_STATIC_WEB_APPS_API_TOKEN" "Azure Static Web Apps deployment token"
set_secret "REACT_APP_API_URL" "Backend API URL (e.g., https://your-app.azurewebsites.net)"
set_secret "REACT_APP_TMDB_API_KEY" "TMDB API key for movie data"

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Push your code to the main branch"
echo "2. GitHub Actions will automatically deploy when you push changes to:"
echo "   - server/ folder → Backend deployment"
echo "   - client/ folder → Frontend deployment"
echo ""
echo "3. Monitor deployments in the Actions tab of your GitHub repository"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"

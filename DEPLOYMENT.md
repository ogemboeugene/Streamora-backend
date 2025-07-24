# Streamora Deployment Guide

This guide explains how to deploy the Streamora application with separate frontend and backend deployments.

## Project Structure

```
Streamora/
├── .github/workflows/     # GitHub Actions workflows
│   ├── ci.yml            # Continuous Integration
│   ├── deploy-backend.yml # Backend deployment
│   └── deploy-frontend.yml # Frontend deployment
├── client/               # React frontend
└── server/               # Node.js backend
```

## Deployment Strategy

### Backend (Node.js/Express)
- **Platform**: Azure Web App
- **Trigger**: Changes to `server/` folder
- **Build**: Production-optimized Node.js build
- **Tests**: Run before deployment

### Frontend (React)
- **Platform**: Azure Static Web Apps
- **Trigger**: Changes to `client/` folder
- **Build**: Optimized React production build
- **Tests**: Run before deployment

## Required GitHub Secrets

### Backend Secrets
```
AZURE_BACKEND_APP_NAME=your-backend-app-name
AZURE_BACKEND_PUBLISH_PROFILE=<Azure Web App publish profile XML>
```

### Frontend Secrets
```
AZURE_STATIC_WEB_APPS_API_TOKEN=<Azure Static Web Apps deployment token>
REACT_APP_API_URL=https://your-backend-app-name.azurewebsites.net
REACT_APP_TMDB_API_KEY=<Your TMDB API key>
```

## Setup Instructions

### 1. Azure Backend Setup (Web App)

1. Create an Azure Web App:
   ```bash
   az webapp create --resource-group myResourceGroup --plan myAppServicePlan --name streamora-backend --runtime "NODE|18-lts"
   ```

2. Get the publish profile:
   ```bash
   az webapp deployment list-publishing-profiles --name streamora-backend --resource-group myResourceGroup --xml
   ```

3. Add the publish profile to GitHub Secrets as `AZURE_BACKEND_PUBLISH_PROFILE`

### 2. Azure Frontend Setup (Static Web Apps)

1. Create an Azure Static Web App:
   ```bash
   az staticwebapp create --name streamora-frontend --resource-group myResourceGroup --source https://github.com/your-username/streamora --branch main --app-location "/client" --output-location "build"
   ```

2. Get the deployment token:
   ```bash
   az staticwebapp secrets list --name streamora-frontend --query "properties.apiKey"
   ```

3. Add the token to GitHub Secrets as `AZURE_STATIC_WEB_APPS_API_TOKEN`

### 3. Environment Configuration

#### Backend Environment Variables (Azure Web App)
Set these in Azure Portal > Configuration > Application Settings:
```
NODE_ENV=production
PORT=8080
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>
TMDB_API_KEY=<your-tmdb-api-key>
CORS_ORIGIN=https://your-frontend-url.azurestaticapps.net
```

#### Frontend Environment Variables
Set these in GitHub Secrets:
```
REACT_APP_API_URL=https://streamora-backend.azurewebsites.net
REACT_APP_TMDB_API_KEY=<your-tmdb-api-key>
```

## Workflow Features

### Intelligent Deployment
- **Path-based triggers**: Only deploys when relevant files change
- **Branch protection**: Only deploys from main/master branch
- **Test-first**: Runs tests before deployment

### Security Features
- **Vulnerability scanning**: Trivy security scanner
- **Dependency caching**: Faster builds with npm cache
- **Production optimization**: Minified builds and production dependencies only

### Monitoring
- **Deployment status**: Success/failure notifications
- **Test coverage**: Coverage reports for frontend
- **Build artifacts**: Preserved for debugging

## Manual Deployment Commands

### Backend
```bash
cd server
npm ci --only=production
# Deploy to Azure Web App
```

### Frontend
```bash
cd client
npm ci
npm run build
# Deploy to Azure Static Web Apps
```

## Troubleshooting

### Common Issues

1. **Backend deployment fails**:
   - Check Node.js version compatibility (18.x)
   - Verify MongoDB connection string
   - Check Azure Web App logs

2. **Frontend deployment fails**:
   - Verify React build succeeds locally
   - Check environment variables
   - Ensure API URL is correct

3. **CORS issues**:
   - Update `CORS_ORIGIN` in backend to match frontend URL
   - Check Azure Static Web Apps custom domain if used

### Debug Commands
```bash
# Check backend locally
cd server && npm start

# Check frontend locally
cd client && npm start

# Test backend API
curl https://your-backend-app.azurewebsites.net/api/health

# Check deployment logs
az webapp log tail --name streamora-backend --resource-group myResourceGroup
```

## Performance Optimization

### Backend
- Production dependencies only
- Compression middleware enabled
- Caching strategies implemented

### Frontend
- Code splitting with React.lazy()
- Image optimization
- Bundle analysis available with `npm run analyze`

## Security Considerations

- Secrets stored in GitHub Secrets (never in code)
- Environment-specific configurations
- Regular security scanning with Trivy
- CORS properly configured
- JWT token security

# MongoDB Setup for Streamora

## Option 1: Local MongoDB Installation (Recommended for Development)

### Windows:
1. **Download MongoDB Community Server**
   - Visit: https://www.mongodb.com/try/download/community
   - Download and install MongoDB Community Server
   - The installer will set up MongoDB as a Windows service

2. **Start MongoDB**
   - MongoDB should start automatically as a service
   - If not, run: `net start MongoDB`

3. **Verify Connection**
   - MongoDB will be available at: `mongodb://localhost:27017`

### Alternative: MongoDB Compass (GUI)
- Download MongoDB Compass for a visual interface
- Connect to: `mongodb://localhost:27017`

## Option 2: MongoDB Atlas (Cloud - Free Tier)

1. **Create Account**
   - Visit: https://www.mongodb.com/atlas
   - Sign up for free account

2. **Create Cluster**
   - Choose "Build a Database" → "Shared" (Free)
   - Select AWS/Google Cloud/Azure
   - Choose region closest to you
   - Click "Create Cluster"

3. **Setup Access**
   - Create database user (username/password)
   - Add IP address (or 0.0.0.0/0 for development)

4. **Get Connection String**
   - Click "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your password

5. **Update Environment**
   ```bash
   # In server/.env.local
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/streamora_dev
   ```

## Option 3: Docker (Quick Setup)

```bash
# Run MongoDB in Docker
docker run -d --name mongodb -p 27017:27017 mongo:latest

# Stop when done
docker stop mongodb
```

## Current Status

Your server is configured to continue running even without MongoDB connection, so you can:

1. **Test the frontend** - React app should work without database
2. **Setup MongoDB later** - Add connection when ready
3. **Use mock data** - Frontend has sample data for development

## Environment Configuration

Update your `server/.env.local`:

```bash
# For local MongoDB
MONGODB_URI=mongodb://localhost:27017/streamora_dev

# For MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/streamora_dev
```

## Verification

Once MongoDB is running, you should see:
```
✅ Connected to MongoDB
```

Instead of:
```
❌ MongoDB connection error: ...
```

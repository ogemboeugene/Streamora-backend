# Streamora Development Setup

## Quick Start Guide

### Prerequisites
- Node.js 18+ installed
- MongoDB running locally or MongoDB Atlas connection
- Environment variables configured

### Installation & Setup

1. **Clone and navigate to the project:**
   ```bash
   cd Streamora
   ```

2. **Install server dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies:**
   ```bash
   cd ../client
   npm install
   ```

4. **Environment Setup:**
   - Copy `.env.example` to `.env` in both server and client directories
   - Configure your environment variables (MongoDB, API keys, etc.)

### Development Commands

**Server (Backend):**
```bash
cd server
npm run dev        # Start development server with nodemon
npm start          # Start production server
npm run test       # Run tests
```

**Client (Frontend):**
```bash
cd client
npm start          # Start React development server
npm run build      # Build for production
npm run test       # Run tests
```

**Run Both Simultaneously:**
```bash
# In server directory
npm run dev

# In another terminal, client directory
npm start
```

### Default Ports
- Backend: http://localhost:5000
- Frontend: http://localhost:3000

### Features Implemented

✅ **Backend (Node.js/Express):**
- User authentication (JWT + Google OAuth)
- Movie/TV/Radio content management
- Search functionality with multiple APIs
- Admin panel endpoints
- Analytics and reporting
- Rate limiting and security
- Error handling middleware

✅ **Frontend (React):**
- Responsive design with Tailwind CSS
- Dark/Light theme support
- User authentication UI
- Movie/content browsing
- Cookie consent management
- SEO optimization
- Login reminders for anonymous users
- Error boundaries

✅ **Key Features:**
- Anonymous viewing with login prompts
- Personalized recommendations
- Watchlist management
- Cookie and cache management
- Admin dashboard
- Multi-API content fallback
- Accessibility features
- International support ready

### API Integrations
- TMDB (The Movie Database)
- YouTube Data API
- Open Movie Database
- Shoutcast/Icecast for radio

### Deployment Ready
- Environment-based configuration
- Production build scripts
- Dockerization ready
- Vercel (frontend) and Railway/Render (backend) compatible

### Troubleshooting

**Port conflicts:**
- Change ports in environment variables
- Server: `PORT=5001` in server/.env
- Client: `PORT=3001` in client/.env

**Missing dependencies:**
```bash
# Server
cd server && npm install

# Client  
cd client && npm install
```

**Database connection:**
- Ensure MongoDB is running
- Check MONGODB_URI in server/.env
- For local: `mongodb://localhost:27017/streamora`

### Production Deployment

**Backend (Railway/Render):**
1. Push to GitHub
2. Connect repository to hosting service
3. Set environment variables
4. Deploy from main branch

**Frontend (Vercel):**
1. Push to GitHub
2. Connect repository to Vercel
3. Set build command: `npm run build`
4. Set environment variables
5. Deploy

### Support
For issues or questions, check the README.md or create an issue in the repository.

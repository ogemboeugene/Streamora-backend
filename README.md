# Streamora - Free Streaming Platform

A modern, production-ready streaming website built with React and Node.js that aggregates free content from public APIs.

## 🚀 Features

- **Free Streaming**: Movies, TV shows, and live radio via public APIs
- **Mobile-First Design**: Responsive layout with dark/light mode
- **Smart Search**: Real-time suggestions and advanced filtering
- **User Accounts**: Optional JWT-based auth with Google OAuth
- **Custom Player**: Adaptive streaming with subtitle support
- **Admin Panel**: Simple CMS for content management
- **Analytics**: Traffic and usage monitoring
- **Accessibility**: ARIA labels and screen reader support
- **Internationalization**: Multi-language support

## 🛠️ Tech Stack

- **Frontend**: React 18, Tailwind CSS, React Router
- **Backend**: Node.js, Express.js, MongoDB
- **Authentication**: JWT, Google OAuth2
- **APIs**: TMDB, YouTube, Open Movie API, Shoutcast
- **Deployment**: Vercel (frontend), Railway (backend)

## 📁 Project Structure

```
STREAMORA/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   ├── utils/         # Helper functions
│   │   ├── contexts/      # React contexts
│   │   └── styles/        # Global styles
│   ├── package.json
│   └── tailwind.config.js
├── server/                # Node.js backend
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── services/         # External API services
│   ├── utils/            # Helper functions
│   ├── config/           # Configuration files
│   └── server.js
├── .env.example          # Environment variables template
└── docker-compose.yml    # Development setup
```

## 🔧 Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- API Keys (TMDB, YouTube, Google OAuth)

### 1. Clone and Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in your API keys:

```env
# API Keys
TMDB_API_KEY=your_tmdb_api_key
YOUTUBE_API_KEY=your_youtube_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Database
MONGODB_URI=mongodb://localhost:27017/streamora

# Auth
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 3. Get API Keys

#### TMDB API
1. Visit [TMDB](https://www.themoviedb.org/settings/api)
2. Create account and request API key
3. Add to `.env` as `TMDB_API_KEY`

#### YouTube Data API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project and enable YouTube Data API v3
3. Create API key and add to `.env` as `YOUTUBE_API_KEY`

#### Google OAuth (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add Client ID and Secret to `.env`

### 4. Run Development Servers

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm start
```

Visit `http://localhost:3000` to see the application.

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd client
npm run build
vercel --prod
```

### Backend (Railway)
```bash
cd server
# Connect Railway CLI and deploy
railway login
railway init
railway up
```

## 📊 API Integration

- **TMDB**: Movie/TV metadata, posters, trailers
- **YouTube**: Video streaming and trailers
- **Open Movie API**: Free public domain films
- **Shoutcast**: Live radio streams

## 🔒 Security Features

- JWT-based authentication
- HTTPS enforcement
- Environment variable protection
- CORS configuration
- Rate limiting
- Input validation

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This platform aggregates content from public APIs and free sources. Ensure compliance with local laws and API terms of service.

const express = require('express');
const Content = require('../models/Content');
const RadioStation = require('../models/RadioStation');
const tmdbService = require('../services/tmdbService');
const youtubeService = require('../services/youtubeService');
const radioBrowserService = require('../services/radioBrowserService');
const { optionalAuth } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Get homepage content
router.get('/homepage', optionalAuth, catchAsync(async (req, res) => {
  try {
    // Get trending content from TMDB with error handling
    let trendingData = { results: [] };
    let popularMovies = { results: [] };
    let popularTVShows = { results: [] };
    let topRatedMovies = { results: [] };

    try {
      trendingData = await tmdbService.getTrending('all', 'day', 1);
    } catch (error) {
      console.error('Homepage content error:', error);
    }

    try {
      popularMovies = await tmdbService.getPopularMovies(1);
    } catch (error) {
      console.error('Popular movies error:', error);
    }

    try {
      popularTVShows = await tmdbService.getPopularTVShows(1);
    } catch (error) {
      console.error('Popular TV shows error:', error);
    }

    try {
      topRatedMovies = await tmdbService.getTopRatedMovies(1);
    } catch (error) {
      console.error('Top rated movies error:', error);
    }

    // Get featured radio stations
    let featuredRadioStations = [];
    try {
      featuredRadioStations = await radioBrowserService.getFeaturedStations(10);
    } catch (error) {
      console.error('Radio stations error:', error);
      featuredRadioStations = [];
    }

    // Transform and structure the data
    const homepage = {
      hero: trendingData.results.slice(0, 5).map(item => ({
        id: item.id,
        title: item.title || item.name,
        overview: item.overview,
        backdrop: tmdbService.getImageURL(item.backdrop_path, 'w1280'),
        poster: tmdbService.getImageURL(item.poster_path),
        type: item.media_type || (item.title ? 'movie' : 'tv'),
        rating: item.vote_average,
        releaseDate: item.release_date || item.first_air_date
      })),
      
      sections: [
        {
          title: 'Trending Now',
          type: 'trending',
          items: trendingData.results.slice(0, 20).map(item => ({
            id: item.id,
            title: item.title || item.name,
            poster: tmdbService.getImageURL(item.poster_path),
            type: item.media_type || (item.title ? 'movie' : 'tv'),
            rating: item.vote_average,
            year: new Date(item.release_date || item.first_air_date).getFullYear()
          }))
        },
        
        {
          title: 'Popular Movies',
          type: 'movies',
          items: popularMovies.results.slice(0, 20).map(movie => ({
            id: movie.id,
            title: movie.title,
            poster: tmdbService.getImageURL(movie.poster_path),
            type: 'movie',
            rating: movie.vote_average,
            year: new Date(movie.release_date).getFullYear()
          }))
        },
        
        {
          title: 'Popular TV Shows',
          type: 'tv',
          items: popularTVShows.results.slice(0, 20).map(show => ({
            id: show.id,
            title: show.name,
            poster: tmdbService.getImageURL(show.poster_path),
            type: 'tv',
            rating: show.vote_average,
            year: new Date(show.first_air_date).getFullYear()
          }))
        },
        
        {
          title: 'Top Rated Movies',
          type: 'movies',
          items: topRatedMovies.results.slice(0, 20).map(movie => ({
            id: movie.id,
            title: movie.title,
            poster: tmdbService.getImageURL(movie.poster_path),
            type: 'movie',
            rating: movie.vote_average,
            year: new Date(movie.release_date).getFullYear()
          }))
        },
        
        {
          title: 'Live Radio',
          type: 'radio',
          items: featuredRadioStations
            .filter(station => station.url_resolved || station.url) // Filter out stations without stream URLs
            .map(station => ({
              id: station.stationuuid,
              title: station.name,
              poster: station.favicon && station.favicon !== '' && station.favicon !== null 
                ? `/api/content/radio/favicon/${station.stationuuid}` 
                : '/images/radio-placeholder.svg',
              streamUrl: station.url_resolved || station.url, // Include stream URL for frontend
              type: 'radio',
              genre: station.tags ? station.tags.slice(0, 3).join(', ') : station.genre,
              listeners: station.clickcount,
              country: station.country,
              countrycode: station.countrycode,
              codec: station.codec,
              bitrate: station.bitrate
            }))
        }
      ]
    };

    // Add personalized sections if user is logged in
    if (req.user) {
      // Get recommendations based on watch history
      const recentHistory = req.user.watchHistory.slice(0, 5);
      
      if (recentHistory.length > 0) {
        // This would be more sophisticated in a real app
        homepage.sections.unshift({
          title: 'Continue Watching',
          type: 'continue',
          items: recentHistory.map(item => ({
            id: item.contentId,
            title: item.title,
            poster: item.poster,
            type: item.contentType,
            progress: item.progress
          }))
        });
      }
    }

    res.json({
      success: true,
      data: homepage
    });

  } catch (error) {
    console.error('Homepage content error:', error);
    
    // Fallback to cached content or basic response
    res.json({
      success: true,
      data: {
        hero: [],
        sections: [
          {
            title: 'Service Temporarily Unavailable',
            type: 'error',
            items: []
          }
        ]
      },
      message: 'Some content may be temporarily unavailable'
    });
  }
}));

// Get genres (must come before /:type/:id)
router.get('/genres/:type', catchAsync(async (req, res) => {
  const { type } = req.params;

  if (!['movie', 'tv', 'radio'].includes(type)) {
    throw new AppError('Invalid type. Use movie or tv', 400);
  }

  try {
    const genres = type === 'movie' 
      ? await tmdbService.getMovieGenres()
      : await tmdbService.getTVGenres();

    res.json({
      success: true,
      data: genres.genres
    });

  } catch (error) {
    console.error(`Error fetching ${type} genres:`, error);
    throw new AppError(`Failed to fetch ${type} genres`, 500);
  }
}));

// Discover content with filters (must come before /:type/:id)
router.get('/discover/:type', optionalAuth, catchAsync(async (req, res) => {
  const { type } = req.params;
  const {
    page = 1,
    sortBy = 'popularity.desc',
    withGenres,
    year,
    voteAverageGte,
    voteAverageLte,
    withRuntimeGte,
    withRuntimeLte,
    includeAdult = false
  } = req.query;

  if (!['movie', 'tv', 'radio'].includes(type)) {
    throw new AppError('Invalid type. Use movie or tv', 400);
  }

  try {
    const filters = {
      page: parseInt(page),
      sortBy,
      includeAdult: includeAdult === 'true'
    };

    if (withGenres) filters.with_genres = withGenres;
    if (year) {
      if (type === 'movie') {
        filters.year = year;
      } else {
        filters.first_air_date_year = year;
      }
    }
    if (voteAverageGte) filters['vote_average.gte'] = parseFloat(voteAverageGte);
    if (voteAverageLte) filters['vote_average.lte'] = parseFloat(voteAverageLte);
    if (withRuntimeGte) filters['with_runtime.gte'] = parseInt(withRuntimeGte);
    if (withRuntimeLte) filters['with_runtime.lte'] = parseInt(withRuntimeLte);

    const results = type === 'movie' 
      ? await tmdbService.discoverMovies(filters)
      : await tmdbService.discoverTVShows(filters);

    // Transform the results
    const transformedResults = results.results.map(item => ({
      id: item.id,
      title: item.title || item.name,
      poster: tmdbService.getImageURL(item.poster_path),
      backdrop: tmdbService.getImageURL(item.backdrop_path, 'w1280'),
      type,
      rating: item.vote_average,
      year: new Date(item.release_date || item.first_air_date).getFullYear(),
      overview: item.overview,
      genres: item.genre_ids
    }));

    res.json({
      success: true,
      data: transformedResults,
      pagination: {
        currentPage: results.page,
        totalPages: results.total_pages,
        totalResults: results.total_results,
        limit: 20
      }
    });

  } catch (error) {
    console.error(`Error discovering ${type} content:`, error);
    throw new AppError(`Failed to discover ${type} content`, 500);
  }
}));

// Get content by category
router.get('/category/:category', optionalAuth, catchAsync(async (req, res) => {
  const { category } = req.params;
  const { page = 1, limit = 20, type } = req.query;

  let content = [];

  try {
    switch (category) {
      case 'trending':
        const trending = await tmdbService.getTrending('all', 'day', page);
        content = trending.results;
        break;

      case 'popular-movies':
        const popularMovies = await tmdbService.getPopularMovies(page);
        content = popularMovies.results;
        break;

      case 'popular-tv':
        const popularTV = await tmdbService.getPopularTVShows(page);
        content = popularTV.results;
        break;

      case 'top-rated-movies':
        const topMovies = await tmdbService.getTopRatedMovies(page);
        content = topMovies.results;
        break;

      case 'top-rated-tv':
        const topTV = await tmdbService.getTopRatedTVShows(page);
        content = topTV.results;
        break;

      case 'upcoming':
        const upcoming = await tmdbService.getUpcomingMovies(page);
        content = upcoming.results;
        break;

      case 'now-playing':
        const nowPlaying = await tmdbService.getNowPlayingMovies(page);
        content = nowPlaying.results;
        break;

      case 'radio':
        const { featured, country = 'KE', genre, search } = req.query;
        let radioStations = [];
        
        try {
          if (search) {
            radioStations = await radioBrowserService.searchStations(search, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
          } else if (genre) {
            radioStations = await radioBrowserService.getStationsByGenre(genre, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
          } else if (featured === 'true') {
            radioStations = await radioBrowserService.getPopularStations(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
          } else if (country) {
            radioStations = await radioBrowserService.getStationsByCountry(country, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
          } else {
            radioStations = await radioBrowserService.getAllStations(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
          }
        } catch (error) {
          console.error('Radio Browser API error:', error);
          
          // Handle rate limiting gracefully
          if (error.message && error.message.includes('429')) {
            return res.status(429).json({
              success: false,
              message: 'Too many requests. Please try again in a moment.',
              error: 'Too many requests from this IP, please try again later.'
            });
          }
          
          // For other errors, return empty array to prevent total failure
          radioStations = [];
        }
        
        return res.json({
          success: true,
          data: radioStations,
          pagination: {
            currentPage: parseInt(page),
            limit: parseInt(limit),
            hasMore: radioStations.length === parseInt(limit)
          }
        });

      default:
        throw new AppError('Invalid category', 400);
    }

    // Transform the content
    const transformedContent = content.map(item => ({
      id: item.id,
      title: item.title || item.name,
      poster: tmdbService.getImageURL(item.poster_path),
      backdrop: tmdbService.getImageURL(item.backdrop_path, 'w1280'),
      type: item.media_type || (category.includes('tv') ? 'tv' : 'movie'),
      rating: item.vote_average,
      year: new Date(item.release_date || item.first_air_date).getFullYear(),
      overview: item.overview
    }));

    res.json({
      success: true,
      data: transformedContent,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error(`Error fetching category ${category}:`, error);
    throw new AppError(`Failed to fetch ${category} content`, 500);
  }
}));

// Get content details
router.get('/:type/:id', optionalAuth, catchAsync(async (req, res) => {
  const { type, id } = req.params;

  if (!['movie', 'tv', 'radio'].includes(type)) {
    throw new AppError('Invalid content type', 400);
  }

  let content;

  try {
    if (type === 'radio') {
      // Get radio station from Radio Browser API
      content = await radioBrowserService.getStationByUuid(id);
      if (!content) {
        throw new AppError('Radio station not found', 404);
      }
      
      // Mark station as clicked for popularity tracking
      await radioBrowserService.clickStation(id);
    } else {
      // Check if we have it cached in our database
      content = await Content.findOne({ tmdbId: id, type });

      if (!content || content.needsUpdate()) {
        // Fetch from TMDB
        let tmdbData;
        if (type === 'movie') {
          tmdbData = await tmdbService.getMovieDetails(id);
          content = tmdbService.transformMovieData(tmdbData);
        } else {
          tmdbData = await tmdbService.getTVShowDetails(id);
          content = tmdbService.transformTVData(tmdbData);
        }

        // Try to find YouTube trailer if no TMDB trailers
        try {
          if (!content.trailers || content.trailers.length === 0) {
            const trailers = type === 'movie' 
              ? await youtubeService.searchMovieTrailer(content.title, content.year)
              : await youtubeService.searchTVTrailer(content.title);

            if (trailers.length > 0) {
              content.trailers = trailers.slice(0, 3).map(trailer => ({
                key: trailer.id.videoId,
                name: trailer.snippet.title,
                site: 'YouTube',
                type: 'Trailer',
                official: false,
                publishedAt: trailer.snippet.publishedAt
              }));
            }
          }
        } catch (error) {
          console.warn('YouTube trailer search failed:', error.message);
        }

        // Save/update in database using upsert to avoid duplicate key errors
        // Filter out problematic language fields that may cause MongoDB errors
        const sanitizedContent = { ...content };
        
        // Remove or sanitize language fields that may cause issues
        if (sanitizedContent.original_language === 'ja' || 
            sanitizedContent.original_language === 'zh' || 
            sanitizedContent.original_language === 'ko') {
          sanitizedContent.original_language = 'en'; // Default to English
        }
        
        // Remove any language override fields that might cause issues
        delete sanitizedContent.language;
        if (sanitizedContent.$language) delete sanitizedContent.$language;
        
        await Content.findOneAndUpdate(
          { tmdbId: id, type }, 
          sanitizedContent, 
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }

      // Increment view count
      if (content.incrementViews) {
        await content.incrementViews();
      }
    }

    // Add to user's watch history if logged in
    if (req.user && type !== 'radio') {
      await req.user.addToWatchHistory({
        contentId: id,
        contentType: type,
        title: content.title,
        poster: content.poster?.url
      });
    }

    res.json({
      success: true,
      data: content
    });

  } catch (error) {
    console.error(`Error fetching ${type} ${id}:`, error);
    throw new AppError(`Failed to fetch ${type} details`, 500);
  }
}));

// Radio-specific routes using Radio Browser API

// Get radio stations by country
router.get('/radio/country/:countryCode', optionalAuth, catchAsync(async (req, res) => {
  const { countryCode } = req.params;
  const { page = 1, limit = 20 } = req.query;
  
  try {
    const stations = await radioBrowserService.getStationsByCountry(
      countryCode.toUpperCase(), 
      parseInt(limit), 
      (parseInt(page) - 1) * parseInt(limit)
    );
    
    res.json({
      success: true,
      data: stations,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasMore: stations.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching radio stations by country:', error);
    throw new AppError('Failed to fetch radio stations', 500);
  }
}));

// Search radio stations
router.get('/radio/search', optionalAuth, catchAsync(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  
  if (!q) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }
  
  try {
    const stations = await radioBrowserService.searchStations(
      q, 
      parseInt(limit), 
      (parseInt(page) - 1) * parseInt(limit)
    );
    
    res.json({
      success: true,
      data: stations,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasMore: stations.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error searching radio stations:', error);
    throw new AppError('Failed to search radio stations', 500);
  }
}));

// Get radio stations by genre
router.get('/radio/genre/:genre', optionalAuth, catchAsync(async (req, res) => {
  const { genre } = req.params;
  const { page = 1, limit = 20 } = req.query;
  
  try {
    const stations = await radioBrowserService.getStationsByGenre(
      genre, 
      parseInt(limit), 
      (parseInt(page) - 1) * parseInt(limit)
    );
    
    res.json({
      success: true,
      data: stations,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasMore: stations.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching radio stations by genre:', error);
    throw new AppError('Failed to fetch radio stations', 500);
  }
}));

// Get popular radio stations
router.get('/radio/popular', optionalAuth, catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  try {
    const stations = await radioBrowserService.getPopularStations(
      parseInt(limit), 
      (parseInt(page) - 1) * parseInt(limit)
    );
    
    res.json({
      success: true,
      data: stations,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasMore: stations.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching popular radio stations:', error);
    throw new AppError('Failed to fetch popular radio stations', 500);
  }
}));

// Get available countries for radio
router.get('/radio/countries', optionalAuth, catchAsync(async (req, res) => {
  try {
    const countries = await radioBrowserService.getCountries();
    
    res.json({
      success: true,
      data: countries
    });
  } catch (error) {
    console.error('Error fetching radio countries:', error);
    throw new AppError('Failed to fetch countries', 500);
  }
}));

// Get available genres for radio
router.get('/radio/genres', optionalAuth, catchAsync(async (req, res) => {
  const { limit = 50 } = req.query;
  
  try {
    const genres = await radioBrowserService.getGenres(parseInt(limit));
    
    res.json({
      success: true,
      data: genres
    });
  } catch (error) {
    console.error('Error fetching radio genres:', error);
    throw new AppError('Failed to fetch genres', 500);
  }
}));

// Click/play radio station (for popularity tracking)
router.post('/radio/:stationUuid/click', optionalAuth, catchAsync(async (req, res) => {
  const { stationUuid } = req.params;
  
  try {
    const success = await radioBrowserService.clickStation(stationUuid);
    
    res.json({
      success,
      message: success ? 'Station click recorded' : 'Failed to record click'
    });
  } catch (error) {
    console.error('Error clicking radio station:', error);
    res.json({
      success: false,
      message: 'Failed to record click'
    });
  }
}));

// Get radio station stream URL (with click tracking)
router.get('/radio/:stationUuid/stream', optionalAuth, catchAsync(async (req, res) => {
  const { stationUuid } = req.params;
  
  try {
    const streamData = await radioBrowserService.getStreamUrl(stationUuid);
    
    res.json({
      success: true,
      data: streamData
    });
  } catch (error) {
    console.error('Error getting radio stream:', error);
    throw new AppError('Failed to get radio stream', 500);
  }
}));

// Get radio station details with enhanced info
router.get('/radio/:stationUuid/details', optionalAuth, catchAsync(async (req, res) => {
  const { stationUuid } = req.params;
  
  try {
    const station = await radioBrowserService.getStationByUuid(stationUuid);
    
    if (!station) {
      throw new AppError('Radio station not found', 404);
    }
    
    res.json({
      success: true,
      data: station
    });
  } catch (error) {
    console.error('Error getting radio station details:', error);
    throw new AppError('Failed to get radio station details', 500);
  }
}));

// Radio health check endpoint
router.get('/radio/health', optionalAuth, catchAsync(async (req, res) => {
  try {
    // Test the radio browser service
    const testStations = await radioBrowserService.getPopularStations(1, 0);
    
    res.json({
      success: true,
      message: 'Radio service is healthy',
      data: {
        stationsAvailable: testStations.length > 0,
        cacheSize: radioBrowserService.cache?.size || 0
      }
    });
  } catch (error) {
    console.error('Radio service health check failed:', error);
    res.status(503).json({
      success: false,
      message: 'Radio service is unavailable',
      error: error.message
    });
  }
}));

// Clear radio cache endpoint (for debugging)
router.post('/radio/cache/clear', optionalAuth, catchAsync(async (req, res) => {
  try {
    radioBrowserService.clearCache();
    
    res.json({
      success: true,
      message: 'Radio cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing radio cache:', error);
    res.json({
      success: false,
      message: 'Failed to clear radio cache'
    });
  }
}));

// Proxy radio station favicon to avoid CORS issues
router.get('/radio/favicon/:stationUuid', catchAsync(async (req, res) => {
  const { stationUuid } = req.params;
  
  try {
    const station = await radioBrowserService.getStationByUuid(stationUuid);
    
    if (!station || !station.favicon) {
      // Return default radio icon
      return res.redirect('/images/radio-placeholder.svg');
    }
    
    // Proxy the favicon
    const axios = require('axios');
    const faviconResponse = await axios.get(station.favicon, {
      responseType: 'stream',
      timeout: 5000,
      headers: {
        'User-Agent': 'Streamora/1.0'
      }
    });
    
    res.set({
      'Content-Type': faviconResponse.headers['content-type'] || 'image/png',
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });
    
    faviconResponse.data.pipe(res);
  } catch (error) {
    console.error('Error proxying favicon:', error);
    // Return default radio icon on error
    res.redirect('/images/radio-placeholder.svg');
  }
}));

// Get TV season details
router.get('/tv/:id/season/:seasonNumber', optionalAuth, async (req, res) => {
  try {
    const { id, seasonNumber } = req.params;
    
    const seasonData = await tmdbService.getTVSeasonDetails(id, seasonNumber);
    
    res.json({
      success: true,
      data: seasonData
    });
  } catch (error) {
    console.error(`Error fetching season ${seasonNumber} for TV ${id}:`, error);
    throw new AppError(`Failed to fetch season details`, 500);
  }
});

// Get trending people
router.get('/trending/people', optionalAuth, catchAsync(async (req, res) => {
  const { timeWindow = 'day', page = 1 } = req.query;
  
  const data = await tmdbService.getTrendingPeople(timeWindow, page);
  
  res.json({
    success: true,
    data: data
  });
}));

// Get trending movies
router.get('/trending/movies', optionalAuth, catchAsync(async (req, res) => {
  const { timeWindow = 'day', page = 1 } = req.query;
  
  const data = await tmdbService.getTrendingMovies(timeWindow, page);
  
  res.json({
    success: true,
    data: data
  });
}));

// Get airing today TV shows
router.get('/tv/airing-today', optionalAuth, catchAsync(async (req, res) => {
  const { page = 1 } = req.query;
  
  const data = await tmdbService.getAiringTodayTV(page);
  
  res.json({
    success: true,
    data: data
  });
}));

// Get person details and images
router.get('/person/:personId', optionalAuth, catchAsync(async (req, res) => {
  const { personId } = req.params;
  
  const personDetails = await tmdbService.getPersonDetails(personId);
  
  res.json({
    success: true,
    data: personDetails
  });
}));

// Get person images
router.get('/person/:personId/images', optionalAuth, catchAsync(async (req, res) => {
  const { personId } = req.params;
  
  const images = await tmdbService.getPersonImages(personId);
  
  res.json({
    success: true,
    data: images
  });
}));

// Get TV episode groups
router.get('/tv/:seriesId/episode-groups', optionalAuth, catchAsync(async (req, res) => {
  const { seriesId } = req.params;
  
  const episodeGroups = await tmdbService.getTVEpisodeGroups(seriesId);
  
  res.json({
    success: true,
    data: episodeGroups
  });
}));

// Get TV recommendations
router.get('/tv/:seriesId/recommendations', optionalAuth, catchAsync(async (req, res) => {
  const { seriesId } = req.params;
  const { page = 1 } = req.query;
  
  const recommendations = await tmdbService.getTVRecommendations(seriesId, page);
  
  res.json({
    success: true,
    data: recommendations
  });
}));

// Get movie recommendations
router.get('/movie/:movieId/recommendations', optionalAuth, catchAsync(async (req, res) => {
  const { movieId } = req.params;
  const { page = 1 } = req.query;
  
  const recommendations = await tmdbService.getMovieRecommendations(movieId, page);
  
  res.json({
    success: true,
    data: recommendations
  });
}));

// Get collection translations
router.get('/collection/:collectionId/translations', optionalAuth, catchAsync(async (req, res) => {
  const { collectionId } = req.params;
  
  const translations = await tmdbService.getCollectionTranslations(collectionId);
  
  res.json({
    success: true,
    data: translations
  });
}));

// Get movie watch providers
router.get('/watch-providers/movie', optionalAuth, catchAsync(async (req, res) => {
  const { watchRegion = 'US' } = req.query;
  
  const providers = await tmdbService.getMovieWatchProviders(watchRegion);
  
  res.json({
    success: true,
    data: providers
  });
}));

// Get TV watch providers
router.get('/watch-providers/tv', optionalAuth, catchAsync(async (req, res) => {
  const { watchRegion = 'US' } = req.query;
  
  const providers = await tmdbService.getTVWatchProviders(watchRegion);
  
  res.json({
    success: true,
    data: providers
  });
}));

// Get movie watch providers by ID
router.get('/movie/:movieId/watch-providers', optionalAuth, catchAsync(async (req, res) => {
  const { movieId } = req.params;
  
  const providers = await tmdbService.getMovieWatchProvidersById(movieId);
  
  res.json({
    success: true,
    data: providers
  });
}));

// Get TV watch providers by ID
router.get('/tv/:tvId/watch-providers', optionalAuth, catchAsync(async (req, res) => {
  const { tvId } = req.params;
  
  const providers = await tmdbService.getTVWatchProvidersById(tvId);
  
  res.json({
    success: true,
    data: providers
  });
}));

// Get genres
router.get('/genres/movie', optionalAuth, catchAsync(async (req, res) => {
  const genres = await tmdbService.getMovieGenres();
  
  res.json({
    success: true,
    data: genres
  });
}));

router.get('/genres/tv', optionalAuth, catchAsync(async (req, res) => {
  const genres = await tmdbService.getTVGenres();
  
  res.json({
    success: true,
    data: genres
  });
}));

// Get videos
router.get('/movie/:movieId/videos', optionalAuth, catchAsync(async (req, res) => {
  const { movieId } = req.params;
  
  const videos = await tmdbService.getMovieVideos(movieId);
  
  res.json({
    success: true,
    data: videos
  });
}));

router.get('/tv/:tvId/videos', optionalAuth, catchAsync(async (req, res) => {
  const { tvId } = req.params;
  
  const videos = await tmdbService.getTVShowVideos(tvId);
  
  res.json({
    success: true,
    data: videos
  });
}));

// Get similar content
router.get('/movie/:movieId/similar', optionalAuth, catchAsync(async (req, res) => {
  const { movieId } = req.params;
  const { page = 1 } = req.query;
  
  const similar = await tmdbService.getSimilarMovies(movieId, page);
  
  res.json({
    success: true,
    data: similar
  });
}));

router.get('/tv/:tvId/similar', optionalAuth, catchAsync(async (req, res) => {
  const { tvId } = req.params;
  const { page = 1 } = req.query;
  
  const similar = await tmdbService.getSimilarTVShows(tvId, page);
  
  res.json({
    success: true,
    data: similar
  });
}));

// Get alternative titles
router.get('/movie/:movieId/alternative-titles', optionalAuth, catchAsync(async (req, res) => {
  const { movieId } = req.params;
  const { country } = req.query;
  
  const titles = await tmdbService.getMovieAlternativeTitles(movieId, country);
  
  res.json({
    success: true,
    data: titles
  });
}));

router.get('/tv/:tvId/alternative-titles', optionalAuth, catchAsync(async (req, res) => {
  const { tvId } = req.params;
  
  const titles = await tmdbService.getTVAlternativeTitles(tvId);
  
  res.json({
    success: true,
    data: titles
  });
}));

// Get network images
router.get('/network/:networkId/images', optionalAuth, catchAsync(async (req, res) => {
  const { networkId } = req.params;
  
  const images = await tmdbService.getNetworkImages(networkId);
  
  res.json({
    success: true,
    data: images
  });
}));

// TMDB Authentication endpoints
// Test TMDB API key validation
router.get('/tmdb/test-key', optionalAuth, catchAsync(async (req, res) => {
  try {
    // Test with a simple endpoint that requires API key
    const testResponse = await tmdbService.getPopularMovies(1);
    res.json({
      success: true,
      message: 'TMDB API key is working correctly',
      data: {
        totalResults: testResponse.results?.length || 0,
        firstMovie: testResponse.results?.[0]?.title || 'No movies found'
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'TMDB API key test failed',
      error: error.message
    });
  }
}));

// Validate TMDB API key
router.get('/tmdb/auth/validate', optionalAuth, catchAsync(async (req, res) => {
  try {
    const validation = await tmdbService.validateAPIKey();
    res.json({
      success: true,
      message: 'TMDB API key is valid',
      data: validation
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'TMDB API key validation failed',
      error: error.message
    });
  }
}));

router.post('/tmdb/auth/request-token', optionalAuth, catchAsync(async (req, res) => {
  const token = await tmdbService.createRequestToken();
  
  res.json({
    success: true,
    data: token
  });
}));

router.post('/tmdb/auth/session', optionalAuth, catchAsync(async (req, res) => {
  const { username, password, request_token } = req.body;
  
  if (!username || !password || !request_token) {
    return res.status(400).json({
      success: false,
      message: 'Username, password, and request token are required'
    });
  }
  
  const session = await tmdbService.createSessionWithLogin(username, password, request_token);
  
  res.json({
    success: true,
    data: session
  });
}));

router.post('/tmdb/auth/guest-session', optionalAuth, catchAsync(async (req, res) => {
  const guestSession = await tmdbService.createGuestSession();
  
  res.json({
    success: true,
    data: guestSession
  });
}));

router.delete('/tmdb/auth/session', optionalAuth, catchAsync(async (req, res) => {
  const { session_id } = req.body;
  
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }
  
  const result = await tmdbService.deleteSession(session_id);
  
  res.json({
    success: true,
    data: result
  });
}));

// TMDB Account endpoints
router.get('/tmdb/account', optionalAuth, catchAsync(async (req, res) => {
  const { session_id } = req.query;
  
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }
  
  const account = await tmdbService.getAccountDetails(session_id);
  
  res.json({
    success: true,
    data: account
  });
}));

router.post('/tmdb/account/:accountId/watchlist', optionalAuth, catchAsync(async (req, res) => {
  const { accountId } = req.params;
  const { session_id, media_type, media_id, watchlist = true } = req.body;
  
  if (!session_id || !media_type || !media_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID, media type, and media ID are required'
    });
  }
  
  const result = await tmdbService.addToWatchlist(accountId, session_id, media_type, media_id, watchlist);
  
  res.json({
    success: true,
    data: result
  });
}));

router.post('/tmdb/account/:accountId/favorite', optionalAuth, catchAsync(async (req, res) => {
  const { accountId } = req.params;
  const { session_id, media_type, media_id, favorite = true } = req.body;
  
  if (!session_id || !media_type || !media_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID, media type, and media ID are required'
    });
  }
  
  const result = await tmdbService.addToFavorites(accountId, session_id, media_type, media_id, favorite);
  
  res.json({
    success: true,
    data: result
  });
}));

router.get('/tmdb/account/:accountId/watchlist/movies', optionalAuth, catchAsync(async (req, res) => {
  const { accountId } = req.params;
  const { session_id, page = 1, sort_by = 'created_at.asc' } = req.query;
  
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }
  
  const watchlist = await tmdbService.getWatchlistMovies(accountId, session_id, page, sort_by);
  
  res.json({
    success: true,
    data: watchlist
  });
}));

router.get('/tmdb/account/:accountId/watchlist/tv', optionalAuth, catchAsync(async (req, res) => {
  const { accountId } = req.params;
  const { session_id, page = 1, sort_by = 'created_at.asc' } = req.query;
  
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }
  
  const watchlist = await tmdbService.getWatchlistTV(accountId, session_id, page, sort_by);
  
  res.json({
    success: true,
    data: watchlist
  });
}));

router.get('/tmdb/account/:accountId/favorite/movies', optionalAuth, catchAsync(async (req, res) => {
  const { accountId } = req.params;
  const { session_id, page = 1, sort_by = 'created_at.asc' } = req.query;
  
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }
  
  const favorites = await tmdbService.getFavoriteMovies(accountId, session_id, page, sort_by);
  
  res.json({
    success: true,
    data: favorites
  });
}));

router.get('/tmdb/account/:accountId/favorite/tv', optionalAuth, catchAsync(async (req, res) => {
  const { accountId } = req.params;
  const { session_id, page = 1, sort_by = 'created_at.asc' } = req.query;
  
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }
  
  const favorites = await tmdbService.getFavoriteTV(accountId, session_id, page, sort_by);
  
  res.json({
    success: true,
    data: favorites
  });
}));

router.get('/tmdb/account/:accountId/rated/movies', optionalAuth, catchAsync(async (req, res) => {
  const { accountId } = req.params;
  const { session_id, page = 1, sort_by = 'created_at.asc' } = req.query;
  
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }
  
  const rated = await tmdbService.getRatedMovies(accountId, session_id, page, sort_by);
  
  res.json({
    success: true,
    data: rated
  });
}));

router.get('/tmdb/account/:accountId/rated/tv', optionalAuth, catchAsync(async (req, res) => {
  const { accountId } = req.params;
  const { session_id, page = 1, sort_by = 'created_at.asc' } = req.query;
  
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }
  
  const rated = await tmdbService.getRatedTV(accountId, session_id, page, sort_by);
  
  res.json({
    success: true,
    data: rated
  });
}));

router.post('/movie/:movieId/rating', optionalAuth, catchAsync(async (req, res) => {
  const { movieId } = req.params;
  const { session_id, rating } = req.body;
  
  if (!session_id || !rating) {
    return res.status(400).json({
      success: false,
      message: 'Session ID and rating are required'
    });
  }
  
  const result = await tmdbService.rateMovie(movieId, rating, session_id);
  
  res.json({
    success: true,
    data: result
  });
}));

router.post('/tv/:tvId/rating', optionalAuth, catchAsync(async (req, res) => {
  const { tvId } = req.params;
  const { session_id, rating } = req.body;
  
  if (!session_id || !rating) {
    return res.status(400).json({
      success: false,
      message: 'Session ID and rating are required'
    });
  }
  
  const result = await tmdbService.rateTV(tvId, rating, session_id);
  
  res.json({
    success: true,
    data: result
  });
}));

router.delete('/movie/:movieId/rating', optionalAuth, catchAsync(async (req, res) => {
  const { movieId } = req.params;
  const { session_id } = req.body;
  
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }
  
  const result = await tmdbService.deleteMovieRating(movieId, session_id);
  
  res.json({
    success: true,
    data: result
  });
}));

router.delete('/tv/:tvId/rating', optionalAuth, catchAsync(async (req, res) => {
  const { tvId } = req.params;
  const { session_id } = req.body;
  
  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }
  
  const result = await tmdbService.deleteTVRating(tvId, session_id);
  
  res.json({
    success: true,
    data: result
  });
}));

module.exports = router;

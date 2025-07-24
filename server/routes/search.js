const express = require('express');
const Content = require('../models/Content');
const RadioStation = require('../models/RadioStation');
const tmdbService = require('../services/tmdbService');
const youtubeService = require('../services/youtubeService');
const { optionalAuth } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Search all content
router.get('/', optionalAuth, catchAsync(async (req, res) => {
  const {
    q: query,
    type = 'all', // all, movie, tv, radio
    page = 1,
    limit = 20,
    genre,
    year,
    sortBy = 'popularity'
  } = req.query;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters long'
    });
  }

  const results = {
    movies: [],
    tv: [],
    radio: [],
    total: 0
  };

  try {
    // Search TMDB for movies and TV shows
    if (type === 'all' || type === 'movie' || type === 'tv') {
      try {
        const tmdbResults = await tmdbService.search(query, page);
        
        tmdbResults.results.forEach(item => {
          const transformedItem = {
            id: item.id,
            title: item.title || item.name,
            poster: tmdbService.getImageURL(item.poster_path),
            backdrop: tmdbService.getImageURL(item.backdrop_path, 'w1280'),
            type: item.media_type,
            rating: item.vote_average,
            year: item.release_date || item.first_air_date ? 
              new Date(item.release_date || item.first_air_date).getFullYear() : null,
            overview: item.overview,
            popularity: item.popularity
          };

          if (item.media_type === 'movie' && (type === 'all' || type === 'movie')) {
            results.movies.push(transformedItem);
          } else if (item.media_type === 'tv' && (type === 'all' || type === 'tv')) {
            results.tv.push(transformedItem);
          }
        });

        results.total += tmdbResults.total_results || 0;
      } catch (tmdbError) {
        console.error('Search error:', tmdbError);
        // Don't fail the entire search if TMDB is down, just log the error
        // and continue with other search sources
      }
    }

    // Search radio stations
    if (type === 'all' || type === 'radio') {
      const radioQuery = {
        $text: { $search: query },
        isActive: true
      };

      if (genre) {
        radioQuery.genre = { $in: [genre] };
      }

      const radioStations = await RadioStation
        .find(radioQuery)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .sort({ listeners: -1 });

      results.radio = radioStations.map(station => ({
        id: station._id,
        title: station.name,
        poster: station.logo,
        type: 'radio',
        genre: station.genre,
        listeners: station.listeners,
        country: station.country,
        description: station.description
      }));

      const radioCount = await RadioStation.countDocuments(radioQuery);
      results.total += radioCount;
    }

    // Apply additional filters
    if (year) {
      results.movies = results.movies.filter(movie => movie.year === parseInt(year));
      results.tv = results.tv.filter(show => show.year === parseInt(year));
    }

    // Sort results
    const sortFunction = (a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'year':
          return (b.year || 0) - (a.year || 0);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'popularity':
        default:
          return (b.popularity || b.listeners || 0) - (a.popularity || a.listeners || 0);
      }
    };

    results.movies.sort(sortFunction);
    results.tv.sort(sortFunction);

    // Combine all results if type is 'all'
    let allResults = [];
    if (type === 'all') {
      allResults = [...results.movies, ...results.tv, ...results.radio].sort(sortFunction);
    } else if (type === 'movie') {
      allResults = results.movies;
    } else if (type === 'tv') {
      allResults = results.tv;
    } else if (type === 'radio') {
      allResults = results.radio;
    }

    res.json({
      success: true,
      data: {
        query,
        results: allResults,
        breakdown: {
          movies: results.movies.length,
          tv: results.tv.length,
          radio: results.radio.length,
          total: results.total
        },
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          hasMore: allResults.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    throw new AppError('Search failed', 500);
  }
}));

// Search suggestions/autocomplete
router.get('/suggestions', catchAsync(async (req, res) => {
  const { q: query, limit = 10 } = req.query;

  if (!query || query.trim().length < 2) {
    return res.json({
      success: true,
      data: []
    });
  }

  try {
    // Get search suggestions from TMDB
    const tmdbResults = await tmdbService.search(query, 1);
    
    const suggestions = tmdbResults.results
      .slice(0, parseInt(limit))
      .map(item => ({
        id: item.id,
        title: item.title || item.name,
        type: item.media_type,
        year: item.release_date || item.first_air_date ? 
          new Date(item.release_date || item.first_air_date).getFullYear() : null,
        poster: tmdbService.getImageURL(item.poster_path, 'w92') // Small poster for suggestions
      }));

    // Add radio station suggestions
    const radioSuggestions = await RadioStation
      .find({
        $text: { $search: query },
        isActive: true
      })
      .limit(5)
      .select('name genre country logo')
      .sort({ listeners: -1 });

    const radioResults = radioSuggestions.map(station => ({
      id: station._id,
      title: station.name,
      type: 'radio',
      genre: station.genre[0],
      country: station.country,
      poster: station.logo
    }));

    const allSuggestions = [...suggestions, ...radioResults]
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: allSuggestions
    });

  } catch (error) {
    console.error('Search suggestions error:', error);
    res.json({
      success: true,
      data: [] // Return empty array on error for suggestions
    });
  }
}));

// Popular search terms
router.get('/trending', catchAsync(async (req, res) => {
  try {
    // Get trending content from TMDB
    const trending = await tmdbService.getTrending('all', 'day', 1);
    
    const trendingTerms = trending.results
      .slice(0, 10)
      .map(item => ({
        term: item.title || item.name,
        type: item.media_type,
        count: Math.floor(item.popularity)
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: trendingTerms
    });

  } catch (error) {
    console.error('Trending search terms error:', error);
    res.json({
      success: true,
      data: []
    });
  }
}));

// Advanced search with multiple filters
router.post('/advanced', optionalAuth, catchAsync(async (req, res) => {
  const {
    query,
    filters = {},
    page = 1,
    limit = 20,
    sortBy = 'popularity'
  } = req.body;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters long'
    });
  }

  try {
    const results = {
      movies: [],
      tv: [],
      radio: [],
      total: 0
    };

    // Build TMDB discover filters
    const tmdbFilters = {
      page: parseInt(page),
      sortBy: sortBy === 'popularity' ? 'popularity.desc' : 
              sortBy === 'rating' ? 'vote_average.desc' :
              sortBy === 'year' ? 'release_date.desc' : 'popularity.desc'
    };

    // Apply filters
    if (filters.genres && filters.genres.length > 0) {
      tmdbFilters.with_genres = filters.genres.join(',');
    }

    if (filters.year) {
      tmdbFilters.year = filters.year;
      tmdbFilters.first_air_date_year = filters.year;
    }

    if (filters.rating) {
      if (filters.rating.min) tmdbFilters['vote_average.gte'] = filters.rating.min;
      if (filters.rating.max) tmdbFilters['vote_average.lte'] = filters.rating.max;
    }

    if (filters.runtime) {
      if (filters.runtime.min) tmdbFilters['with_runtime.gte'] = filters.runtime.min;
      if (filters.runtime.max) tmdbFilters['with_runtime.lte'] = filters.runtime.max;
    }

    // Search movies if requested
    if (!filters.type || filters.type === 'movie') {
      try {
        const movieResults = await tmdbService.discoverMovies(tmdbFilters);
        
        // Filter by query in title/overview
        const filteredMovies = movieResults.results.filter(movie => 
          movie.title.toLowerCase().includes(query.toLowerCase()) ||
          (movie.overview && movie.overview.toLowerCase().includes(query.toLowerCase()))
        );

        results.movies = filteredMovies.map(movie => ({
          id: movie.id,
          title: movie.title,
          poster: tmdbService.getImageURL(movie.poster_path),
          backdrop: tmdbService.getImageURL(movie.backdrop_path, 'w1280'),
          type: 'movie',
          rating: movie.vote_average,
          year: new Date(movie.release_date).getFullYear(),
          overview: movie.overview,
          genres: movie.genre_ids,
          popularity: movie.popularity
        }));

        results.total += filteredMovies.length;
      } catch (error) {
        console.error('Movie discovery error:', error);
      }
    }

    // Search TV shows if requested
    if (!filters.type || filters.type === 'tv') {
      try {
        const tvResults = await tmdbService.discoverTVShows(tmdbFilters);
        
        const filteredTV = tvResults.results.filter(show => 
          show.name.toLowerCase().includes(query.toLowerCase()) ||
          (show.overview && show.overview.toLowerCase().includes(query.toLowerCase()))
        );

        results.tv = filteredTV.map(show => ({
          id: show.id,
          title: show.name,
          poster: tmdbService.getImageURL(show.poster_path),
          backdrop: tmdbService.getImageURL(show.backdrop_path, 'w1280'),
          type: 'tv',
          rating: show.vote_average,
          year: new Date(show.first_air_date).getFullYear(),
          overview: show.overview,
          genres: show.genre_ids,
          popularity: show.popularity
        }));

        results.total += filteredTV.length;
      } catch (error) {
        console.error('TV discovery error:', error);
      }
    }

    // Search radio stations if requested
    if (!filters.type || filters.type === 'radio') {
      const radioQuery = {
        $text: { $search: query },
        isActive: true
      };

      if (filters.genres && filters.genres.length > 0) {
        radioQuery.genre = { $in: filters.genres };
      }

      if (filters.country) {
        radioQuery.country = filters.country;
      }

      const radioStations = await RadioStation
        .find(radioQuery)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .sort({ listeners: -1 });

      results.radio = radioStations.map(station => ({
        id: station._id,
        title: station.name,
        poster: station.logo,
        type: 'radio',
        genre: station.genre,
        listeners: station.listeners,
        country: station.country,
        description: station.description
      }));

      const radioCount = await RadioStation.countDocuments(radioQuery);
      results.total += radioCount;
    }

    // Combine and sort results
    const allResults = [...results.movies, ...results.tv, ...results.radio];
    
    const sortFunction = (a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'year':
          return (b.year || 0) - (a.year || 0);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'popularity':
        default:
          return (b.popularity || b.listeners || 0) - (a.popularity || a.listeners || 0);
      }
    };

    allResults.sort(sortFunction);

    res.json({
      success: true,
      data: {
        query,
        filters,
        results: allResults,
        breakdown: {
          movies: results.movies.length,
          tv: results.tv.length,
          radio: results.radio.length,
          total: results.total
        },
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          hasMore: allResults.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Advanced search error:', error);
    throw new AppError('Advanced search failed', 500);
  }
}));

module.exports = router;

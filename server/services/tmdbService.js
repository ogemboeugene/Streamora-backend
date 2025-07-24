const axios = require('axios');

class TMDBService {
  constructor() {
    this.apiKey = process.env.TMDB_API_KEY;
    this.baseURL = 'https://api.themoviedb.org/3';
    this.imageBaseURL = 'https://image.tmdb.org/t/p';
    
    // Debug: Log API key status (without exposing the full key)
    if (this.apiKey) {
      console.log(`TMDB API Key loaded: ${this.apiKey.substring(0, 8)}... (${this.apiKey.length} chars)`);
      if (this.apiKey.startsWith('eyJ')) {
        console.log('Using Bearer token authentication');
      } else {
        console.log('Using legacy API key authentication');
      }
    } else {
      console.error('TMDB API Key not found in environment variables');
    }
    
    // Simple in-memory cache
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Helper method to get from cache or make request
  async getCachedOrFetch(cacheKey, fetchFunction) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const data = await fetchFunction();
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      return data;
    } catch (error) {
      // If we have cached data, return it even if expired
      if (cached) {
        console.log(`Using expired cache for ${cacheKey} due to API error`);
        return cached.data;
      }
      throw error;
    }
  }

  // Helper method to make API requests
  async makeRequest(endpoint, method = 'GET', params = {}, data = null) {
    try {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      
      // Check if we have a Bearer token (newer format) or API key (legacy)
      if (this.apiKey) {
        if (this.apiKey.startsWith('eyJ') || this.apiKey.length > 50) {
          // It's a Bearer token (JWT format or Read Access Token)
          headers.Authorization = `Bearer ${this.apiKey}`;
        } else {
          // It's a legacy API key - ALWAYS add to params, never to data
          params.api_key = this.apiKey;
        }
      } else {
        throw new Error('TMDB API key not configured');
      }

      const config = {
        method: method.toLowerCase(),
        url: `${this.baseURL}${endpoint}`,
        headers,
        timeout: 30000,
        retry: 3
      };

      // Always set params for query parameters (including api_key)
      config.params = params;
      
      // Only set data for POST/PUT/DELETE if we have actual data to send
      if (method !== 'GET' && data && typeof data === 'object') {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`TMDB API Error for ${endpoint}:`, error.message);
      console.error('Full error:', error.response?.data || error.message);
      
      // Handle specific timeout errors
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error(`TMDB API timeout - please try again later`);
      }
      
      // Handle rate limiting
      if (error.response?.status === 429) {
        throw new Error(`TMDB API rate limit exceeded - please try again later`);
      }
      
      // Handle other API errors
      if (error.response?.status >= 400) {
        throw new Error(`TMDB API error: ${error.response.status} - ${error.response.data?.status_message || error.message}`);
      }
      
      throw new Error(`TMDB API request failed: ${error.message}`);
    }
  }

  // Get image URL
  getImageURL(path, size = 'w500') {
    if (!path) return null;
    return `${this.imageBaseURL}/${size}${path}`;
  }

  // Search movies and TV shows
  async search(query, page = 1, includeAdult = false) {
    const cacheKey = `search_${query}_${page}_${includeAdult}`;
    return await this.getCachedOrFetch(cacheKey, async () => {
      return await this.makeRequest('/search/multi', 'GET', {
        query,
        page,
        include_adult: includeAdult
      });
    });
  }

  // Get trending content
  async getTrending(mediaType = 'all', timeWindow = 'day', page = 1) {
    const cacheKey = `trending_${mediaType}_${timeWindow}_${page}`;
    return await this.getCachedOrFetch(cacheKey, async () => {
      return await this.makeRequest(`/trending/${mediaType}/${timeWindow}`, 'GET', { page });
    });
  }

  // Get popular movies
  async getPopularMovies(page = 1) {
    const cacheKey = `popular_movies_${page}`;
    return await this.getCachedOrFetch(cacheKey, async () => {
      return await this.makeRequest('/movie/popular', 'GET', { page });
    });
  }

  // Get popular TV shows
  async getPopularTVShows(page = 1) {
    const cacheKey = `popular_tv_${page}`;
    return await this.getCachedOrFetch(cacheKey, async () => {
      return await this.makeRequest('/tv/popular', 'GET', { page });
    });
  }

  // Get top rated movies
  async getTopRatedMovies(page = 1) {
    const cacheKey = `top_rated_movies_${page}`;
    return await this.getCachedOrFetch(cacheKey, async () => {
      return await this.makeRequest('/movie/top_rated', 'GET', { page });
    });
  }

  // Get top rated TV shows
  async getTopRatedTVShows(page = 1) {
    return await this.makeRequest('/tv/top_rated', 'GET', { page });
  }

  // Get upcoming movies
  async getUpcomingMovies(page = 1) {
    return await this.makeRequest('/movie/upcoming', 'GET', { page });
  }

  // Get now playing movies
  async getNowPlayingMovies(page = 1) {
    return await this.makeRequest('/movie/now_playing', 'GET', { page });
  }

  // Get movie details
  async getMovieDetails(movieId) {
    return await this.makeRequest(`/movie/${movieId}`, 'GET', {
      append_to_response: 'credits,videos,similar,reviews,external_ids'
    });
  }

  // Get TV show details
  async getTVShowDetails(tvId) {
    return await this.makeRequest(`/tv/${tvId}`, 'GET', {
      append_to_response: 'credits,videos,similar,reviews,external_ids'
    });
  }

  // Get movie videos (trailers, clips, etc.)
  async getMovieVideos(movieId) {
    return await this.makeRequest(`/movie/${movieId}/videos`, 'GET');
  }

  // Get TV show videos
  async getTVShowVideos(tvId) {
    return await this.makeRequest(`/tv/${tvId}/videos`, 'GET');
  }

  // Get genres
  async getMovieGenres() {
    return await this.makeRequest('/genre/movie/list', 'GET');
  }

  async getTVGenres() {
    return await this.makeRequest('/genre/tv/list', 'GET');
  }

  // Get videos for movies and TV shows
  async getMovieVideos(movieId) {
    return await this.makeRequest(`/movie/${movieId}/videos`, 'GET');
  }

  async getTVShowVideos(tvId) {
    return await this.makeRequest(`/tv/${tvId}/videos`, 'GET');
  }

  // Get similar content
  async getSimilarMovies(movieId, page = 1) {
    return await this.makeRequest(`/movie/${movieId}/similar`, 'GET', { page });
  }

  async getSimilarTVShows(tvId, page = 1) {
    return await this.makeRequest(`/tv/${tvId}/similar`, 'GET', { page });
  }

  // Get alternative titles
  async getMovieAlternativeTitles(movieId, country = null) {
    const params = country ? { country } : {};
    return await this.makeRequest(`/movie/${movieId}/alternative_titles`, 'GET', params);
  }

  async getTVAlternativeTitles(tvId) {
    return await this.makeRequest(`/tv/${tvId}/alternative_titles`, 'GET');
  }

  // Get network images
  async getNetworkImages(networkId) {
    return await this.makeRequest(`/network/${networkId}/images`, 'GET');
  }

  // Discover movies with filters
  async discoverMovies(filters = {}) {
    const params = {
      page: filters.page || 1,
      sort_by: filters.sortBy || 'popularity.desc',
      include_adult: filters.includeAdult || false,
      include_video: filters.includeVideo || false,
      ...filters
    };

    return await this.makeRequest('/discover/movie', 'GET', params);
  }

  // Discover TV shows with filters
  async discoverTVShows(filters = {}) {
    const params = {
      page: filters.page || 1,
      sort_by: filters.sortBy || 'popularity.desc',
      include_adult: filters.includeAdult || false,
      ...filters
    };

    return await this.makeRequest('/discover/tv', 'GET', params);
  }

  // Get TV season details
  async getTVSeasonDetails(tvId, seasonNumber) {
    try {
      const response = await this.makeRequest(`/tv/${tvId}/season/${seasonNumber}`, 'GET');
      return this.transformSeasonData(response);
    } catch (error) {
      console.error(`Error fetching season ${seasonNumber} for TV ${tvId}:`, error);
      throw error;
    }
  }

  // Transform season data
  transformSeasonData(tmdbSeason) {
    return {
      id: tmdbSeason.id,
      name: tmdbSeason.name,
      overview: tmdbSeason.overview,
      air_date: tmdbSeason.air_date,
      episode_count: tmdbSeason.episodes?.length || tmdbSeason.episode_count,
      poster_path: tmdbSeason.poster_path,
      season_number: tmdbSeason.season_number,
      episodes: tmdbSeason.episodes?.map(episode => ({
        id: episode.id,
        name: episode.name,
        overview: episode.overview,
        episode_number: episode.episode_number,
        air_date: episode.air_date,
        runtime: episode.runtime,
        still_path: episode.still_path,
        vote_average: episode.vote_average,
        vote_count: episode.vote_count
      })) || []
    };
  }

  // Get person details
  async getPersonDetails(personId) {
    return await this.makeRequest(`/person/${personId}`, 'GET', {
      append_to_response: 'movie_credits,tv_credits'
    });
  }

  // Get person images
  async getPersonImages(personId) {
    return await this.makeRequest(`/person/${personId}/images`, 'GET');
  }

  // Get trending people
  async getTrendingPeople(timeWindow = 'day', page = 1) {
    return await this.makeRequest(`/trending/person/${timeWindow}`, 'GET', { page });
  }

  // Get trending movies
  async getTrendingMovies(timeWindow = 'day', page = 1) {
    return await this.makeRequest(`/trending/movie/${timeWindow}`, 'GET', { page });
  }

  // Get airing today TV shows
  async getAiringTodayTV(page = 1) {
    return await this.makeRequest('/tv/airing_today', 'GET', { page });
  }

  // Get TV show episode groups
  async getTVEpisodeGroups(seriesId) {
    return await this.makeRequest(`/tv/${seriesId}/episode_groups`, 'GET');
  }

  // Get TV show recommendations
  async getTVRecommendations(seriesId, page = 1) {
    return await this.makeRequest(`/tv/${seriesId}/recommendations`, 'GET', { page });
  }

  // Get movie recommendations
  async getMovieRecommendations(movieId, page = 1) {
    return await this.makeRequest(`/movie/${movieId}/recommendations`, 'GET', { page });
  }

  // Get collection translations
  async getCollectionTranslations(collectionId) {
    return await this.makeRequest(`/collection/${collectionId}/translations`, 'GET');
  }

  // Get watch providers for movies
  async getMovieWatchProviders(watchRegion = 'US') {
    return await this.makeRequest('/watch/providers/movie', 'GET', { 
      watch_region: watchRegion 
    });
  }

  // Get watch providers for TV shows
  async getTVWatchProviders(watchRegion = 'US') {
    return await this.makeRequest('/watch/providers/tv', 'GET', { 
      watch_region: watchRegion 
    });
  }

  // Get movie watch providers for specific movie
  async getMovieWatchProvidersById(movieId) {
    return await this.makeRequest(`/movie/${movieId}/watch/providers`, 'GET');
  }

  // Get TV watch providers for specific show
  async getTVWatchProvidersById(tvId) {
    return await this.makeRequest(`/tv/${tvId}/watch/providers`, 'GET');
  }

  // Test API key validity
  async validateAPIKey() {
    try {
      const response = await this.makeRequest('/authentication', 'GET');
      console.log('TMDB API Key is valid:', response);
      return response;
    } catch (error) {
      console.error('TMDB API Key validation failed:', error.message);
      throw error;
    }
  }

  // Authentication methods
  async createRequestToken() {
    try {
      const response = await this.makeRequest('/authentication/token/new', 'GET');
      return response;
    } catch (error) {
      console.error('Error creating request token:', error);
      throw error;
    }
  }

  async createSessionWithLogin(username, password, requestToken) {
    try {
      // First validate the token with login credentials
      const validateResponse = await this.makeRequest('/authentication/token/validate_with_login', 'POST', {}, {
        username,
        password,
        request_token: requestToken
      });
      
      if (validateResponse.success) {
        // Create session with the validated token
        const sessionResponse = await this.makeRequest('/authentication/session/new', 'POST', {}, {
          request_token: requestToken
        });
        return sessionResponse;
      }
      
      throw new Error('Failed to validate login');
    } catch (error) {
      console.error('Error creating session with login:', error);
      throw error;
    }
  }

  async createGuestSession() {
    try {
      const response = await this.makeRequest('/authentication/guest_session/new', 'GET');
      return response;
    } catch (error) {
      console.error('Error creating guest session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId) {
    try {
      const response = await this.makeRequest('/authentication/session', 'DELETE', {}, {
        session_id: sessionId
      });
      return response;
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  // Account methods (requires session_id)
  async getAccountDetails(sessionId) {
    try {
      const response = await this.makeRequest('/account', 'GET', { session_id: sessionId });
      return response;
    } catch (error) {
      console.error('Error fetching account details:', error);
      throw error;
    }
  }

  async addToWatchlist(accountId, sessionId, mediaType, mediaId, watchlist = true) {
    try {
      const response = await this.makeRequest(`/account/${accountId}/watchlist`, 'POST', 
        { session_id: sessionId }, 
        {
          media_type: mediaType,
          media_id: mediaId,
          watchlist: watchlist
        }
      );
      return response;
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      throw error;
    }
  }

  async addToFavorites(accountId, sessionId, mediaType, mediaId, favorite = true) {
    try {
      const response = await this.makeRequest(`/account/${accountId}/favorite`, 'POST', 
        { session_id: sessionId }, 
        {
          media_type: mediaType,
          media_id: mediaId,
          favorite: favorite
        }
      );
      return response;
    } catch (error) {
      console.error('Error adding to favorites:', error);
      throw error;
    }
  }

  async getWatchlistMovies(accountId, sessionId, page = 1, sortBy = 'created_at.asc') {
    try {
      const response = await this.makeRequest(`/account/${accountId}/watchlist/movies`, 'GET', {
        session_id: sessionId,
        page: page,
        sort_by: sortBy
      });
      return response;
    } catch (error) {
      console.error('Error fetching watchlist movies:', error);
      throw error;
    }
  }

  async getWatchlistTV(accountId, sessionId, page = 1, sortBy = 'created_at.asc') {
    try {
      const response = await this.makeRequest(`/account/${accountId}/watchlist/tv`, 'GET', {
        session_id: sessionId,
        page: page,
        sort_by: sortBy
      });
      return response;
    } catch (error) {
      console.error('Error fetching watchlist TV:', error);
      throw error;
    }
  }

  async getFavoriteMovies(accountId, sessionId, page = 1, sortBy = 'created_at.asc') {
    try {
      const response = await this.makeRequest(`/account/${accountId}/favorite/movies`, 'GET', {
        session_id: sessionId,
        page: page,
        sort_by: sortBy
      });
      return response;
    } catch (error) {
      console.error('Error fetching favorite movies:', error);
      throw error;
    }
  }

  async getFavoriteTV(accountId, sessionId, page = 1, sortBy = 'created_at.asc') {
    try {
      const response = await this.makeRequest(`/account/${accountId}/favorite/tv`, 'GET', {
        session_id: sessionId,
        page: page,
        sort_by: sortBy
      });
      return response;
    } catch (error) {
      console.error('Error fetching favorite TV:', error);
      throw error;
    }
  }

  async getRatedMovies(accountId, sessionId, page = 1, sortBy = 'created_at.asc') {
    try {
      const response = await this.makeRequest(`/account/${accountId}/rated/movies`, 'GET', {
        session_id: sessionId,
        page: page,
        sort_by: sortBy
      });
      return response;
    } catch (error) {
      console.error('Error fetching rated movies:', error);
      throw error;
    }
  }

  async getRatedTV(accountId, sessionId, page = 1, sortBy = 'created_at.asc') {
    try {
      const response = await this.makeRequest(`/account/${accountId}/rated/tv`, 'GET', {
        session_id: sessionId,
        page: page,
        sort_by: sortBy
      });
      return response;
    } catch (error) {
      console.error('Error fetching rated TV:', error);
      throw error;
    }
  }

  // Add rating to movie (requires session_id)
  async rateMovie(movieId, rating, sessionId) {
    try {
      const response = await this.makeRequest(`/movie/${movieId}/rating`, 'POST', 
        { session_id: sessionId }, 
        { value: rating }
      );
      return response;
    } catch (error) {
      console.error(`Error rating movie ${movieId}:`, error.message);
      throw error;
    }
  }

  // Add rating to TV show (requires session_id)
  async rateTV(seriesId, rating, sessionId) {
    try {
      const response = await this.makeRequest(`/tv/${seriesId}/rating`, 'POST', 
        { session_id: sessionId }, 
        { value: rating }
      );
      return response;
    } catch (error) {
      console.error(`Error rating TV show ${seriesId}:`, error.message);
      throw error;
    }
  }

  // Delete movie rating
  async deleteMovieRating(movieId, sessionId) {
    try {
      const response = await this.makeRequest(`/movie/${movieId}/rating`, 'DELETE', 
        { session_id: sessionId }
      );
      return response;
    } catch (error) {
      console.error('Error deleting movie rating:', error);
      throw error;
    }
  }

  // Delete TV rating
  async deleteTVRating(tvId, sessionId) {
    try {
      const response = await this.makeRequest(`/tv/${tvId}/rating`, 'DELETE', 
        { session_id: sessionId }
      );
      return response;
    } catch (error) {
      console.error('Error deleting TV rating:', error);
      throw error;
    }
  }

  // Transform TMDB data to our format
  transformMovieData(tmdbMovie) {
    // Sanitize cast: remove id to avoid conflicts
    const sanitizedCast = (tmdbMovie.credits?.cast?.slice(0, 20) || []).map(person => {
      const { id, ...rest } = person;
      return {
        ...rest,
        tmdbPersonId: id
      };
    });

    // Sanitize crew: remove id to avoid conflicts
    const sanitizedCrew = (tmdbMovie.credits?.crew?.slice(0, 10) || []).map(person => {
      const { id, ...rest } = person;
      return {
        ...rest,
        tmdbPersonId: id
      };
    });

    return {
      tmdbId: tmdbMovie.id.toString(),
      title: tmdbMovie.title,
      originalTitle: tmdbMovie.original_title,
      type: 'movie',
      overview: tmdbMovie.overview,
      genres: tmdbMovie.genres || [],
      releaseDate: tmdbMovie.release_date ? new Date(tmdbMovie.release_date) : null,
      runtime: tmdbMovie.runtime,
      voteAverage: tmdbMovie.vote_average,
      voteCount: tmdbMovie.vote_count,
      popularity: tmdbMovie.popularity,
      adult: tmdbMovie.adult,
      language: tmdbMovie.original_language,
      poster: {
        path: tmdbMovie.poster_path,
        url: this.getImageURL(tmdbMovie.poster_path)
      },
      backdrop: {
        path: tmdbMovie.backdrop_path,
        url: this.getImageURL(tmdbMovie.backdrop_path, 'w1280')
      },
      cast: sanitizedCast,
      crew: sanitizedCrew,
      videos: tmdbMovie.videos?.results || [],
      trailers: tmdbMovie.videos?.results?.filter(video => 
        video.type === 'Trailer' && video.site === 'YouTube'
      ) || [],
      externalIds: tmdbMovie.external_ids || {},
      productionCompanies: tmdbMovie.production_companies || [],
      productionCountries: tmdbMovie.production_countries || [],
      spokenLanguages: tmdbMovie.spoken_languages || []
    };
  }

  transformTVData(tmdbTV) {
    // Sanitize seasons: remove/rename id to avoid Mongoose _id conflict
    const sanitizedSeasons = (tmdbTV.seasons || []).map(season => {
      // Remove id or rename it to tmdbSeasonId
      const { id, ...rest } = season;
      return {
        ...rest,
        tmdbSeasonId: id // keep the original TMDB id if needed
      };
    });

    // Sanitize cast: remove id to avoid conflicts
    const sanitizedCast = (tmdbTV.credits?.cast?.slice(0, 20) || []).map(person => {
      const { id, ...rest } = person;
      return {
        ...rest,
        tmdbPersonId: id
      };
    });

    // Sanitize crew: remove id to avoid conflicts
    const sanitizedCrew = (tmdbTV.credits?.crew?.slice(0, 10) || []).map(person => {
      const { id, ...rest } = person;
      return {
        ...rest,
        tmdbPersonId: id
      };
    });

    return {
      tmdbId: tmdbTV.id.toString(),
      title: tmdbTV.name,
      originalTitle: tmdbTV.original_name,
      type: 'tv',
      overview: tmdbTV.overview,
      genres: tmdbTV.genres || [],
      releaseDate: tmdbTV.first_air_date ? new Date(tmdbTV.first_air_date) : null,
      runtime: tmdbTV.episode_run_time?.[0],
      voteAverage: tmdbTV.vote_average,
      voteCount: tmdbTV.vote_count,
      popularity: tmdbTV.popularity,
      adult: tmdbTV.adult || false,
      language: tmdbTV.original_language,
      poster: {
        path: tmdbTV.poster_path,
        url: this.getImageURL(tmdbTV.poster_path)
      },
      backdrop: {
        path: tmdbTV.backdrop_path,
        url: this.getImageURL(tmdbTV.backdrop_path, 'w1280')
      },
      seasons: sanitizedSeasons, // use sanitized array
      cast: sanitizedCast,
      crew: sanitizedCrew,
      videos: tmdbTV.videos?.results || [],
      trailers: tmdbTV.videos?.results?.filter(video => 
        video.type === 'Trailer' && video.site === 'YouTube'
      ) || [],
      externalIds: tmdbTV.external_ids || {},
      productionCompanies: tmdbTV.production_companies || [],
      productionCountries: tmdbTV.production_countries || [],
      spokenLanguages: tmdbTV.spoken_languages || []
    };
  }
}

module.exports = new TMDBService();

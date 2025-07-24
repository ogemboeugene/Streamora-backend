const radioBrowser = require('radio-browser');
const NodeCache = require('node-cache');

// Create cache with 5 minute TTL
const cache = new NodeCache({ stdTTL: 300 });

// Rate limiting
const rateLimiter = {
  requests: 0,
  lastReset: Date.now(),
  maxRequests: 100, // per minute
  resetInterval: 60000 // 1 minute
};

// Set user agent for Radio Browser API
radioBrowser.service_url = 'https://de1.api.radio-browser.info';

// Rate limiting helper
function checkRateLimit() {
  const now = Date.now();
  if (now - rateLimiter.lastReset > rateLimiter.resetInterval) {
    rateLimiter.requests = 0;
    rateLimiter.lastReset = now;
  }
  
  if (rateLimiter.requests >= rateLimiter.maxRequests) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  rateLimiter.requests++;
}

// Helper to filter stations with valid stream URLs
function filterValidStations(stations) {
  return stations.filter(station => 
    station.url_resolved && 
    station.url_resolved.trim() !== '' && 
    station.url_resolved !== 'null' &&
    !station.url_resolved.includes('null')
  );
}

// Helper to add stream quality indicator
function addStreamQuality(stations) {
  return stations.map(station => ({
    ...station,
    quality: station.bitrate > 128 ? 'high' : station.bitrate > 64 ? 'medium' : 'low',
    streamUrl: station.url_resolved
  }));
}

class RadioBrowserService {
  // Get popular stations
  async getPopularStations(limit = 50) {
    try {
      checkRateLimit();
      
      const cacheKey = `popular_stations_${limit}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      console.log('Fetching popular stations from Radio Browser API...');
      
      const stations = await radioBrowser.getStations({
        order: 'clickcount',
        reverse: true,
        limit: limit * 2, // Get more to filter out invalid ones
        hidebroken: true
      });

      const validStations = filterValidStations(stations);
      const qualityStations = addStreamQuality(validStations.slice(0, limit));
      
      cache.set(cacheKey, qualityStations);
      console.log(`Retrieved ${qualityStations.length} popular stations`);
      
      return qualityStations;
    } catch (error) {
      console.error('Error fetching popular stations:', error);
      throw new Error('Failed to fetch popular radio stations');
    }
  }

  // Get stations by country
  async getStationsByCountry(country = 'US', limit = 50) {
    try {
      checkRateLimit();
      
      const cacheKey = `country_stations_${country}_${limit}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      console.log(`Fetching stations for country: ${country}...`);
      
      const stations = await radioBrowser.getStations({
        countrycode: country.toUpperCase(),
        order: 'clickcount',
        reverse: true,
        limit: limit * 2,
        hidebroken: true
      });

      const validStations = filterValidStations(stations);
      const qualityStations = addStreamQuality(validStations.slice(0, limit));
      
      cache.set(cacheKey, qualityStations);
      console.log(`Retrieved ${qualityStations.length} stations for ${country}`);
      
      return qualityStations;
    } catch (error) {
      console.error(`Error fetching stations for country ${country}:`, error);
      throw new Error(`Failed to fetch radio stations for ${country}`);
    }
  }

  // Get stations by genre/tag
  async getStationsByGenre(genre, limit = 50) {
    try {
      checkRateLimit();
      
      const cacheKey = `genre_stations_${genre}_${limit}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      console.log(`Fetching stations for genre: ${genre}...`);
      
      const stations = await radioBrowser.getStations({
        tag: genre,
        order: 'clickcount',
        reverse: true,
        limit: limit * 2,
        hidebroken: true
      });

      const validStations = filterValidStations(stations);
      const qualityStations = addStreamQuality(validStations.slice(0, limit));
      
      cache.set(cacheKey, qualityStations);
      console.log(`Retrieved ${qualityStations.length} stations for genre ${genre}`);
      
      return qualityStations;
    } catch (error) {
      console.error(`Error fetching stations for genre ${genre}:`, error);
      throw new Error(`Failed to fetch radio stations for genre ${genre}`);
    }
  }

  // Search stations
  async searchStations(query, limit = 50) {
    try {
      checkRateLimit();
      
      const cacheKey = `search_stations_${query}_${limit}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      console.log(`Searching stations for: ${query}...`);
      
      const stations = await radioBrowser.searchStations({
        name: query,
        order: 'clickcount',
        reverse: true,
        limit: limit * 2,
        hidebroken: true
      });

      const validStations = filterValidStations(stations);
      const qualityStations = addStreamQuality(validStations.slice(0, limit));
      
      cache.set(cacheKey, qualityStations);
      console.log(`Found ${qualityStations.length} stations matching "${query}"`);
      
      return qualityStations;
    } catch (error) {
      console.error(`Error searching stations for ${query}:`, error);
      throw new Error(`Failed to search radio stations for ${query}`);
    }
  }

  // Get station details
  async getStationDetails(stationId) {
    try {
      checkRateLimit();
      
      const cacheKey = `station_details_${stationId}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      console.log(`Fetching details for station: ${stationId}...`);
      
      const stations = await radioBrowser.getStations({
        stationuuid: stationId
      });
      
      if (!stations || stations.length === 0) {
        throw new Error('Station not found');
      }
      
      const station = stations[0];
      
      if (!station.url_resolved || station.url_resolved === 'null') {
        throw new Error('Station has invalid stream URL');
      }

      const stationWithQuality = addStreamQuality([station])[0];
      
      cache.set(cacheKey, stationWithQuality);
      console.log(`Retrieved details for station: ${station.name}`);
      
      return stationWithQuality;
    } catch (error) {
      console.error(`Error fetching station details for ${stationId}:`, error);
      throw new Error(`Failed to fetch station details for ${stationId}`);
    }
  }

  // Get stream URL for a station
  async getStreamUrl(stationId) {
    try {
      const station = await this.getStationDetails(stationId);
      return {
        streamUrl: station.url_resolved,
        quality: station.quality,
        bitrate: station.bitrate
      };
    } catch (error) {
      console.error(`Error getting stream URL for station ${stationId}:`, error);
      throw new Error(`Failed to get stream URL for station ${stationId}`);
    }
  }

  // Track station click (for analytics)
  async clickStation(stationId) {
    try {
      checkRateLimit();
      
      console.log(`Recording click for station: ${stationId}...`);
      
      // Send click to Radio Browser API
      await radioBrowser.clickStation(stationId);
      
      console.log(`Click recorded for station: ${stationId}`);
      
      return { success: true };
    } catch (error) {
      console.error(`Error recording click for station ${stationId}:`, error);
      // Don't throw error for click tracking failures
      return { success: false, error: error.message };
    }
  }

  // Get available countries
  async getCountries() {
    try {
      checkRateLimit();
      
      const cacheKey = 'countries';
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      console.log('Fetching available countries...');
      
      const countries = await radioBrowser.getCountries();
      
      cache.set(cacheKey, countries, 3600); // Cache for 1 hour
      console.log(`Retrieved ${countries.length} countries`);
      
      return countries;
    } catch (error) {
      console.error('Error fetching countries:', error);
      throw new Error('Failed to fetch available countries');
    }
  }

  // Get available genres/tags
  async getGenres() {
    try {
      checkRateLimit();
      
      const cacheKey = 'genres';
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      console.log('Fetching available genres...');
      
      const tags = await radioBrowser.getTags();
      
      // Filter and sort popular genres
      const popularGenres = tags
        .filter(tag => tag.stationcount > 10)
        .sort((a, b) => b.stationcount - a.stationcount)
        .slice(0, 50);
      
      cache.set(cacheKey, popularGenres, 3600); // Cache for 1 hour
      console.log(`Retrieved ${popularGenres.length} popular genres`);
      
      return popularGenres;
    } catch (error) {
      console.error('Error fetching genres:', error);
      throw new Error('Failed to fetch available genres');
    }
  }

  // Health check
  async healthCheck() {
    try {
      const stats = await radioBrowser.getServerStats();
      return {
        status: 'healthy',
        serverStats: stats,
        cacheKeys: cache.keys().length,
        rateLimitRemaining: rateLimiter.maxRequests - rateLimiter.requests
      };
    } catch (error) {
      console.error('Radio Browser API health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        cacheKeys: cache.keys().length,
        rateLimitRemaining: rateLimiter.maxRequests - rateLimiter.requests
      };
    }
  }

  // Clear cache
  clearCache() {
    cache.flushAll();
    console.log('Radio Browser cache cleared');
    return { success: true, message: 'Cache cleared successfully' };
  }
}

module.exports = new RadioBrowserService();

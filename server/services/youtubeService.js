const axios = require('axios');

class YouTubeService {
  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY;
    this.baseURL = 'https://www.googleapis.com/youtube/v3';
  }

  // Helper method to make API requests
  async makeRequest(endpoint, params = {}) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params: {
          key: this.apiKey,
          ...params
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`YouTube API Error for ${endpoint}:`, error.message);
      throw new Error(`YouTube API request failed: ${error.message}`);
    }
  }

  // Search for videos
  async searchVideos(query, maxResults = 25, type = 'video') {
    return await this.makeRequest('/search', {
      part: 'snippet',
      q: query,
      type,
      maxResults,
      order: 'relevance',
      safeSearch: 'moderate'
    });
  }

  // Search for movie trailers
  async searchMovieTrailer(movieTitle, year = null) {
    const searchQuery = `${movieTitle}${year ? ` ${year}` : ''} official trailer`;
    
    try {
      const response = await this.searchVideos(searchQuery, 5);
      
      // Filter results to find the best match
      const trailers = response.items.filter(item => {
        const title = item.snippet.title.toLowerCase();
        return title.includes('trailer') || title.includes('official');
      });

      return trailers.length > 0 ? trailers : response.items;
    } catch (error) {
      console.error('Error searching movie trailer:', error);
      return [];
    }
  }

  // Search for TV show trailers
  async searchTVTrailer(showTitle, season = null) {
    const searchQuery = `${showTitle}${season ? ` season ${season}` : ''} official trailer`;
    
    try {
      const response = await this.searchVideos(searchQuery, 5);
      
      const trailers = response.items.filter(item => {
        const title = item.snippet.title.toLowerCase();
        return title.includes('trailer') || title.includes('official');
      });

      return trailers.length > 0 ? trailers : response.items;
    } catch (error) {
      console.error('Error searching TV trailer:', error);
      return [];
    }
  }

  // Get video details
  async getVideoDetails(videoId) {
    return await this.makeRequest('/videos', {
      part: 'snippet,contentDetails,statistics,status',
      id: videoId
    });
  }

  // Get channel details
  async getChannelDetails(channelId) {
    return await this.makeRequest('/channels', {
      part: 'snippet,contentDetails,statistics',
      id: channelId
    });
  }

  // Search for free movies (public domain, creative commons)
  async searchFreeMovies(query, maxResults = 25) {
    const searchQuery = `${query} full movie free public domain creative commons`;
    
    try {
      const response = await this.searchVideos(searchQuery, maxResults);
      
      // Filter for longer videos (likely full movies)
      const movies = response.items.filter(item => {
        const title = item.snippet.title.toLowerCase();
        return (
          title.includes('full movie') ||
          title.includes('complete movie') ||
          title.includes('entire movie')
        ) && !title.includes('trailer');
      });

      return movies;
    } catch (error) {
      console.error('Error searching free movies:', error);
      return [];
    }
  }

  // Get video embed URL
  getEmbedURL(videoId, options = {}) {
    const params = new URLSearchParams({
      autoplay: options.autoplay ? '1' : '0',
      controls: options.showControls !== false ? '1' : '0',
      rel: '0',
      modestbranding: '1',
      fs: '1',
      cc_load_policy: options.subtitles ? '1' : '0',
      iv_load_policy: '3',
      ...options.params
    });

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }

  // Get video thumbnail URL
  getThumbnailURL(videoId, quality = 'maxresdefault') {
    return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
  }

  // Extract video ID from various YouTube URL formats
  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  // Transform YouTube data to our content format
  transformVideoData(youtubeVideo, contentType = 'movie') {
    const videoId = youtubeVideo.id?.videoId || youtubeVideo.id;
    
    return {
      provider: 'youtube',
      url: this.getEmbedURL(videoId),
      quality: 'auto',
      type: 'embed',
      language: 'en',
      isActive: true,
      metadata: {
        videoId,
        title: youtubeVideo.snippet.title,
        description: youtubeVideo.snippet.description,
        publishedAt: youtubeVideo.snippet.publishedAt,
        channelTitle: youtubeVideo.snippet.channelTitle,
        thumbnails: youtubeVideo.snippet.thumbnails
      }
    };
  }

  // Check if video is available and embeddable
  async isVideoEmbeddable(videoId) {
    try {
      const response = await this.getVideoDetails(videoId);
      const video = response.items?.[0];
      
      if (!video) return false;
      
      return video.status.embeddable && !video.status.privacyStatus === 'private';
    } catch (error) {
      console.error('Error checking video embeddability:', error);
      return false;
    }
  }

  // Get popular free movies from specific channels
  async getPopularFreeMovies(maxResults = 50) {
    const freeMovieChannels = [
      'UCF0RqkPKVVnPS3HoMmph4EQ', // Crackle
      'UC_7Qz5KeNjNRcIaXK7Uw8SQ', // Tubi TV
      'UCEEhKWrQ4F5cT6jzAWKBRRQ'  // IMDb TV (example)
    ];

    const allMovies = [];

    for (const channelId of freeMovieChannels) {
      try {
        const response = await this.makeRequest('/search', {
          part: 'snippet',
          channelId,
          type: 'video',
          maxResults: Math.ceil(maxResults / freeMovieChannels.length),
          order: 'viewCount'
        });

        allMovies.push(...response.items);
      } catch (error) {
        console.error(`Error fetching from channel ${channelId}:`, error);
      }
    }

    return allMovies;
  }
}

module.exports = new YouTubeService();

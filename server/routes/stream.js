const express = require('express');
const Content = require('../models/Content');
const RadioStation = require('../models/RadioStation');
const youtubeService = require('../services/youtubeService');
const { optionalAuth } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Get streaming sources for content
router.get('/:type/:id/sources', optionalAuth, catchAsync(async (req, res) => {
  const { type, id } = req.params;

  if (!['movie', 'tv', 'radio'].includes(type)) {
    throw new AppError('Invalid content type', 400);
  }

  try {
    let sources = [];

    if (type === 'radio') {
      // Get radio station stream
      const station = await RadioStation.findById(id);
      if (!station) {
        throw new AppError('Radio station not found', 404);
      }

      sources = [{
        provider: 'radio',
        url: station.streamUrl,
        quality: 'auto',
        type: 'stream',
        language: station.language,
        isActive: station.isActive,
        metadata: {
          name: station.name,
          genre: station.genre,
          bitrate: station.bitrate,
          codec: station.codec
        }
      }];
    } else {
      // Get movie/TV content
      const content = await Content.findOne({ tmdbId: id, type });
      
      if (!content) {
        throw new AppError('Content not found', 404);
      }

      sources = content.getActiveSources();

      // If no sources available, try to find YouTube alternatives
      if (sources.length === 0) {
        try {
          let youtubeResults;
          
          if (type === 'movie') {
            youtubeResults = await youtubeService.searchFreeMovies(content.title);
          } else {
            youtubeResults = await youtubeService.searchTVTrailer(content.title);
          }

          if (youtubeResults.length > 0) {
            const youtubeSource = youtubeService.transformVideoData(youtubeResults[0]);
            sources.push(youtubeSource);
            
            // Save the source to content
            content.sources.push(youtubeSource);
            await content.save();
          }
        } catch (youtubeError) {
          console.error('YouTube search error:', youtubeError);
        }
      }
    }

    // Track view if user is logged in
    if (req.user && type !== 'radio') {
      const content = await Content.findOne({ tmdbId: id, type });
      if (content) {
        await content.incrementViews();
      }
    }

    res.json({
      success: true,
      data: {
        contentId: id,
        contentType: type,
        sources: sources.map(source => ({
          id: source._id || 'temp',
          provider: source.provider,
          url: source.url,
          quality: source.quality,
          type: source.type,
          language: source.language,
          subtitles: source.subtitles || [],
          metadata: source.metadata
        }))
      }
    });

  } catch (error) {
    console.error(`Error getting sources for ${type} ${id}:`, error);
    throw new AppError('Failed to get streaming sources', 500);
  }
}));

// Get video player embed URL
router.get('/:type/:id/player', optionalAuth, catchAsync(async (req, res) => {
  const { type, id } = req.params;
  const { sourceId, quality = 'auto', autoplay = false } = req.query;

  if (!['movie', 'tv', 'radio'].includes(type)) {
    throw new AppError('Invalid content type', 400);
  }

  try {
    let playerData;

    if (type === 'radio') {
      const station = await RadioStation.findById(id);
      if (!station) {
        throw new AppError('Radio station not found', 404);
      }

      playerData = {
        type: 'audio',
        url: station.streamUrl,
        title: station.name,
        poster: station.logo,
        metadata: {
          genre: station.genre,
          country: station.country,
          bitrate: station.bitrate
        }
      };
    } else {
      const content = await Content.findOne({ tmdbId: id, type });
      if (!content) {
        throw new AppError('Content not found', 404);
      }

      const sources = content.getActiveSources();
      if (sources.length === 0) {
        throw new AppError('No streaming sources available', 404);
      }

      let selectedSource;
      if (sourceId) {
        selectedSource = sources.find(s => s._id.toString() === sourceId);
      } else {
        selectedSource = sources[0]; // Default to first source
      }

      if (!selectedSource) {
        throw new AppError('Selected source not found', 404);
      }

      // Generate player URL based on provider
      let playerUrl = selectedSource.url;
      
      if (selectedSource.provider === 'youtube') {
        const videoId = youtubeService.extractVideoId(selectedSource.url);
        if (videoId) {
          playerUrl = youtubeService.getEmbedURL(videoId, {
            autoplay: autoplay === 'true',
            showControls: true,
            subtitles: true
          });
        }
      }

      playerData = {
        type: 'video',
        url: playerUrl,
        title: content.title,
        poster: content.poster?.url,
        backdrop: content.backdrop?.url,
        duration: content.runtime,
        subtitles: selectedSource.subtitles || [],
        metadata: {
          year: content.year,
          rating: content.voteAverage,
          genres: content.genres,
          overview: content.overview
        }
      };

      // Increment view count
      await content.incrementViews();
    }

    // Add to user's watch history if logged in
    if (req.user && type !== 'radio') {
      await req.user.addToWatchHistory({
        contentId: id,
        contentType: type,
        title: playerData.title,
        poster: playerData.poster
      });
    }

    res.json({
      success: true,
      data: playerData
    });

  } catch (error) {
    console.error(`Error getting player for ${type} ${id}:`, error);
    throw new AppError('Failed to get player data', 500);
  }
}));

// Update watch progress
router.post('/:type/:id/progress', optionalAuth, catchAsync(async (req, res) => {
  const { type, id } = req.params;
  const { progress, duration, currentTime } = req.body;

  if (!req.user) {
    return res.json({
      success: true,
      message: 'Progress not saved (user not logged in)'
    });
  }

  if (type === 'radio') {
    return res.json({
      success: true,
      message: 'Progress tracking not applicable for radio'
    });
  }

  try {
    // Update user's watch history
    const historyItem = req.user.watchHistory.find(item => item.contentId === id);
    if (historyItem) {
      historyItem.progress = progress;
      historyItem.duration = duration;
      historyItem.watchedAt = new Date();
    } else {
      // Get content details for new history entry
      const content = await Content.findOne({ tmdbId: id, type });
      if (content) {
        await req.user.addToWatchHistory({
          contentId: id,
          contentType: type,
          title: content.title,
          poster: content.poster?.url,
          progress,
          duration
        });
      }
    }

    await req.user.save();

    res.json({
      success: true,
      message: 'Watch progress updated',
      data: {
        progress,
        currentTime,
        duration
      }
    });

  } catch (error) {
    console.error('Error updating progress:', error);
    // Don't throw error for progress updates
    res.json({
      success: false,
      message: 'Failed to update progress'
    });
  }
}));

// Get subtitles for content
router.get('/:type/:id/subtitles', catchAsync(async (req, res) => {
  const { type, id } = req.params;
  const { language = 'en' } = req.query;

  if (type === 'radio') {
    return res.json({
      success: true,
      data: []
    });
  }

  try {
    const content = await Content.findOne({ tmdbId: id, type });
    if (!content) {
      throw new AppError('Content not found', 404);
    }

    const subtitles = [];
    
    // Collect subtitles from all sources
    content.sources.forEach(source => {
      if (source.subtitles && source.subtitles.length > 0) {
        source.subtitles.forEach(subtitle => {
          if (!language || subtitle.language === language) {
            subtitles.push({
              language: subtitle.language,
              label: subtitle.label,
              url: subtitle.url,
              provider: source.provider
            });
          }
        });
      }
    });

    res.json({
      success: true,
      data: subtitles
    });

  } catch (error) {
    console.error('Error getting subtitles:', error);
    res.json({
      success: true,
      data: []
    });
  }
}));

// Report streaming issue
router.post('/:type/:id/report', optionalAuth, catchAsync(async (req, res) => {
  const { type, id } = req.params;
  const { issue, description, sourceId } = req.body;

  // In a real app, this would save to a reports collection
  console.log('Streaming issue reported:', {
    contentType: type,
    contentId: id,
    sourceId,
    issue,
    description,
    userId: req.user?.id,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Issue reported successfully. Thank you for your feedback!'
  });
}));

// Get streaming statistics
router.get('/stats', catchAsync(async (req, res) => {
  try {
    const stats = {
      totalContent: await Content.countDocuments({ status: 'active' }),
      totalRadioStations: await RadioStation.countDocuments({ isActive: true }),
      totalViews: await Content.aggregate([
        { $group: { _id: null, total: { $sum: '$views' } } }
      ]).then(result => result[0]?.total || 0),
      topContent: await Content.find({ status: 'active' })
        .sort({ views: -1 })
        .limit(10)
        .select('title type views poster'),
      topRadioStations: await RadioStation.find({ isActive: true })
        .sort({ listeners: -1 })
        .limit(10)
        .select('name genre listeners country logo')
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting streaming stats:', error);
    res.json({
      success: true,
      data: {
        totalContent: 0,
        totalRadioStations: 0,
        totalViews: 0,
        topContent: [],
        topRadioStations: []
      }
    });
  }
}));

module.exports = router;

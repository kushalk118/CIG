const express = require('express');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./auth');
const upload = require('../middleware/upload');
const { saveFile } = require('../utils/storage');
const prisma = new PrismaClient();
const router = express.Router();

// Helper to notify via Socket.io
const sendNotification = (req, recipientId, type, message, mediaId) => {
  const io = req.app.get('io');
  if (io && req.user) {
    // Save to DB
    prisma.notification.create({
      data: {
        type,
        message,
        userId: parseInt(recipientId),
        triggerUserId: req.user.id,
        mediaId: mediaId ? parseInt(mediaId) : null
      }
    }).then(notif => {
      // Emit real-time event
      io.to(`user_${recipientId}`).emit('notification', {
        id: notif.id,
        type,
        message,
        createdAt: notif.createdAt,
        isRead: false,
        triggerUser: { id: req.user.id, name: req.user.name },
        mediaId
      });
    }).catch(err => console.error('Failed to create notification:', err));
  }
};

// Get all media (filtered by tags, event, and access control)
router.get('/', async (req, res) => {
  const { eventId, tag, isPrivate } = req.query;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let user = null;

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      user = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-123');
    } catch (err) {}
  }

  try {
    let whereClause = {};

    // Access control:
    // If not logged in, or logged in as VIEWER, only show public media items
    // and only media from public events.
    if (!user || user.role === 'VIEWER') {
      whereClause.isPrivate = false;
      whereClause.event = { isPrivate: false };
    }

    if (eventId) {
      whereClause.eventId = parseInt(eventId);
    }

    const mediaList = await prisma.media.findMany({
      where: whereClause,
      include: {
        uploader: {
          select: { id: true, name: true, role: true }
        },
        event: {
          select: { id: true, name: true, isPrivate: true, clubName: true }
        },
        likes: {
          select: { userId: true }
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true }
            }
          }
        }
      },
      orderBy: { uploadDate: 'desc' }
    });

    // Client-side like filter / tag filter
    let filtered = mediaList;
    if (tag) {
      filtered = mediaList.filter(item => {
        const itemTags = item.tags.toLowerCase().split(',').map(t => t.trim());
        return itemTags.includes(tag.toLowerCase());
      });
    }

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Server error retrieving media: ' + error.message });
  }
});

// Bulk upload route
router.post('/upload', authenticateToken, upload.array('files', 20), async (req, res) => {
  const { eventId, isPrivate, tags, faceMarkersList } = req.body;
  if (!eventId) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    const event = await prisma.event.findUnique({ where: { id: parseInt(eventId) } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const isMediaPrivate = isPrivate === 'true' || isPrivate === true;

    // Optional tags list
    const mediaTags = tags || 'event,media';

    // Parse faceMarkersList (e.g. face markers for each file in order)
    let parsedFaceMarkers = [];
    if (faceMarkersList) {
      try {
        parsedFaceMarkers = JSON.parse(faceMarkersList);
      } catch (err) {
        console.error('Failed to parse face markers list:', err);
      }
    }

    const createdMedia = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const fileUrl = await saveFile(file);
      
      // Face markers matching this file index
      const markers = parsedFaceMarkers[i] ? JSON.stringify(parsedFaceMarkers[i]) : null;

      const media = await prisma.media.create({
        data: {
          filename: file.originalname,
          fileUrl,
          fileType: file.mimetype,
          size: file.size,
          isPrivate: isMediaPrivate,
          tags: mediaTags,
          faceMarkers: markers,
          eventId: parseInt(eventId),
          uploaderId: req.user.id
        }
      });
      createdMedia.push(media);
    }

    res.status(201).json({ success: true, count: createdMedia.length, media: createdMedia });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Toggle Like
router.post('/:id/like', authenticateToken, async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: { uploader: true }
    });
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const existingLike = await prisma.like.findUnique({
      where: { mediaId_userId: { mediaId, userId } }
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: { mediaId_userId: { mediaId, userId } }
      });
      res.json({ liked: false });
    } else {
      // Like
      await prisma.like.create({
        data: { mediaId, userId }
      });

      // Send real-time notification to uploader
      if (media.uploaderId !== userId) {
        sendNotification(
          req,
          media.uploaderId,
          'LIKE',
          `${req.user.name} liked your photo in event "${media.filename}"`,
          media.id
        );
      }
      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Like operation failed: ' + error.message });
  }
});

// Add Comment
router.post('/:id/comment', authenticateToken, async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Comment content is required' });

  try {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: { uploader: true }
    });
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const comment = await prisma.comment.create({
      data: {
        content,
        mediaId,
        userId: req.user.id
      },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true }
        }
      }
    });

    // Notify uploader
    if (media.uploaderId !== req.user.id) {
      sendNotification(
        req,
        media.uploaderId,
        'COMMENT',
        `${req.user.name} commented: "${content.substring(0, 30)}..."`,
        media.id
      );
    }

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment: ' + error.message });
  }
});

// Tag a User in media
router.post('/:id/tag', authenticateToken, async (req, res) => {
  const mediaId = parseInt(req.params.id);
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID to tag is required' });

  try {
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    });
    if (!media) return res.status(404).json({ error: 'Media not found' });

    // Send Tag Notification
    sendNotification(
      req,
      userId,
      'TAG',
      `${req.user.name} tagged you in a photo!`,
      media.id
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Tagging failed: ' + error.message });
  }
});

// Dynamic Watermark Download Route
router.get('/:id/download', async (req, res) => {
  const mediaId = parseInt(req.params.id);
  
  // Extract user info from query parameter if using token or treat as guest
  const token = req.query.token;
  let user = { name: 'Guest', role: 'Viewer' };
  
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-123');
      user = { name: decoded.name, role: decoded.role };
    } catch (err) {}
  }

  try {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: { event: true }
    });

    if (!media) return res.status(404).json({ error: 'Media not found' });

    // Build watermark text: Club Name - Event Name - Downloader Role
    const club = media.event.clubName || 'CIG';
    const eventName = media.event.name;
    const watermarkText = `© ${club} | ${eventName} | User: ${user.name} (${user.role})`;

    // Check if it's stored locally
    const isLocal = media.fileUrl.startsWith('/uploads/');
    let imagePath = '';
    
    if (isLocal) {
      imagePath = path.join(__dirname, '..', media.fileUrl);
    } else {
  const https = require('https');

  https.get(media.fileUrl, (response) => {
    const chunks = [];

    response.on('data', (chunk) => chunks.push(chunk));

    response.on('end', async () => {
  const sharp = require('sharp');

  const imageBuffer = Buffer.concat(chunks);

  const metadata = await sharp(imageBuffer).metadata();

  const width = metadata.width || 800;
  const height = metadata.height || 600;
  const fontSize = Math.max(16, Math.floor(width / 35));

  const svgText = `
    <svg width="${width}" height="${height}">
      <style>
        .watermark {
          fill: rgba(255,255,255,0.4);
          font-size: ${fontSize}px;
          font-family: Arial;
          font-weight: bold;
        }
        .bg {
          fill: rgba(0,0,0,0.25);
        }
      </style>

      <rect
        x="0"
        y="${height - fontSize * 2.5}"
        width="${width}"
        height="${fontSize * 2.5}"
        class="bg"
      />

      <text
        x="50%"
        y="${height - fontSize}"
        text-anchor="middle"
        class="watermark"
      >
        ${watermarkText}
      </text>
    </svg>
  `;

  const watermarkedBuffer = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svgText),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="watermarked_${media.filename}"`
  );

  res.setHeader('Content-Type', 'image/png');

  res.end(watermarkedBuffer);
});
  });

  return;
}

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Original file not found on server' });
    }

    // Check if sharp is installed and image is water-markable
    const sharp = require('sharp');
    const metadata = await sharp(imagePath).metadata();
    
    const width = metadata.width || 800;
    const height = metadata.height || 600;
    const fontSize = Math.max(16, Math.floor(width / 35));

    // Dynamic SVG overlay representing the watermark
    const svgText = `
      <svg width="${width}" height="${height}">
        <style>
          .watermark {
            fill: rgba(255, 255, 255, 0.4);
            font-size: ${fontSize}px;
            font-family: Arial, Helvetica, sans-serif;
            font-weight: bold;
          }
          .bg {
            fill: rgba(0, 0, 0, 0.25);
          }
        </style>
        <rect x="0" y="${height - fontSize * 2.5}" width="${width}" height="${fontSize * 2.5}" class="bg"/>
        <text x="50%" y="${height - fontSize}" text-anchor="middle" class="watermark">${watermarkText}</text>
      </svg>
    `;

    // Process image with Sharp and stream it back
    res.setHeader('Content-Disposition', `attachment; filename="watermarked_${media.filename}"`);
    res.setHeader('Content-Type', media.fileType);

    sharp(imagePath)
      .composite([{
        input: Buffer.from(svgText),
        top: 0,
        left: 0
      }])
      .png() // Fallback format, or matching original
      .pipe(res);

  } catch (error) {
    console.error('[Watermark Error] sharp watermark failed, falling back to direct download:', error);
    // If watermark fails, redirect to direct file url
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (media) {

      return res.redirect(media.fileUrl);
    }
    res.status(500).json({ error: 'Download failed: ' + error.message });
  }
});

module.exports = router;

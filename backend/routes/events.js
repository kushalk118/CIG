const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('./auth');
const prisma = new PrismaClient();
const router = express.Router();

// Get list of events (with filtering & sorting)
router.get('/', async (req, res) => {
  // If user is authenticated, we extract their role to check private events
  // Otherwise, they are treated as a guest and can only see public events.
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let user = null;
  
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      user = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-123');
    } catch (err) {
      // Invalid token, ignore and treat as public viewer
    }
  }

  const { search, category, sort } = req.query;

  try {
    let whereClause = {};

    // Access control: if guest or role is VIEWER, they only see public events.
    // If role is ADMIN, PHOTOGRAPHER, or CLUB_MEMBER, they can see private events too.
    if (!user || user.role === 'VIEWER') {
      whereClause.isPrivate = false;
    }

    // Filters
    if (category) {
      whereClause.category = category;
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }

    // Sorting
    let orderBy = { date: 'desc' }; // default
    if (sort === 'name') {
      orderBy = { name: 'asc' };
    } else if (sort === 'date_asc') {
      orderBy = { date: 'asc' };
    } else if (sort === 'category') {
      orderBy = { category: 'asc' };
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy,
      include: {
        creator: {
          select: { id: true, name: true, role: true }
        },
        _count: {
          select: { mediaItems: true }
        }
      }
    });

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching events: ' + error.message });
  }
});

// Create Event - ADMIN and PHOTOGRAPHER only
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'PHOTOGRAPHER'), async (req, res) => {
  const { name, description, date, category, isPrivate, clubName } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'Event name and category are required' });
  }

  try {
    const event = await prisma.event.create({
      data: {
        name,
        description,
        date: date ? new Date(date) : new Date(),
        category,
        isPrivate: isPrivate === true || isPrivate === 'true',
        clubName: clubName || 'CIG',
        creatorId: req.user.id
      }
    });
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: 'Server error creating event: ' + error.message });
  }
});

// Get Event by ID with its media
router.get('/:id', async (req, res) => {
  const eventId = parseInt(req.params.id);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid Event ID' });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let user = null;
  
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      user = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-123');
    } catch (err) {
      // Invalid token, ignore
    }
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        creator: {
          select: { id: true, name: true, role: true }
        },
        mediaItems: {
          orderBy: { uploadDate: 'desc' },
          include: {
            uploader: {
              select: { id: true, name: true, role: true }
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
          }
        }
      }
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Access control check
    if (event.isPrivate) {
      if (!user || user.role === 'VIEWER') {
        return res.status(403).json({ error: 'Access denied: private event' });
      }
    }

    res.json(event);
  } catch (error) {
    res.status(500).json({ error: 'Server error retrieving event details: ' + error.message });
  }
});

module.exports = router;

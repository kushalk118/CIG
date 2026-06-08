const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Middleware to authorize roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

// Register Route
router.post('/signup', async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'All fields (email, password, name) are required' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Limit roles to avoid exploit, but default is VIEWER
    const userRole = ['ADMIN', 'PHOTOGRAPHER', 'CLUB_MEMBER', 'VIEWER'].includes(role) ? role : 'VIEWER';

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: userRole
      }
    });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during signup: ' + error.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        referenceSelfieUrl: user.referenceSelfieUrl
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login: ' + error.message });
  }
});

// Get Current User Profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      referenceSelfieUrl: user.referenceSelfieUrl
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching profile: ' + error.message });
  }
});

// Update Reference Selfie (for facial recognition)
router.post('/selfie', authenticateToken, async (req, res) => {
  const { referenceSelfieUrl } = req.body;
  if (!referenceSelfieUrl) {
    return res.status(400).json({ error: 'Selfie URL is required' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { referenceSelfieUrl }
    });
    res.json({ success: true, referenceSelfieUrl: updatedUser.referenceSelfieUrl });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating reference selfie: ' + error.message });
  }
});

// Get all users (useful for user tagging)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching users: ' + error.message });
  }
});

module.exports = {
  router,
  authenticateToken,
  authorizeRoles
};

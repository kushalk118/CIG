const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins for development ease
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Pass Socket.io instance to requests
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Serve local uploads folder statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Socket.io Real-Time Connection
io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);

  // Authenticate socket and join room based on user ID
  socket.on('join', (userId) => {
    if (userId) {
      const room = `user_${userId}`;
      socket.join(room);
      console.log(`[Socket] User ${userId} joined room ${room}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Client disconnected:', socket.id);
  });
});

// Import routes
const { router: authRouter } = require('./routes/auth');
const eventRouter = require('./routes/events');
const mediaRouter = require('./routes/media');
const notificationRouter = require('./routes/notifications');

// Register API routes
app.use('/api/auth', authRouter);
app.use('/api/events', eventRouter);
app.use('/api/media', mediaRouter);
app.use('/api/notifications', notificationRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', database: 'connected', time: new Date() });
});

// Seed default accounts and sample data if database is empty
const seedDatabase = async () => {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[Seeder] Empty database detected. Seeding default users and events...');

      // Seed Users
      const adminPass = await bcrypt.hash('adminpassword', 10);
      const photoPass = await bcrypt.hash('photopassword', 10);
      const memberPass = await bcrypt.hash('memberpassword', 10);
      const viewerPass = await bcrypt.hash('viewerpassword', 10);

      const admin = await prisma.user.create({
        data: { email: 'admin@cig.com', password: adminPass, name: 'CIG Admin', role: 'ADMIN' }
      });
      const photographer = await prisma.user.create({
        data: { email: 'photo@cig.com', password: photoPass, name: 'Kushal (Photographer)', role: 'PHOTOGRAPHER' }
      });
      const member = await prisma.user.create({
        data: { email: 'member@cig.com', password: memberPass, name: 'Sarah (Club Member)', role: 'CLUB_MEMBER' }
      });
      const viewer = await prisma.user.create({
        data: { email: 'viewer@cig.com', password: viewerPass, name: 'John Doe (Viewer)', role: 'VIEWER' }
      });

      console.log('[Seeder] Users created successfully!');

      // Seed Events
      const photoshoot = await prisma.event.create({
        data: {
          name: 'Spring Photoshoot 2026',
          description: 'A beautiful outdoor photoshoot showcasing nature and sports themes.',
          category: 'photoshoot',
          isPrivate: false,
          clubName: 'Creative Imagery Group',
          creatorId: photographer.id,
          date: new Date('2026-04-15')
        }
      });

      const workshop = await prisma.event.create({
        data: {
          name: 'AI & Computational Photography',
          description: 'Hands-on workshop covering smart image tagging, enhancement, and face models.',
          category: 'workshop',
          isPrivate: false,
          clubName: 'CIG Tech Club',
          creatorId: admin.id,
          date: new Date('2026-05-20')
        }
      });

      const trip = await prisma.event.create({
        data: {
          name: 'Executive Committee Mountain Retreat',
          description: 'Private retreat for club organizers and leaders. Strictly confidential media.',
          category: 'trip',
          isPrivate: true,
          clubName: 'CIG Leadership',
          creatorId: admin.id,
          date: new Date('2026-06-01')
        }
      });

      console.log('[Seeder] Sample events created successfully!');
    }
  } catch (err) {
    console.error('[Seeder] Error seeding database:', err);
  }
};

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`[Server] Express server running on port ${PORT}`);
  await seedDatabase();
});

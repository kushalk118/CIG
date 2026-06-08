const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./auth');
const prisma = new PrismaClient();
const router = express.Router();

// Get notification checklist for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        triggerUser: {
          select: { id: true, name: true, avatarUrl: true }
        },
        media: {
          select: { id: true, fileUrl: true, filename: true }
        }
      }
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Server error retrieving notifications: ' + error.message });
  }
});

// Mark single notification as read
router.post('/:id/read', authenticateToken, async (req, res) => {
  const notifId = parseInt(req.params.id);
  try {
    const notif = await prisma.notification.findUnique({ where: { id: notifId } });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read: ' + error.message });
  }
});

// Mark all notifications as read
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read: ' + error.message });
  }
});

module.exports = router;

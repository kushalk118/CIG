import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Bell, Check, Heart, MessageSquare, UserPlus, Image as ImageIcon } from 'lucide-react';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = async () => {
    try {
      const data = await api.get('/notifications');
      setNotifications(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'LIKE':
        return <Heart size={16} color="#ec4899" fill="#ec4899" />;
      case 'COMMENT':
        return <MessageSquare size={16} color="#3b82f6" fill="#3b82f6" />;
      case 'TAG':
        return <UserPlus size={16} color="#8b5cf6" />;
      default:
        return <Bell size={16} color="#64748b" />;
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '0.25rem' }}>Notifications</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Stay updated with likes, comments, and tagging activity</p>
        </div>
        {notifications.some(n => !n.isRead) && (
          <button onClick={markAllAsRead} className="glow-btn" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <Check size={16} /> Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading notifications...</div>
      ) : error ? (
        <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem' }}>{error}</div>
      ) : notifications.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid var(--glass-border)' }}>
            <Bell size={24} color="var(--text-muted)" />
          </div>
          <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>No Notifications Yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px', margin: '0 auto' }}>
            When photographers upload photos, or club members comment and like your photos, they will show up here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.isRead && markAsRead(notif.id)}
              className="glass-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                borderLeft: notif.isRead ? '1px solid var(--glass-border)' : '4px solid var(--color-primary)',
                background: notif.isRead ? 'var(--glass-bg)' : 'rgba(59, 130, 246, 0.04)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              <div style={{ background: 'rgba(255,255,255,0.03)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border)', flexShrink: 0 }}>
                {getIcon(notif.type)}
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: notif.isRead ? 'var(--text-secondary)' : '#fff', fontSize: '0.95rem', fontWeight: notif.isRead ? 400 : 500 }}>
                  {notif.message}
                </p>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'inline-block' }}>
                  {new Date(notif.createdAt).toLocaleString()}
                </span>
              </div>

              {notif.media && (
                <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--glass-border)', flexShrink: 0 }}>
                  <img
                    src={api.mediaUrl(notif.media.fileUrl)}
                    alt={notif.media.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UserCheck, Bell, LogOut, Camera, Image } from 'lucide-react';
import { api } from '../utils/api';
import io from 'socket.io-client';

export default function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Fetch initial notification count
    const fetchNotifications = async () => {
      try {
        const notifs = await api.get('/notifications');
        const unread = notifs.filter(n => !n.isRead).length;
        setUnreadCount(unread);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };
    fetchNotifications();

    // Setup Socket.io for real-time notifications
    const socket = io('https://cig-xiby.onrender.com');
    socket.emit('join', user.id);

    socket.on('notification', () => {
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    onLogout();
    navigate('/');
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'ADMIN': return 'badge-admin';
      case 'PHOTOGRAPHER': return 'badge-photographer';
      case 'CLUB_MEMBER': return 'badge-member';
      default: return 'badge-viewer';
    }
  };

  return (
    <aside className="sidebar">
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'var(--gradient-primary)', padding: '0.5rem', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}>
          <Camera size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>CIG Platform</h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Media Hub
          </span>
        </div>
      </div>

      {/* User Card */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--color-primary)', border: '1px solid var(--glass-border)' }}>
          {user.name ? user.name.charAt(0) : 'U'}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h4 style={{ fontSize: '0.85rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</h4>
          <span className={`badge ${getRoleBadgeClass(user.role)}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', marginTop: '0.25rem', display: 'inline-block' }}>
            {user.role}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        <NavLink
          to="/"
          className={({ isActive }) => `outline-btn ${isActive ? 'active-nav' : ''}`}
          style={({ isActive }) => ({
            justifyContent: 'flex-start',
            border: 'none',
            background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: isActive ? 600 : 500
          })}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </NavLink>

        <NavLink
          to="/face-discovery"
          className={({ isActive }) => `outline-btn ${isActive ? 'active-nav' : ''}`}
          style={({ isActive }) => ({
            justifyContent: 'flex-start',
            border: 'none',
            background: isActive ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
            color: isActive ? 'var(--color-secondary)' : 'var(--text-secondary)',
            fontWeight: isActive ? 600 : 500
          })}
        >
          <UserCheck size={18} />
          Face Discovery
        </NavLink>

        <NavLink
          to="/notifications"
          className={({ isActive }) => `outline-btn ${isActive ? 'active-nav' : ''}`}
          style={({ isActive }) => ({
            justifyContent: 'flex-start',
            border: 'none',
            background: isActive ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
            color: isActive ? 'var(--color-accent)' : 'var(--text-secondary)',
            fontWeight: isActive ? 600 : 500,
            position: 'relative'
          })}
        >
          <Bell size={18} />
          Notifications
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', right: '12px', background: 'var(--color-accent)', color: '#fff', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>
              {unreadCount}
            </span>
          )}
        </NavLink>
      </nav>

      {/* Logout Action */}
      <button
        onClick={handleLogout}
        className="outline-btn"
        style={{ border: 'none', color: '#ef4444', justifyContent: 'flex-start', background: 'transparent', marginTop: 'auto' }}
      >
        <LogOut size={18} />
        Log Out
      </button>
    </aside>
  );
}

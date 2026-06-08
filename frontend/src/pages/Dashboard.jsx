import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Plus, Search, Calendar, FolderOpen, Tag, Eye, EyeOff, ShieldAlert, ArrowUpDown, ChevronRight } from 'lucide-react';

export default function Dashboard({ user, onEventSelect }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('date_desc');

  // Modal create event state
  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    date: new Date().toISOString().substring(0, 10),
    category: 'photoshoot',
    isPrivate: false,
    clubName: 'Creative Imagery Group'
  });
  const [creating, setCreating] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const query = `?search=${search}&category=${category}&sort=${sort}`;
      const data = await api.get(`/events${query}`);
      setEvents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [search, category, sort]);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/events', newEvent);
      setShowModal(false);
      // Reset new event form
      setNewEvent({
        name: '',
        description: '',
        date: new Date().toISOString().substring(0, 10),
        category: 'photoshoot',
        isPrivate: false,
        clubName: 'Creative Imagery Group'
      });
      fetchEvents();
    } catch (err) {
      alert('Failed to create event: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const isUploader = user.role === 'ADMIN' || user.role === 'PHOTOGRAPHER';

  return (
    <div>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h2 style={{ fontSize: '2.2rem', color: '#fff', marginBottom: '0.25rem' }}>Event Albums</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Explore collections, search visual tags, and download watermarked assets</p>
        </div>
        {isUploader && (
          <button onClick={() => setShowModal(true)} className="glow-btn">
            <Plus size={18} /> Create Event
          </button>
        )}
      </div>

      {/* Filters & Search Bar */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '2rem', padding: '1rem' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="glass-input"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        {/* Category filter */}
        <div style={{ minWidth: '150px' }}>
          <select
            className="glass-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ background: 'var(--bg-secondary)', color: '#fff' }}
          >
            <option value="">All Categories</option>
            <option value="photoshoot">Photoshoots</option>
            <option value="workshop">Workshops</option>
            <option value="trip">Trips</option>
            <option value="party">Parties</option>
            <option value="fest">Cultural Fests</option>
          </select>
        </div>

        {/* Sort option */}
        <div style={{ minWidth: '150px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowUpDown size={16} color="var(--text-muted)" />
          <select
            className="glass-input"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{ background: 'var(--bg-secondary)', color: '#fff' }}
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="name">Alphabetical</option>
            <option value="category">Category</option>
          </select>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
          {error}
        </div>
      )}

      {/* Events Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
          <FolderOpen size={48} color="var(--text-muted)" style={{ marginBottom: '1.5rem' }} />
          <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>No Events Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Try refining your search filters or create a new event.
          </p>
        </div>
      ) : (
        <div className="grid-gallery">
          {events.map((event) => (
            <div
              key={event.id}
              className="glass-card"
              onClick={() => onEventSelect(event.id)}
              style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', height: '100%' }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <span className="tag" style={{ textTransform: 'capitalize' }}>
                  {event.category}
                </span>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {event.isPrivate ? (
                    <span className="badge badge-admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem' }}>
                      <EyeOff size={12} /> Private
                    </span>
                  ) : (
                    <span className="badge badge-member" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem' }}>
                      <Eye size={12} /> Public
                    </span>
                  )}
                </span>
              </div>

              {/* Title & Description */}
              <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>
                {event.name}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', flex: 1, marginBottom: '1.5rem', lineHeight: '1.4' }}>
                {event.description || 'No description provided.'}
              </p>

              {/* Card Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginTop: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={14} />
                  {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                  {event._count?.mediaItems || 0} Media
                  <ChevronRight size={14} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '2rem' }}>
            <h3 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '1.5rem' }}>Create Event Album</h3>
            
            <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Event Name</label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Annual Sports Day 2026"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Description</label>
                <textarea
                  className="glass-input"
                  placeholder="Tell us about the event..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Event Date</label>
                  <input
                    type="date"
                    className="glass-input"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Category</label>
                  <select
                    className="glass-input"
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                    style={{ background: 'var(--bg-secondary)', color: '#fff' }}
                  >
                    <option value="photoshoot">Photoshoot</option>
                    <option value="workshop">Workshop</option>
                    <option value="trip">Trip</option>
                    <option value="party">Party</option>
                    <option value="fest">Cultural Fest</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Organizing Club</label>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="e.g. CIG Photography"
                    value={newEvent.clubName}
                    onChange={(e) => setNewEvent({ ...newEvent, clubName: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Access Level</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={newEvent.isPrivate}
                      onChange={(e) => setNewEvent({ ...newEvent, isPrivate: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                    />
                    <span>Private Album</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="outline-btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="glow-btn" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Album'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

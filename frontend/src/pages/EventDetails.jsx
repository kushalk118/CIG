import React, { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api';
import { ArrowLeft, Upload, Heart, MessageSquare, Download, UserPlus, Eye, EyeOff, Calendar, X, Sparkles, Tag } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

export default function EventDetails({ eventId, user, onBack }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Upload states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [customTags, setCustomTags] = useState('event, photo');
  const fileInputRef = useRef(null);
  
  // Face API state
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [faceApiLoading, setFaceApiLoading] = useState(false);

  // Lightbox / Detail Modal state
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [selectedTagUser, setSelectedTagUser] = useState('');

  const loadFaceApiModels = async () => {
    if (faceApiLoaded || faceApiLoading) return;
    setFaceApiLoading(true);
    setUploadProgress('Loading AI Face Models (TinyFaceDetector, Landmarks, Recognition)...');
    try {
      // Load weights from stable CDN
      const MODEL_URL = 'https://cdn.jsdelivr.net/gh/carlosgestosa/face-api.js-models@master/';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setFaceApiLoaded(true);
      setUploadProgress('AI Face Models Loaded Successfully!');
      setTimeout(() => setUploadProgress(''), 3000);
    } catch (err) {
      console.error('Error loading FaceAPI models:', err);
      setUploadProgress('Failed to load FaceAPI models. AI tagging/face detection will be limited.');
    } finally {
      setFaceApiLoading(false);
    }
  };

  const fetchEventDetails = async () => {
    try {
      const data = await api.get(`/events/${eventId}`);
      setEvent(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const users = await api.get('/auth/users');
      setUsersList(users.filter(u => u.id !== user.id)); // filter out self for tagging
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  useEffect(() => {
    fetchEventDetails();
    fetchUsers();
    loadFaceApiModels();
  }, [eventId]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleUploadFiles(files);
    }
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      await handleUploadFiles(files);
    }
  };

  // Process files and run client-side face recognition detection
  const handleUploadFiles = async (files) => {
    setUploading(true);
    setUploadProgress('Initializing upload...');

    try {
      const formData = new FormData();
      formData.append('eventId', eventId);
      formData.append('isPrivate', event.isPrivate);
      formData.append('tags', customTags);

      const faceMarkersList = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        formData.append('files', file);

        // Run face detection if model is loaded and file is image
        if (faceApiLoaded && file.type.startsWith('image/')) {
          setUploadProgress(`AI Analyzing image ${i + 1}/${files.length} for faces...`);
          try {
            const img = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const image = new Image();
                image.src = e.target.result;
                image.onload = () => resolve(image);
                image.onerror = reject;
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            // Detect faces
            const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
            const detections = await faceapi.detectAllFaces(img, options)
              .withFaceLandmarks()
              .withFaceDescriptors();

            const markers = detections.map(det => ({
              box: {
                x: det.detection.box.x,
                y: det.detection.box.y,
                width: det.detection.box.width,
                height: det.detection.box.height
              },
              descriptor: Array.from(det.descriptor) // convert Float32Array to standard JS Array
            }));

            faceMarkersList.push(markers);
            console.log(`Detected ${markers.length} faces in ${file.name}`);
          } catch (faceErr) {
            console.error('Face detection error for file:', file.name, faceErr);
            faceMarkersList.push([]);
          }
        } else {
          faceMarkersList.push([]);
        }
      }

      formData.append('faceMarkersList', JSON.stringify(faceMarkersList));
      setUploadProgress('Uploading files and metadata to server...');

      await api.upload('/media/upload', formData);
      setUploadProgress('Upload completed successfully!');
      
      setTimeout(() => {
        setUploadProgress('');
        setUploading(false);
      }, 2000);

      fetchEventDetails();
    } catch (err) {
      alert('Upload failed: ' + err.message);
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleLike = async (mediaId, e) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/media/${mediaId}/like`);
      // Update local state directly
      setEvent(prev => ({
        ...prev,
        mediaItems: prev.mediaItems.map(item => {
          if (item.id === mediaId) {
            const likes = res.liked
              ? [...item.likes, { userId: user.id }]
              : item.likes.filter(l => l.userId !== user.id);
            return { ...item, likes };
          }
          return item;
        })
      }));

      if (selectedMedia && selectedMedia.id === mediaId) {
        setSelectedMedia(prev => {
          const likes = res.liked
            ? [...prev.likes, { userId: user.id }]
            : prev.likes.filter(l => l.userId !== user.id);
          return { ...prev, likes };
        });
      }
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      const comment = await api.post(`/media/${selectedMedia.id}/comment`, { content: commentText });
      
      // Update selected media details
      setSelectedMedia(prev => ({
        ...prev,
        comments: [...prev.comments, comment]
      }));

      // Update event list
      setEvent(prev => ({
        ...prev,
        mediaItems: prev.mediaItems.map(item => {
          if (item.id === selectedMedia.id) {
            return { ...item, comments: [...item.comments, comment] };
          }
          return item;
        })
      }));

      setCommentText('');
    } catch (err) {
      alert('Failed to post comment: ' + err.message);
    }
  };

  const handleTagUser = async () => {
    if (!selectedTagUser) return;
    try {
      await api.post(`/media/${selectedMedia.id}/tag`, { userId: parseInt(selectedTagUser) });
      const taggedUser = usersList.find(u => u.id === parseInt(selectedTagUser));
      alert(`Successfully tagged ${taggedUser ? taggedUser.name : 'user'}! Notification sent.`);
      setSelectedTagUser('');
    } catch (err) {
      alert('Failed to tag user: ' + err.message);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '5rem' }}>Loading album details...</div>;
  if (error) return <div style={{ color: '#ef4444', textAlign: 'center', padding: '5rem' }}>{error}</div>;
  if (!event) return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '5rem' }}>Album not found.</div>;

  const isPhotographer = user.role === 'ADMIN' || user.role === 'PHOTOGRAPHER';

  return (
    <div>
      {/* Back button & title */}
      <button onClick={onBack} className="outline-btn" style={{ marginBottom: '1.5rem', border: 'none' }}>
        <ArrowLeft size={16} /> Back to albums
      </button>

      {/* Header Panel */}
      <div className="glass-card" style={{ marginBottom: '2.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="tag" style={{ textTransform: 'capitalize' }}>
              {event.category}
            </span>
            {event.isPrivate ? (
              <span className="badge badge-admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <EyeOff size={12} /> Private Album
              </span>
            ) : (
              <span className="badge badge-member" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Eye size={12} /> Public Album
              </span>
            )}
          </div>
          <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '0.5rem' }}>{event.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', lineHeight: '1.5' }}>
            {event.description || 'No description provided.'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Calendar size={14} />
              Date: {new Date(event.date).toLocaleDateString()}
            </span>
            <span>Club: {event.clubName}</span>
            <span>Uploader: {event.creator.name}</span>
          </div>
        </div>
        
        {/* Face-API indicators */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
          <Sparkles size={16} color={faceApiLoaded ? 'var(--color-secondary)' : 'var(--text-muted)'} className={faceApiLoading ? 'spin' : ''} />
          <span>AI Face Engine: {faceApiLoaded ? 'Active' : 'Offline'}</span>
        </div>
      </div>

      {/* Upload Box (Only for Photographers / Admins) */}
      {isPhotographer && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '0.75rem' }}>Upload Media</h3>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: dragOver ? '2px dashed var(--color-primary)' : '2px dashed var(--glass-border)',
              background: dragOver ? 'rgba(59, 130, 246, 0.05)' : 'var(--glass-bg)',
              borderRadius: '12px',
              padding: '2.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*,video/*"
              style={{ display: 'none' }}
            />
            <div style={{ background: 'rgba(255,255,255,0.03)', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', border: '1px solid var(--glass-border)' }}>
              <Upload size={24} color="var(--text-secondary)" />
            </div>
            <p style={{ color: '#fff', fontWeight: 500, marginBottom: '0.25rem' }}>
              Drag and drop media files here, or click to browse
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Images and videos up to 50MB. Local Face Detector will analyze photos automatically before upload.
            </p>
          </div>
          
          {/* Custom tags input for upload */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
            <Tag size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Add tags to uploads:</span>
            <input
              type="text"
              className="glass-input"
              value={customTags}
              onChange={(e) => setCustomTags(e.target.value)}
              placeholder="e.g. sports, campus, summer"
              style={{ maxWidth: '300px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            />
          </div>

          {uploading && (
            <div className="glass-card" style={{ marginTop: '1rem', borderLeft: '4px solid var(--color-secondary)' }}>
              <p style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 500 }}>{uploadProgress}</p>
              <div style={{ width: '100%', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', marginTop: '0.5rem', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: 'var(--gradient-primary)', animation: 'pulse 1.5s infinite' }}></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Media Gallery */}
      <h3 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '1rem' }}>Photos & Videos ({event.mediaItems?.length || 0})</h3>
      
      {event.mediaItems?.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No media has been uploaded to this album yet.</p>
        </div>
      ) : (
        <div className="grid-gallery">
          {event.mediaItems.map((item) => {
            const hasLiked = item.likes.some(l => l.userId === user.id);
            const isVideo = item.fileType.startsWith('video/');

            return (
              <div
                key={item.id}
                onClick={() => setSelectedMedia(item)}
                className="glass-card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  aspectRatio: '4/3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#000'
                }}
              >
                {isVideo ? (
                  <video
                    src={api.mediaUrl(item.fileUrl)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={api.mediaUrl(item.fileUrl)}
                    alt={item.filename}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                  />
                )}

                {/* Overlays on hover */}
                <div
                  className="gallery-hover-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.85) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '1rem',
                    opacity: 0,
                    transition: 'opacity 0.25s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      
                      {/* Like */}
                      <button
                        onClick={(e) => handleLike(item.id, e)}
                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Heart size={16} fill={hasLiked ? '#ec4899' : 'none'} color={hasLiked ? '#ec4899' : '#fff'} />
                        <span style={{ fontSize: '0.85rem' }}>{item.likes.length}</span>
                      </button>

                      {/* Comments */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: '#fff' }}>
                        <MessageSquare size={16} />
                        {item.comments.length}
                      </span>
                    </div>

                    {/* Download button */}
                    <a
                      href={api.downloadUrl(item.id)}
                      download
                      onClick={(e) => e.stopPropagation()}
                      style={{ background: 'rgba(255,255,255,0.1)', padding: '0.4rem', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Download with dynamic watermark"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox / Detail Modal */}
      {selectedMedia && (
        <div className="modal-overlay" onClick={() => setSelectedMedia(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-secondary)' }}>
              <div style={{ minWidth: 0 }}>
                <h4 style={{ color: '#fff', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedMedia.filename}
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Uploaded by {selectedMedia.uploader.name} on {new Date(selectedMedia.uploadDate).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedMedia(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1, overflow: 'hidden' }}>
              
              {/* Media viewer */}
              <div style={{ flex: '1 1 500px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '350px', position: 'relative' }}>
                {selectedMedia.fileType.startsWith('video/') ? (
                  <video
                    src={api.mediaUrl(selectedMedia.fileUrl)}
                    controls
                    style={{ maxWidth: '100%', maxHeight: '60vh' }}
                  />
                ) : (
                  <img
                    src={api.mediaUrl(selectedMedia.fileUrl)}
                    alt={selectedMedia.filename}
                    style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
                  />
                )}
                
                {/* Watermark preview display */}
                <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>
                  Watermark active on download
                </div>
              </div>

              {/* Interaction Panel (Right side) */}
              <div style={{ width: '350px', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--glass-border)', height: '60vh', overflowY: 'auto', padding: '1.5rem' }}>
                
                {/* Actions Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <button
                    onClick={(e) => handleLike(selectedMedia.id, e)}
                    className="outline-btn"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    <Heart size={16} fill={selectedMedia.likes.some(l => l.userId === user.id) ? '#ec4899' : 'none'} color={selectedMedia.likes.some(l => l.userId === user.id) ? '#ec4899' : '#fff'} />
                    <span>{selectedMedia.likes.length} Likes</span>
                  </button>
                  
                  <a
                    href={api.downloadUrl(selectedMedia.id)}
                    download
                    className="glow-btn"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    <Download size={16} /> Watermarked
                  </a>
                </div>

                {/* Tags Section */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h5 style={{ color: '#fff', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Tags</h5>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {selectedMedia.tags.split(',').map((t, idx) => (
                      <span key={idx} className="tag" style={{ fontSize: '0.75rem' }}>
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                {/* User Tagging feature */}
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginBottom: '1.5rem' }}>
                  <h5 style={{ color: '#fff', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <UserPlus size={14} /> Tag Friends
                  </h5>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      className="glass-input"
                      value={selectedTagUser}
                      onChange={(e) => setSelectedTagUser(e.target.value)}
                      style={{ background: 'var(--bg-tertiary)', color: '#fff', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      <option value="">Choose a member...</option>
                      {usersList.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <button onClick={handleTagUser} className="outline-btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                      Tag
                    </button>
                  </div>
                </div>

                {/* Comments Thread */}
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '180px' }}>
                  <h5 style={{ color: '#fff', fontSize: '0.85rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comments ({selectedMedia.comments.length})</h5>
                  
                  {/* Comments list */}
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', maxHeight: '200px' }}>
                    {selectedMedia.comments.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', marginTop: '1rem' }}>No comments yet.</p>
                    ) : (
                      selectedMedia.comments.map((comm) => (
                        <div key={comm.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-primary)', border: '1px solid var(--glass-border)' }}>
                            {comm.user.name.charAt(0)}
                          </div>
                          <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>{comm.user.name}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(comm.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>{comm.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add comment input */}
                  <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                    <input
                      type="text"
                      className="glass-input"
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                    />
                    <button type="submit" className="glow-btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                      Post
                    </button>
                  </form>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

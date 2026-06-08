import React, { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api';
import { Upload, Sparkles, Smile, Image as ImageIcon, Heart, MessageSquare, Download, CheckCircle, ShieldAlert } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

export default function FaceRecognition({ user, onUpdateSelfie }) {
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(user.referenceSelfieUrl || '');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  // AI model states
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Results state
  const [matchingMedia, setMatchingMedia] = useState([]);
  const [scannedCount, setScannedCount] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);

  const fileInputRef = useRef(null);

  // Load models from CDN
  const loadModels = async () => {
    if (modelsLoaded || modelsLoading) return;
    setModelsLoading(true);
    setStatus('Loading AI face models...');
    try {
      const MODEL_URL = 'https://cdn.jsdelivr.net/gh/carlosgestosa/face-api.js-models@master/';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
      setStatus('AI Models ready.');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      console.error(err);
      setStatus('Failed to load AI models. Please reload page.');
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  // Run scanning once models are loaded and a selfie is available
  useEffect(() => {
    if (modelsLoaded && selfiePreview) {
      scanPhotosForUser();
    }
  }, [modelsLoaded, selfiePreview]);

  const handleSelfieSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelfieFile(file);
    const localUrl = URL.createObjectURL(file);
    setSelfiePreview(localUrl);
    setScanComplete(false);
    setMatchingMedia([]);
  };

  // Scan all media items to find matches using face descriptors
  const scanPhotosForUser = async () => {
    if (!selfiePreview || !modelsLoaded) return;
    setLoading(true);
    setStatus('Analyzing your selfie...');
    
    try {
      // 1. Load selfie image and extract descriptor
      const selfieImg = await faceapi.fetchImage(selfiePreview);
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
      const selfieDetection = await faceapi.detectSingleFace(selfieImg, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!selfieDetection) {
        throw new Error('No face detected in your selfie. Please upload a clear photo of your face.');
      }

      const selfieDescriptor = selfieDetection.descriptor;
      setStatus('Selfie analyzed. Scanning database photos...');

      // 2. Fetch all media items
      const allMedia = await api.get('/media');
      setScannedCount(allMedia.length);

      const matches = [];

      // 3. Compare descriptors
      for (const item of allMedia) {
        if (!item.faceMarkers) continue;

        try {
          const markers = JSON.parse(item.faceMarkers);
          if (!Array.isArray(markers)) continue;

          for (const marker of markers) {
            if (!marker.descriptor) continue;

            // Compute distance
            const distance = faceapi.euclideanDistance(selfieDescriptor, marker.descriptor);
            
            // Euclidean distance threshold (typically < 0.6 is a match)
            if (distance < 0.55) {
              matches.push(item);
              break; // match found in this image, move to next image
            }
          }
        } catch (err) {
          console.error('Failed to compare descriptors for media id:', item.id, err);
        }
      }

      setMatchingMedia(matches);
      setScanComplete(true);
      setStatus(`Scan completed. Found ${matches.length} photos containing you!`);
      
      // 4. Save selfie reference to backend profile if newly uploaded
      if (selfieFile) {
        // Upload selfie image
        const formData = new FormData();
        formData.append('files', selfieFile);
        formData.append('eventId', '1'); // temp event id mapping
        
        const uploadRes = await api.upload('/media/upload', formData);
        if (uploadRes.success && uploadRes.media && uploadRes.media.length > 0) {
          const selfieUrl = uploadRes.media[0].fileUrl;
          await api.post('/auth/selfie', { referenceSelfieUrl: selfieUrl });
          onUpdateSelfie(selfieUrl);
        }
      }

    } catch (err) {
      alert(err.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Page Title */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '2.2rem', color: '#fff', marginBottom: '0.25rem' }}>Personalized Photo Discovery</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Upload a reference selfie to find all photos containing you in our database</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'flex-start' }}>
        
        {/* Left Card: Selfie Upload & status */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.2rem' }}>Your Reference Selfie</h3>
          
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              border: selfiePreview ? '3px solid var(--color-secondary)' : '2px dashed var(--glass-border)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: 'pointer',
              position: 'relative',
              marginBottom: '1.5rem',
              boxShadow: selfiePreview ? 'var(--shadow-glow)' : 'none',
              transition: 'var(--transition-fast)'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSelfieSelect}
              accept="image/*"
              style={{ display: 'none' }}
            />
            {selfiePreview ? (
              <img
                src={api.mediaUrl(selfiePreview)}
                alt="Selfie"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Smile size={32} color="var(--text-muted)" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Choose Selfie</span>
              </div>
            )}

            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '0.25rem', fontSize: '0.7rem', color: '#fff' }}>
              Change Photo
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="outline-btn"
            disabled={loading}
            style={{ marginBottom: '1.5rem' }}
          >
            <Upload size={16} /> Select New Selfie
          </button>

          {/* AI Loader/Status bar */}
          <div style={{ width: '100%', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
            {status && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                <Sparkles size={16} color="var(--color-secondary)" className="pulse" />
                <span>{status}</span>
              </div>
            )}
            
            {loading && (
              <div style={{ width: '100%', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: 'var(--gradient-accent)', animation: 'pulse 1.5s infinite' }}></div>
              </div>
            )}

            {!loading && scanComplete && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.85rem' }}>
                <CheckCircle size={16} />
                <span>Scanned {scannedCount} database photos</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Discovery Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} color="var(--color-accent)" />
              Detected Photos ({matchingMedia.length})
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Photos matching your face profile across all public and authorized private albums.
            </p>
          </div>

          {matchingMedia.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <ImageIcon size={40} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
              <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>
                {!selfiePreview ? 'Upload a selfie to start' : scanComplete ? 'No matches found' : 'Ready to scan...'}
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '300px', margin: '0 auto' }}>
                {!selfiePreview
                  ? 'We need a clear reference image of your face to match against the event database.'
                  : scanComplete
                  ? 'We couldn\'t find any photos matching your face in the current albums.'
                  : 'The facial recognition scanning will start automatically once models load.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
              {matchingMedia.map(item => (
                <div
                  key={item.id}
                  className="glass-card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    aspectRatio: '1',
                    position: 'relative',
                    border: '1px solid var(--glass-border)'
                  }}
                >
                  <img
                    src={api.mediaUrl(item.fileUrl)}
                    alt={item.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  
                  {/* Hover download button */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                  >
                    <a
                      href={api.downloadUrl(item.id)}
                      download
                      style={{ background: 'var(--color-primary)', padding: '0.5rem', borderRadius: '50%', color: '#fff', display: 'flex' }}
                      title="Download with watermark"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

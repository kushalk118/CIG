import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { api } from './utils/api';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import EventDetails from './pages/EventDetails';
import FaceRecognition from './pages/FaceRecognition';
import Notifications from './pages/Notifications';

function MainLayout({ user, setUser }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    setUser(null);
  };

  // Wrapper component to pass route param eventId to EventDetails
  const EventDetailsWrapper = () => {
    const { id } = useParams();
    return (
      <EventDetails
        eventId={id}
        user={user}
        onBack={() => navigate('/')}
      />
    );
  };

  return (
    <div className="app-container">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard user={user} onEventSelect={(id) => navigate(`/event/${id}`)} />} />
          <Route path="/event/:id" element={<EventDetailsWrapper />} />
          <Route path="/face-discovery" element={<FaceRecognition user={user} onUpdateSelfie={(url) => setUser(prev => ({ ...prev, referenceSelfieUrl: url }))} />} />
          <Route path="/notifications" element={<Notifications />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const profile = await api.get('/auth/me');
          setUser(profile);
        } catch (err) {
          console.error('Session expired:', err);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#080c14', color: '#94a3b8' }}>
        <h3>Verifying CIG Session...</h3>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <BrowserRouter>
      <MainLayout user={user} setUser={setUser} />
    </BrowserRouter>
  );
}

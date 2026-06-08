import React, { useState } from 'react';
import { api } from '../utils/api';
import { LogIn, UserPlus, ShieldAlert, KeyRound } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('VIEWER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.post('/auth/signup', { email, password, name, role });
        localStorage.setItem('token', res.token);
        onLoginSuccess(res.user);
      } else {
        const res = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', res.token);
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestLogin = (testEmail, testPassword) => {
    setEmail(testEmail);
    setPassword(testPassword);
    setIsRegister(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: '#080c14' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem', borderRadius: '16px' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--gradient-primary)', width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: 'var(--shadow-glow)' }}>
            <KeyRound size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '0.25rem' }}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isRegister ? 'Sign up to access and share media' : 'Log in to CIG Event & Media Platform'}
          </p>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {isRegister && (
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 500 }}>Full Name</label>
              <input
                type="text"
                className="glass-input"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 500 }}>Email Address</label>
            <input
              type="email"
              className="glass-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 500 }}>Password</label>
            <input
              type="password"
              className="glass-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {isRegister && (
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 500 }}>Select Role</label>
              <select
                className="glass-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ background: 'var(--bg-secondary)', color: '#fff' }}
              >
                <option value="VIEWER">Viewer (Public gallery only)</option>
                <option value="CLUB_MEMBER">Club Member (Can view private media)</option>
                <option value="PHOTOGRAPHER">Photographer (Can upload photos)</option>
                <option value="ADMIN">Administrator (Full control)</option>
              </select>
            </div>
          )}

          <button type="submit" className="glow-btn" disabled={loading} style={{ justifyContent: 'center', marginTop: '0.5rem', width: '100%' }}>
            {loading ? 'Processing...' : isRegister ? (
              <>
                <UserPlus size={18} /> Register
              </>
            ) : (
              <>
                <LogIn size={18} /> Log In
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          </span>
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
          >
            {isRegister ? 'Log In' : 'Sign Up'}
          </button>
        </div>

        {/* Preset accounts helper */}
        <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
          <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.75rem', textAlign: 'center' }}>
            Fast Demo Testing Accounts
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            <button
              onClick={() => handleTestLogin('admin@cig.com', 'adminpassword')}
              className="outline-btn"
              style={{ padding: '0.5rem', fontSize: '0.75rem', justifyContent: 'center' }}
            >
              Admin Role
            </button>
            <button
              onClick={() => handleTestLogin('photo@cig.com', 'photopassword')}
              className="outline-btn"
              style={{ padding: '0.5rem', fontSize: '0.75rem', justifyContent: 'center' }}
            >
              Photographer
            </button>
            <button
              onClick={() => handleTestLogin('member@cig.com', 'memberpassword')}
              className="outline-btn"
              style={{ padding: '0.5rem', fontSize: '0.75rem', justifyContent: 'center' }}
            >
              Club Member
            </button>
            <button
              onClick={() => handleTestLogin('viewer@cig.com', 'viewerpassword')}
              className="outline-btn"
              style={{ padding: '0.5rem', fontSize: '0.75rem', justifyContent: 'center' }}
            >
              Viewer Role
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

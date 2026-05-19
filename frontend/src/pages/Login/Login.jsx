import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Rocket, AlertCircle } from 'lucide-react';
import '../../components/Layout/Layout.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverName, setServerName] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/auth/server-info')
      .then(res => res.json())
      .then(data => {
        if (data && data.hostname) {
          setServerName(data.hostname);
        }
      })
      .catch(err => console.error("Error fetching server info", err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="brand-icon" style={{ 
            background: 'linear-gradient(135deg, var(--accent-blue) 0%, #3b82f6 100%)', 
            color: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderRadius: '12px', 
            padding: '10px',
            boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
            width: '48px',
            height: '48px',
            marginBottom: 'var(--space-md)'
          }}>
            <Rocket size={26} />
          </div>
          <h1>EasyLin</h1>
          <p>Sign in with your server credentials</p>
          {serverName && (
            <p style={{ 
              fontSize: '12px', 
              color: 'var(--accent-blue)', 
              background: 'var(--accent-blue-dim)', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              marginTop: '10px',
              fontWeight: 500,
              display: 'inline-block'
            }}>
              Ti stai connettendo a: <span className="mono" style={{ fontWeight: 700 }}>{serverName}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              id="username"
              className="form-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="System username"
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="System password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? <div className="spinner spinner-sm" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

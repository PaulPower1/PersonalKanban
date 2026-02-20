import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../api/client';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(d.google))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(email, password, displayName);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Create Account</h1>
        <p className="auth-card__subtitle">Start organizing with Personal Kanban</p>

        {error && <div className="auth-card__error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="modal__label">Display Name</label>
            <input
              className="modal__input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
              autoFocus
            />
          </div>

          <div className="modal__field">
            <label className="modal__label">Email</label>
            <input
              className="modal__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="modal__field">
            <label className="modal__label">Password</label>
            <input
              className="modal__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="auth-card__submit"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {googleEnabled && (
          <>
            <div className="auth-card__divider">
              <span>or</span>
            </div>
            <a href="/api/auth/google" className="auth-card__google-btn">
              Sign up with Google
            </a>
          </>
        )}

        <p className="auth-card__footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

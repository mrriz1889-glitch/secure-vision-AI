import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User, Loader, AlertTriangle, KeyRound } from 'lucide-react';
import { login, verifyTotp, initAuth, getAuthRecord, getLockoutRemaining } from '../lib/auth';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutMs, setLockoutMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // Initialize auth on first load
  useEffect(() => {
    initAuth().then(async () => {
      const rec = await getAuthRecord();
      if (rec) {
        const remaining = getLockoutRemaining(rec);
        if (remaining > 0) setLockoutMs(remaining);
      }
      setReady(true);
    });
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (lockoutMs <= 0) return;
    const timer = setInterval(() => {
      setLockoutMs((prev) => {
        const next = prev - 1000;
        return next > 0 ? next : 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutMs]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutMs > 0) return;
    setBusy(true);
    setError(null);

    const result = await login(username, password);
    if (result.ok) {
      navigate('/');
    } else if (result.needsTotp) {
      setNeedsTotp(true);
    } else if (result.error === 'Account locked' && result.lockoutMs) {
      setLockoutMs(result.lockoutMs);
      setError('Too many failed attempts. Account temporarily locked.');
    } else {
      setError(result.error ?? 'Login failed');
    }
    setBusy(false);
  };

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await verifyTotp(totpCode);
    if (result.ok) {
      navigate('/');
    } else {
      setError(result.error ?? 'Invalid 2FA code');
    }
    setBusy(false);
  };

  if (!ready) {
    return (
      <div style={pageStyle}>
        <Loader style={{ width: 32, height: 32, color: 'var(--sv-primary)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const lockoutSeconds = Math.ceil(lockoutMs / 1000);
  const lockoutMinutes = Math.floor(lockoutSeconds / 60);
  const lockoutRem = lockoutSeconds % 60;

  return (
    <div style={pageStyle}>
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--sv-bg-panel)',
          border: '1px solid var(--sv-border)',
          borderRadius: 16,
          padding: 32,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: 'linear-gradient(135deg, #ffb000, #ff8800)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield style={{ width: 24, height: 24, color: '#000' }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
              SECUREVISION<span style={{ color: 'var(--sv-primary)' }}>Ai</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--sv-text-dim)', letterSpacing: 1.5 }}>
              ADMINISTRATOR ACCESS
            </div>
          </div>
        </div>

        {lockoutMs > 0 ? (
          <div
            style={{
              padding: 16,
              background: 'rgba(255,0,68,0.08)',
              border: '1px solid rgba(255,0,68,0.3)',
              borderRadius: 8,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            <AlertTriangle style={{ width: 28, height: 28, color: 'var(--sv-danger)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sv-danger)' }}>Account Locked</div>
            <div style={{ fontSize: 12, color: 'var(--sv-text-dim)', marginTop: 4 }}>
              Too many failed attempts. Try again in{' '}
              <strong style={{ color: 'var(--sv-primary)' }}>
                {lockoutMinutes}:{lockoutRem.toString().padStart(2, '0')}
              </strong>
            </div>
          </div>
        ) : !needsTotp ? (
          <form onSubmit={handleLogin}>
            <label className="sv-label">Username</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <User
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 16,
                  height: 16,
                  color: 'var(--sv-text-muted)',
                }}
              />
              <input
                className="sv-input"
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                style={{ paddingLeft: 38 }}
              />
            </div>

            <label className="sv-label">Password</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Lock
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 16,
                  height: 16,
                  color: 'var(--sv-text-muted)',
                }}
              />
              <input
                className="sv-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                style={{ paddingLeft: 38 }}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: 10,
                  background: 'rgba(255,0,68,0.08)',
                  border: '1px solid rgba(255,0,68,0.3)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--sv-danger)',
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !username || !password}
              className="sv-btn sv-btn-primary"
              style={{ width: '100%', padding: 12, fontSize: 13 }}
            >
              {busy ? (
                <Loader style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
              ) : (
                <>
                  <Lock style={{ width: 14, height: 14 }} /> Sign In
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotp}>
            <div
              style={{
                padding: 12,
                background: 'rgba(255,176,0,0.06)',
                border: '1px solid rgba(255,176,0,0.2)',
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound style={{ width: 16, height: 16, color: 'var(--sv-primary)' }} />
                <div style={{ fontSize: 12, color: 'var(--sv-primary)', fontWeight: 600 }}>
                  Two-Factor Authentication Required
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--sv-text-dim)', marginTop: 6 }}>
                Enter the 6-digit code from your authenticator app.
              </div>
            </div>

            <label className="sv-label">2FA Code</label>
            <input
              className="sv-input"
              type="text"
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              style={{
                fontSize: 24,
                letterSpacing: 8,
                textAlign: 'center',
                fontFamily: 'var(--sv-font-mono)',
              }}
            />

            {error && (
              <div
                style={{
                  padding: 10,
                  background: 'rgba(255,0,68,0.08)',
                  border: '1px solid rgba(255,0,68,0.3)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--sv-danger)',
                  marginTop: 12,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || totpCode.length !== 6}
              className="sv-btn sv-btn-primary"
              style={{ width: '100%', padding: 12, fontSize: 13, marginTop: 16 }}
            >
              {busy ? (
                <Loader style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
              ) : (
                'Verify Code'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setNeedsTotp(false);
                setTotpCode('');
                setError(null);
              }}
              className="sv-btn sv-btn-secondary"
              style={{ width: '100%', marginTop: 8, fontSize: 11 }}
            >
              Back
            </button>
          </form>
        )}

        <div
          style={{
            fontSize: 10,
            color: 'var(--sv-text-muted)',
            marginTop: 20,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          Rate limiting: 5 failed attempts triggers a 5-minute lockout.
          <br />
          Session expires 1 hour after login.
        </div>
      </div>
    </div>
  );
};

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--sv-bg-deep)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  overflowY: 'auto',
};

export default LoginPage;

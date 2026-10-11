import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, CheckCircle, XCircle, Loader, Shield } from 'lucide-react';
import { useWebcam } from '../hooks/useWebcam';
import * as db from '../lib/db';
import { useStore } from '../store/useStore';
import type { EnrollmentLink } from '../types';
import { captureFrame, enrollFace } from '../lib/compreface';

const ANGLES = [
  { label: 'Look straight ahead',   hint: 'Center your face in the frame' },
  { label: 'Turn slightly LEFT',    hint: 'About 20° to your left' },
  { label: 'Turn slightly RIGHT',   hint: 'About 20° to your right' },
  { label: 'Tilt head slightly UP', hint: 'Chin up a little' },
  { label: 'Tilt head slightly DOWN', hint: 'Chin down a little' },
];

const EnrollPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const consumeEnrollmentLink = useStore((s) => s.consumeEnrollmentLink);

  const [link, setLink] = useState<EnrollmentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [captures, setCaptures] = useState<string[]>([]); // data URLs
  const [currentAngle, setCurrentAngle] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [flash, setFlash] = useState(false);

  const { videoRef, ready, error: camError } = useWebcam(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) { setErrorMsg('Missing enrollment token'); setLoading(false); return; }
      const l = await db.getLinkByToken(token);
      if (!l) setErrorMsg('This enrollment link is invalid.');
      else if (l.used) {
        setErrorMsg(
          'This enrollment link has already reached its maximum number of uses. Please contact the system administrator to request a new link.'
        );
      } else if (new Date(l.expiresAt) < new Date()) {
        setErrorMsg('This link has expired. Contact the administrator for a new link.');
      } else {
        setLink(l);
      }
      setLoading(false);
    }
    load();
  }, [token]);

  // Draw a simple centered guide overlay (CompreFace detects server-side)
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    // Center oval guide
    ctx.strokeStyle = 'rgba(255,176,0,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.20, h * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
  }, [videoRef, ready]);

  const captureCurrent = async () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    const dataURL = captureFrame(video);
    if (!dataURL) return;
    const next = [...captures, dataURL];
    setCaptures(next);

    if (next.length >= ANGLES.length) {
      // Finish — enroll all 5 frames in CompreFace
      await finishEnrollment(next);
    } else {
      setCurrentAngle(next.length);
    }
  };

  const finishEnrollment = async (frames: string[]) => {
    if (!link) return;
    setUploading(true);

    // Re-fetch the link from DB to catch any concurrent use in another tab
    const fresh = await db.getLinkByToken(link.token);
    if (!fresh) {
      setErrorMsg('Link no longer exists');
      setUploading(false);
      return;
    }
    const currentCount = fresh.useCount ?? 0;
    const maxAllowed = fresh.maxUses ?? 1;
    if (fresh.used || currentCount >= maxAllowed) {
      setErrorMsg(
        'This enrollment link has reached its maximum number of uses. Please contact the system administrator to request a new link.'
      );
      setUploading(false);
      return;
    }

    const subjectId = crypto.randomUUID();

    // Enroll each frame in CompreFace
    let success = 0;
    for (const frame of frames) {
      const ok = await enrollFace(subjectId, frame);
      if (ok) success++;
    }

    if (success === 0) {
      setErrorMsg('CompreFace enrollment failed. Is the Docker container running?');
      setUploading(false);
      return;
    }

    // Save the employee record; store increments useCount atomically
    const emp = await consumeEnrollmentLink(link.token, subjectId);
    if (emp) {
      navigate('/enroll/success');
    } else {
      setErrorMsg(
        'This link could not be used (already at max uses or expired). Please contact the administrator.'
      );
      setUploading(false);
    }
  };

  const restart = () => {
    setCaptures([]);
    setCurrentAngle(0);
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <Loader style={{ width: 32, height: 32, color: 'var(--sv-primary)', animation: 'spin 1s linear infinite' }} />
        <div style={{ color: 'var(--sv-text-dim)', marginTop: 12 }}>Validating link...</div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={pageStyle}>
        <XCircle style={{ width: 48, height: 48, color: 'var(--sv-danger)' }} />
        <h2 style={{ fontSize: 20, marginTop: 16, color: 'var(--sv-text)' }}>Enrollment Error</h2>
        <p style={{ color: 'var(--sv-text-dim)', marginTop: 8, textAlign: 'center', maxWidth: 400 }}>{errorMsg}</p>
      </div>
    );
  }

  const angle = ANGLES[currentAngle] ?? ANGLES[ANGLES.length - 1];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sv-bg-deep)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, width: '100%', background: 'var(--sv-bg-panel)', border: '1px solid var(--sv-border)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, background: 'var(--sv-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
            <Shield style={{ width: 22, height: 22, color: '#000' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>SECUREVISION<span style={{ color: 'var(--sv-primary)' }}>Ai</span></div>
            <div style={{ fontSize: 10, color: 'var(--sv-text-dim)', letterSpacing: 1 }}>POWERED BY COMPREFACE AI</div>
          </div>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Hi {link?.name?.split(' ')[0]},</h1>
        <p style={{ fontSize: 13, color: 'var(--sv-text-dim)', marginBottom: 8 }}>
          We'll capture 5 photos of your face from different angles.
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {ANGLES.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < captures.length ? 'var(--sv-accent)' : i === currentAngle ? 'var(--sv-primary)' : 'var(--sv-border)' }} />
          ))}
        </div>

        <div style={{ padding: 12, background: 'rgba(255,176,0,0.06)', border: '1px solid rgba(255,176,0,0.2)', borderRadius: 8, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sv-primary)' }}>
            Step {captures.length + 1} of {ANGLES.length} — {angle.label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--sv-text-dim)', marginTop: 2 }}>{angle.hint}</div>
        </div>

        <div style={{ position: 'relative', aspectRatio: '16/10', background: '#000', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }} />
          {!ready && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', zIndex: 3, flexDirection: 'column', gap: 8 }}>
              <Loader style={{ width: 24, height: 24, color: 'var(--sv-primary)', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 12, color: 'var(--sv-primary)' }}>Starting camera...</div>
            </div>
          )}
          {camError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', zIndex: 3, padding: 20, textAlign: 'center' }}>
              <div>
                <XCircle style={{ width: 32, height: 32, color: 'var(--sv-danger)', margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13, color: 'var(--sv-danger)' }}>Camera required</div>
                <div style={{ fontSize: 11, color: 'var(--sv-text-dim)' }}>{camError}</div>
              </div>
            </div>
          )}
          {flash && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 4 }} />}
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', zIndex: 5 }}>
              <Loader style={{ width: 32, height: 32, color: 'var(--sv-primary)', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 12, color: 'var(--sv-primary)', marginTop: 12 }}>Enrolling your face with AI...</div>
            </div>
          )}
        </div>

        <button
          onClick={captureCurrent}
          disabled={!ready || uploading}
          className="sv-btn sv-btn-primary"
          style={{ width: '100%', padding: 14, fontSize: 14 }}
        >
          <Camera style={{ width: 16, height: 16 }} />
          {captures.length < ANGLES.length ? `Capture Angle ${captures.length + 1}` : 'Finish'}
        </button>

        {captures.length > 0 && (
          <button onClick={restart} className="sv-btn sv-btn-secondary" style={{ width: '100%', marginTop: 8, fontSize: 11 }}>
            Restart Capture
          </button>
        )}

        <div style={{ fontSize: 10, color: 'var(--sv-text-muted)', marginTop: 12, textAlign: 'center' }}>
          Powered by ArcFace AI · Face data processed locally by CompreFace
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
  flexDirection: 'column',
  padding: 24,
  overflowY: 'auto',
};

export default EnrollPage;

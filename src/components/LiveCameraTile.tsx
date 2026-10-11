import React, { useEffect, useRef } from 'react';
import { VideoOff, AlertTriangle, Power, PowerOff } from 'lucide-react';
import { useWebcam } from '../hooks/useWebcam';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { useStore } from '../store/useStore';
import { SIMILARITY_THRESHOLD } from '../lib/compreface';

interface Props {
  cameraId: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  selected?: boolean;
  onClick?: () => void;
  recognition?: boolean;
  deviceIndex?: number;
  onRecognized?: (employeeId: string, employeeName: string, confidence: number) => void;
  onUnknownFace?: (cameraType: string) => void;
  /** If provided, shows an enable/disable toggle in the top-right corner */
  onToggle?: (enabled: boolean) => void;
  /** Whether this camera is currently enabled by the admin */
  enabled?: boolean;
}

const LiveCameraTile: React.FC<Props> = ({
  cameraId,
  name,
  location,
  status,
  selected,
  onClick,
  recognition = false,
  deviceIndex,
  onRecognized,
  onUnknownFace,
  onToggle,
  enabled = true,
}) => {
  const { employees, updateCamera } = useStore();

  const webcamEnabled = enabled && status === 'online';
  const { videoRef, ready, error } = useWebcam(webcamEnabled, deviceIndex);
  const { faces } = useFaceDetection(videoRef, webcamEnabled);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const unknownCooldownRef = useRef<number>(0);
  // Track consecutive same-subject matches to require stability
  const streakRef = useRef<{ subject: string; count: number }>({ subject: '', count: 0 });

  // Tag each CompreFace result with the employee record
  const tagged = faces.map((f) => {
    const similarity = f.similarity ?? 0;
    const matched = recognition && similarity >= SIMILARITY_THRESHOLD && f.subject !== 'unknown';
    const emp = matched ? employees.find((e) => e.id === f.subject) : null;
    return { face: f, matched, employeeName: emp?.name, employeeId: emp?.id, similarity };
  });


  // Require 2 consecutive matches of the same subject before trusting it
  const STABLE_REQUIRED = 2;
  const stableTagged = tagged.map((t) => {
    if (!t.matched || !t.employeeId) return { ...t, matched: false, stable: false };
    if (streakRef.current.subject === t.employeeId) {
      streakRef.current.count += 1;
    } else {
      streakRef.current = { subject: t.employeeId, count: 1 };
    }
    const stable = streakRef.current.count >= STABLE_REQUIRED;
    return { ...t, matched: stable, stable };
  });

  // Fire onUnknownFace when an unrecognized face is detected (60s cooldown)
  useEffect(() => {
    if (!recognition || !onUnknownFace) return;
    const hasUnknown = tagged.some((t) => !t.matched);
    if (!hasUnknown) return;
    const now = Date.now();
    if (now - unknownCooldownRef.current < 60_000) return;
    unknownCooldownRef.current = now;
    const score = tagged.find((t) => !t.matched)?.similarity ?? 0;
    onUnknownFace(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagged.map((t) => t.matched).join('|'), recognition]);

  // Fire recognition callback with 30s cooldown per employee
  useEffect(() => {
    if (!recognition || !onRecognized) return;
    const now = Date.now();
    stableTagged.forEach((t) => {
      if (t.matched && t.employeeId && t.employeeName) {
        const last = cooldownRef.current.get(t.employeeId) ?? 0;
        if (now - last > 30000) {
          cooldownRef.current.set(t.employeeId, now);
          onRecognized(t.employeeId, t.employeeName, t.similarity);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagged.map((t) => `${t.employeeId ?? 'x'}-${t.matched}`).join('|'), recognition]);

  // Diagnostic: log every detection cycle
  if ((window as any).__debug_alerts && faces.length > 0) {
    console.log('[tile-detections]', cameraId, 'faces=' + faces.length,
      'matched=' + tagged.filter(t => t.matched).length,
      'unknown=' + tagged.filter(t => !t.matched).length,
      'scores=' + tagged.map(t => t.similarity.toFixed(2)).join(','));
  }

  // Update camera face count
  useEffect(() => {
    updateCamera(cameraId, { facesDetected: faces.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faces.length, cameraId]);

  // ── Fire onUnknownFace whenever there's at least one unknown face ──
  // Runs as an effect on state change. Cooldown is 60s per tile.
  const lastFireRef = useRef<number>(0);
  const prevHadUnknownRef = useRef<boolean>(false);

  useEffect(() => {
    if (!recognition || !onUnknownFace) return;

    // Count unrecognized faces
    const unknownCount = tagged.filter((t) => !t.matched).length;
    const hadUnknown = prevHadUnknownRef.current;

    // Edge trigger: fire on 0→1+ transition, or fire on every new frame while staying unknown,
    // but no more than once per 60s
    if (unknownCount > 0) {
      const now = Date.now();
      if (now - lastFireRef.current > 60_000) {
        lastFireRef.current = now;
        const cam = useStore.getState().cameras.find((c) => c.id === cameraId);
        const camType = cam?.type ?? 'general';
        if ((window as any).__debug_alerts) {
          console.log('[tile-fire]', cameraId, name, 'type=' + camType);
        }
        onUnknownFace(camType);
      }
    }
    prevHadUnknownRef.current = unknownCount > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagged.map((t) => t.matched).join('|'), recognition]);

  // Draw boxes on canvas
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

    stableTagged.forEach((t) => {
      const { x, y, width, height } = t.face.box;
      let color = '#ff0044';
      let label = `⚠ UNKNOWN`;

      if (!recognition) {
        color = '#00ff88';
        label = `DETECTED`;
      } else if (t.matched) {
        color = '#00ff88';
        label = `${t.employeeName} · ${Math.round(t.similarity * 100)}%`;
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(3, Math.floor(w / 200));
      ctx.strokeRect(x, y, width, height);

      const cs = Math.max(20, Math.floor(w / 32));
      ctx.lineWidth = Math.max(3, Math.floor(w / 200));
      ctx.beginPath();
      ctx.moveTo(x, y + cs); ctx.lineTo(x, y); ctx.lineTo(x + cs, y);
      ctx.moveTo(x + width - cs, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + cs);
      ctx.moveTo(x + width, y + height - cs); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width - cs, y + height);
      ctx.moveTo(x + cs, y + height); ctx.lineTo(x, y + height); ctx.lineTo(x, y + height - cs);
      ctx.stroke();

      const fontSize = Math.max(20, Math.floor(w / 32));
      ctx.font = `bold ${fontSize}px monospace`;
      const padX = fontSize * 0.6;
      const padY = fontSize * 0.5;
      const textW = ctx.measureText(label).width + padX * 2;
      const textH = fontSize + padY * 2;
      const labelY = y - textH - 4 < 0 ? y + height + 4 : y - textH - 4;
      ctx.fillStyle = color;
      ctx.fillRect(x, labelY, textW, textH);
      ctx.fillStyle = '#000';
      ctx.textBaseline = 'top';
      ctx.fillText(label, x + padX, labelY + padY);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagged.map((t) => `${t.face.box.x}-${t.matched}-${t.employeeName}`).join('|'), videoRef, recognition]);

  const offline = status !== 'online';

  return (
    <div
      className={`sv-camera-tile ${selected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ aspectRatio: '16/9', position: 'relative' }}
    >
      <div className="sv-scanline-overlay" />

      {offline && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a1628, #050a14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
          <VideoOff style={{ width: 28, height: 28, color: 'var(--sv-text-muted)' }} />
          <div style={{ fontSize: 10, color: 'var(--sv-text-muted)', letterSpacing: 1 }}>{status.toUpperCase()}</div>
        </div>
      )}

      {!offline && (
        <>
          <video
            ref={videoRef}
            autoPlay playsInline muted
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
          />
          {!ready && !error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 3 }}>
              <div style={{ fontSize: 11, color: 'var(--sv-primary)' }}>Starting camera...</div>
            </div>
          )}
          {error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, background: 'rgba(0,0,0,0.75)', zIndex: 3, padding: 12, textAlign: 'center' }}>
              <AlertTriangle style={{ width: 20, height: 20, color: 'var(--sv-danger)' }} />
              <div style={{ fontSize: 10, color: 'var(--sv-danger)' }}>Camera error</div>
              <div style={{ fontSize: 9, color: 'var(--sv-text-muted)' }}>{error}</div>
            </div>
          )}
        </>
      )}

      <div className="sv-cam-overlay" style={{ zIndex: 4 }}>
        <div>
          <div className="sv-cam-name">{name}</div>
          <div className="sv-cam-meta">{location}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {recognition && enabled && <div className="sv-badge sv-badge-cyan" style={{ fontSize: 9, padding: '2px 6px' }}>REC</div>}
          {faces.length > 0 && enabled && (
            <div className="sv-cam-face-count">{faces.length} FACE{faces.length > 1 ? 'S' : ''}</div>
          )}
          <div className={`sv-status-dot ${enabled ? status : 'offline'}`} />
        </div>
      </div>

      {/* DISABLED overlay */}
      {!enabled && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            zIndex: 5,
          }}
        >
          <PowerOff style={{ width: 32, height: 32, color: 'var(--sv-danger)' }} />
          <div style={{ fontSize: 11, color: 'var(--sv-danger)', letterSpacing: 2, fontWeight: 700 }}>
            CAMERA DISABLED
          </div>
        </div>
      )}

      {/* Admin toggle button (only shown when onToggle is provided) */}
      {onToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(!enabled);
          }}
          title={enabled ? 'Disable camera' : 'Enable camera'}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 6,
            background: enabled ? 'rgba(0,0,0,0.7)' : 'var(--sv-accent)',
            border: '1px solid ' + (enabled ? 'var(--sv-border-bright)' : 'var(--sv-accent)'),
            color: enabled ? 'var(--sv-text)' : '#000',
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {enabled ? (
            <Power style={{ width: 14, height: 14 }} />
          ) : (
            <PowerOff style={{ width: 14, height: 14 }} />
          )}
        </button>
      )}
    </div>
  );
};

export default LiveCameraTile;

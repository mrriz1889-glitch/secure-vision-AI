import React, { useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Camera, Users, ShieldAlert, Activity, Eye, AlertTriangle, X } from 'lucide-react';
import LiveCameraTile from './LiveCameraTile';

const COOLDOWN_HOURS = 4;

const Dashboard: React.FC = () => {
  const { cameras, employees, attendanceRecords, alerts, addAttendanceRecord, addAlert, dismissAlert } = useStore();

  // Prevent the same camera firing multiple alerts in quick succession
  const cameraUnknownCooldown = useRef<Map<string, number>>(new Map());

  const onlineCams = cameras.filter((c) => c.status === 'online').length;
  const enrolled = employees.filter((e) => e.faceEnrolled).length;

  const handleRecognized = useCallback(
    (employeeId: string, employeeName: string, confidence: number, cameraId: string, cameraName: string) => {
      const cutoff = Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000;
      const recent = attendanceRecords.find(
        (r) =>
          r.employeeId === employeeId &&
          new Date(r.timestamp.replace(' ', 'T')).getTime() > cutoff
      );
      if (recent) return;

      const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
      addAttendanceRecord({
        employeeId,
        employeeName,
        timestamp: ts,
        cameraId,
        cameraName,
        confidence: Math.round(confidence * 1000) / 10,
        type: 'entry',
      });
    },
    [addAttendanceRecord, attendanceRecords]
  );

  const handleUnknownFace = useCallback(
    (cameraId: string, cameraName: string, similarity: number) => {
      // Second-layer cooldown (5 min per camera) to avoid flooding
      const last = cameraUnknownCooldown.current.get(cameraId) ?? 0;
      const now = Date.now();
      if (now - last < 5 * 60 * 1000) return;
      cameraUnknownCooldown.current.set(cameraId, now);

      const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
      addAlert({
        type: 'unauthorized',
        message: `Unrecognized face detected at ${cameraName}`,
        timestamp: ts,
        cameraId,
        severity: 'high',
      });
    },
    [addAlert]
  );

  const stats = [
    { label: 'Active Cameras', value: `${onlineCams}/${cameras.length}`, icon: Camera, color: 'cyan' },
    { label: 'Enrolled Faces', value: `${enrolled}/${employees.length}`, icon: Users, color: 'purple' },
    { label: 'Today Attendance', value: attendanceRecords.length, icon: Activity, color: 'green' },
    { label: 'Active Alerts', value: alerts.length, icon: ShieldAlert, color: 'red' },
  ];

  return (
    <div className="sv-main-content">
      <div className="sv-page-header">
        <div>
          <h1 className="sv-page-title">Security Dashboard</h1>
          <p className="sv-page-subtitle">
            {cameras.length} live camera{cameras.length !== 1 ? 's' : ''} · real-time surveillance
          </p>
        </div>
        <div className="sv-live-badge">LIVE</div>
      </div>

      <div className="sv-stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="sv-stat-card">
            <div className={`sv-stat-icon ${s.color}`}>
              <s.icon style={{ width: 20, height: 20 }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--sv-text-dim)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sv-section-title">
        <Eye style={{ width: 14, height: 14 }} /> Live Camera Feeds
      </div>

      {cameras.length === 0 ? (
        <div className="sv-panel" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--sv-text-dim)' }}>
            No cameras detected. Plug in a webcam and refresh.
          </div>
        </div>
      ) : (
        <div className="sv-camera-grid-container">
          <div
            className="sv-cctv-grid"
            style={{ gridTemplateColumns: `repeat(${Math.min(cameras.length, 3)}, 1fr)` }}
          >
            {cameras.map((cam, i) => (
              <LiveCameraTile
                key={cam.id}
                cameraId={cam.id}
                name={cam.name}
                location={cam.location}
                status={cam.enabled === false ? 'offline' : 'online'}
                deviceIndex={i}
                enabled={cam.enabled !== false}
                recognition={cam.enabled !== false}
                onRecognized={(empId, empName, conf) =>
                  handleRecognized(empId, empName, conf, cam.id, cam.name)
                }
                onUnknownFace={(camType) => handleUnknownFace(cam.id, cam.name, camType)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="sv-section-title" style={{ marginTop: 24 }}>
        <ShieldAlert style={{ width: 14, height: 14 }} /> Recent Alerts
      </div>

      {alerts.length === 0 ? (
        <div className="sv-panel" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--sv-text-muted)' }}>No active alerts</div>
        </div>
      ) : (
        alerts.slice(0, 6).map((a) => (
          <div
            key={a.id}
            className={`sv-alert-row ${a.severity}`}
            style={{ position: 'relative' }}
          >
            <AlertTriangle
              style={{
                width: 16,
                height: 16,
                color: a.severity === 'high' || a.severity === 'critical'
                  ? 'var(--sv-danger)'
                  : 'var(--sv-warning)',
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--sv-text)' }}>{a.message}</div>
              <div style={{ fontSize: 11, color: 'var(--sv-text-dim)', marginTop: 2 }}>
                {a.timestamp}
              </div>
            </div>
            <span
              className={`sv-badge ${
                a.severity === 'critical' || a.severity === 'high'
                  ? 'sv-badge-red'
                  : 'sv-badge-yellow'
              }`}
            >
              {a.severity}
            </span>
            <button
              onClick={() => dismissAlert(a.id)}
              className="sv-btn sv-btn-secondary"
              style={{ padding: '4px 8px', marginLeft: 8 }}
              title="Dismiss"
            >
              <X style={{ width: 12, height: 12 }} />
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default Dashboard;

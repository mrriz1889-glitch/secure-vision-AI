import React, { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Camera, Plus } from 'lucide-react';
import LiveCameraTile from './LiveCameraTile';

const CameraManagement: React.FC = () => {
  const { cameras, employees, attendanceRecords, addAttendanceRecord } = useStore();

  const handleRecognized = useCallback(
    (employeeId: string, employeeName: string, confidence: number, cameraId: string, cameraName: string) => {
      const cutoff = Date.now() - 4 * 60 * 60 * 1000;
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

  return (
    <div className="sv-main-content">
      <div className="sv-page-header">
        <div>
          <h1 className="sv-page-title">Camera Management</h1>
          <p className="sv-page-subtitle">
            {cameras.length} camera{cameras.length !== 1 ? 's' : ''} detected
          </p>
        </div>
        <button className="sv-btn sv-btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Add Camera
        </button>
      </div>

      {cameras.length === 0 ? (
        <div className="sv-panel" style={{ padding: 40, textAlign: 'center' }}>
          <Camera style={{ width: 32, height: 32, color: 'var(--sv-text-muted)', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13, color: 'var(--sv-text-dim)' }}>
            No cameras detected. Plug in a device and refresh.
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
                status="online"
                deviceIndex={i}
                recognition={true}
                onRecognized={(empId, empName, conf) =>
                  handleRecognized(empId, empName, conf, cam.id, cam.name)
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraManagement;

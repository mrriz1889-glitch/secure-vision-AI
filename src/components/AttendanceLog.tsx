import React from 'react';
import { useStore } from '../store/useStore';
import { ClipboardList, LogIn, LogOut } from 'lucide-react';

const AttendanceLog: React.FC = () => {
  const { attendanceRecords } = useStore();
  return (
    <div className="sv-main-content">
      <div className="sv-page-header">
        <div>
          <h1 className="sv-page-title">Attendance Log</h1>
          <p className="sv-page-subtitle">Facial recognition entry/exit records</p>
        </div>
        <div className="sv-live-badge">LIVE</div>
      </div>
      <div className="sv-panel">
        <div className="sv-panel-header">
          <div className="sv-panel-title"><ClipboardList style={{ width: 14, height: 14 }} /> All Records ({attendanceRecords.length})</div>
        </div>
        <div className="sv-att-row-header">
          <div></div><div>Employee</div><div>Timestamp</div><div>Type</div><div>Camera & Confidence</div>
        </div>
        {attendanceRecords.map((rec, i) => (
          <div key={rec.id} className={`sv-att-row ${i === 0 ? 'latest' : ''}`}>
            <div className={`sv-avatar ${rec.type === 'entry' ? 'enrolled' : 'pending'}`} style={{ width: 30, height: 30, fontSize: 10 }}>
              {rec.type === 'entry' ? <LogIn style={{ width: 12, height: 12 }} /> : <LogOut style={{ width: 12, height: 12 }} />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{rec.employeeName}</div>
              <div style={{ fontSize: 11, color: 'var(--sv-text-dim)' }}>{rec.employeeId}</div>
            </div>
            <div className="sv-mono" style={{ color: 'var(--sv-text-dim)' }}>{rec.timestamp}</div>
            <div>
              <span className={`sv-badge ${rec.type === 'entry' ? 'sv-badge-green' : 'sv-badge-red'}`}>{rec.type.toUpperCase()}</span>
            </div>
            <div>
              <div style={{ fontSize: 12 }}>{rec.cameraName}</div>
              <div className="sv-confidence-bar">
                <div className="sv-confidence-track">
                  <div className={`sv-confidence-fill ${rec.confidence > 97 ? 'high' : rec.confidence > 94 ? 'medium' : 'low'}`} style={{ width: `${rec.confidence}%` }} />
                </div>
                <div className="sv-confidence-value">{rec.confidence}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default AttendanceLog;

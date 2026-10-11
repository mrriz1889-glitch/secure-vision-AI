import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Shield, Users, Camera, Activity, Server, Edit3, Check, X } from 'lucide-react';

const AdminPanel: React.FC = () => {
  const { cameras, employees, attendanceRecords, alerts, updateCamera } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftLocation, setDraftLocation] = useState('');

  const startEdit = (id: string, name: string, location: string) => {
    setEditingId(id);
    setDraftName(name);
    setDraftLocation(location);
  };

  const saveEdit = (id: string) => {
    if (!draftName.trim()) return;
    updateCamera(id, { name: draftName.trim(), location: draftLocation.trim() });
    setEditingId(null);
  };

  return (
    <div className="sv-main-content">
      <div className="sv-page-header">
        <div>
          <h1 className="sv-page-title">Admin Panel</h1>
          <p className="sv-page-subtitle">System administration & diagnostics</p>
        </div>
      </div>

      <div className="sv-stats-grid">
        <div className="sv-stat-card">
          <div className="sv-stat-icon cyan"><Camera style={{ width: 20, height: 20 }} /></div>
          <div style={{ marginTop: 12 }}><div style={{ fontSize: 22, fontWeight: 700 }}>{cameras.length}</div><div style={{ fontSize: 12, color: 'var(--sv-text-dim)' }}>Total Cameras</div></div>
        </div>
        <div className="sv-stat-card">
          <div className="sv-stat-icon purple"><Users style={{ width: 20, height: 20 }} /></div>
          <div style={{ marginTop: 12 }}><div style={{ fontSize: 22, fontWeight: 700 }}>{employees.length}</div><div style={{ fontSize: 12, color: 'var(--sv-text-dim)' }}>Employees</div></div>
        </div>
        <div className="sv-stat-card">
          <div className="sv-stat-icon green"><Activity style={{ width: 20, height: 20 }} /></div>
          <div style={{ marginTop: 12 }}><div style={{ fontSize: 22, fontWeight: 700 }}>{attendanceRecords.length}</div><div style={{ fontSize: 12, color: 'var(--sv-text-dim)' }}>Attendance Records</div></div>
        </div>
        <div className="sv-stat-card">
          <div className="sv-stat-icon red"><Shield style={{ width: 20, height: 20 }} /></div>
          <div style={{ marginTop: 12 }}><div style={{ fontSize: 22, fontWeight: 700 }}>{alerts.length}</div><div style={{ fontSize: 12, color: 'var(--sv-text-dim)' }}>Active Alerts</div></div>
        </div>
      </div>

      {/* ─── Rename cameras ────────────────────────────── */}
      <div className="sv-panel">
        <div className="sv-panel-header">
          <div className="sv-panel-title">
            <Edit3 style={{ width: 14, height: 14 }} /> Camera Configuration
          </div>
        </div>
        <div className="sv-panel-body">
          <div style={{ fontSize: 11, color: 'var(--sv-text-dim)', marginBottom: 12 }}>
            Rename cameras and update their locations. Changes save immediately.
          </div>

          {cameras.map((cam, i) => {
            const isEditing = editingId === cam.id;
            return (
              <div
                key={cam.id}
                className="sv-setting-row"
                style={{ alignItems: isEditing ? 'flex-start' : 'center' }}
              >
                <div className="sv-setting-info" style={{ flex: 1, alignItems: isEditing ? 'flex-start' : 'center' }}>
                  <div className="sv-setting-icon">
                    <Camera style={{ width: 14, height: 14 }} />
                  </div>
                  {isEditing ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        className="sv-input"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder="Camera name"
                        autoFocus
                        style={{ fontSize: 12, padding: '6px 10px' }}
                      />
                      <input
                        className="sv-input"
                        value={draftLocation}
                        onChange={(e) => setDraftLocation(e.target.value)}
                        placeholder="Location"
                        style={{ fontSize: 11, padding: '6px 10px' }}
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="sv-setting-label">
                        {cam.name}
                        <span style={{ color: 'var(--sv-text-muted)', fontWeight: 400, marginLeft: 8, fontSize: 10 }}>
                          #{i} · {cam.id}
                        </span>
                      </div>
                      <div className="sv-setting-desc">
                        {cam.location} · {cam.type} · <span style={{ color: cam.status === 'online' ? 'var(--sv-accent)' : 'var(--sv-text-dim)' }}>{cam.status}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  {isEditing ? (
                    <>
                      <button onClick={() => saveEdit(cam.id)} className="sv-btn sv-btn-success" style={{ padding: '5px 10px' }}>
                        <Check style={{ width: 12, height: 12 }} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="sv-btn sv-btn-secondary" style={{ padding: '5px 10px' }}>
                        <X style={{ width: 12, height: 12 }} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startEdit(cam.id, cam.name, cam.location)}
                      className="sv-btn sv-btn-secondary"
                      style={{ padding: '5px 10px' }}
                    >
                      <Edit3 style={{ width: 12, height: 12 }} /> Edit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── System info ───────────────────────────────── */}
      <div className="sv-panel" style={{ marginTop: 20 }}>
        <div className="sv-panel-header">
          <div className="sv-panel-title">
            <Server style={{ width: 14, height: 14 }} /> System Information
          </div>
        </div>
        <div className="sv-panel-body">
          <div className="sv-setting-row">
            <div className="sv-setting-info"><div><div className="sv-setting-label">System Version</div><div className="sv-setting-desc">Current build</div></div></div>
            <div className="sv-mono">v3.0.0</div>
          </div>
          <div className="sv-setting-row">
            <div className="sv-setting-info"><div><div className="sv-setting-label">Recognition Engine</div><div className="sv-setting-desc">ArcFace via CompreFace (Docker)</div></div></div>
            <div className="sv-mono">CompreFace · ArcFace</div>
          </div>
          <div className="sv-setting-row">
            <div className="sv-setting-info"><div><div className="sv-setting-label">Storage</div><div className="sv-setting-desc">IndexedDB (browser-local)</div></div></div>
            <div className="sv-mono">{employees.length} employees · {attendanceRecords.length} records</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

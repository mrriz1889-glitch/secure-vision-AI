import React from 'react';
import { useStore } from '../store/useStore';
import { Monitor, Shield, Camera, Users, ClipboardList, Settings, AlertTriangle, Lock, LogOut } from 'lucide-react';
import { logout } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const { activeView, setActiveView, alerts } = useStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const menuItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: Monitor },
    { id: 'cameras' as const, label: 'Camera Management', icon: Camera },
    { id: 'enrollment' as const, label: 'Face Enrollment', icon: Users },
    { id: 'attendance' as const, label: 'Attendance Log', icon: ClipboardList },
    { id: 'admin' as const, label: 'Admin Panel', icon: Shield },
    { id: 'settings' as const, label: 'Security Settings', icon: Settings },
  ];
  return (
    <div className="sv-sidebar" style={{ width: 260, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--sv-border)' }}>
        <div className="sv-logo-box" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
          <div className="sv-logo-icon" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield style={{ width: 22, height: 22, color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>SECUREVISION<span style={{ color: 'var(--sv-primary)' }}>Ai</span></h1>
            <p style={{ color: 'var(--sv-text-dim)', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase' }}>Intelligent Surveillance</p>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {menuItems.map((item) => (
          <button key={item.id} onClick={() => setActiveView(item.id)} className={`sv-nav-item ${activeView === item.id ? 'active' : ''}`}>
            <item.icon style={{ width: 16, height: 16 }} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div style={{ padding: 12, borderTop: '1px solid var(--sv-border)' }}>
        <button onClick={() => setActiveView('dashboard')} className="sv-alert-badge">
          <AlertTriangle style={{ width: 16, height: 16 }} />
          <span>Active Alerts</span>
          <span className="sv-alert-count">{alerts.length}</span>
        </button>
      </div>
      <div style={{ padding: '0 12px 8px' }}>
        <button onClick={handleLogout} className="sv-btn sv-btn-secondary" style={{ width: '100%', fontSize: 11 }}>
          <LogOut style={{ width: 12, height: 12 }} /> Sign Out
        </button>
      </div>
      <div className="sv-system-status">
        <div className="sv-status-line"><div className="sv-status-dot online" style={{ width: 6, height: 6 }}></div><span>System Operational</span></div>
        <div className="sv-status-line"><Lock style={{ width: 11, height: 11, color: 'var(--sv-text-muted)' }} /><span>AES-256 Encrypted</span></div>
      </div>
    </div>
  );
};
export default Sidebar;

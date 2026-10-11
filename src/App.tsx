import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import { getSession } from './lib/auth';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CameraManagement from './components/CameraManagement';
import FaceEnrollment from './components/FaceEnrollment';
import AttendanceLog from './components/AttendanceLog';
import AdminPanel from './components/AdminPanel';
import SecuritySettings from './components/SecuritySettings';
import EnrollPage from './pages/EnrollPage';
import SuccessPage from './pages/SuccessPage';
import LoginPage from './pages/LoginPage';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const session = getSession();
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

const AdminShell: React.FC = () => {
  const { activeView, hydrateCameras } = useStore();

  useEffect(() => {
    const handler = () => hydrateCameras();
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler);
  }, [hydrateCameras]);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'cameras': return <CameraManagement />;
      case 'enrollment': return <FaceEnrollment />;
      case 'attendance': return <AttendanceLog />;
      case 'admin': return <AdminPanel />;
      case 'settings': return <SecuritySettings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--sv-bg-deep)', overflow: 'hidden' }}>
      <Sidebar />
      {renderView()}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no login required */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/enroll/success" element={<SuccessPage />} />
        <Route path="/enroll/:token" element={<EnrollPage />} />

        {/* Protected routes — login required */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AdminShell />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

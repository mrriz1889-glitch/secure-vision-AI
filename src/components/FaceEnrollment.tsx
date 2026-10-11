import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { UserPlus, Send, Link as LinkIcon, Trash2, Copy, CheckCircle, Clock } from 'lucide-react';
import * as db from '../lib/db';

const FaceEnrollment: React.FC = () => {
  const { employees, enrollmentLinks, createEnrollmentLink } = useStore();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!email || !name) return;
    await createEnrollmentLink(email, name, department);
    setEmail('');
    setName('');
  };

  const getLinkUrl = (token: string) => `${window.location.origin}/enroll/${token}`;

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(getLinkUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareLink = async (token: string, employeeName: string, emailAddr: string) => {
    const url = getLinkUrl(token);
    const text = `Hi ${employeeName}, please complete your face enrollment for SecureVision AI: ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'SecureVision AI Enrollment', text, url });
      } catch {
        /* user cancelled */
      }
    } else {
      // Fallback: open mailto
      window.location.href = `mailto:${emailAddr}?subject=SecureVision%20AI%20Enrollment&body=${encodeURIComponent(text)}`;
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Delete this employee?')) return;
    await db.deleteEmployee(id);
    useStore.setState((s) => ({
      employees: s.employees.filter((e) => e.id !== id),
    }));
  };

  const isExhausted = (l: any) => l.used || (l.useCount ?? 0) >= (l.maxUses ?? 1);
  const activeLinks = enrollmentLinks.filter(
    (l: any) => !isExhausted(l) && new Date(l.expiresAt) > new Date()
  );
  const expiredOrUsed = enrollmentLinks.filter(
    (l: any) => isExhausted(l) || new Date(l.expiresAt) <= new Date()
  );

  return (
    <div className="sv-main-content">
      <div className="sv-page-header">
        <div>
          <h1 className="sv-page-title">Face Enrollment</h1>
          <p className="sv-page-subtitle">
            Generate self-service enrollment links and share them with employees
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
        {/* ─── LEFT: Generate link ─────────────────────────── */}
        <div className="sv-panel">
          <div className="sv-panel-header">
            <div className="sv-panel-title">
              <UserPlus style={{ width: 14, height: 14 }} /> New Enrollment Link
            </div>
          </div>
          <div className="sv-panel-body">
            <div
              className="sv-security-notice"
              style={{ marginBottom: 16, borderColor: 'rgba(0,229,255,0.2)' }}
            >
              <div style={{ fontSize: 11, color: 'var(--sv-primary)', fontWeight: 500 }}>
                How it works
              </div>
              <div style={{ fontSize: 11, color: 'var(--sv-text-dim)', marginTop: 4 }}>
                Fill in the employee details, generate a unique link, and share it via email or
                chat. The employee opens the link on their own device, grants camera access, and
                captures their own face. No admin involvement needed.
              </div>
            </div>

            <label className="sv-label">Full Name</label>
            <input
              className="sv-input"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            <label className="sv-label">Email</label>
            <input
              className="sv-input"
              type="email"
              placeholder="jane@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            <label className="sv-label">Department</label>
            <select
              className="sv-input"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={{ marginBottom: 12 }}
            >
              <option>Engineering</option>
              <option>Security</option>
              <option>IT</option>
              <option>HR</option>
              <option>Finance</option>
              <option>Operations</option>
            </select>

            <button
              onClick={handleGenerate}
              className="sv-btn sv-btn-primary"
              style={{ width: '100%' }}
              disabled={!email || !name}
            >
              <Send style={{ width: 14, height: 14 }} /> Generate Enrollment Link
            </button>
          </div>
        </div>

        {/* ─── RIGHT: Active links ─────────────────────────── */}
        <div className="sv-panel">
          <div className="sv-panel-header">
            <div className="sv-panel-title">
              <LinkIcon style={{ width: 14, height: 14 }} /> Active Links ({activeLinks.length})
            </div>
          </div>
          <div className="sv-panel-body" style={{ maxHeight: 520, overflowY: 'auto' }}>
            {activeLinks.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--sv-text-muted)',
                  padding: 24,
                  textAlign: 'center',
                }}
              >
                No active links. Generate one on the left.
              </div>
            )}
            {activeLinks.map((l) => (
              <div
                key={l.id}
                style={{
                  padding: 12,
                  background: 'rgba(0,229,255,0.04)',
                  border: '1px solid rgba(0,229,255,0.15)',
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--sv-text-dim)' }}>
                      {l.email} · {l.department}
                    </div>
                  </div>
                  <span className="sv-badge sv-badge-cyan">
                    <Clock style={{ width: 9, height: 9 }} /> ACTIVE
                  </span>
                </div>

                <div
                  className="sv-mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--sv-primary)',
                    padding: '6px 8px',
                    background: 'var(--sv-bg-deep)',
                    borderRadius: 4,
                    wordBreak: 'break-all',
                    marginBottom: 4,
                  }}
                >
                  /enroll/{l.token}
                </div>
                <div style={{ fontSize: 10, color: 'var(--sv-text-dim)', marginBottom: 8 }}>
                  Uses: {l.useCount ?? 0} / {l.maxUses ?? 1}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => copyLink(l.token)}
                    className="sv-btn sv-btn-secondary"
                    style={{ flex: 1, padding: '6px 10px', fontSize: 11 }}
                  >
                    {copied === l.token ? (
                      <>
                        <CheckCircle style={{ width: 11, height: 11 }} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy style={{ width: 11, height: 11 }} /> Copy Link
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => shareLink(l.token, l.name, l.email)}
                    className="sv-btn sv-btn-primary"
                    style={{ flex: 1, padding: '6px 10px', fontSize: 11 }}
                  >
                    <Send style={{ width: 11, height: 11 }} /> Share
                  </button>
                </div>
              </div>
            ))}

            {expiredOrUsed.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="sv-section-title" style={{ fontSize: 11 }}>
                  History ({expiredOrUsed.length})
                </div>
                {expiredOrUsed.slice(-5).map((l) => (
                  <div key={l.id} className="sv-link-item" style={{ opacity: 0.6 }}>
                    <div style={{ flex: 1 }}>
                      <div className="sv-link-email">{l.name}</div>
                      <div className="sv-link-url">{l.email}</div>
                    </div>
                    <span className={`sv-badge ${(l as any).useCount > 0 ? 'sv-badge-green' : 'sv-badge-red'}`}>
                      {(l as any).useCount > 0 ? `USED ${(l as any).useCount}/${(l as any).maxUses ?? 1}` : 'EXPIRED'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Enrolled employees roster ───────────────────── */}
      <div className="sv-panel" style={{ marginTop: 20 }}>
        <div className="sv-panel-header">
          <div className="sv-panel-title">
            <UserPlus style={{ width: 14, height: 14 }} /> Enrolled Employees ({employees.length})
          </div>
        </div>
        <div className="sv-panel-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
          {employees.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--sv-text-muted)', padding: 20, textAlign: 'center' }}>
              No employees enrolled yet
            </div>
          )}
          {employees.map((emp) => (
            <div key={emp.id} className="sv-emp-item">
              <div className={`sv-avatar ${emp.faceEnrolled ? 'enrolled' : 'pending'}`}>
                {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{emp.name}</div>
                <div style={{ fontSize: 11, color: 'var(--sv-text-dim)' }}>
                  {emp.email} · {emp.department}
                </div>
              </div>
              <span className={`sv-badge ${emp.faceEnrolled ? 'sv-badge-green' : 'sv-badge-yellow'}`}>
                {emp.faceEnrolled ? 'ENROLLED' : 'PENDING'}
              </span>
              <button
                onClick={() => deleteEmployee(emp.id)}
                className="sv-btn sv-btn-danger"
                style={{ padding: '4px 8px', marginLeft: 6 }}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FaceEnrollment;

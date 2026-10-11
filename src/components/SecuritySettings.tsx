import React, { useEffect, useState } from 'react';
import { Shield, Bell, Lock, Eye, Fingerprint, Wifi } from 'lucide-react';

type ToggleKey = 'motion' | 'nightVision' | 'encryption' | 'notifications' | 'autoLock' | 'twoFactor';
type ToggleState = Record<ToggleKey, boolean>;

const DEFAULT_STATE: ToggleState = {
  motion: true,
  nightVision: false,
  encryption: true,
  notifications: false,
  autoLock: true,
  twoFactor: true,
};

const STORAGE_KEY = 'sv-security-settings';

function loadToggles(): ToggleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_STATE;
}

function saveToggles(state: ToggleState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Emit a window event so other components can react to changes
  window.dispatchEvent(new CustomEvent('sv-settings-changed', { detail: state }));
}

const SecuritySettings: React.FC = () => {
  const [toggles, setToggles] = useState<ToggleState>(loadToggles);

  useEffect(() => {
    saveToggles(toggles);
  }, [toggles]);

  const toggle = (k: ToggleKey) => setToggles((t) => ({ ...t, [k]: !t[k] }));

  const items = [
    { key: 'motion' as const,        label: 'Motion Detection',   desc: 'Alert on detected movement',        icon: Eye },
    { key: 'nightVision' as const,   label: 'Night Vision',       desc: 'Green IR filter on live feeds',     icon: Wifi },
    { key: 'encryption' as const,    label: 'AES-256 Encryption', desc: 'End-to-end data encryption',        icon: Lock },
    { key: 'notifications' as const, label: 'Push Notifications', desc: 'Mobile alert delivery',             icon: Bell },
    { key: 'autoLock' as const,      label: 'Auto-Lock Doors',    desc: 'Lock on unauthorized access',       icon: Shield },
    { key: 'twoFactor' as const,     label: '2FA Admin Access',   desc: 'Require 2FA for admin login',       icon: Fingerprint },
  ];

  return (
    <div className="sv-main-content">
      <div className="sv-page-header">
        <div>
          <h1 className="sv-page-title">Security Settings</h1>
          <p className="sv-page-subtitle">Configure system security parameters</p>
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        {items.map((item) => (
          <div key={item.key} className="sv-setting-row">
            <div className="sv-setting-info">
              <div className="sv-setting-icon">
                <item.icon style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <div className="sv-setting-label">{item.label}</div>
                <div className="sv-setting-desc">{item.desc}</div>
              </div>
            </div>
            <button
              onClick={() => toggle(item.key)}
              className={`sv-toggle ${toggles[item.key] ? 'on' : 'off'}`}
              aria-pressed={toggles[item.key]}
            />
          </div>
        ))}

        <div className="sv-security-notice" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-warning)' }}>
            Security Notice
          </div>
          <div style={{ fontSize: 11, color: 'var(--sv-text-dim)', marginTop: 4 }}>
            Motion detection and night vision take effect on the Live Dashboard feeds immediately.
            Other settings are persisted and applied where applicable.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;

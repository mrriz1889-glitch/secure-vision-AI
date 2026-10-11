import React, { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

const SuccessPage: React.FC = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-sv-success-scroll', 'true');
    style.textContent = `
      html, body, #root {
        overflow: auto !important;
        height: auto !important;
        min-height: 100vh;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--sv-bg-deep)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: 24,
      }}
    >
      <CheckCircle style={{ width: 72, height: 72, color: 'var(--sv-accent)' }} />
      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 20, color: 'var(--sv-text)' }}>
        You're enrolled!
      </h1>
      <p
        style={{
          fontSize: 14,
          color: 'var(--sv-text-dim)',
          marginTop: 10,
          textAlign: 'center',
          maxWidth: 400,
        }}
      >
        Your face has been successfully registered with SecureVision AI. You can now close this
        window.
      </p>
    </div>
  );
};

export default SuccessPage;

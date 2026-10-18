import React from 'react';

interface ToastProps {
  message: string | null;
  icon?: string;
}

export const Toast: React.FC<ToastProps> = ({ message, icon = "fa-circle-check" }) => {
  return (
    <div id="toast" className={`toast ${message ? 'show' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <i id="toastIcon" className={`fa-solid ${icon}`}></i>
        <span id="toastMsg" style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
          {message || ''}
        </span>
      </div>
    </div>
  );
};

import React from 'react';

interface PwaInstallBannerProps {
  show: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({
  show,
  onInstall,
  onDismiss
}) => {
  return (
    <div className={`pwa-install-banner ${show ? 'show' : ''}`}>
      <div className="pwa-content">
        <img
          src="https://i.ibb.co.com/7JnHCrB5/Chat-GPT-Image-Jul-29-2026-09-55-12-PM.png"
          alt="SASTC Portal"
          className="pwa-app-icon"
        />
        <div className="pwa-text">
          <h4>Install SASTC Portal</h4>
          <p>হোম স্ক্রিনে অ্যাপ হিসেবে ইনস্টল করে দ্রুত নোটিশ পান</p>
        </div>
      </div>
      <div className="pwa-actions">
        <button
          type="button"
          onClick={onDismiss}
          className="btn-pwa-dismiss"
        >
          Not now
        </button>
        <button
          type="button"
          id="btnInstallApp"
          className="btn-pwa-install"
          onClick={onInstall}
        >
          <i className="fa-solid fa-download"></i> Install
        </button>
      </div>
    </div>
  );
};

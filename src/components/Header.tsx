import React, { useState, useEffect } from 'react';

export const Header: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > lastScrollY && currentScrollY > 60) {
            setIsHidden(true);
          } else if (currentScrollY < lastScrollY) {
            setIsHidden(false);
          }
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header className={`app-header ${isHidden ? 'header-hidden' : ''}`}>
      <div className="header-brand">
        <div className="design-logo">
          <img
            src="https://i.ibb.co.com/7JnHCrB5/Chat-GPT-Image-Jul-29-2026-09-55-12-PM.png"
            alt="Portal Logo"
            id="logoImg"
          />
        </div>
        <div>
          <h1 className="brand-title">
            SASTC <span className="portal-text">PORTAL</span>
          </h1>
        </div>
      </div>
      <div className="header-actions">
        {isOffline && (
          <div id="headerOfflineIcon" className="header-offline" title="Offline Mode">
            <i className="fa-solid fa-cloud-arrow-down"></i>
          </div>
        )}
      </div>
    </header>
  );
};

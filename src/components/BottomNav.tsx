import React, { useEffect, useState } from 'react';
import { TabType } from '../types';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  noticeBadgeCount: number;
  resultBadgeCount: number;
  isModalOpen?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  noticeBadgeCount,
  resultBadgeCount,
  isModalOpen
}) => {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
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
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = (tab: TabType) => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    onSelectTab(tab);
  };

  const navClass = `bottom-nav ${isHidden || isModalOpen ? 'nav-hidden' : ''}`;

  return (
    <nav className={navClass}>
      <button
        type="button"
        className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => handleClick('home')}
      >
        <i className="fa-solid fa-house"></i>
        <span>Home</span>
      </button>

      <button
        type="button"
        className={`nav-item ${activeTab === 'notice' ? 'active' : ''}`}
        onClick={() => handleClick('notice')}
      >
        <i className="fa-solid fa-bell"></i>
        <span>Notice</span>
        {noticeBadgeCount > 0 && (
          <span className="nav-badge">{noticeBadgeCount}</span>
        )}
      </button>

      <button
        type="button"
        className={`nav-item ${activeTab === 'result' ? 'active' : ''}`}
        onClick={() => handleClick('result')}
      >
        <i className="fa-solid fa-chart-column"></i>
        <span>Result</span>
        {resultBadgeCount > 0 && (
          <span className="nav-badge">{resultBadgeCount}</span>
        )}
      </button>

      <button
        type="button"
        className={`nav-item ${activeTab === 'calculator' ? 'active' : ''}`}
        onClick={() => handleClick('calculator')}
      >
        <i className="fa-solid fa-calculator"></i>
        <span>CGPA</span>
      </button>

      <button
        type="button"
        className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => handleClick('settings')}
      >
        <i className="fa-solid fa-gear"></i>
        <span>Settings</span>
      </button>
    </nav>
  );
};

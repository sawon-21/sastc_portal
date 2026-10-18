import React, { useEffect, useState } from 'react';
import { NoticeItem, DeptCode } from '../../types';
import { NoticeCard } from '../NoticeCard';
import { formatPdfUrl, getNoticeKey } from '../../utils/notices';

interface HomeViewProps {
  masterDataset: NoticeItem[];
  deptPreference: DeptCode;
  onOpenNotice: (url: string, title: string, textContent?: string, itemKey?: string) => void;
  onShare: (url: string, title: string, itemKey?: string) => void;
  isFavorite?: (key: string) => boolean;
  onToggleFavorite?: (item: NoticeItem) => void;
  isOfflineCached?: (key: string) => boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  masterDataset,
  deptPreference,
  onOpenNotice,
  onShare,
  isFavorite,
  onToggleFavorite,
  isOfflineCached
}) => {
  const [sastcNotices, setSastcNotices] = useState<NoticeItem[]>([]);
  const [isLoadingSastc, setIsLoadingSastc] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Filter master dataset for hero card based on deptPreference
  const filteredSet = deptPreference === "ALL"
    ? masterDataset
    : masterDataset.filter(item => item._deptCode === deptPreference);

  const heroItem = filteredSet[0] || masterDataset[0];
  const heroKey = heroItem ? getNoticeKey(heroItem) : '';
  const isHeroFav = heroKey && isFavorite ? isFavorite(heroKey) : false;

  useEffect(() => {
    setIsLoadingSastc(true);
    fetch("/sastc-notices.json")
      .then(res => res.json())
      .then((data: NoticeItem[]) => {
        let list = data;
        if (deptPreference !== "ALL") {
          list = data.filter(item => {
            const code = item.deptCode || "SASTC";
            return code === deptPreference || code === "SASTC";
          });
        }
        list.sort((a, b) => {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateB - dateA;
        });
        setSastcNotices(list);
        setIsLoadingSastc(false);
      })
      .catch(err => {
        console.error("Failed to load sastc-notices.json", err);
        setHasError(true);
        setIsLoadingSastc(false);
      });
  }, [deptPreference]);

  const handleHeroClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!heroItem) return;
    const rawLink = heroItem.pdf || heroItem.url || heroItem.pdf_url || heroItem.link || heroItem.pdfUrl || "";
    const isTextOnly = !rawLink || rawLink === "#";
    const pdfUrl = isTextOnly ? "#" : formatPdfUrl(rawLink);
    const textContent = isTextOnly ? (heroItem.desc || heroItem.description || heroItem.text || "") : undefined;
    onOpenNotice(pdfUrl, heroItem.title, textContent, heroKey);
  };

  return (
    <section id="view-home" className="tab-view active">
      {/* Hero Highlight Card */}
      {heroItem ? (
        <div className="hero-card card-animate visible" id="heroLatestCard">
          <div className="flex items-center justify-between mb-2">
            <div className="hero-badge m-0">
              <i className="fa-solid fa-bolt text-amber-500"></i> Latest Notice
            </div>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(heroItem)}
                className={`btn-icon-action btn-icon-bookmark ${isHeroFav ? 'active-bookmark' : ''}`}
                title={isHeroFav ? "Remove Bookmark" : "Save to Favorites"}
                aria-label="Bookmark Latest Notice"
              >
                <i className={`fa-${isHeroFav ? 'solid' : 'regular'} fa-bookmark text-[12px]`}></i>
              </button>
            )}
          </div>

          <h3 className="hero-title">{heroItem.title}</h3>
          <p className="hero-desc">
            {heroItem.department || 'HSTU'} • {heroItem.category || 'Notice'}
          </p>
          <span className="hero-date">
            <i className="fa-regular fa-clock"></i> {heroItem.date || 'Recent'}
          </span>
          <div className="hero-actions flex items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={handleHeroClick}
            >
              <i className="fa-solid fa-file-pdf"></i> Read Document
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-xl border border-slate-200/90 bg-white text-slate-700 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/70 font-semibold text-xs inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              onClick={() => {
                const rawLink = heroItem.pdf || heroItem.url || heroItem.pdf_url || heroItem.link || heroItem.pdfUrl || "";
                onShare(rawLink, heroItem.title, heroKey);
              }}
              title="Share Link"
              aria-label="Share Latest Notice"
            >
              <i className="fa-solid fa-share-nodes text-[11px]"></i>
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="hero-card card-animate visible">
          <div className="hero-badge">
            <i className="fa-solid fa-bolt"></i> Latest Notice
          </div>
          <h3 className="hero-title">Academic Notice</h3>
          <p className="hero-desc">Loading latest department notice...</p>
          <span className="hero-date">
            <i className="fa-regular fa-clock"></i> Recent
          </span>
        </div>
      )}

      {/* SASTC Notices Section */}
      <div className="section-header">
        <h3>
          <i className="fa-solid fa-building-columns"></i> SASTC Notices only
        </h3>
      </div>

      <div id="sastcNoticeList" className="notice-list">
        {isLoadingSastc ? (
          <div className="state-box">
            <i className="fa-solid fa-circle-notch spinner"></i>
            <span>Loading SASTC notices...</span>
          </div>
        ) : hasError ? (
          <div className="state-box">
            <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--accent-red)' }}></i>
            <span>Failed to load SASTC notices.</span>
          </div>
        ) : sastcNotices.length === 0 ? (
          <div className="state-box">
            <i className="fa-regular fa-folder-open"></i>
            <span>No SASTC notices found for {deptPreference !== "ALL" ? deptPreference : "any department"}.</span>
          </div>
        ) : (
          sastcNotices.map((item, idx) => {
            const key = getNoticeKey(item);
            return (
              <NoticeCard
                key={item.id || item._key || idx}
                item={item}
                hideCopy={false}
                isFavorite={isFavorite ? isFavorite(key) : false}
                isOfflineCached={isOfflineCached ? isOfflineCached(key) : false}
                onOpenNotice={onOpenNotice}
                onShare={onShare}
                onToggleFavorite={onToggleFavorite}
              />
            );
          })
        )}
      </div>
    </section>
  );
};

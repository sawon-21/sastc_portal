import React from 'react';
import { NoticeItem } from '../types';
import {
  detectDeptCode,
  isResultNotice,
  getDeptIcon,
  getTagInfo,
  formatDateString,
  formatPdfUrl,
  getNoticeKey
} from '../utils/notices';

interface NoticeCardProps {
  item: NoticeItem;
  hideCopy?: boolean;
  isFavorite?: boolean;
  isOfflineCached?: boolean;
  onOpenNotice: (url: string, title: string, textContent?: string, itemKey?: string) => void;
  onShare: (url: string, title: string, itemKey?: string) => void;
  onToggleFavorite?: (item: NoticeItem) => void;
}

export const NoticeCard: React.FC<NoticeCardProps> = ({
  item,
  hideCopy = false,
  isFavorite = false,
  isOfflineCached = false,
  onOpenNotice,
  onShare,
  onToggleFavorite
}) => {
  const isResult = item._isResult !== undefined ? item._isResult : isResultNotice(item);
  const displayBadge = isResult
    ? "RESULT"
    : (item._deptCode || detectDeptCode(`${item.department || ''} ${item.title || ''}`));
  const deptIcon = getDeptIcon(displayBadge);

  const rawLink = item.pdf || item.url || item.pdf_url || item.link || item.pdfUrl || "";
  const isTextOnly = !rawLink || rawLink === "#";
  const pdfUrl = isTextOnly ? "#" : formatPdfUrl(rawLink);

  const title = item.title || "Untitled Notice";
  const dateFormatted = formatDateString(item.date) || "N/A";
  const tagInfo = getTagInfo(item.date);
  const itemKey = getNoticeKey(item);

  const rawDesc = item.desc || item.description || item.text || "";
  const textContent = isTextOnly ? (rawDesc || "No detailed description available.") : undefined;

  let linkMatch = rawDesc.match(/href=['"]([^'"]+)['"]/);
  const visitLink = linkMatch ? linkMatch[1] : null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onOpenNotice(pdfUrl, title, textContent, itemKey);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare(pdfUrl, title, itemKey);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(item);
    }
  };

  return (
    <div className="card card-animate visible">
      <div className="card-header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge-dept">
            <i className={deptIcon}></i> {displayBadge}
          </span>
          {tagInfo && (
            <span className={`badge-time ${tagInfo.className}`}>{tagInfo.text}</span>
          )}
          {(isOfflineCached || isFavorite) && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
              <i className="fa-solid fa-cloud-arrow-down text-[9px]"></i> Offline
            </span>
          )}
        </div>
        <span className="date">
          <i className="fa-regular fa-calendar"></i> {dateFormatted}
        </span>
      </div>

      <a
        href={pdfUrl}
        className="notice-title"
        onClick={handleClick}
      >
        {title}
      </a>

      {rawDesc && (
        <div
          className="notice-desc-preview"
          dangerouslySetInnerHTML={{ __html: rawDesc }}
        />
      )}

      <div className="card-footer">
        <span className="category-tag">
          <i className="fa-solid fa-tag"></i> {item.category || "General"}
        </span>
        <div className="btn-actions">
          {onToggleFavorite && (
            <button
              type="button"
              className={`btn-icon-action btn-icon-bookmark ${isFavorite ? 'active-bookmark' : ''}`}
              onClick={handleFavoriteClick}
              title={isFavorite ? "Remove Bookmark" : "Save to Favorites"}
              aria-label={isFavorite ? "Remove Bookmark" : "Save to Favorites"}
            >
              <i className={`fa-${isFavorite ? 'solid' : 'regular'} fa-bookmark text-[12px]`}></i>
            </button>
          )}

          {!hideCopy && (
            <button
              type="button"
              className="btn-icon-action btn-icon-share"
              onClick={handleShareClick}
              title="Quick Share Link"
              aria-label="Share Link"
            >
              <i className="fa-solid fa-share-nodes text-[12px]"></i>
            </button>
          )}

          {visitLink && (
            <a
              href={visitLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-visit"
              onClick={(e) => e.stopPropagation()}
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
              <span>Visit</span>
            </a>
          )}

          <button
            type="button"
            className="btn-view"
            onClick={handleClick}
          >
            <span>View</span>
          </button>
        </div>
      </div>
    </div>
  );
};

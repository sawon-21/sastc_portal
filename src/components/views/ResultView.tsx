import React from 'react';
import { NoticeItem, DeptCode } from '../../types';
import { NoticeCard } from '../NoticeCard';
import { getNoticeKey } from '../../utils/notices';

interface ResultViewProps {
  masterDataset: NoticeItem[];
  deptPreference: DeptCode;
  onOpenNotice: (url: string, title: string, textContent?: string, itemKey?: string) => void;
  onShare: (url: string, title: string, itemKey?: string) => void;
  isFavorite?: (key: string) => boolean;
  onToggleFavorite?: (item: NoticeItem) => void;
  isOfflineCached?: (key: string) => boolean;
}

export const ResultView: React.FC<ResultViewProps> = ({
  masterDataset,
  deptPreference,
  onOpenNotice,
  onShare,
  isFavorite,
  onToggleFavorite,
  isOfflineCached
}) => {
  let results = masterDataset.filter(item => {
    if (!item._isResult) return false;
    const text = `${item.title || ''} ${item.department || ''} ${item.category || ''}`.toUpperCase();
    return /\bSASTC\b/i.test(text);
  });

  if (deptPreference !== "ALL") {
    results = results.filter(item => {
      const text = `${item.title || ''} ${item.department || ''} ${item.category || ''}`.toUpperCase();
      return new RegExp(`\\b${deptPreference}\\b`, "i").test(text);
    });
  }

  return (
    <section id="view-result" className="tab-view active">
      <div id="resultList" className="notice-list">
        {results.length === 0 ? (
          <div className="state-box">
            <i className="fa-solid fa-square-poll-vertical"></i>
            <span>No SASTC examination results published for {deptPreference}.</span>
          </div>
        ) : (
          results.map((item, idx) => {
            const key = getNoticeKey(item);
            return (
              <NoticeCard
                key={item._key || idx}
                item={item}
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

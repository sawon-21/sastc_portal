import React from 'react';
import { NoticeItem, DeptCode } from '../../types';
import { NoticeCard } from '../NoticeCard';
import { getNoticeKey } from '../../utils/notices';

interface NoticeViewProps {
  masterDataset: NoticeItem[];
  deptPreference: DeptCode;
  onOpenNotice: (url: string, title: string, textContent?: string, itemKey?: string) => void;
  onShare: (url: string, title: string, itemKey?: string) => void;
  isFavorite?: (key: string) => boolean;
  onToggleFavorite?: (item: NoticeItem) => void;
  isOfflineCached?: (key: string) => boolean;
}

export const NoticeView: React.FC<NoticeViewProps> = ({
  masterDataset,
  deptPreference,
  onOpenNotice,
  onShare,
  isFavorite,
  onToggleFavorite,
  isOfflineCached
}) => {
  let filtered = masterDataset.filter(item => !item._isResult);

  if (deptPreference !== "ALL") {
    filtered = filtered.filter(item => item._deptCode === deptPreference);
  }

  return (
    <section id="view-notice" className="tab-view active">
      <div id="noticeList" className="notice-list" aria-live="polite">
        {filtered.length === 0 ? (
          <div className="state-box">
            <i className="fa-regular fa-folder-open"></i>
            <span>No notices found for {deptPreference}.</span>
          </div>
        ) : (
          filtered.map((item, idx) => {
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

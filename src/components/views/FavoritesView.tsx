import React, { useState } from 'react';
import { FavoriteItem } from '../../types';
import { formatDateString } from '../../utils/notices';

interface FavoritesViewProps {
  favorites: FavoriteItem[];
  onOpenNotice: (url: string, title: string, textContent?: string, itemKey?: string) => void;
  onShare: (url: string, title: string, itemKey?: string) => void;
  onRemoveFavorite: (id: string) => void;
  onClearAllFavorites: () => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  onOpenNotice,
  onShare,
  onRemoveFavorite,
  onClearAllFavorites
}) => {
  const [filterType, setFilterType] = useState<'all' | 'notice' | 'result' | 'syllabus'>('all');
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  const filtered = favorites.filter(item => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const handleClear = () => {
    if (confirmClear) {
      onClearAllFavorites();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <section id="view-favorites" className="tab-view active">
      {/* Header */}
      <div className="settings-header-main flex items-center justify-between mb-4">
        <div>
          <h2>Favorites &amp; Bookmarks</h2>
          <p>Saved notices, exam results &amp; syllabus for quick offline reading</p>
        </div>

        {favorites.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className={`font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-2xs border ${
              confirmClear
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-red-50 text-red-500 hover:bg-red-100 border-red-100'
            }`}
          >
            <i className={`fa-solid ${confirmClear ? 'fa-triangle-exclamation' : 'fa-trash-can'}`}></i>
            <span>{confirmClear ? 'Sure to Clear All?' : 'Clear All'}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl mb-4 shadow-2xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            filterType === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All ({favorites.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('notice')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            filterType === 'notice'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Notices ({favorites.filter(f => f.type === 'notice').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('result')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            filterType === 'result'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Results ({favorites.filter(f => f.type === 'result').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('syllabus')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            filterType === 'syllabus'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Syllabus ({favorites.filter(f => f.type === 'syllabus').length})
        </button>
      </div>

      {/* List */}
      <div className="notice-list">
        {filtered.length === 0 ? (
          <div className="state-box">
            <i className="fa-regular fa-bookmark text-3xl text-slate-400 mb-2"></i>
            <span className="font-semibold text-slate-700">No saved {filterType !== 'all' ? filterType : ''} items yet</span>
            <span className="text-xs text-slate-500 mt-1">
              Click the bookmark button on any notice, result, or syllabus to save it here for instant offline reading.
            </span>
          </div>
        ) : (
          filtered.map(item => {
            const dateStr = formatDateString(item.date) || 'Saved Item';
            return (
              <div key={item.id} className="card card-animate visible">
                <div className="card-header">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge-dept">
                      <i className={item.type === 'result' ? 'fa-solid fa-square-poll-vertical' : item.type === 'syllabus' ? 'fa-solid fa-book-bookmark' : 'fa-solid fa-bell'}></i>{' '}
                      {item.type.toUpperCase()}
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <i className="fa-solid fa-cloud-arrow-down text-[9px]"></i> Offline Ready
                    </span>
                  </div>
                  <span className="date">
                    <i className="fa-regular fa-calendar"></i> {dateStr}
                  </span>
                </div>

                <a
                  href={item.url || '#'}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenNotice(item.url || '', item.title, item.textContent, item.id);
                  }}
                  className="notice-title"
                >
                  {item.title}
                </a>

                {item.textContent && (
                  <div
                    className="notice-desc-preview"
                    dangerouslySetInnerHTML={{ __html: item.textContent }}
                  />
                )}

                <div className="card-footer">
                  <span className="category-tag">
                    <i className="fa-solid fa-tag"></i> {item.category || item.department || 'Academic'}
                  </span>
                  <div className="btn-actions">
                    <button
                      type="button"
                      className="btn-icon-action btn-icon-share"
                      onClick={() => onShare(item.url || '', item.title, item.id)}
                      title="Quick Share Link"
                      aria-label="Share Link"
                    >
                      <i className="fa-solid fa-share-nodes text-[12px]"></i>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveFavorite(item.id)}
                      className="btn-icon-action btn-icon-delete"
                      title="Remove from Favorites"
                      aria-label="Remove Bookmark"
                    >
                      <i className="fa-solid fa-trash-can text-[12px]"></i>
                    </button>

                    <button
                      type="button"
                      className="btn-view"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenNotice(item.url || '', item.title, item.textContent, item.id);
                      }}
                    >
                      <span>Read</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

import React, { useState, useEffect, useRef } from 'react';

interface PdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  textContent?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onShare?: () => void;
}

export const PdfModal: React.FC<PdfModalProps> = ({
  isOpen,
  onClose,
  title,
  url,
  textContent,
  isFavorite = false,
  onToggleFavorite,
  onShare
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isReaderMode, setIsReaderMode] = useState<boolean>(Boolean(textContent && !url));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const textContainerRef = useRef<HTMLDivElement>(null);

  // Reset zoom & page when document changes
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(100);
      setCurrentPage(1);
      setSearchQuery('');
      setShowSearchInput(false);
      setIsReaderMode(Boolean(textContent && (!url || url === "#")));
    }
  }, [isOpen, url, textContent]);

  if (!isOpen) return null;

  const hasPdfUrl = url && url !== "#";
  const hasTextContent = Boolean(textContent && textContent.trim().length > 0);

  // Build viewer URL with page parameter
  let frameUrl = "about:blank";
  if (hasPdfUrl) {
    if (url.endsWith(".pdf") || url.includes("/pdf") || url.includes("drive.google")) {
      frameUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true#page=${currentPage}`;
    } else {
      frameUrl = url;
    }
  }

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 75));
  const handleZoomReset = () => setZoomLevel(100);

  // Page navigation
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  // Direct Download
  const handleDownload = async () => {
    if (!hasPdfUrl) return;
    setIsDownloading(true);
    try {
      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `${title.replace(/[^a-zA-Z0-9_\-\u0980-\u09FF]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn("Direct download failed, opening in new tab", err);
      window.open(url, '_blank');
    } finally {
      setTimeout(() => setIsDownloading(false), 800);
    }
  };

  // Highlight search query in reader mode
  const renderHighlightedText = () => {
    if (!textContent) return null;
    if (!searchQuery.trim()) {
      return <div dangerouslySetInnerHTML={{ __html: textContent }} />;
    }

    try {
      const query = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${query})`, 'gi');
      const parts = textContent.split(regex);
      return (
        <div>
          {parts.map((part, i) =>
            regex.test(part) ? (
              <mark key={i} className="bg-amber-300 text-slate-900 px-0.5 rounded font-bold">
                {part}
              </mark>
            ) : (
              <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
            )
          )}
        </div>
      );
    } catch {
      return <div dangerouslySetInnerHTML={{ __html: textContent }} />;
    }
  };

  return (
    <div
      id="pdfModal"
      className="modal-overlay active"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`modal-card flex flex-col transition-all duration-150 ${
          isFullscreen ? '!w-screen !h-screen !max-w-none !m-0 !rounded-none' : ''
        }`}
      >
        {/* Top Header */}
        <div className="modal-header border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="modal-title text-sm md:text-base font-bold text-slate-900 truncate" title={title}>
              {title || "Notice Document"}
            </span>
            {hasPdfUrl && (
              <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0">
                PDF
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Bookmark button */}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={onToggleFavorite}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-200 border cursor-pointer ${
                  isFavorite
                    ? 'bg-gradient-to-br from-amber-50 to-amber-100/90 border-amber-300 text-amber-600 shadow-2xs'
                    : 'bg-white/90 border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50/60'
                }`}
                title={isFavorite ? "Remove from Favorites" : "Save to Favorites"}
                aria-label="Bookmark Document"
              >
                <i className={`fa-${isFavorite ? 'solid' : 'regular'} fa-bookmark text-[12px]`}></i>
              </button>
            )}

            {/* Share button */}
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-200 border border-slate-200 bg-white/90 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/70 shadow-2xs cursor-pointer"
                title="Share Document"
                aria-label="Share Document"
              >
                <i className="fa-solid fa-share-nodes text-[12px]"></i>
              </button>
            )}

            {/* Fullscreen toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="w-8 h-8 rounded-lg items-center justify-center text-xs transition-all duration-200 border border-slate-200 bg-white/90 text-slate-500 hover:text-slate-800 hover:bg-slate-100 hidden sm:inline-flex cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Reading Mode"}
              aria-label="Fullscreen"
            >
              <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-[11px]`}></i>
            </button>

            {/* Close button */}
            <button
              type="button"
              className="modal-close w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-200 border border-slate-200 bg-white/90 text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              id="closeModalBtn"
              aria-label="Close preview"
              onClick={onClose}
            >
              <i className="fa-solid fa-xmark text-[13px]"></i>
            </button>
          </div>
        </div>

        {/* Toolbar: Mode switcher, Zoom, Search, Page navigation */}
        <div className="bg-slate-50/90 border-b border-slate-200 px-3 py-1.5 shrink-0 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
          <div className="flex items-center gap-1.5">
            {/* Toggle PDF / Reader Mode if text available */}
            {hasPdfUrl && hasTextContent && (
              <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => setIsReaderMode(false)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                    !isReaderMode ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-file-pdf mr-1 text-red-500 text-[10px]"></i> PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsReaderMode(true)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                    isReaderMode ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-align-left mr-1 text-indigo-500 text-[10px]"></i> Reader
                </button>
              </div>
            )}

            {/* Page Navigation for PDF - Premium Micro Pill */}
            {!isReaderMode && hasPdfUrl && (
              <div className="inline-flex items-center gap-0.5 bg-white border border-slate-200/90 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent transition-colors cursor-pointer"
                  title="Previous Page"
                  aria-label="Previous Page"
                >
                  <i className="fa-solid fa-chevron-left text-[9px]"></i>
                </button>
                <div className="flex items-center gap-1 px-1.5 py-0.5 select-none">
                  <i className="fa-regular fa-file-lines text-[10px] text-slate-400"></i>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Pg</span>
                  <span className="text-xs font-bold text-slate-800 tabular-nums">{currentPage}</span>
                </div>
                <button
                  type="button"
                  onClick={handleNextPage}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Next Page"
                  aria-label="Next Page"
                >
                  <i className="fa-solid fa-chevron-right text-[9px]"></i>
                </button>
              </div>
            )}

            {/* Search Input toggle */}
            {isReaderMode && (
              <button
                type="button"
                onClick={() => setShowSearchInput(!showSearchInput)}
                className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 transition-colors ${
                  showSearchInput ? 'bg-indigo-50 border-indigo-200 text-indigo-600 font-semibold' : 'bg-white border-slate-200 text-slate-600'
                }`}
                title="Search text in document"
              >
                <i className="fa-solid fa-magnifying-glass text-[10px]"></i>
                <span>Search</span>
              </button>
            )}
          </div>

          {/* Right Toolbar Controls: Zoom Stepper & Download */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls - Premium Micro Stepper */}
            <div className="inline-flex items-center bg-white border border-slate-200/90 rounded-lg shadow-2xs overflow-hidden p-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 75}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent transition-colors cursor-pointer"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <i className="fa-solid fa-minus text-[9px]"></i>
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                className="px-1.5 py-0.5 text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-colors rounded text-[11px] font-semibold tabular-nums select-none flex items-center gap-1 cursor-pointer"
                title="Click to reset zoom (100%)"
              >
                <i className="fa-solid fa-magnifying-glass text-[9px] text-slate-400"></i>
                <span>{zoomLevel}%</span>
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 200}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent transition-colors cursor-pointer"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <i className="fa-solid fa-plus text-[9px]"></i>
              </button>
            </div>

            {/* Download Button */}
            {hasPdfUrl && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/90 font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors text-xs cursor-pointer shadow-2xs"
                title="Download PDF to device"
              >
                <i className={`fa-solid ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'} text-[11px]`}></i>
                <span className="hidden sm:inline text-[11px]">Download</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar Bar (shown when toggled in Reader Mode) */}
        {isReaderMode && showSearchInput && (
          <div className="bg-amber-50/70 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
            <i className="fa-solid fa-magnifying-glass text-amber-600 text-xs"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keyword in this document..."
              className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-900 placeholder:text-amber-700/50"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 p-0.5 text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        )}

        {/* Main Body */}
        <div className="modal-body flex-1 overflow-auto bg-slate-100/60 p-0 relative">
          {isReaderMode || !hasPdfUrl ? (
            <div
              ref={textContainerRef}
              className="p-5 md:p-8 max-w-3xl mx-auto bg-white min-h-full shadow-sm leading-relaxed text-slate-800 text-sm md:text-base selection:bg-indigo-100"
              style={{
                zoom: `${zoomLevel}%`
              }}
            >
              {renderHighlightedText()}
            </div>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center overflow-auto"
              style={{
                transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none',
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
                height: zoomLevel > 100 ? `${zoomLevel}%` : '100%'
              }}
            >
              <iframe
                id="pdfFrame"
                src={frameUrl}
                title="Smart PDF Viewer"
                className="w-full h-full border-0 bg-white"
                allow="fullscreen"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer border-t border-slate-200 bg-white px-4 py-3 shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 hidden sm:block truncate">
            {hasPdfUrl ? "HSTU Official PDF Notice" : "HSTU Academic Announcement"}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {hasPdfUrl && (
              <a
                id="modalDirectLink"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-xs md:text-sm py-2 px-3.5 inline-flex items-center gap-1.5"
              >
                <span>Open Original PDF</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs md:text-sm rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

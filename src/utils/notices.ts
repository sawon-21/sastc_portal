import { NoticeItem, FavoriteItem, TabType } from '../types';

export const NOTICES_API_URL = "https://raw.githubusercontent.com/sawon-21/hstu-notice/main/notices.json";
export const RESULTS_API_URL = "https://raw.githubusercontent.com/sawon-21/hstu-notice/refs/heads/main/results.json";

export const LS_NOTICES_CACHE = "sastc_notices_cache";
export const LS_RESULTS_CACHE = "sastc_results_cache";
export const LS_FAVORITES = "sastc_favorites";
export const LS_OFFLINE_DOCS = "sastc_offline_docs";

export function getNoticeKey(item: NoticeItem): string {
  return item._key || item.id || `${item.title || ''}_${item.date || ''}_${item.url || item.pdf || item.pdf_url || item.pdfUrl || item.link || ''}`;
}

export function getNoticeDate(item: NoticeItem): Date | null {
  if (!item || !item.date) return null;
  const d = new Date(item.date);
  return isNaN(d.getTime()) ? null : d;
}

export function detectDeptCode(text: string): string {
  const clean = String(text || "").toUpperCase().replace(/\./g, " ");

  if (/\bSASTC\b/i.test(clean)) {
    return "SASTC";
  }
  if (/\b(CSE|COMPUTER|COMPUTING|সিএসই|কম্পিউটার)\b/i.test(clean)) {
    return "CSE";
  }
  if (/\b(BBA|BUSINESS|MANAGEMENT|ACCOUNTING|FINANCE|MARKETING|MANAGEMENT STUDIES|ব্যবসায়|ব্যবস্থাপনা|বিবিএ)\b/i.test(clean)) {
    return "BBA";
  }
  if (/\b(AG\s*ENGG|AGRICULTURAL\s*ENG|AGRICULTURAL\s*ENGINEERING|কৃষি\s*প্রকৌশল)\b/i.test(clean)) {
    return "GENERAL";
  }
  if (/\b(AG|AGRICULTURE|AGRICULTURAL|CROP|HORTICULTURE|SOIL|PLANT|AGRONOMY|AGRICULTURIST|কৃষি)\b/i.test(clean)) {
    return "AG";
  }

  return "GENERAL";
}

export function isResultNotice(item: NoticeItem): boolean {
  if (!item) return false;
  if (item.isResultApi || item.category === "Result" || item.category === "ফলাফল") return true;
  const text = `${item.category || ''} ${item.title || ''} ${item.department || ''}`.toLowerCase();
  return text.includes("result") || text.includes("ফলাফল");
}

export function isNoticeNew(item: NoticeItem): boolean {
  const d = getNoticeDate(item);
  if (!d) return false;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 1;
}

export function getDeptIcon(dept: string): string {
  switch (dept) {
    case "SASTC": return "fa-solid fa-microchip";
    case "CSE": return "fa-solid fa-code";
    case "AG": return "fa-solid fa-wheat-awn";
    case "BBA": return "fa-solid fa-chart-line";
    case "RESULT": return "fa-solid fa-square-poll-vertical";
    case "SYLLABUS": return "fa-solid fa-book-bookmark";
    default: return "fa-solid fa-building-columns";
  }
}

export function normalizeSearchText(text: string): string {
  if (!text) return "";
  return String(text)
    .toLowerCase()
    .replace(/[।\,\-\_\.\:\;\']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatPdfUrl(rawLink: string | undefined): string {
  if (!rawLink || rawLink === "#") return "";
  let url = String(rawLink).trim();
  if (url.startsWith("/")) {
    url = "https://hstu.ac.bd" + url;
  } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url.replace(/'/g, "%27");
}

export function getTagInfo(dateInput: string | number | Date | undefined): { text: string; className: string } | null {
  if (!dateInput) return null;

  const createdDate = new Date(dateInput);
  const now = new Date();
  const diffInMs = now.getTime() - createdDate.getTime();

  if (isNaN(createdDate.getTime()) || diffInMs < 0) return null;

  const diffInHours = diffInMs / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return { text: 'NEW', className: 'tag-new' };
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays >= 1 && diffInDays <= 7) {
    const label = `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    return { text: label, className: 'tag-recent' };
  }

  return null;
}

export function formatDateString(dateStr: string | undefined): string {
  if (!dateStr || dateStr === "N/A") return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function parseResponseData(data: any): NoticeItem[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.notices)) return data.notices;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

export function getFallbackNoticesData(): NoticeItem[] {
  const d = (daysAgo: number) => {
    const date = new Date(Date.now() - daysAgo * 86400000);
    return date.toISOString().split('T')[0];
  };

  return [
    {
      "title": "SASTC Department Academic Class Routine and Exam Schedule",
      "date": d(1),
      "department": "SASTC",
      "category": "Routine",
      "url": "https://hstu.ac.bd/uploads/notice/sastc_routine.pdf"
    },
    {
      "title": "CSE 3rd Year 1st Semester Final Examination Schedule Published",
      "date": d(2),
      "department": "Computer Science and Engineering (CSE)",
      "category": "Routine",
      "url": "https://hstu.ac.bd/uploads/notice/cse_exam.pdf"
    },
    {
      "title": "BBA Management & Accounting Course Midterm Examination Routine",
      "date": d(3),
      "department": "Business Administration (BBA)",
      "category": "Routine",
      "url": "https://hstu.ac.bd/uploads/notice/bba_mid.pdf"
    },
    {
      "title": "Faculty of Agriculture (AG) MS Thesis Submission Notice",
      "date": d(10),
      "department": "Faculty of Agriculture (AG)",
      "category": "Academic",
      "url": "https://hstu.ac.bd/uploads/notice/ag_thesis.pdf"
    }
  ];
}

export function getFallbackResultsData(): NoticeItem[] {
  const d = (daysAgo: number) => {
    const date = new Date(Date.now() - daysAgo * 86400000);
    return date.toISOString().split('T')[0];
  };

  return [
    {
      "title": "SASTC 2nd Year 2nd Semester Final Examination Result Published",
      "date": d(2),
      "department": "SASTC",
      "category": "Result",
      "url": "https://hstu.ac.bd/uploads/results/sastc_2_2_result.pdf",
      "isResultApi": true
    },
    {
      "title": "SASTC 1st Year 1st Semester Academic Result Announcement",
      "date": d(12),
      "department": "SASTC",
      "category": "Result",
      "url": "https://hstu.ac.bd/uploads/results/sastc_1_1_result.pdf",
      "isResultApi": true
    }
  ];
}

export function loadCachedData(): { noticesData: NoticeItem[]; resultsData: NoticeItem[] } {
  let notices: NoticeItem[] = [];
  let results: NoticeItem[] = [];

  try {
    notices = JSON.parse(localStorage.getItem(LS_NOTICES_CACHE) || "[]");
  } catch (e) {
    notices = [];
  }

  try {
    results = JSON.parse(localStorage.getItem(LS_RESULTS_CACHE) || "[]");
  } catch (e) {
    results = [];
  }

  if (!Array.isArray(notices) || notices.length === 0) {
    notices = getFallbackNoticesData();
  }
  if (!Array.isArray(results) || results.length === 0) {
    results = getFallbackResultsData();
  }

  return { noticesData: notices, resultsData: results };
}

export async function fetchLiveData(): Promise<{ noticesData: NoticeItem[] | null; resultsData: NoticeItem[] | null }> {
  try {
    const [noticesRes, resultsRes] = await Promise.allSettled([
      fetch(NOTICES_API_URL).then(res => res.ok ? res.json() : Promise.reject("Notices fetch failed")),
      fetch(RESULTS_API_URL).then(res => res.ok ? res.json() : Promise.reject("Results fetch failed"))
    ]);

    let notices: NoticeItem[] = [];
    let results: NoticeItem[] = [];

    if (noticesRes.status === "fulfilled") {
      const rawList = parseResponseData(noticesRes.value);
      if (rawList.length > 0) {
        notices = rawList;
        localStorage.setItem(LS_NOTICES_CACHE, JSON.stringify(notices));
      }
    }

    if (resultsRes.status === "fulfilled") {
      const rawResults = parseResponseData(resultsRes.value);
      if (rawResults.length > 0) {
        results = rawResults.map(item => ({
          ...item,
          category: item.category || "Result",
          isResultApi: true
        }));
        localStorage.setItem(LS_RESULTS_CACHE, JSON.stringify(results));
      }
    }

    return {
      noticesData: notices.length > 0 ? notices : null,
      resultsData: results.length > 0 ? results : null
    };
  } catch (err) {
    console.warn("External API fetch failed; operating on cached/fallback data.", err);
    return { noticesData: null, resultsData: null };
  }
}

export function indexDataset(noticesData: NoticeItem[], resultsData: NoticeItem[]): NoticeItem[] {
  const combined = [...noticesData, ...resultsData];
  const seen = new Set<string>();
  const masterDataset: NoticeItem[] = [];

  for (let i = 0; i < combined.length; i++) {
    const item = combined[i];
    const key = item._key || getNoticeKey(item);

    if (seen.has(key)) continue;
    seen.add(key);

    const deptCode = item._deptCode || detectDeptCode(`${item.department || ''} ${item.title || ''}`);
    const isResult = item._isResult !== undefined ? item._isResult : isResultNotice(item);
    const searchableText = item._searchableText || normalizeSearchText(`${item.title || ""} ${item.department || ""} ${item.category || ""} ${item.date || ""}`);
    const dateObj = getNoticeDate(item);
    const dateMs = item._dateMs !== undefined ? item._dateMs : (dateObj ? dateObj.getTime() : 0);
    const isNew = isNoticeNew(item);

    masterDataset.push({
      ...item,
      _key: key,
      _deptCode: deptCode,
      _isResult: isResult,
      _searchableText: searchableText,
      _dateMs: dateMs,
      _isNew: isNew
    });
  }

  masterDataset.sort((a, b) => (b._dateMs || 0) - (a._dateMs || 0));
  return masterDataset;
}

// ==========================================
// Deep Linking Helpers
// ==========================================

export function generateShareUrl(item: NoticeItem, tabHint?: TabType): string {
  const baseUrl = window.location.origin + window.location.pathname;
  const key = item._key || getNoticeKey(item);
  const targetTab = tabHint || (isResultNotice(item) ? 'result' : 'notice');
  const params = new URLSearchParams();
  params.set('tab', targetTab);
  params.set('id', key);
  return `${baseUrl}?${params.toString()}`;
}

export function parseSharedItemFromUrl(masterDataset: NoticeItem[]): {
  tab: TabType | null;
  targetItem: NoticeItem | null;
} {
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as TabType | null;
    const idParam = params.get('id');

    if (!idParam) return { tab: tabParam, targetItem: null };

    const decodedId = decodeURIComponent(idParam);
    const found = masterDataset.find(item => {
      const key = item._key || getNoticeKey(item);
      return key === decodedId || item.title === decodedId;
    });

    return {
      tab: tabParam || (found ? (isResultNotice(found) ? 'result' : 'notice') : null),
      targetItem: found || null
    };
  } catch {
    return { tab: null, targetItem: null };
  }
}

// ==========================================
// Favorites Management Helpers
// ==========================================

export function getStoredFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(LS_FAVORITES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredFavorites(favorites: FavoriteItem[]): void {
  try {
    localStorage.setItem(LS_FAVORITES, JSON.stringify(favorites));
  } catch (err) {
    console.error("Failed to save favorites to localStorage", err);
  }
}

export function toggleStoredFavorite(item: FavoriteItem): { favorites: FavoriteItem[]; isAdded: boolean } {
  const current = getStoredFavorites();
  const exists = current.some(f => f.id === item.id);

  let updated: FavoriteItem[];
  let isAdded = false;

  if (exists) {
    updated = current.filter(f => f.id !== item.id);
    isAdded = false;
  } else {
    updated = [item, ...current];
    isAdded = true;
  }

  saveStoredFavorites(updated);
  return { favorites: updated, isAdded };
}

export function isItemFavorite(idOrKey: string, favorites: FavoriteItem[]): boolean {
  if (!idOrKey) return false;
  return favorites.some(f => f.id === idOrKey);
}

// ==========================================
// Offline Cache Management for Viewed Notices
// ==========================================

export interface CachedOfflineDoc {
  key: string;
  item: NoticeItem;
  textContent?: string;
  cachedAt: string;
}

export function getOfflineDocs(): Record<string, CachedOfflineDoc> {
  try {
    const raw = localStorage.getItem(LS_OFFLINE_DOCS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function cacheNoticeForOffline(item: NoticeItem, textContent?: string): void {
  try {
    const key = item._key || getNoticeKey(item);
    const docs = getOfflineDocs();
    docs[key] = {
      key,
      item,
      textContent,
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(LS_OFFLINE_DOCS, JSON.stringify(docs));
  } catch (err) {
    console.warn("Could not cache document for offline storage", err);
  }
}

export function isNoticeCachedOffline(key: string): boolean {
  if (!key) return false;
  const docs = getOfflineDocs();
  return Boolean(docs[key]);
}

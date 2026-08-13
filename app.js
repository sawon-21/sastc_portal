/**
 * Main Application Controller (Theme & Notice Fixes)
 */

import { loadCachedData, fetchLiveData } from './api.js';
import { 
  indexDataset, 
  detectDeptCode, 
  isResultNotice, 
  getDeptIcon, 
  getItemsForDept, 
  updateTabNotificationCounts, 
  getFilteredNotices 
} from './filter.js';
import { 
  escapeHTML, 
  formatPdfUrl, 
  closePdfModal, 
  copyLink, 
  handleNoticeClick, 
  handlePdfView, 
  debounce,
  initSecurityProtections,
  showToast
} from './utils.js';

// Global window bindings for inline HTML handlers
window.handleNoticeClick = handleNoticeClick;
window.handlePdfView = handlePdfView;
window.copyLink = copyLink;

// LocalStorage Keys
const LS_ACTIVE_DEPT = "sastc_active_dept";
const LS_DEPT_PREF = "sastc_dept_preference";
const LS_THEME = "sastc_theme";
const LS_SEEN_KEYS = "sastc_seen_keys";

// Application State
let activeDept = localStorage.getItem(LS_ACTIVE_DEPT) || "SASTC";
let deptPreference = localStorage.getItem(LS_DEPT_PREF) || "SASTC";
let currentTheme = localStorage.getItem(LS_THEME) || "dark";
let activeTab = "home";

let noticesData = [];
let resultsData = [];
let masterDataset = [];
let seenNoticeKeys = new Set();
let deferredPrompt = null;

// DOM References
let searchInput, clearBtn, noticeList, resultList, noticeCount, homeNoticeCount, deptButtons, offlineBanner, installBtn;

document.addEventListener("DOMContentLoaded", () => {
  // Bind DOM elements
  searchInput = document.getElementById("searchInput");
  clearBtn = document.getElementById("clearBtn");
  noticeList = document.getElementById("noticeList");
  resultList = document.getElementById("resultList");
  noticeCount = document.getElementById("noticeCount");
  homeNoticeCount = document.getElementById("homeNoticeCount");
  deptButtons = document.querySelectorAll(".dept-btn");
  offlineBanner = document.getElementById("offlineBanner");
  installBtn = document.getElementById("installBtn");

  // Load seen keys
  try {
    const savedKeys = JSON.parse(localStorage.getItem(LS_SEEN_KEYS) || "[]");
    seenNoticeKeys = new Set(savedKeys);
  } catch (e) { seenNoticeKeys = new Set(); }

  // Apply saved Theme & Preference
  applyTheme(currentTheme);
  initDeptPreference();

  // Load initial cached data
  const cached = loadCachedData();
  noticesData = cached.noticesData;
  resultsData = cached.resultsData;

  rebuildMasterDataset();
  initSecurityProtections();
  initEventListeners();
  initNavTabs();
  
  // Initial render across views
  renderAllViews();

  // Background API sync
  fetchLiveData().then(live => {
    if (live.noticesData) noticesData = live.noticesData;
    if (live.resultsData) resultsData = live.resultsData;
    rebuildMasterDataset();
    updateTabNotificationCounts(masterDataset, seenNoticeKeys);
    renderAllViews();
  });
});

function rebuildMasterDataset() {
  masterDataset = indexDataset(noticesData, resultsData);
}

/**
 * Theme Manager (Light & Dark)
 */
function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem(LS_THEME, theme);
  document.documentElement.setAttribute("data-theme", theme);

  const themeIcon = document.getElementById("themeIcon");
  if (themeIcon) {
    themeIcon.className = theme === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun";
  }

  const btnDark = document.getElementById("btnThemeDark");
  const btnLight = document.getElementById("btnThemeLight");
  if (btnDark) btnDark.classList.toggle("active", theme === "dark");
  if (btnLight) btnLight.classList.toggle("active", theme === "light");
}

/**
 * Department Selector Preference Setup
 */
function initDeptPreference() {
  const selectEl = document.getElementById("deptPreferenceSelect");
  if (selectEl) {
    selectEl.value = deptPreference;
    selectEl.addEventListener("change", (e) => {
      deptPreference = e.target.value;
      localStorage.setItem(LS_DEPT_PREF, deptPreference);

      // Auto filter active dept tab
      if (deptPreference !== "ALL") {
        activeDept = deptPreference;
        localStorage.setItem(LS_ACTIVE_DEPT, activeDept);
        updateActiveDeptPills();
      }
      renderAllViews();
      showToast(`Department preference set to ${deptPreference}`);
    });
  }
}

function updateActiveDeptPills() {
  deptButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.dept === activeDept);
  });
}

/**
 * 4-Tab Bottom Navigation Bar Controller
 */
function initNavTabs() {
  const navItems = document.querySelectorAll(".bottom-nav .nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      switchTab(item.dataset.tab);
    });
  });

  const topSearchTrigger = document.getElementById("topSearchTrigger");
  if (topSearchTrigger) {
    topSearchTrigger.addEventListener("click", () => {
      switchTab("notice");
      if (searchInput) searchInput.focus();
    });
  }

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      applyTheme(currentTheme === "dark" ? "light" : "dark");
    });
  }

  const btnGoNotices = document.getElementById("btnGoNotices");
  if (btnGoNotices) btnGoNotices.addEventListener("click", () => switchTab("notice"));

  const btnGoResults = document.getElementById("btnGoResults");
  if (btnGoResults) btnGoResults.addEventListener("click", () => switchTab("result"));
}

function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".bottom-nav .nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-view").forEach(view => {
    view.classList.toggle("active", view.id === `view-${tabName}`);
  });

  renderAllViews();
}

/**
 * Main Render Dispatcher
 */
function renderAllViews() {
  renderHomeView();
  renderNotices();
  renderResultsView();
}

/**
 * Home View
 */
function renderHomeView() {
  if (homeNoticeCount) homeNoticeCount.textContent = masterDataset.length;

  const heroItem = masterDataset[0];
  if (heroItem) {
    const heroTitle = document.getElementById("heroTitle");
    const heroDesc = document.getElementById("heroDesc");
    const heroDate = document.getElementById("heroDate");
    const heroBtnView = document.getElementById("heroBtnView");

    if (heroTitle) heroTitle.textContent = heroItem.title || "Academic Announcement";
    if (heroDesc) heroDesc.textContent = `${heroItem.department || 'HSTU'} • ${heroItem.category || 'Notice'}`;
    if (heroDate) heroDate.innerHTML = `<i class="fa-regular fa-clock"></i> ${heroItem.date || 'Recent'}`;

    if (heroBtnView) {
      const url = formatPdfUrl(heroItem.url || heroItem.pdf_url || "#");
      heroBtnView.onclick = (e) => handleNoticeClick(e, url, heroItem.title);
    }
  }

  const deptNoticeSub = document.getElementById("deptNoticeSub");
  if (deptNoticeSub) {
    deptNoticeSub.textContent = `Filtered for ${deptPreference === "ALL" ? "All Departments" : deptPreference}`;
  }
}

/**
 * Fixed & Optimized Notice Section Engine
 */
function renderNotices() {
  if (!noticeList) return;

  const query = searchInput ? searchInput.value : "";
  let filtered = getFilteredNotices(query, activeDept, masterDataset);

  // Apply user department selector preference if set
  if (deptPreference !== "ALL" && activeDept === "ALL") {
    filtered = filtered.filter(item => item._deptCode === deptPreference);
  }

  if (noticeCount) noticeCount.textContent = filtered.length;

  if (filtered.length === 0) {
    noticeList.innerHTML = `
      <div class="state-box">
        <i class="fa-regular fa-folder-open"></i>
        <span>No notices found for this selection.</span>
      </div>
    `;
    return;
  }

  noticeList.innerHTML = filtered.map(item => createCardHTML(item)).join("");
}

/**
 * Result Section (Filter ONLY SASTC)
 */
function renderResultsView() {
  if (!resultList) return;

  // Filter ONLY SASTC results
  const sastcResults = masterDataset.filter(item => {
    return item._isResult && (item._deptCode === "SASTC" || (item.department && item.department.toUpperCase().includes("SASTC")));
  });

  if (sastcResults.length === 0) {
    resultList.innerHTML = `
      <div class="state-box">
        <i class="fa-solid fa-square-poll-vertical"></i>
        <span>No SASTC examination results published yet.</span>
      </div>
    `;
    return;
  }

  resultList.innerHTML = sastcResults.map(item => createCardHTML(item)).join("");
}

/**
 * Card Component Builder
 */
function createCardHTML(item) {
  const isResult = item._isResult !== undefined ? item._isResult : isResultNotice(item);
  const displayBadge = isResult ? "RESULT" : (item._deptCode || detectDeptCode(`${item.department || ''} ${item.title || ''}`));
  const deptIcon = getDeptIcon(displayBadge);

  const rawLink = item.url || item.pdf_url || item.link || "#";
  const pdfUrl = formatPdfUrl(rawLink);
  const title = escapeHTML(item.title || "Untitled Notice");
  const date = escapeHTML(item.date || "N/A");

  return `
    <div class="card ${item._isNew ? 'card-new' : ''}">
      <div class="card-header">
        <span class="badge-dept">
          <i class="${deptIcon}"></i> ${displayBadge}
        </span>
        <span class="date"><i class="fa-regular fa-calendar"></i> ${date}</span>
      </div>

      <a href="${pdfUrl || '#'}" class="notice-title" onclick="handleNoticeClick(event, '${pdfUrl}', '${escapeHTML(title)}')">
        ${title}
      </a>

      <div class="card-footer">
        <span class="category-tag">
          <i class="fa-solid fa-tag"></i> ${escapeHTML(item.category || "General")}
        </span>
        <div class="btn-actions">
          <button type="button" class="btn-share" onclick="copyLink('${pdfUrl}')" title="Copy Link">
            <i class="fa-regular fa-copy"></i>
          </button>
          <button type="button" class="btn-view" onclick="handlePdfView(event, '${pdfUrl}', '${escapeHTML(title)}')">
            <span>View PDF</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Global Event Listeners Setup
 */
function initEventListeners() {
  deptButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      activeDept = btn.dataset.dept;
      localStorage.setItem(LS_ACTIVE_DEPT, activeDept);
      updateActiveDeptPills();
      renderNotices();
    });
  });

  const debouncedRender = debounce(() => renderNotices(), 150);
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (clearBtn) clearBtn.style.display = searchInput.value.trim() ? "block" : "none";
      debouncedRender();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      clearBtn.style.display = "none";
      renderNotices();
    });
  }

  // Theme option buttons in settings
  const btnThemeDark = document.getElementById("btnThemeDark");
  const btnThemeLight = document.getElementById("btnThemeLight");
  if (btnThemeDark) btnThemeDark.addEventListener("click", () => applyTheme("dark"));
  if (btnThemeLight) btnThemeLight.addEventListener("click", () => applyTheme("light"));

  // Modal handlers
  const closeModalBtn = document.getElementById("closeModalBtn");
  const pdfModal = document.getElementById("pdfModal");
  if (closeModalBtn) closeModalBtn.addEventListener("click", closePdfModal);
  if (pdfModal) {
    pdfModal.addEventListener("click", (e) => {
      if (e.target === pdfModal) closePdfModal();
    });
  }

  // Clear cache & reset button
  const clearCacheBtn = document.getElementById("clearCacheBtn");
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", () => {
      localStorage.clear();
      showToast("App cache cleared successfully!", "fa-circle-check");
      setTimeout(() => window.location.reload(), 1000);
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = "flex";
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") installBtn.style.display = "none";
      deferredPrompt = null;
    });
  }
}

/**
 * Main Controller (Floating Rounded Navbar & Department Selector Engine)
 */

import { loadCachedData, fetchLiveData } from './api.js';
import { 
  indexDataset, 
  detectDeptCode, 
  isResultNotice, 
  getDeptIcon, 
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

window.handleNoticeClick = handleNoticeClick;
window.handlePdfView = handlePdfView;
window.copyLink = copyLink;

// Storage Keys
const LS_ACTIVE_DEPT = "sastc_active_dept";
const LS_DEPT_PREF = "sastc_dept_preference";
const LS_THEME = "sastc_theme";

// State variables
let activeDept = localStorage.getItem(LS_ACTIVE_DEPT) || "ALL";
let deptPreference = localStorage.getItem(LS_DEPT_PREF) || "CSE";
let currentTheme = localStorage.getItem(LS_THEME) || "dark";
let activeTab = "home";

let noticesData = [];
let resultsData = [];
let masterDataset = [];
let deferredPrompt = null;

// DOM Element Handles
let searchInput, clearBtn, noticeList, resultList, deptButtons, installBtn;

document.addEventListener("DOMContentLoaded", () => {
  searchInput = document.getElementById("searchInput");
  clearBtn = document.getElementById("clearBtn");
  noticeList = document.getElementById("noticeList");
  resultList = document.getElementById("resultList");
  deptButtons = document.querySelectorAll(".dept-btn");
  installBtn = document.getElementById("installBtn");

  applyTheme(currentTheme);
  initDeptPreference();

  const cached = loadCachedData();
  noticesData = cached.noticesData;
  resultsData = cached.resultsData;

  rebuildMasterDataset();
  initSecurityProtections();
  initEventListeners();
  initNavTabs();

  renderAllViews();

  // Background Live Sync
  fetchLiveData().then(live => {
    if (live.noticesData) noticesData = live.noticesData;
    if (live.resultsData) resultsData = live.resultsData;
    rebuildMasterDataset();
    renderAllViews();
  });
});

function rebuildMasterDataset() {
  masterDataset = indexDataset(noticesData, resultsData);
}

/**
 * Apply Light or Dark Theme
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
 * Setup Department Selector
 */
function initDeptPreference() {
  const selectEl = document.getElementById("deptPreferenceSelect");
  if (selectEl) {
    selectEl.value = deptPreference;
    selectEl.addEventListener("change", (e) => {
      deptPreference = e.target.value;
      localStorage.setItem(LS_DEPT_PREF, deptPreference);

      if (deptPreference !== "ALL") {
        activeDept = deptPreference;
        localStorage.setItem(LS_ACTIVE_DEPT, activeDept);
        updateActiveDeptPills();
      }

      renderAllViews();
      showToast(`Filter set to ${deptPreference}`);
    });
  }
}

function updateActiveDeptPills() {
  deptButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.dept === activeDept);
  });
}

/**
 * Navigation Bar (Home, Notice, Result, Settings)
 */
function initNavTabs() {
  const navItems = document.querySelectorAll(".bottom-nav .nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tab = item.getAttribute("data-tab");
      if (tab) switchTab(tab);
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
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
  });

  document.querySelectorAll(".tab-view").forEach(view => {
    view.classList.toggle("active", view.id === `view-${tabName}`);
  });

  renderAllViews();
}

function renderAllViews() {
  renderHomeView();
  renderNotices();
  renderResultsView();
}

/**
 * Home View Rendering
 */
function renderHomeView() {
  // Pre-filter data according to department preference
  const filteredSet = deptPreference === "ALL" 
    ? masterDataset 
    : masterDataset.filter(item => item._deptCode === deptPreference);

  const heroItem = filteredSet[0] || masterDataset[0];

  if (heroItem) {
    const heroTitle = document.getElementById("heroTitle");
    const heroDesc = document.getElementById("heroDesc");
    const heroDate = document.getElementById("heroDate");
    const heroBtnView = document.getElementById("heroBtnView");

    if (heroTitle) heroTitle.textContent = heroItem.title || "Academic Notice";
    if (heroDesc) heroDesc.textContent = `${heroItem.department || 'HSTU'} • ${heroItem.category || 'Notice'}`;
    if (heroDate) heroDate.innerHTML = `<i class="fa-regular fa-clock"></i> ${heroItem.date || 'Recent'}`;

    if (heroBtnView) {
      const url = formatPdfUrl(heroItem.url || heroItem.pdf_url || "#");
      heroBtnView.onclick = (e) => handleNoticeClick(e, url, heroItem.title);
    }
  }

  const deptNoticeSub = document.getElementById("deptNoticeSub");
  if (deptNoticeSub) {
    deptNoticeSub.textContent = `Showing ${deptPreference === "ALL" ? "All Departments" : deptPreference}`;
  }
}

/**
 * Render Notices (Strictly filtered for smooth performance)
 */
function renderNotices() {
  if (!noticeList) return;

  const query = searchInput ? searchInput.value : "";
  let filtered = getFilteredNotices(query, activeDept, masterDataset);

  // Apply Selected Department Preference
  if (deptPreference !== "ALL" && activeDept === "ALL") {
    filtered = filtered.filter(item => item._deptCode === deptPreference);
  }

  if (filtered.length === 0) {
    noticeList.innerHTML = `
      <div class="state-box">
        <i class="fa-regular fa-folder-open"></i>
        <span>No notices found.</span>
      </div>
    `;
    return;
  }

  noticeList.innerHTML = filtered.map(item => createCardHTML(item)).join("");
}

/**
 * Render Results (Strictly filtered for selected department)
 */
function renderResultsView() {
  if (!resultList) return;

  let results = masterDataset.filter(item => item._isResult);

  // Filter based on user's selected department
  if (deptPreference !== "ALL") {
    results = results.filter(item => item._deptCode === deptPreference);
  }

  if (results.length === 0) {
    resultList.innerHTML = `
      <div class="state-box">
        <i class="fa-solid fa-square-poll-vertical"></i>
        <span>No examination results published for ${deptPreference}.</span>
      </div>
    `;
    return;
  }

  resultList.innerHTML = results.map(item => createCardHTML(item)).join("");
}

/**
 * Card Builder
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
    <div class="card">
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
            <span>View</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Event Listeners
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

  const btnThemeDark = document.getElementById("btnThemeDark");
  const btnThemeLight = document.getElementById("btnThemeLight");
  if (btnThemeDark) btnThemeDark.addEventListener("click", () => applyTheme("dark"));
  if (btnThemeLight) btnThemeLight.addEventListener("click", () => applyTheme("light"));

  const closeModalBtn = document.getElementById("closeModalBtn");
  const pdfModal = document.getElementById("pdfModal");
  if (closeModalBtn) closeModalBtn.addEventListener("click", closePdfModal);
  if (pdfModal) {
    pdfModal.addEventListener("click", (e) => {
      if (e.target === pdfModal) closePdfModal();
    });
  }

  const clearCacheBtn = document.getElementById("clearCacheBtn");
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", () => {
      localStorage.clear();
      showToast("App cache cleared!");
      setTimeout(() => window.location.reload(), 800);
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

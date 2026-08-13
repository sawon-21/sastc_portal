/**
 * Main Application Module & Controller (4-Tab UI Redesign)
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
  openPdfModal, 
  closePdfModal, 
  copyLink, 
  handleNoticeClick, 
  handlePdfView, 
  debounce,
  initSecurityProtections,
  getTagInfo,
  showToast
} from './utils.js';

window.handleNoticeClick = handleNoticeClick;
window.handlePdfView = handlePdfView;
window.copyLink = copyLink;

// Application State
const LS_ACTIVE_DEPT = "sastc_active_dept";
const LS_SEEN_KEYS = "sastc_seen_keys";

let activeDept = localStorage.getItem(LS_ACTIVE_DEPT) || "SASTC";
let activeTab = "home";
let noticesData = [];
let resultsData = [];
let masterDataset = [];
let seenNoticeKeys = new Set();
let deferredPrompt = null;

// DOM Elements
let searchInput, clearBtn, noticeList, resultList, noticeCount, homeNoticeCount, deptButtons, offlineBanner, installBtn;

document.addEventListener("DOMContentLoaded", () => {
  searchInput = document.getElementById("searchInput");
  clearBtn = document.getElementById("clearBtn");
  noticeList = document.getElementById("noticeList");
  resultList = document.getElementById("resultList");
  noticeCount = document.getElementById("noticeCount");
  homeNoticeCount = document.getElementById("homeNoticeCount");
  deptButtons = document.querySelectorAll(".dept-btn");
  offlineBanner = document.getElementById("offlineBanner");
  installBtn = document.getElementById("installBtn");

  try {
    const savedKeys = JSON.parse(localStorage.getItem(LS_SEEN_KEYS) || "[]");
    seenNoticeKeys = new Set(savedKeys);
  } catch (e) { seenNoticeKeys = new Set(); }

  // Initial local cache load
  const cached = loadCachedData();
  noticesData = cached.noticesData;
  resultsData = cached.resultsData;

  rebuildMasterDataset();
  initSecurityProtections();
  initEventListeners();
  initNavTabs();
  
  // Render views
  renderAllViews();

  // Background Live Fetch
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
 * Navigation Bar Controller (Home, Notice, Result, Profile)
 */
function initNavTabs() {
  const navItems = document.querySelectorAll(".bottom-nav .nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTab = item.dataset.tab;
      switchTab(targetTab);
    });
  });

  // Top header search icon shortcut
  const topSearchTrigger = document.getElementById("topSearchTrigger");
  if (topSearchTrigger) {
    topSearchTrigger.addEventListener("click", () => {
      switchTab("notice");
      if (searchInput) searchInput.focus();
    });
  }

  // Quick Action Grid Shortcuts on Home
  const btnGoAcademic = document.getElementById("btnGoAcademic");
  if (btnGoAcademic) {
    btnGoAcademic.addEventListener("click", () => switchTab("notice"));
  }
  const btnGoReports = document.getElementById("btnGoReports");
  if (btnGoReports) {
    btnGoReports.addEventListener("click", () => switchTab("result"));
  }
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

function renderAllViews() {
  renderHomeView();
  renderNotices();
  renderResultsView();
}

/**
 * Render Home View Widgets
 */
function renderHomeView() {
  if (homeNoticeCount) homeNoticeCount.textContent = masterDataset.length;

  // Latest Hero Card Highlight
  const resultsOnly = masterDataset.filter(item => item._isResult);
  const heroItem = resultsOnly[0] || masterDataset[0];

  if (heroItem) {
    const heroTitle = document.getElementById("heroTitle");
    const heroDesc = document.getElementById("heroDesc");
    const heroDate = document.getElementById("heroDate");
    const heroBtnView = document.getElementById("heroBtnView");

    if (heroTitle) heroTitle.textContent = heroItem.title || "Latest Notice";
    if (heroDesc) heroDesc.textContent = `${heroItem.department || 'HSTU'} • ${heroItem.category || 'Academic'}`;
    if (heroDate) heroDate.innerHTML = `<i class="fa-regular fa-clock"></i> ${heroItem.date || 'Recent'}`;

    if (heroBtnView) {
      const url = formatPdfUrl(heroItem.url || heroItem.pdf_url || "#");
      heroBtnView.onclick = (e) => handleNoticeClick(e, url, heroItem.title);
    }
  }

  // Recent Reports Sub-list
  const recentReportsList = document.getElementById("recentReportsList");
  if (recentReportsList && masterDataset.length > 0) {
    recentReportsList.innerHTML = masterDataset.slice(0, 2).map(item => `
      <li><i class="fa-solid fa-angle-right"></i> ${escapeHTML(item.title)}</li>
    `).join("");
  }
}

/**
 * Render Notice View
 */
function renderNotices() {
  if (!noticeList) return;

  const query = searchInput ? searchInput.value : "";
  const filtered = getFilteredNotices(query, activeDept, masterDataset);

  if (noticeCount) noticeCount.textContent = filtered.length;

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
 * Render Result View
 */
function renderResultsView() {
  if (!resultList) return;

  const results = masterDataset.filter(item => item._isResult);

  if (results.length === 0) {
    resultList.innerHTML = `
      <div class="state-box">
        <i class="fa-solid fa-square-poll-vertical"></i>
        <span>No examination results published yet.</span>
      </div>
    `;
    return;
  }

  resultList.innerHTML = results.map(item => createCardHTML(item)).join("");
}

/**
 * Notice Card Template
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
            <span>View PDF</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Event Listeners Initialization
 */
function initEventListeners() {
  deptButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      activeDept = btn.dataset.dept;
      localStorage.setItem(LS_ACTIVE_DEPT, activeDept);
      deptButtons.forEach(b => b.classList.toggle("active", b.dataset.dept === activeDept));
      renderNotices();
    });
  });

  const debouncedRender = debounce(() => renderNotices(), 180);
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
      showToast("Local cache cleared!", "fa-circle-check");
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

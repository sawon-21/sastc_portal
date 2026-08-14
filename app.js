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
  escapeJS, 
  formatPdfUrl, 
  closePdfModal, 
  copyLink, 
  handleNoticeClick, 
  handlePdfView, 
  debounce,
  initSecurityProtections,
  showToast,
  getTagInfo,
  formatDateString
} from './utils.js';

window.handleNoticeClick = handleNoticeClick;
window.handlePdfView = handlePdfView;
window.copyLink = copyLink;

// Storage Keys
const LS_ACTIVE_DEPT = "sastc_active_dept";
const LS_DEPT_PREF = "sastc_dept_preference";

// State variables
let activeDept = localStorage.getItem(LS_ACTIVE_DEPT) || "ALL";
let deptPreference = localStorage.getItem(LS_DEPT_PREF) || "CSE";
let activeTab = "home";

let noticesData = [];
let resultsData = [];
let masterDataset = [];
let deferredPrompt = null;

// DOM Element Handles
let searchInput, clearBtn, noticeList, resultList;

let sastcNoticesData = [];

document.addEventListener("DOMContentLoaded", () => {
  searchInput = document.getElementById("searchInput");
  clearBtn = document.getElementById("clearBtn");
  noticeList = document.getElementById("noticeList");
  resultList = document.getElementById("resultList");

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
      }

      renderAllViews();
      showToast(`Filter set to ${deptPreference}`);
    });
  }
}

/**
 * Navigation Bar (Home, Notice, Result, Settings)
 */
function initNavTabs() {
  const navItems = document.querySelectorAll(".bottom-nav .nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      triggerHaptic();
      const tab = item.getAttribute("data-tab");
      if (tab) switchTab(tab);
    });
  });
}

function triggerHaptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

function switchTab(tabName) {
  console.log("Switching to tab:", tabName);
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
      const heroLink = heroItem.pdf || heroItem.url || heroItem.pdf_url || heroItem.link || heroItem.pdfUrl || "#";
      const url = formatPdfUrl(heroLink);
      heroBtnView.onclick = (e) => {
        triggerHaptic();
        handleNoticeClick(e, url, heroItem.title);
      };
    }
  }

  // Fetch and Render SASTC Notices
  const sastcNoticeList = document.getElementById("sastcNoticeList");
  if (sastcNoticeList) {
    fetch("./sastc-notices.json")
      .then(res => res.json())
      .then(data => {
        let filteredSastc = data;
        
        // Apply Selected Department Preference
        if (deptPreference !== "ALL") {
          filteredSastc = data.filter(item => {
            const code = item.deptCode || "SASTC";
            // Allow matching department notices AND general SASTC notices
            return code === deptPreference || code === "SASTC";
          });
        }

        if (!filteredSastc || filteredSastc.length === 0) {
          sastcNoticeList.innerHTML = `
            <div class="state-box">
              <i class="fa-regular fa-folder-open"></i>
              <span>No SASTC notices found for ${deptPreference !== "ALL" ? deptPreference : "any department"}.</span>
            </div>
          `;
          return;
        }

        // Sort by date, latest first
        filteredSastc.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB - dateA;
        });

        sastcNoticeList.innerHTML = filteredSastc.map(item => createCardHTML(item, { hideCopy: true })).join("");
      })
      .catch(err => {
        sastcNoticeList.innerHTML = `
          <div class="state-box">
            <i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-red)"></i>
            <span>Failed to load SASTC notices.</span>
          </div>
        `;
      });
  }
}

/**
 * Render Notices (Strictly filtered for smooth performance)
 */
function renderNotices() {
  if (!noticeList) return;
  
  let filtered = masterDataset.filter(item => !item._isResult);

  // Apply Selected Department Preference
  if (deptPreference !== "ALL") {
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

  // Filter items that are results
  let results = masterDataset.filter(item => item._isResult);

  // Filter based on user's selected department if not 'ALL'
  if (deptPreference !== "ALL") {
    results = results.filter(item => {
      const text = `${item.title || ''} ${item.department || ''} ${item.category || ''} ${item._deptCode || ''}`.toUpperCase();
      return new RegExp(`\\b${deptPreference}\\b`, "i").test(text);
    });
  }

  if (results.length === 0) {
    resultList.innerHTML = `
      <div class="state-box">
        <i class="fa-solid fa-square-poll-vertical"></i>
        <span>No examination results published for ${deptPreference !== "ALL" ? deptPreference : "any department"}.</span>
      </div>
    `;
    return;
  }

  resultList.innerHTML = results.map(item => createCardHTML(item)).join("");
}

/**
 * Card Builder
 */
function createCardHTML(item, options = {}) {
  const isResult = item._isResult !== undefined ? item._isResult : isResultNotice(item);
  const displayBadge = isResult ? "RESULT" : (item._deptCode || detectDeptCode(`${item.department || ''} ${item.title || ''}`));
  const deptIcon = getDeptIcon(displayBadge);

  // Added item.pdf for compatibility with result JSON format
  const rawLink = item.pdf || item.url || item.pdf_url || item.link || item.pdfUrl || "";
  const isTextOnly = !rawLink || rawLink === "#";
  const pdfUrl = isTextOnly ? "#" : formatPdfUrl(rawLink);
  
  const title = escapeHTML(item.title || "Untitled Notice");
  const titleJS = escapeJS(item.title || "Untitled Notice");
  const date = escapeHTML(formatDateString(item.date) || "N/A");
  
  let rawDesc = item.desc || item.description || item.text || "";
  let textContentBase64 = null;
  if (isTextOnly) {
    textContentBase64 = encodeURIComponent(rawDesc || "No detailed description available.").replace(/'/g, "%27");
  }

  const shareHtml = options.hideCopy ? "" : `
    <button type="button" class="btn-share" onclick="copyLink('${pdfUrl}')" title="Copy Link">
      <i class="fa-regular fa-copy"></i>
    </button>
  `;

  const tagInfo = getTagInfo(item.date);
  const tagHtml = tagInfo ? `<span class="badge-time ${tagInfo.className}">${tagInfo.text}</span>` : "";

  let visitBtnHtml = "";
  let linkMatch = rawDesc.match(/href=['"]([^'"]+)['"]/);
  if (linkMatch && linkMatch[1]) {
    visitBtnHtml = `
      <a href="${linkMatch[1]}" target="_blank" rel="noopener noreferrer" class="btn-visit" onclick="event.stopPropagation();">
        <i class="fa-solid fa-arrow-up-right-from-square"></i> Visit
      </a>
    `;
  }

  const noticeArg = textContentBase64 ? "'" + textContentBase64 + "'" : "null";

  return `
    <div class="card">
      <div class="card-header">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="badge-dept">
            <i class="${deptIcon}"></i> ${displayBadge}
          </span>
          ${tagHtml}
        </div>
        <span class="date"><i class="fa-regular fa-calendar"></i> ${date}</span>
      </div>
      <a href="${pdfUrl}" class="notice-title" onclick="handleNoticeClick(event, '${pdfUrl}', '${titleJS}', ${noticeArg})">
        ${title}
      </a>
      ${rawDesc ? `<div class="notice-desc-preview">${rawDesc}</div>` : ""}
      <div class="card-footer">
        <span class="category-tag">
          <i class="fa-solid fa-tag"></i> ${escapeHTML(item.category || "General")}
        </span>
        <div class="btn-actions">
          ${shareHtml}
          ${visitBtnHtml}
          <button type="button" class="btn-view" onclick="handlePdfView(event, '${pdfUrl}', '${titleJS}', ${noticeArg})">
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
  const closeModalBtn = document.getElementById("closeModalBtn");
  const pdfModal = document.getElementById("pdfModal");
  if (closeModalBtn) closeModalBtn.addEventListener("click", closePdfModal);
  if (pdfModal) {
    pdfModal.addEventListener("click", (e) => {
      if (e.target === pdfModal) closePdfModal();
    });
  }

  const bottomNav = document.querySelector(".bottom-nav");
  let lastScrollY = window.scrollY;
  window.addEventListener("scroll", () => {
    if (!bottomNav) return;
    if (window.scrollY > lastScrollY && window.scrollY > 50) {
      bottomNav.classList.add("nav-hidden");
    } else {
      bottomNav.classList.remove("nav-hidden");
    }
    lastScrollY = window.scrollY;
  }, { passive: true });

  const headerOfflineIcon = document.getElementById("headerOfflineIcon");
  function updateOnlineStatus() {
    if (headerOfflineIcon) {
      headerOfflineIcon.style.display = navigator.onLine ? "none" : "inline-flex";
    }
  }
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();
}

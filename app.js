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
  shareLink,
  handleNoticeClick, 
  handlePdfView, 
  debounce,
  initSecurityProtections,
  showToast,
  getTagInfo,
  formatDateString
} from './utils.js';
import { initCalculator } from './calculator.js';

window.handleNoticeClick = handleNoticeClick;
window.handlePdfView = handlePdfView;
window.copyLink = copyLink;
window.shareLink = shareLink;

// Storage Keys
const LS_ACTIVE_DEPT = "sastc_active_dept";
const LS_DEPT_PREF = "sastc_dept_preference";
const LS_SEEN_NOTICES_COUNT = "sastc_seen_notices_count";
const LS_SEEN_RESULTS_COUNT = "sastc_seen_results_count";

// State variables
const savedDeptPref = localStorage.getItem(LS_DEPT_PREF);
let deptPreference = savedDeptPref || "CSE";
let activeDept = localStorage.getItem(LS_ACTIVE_DEPT) || deptPreference;
let activeTab = "home";

let noticesData = [];
let resultsData = [];
let masterDataset = [];
let deferredPrompt = null;

// DOM Element Handles
let noticeSearchInput, noticeClearBtn, resultSearchInput, resultClearBtn, noticeList, resultList;
let noticeSearchQuery = "";
let resultSearchQuery = "";

const PAGE_SIZE = 25;
let noticeVisibleCount = PAGE_SIZE;
let resultVisibleCount = PAGE_SIZE;
const tabScrollPositions = { home: 0, notice: 0, result: 0, calculator: 0, settings: 0 };

let sastcNoticesCache = null;
let sastcNoticesLoading = false;

document.addEventListener("DOMContentLoaded", () => {
  noticeSearchInput = document.getElementById("noticeSearchInput");
  noticeClearBtn = document.getElementById("noticeClearBtn");
  resultSearchInput = document.getElementById("resultSearchInput");
  resultClearBtn = document.getElementById("resultClearBtn");
  noticeList = document.getElementById("noticeList");
  resultList = document.getElementById("resultList");

  // Clean up any legacy notification flag
  localStorage.removeItem("sastc_notifications_enabled");

  initDeptPreference();
  initFirstVisitDeptPopup();
  initApiKeysManagement();

  // Migrate old storage keys to new format to prevent sudden large badge numbers
  if (localStorage.getItem(LS_SEEN_NOTICES_COUNT)) {
    localStorage.setItem("seen_notices_ALL", localStorage.getItem(LS_SEEN_NOTICES_COUNT));
    localStorage.removeItem(LS_SEEN_NOTICES_COUNT);
  }
  if (localStorage.getItem(LS_SEEN_RESULTS_COUNT)) {
    localStorage.setItem("seen_results_ALL", localStorage.getItem(LS_SEEN_RESULTS_COUNT));
    localStorage.removeItem(LS_SEEN_RESULTS_COUNT);
  }

  const cached = loadCachedData();
  noticesData = cached.noticesData;
  resultsData = cached.resultsData;

  rebuildMasterDataset();
  initSecurityProtections();
  initEventListeners();
  initSearchControls();
  initNavTabs();
  initPwaInstall();
  initCalculator();
  updateHeaderDeptPill();

  renderAllViews();

  // Background Live Sync (without browser notifications)
  syncLiveNotices(false);

  // Register Service Worker for instant repeat load & offline support
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
});

function syncLiveNotices(isManual = false) {
  const syncBtn = document.getElementById("headerSyncBtn");
  if (syncBtn && isManual) syncBtn.classList.add("spinning");

  return fetchLiveData().then(live => {
    let hasUpdates = false;
    if (live.noticesData && live.noticesData.length > 0) {
      if (live.noticesData.length !== noticesData.length || isManual) {
        noticesData = live.noticesData;
        hasUpdates = true;
      }
    }
    if (live.resultsData && live.resultsData.length > 0) {
      if (live.resultsData.length !== resultsData.length || isManual) {
        resultsData = live.resultsData;
        hasUpdates = true;
      }
    }
    if (hasUpdates) {
      rebuildMasterDataset();
      renderAllViews();
      updateBadges();
    }
    if (isManual) {
      showToast("Portal synced with latest updates");
    }
  }).finally(() => {
    if (syncBtn && isManual) {
      setTimeout(() => syncBtn.classList.remove("spinning"), 300);
    }
  });
}

function updateHeaderDeptPill() {
  const headerDeptText = document.getElementById("headerDeptText");
  if (headerDeptText) {
    headerDeptText.textContent = deptPreference;
  }
}

/**
 * Mandatory First-Visit Department Selection Popup
 */
function initFirstVisitDeptPopup() {
  const existingPref = localStorage.getItem(LS_DEPT_PREF);
  if (existingPref && ["CSE", "AG", "BBA"].includes(existingPref)) {
    return;
  }

  const modal = document.getElementById("deptOnboardingModal");
  const optionBtns = document.querySelectorAll("#deptOnboardingOptions .dept-option-btn");
  const confirmBtn = document.getElementById("confirmDeptBtn");
  if (!modal || !confirmBtn) return;

  let selectedDept = null;
  modal.classList.add("active");

  optionBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      triggerHaptic();
      selectedDept = btn.getAttribute("data-dept");
      optionBtns.forEach(b => {
        const isMatch = b === btn;
        b.classList.toggle("selected", isMatch);
        const checkIcon = b.querySelector(".dept-opt-check");
        if (checkIcon) {
          checkIcon.className = isMatch
            ? "fa-solid fa-circle-check dept-opt-check"
            : "fa-regular fa-circle dept-opt-check";
        }
      });
      confirmBtn.disabled = !selectedDept;
    });
  });

  confirmBtn.addEventListener("click", () => {
    if (!selectedDept) return;
    triggerHaptic();

    deptPreference = selectedDept;
    activeDept = selectedDept;
    localStorage.setItem(LS_DEPT_PREF, deptPreference);
    localStorage.setItem(LS_ACTIVE_DEPT, activeDept);

    const selectEl = document.getElementById("deptPreferenceSelect");
    if (selectEl) {
      selectEl.value = deptPreference;
    }

    modal.classList.remove("active");
    updateHeaderDeptPill();
    window.dispatchEvent(new Event("sastc_dept_changed"));
    renderAllViews();
    updateBadges();
    showToast(`Department set to ${deptPreference}`);
  });
}

function initApiKeysManagement() {
  const inputEl = document.getElementById("newApiKeyInput");
  const addBtn = document.getElementById("addApiKeyBtn");
  const listEl = document.getElementById("apiKeyList");
  const emptyMsg = document.getElementById("emptyApiKeyMsg");

  if (!inputEl || !addBtn || !listEl) return;

  let apiKeys = JSON.parse(localStorage.getItem("geminiApiKeys")) || [];

  function renderKeys() {
    if (apiKeys.length === 0) {
      if (emptyMsg) emptyMsg.style.display = "block";
      listEl.innerHTML = '';
      if (emptyMsg) listEl.appendChild(emptyMsg);
      return;
    }

    if (emptyMsg) emptyMsg.style.display = "none";
    listEl.innerHTML = '';

    apiKeys.forEach((key, index) => {
      const maskedKey = key.substring(0, 8) + "..." + key.substring(key.length - 4);
      const div = document.createElement("div");
      div.className = "flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-[#85bdf0]";
      div.innerHTML = `
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-key text-gray-400"></i>
          <span class="font-mono text-sm text-gray-700">${maskedKey}</span>
        </div>
        <button class="text-red-400 hover:text-red-600 delete-key-btn p-1 transition-colors" data-idx="${index}" title="Delete Key">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
      listEl.appendChild(div);
    });

    listEl.querySelectorAll('.delete-key-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.currentTarget.getAttribute('data-idx');
        apiKeys.splice(idx, 1);
        localStorage.setItem("geminiApiKeys", JSON.stringify(apiKeys));
        renderKeys();
        showToast("API key removed");
      });
    });
  }

  addBtn.addEventListener("click", () => {
    const newKey = inputEl.value.trim();
    if (!newKey) {
      showToast("Please enter an API key");
      return;
    }
    
    if (apiKeys.includes(newKey)) {
      showToast("Key already exists");
      return;
    }

    apiKeys.push(newKey);
    localStorage.setItem("geminiApiKeys", JSON.stringify(apiKeys));
    inputEl.value = "";
    renderKeys();
    showToast("API key added successfully");
  });

  renderKeys();
}

function getFilteredNoticesSet() {
  let filtered = masterDataset.filter(item => !item._isResult);
  if (deptPreference !== "ALL") {
    filtered = filtered.filter(item => item._deptCode === deptPreference);
  }
  return filtered;
}

function getFilteredResultsSet() {
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
  return results;
}

function updateBadges() {
  const seenNoticesKey = `seen_notices_${deptPreference}`;
  const seenResultsKey = `seen_results_${deptPreference}`;
  
  const seenNotices = parseInt(localStorage.getItem(seenNoticesKey) || 0);
  const seenResults = parseInt(localStorage.getItem(seenResultsKey) || 0);
  
  const noticesSet = getFilteredNoticesSet();
  const resultsSet = getFilteredResultsSet();

  const newNotices = Math.max(0, noticesSet.length - seenNotices);
  const newResults = Math.max(0, resultsSet.length - seenResults);

  const noticeBadge = document.getElementById("navNoticeBadge");
  const resultBadge = document.getElementById("navResultBadge");

  if (noticeBadge) {
    noticeBadge.textContent = newNotices;
    noticeBadge.style.display = newNotices > 0 ? "inline-block" : "none";
  }
  if (resultBadge) {
    resultBadge.textContent = newResults;
    resultBadge.style.display = newResults > 0 ? "inline-block" : "none";
  }
}

function rebuildMasterDataset() {
  masterDataset = indexDataset(noticesData, resultsData);
  updateBadges();
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

      // If we are currently viewing the notice or result tab, mark the newly filtered items as read
      const seenNoticesKey = `seen_notices_${deptPreference}`;
      const seenResultsKey = `seen_results_${deptPreference}`;
      
      if (activeTab === "notice") {
        localStorage.setItem(seenNoticesKey, getFilteredNoticesSet().length);
      } else if (activeTab === "result") {
        localStorage.setItem(seenResultsKey, getFilteredResultsSet().length);
      }

      noticeVisibleCount = PAGE_SIZE;
      resultVisibleCount = PAGE_SIZE;
      updateHeaderDeptPill();
      window.dispatchEvent(new Event('sastc_dept_changed'));
      renderAllViews();
      updateBadges();
      showToast(`Filter set to ${deptPreference}`);
    });
  }
}

/**
 * Instant Debounced Search Controls for Notice & Result Views
 */
function initSearchControls() {
  if (noticeSearchInput) {
    const onNoticeSearch = debounce((val) => {
      noticeSearchQuery = val.trim();
      noticeVisibleCount = PAGE_SIZE;
      renderNotices();
    }, 120);

    noticeSearchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (noticeClearBtn) noticeClearBtn.style.display = val.length > 0 ? "block" : "none";
      onNoticeSearch(val);
    });
  }

  if (noticeClearBtn) {
    noticeClearBtn.addEventListener("click", () => {
      if (noticeSearchInput) noticeSearchInput.value = "";
      noticeClearBtn.style.display = "none";
      noticeSearchQuery = "";
      noticeVisibleCount = PAGE_SIZE;
      renderNotices();
    });
  }

  if (resultSearchInput) {
    const onResultSearch = debounce((val) => {
      resultSearchQuery = val.trim();
      resultVisibleCount = PAGE_SIZE;
      renderResultsView();
    }, 120);

    resultSearchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (resultClearBtn) resultClearBtn.style.display = val.length > 0 ? "block" : "none";
      onResultSearch(val);
    });
  }

  if (resultClearBtn) {
    resultClearBtn.addEventListener("click", () => {
      if (resultSearchInput) resultSearchInput.value = "";
      resultClearBtn.style.display = "none";
      resultSearchQuery = "";
      resultVisibleCount = PAGE_SIZE;
      renderResultsView();
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
  if (activeTab === tabName) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  // Save current tab scroll position
  tabScrollPositions[activeTab] = window.scrollY;
  activeTab = tabName;

  const seenNoticesKey = `seen_notices_${deptPreference}`;
  const seenResultsKey = `seen_results_${deptPreference}`;

  if (tabName === "notice") {
    const noticesSet = getFilteredNoticesSet();
    localStorage.setItem(seenNoticesKey, noticesSet.length);
    updateBadges();
  } else if (tabName === "result") {
    const resultsSet = getFilteredResultsSet();
    localStorage.setItem(seenResultsKey, resultsSet.length);
    updateBadges();
  }

  document.querySelectorAll(".bottom-nav .nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
  });

  document.querySelectorAll(".tab-view").forEach(view => {
    view.classList.toggle("active", view.id === `view-${tabName}`);
  });

  // Restore scroll position instantly without re-rendering DOM unnecessarily
  window.scrollTo({ top: tabScrollPositions[tabName] || 0, behavior: "instant" });
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
      const url = formatPdfUrl(heroItem.pdf || heroItem.url || heroItem.pdf_url || heroItem.link || heroItem.pdfUrl || "#");
      heroBtnView.onclick = (e) => {
        triggerHaptic();
        handleNoticeClick(e, url, heroItem.title);
      };
    }
  }

  // Fetch and Render SASTC Notices (cached in memory for fast switching)
  const sastcNoticeList = document.getElementById("sastcNoticeList");
  if (sastcNoticeList) {
    if (sastcNoticesCache) {
      renderSastcNoticeItems(sastcNoticeList, sastcNoticesCache);
    } else if (!sastcNoticesLoading) {
      sastcNoticesLoading = true;
      fetch("./sastc-notices.json")
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then(data => {
          sastcNoticesCache = Array.isArray(data) ? data : [];
          sastcNoticesLoading = false;
          renderSastcNoticeItems(sastcNoticeList, sastcNoticesCache);
        })
        .catch(() => {
          sastcNoticesLoading = false;
          sastcNoticeList.innerHTML = `
            <div class="state-box">
              <i class="fa-solid fa-circle-exclamation" style="color:var(--accent-red)"></i>
              <span>Could not load SASTC notices.</span>
            </div>
          `;
        });
    }
  }
}

function renderSastcNoticeItems(container, data) {
  let filteredSastc = data;

  if (deptPreference !== "ALL") {
    filteredSastc = data.filter(item => {
      const code = item.deptCode || "SASTC";
      return code === deptPreference || code === "SASTC";
    });
  }

  if (!filteredSastc || filteredSastc.length === 0) {
    container.innerHTML = `
      <div class="state-box">
        <i class="fa-regular fa-folder-open"></i>
        <span>No SASTC notices found for ${deptPreference !== "ALL" ? deptPreference : "any department"}.</span>
      </div>
    `;
    return;
  }

  const sorted = [...filteredSastc].sort((a, b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = sorted.map(item => createCardHTML(item, { hideCopy: true })).join("");
}

/**
 * Render Notices (Strictly filtered & paginated for instant DOM performance)
 */
function renderNotices() {
  if (!noticeList) return;
  
  let filtered = getFilteredNoticesSet();

  if (noticeSearchQuery) {
    const q = noticeSearchQuery.toLowerCase();
    filtered = filtered.filter(item => item._searchableText && item._searchableText.includes(q));
  }

  if (filtered.length === 0) {
    noticeList.innerHTML = `
      <div class="state-box">
        <i class="fa-regular fa-folder-open"></i>
        <span>${noticeSearchQuery ? `No notices matching "${escapeHTML(noticeSearchQuery)}"` : `No notices found for ${deptPreference}.`}</span>
      </div>
    `;
    return;
  }

  const visibleItems = filtered.slice(0, noticeVisibleCount);
  let html = visibleItems.map(item => createCardHTML(item)).join("");

  if (filtered.length > noticeVisibleCount) {
    const remaining = filtered.length - noticeVisibleCount;
    html += `
      <button type="button" id="loadMoreNoticesBtn" class="load-more-btn">
        <span>Load More (${remaining} remaining)</span>
        <i class="fa-solid fa-chevron-down"></i>
      </button>
    `;
  }

  noticeList.innerHTML = html;

  const loadMoreBtn = document.getElementById("loadMoreNoticesBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      noticeVisibleCount += PAGE_SIZE;
      renderNotices();
    });
  }
}

/**
 * Render Results (Strictly filtered & paginated for selected department)
 */
function renderResultsView() {
  if (!resultList) return;

  let results = getFilteredResultsSet();

  if (resultSearchQuery) {
    const q = resultSearchQuery.toLowerCase();
    results = results.filter(item => item._searchableText && item._searchableText.includes(q));
  }

  if (results.length === 0) {
    resultList.innerHTML = `
      <div class="state-box">
        <i class="fa-solid fa-square-poll-vertical"></i>
        <span>${resultSearchQuery ? `No results matching "${escapeHTML(resultSearchQuery)}"` : `No SASTC examination results published for ${deptPreference}.`}</span>
      </div>
    `;
    return;
  }

  const visibleItems = results.slice(0, resultVisibleCount);
  let html = visibleItems.map(item => createCardHTML(item)).join("");

  if (results.length > resultVisibleCount) {
    const remaining = results.length - resultVisibleCount;
    html += `
      <button type="button" id="loadMoreResultsBtn" class="load-more-btn">
        <span>Load More (${remaining} remaining)</span>
        <i class="fa-solid fa-chevron-down"></i>
      </button>
    `;
  }

  resultList.innerHTML = html;

  const loadMoreBtn = document.getElementById("loadMoreResultsBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      resultVisibleCount += PAGE_SIZE;
      renderResultsView();
    });
  }
}

/**
 * Card Builder
 */
function createCardHTML(item, options = {}) {
  const isResult = item._isResult !== undefined ? item._isResult : isResultNotice(item);
  const displayBadge = isResult ? "RESULT" : (item._deptCode || detectDeptCode(`${item.department || ''} ${item.title || ''}`));
  const deptIcon = getDeptIcon(displayBadge);

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

  // Strip heavy inline <img> tags from the 2-line preview so cards render & scroll without image layout shifts
  const previewDesc = rawDesc ? rawDesc.replace(/<img[^>]*>/gi, "") : "";

  const shareHtml = options.hideCopy ? "" : `
    <button type="button" class="btn-share" onclick="shareLink('${pdfUrl}', '${titleJS}')" title="Share Link">
      <i class="fa-solid fa-share-nodes"></i>
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
    <div class="card card-animate">
      <div class="card-header">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="badge-dept ${displayBadge === 'RESULT' ? 'badge-result' : ''}">
            <i class="${deptIcon}"></i> ${displayBadge}
          </span>
          ${tagHtml}
        </div>
        <span class="date"><i class="fa-regular fa-calendar"></i> ${date}</span>
      </div>
      <a href="${pdfUrl}" class="notice-title" onclick="handleNoticeClick(event, '${pdfUrl}', '${titleJS}', ${noticeArg})">
        ${title}
      </a>
      ${previewDesc ? `<div class="notice-desc-preview">${previewDesc}</div>` : ""}
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
 * PWA Install Prompt Handler
 */
function initPwaInstall() {
  const installBanner = document.getElementById("pwaInstallBanner");
  const installBtn = document.getElementById("btnInstallApp");
  const closeBtn = document.getElementById("btnCloseInstall");

  // Listen for beforeinstallprompt event
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Check if dismissed before in this session
    if (!sessionStorage.getItem("pwa_install_dismissed") && installBanner) {
      setTimeout(() => {
        installBanner.classList.add("show");
      }, 2000); // 2 second delay for smooth entrance
    }
  });

  // Handle Install Button Click
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      installBanner.classList.remove("show");
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        showToast("SASTC Portal installed successfully!");
      }
      deferredPrompt = null;
    });
  }

  // Handle Dismiss Button Click
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (installBanner) installBanner.classList.remove("show");
      sessionStorage.setItem("pwa_install_dismissed", "true");
    });
  }

  window.addEventListener("appinstalled", () => {
    if (installBanner) installBanner.classList.remove("show");
    deferredPrompt = null;
    showToast("Application is now available on Home Screen");
  });
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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pdfModal && pdfModal.classList.contains("active")) {
      closePdfModal();
    }
  });

  const headerBrand = document.getElementById("headerBrand");
  if (headerBrand) {
    headerBrand.addEventListener("click", () => {
      triggerHaptic();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const headerDeptBtn = document.getElementById("headerDeptBtn");
  if (headerDeptBtn) {
    headerDeptBtn.addEventListener("click", () => {
      triggerHaptic();
      switchTab("settings");
      const selectEl = document.getElementById("deptPreferenceSelect");
      if (selectEl) selectEl.focus();
    });
  }

  const headerSyncBtn = document.getElementById("headerSyncBtn");
  if (headerSyncBtn) {
    headerSyncBtn.addEventListener("click", () => {
      triggerHaptic();
      syncLiveNotices(true);
    });
  }

  const bottomNav = document.querySelector(".bottom-nav");
  const appHeader = document.querySelector(".app-header");
  let lastScrollY = window.scrollY;
  let scrollTicking = false;

  window.addEventListener("scroll", () => {
    if (!scrollTicking) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY;
        if (delta > 8 && currentScrollY > 64) {
          if (bottomNav) bottomNav.classList.add("nav-hidden");
          if (appHeader) appHeader.classList.add("header-hidden");
        } else if (delta < -6 || currentScrollY <= 20) {
          if (bottomNav) bottomNav.classList.remove("nav-hidden");
          if (appHeader) appHeader.classList.remove("header-hidden");
        }
        lastScrollY = currentScrollY;
        scrollTicking = false;
      });
      scrollTicking = true;
    }
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

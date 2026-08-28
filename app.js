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
const LS_NOTIFICATIONS_ENABLED = "sastc_notifications_enabled";
const LS_SEEN_NOTICES_COUNT = "sastc_seen_notices_count";
const LS_SEEN_RESULTS_COUNT = "sastc_seen_results_count";

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
  const sastcNoticeList = document.getElementById("sastcNoticeList");
  resultList = document.getElementById("resultList");

  initDeptPreference();
  initPushNotificationsToggle();
  initApiKeysManagement();

  const LS_SEEN_NOTICES_COUNT = "sastc_seen_notices_count";
  const LS_SEEN_RESULTS_COUNT = "sastc_seen_results_count";

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
  initNavTabs();
  initPwaInstall();
  initCalculator();

  renderAllViews();

  // Background Live Sync
  fetchLiveData().then(live => {
    let hasUpdates = false;
    if (live.noticesData && live.noticesData.length > noticesData.length) {
      noticesData = live.noticesData;
      hasUpdates = true;
    }
    if (live.resultsData && live.resultsData.length > resultsData.length) {
      resultsData = live.resultsData;
      hasUpdates = true;
    }
    if (hasUpdates) {
      rebuildMasterDataset();
      renderAllViews();
      updateBadges();
      
      const seenNoticesKey = `seen_notices_${deptPreference}`;
      const seenResultsKey = `seen_results_${deptPreference}`;
      const seenNotices = parseInt(localStorage.getItem(seenNoticesKey) || 0);
      const seenResults = parseInt(localStorage.getItem(seenResultsKey) || 0);
      
      const noticesSet = getFilteredNoticesSet();
      const resultsSet = getFilteredResultsSet();

      notifyUpdates(Math.max(0, noticesSet.length - seenNotices), Math.max(0, resultsSet.length - seenResults));
    }
  });
});

function initPushNotificationsToggle() {
  const toggle = document.getElementById("pushNotificationToggle");
  if (!toggle) return;
  
  toggle.checked = localStorage.getItem(LS_NOTIFICATIONS_ENABLED) === "true" && Notification.permission === "granted";
  
  toggle.addEventListener("change", async (e) => {
    if (e.target.checked) {
      if (!("Notification" in window)) {
        showToast("Push notifications not supported on this browser.");
        e.target.checked = false;
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        localStorage.setItem(LS_NOTIFICATIONS_ENABLED, "true");
        showToast("Push notifications enabled!");
      } else {
        localStorage.setItem(LS_NOTIFICATIONS_ENABLED, "false");
        e.target.checked = false;
        showToast("Permission denied for notifications.");
      }
    } else {
      localStorage.setItem(LS_NOTIFICATIONS_ENABLED, "false");
      showToast("Push notifications disabled.");
    }
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

function notifyUpdates(newNotices, newResults) {
  if (localStorage.getItem(LS_NOTIFICATIONS_ENABLED) === "true" && Notification.permission === "granted") {
    if (newNotices > 0) new Notification("SASTC Portal", { body: `You have ${newNotices} new notice(s)!` });
    if (newResults > 0) new Notification("SASTC Portal", { body: `You have ${newResults} new result(s)!` });
  }
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

      window.dispatchEvent(new Event('sastc_dept_changed'));
      renderAllViews();
      updateBadges();
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
      const url = formatPdfUrl(heroItem.pdf || heroItem.url || heroItem.pdf_url || heroItem.link || heroItem.pdfUrl || "#");
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
        observeCards();
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
  observeCards();
}

/**
 * Render Results (Strictly filtered for selected department)
 */
function renderResultsView() {
  if (!resultList) return;

  let results = masterDataset.filter(item => {
    if (!item._isResult) return false;
    const text = `${item.title || ''} ${item.department || ''} ${item.category || ''}`.toUpperCase();
    return /\bSASTC\b/i.test(text);
  });

  // Filter based on user's selected department
  if (deptPreference !== "ALL") {
    results = results.filter(item => {
      const text = `${item.title || ''} ${item.department || ''} ${item.category || ''}`.toUpperCase();
      return new RegExp(`\\b${deptPreference}\\b`, "i").test(text);
    });
  }

  if (results.length === 0) {
    resultList.innerHTML = `
      <div class="state-box">
        <i class="fa-solid fa-square-poll-vertical"></i>
        <span>No SASTC examination results published for ${deptPreference}.</span>
      </div>
    `;
    return;
  }

  resultList.innerHTML = results.map(item => createCardHTML(item)).join("");
  observeCards();
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

  const bottomNav = document.querySelector(".bottom-nav");
  const appHeader = document.querySelector(".app-header");
  let lastScrollY = window.scrollY;
  window.addEventListener("scroll", () => {
    if (window.scrollY > lastScrollY && window.scrollY > 50) {
      if (bottomNav) bottomNav.classList.add("nav-hidden");
      if (appHeader) appHeader.classList.add("header-hidden");
    } else {
      if (bottomNav) bottomNav.classList.remove("nav-hidden");
      if (appHeader) appHeader.classList.remove("header-hidden");
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

// Vertical Card Sliding Animation
const scrollObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      scrollObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

function observeCards() {
  document.querySelectorAll('.card-animate:not(.visible)').forEach(card => {
    scrollObserver.observe(card);
  });
}

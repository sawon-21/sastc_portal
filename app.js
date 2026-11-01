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
import * as cseExamMod from './CSE-Exam.js';
import * as agExamMod from './AG-EXAM.js';
import * as bbaExamMod from './BBA-Exam.js';

const cseExamData = cseExamMod.cseExamData || cseExamMod.default || {};
const agExamData = agExamMod.agExamData || agExamMod.default || {};
const bbaExamData = bbaExamMod.bbaExamData || bbaExamMod.default || {};

window.handleNoticeClick = handleNoticeClick;
window.handlePdfView = handlePdfView;
window.copyLink = copyLink;
window.shareLink = shareLink;

// Storage Keys
const LS_ACTIVE_DEPT = "sastc_active_dept";
const LS_DEPT_PREF = "sastc_dept_preference";
const LS_EXAM_LEVEL = "sastc_exam_level";
const LS_EXAM_SEM = "sastc_exam_semester";
const LS_EXAM_DATA_CACHE = "sastc_exam_data_cache";
const LS_EXAM_DIV_CACHE = "sastc_exam_div_cache";
const LS_SEEN_NOTICES_COUNT = "sastc_seen_notices_count";
const LS_SEEN_RESULTS_COUNT = "sastc_seen_results_count";

// State variables
const savedDeptPref = localStorage.getItem(LS_DEPT_PREF);
let deptPreference = savedDeptPref || "CSE";
let activeDept = localStorage.getItem(LS_ACTIVE_DEPT) || deptPreference;
let examLevel = localStorage.getItem(LS_EXAM_LEVEL) || "1";
let examSemester = localStorage.getItem(LS_EXAM_SEM) || "1";
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
  initRandomMotivationCard();
  initDailyCheckinCampaign();
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

    // Show Random Motivation popup after onboarding completes
    setTimeout(() => {
      if (typeof window.openMotivationPopup === "function") {
        window.openMotivationPopup();
      }
    }, 350);
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
function renderExamDatesWidget() {
  const examSemesterLabel = document.getElementById("examSemesterLabel");
  const examSemesterText = document.getElementById("examSemesterText");
  const examSemPopover = document.getElementById("examSemPopover");
  const homeExamLevelSelect = document.getElementById("homeExamLevelSelect");
  const homeExamSemSelect = document.getElementById("homeExamSemSelect");
  const saveExamSemBtn = document.getElementById("saveExamSemBtn");
  const examCardsList = document.getElementById("examCardsList");
  const examScrollNextBtn = document.getElementById("examScrollNextBtn");
  const examTodayChip = document.getElementById("examTodayChip");
  const examInfoSummary = document.getElementById("examInfoSummary");

  if (!examCardsList) return;

  // Bind Level/Semester popover events once
  if (examSemesterLabel && examSemPopover && !examSemesterLabel.dataset.bound) {
    examSemesterLabel.dataset.bound = "true";

    examSemesterLabel.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerHaptic();
      if (homeExamLevelSelect) homeExamLevelSelect.value = examLevel;
      if (homeExamSemSelect) homeExamSemSelect.value = examSemester;
      const isOpen = examSemPopover.classList.toggle("active");
      examSemesterLabel.classList.toggle("open", isOpen);
    });

    if (saveExamSemBtn) {
      saveExamSemBtn.addEventListener("click", () => {
        triggerHaptic();
        if (homeExamLevelSelect) examLevel = homeExamLevelSelect.value;
        if (homeExamSemSelect) examSemester = homeExamSemSelect.value;
        localStorage.setItem(LS_EXAM_LEVEL, examLevel);
        localStorage.setItem(LS_EXAM_SEM, examSemester);
        examSemPopover.classList.remove("active");
        examSemesterLabel.classList.remove("open");
        renderExamDatesWidget();
        showToast(`Saved Level ${examLevel} Semester ${examSemester}`);
      });
    }
  }

  // Bind horizontal scroll button once with auto-hide behavior
  const updateScrollBtnVisibility = () => {
    if (!examScrollNextBtn || !examCardsList) return;
    const maxScroll = examCardsList.scrollWidth - examCardsList.clientWidth;
    if (maxScroll <= 6 || examCardsList.scrollLeft >= maxScroll - 8) {
      examScrollNextBtn.classList.add("auto-hidden");
      examScrollNextBtn.classList.remove("visible");
    } else {
      examScrollNextBtn.classList.remove("auto-hidden");
      examScrollNextBtn.classList.add("visible");
      clearTimeout(examScrollNextBtn._hideTimer);
      examScrollNextBtn._hideTimer = setTimeout(() => {
        examScrollNextBtn.classList.remove("visible");
      }, 2200);
    }
  };

  if (examScrollNextBtn && !examScrollNextBtn.dataset.bound) {
    examScrollNextBtn.dataset.bound = "true";
    examScrollNextBtn.addEventListener("click", () => {
      triggerHaptic();
      const maxScroll = examCardsList.scrollWidth - examCardsList.clientWidth;
      if (examCardsList.scrollLeft >= maxScroll - 10) {
        examCardsList.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        examCardsList.scrollBy({ left: 130, behavior: "smooth" });
      }
      setTimeout(updateScrollBtnVisibility, 320);
    });

    examCardsList.addEventListener("scroll", updateScrollBtnVisibility, { passive: true });
    examCardsList.addEventListener("touchstart", updateScrollBtnVisibility, { passive: true });
  }

  // Update Level & Semester label
  if (examSemesterText) {
    examSemesterText.textContent = `LEVEL ${examLevel} SEMESTER ${examSemester}`;
  }

  // Real Today's Date (normalized to local midnight for accurate day comparison)
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const daysShort = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const todayFormatted = `${String(now.getDate()).padStart(2, "0")} ${monthsShort[now.getMonth()]}`;
  if (examTodayChip) {
    examTodayChip.textContent = todayFormatted;
  }

  // Pick department exam schedule (with localStorage offline persistence)
  let deptMap = {
    CSE: cseExamData,
    AG: agExamData,
    BBA: bbaExamData
  };

  try {
    if (cseExamData && agExamData && bbaExamData) {
      localStorage.setItem(LS_EXAM_DATA_CACHE, JSON.stringify(deptMap));
    } else {
      const cachedDeptMap = JSON.parse(localStorage.getItem(LS_EXAM_DATA_CACHE) || "null");
      if (cachedDeptMap) deptMap = cachedDeptMap;
    }
  } catch (e) {
    try {
      const cachedDeptMap = JSON.parse(localStorage.getItem(LS_EXAM_DATA_CACHE) || "null");
      if (cachedDeptMap) deptMap = cachedDeptMap;
    } catch (_) {}
  }

  const currentDept = ["CSE", "AG", "BBA"].includes(deptPreference) ? deptPreference : "CSE";
  const deptSchedule = deptMap[currentDept] || deptMap.CSE || {};
  const rawExams = (deptSchedule[examLevel] && deptSchedule[examLevel][examSemester]) || [];

  // Pre-hydrate from cached Exam Dates div in localStorage if offline & data is missing
  if (!navigator.onLine && Object.keys(deptSchedule).length === 0) {
    try {
      const savedDivState = JSON.parse(localStorage.getItem(LS_EXAM_DIV_CACHE) || "null");
      if (savedDivState) {
        if (examSemesterText && savedDivState.semesterText) examSemesterText.textContent = savedDivState.semesterText;
        if (examTodayChip && savedDivState.todayText) examTodayChip.textContent = savedDivState.todayText;
        if (examCardsList && savedDivState.cardsHtml) examCardsList.innerHTML = savedDivState.cardsHtml;
        if (examInfoSummary && savedDivState.marqueeHtml) examInfoSummary.innerHTML = savedDivState.marqueeHtml;
        return;
      }
    } catch (_) {}
  }

  // Helper to parse exam date + time into exact day midnight & exact exam cutoff timestamp
  const parseExamTimings = (ex) => {
    const parts = String(ex.date || "").split("-").map(Number);
    const dayMidnight = parts.length === 3
      ? new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
      : new Date(ex.date);
    dayMidnight.setHours(0, 0, 0, 0);

    // Default to 10:00 AM if time string is missing
    let hours = 10;
    let minutes = 0;
    const timeStr = String(ex.time || "10:00 AM").trim();
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const period = (match[3] || "").toUpperCase();
      if (period === "PM" && hours < 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;
    }

    // Exam is valid through the end of its scheduled minute (e.g. 12:30:59.999 PM); at 12:31:00 PM it hides
    const examCutoffDate = new Date(
      dayMidnight.getFullYear(),
      dayMidnight.getMonth(),
      dayMidnight.getDate(),
      hours,
      minutes,
      59,
      999
    );

    return {
      ...ex,
      _dateObj: dayMidnight,
      _dayMidnightMs: dayMidnight.getTime(),
      _cutoffMs: examCutoffDate.getTime()
    };
  };

  // Build marquee summary across all Levels (1-4) and Semesters (1-2) of the selected department
  const marqueeEntries = [];
  const levels = ["1", "2", "3", "4"];
  const sems = ["1", "2"];
  const nowMs = now.getTime();

  levels.forEach(lvl => {
    sems.forEach(sm => {
      const list = (deptSchedule[lvl] && deptSchedule[lvl][sm]) || [];
      const upcomingForSem = list
        .map(parseExamTimings)
        .filter(ex => !isNaN(ex._cutoffMs) && ex._cutoffMs >= nowMs)
        .sort((a, b) => a._cutoffMs - b._cutoffMs);

      if (upcomingForSem.length > 0) {
        const nextEx = upcomingForSem[0];
        const dStr = `${String(nextEx._dateObj.getDate()).padStart(2, "0")} ${monthsShort[nextEx._dateObj.getMonth()]}`;
        const colorKey = `l${lvl}s${sm}`;
        marqueeEntries.push(
          `<span class="marquee-sem-pill ${colorKey}">L${lvl} S${sm} - ${escapeHTML(dStr)} [${escapeHTML(nextEx.code)}]</span>`
        );
      }
    });
  });

  if (examInfoSummary) {
    if (marqueeEntries.length > 0) {
      const joinedHtml = marqueeEntries.join("");
      examInfoSummary.innerHTML = `
        <span class="exam-marquee-track">
          <span class="exam-marquee-group">${joinedHtml}</span>
          <span class="exam-marquee-group" aria-hidden="true">${joinedHtml}</span>
        </span>
      `;
    } else {
      examInfoSummary.textContent = `No published upcoming exams for ${currentDept}`;
    }
  }

  // Parse, filter out finished exams (whose exact scheduled time has passed), and sort ascending
  const parsedExams = rawExams
    .map(parseExamTimings)
    .filter(ex => !isNaN(ex._cutoffMs) && ex._cutoffMs >= nowMs)
    .sort((a, b) => a._cutoffMs - b._cutoffMs);

  if (parsedExams.length === 0) {
    examCardsList.innerHTML = `<div class="state-box" style="width:100%; padding:14px;"><span>No upcoming exams for ${currentDept} Level ${examLevel} Semester ${examSemester}.</span></div>`;
  } else {
    const cardsHtml = parsedExams.map((exam, idx) => {
      const d = exam._dateObj;
      const dateNumStr = `${String(d.getDate()).padStart(2, "0")} ${monthsShort[d.getMonth()]}`;
      const dayNameStr = daysShort[d.getDay()];
      const diffFromTodayDays = Math.round((exam._dayMidnightMs - todayMidnight.getTime()) / 86400000);

      // Status badge logic based on real date (first remaining exam is NEXT EXAM / TODAY)
      let statusTagHtml = "";
      let cardStateClass = "";

      if (idx === 0) {
        cardStateClass = "is-next";
        const badgeLabel = diffFromTodayDays === 0 ? "TODAY" : "NEXT EXAM";
        statusTagHtml = `<div class="exam-status-tag next"><span class="dot"></span> ${badgeLabel}</div>`;
      } else {
        statusTagHtml = `<div class="exam-status-tag upcoming">UPCOMING</div>`;
      }

      // Gap calculation based on real dates
      let gapText = "GAP: --";
      let gapClass = "neutral";

      if (idx === 0) {
        if (diffFromTodayDays === 0) {
          gapText = "Today";
          gapClass = "neutral";
        } else if (diffFromTodayDays === 1) {
          gapText = "Tomorrow";
          gapClass = "neutral";
        } else if (diffFromTodayDays > 1) {
          gapText = `In ${diffFromTodayDays} Days`;
          gapClass = "neutral";
        } else {
          gapText = "Today";
          gapClass = "neutral";
        }
      } else {
        const prevExam = parsedExams[idx - 1];
        const diffBetweenExams = Math.round((exam._dayMidnightMs - prevExam._dayMidnightMs) / 86400000);
        const prepGap = diffBetweenExams > 1 ? diffBetweenExams - 1 : diffBetweenExams;
        gapText = `GAP: ${prepGap} ${prepGap === 1 ? "Day" : "Days"}`;
        gapClass = "teal";
      }

      return `
        <div class="exam-slot-card ${cardStateClass}">
          ${statusTagHtml}
          <div class="exam-date-num">${escapeHTML(dateNumStr)}</div>
          <div class="exam-date-day">${escapeHTML(dayNameStr)}</div>
          <div class="exam-divider"></div>
          <div class="exam-course-code">${escapeHTML(exam.code)}</div>
          <div class="exam-meta-list">
            <div class="exam-meta-item"><i class="fa-regular fa-clock"></i> <span>${escapeHTML(exam.time || "10:00 AM")}</span></div>
          </div>
          <div class="exam-gap-pill ${gapClass}">${escapeHTML(gapText)}</div>
        </div>
      `;
    }).join("");

    examCardsList.innerHTML = cardsHtml;
  }

  // Schedule automatic re-check every 30 seconds so exams hide immediately when their minute passes
  if (!window._examAutoRefreshTimer) {
    window._examAutoRefreshTimer = setInterval(() => {
      renderExamDatesWidget();
    }, 30000);
  }

  requestAnimationFrame(updateScrollBtnVisibility);

  // Save rendered Exam Dates div state in localStorage for offline access
  try {
    localStorage.setItem(LS_EXAM_DIV_CACHE, JSON.stringify({
      dept: currentDept,
      level: examLevel,
      semester: examSemester,
      semesterText: examSemesterText ? examSemesterText.textContent : "",
      todayText: examTodayChip ? examTodayChip.textContent : "",
      cardsHtml: examCardsList.innerHTML,
      marqueeHtml: examInfoSummary ? examInfoSummary.innerHTML : "",
      savedAt: Date.now()
    }));
  } catch (_) {}
}

function renderHomeView() {
  renderExamDatesWidget();

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
  const displayBadge = isResult ? "RESULT" : (item._deptCode || item.deptCode || detectDeptCode(`${item.department || ''} ${item.title || ''}`));
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

  const devAboutToggleBtn = document.getElementById("devAboutToggleBtn");
  const devAboutContent = document.getElementById("devAboutContent");
  if (devAboutToggleBtn && devAboutContent) {
    devAboutToggleBtn.addEventListener("click", () => {
      triggerHaptic();
      const isOpen = devAboutContent.classList.toggle("open");
      devAboutToggleBtn.classList.toggle("open", isOpen);
      devAboutToggleBtn.setAttribute("aria-expanded", String(isOpen));
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

/**
 * ============================================================================
 * SECURE DAILY CHECK-IN — REWARDS CAMPAIGN (NOV 1, 2026 – NOV 7, 2026)
 * One Device = One Join | Tamper-Protected | 6-Char Secret Code (a-e, 1-5)
 * ============================================================================
 */
const LS_CHECKIN_STATE = "sastc_daily_checkin_2026";
const LS_CHECKIN_RECORD = "sastc_checkin_claim_record";
const LS_CHECKIN_FINISHED = "sastc_checkin_finished";
const LS_DEVICE_LOCK_KEY = "sastc_device_campaign_lock_v1";
const COOKIE_LOCK_NAME = "sastc_c_lock_v1";
const IDB_NAME = "SASTCSecureCampaignDB";
const IDB_STORE = "device_vault";
const WHATSAPP_REWARD_URL = "https://wa.me/qr/KD2ML6XBFZ4OJ1";
const ALLOWED_CODE_CHARS = "abcde12345"; // 10 characters: a-e and 1-5
const SECURITY_SALT = "SASTC_HSTU_NOV2026_PRO_VAULT_99x";

const CAMPAIGN_DAYS = [
  { dayNum: 1, date: "2026-11-01", shortDay: "Sun", label: "Nov 1" },
  { dayNum: 2, date: "2026-11-02", shortDay: "Mon", label: "Nov 2" },
  { dayNum: 3, date: "2026-11-03", shortDay: "Tue", label: "Nov 3" },
  { dayNum: 4, date: "2026-11-04", shortDay: "Wed", label: "Nov 4" },
  { dayNum: 5, date: "2026-11-05", shortDay: "Thu", label: "Nov 5" },
  { dayNum: 6, date: "2026-11-06", shortDay: "Fri", label: "Nov 6" },
  { dayNum: 7, date: "2026-11-07", shortDay: "Sat", label: "Nov 7" }
];

function fnv1aHash(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x4b13a92d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

function computeHardwareDeviceId() {
  try {
    const signals = [
      navigator.platform || "",
      navigator.language || "",
      String(navigator.hardwareConcurrency || ""),
      String(navigator.deviceMemory || ""),
      String(screen.width || 0) + "x" + String(screen.height || 0),
      String(screen.colorDepth || 0),
      String(window.devicePixelRatio || 1),
      Intl.DateTimeFormat().resolvedOptions().timeZone || ""
    ];

    // Canvas 2D hardware raster fingerprint
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 36;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(10, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("SASTC-2026-LOCK", 2, 12);
        signals.push(canvas.toDataURL().slice(-64));
      }
    } catch (_) {}

    // WebGL GPU renderer fingerprint
    try {
      const glCanvas = document.createElement("canvas");
      const gl = glCanvas.getContext("webgl") || glCanvas.getContext("experimental-webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          signals.push(String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || ""));
          signals.push(String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ""));
        }
      }
    } catch (_) {}

    const digest = fnv1aHash(signals.join("|"));
    return "DEV-" + digest.slice(0, 10).toUpperCase();
  } catch (e) {
    return "DEV-FALLBACK01";
  }
}

const CURRENT_DEVICE_ID = computeHardwareDeviceId();

/**
 * Generates a 6-character random code strictly using characters (a-e and 1-5)
 */
function generateSixCharRewardCode() {
  const randomValues = new Uint32Array(6);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < 6; i++) {
      randomValues[i] = Math.floor(Math.random() * 100000);
    }
  }
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += ALLOWED_CODE_CHARS[randomValues[i] % ALLOWED_CODE_CHARS.length];
  }
  return result;
}

function isValidRewardCode(code) {
  return typeof code === "string" && /^[a-e1-5]{6}$/.test(code);
}

function computeStateSignature(state) {
  const claimedKey = CAMPAIGN_DAYS.map(d => `${d.date}:${state.claimedDays && state.claimedDays[d.date] ? 1 : 0}`).join(",");
  const raw = [
    SECURITY_SALT,
    CURRENT_DEVICE_ID,
    state.joined ? "J1" : "J0",
    claimedKey,
    state.missed ? "M1" : "M0",
    state.finished ? "F1" : "F0",
    state.rewardCode || "NONE"
  ].join("|");
  return fnv1aHash(raw);
}

function setBackupCookie(state) {
  try {
    const compact = {
      d: CURRENT_DEVICE_ID,
      j: state.joined ? 1 : 0,
      ja: state.joinedAt,
      c: state.claimedDays,
      m: state.missed ? 1 : 0,
      md: state.missedDate,
      f: state.finished ? 1 : 0,
      rc: state.rewardCode,
      s: state.signature
    };
    const encoded = encodeURIComponent(btoa(JSON.stringify(compact)));
    document.cookie = `${COOKIE_LOCK_NAME}=${encoded}; max-age=31536000; path=/; SameSite=Lax`;
  } catch (_) {}
}

function readBackupCookie() {
  try {
    const match = document.cookie.split("; ").find(row => row.startsWith(`${COOKIE_LOCK_NAME}=`));
    if (!match) return null;
    const val = match.split("=")[1];
    const compact = JSON.parse(atob(decodeURIComponent(val)));
    if (!compact || compact.d !== CURRENT_DEVICE_ID) return null;
    return {
      deviceId: compact.d,
      joined: Boolean(compact.j),
      joinedAt: compact.ja || null,
      claimedDays: compact.c || {},
      missed: Boolean(compact.m),
      missedDate: compact.md || null,
      finished: Boolean(compact.f),
      rewardCode: compact.rc || null,
      signature: compact.s || null
    };
  } catch (_) {
    return null;
  }
}

function saveToIndexedDBVault(state) {
  try {
    if (!window.indexedDB) return;
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "deviceId" });
      }
    };
    req.onsuccess = (e) => {
      try {
        const db = e.target.result;
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put({ ...state, deviceId: CURRENT_DEVICE_ID });
      } catch (_) {}
    };
  } catch (_) {}
}

function loadFromIndexedDBVault() {
  return new Promise((resolve) => {
    try {
      if (!window.indexedDB) return resolve(null);
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "deviceId" });
        }
      };
      req.onsuccess = (e) => {
        try {
          const db = e.target.result;
          const tx = db.transaction(IDB_STORE, "readonly");
          const getReq = tx.objectStore(IDB_STORE).get(CURRENT_DEVICE_ID);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

function getLocalTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDefaultCheckinState() {
  const initial = {
    campaignId: "nov_1_7_2026_google_pro",
    deviceId: CURRENT_DEVICE_ID,
    startDate: "2026-11-01",
    endDate: "2026-11-07",
    joined: false,
    joinedAt: null,
    claimedDays: {
      "2026-11-01": false,
      "2026-11-02": false,
      "2026-11-03": false,
      "2026-11-04": false,
      "2026-11-05": false,
      "2026-11-06": false,
      "2026-11-07": false
    },
    claimTimestamps: {},
    streakCount: 0,
    missed: false,
    missedDate: null,
    finished: false,
    finishedAt: null,
    rewardCode: null,
    rewardWhatsappUrl: WHATSAPP_REWARD_URL,
    signature: null
  };
  initial.signature = computeStateSignature(initial);
  return initial;
}

function sanitizeAndVerifyLoadedState(candidate, backup) {
  const fallback = getDefaultCheckinState();
  const todayStr = getLocalTodayStr();

  // Merge candidate and backup monotonically so a user cannot delete localStorage to reset a missed streak or re-join
  const source = candidate || backup;
  if (!source) return fallback;

  // Verify cryptographic signature if present; if tampered in localStorage, fall back to cookie backup or reject forged future claims
  let trusted = source;
  if (candidate && candidate.signature) {
    const expectedSig = computeStateSignature(candidate);
    if (expectedSig !== candidate.signature) {
      // Tampering detected in localStorage!
      trusted = backup && backup.signature === computeStateSignature(backup) ? backup : fallback;
    }
  }

  const mergedClaimed = { ...fallback.claimedDays };
  CAMPAIGN_DAYS.forEach(d => {
    // A day cannot be claimed in the future (prevents DevTools manual true injection for future dates)
    const fromTrusted = Boolean(trusted.claimedDays && trusted.claimedDays[d.date] === true);
    const fromBackup = Boolean(backup && backup.claimedDays && backup.claimedDays[d.date] === true);
    if (d.date <= todayStr && (fromTrusted || fromBackup)) {
      mergedClaimed[d.date] = true;
    } else {
      mergedClaimed[d.date] = false;
    }
  });

  const joined = Boolean(
    trusted.joined ||
    (backup && backup.joined) ||
    localStorage.getItem(LS_DEVICE_LOCK_KEY) === CURRENT_DEVICE_ID
  );

  const state = {
    ...fallback,
    ...trusted,
    deviceId: CURRENT_DEVICE_ID,
    joined,
    joinedAt: trusted.joinedAt || (backup && backup.joinedAt) || (joined ? new Date().toISOString() : null),
    claimedDays: mergedClaimed,
    missed: Boolean(trusted.missed || (backup && backup.missed)),
    missedDate: trusted.missedDate || (backup && backup.missedDate) || null,
    rewardCode: isValidRewardCode(trusted.rewardCode)
      ? trusted.rewardCode
      : backup && isValidRewardCode(backup.rewardCode)
      ? backup.rewardCode
      : null
  };

  return state;
}

function loadCheckinState() {
  const cookieBackup = readBackupCookie();
  try {
    const raw = localStorage.getItem(LS_CHECKIN_STATE);
    const parsed = raw ? JSON.parse(raw) : null;
    return sanitizeAndVerifyLoadedState(parsed, cookieBackup);
  } catch (e) {
    return sanitizeAndVerifyLoadedState(null, cookieBackup);
  }
}

function saveCheckinState(state) {
  try {
    state.deviceId = CURRENT_DEVICE_ID;
    state.signature = computeStateSignature(state);
    localStorage.setItem(LS_CHECKIN_STATE, JSON.stringify(state));
    localStorage.setItem(LS_CHECKIN_RECORD, JSON.stringify(state.claimedDays));
    localStorage.setItem(LS_CHECKIN_FINISHED, String(Boolean(state.finished)));
    if (state.joined) {
      localStorage.setItem(LS_DEVICE_LOCK_KEY, CURRENT_DEVICE_ID);
    }
    setBackupCookie(state);
    saveToIndexedDBVault(state);
  } catch (e) {
    console.warn("Could not save check-in state", e);
  }
}

function evaluateAndSyncCheckinState(state) {
  const todayStr = getLocalTodayStr();

  // Count consecutive claimed days from Day 1 (Nov 1)
  let streak = 0;
  for (const day of CAMPAIGN_DAYS) {
    if (state.claimedDays[day.date] === true) {
      streak++;
    } else {
      break;
    }
  }
  state.streakCount = streak;

  // Check if all 7 days are claimed
  const allSevenClaimed = CAMPAIGN_DAYS.every(d => state.claimedDays[d.date] === true);
  if (allSevenClaimed && !state.missed) {
    state.finished = true;
    state.missed = false;
    state.missedDate = null;
    if (!state.finishedAt) {
      state.finishedAt = new Date().toISOString();
    }
    if (!isValidRewardCode(state.rewardCode)) {
      state.rewardCode = generateSixCharRewardCode();
    }
    saveCheckinState(state);
    return state;
  } else {
    state.finished = false;
  }

  // Enforce strict consecutive rule: if any campaign day strictly before today was NOT claimed, streak is broken
  let missedDayFound = null;
  for (const day of CAMPAIGN_DAYS) {
    if (day.date < todayStr && state.claimedDays[day.date] !== true) {
      missedDayFound = day.date;
      break;
    }
  }

  if (missedDayFound) {
    state.missed = true;
    state.missedDate = missedDayFound;
  } else if (todayStr > "2026-11-07" && !state.finished) {
    state.missed = true;
    state.missedDate = "2026-11-07";
  } else {
    state.missed = false;
    state.missedDate = null;
  }

  saveCheckinState(state);
  return state;
}

function getRosetteBadgeSVG(status) {
  // Scalloped 12-point rosette badge matching the uploaded screenshot UI
  const fill =
    status === "claimed"
      ? "#5b46f6"
      : status === "missed"
      ? "#ef4444"
      : "#9ca3af";

  const iconPath =
    status === "missed"
      ? `<path d="M9.5 9.5L14.5 14.5M14.5 9.5L9.5 14.5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="M8.5 12.3L10.9 14.7L15.8 9.6" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`;

  return `
    <svg class="checkin-badge-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 1.8C13.1 1.8 14.1 2.5 14.6 3.5C15.6 3.1 16.8 3.3 17.6 4.1C18.4 4.9 18.6 6.1 18.2 7.1C19.2 7.6 19.9 8.6 19.9 9.7C19.9 10.8 19.2 11.8 18.2 12.3C18.6 13.3 18.4 14.5 17.6 15.3C16.8 16.1 15.6 16.3 14.6 15.9C14.1 16.9 13.1 17.6 12 17.6C10.9 17.6 9.9 16.9 9.4 15.9C8.4 16.3 7.2 16.1 6.4 15.3C5.6 14.5 5.4 13.3 5.8 12.3C4.8 11.8 4.1 10.8 4.1 9.7C4.1 8.6 4.8 7.6 5.8 7.1C5.4 6.1 5.6 4.9 6.4 4.1C7.2 3.3 8.4 3.1 9.4 3.5C9.9 2.5 10.9 1.8 12 1.8Z" transform="translate(0, 2.3)" fill="${fill}"/>
      ${iconPath}
    </svg>
  `;
}

function initDailyCheckinCampaign() {
  const daysGrid = document.getElementById("checkinDaysGrid");
  const streakTitle = document.getElementById("checkinStreakTitle");
  const streakSub = document.getElementById("checkinStreakSub");
  const topSubtitle = document.getElementById("checkinTopSubtitle");
  const rewardLabel = document.getElementById("checkinRewardLabel");
  const rewardBig = document.getElementById("checkinRewardBig");
  const rewardUnit = document.getElementById("checkinRewardUnit");
  const rewardPerks = document.getElementById("checkinRewardPerks");
  const actionBtn = document.getElementById("checkinActionBtn");
  const winnerBanner = document.getElementById("checkinWinnerBanner");

  const cardSecretCodeEl = document.getElementById("checkinCardSecretCode");
  const modalSecretCodeEl = document.getElementById("campaignModalSecretCode");
  const cardDeviceIdTag = document.getElementById("cardDeviceIdTag");
  const modalDeviceIdTag = document.getElementById("modalDeviceIdTag");
  const copyCardSecretBtn = document.getElementById("copyCardSecretBtn");
  const copyModalSecretBtn = document.getElementById("copyModalSecretBtn");

  const openModalBtn = document.getElementById("openCampaignModalBtn");
  const campaignModal = document.getElementById("checkinCampaignModal");
  const closeCampaignModalBtn = document.getElementById("closeCampaignModalBtn");
  const modalActionBtn = document.getElementById("campaignModalActionBtn");
  const modalStatusText = document.getElementById("campaignModalStatusText");
  const modalStreakBadge = document.getElementById("campaignModalStreakBadge");
  const modalWinnerBox = document.getElementById("campaignModalWinnerBox");

  if (!daysGrid || !actionBtn) return;

  let state = evaluateAndSyncCheckinState(loadCheckinState());

  // Sync with IndexedDB & Server Device Registry to prevent multi-join or reset bypass
  function syncWithVaultAndServer() {
    loadFromIndexedDBVault().then(idbRecord => {
      if (idbRecord && idbRecord.deviceId === CURRENT_DEVICE_ID) {
        if (idbRecord.joined && !state.joined) state.joined = true;
        if (idbRecord.missed && !state.missed) {
          state.missed = true;
          state.missedDate = idbRecord.missedDate;
        }
        if (idbRecord.claimedDays) {
          CAMPAIGN_DAYS.forEach(d => {
            if (idbRecord.claimedDays[d.date] === true && d.date <= getLocalTodayStr()) {
              state.claimedDays[d.date] = true;
            }
          });
        }
        if (isValidRewardCode(idbRecord.rewardCode) && !state.rewardCode) {
          state.rewardCode = idbRecord.rewardCode;
        }
        state = evaluateAndSyncCheckinState(state);
        renderCheckinUI();
      }

      fetch("/api/campaign/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: CURRENT_DEVICE_ID, clientState: state })
      })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data && data.lockedState) {
            const srv = data.lockedState;
            if (srv.joined) state.joined = true;
            if (srv.missed) {
              state.missed = true;
              state.missedDate = srv.missedDate || state.missedDate;
            }
            if (srv.claimedDays) {
              CAMPAIGN_DAYS.forEach(d => {
                if (srv.claimedDays[d.date] === true && d.date <= getLocalTodayStr()) {
                  state.claimedDays[d.date] = true;
                }
              });
            }
            if (isValidRewardCode(srv.rewardCode)) {
              state.rewardCode = srv.rewardCode;
            }
            state = evaluateAndSyncCheckinState(state);
            renderCheckinUI();
          }
        })
        .catch(() => {});
    });
  }

  syncWithVaultAndServer();

  function openCampaignPopup() {
    state = evaluateAndSyncCheckinState(loadCheckinState());
    renderCheckinUI();
    if (campaignModal) {
      campaignModal.classList.add("active");
    }
  }

  function closeCampaignPopup() {
    if (campaignModal) {
      campaignModal.classList.remove("active");
    }
  }

  window.openDailyCheckinPopup = openCampaignPopup;

  function copyRewardCode() {
    if (!state.rewardCode) return;
    triggerHaptic();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.rewardCode).then(() => {
        showToast(`Secret Code "${state.rewardCode}" copied! Take a screenshot too.`);
      }).catch(() => {
        showToast(`Secret Code: ${state.rewardCode}`);
      });
    } else {
      showToast(`Secret Code: ${state.rewardCode}`);
    }
  }

  if (copyCardSecretBtn) copyCardSecretBtn.addEventListener("click", copyRewardCode);
  if (copyModalSecretBtn) copyModalSecretBtn.addEventListener("click", copyRewardCode);

  function renderCheckinUI() {
    const todayStr = getLocalTodayStr();
    const isBeforeStart = todayStr < "2026-11-01";
    const isDuringCampaign = todayStr >= "2026-11-01" && todayStr <= "2026-11-07";
    const isTodayClaimed = Boolean(state.claimedDays[todayStr]);

    if (cardDeviceIdTag) cardDeviceIdTag.textContent = CURRENT_DEVICE_ID;
    if (modalDeviceIdTag) modalDeviceIdTag.textContent = CURRENT_DEVICE_ID;

    // 1. Render 7-Day Grid (Nov 1 – Nov 7)
    daysGrid.innerHTML = CAMPAIGN_DAYS.map(day => {
      const isClaimed = Boolean(state.claimedDays[day.date]);
      const isPastUnclaimed = day.date < todayStr && !isClaimed && !state.finished;
      const isTodayActive = day.date === todayStr && !isClaimed && !state.missed && !state.finished;

      const badgeStatus = isClaimed
        ? "claimed"
        : isPastUnclaimed
        ? "missed"
        : "unclaimed";

      const pillClasses = [
        "checkin-day-pill",
        isClaimed ? "claimed" : "unclaimed",
        isTodayActive ? "today-active" : "",
        isPastUnclaimed ? "missed-day" : ""
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <div class="${pillClasses}" data-date="${day.date}">
          ${getRosetteBadgeSVG(badgeStatus)}
          <span class="checkin-day-name">${day.shortDay}</span>
          <span class="checkin-day-date">${day.label}</span>
        </div>
      `;
    }).join("");

    // 2. Render Top Streak Heading & Subtitles
    if (streakTitle) {
      streakTitle.textContent = `${state.streakCount}-day streak`;
    }

    if (state.finished) {
      if (!isValidRewardCode(state.rewardCode)) {
        state.rewardCode = generateSixCharRewardCode();
        saveCheckinState(state);
      }

      if (cardSecretCodeEl) cardSecretCodeEl.textContent = state.rewardCode;
      if (modalSecretCodeEl) modalSecretCodeEl.textContent = state.rewardCode;

      if (topSubtitle) topSubtitle.textContent = "7-Day Challenge Completed! 🎉";
      if (streakSub) {
        streakSub.textContent = `Secret Code: ${state.rewardCode} • Take a screenshot & submit to WhatsApp AI Bot!`;
        streakSub.classList.remove("checkin-Streak-missed-text");
      }
      if (rewardLabel) rewardLabel.textContent = "6-Digit Secret Code";
      if (rewardBig) rewardBig.textContent = state.rewardCode;
      if (rewardUnit) rewardUnit.textContent = "Verified ✓";
      if (rewardPerks) rewardPerks.textContent = "📸 Take Screenshot & Submit to WhatsApp AI Bot";

      actionBtn.textContent = "WhatsApp AI Bot 🤖";
      actionBtn.className = "btn-checkin-action btn-winner";
      actionBtn.disabled = false;

      if (winnerBanner) winnerBanner.style.display = "flex";
    } else if (state.missed) {
      if (topSubtitle) topSubtitle.textContent = "Campaign Streak Interrupted (1 Device = 1 Join)";
      if (streakSub) {
        streakSub.textContent = "১ দিন ক্লেইম মিস করায় এই ডিভাইসের স্ট্রিক বাতিল হয়েছে";
        streakSub.classList.add("checkin-Streak-missed-text");
      }
      if (rewardLabel) rewardLabel.textContent = "Device Locked";
      if (rewardBig) rewardBig.textContent = "Missed";
      if (rewardUnit) rewardUnit.textContent = "Streak Broken";
      if (rewardPerks) rewardPerks.textContent = `Device ${CURRENT_DEVICE_ID} • 1 Device can join only 1 time`;

      actionBtn.textContent = "Missed";
      actionBtn.className = "btn-checkin-action btn-missed";
      actionBtn.disabled = false;
      if (winnerBanner) winnerBanner.style.display = "none";
    } else if (isBeforeStart) {
      if (topSubtitle) topSubtitle.textContent = "Check in every day (Nov 1 – Nov 7) to win";
      if (streakSub) {
        streakSub.textContent = state.joined
          ? `Device Locked (${CURRENT_DEVICE_ID}) ✓ • Starts Nov 1, 2026!`
          : "1 Device = 1 Join • Starts November 1, 2026";
        streakSub.classList.remove("checkin-Streak-missed-text");
      }
      if (rewardLabel) rewardLabel.textContent = "7-Day Grand Reward";
      if (rewardBig) rewardBig.textContent = "5000GB";
      if (rewardUnit) rewardUnit.textContent = "+ Gemini AI Pro";
      if (rewardPerks) rewardPerks.textContent = "Full Nov Google Pro • Unlimited Image/Video • Flow • Meet";

      actionBtn.textContent = state.joined ? "Joined ✓ (Nov 1)" : "Join Campaign";
      actionBtn.className = "btn-checkin-action";
      actionBtn.disabled = false;
      if (winnerBanner) winnerBanner.style.display = "none";
    } else if (isDuringCampaign) {
      const currentDayObj = CAMPAIGN_DAYS.find(d => d.date === todayStr);
      const dayNumber = currentDayObj ? currentDayObj.dayNum : state.streakCount + 1;

      if (isTodayClaimed) {
        if (topSubtitle) topSubtitle.textContent = `Device Verified (${CURRENT_DEVICE_ID})`;
        if (streakSub) {
          streakSub.textContent = `Day ${dayNumber}/7 claimed! Come back tomorrow to keep your streak.`;
          streakSub.classList.remove("checkin-Streak-missed-text");
        }
        if (rewardLabel) rewardLabel.textContent = "Today's status";
        if (rewardBig) rewardBig.textContent = `Day ${dayNumber}`;
        if (rewardUnit) rewardUnit.textContent = "Claimed ✓";
        if (rewardPerks) rewardPerks.textContent = `${7 - state.streakCount} more day(s) to unlock 6-Digit Secret Code!`;

        actionBtn.textContent = "Claimed ✓";
        actionBtn.className = "btn-checkin-action btn-claimed";
        actionBtn.disabled = false;
      } else {
        if (topSubtitle) topSubtitle.textContent = "Check in every day to earn Google Pro";
        if (streakSub) {
          streakSub.textContent = state.joined
            ? `Keep going! Claim Day ${dayNumber} of 7 today!`
            : "Join (1 Device = 1 Time) & claim today's check-in!";
          streakSub.classList.remove("checkin-Streak-missed-text");
        }
        if (rewardLabel) rewardLabel.textContent = "Today's reward";
        if (rewardBig) rewardBig.textContent = `+Day ${dayNumber}`;
        if (rewardUnit) rewardUnit.textContent = "of 7 Streak";
        if (rewardPerks) rewardPerks.textContent = "Gemini AI Pro • Flow • Meet • 5000GB Storage";

        actionBtn.textContent = state.joined ? "Check-in" : "Join & Claim";
        actionBtn.className = "btn-checkin-action";
        actionBtn.disabled = false;
      }
      if (winnerBanner) winnerBanner.style.display = "none";
    }

    // 3. Sync Campaign Popup Modal Status & CTA
    if (modalStreakBadge) {
      modalStreakBadge.textContent = `${state.streakCount} / 7 Days • ${CURRENT_DEVICE_ID}`;
    }
    if (modalWinnerBox) {
      modalWinnerBox.style.display = state.finished ? "block" : "none";
    }

    if (modalStatusText && modalActionBtn) {
      if (state.finished) {
        modalStatusText.textContent = `Code: ${state.rewardCode} (Completed 7/7)`;
        modalActionBtn.innerHTML = `<i class="fa-brands fa-whatsapp"></i> <span>WhatsApp AI Bot-এ সাবমিট করুন</span>`;
      } else if (state.missed) {
        modalStatusText.textContent = "Status: ১ দিন মিস করায় এই ডিভাইস লক হয়েছে";
        modalActionBtn.innerHTML = `<i class="fa-solid fa-lock"></i> <span>Device Locked (1 Join Only)</span>`;
      } else if (!state.joined) {
        modalStatusText.textContent = "Status: Not Joined Yet (1 Device = 1 Join)";
        modalActionBtn.innerHTML = `<i class="fa-solid fa-rocket"></i> <span>Join Campaign Now (1-Time Only)</span>`;
      } else if (isBeforeStart) {
        modalStatusText.textContent = "Status: Device Registered ✓ (Starts Nov 1)";
        modalActionBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> <span>Device Joined • Starts Nov 1</span>`;
      } else if (isDuringCampaign && !isTodayClaimed) {
        modalStatusText.textContent = "Status: Today's Check-in Ready!";
        modalActionBtn.innerHTML = `<i class="fa-solid fa-fire-flame-curved"></i> <span>Claim Today's Check-in Now</span>`;
      } else {
        modalStatusText.textContent = `Status: Active Streak (${state.streakCount}/7)`;
        modalActionBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> <span>Today Claimed • Come Back Tomorrow</span>`;
      }
    }
  }

  function handleJoinOrClaimAction(fromModal = false) {
    triggerHaptic();
    state = evaluateAndSyncCheckinState(loadCheckinState());
    const todayStr = getLocalTodayStr();
    const isBeforeStart = todayStr < "2026-11-01";
    const isDuringCampaign = todayStr >= "2026-11-01" && todayStr <= "2026-11-07";

    // Case 1: Already finished all 7 days -> Open Winner Popup with 6-digit code & WhatsApp AI Bot
    if (state.finished) {
      if (fromModal) {
        const waLink = document.getElementById("checkinWhatsappDirectBtn");
        if (waLink) waLink.click();
      } else {
        openCampaignPopup();
      }
      return;
    }

    // Case 2: Missed a day -> Device is permanently locked from re-joining
    if (state.missed) {
      showToast("১টি ডিভাইস থেকে ১ বারই অংশ নেওয়া যায়। ১ দিন মিস করায় অফারটি বাতিল হয়েছে।");
      if (!fromModal) {
        openCampaignPopup();
      }
      return;
    }

    // Case 3: Before Nov 1, 2026 -> Join campaign (1 time per device)
    if (isBeforeStart) {
      if (!state.joined) {
        state.joined = true;
        state.joinedAt = new Date().toISOString();
        saveCheckinState(state);
        syncWithVaultAndServer();
        renderCheckinUI();
        showToast(`🔒 ডিভাইস (${CURRENT_DEVICE_ID}) সফলভাবে যুক্ত হয়েছে! ১ নভেম্বর থেকে প্রতিদিন ক্লেইম করুন।`);
        if (!fromModal) {
          openCampaignPopup();
        }
      } else {
        showToast("এই ডিভাইসটি ইতিমধ্যে ক্যাম্পেইনে যুক্ত আছে! ১ নভেম্বর থেকে Check-in শুরু হবে।");
        if (!fromModal) {
          openCampaignPopup();
        } else {
          closeCampaignPopup();
        }
      }
      return;
    }

    // Case 4: During Nov 1 – Nov 7, 2026
    if (isDuringCampaign) {
      if (!state.joined) {
        state.joined = true;
        state.joinedAt = new Date().toISOString();
      }

      if (state.claimedDays[todayStr] === true) {
        showToast("আজকের Check-in ইতিমধ্যে সম্পন্ন হয়েছে! আগামীকাল আবার ক্লেইম করুন।");
        if (fromModal) {
          closeCampaignPopup();
        }
        renderCheckinUI();
        return;
      }

      // Claim today's check-in!
      state.claimedDays[todayStr] = true;
      state.claimTimestamps[todayStr] = new Date().toISOString();
      state = evaluateAndSyncCheckinState(state);
      syncWithVaultAndServer();
      renderCheckinUI();

      if (state.finished) {
        // Day 7 on Nov 7 claimed! Automatically show 6-digit code & prompt screenshot + WhatsApp AI Bot!
        showToast(`🎉 ৭ দিন সম্পন্ন! আপনার গোপন কোড: ${state.rewardCode} — স্ক্রিনশট নিয়ে WhatsApp AI Bot-এ দিন!`);
        openCampaignPopup();
      } else {
        showToast(`🔥 Day ${state.streakCount}/7 Check-in Claimed! Keep your streak going!`);
        if (fromModal) {
          closeCampaignPopup();
        }
      }
    }
  }

  // Event Listeners
  actionBtn.addEventListener("click", () => handleJoinOrClaimAction(false));

  if (openModalBtn) {
    openModalBtn.addEventListener("click", () => {
      triggerHaptic();
      openCampaignPopup();
    });
  }

  if (closeCampaignModalBtn) {
    closeCampaignModalBtn.addEventListener("click", () => {
      triggerHaptic();
      closeCampaignPopup();
    });
  }

  if (campaignModal) {
    campaignModal.addEventListener("click", (e) => {
      if (e.target === campaignModal) {
        closeCampaignPopup();
      }
    });
  }

  if (modalActionBtn) {
    modalActionBtn.addEventListener("click", () => handleJoinOrClaimAction(true));
  }

  // Initial render
  renderCheckinUI();

  // Auto-show winner popup only if 7-day challenge finished and not yet seen this session
  const hasDeptSelected = Boolean(localStorage.getItem(LS_DEPT_PREF));
  const seenPopupSession = sessionStorage.getItem("sastc_campaign_popup_seen");
  if (hasDeptSelected && state.finished && !seenPopupSession) {
    sessionStorage.setItem("sastc_campaign_popup_seen", "true");
    setTimeout(() => {
      openCampaignPopup();
    }, 800);
  }
}

/**
 * Random Motivation Mission Popup ("YOUR NEXT MISSION")
 * Automatically pops up with a fresh random Bengali motivation every time the user enters the app
 */
function initRandomMotivationCard() {
  const modal = document.getElementById("motivationPopupModal");
  const card = document.getElementById("motivationMissionCard");
  const closeBtn = document.getElementById("closeMotivationPopupBtn");
  const mainEl = document.getElementById("motivationMainText");
  const subEl = document.getElementById("motivationSubText");
  if (!modal || !card || !mainEl || !subEl) return;

  const MOTIVATION_MISSIONS = [
    {
      main: "আজকের তুমি যেন<br>গতকালের চেয়ে<br>ভালো।",
      sub: "পারফেক্ট হতে হবে না, শুধু একটু<br>এগোলেই চলবে।"
    },
    {
      main: "স্বপ্নটা যখন তোমার,<br>লড়াইটাও তোমাকেই<br>করতে হবে।",
      sub: "আজকের একটুখানি পরিশ্রমই আগামীকালের<br>বড় সাফল্যের ভিত্তি।"
    },
    {
      main: "দেরি হোক, তবুও<br>থেমে যেও না<br>কখনো।",
      sub: "ছোট ছোট পদক্ষেপই একদিন তোমাকে<br>গন্তব্যে পৌঁছে দেবে।"
    },
    {
      main: "ক্লান্ত হলে বিশ্রাম নাও,<br>কিন্তু হাল ছেড়ো না<br>একেবারে।",
      sub: "মনে রেখো, প্রতিটি কঠিন রাতের পরেই<br>একটি সুন্দর সকাল আসে।"
    },
    {
      main: "নিজের ওপর বিশ্বাস রাখো,<br>তুমি পারবেই<br>ইনশাআল্লাহ।",
      sub: "অন্যের সাথে তুলনা নয়, নিজের সেরাটা<br>দেওয়ার চেষ্টা করো প্রতিদিন।"
    },
    {
      main: "আজকের একটা অধ্যায়,<br>কালকের দুশ্চিন্তা<br>কমাবে।",
      sub: "সব একসাথে শেষ করতে হবে না,<br>শুধু শুরুটা করো এখন।"
    },
    {
      main: "ভয়কে জয় করার<br>একমাত্র উপায় হলো<br>শুরু করে দেওয়া।",
      sub: "যতটুকু সময় হাতে আছে, তার সর্বোচ্চ<br>ব্যবহার করো আজ।"
    },
    {
      main: "পরিশ্রম কখনো<br>বৃথা যায় না,<br>ধৈর্য ধরো।",
      sub: "আজ যে পৃষ্ঠাগুলো উল্টাচ্ছো, সেগুলোই<br>তোমার ভবিষ্যৎ গড়বে।"
    },
    {
      main: "বড় কিছু পেতে হলে<br>নিয়মিত অভ্যাসে<br>মন দাও।",
      sub: "প্রতিদিন ১% উন্নতিও বছর শেষে<br>তোমাকে অনন্য উচ্চতায় নেবে।"
    },
    {
      main: "ফোকাস ধরে রাখো,<br>অজুহাতকে বিদায়<br>দাও আজ।",
      sub: "তোমার লক্ষ্য তোমার চেয়ে বেশি আর<br>কেউ অনুভব করতে পারবে না।"
    },
    {
      main: "হার মানার আগে<br>আরও একবার চেষ্টা<br>করে দেখো।",
      sub: "হয়তো পরের চেষ্টাটিই তোমার জীবনের<br>সেরা টার্নিং পয়েন্ট।"
    },
    {
      main: "সময় চলে যায়,<br>কিন্তু তোমার শেখাটা<br>থেকে যায়।",
      sub: "আজকের দিনটাকে এমনভাবে কাজে লাগাও যেন<br>রাতে তৃপ্তির ঘুম আসে।"
    },
    {
      main: "কঠিন বিষয়গুলোই<br>তোমাকে সবচেয়ে বেশি<br>শক্তিশালী করে।",
      sub: "ভুল থেকে শেখো, প্রতিটি ভুলই নতুন<br>করে শেখার সুযোগ।"
    },
    {
      main: "বাবা-মায়ের মুখের<br>হাসির জন্য হলেও<br>লেগে থাকো।",
      sub: "তোমার সফলতার গল্পটা লেখার কলম<br>এখন তোমারই হাতে।"
    },
    {
      main: "অতিরিক্ত চিন্তা বাদ দিয়ে<br>কাজে নেমে পড়ো<br>এই মুহূর্তে।",
      sub: "দুশ্চিন্তা কোনো সমাধান দেয় না,<br>প্রস্তুতিই আত্মবিশ্বাস বাড়ায়।"
    },
    {
      main: "সাফল্যের কোনো<br>শর্টকাট নেই,<br>ধারাবাহিকতাই আসল।",
      sub: "প্রতিদিন অল্প করে পড়লেও পরীক্ষার আগে<br>পাহাড়সম চাপ থাকবে না।"
    },
    {
      main: "নিজেকে এমনভাবে গড়ো,<br>যেন ভবিষ্যৎ তোমাকে<br>ধন্যবাদ দেয়।",
      sub: "আজকের ত্যাগই আগামী দিনের<br>স্বাধীনতা ও গর্ব।"
    },
    {
      main: "মনোযোগ যেখানে যাবে,<br>সাফল্য সেখানেই<br>ধরা দেবে।",
      sub: "ফোনের নোটিফিকেশন একটু দূরে রেখে<br>নিজের লক্ষ্যে ডুব দাও।"
    },
    {
      main: "তুমি যতটা ভাবো,<br>তার চেয়েও অনেক বেশি<br>সক্ষম তুমি।",
      sub: "নিজের সীমাবদ্ধতাকে চ্যালেঞ্জ করো,<br>নতুন দিগন্ত খুলে যাবে।"
    },
    {
      main: "গতকাল যা চলে গেছে,<br>তা নিয়ে আফসোস<br>করো না।",
      sub: "আজকের দিনটা সম্পূর্ণ নতুন একটা সুযোগ—<br>নতুন উদ্যমে শুরু করো।"
    },
    {
      main: "নীরবে পরিশ্রম করো,<br>সফলতাই তোমার হয়ে<br>কথা বলবে।",
      sub: "সবাইকে জানানোর দরকার নেই, নিজের<br>কাজে ডুবে থাকো।"
    },
    {
      main: "প্রতিটি ছোট জয়কে<br>উদযাপন করতে<br>শেখো আজ।",
      sub: "একটি টপিক শেষ করাও তোমাকে লক্ষ্যের<br>এক ধাপ কাছে নিয়ে যায়।"
    }
  ];

  const LS_LAST_MOTIVATION_IDX = "sastc_last_motivation_idx";

  function pickNextMotivation() {
    const lastIdx = parseInt(localStorage.getItem(LS_LAST_MOTIVATION_IDX) ?? "-1", 10);
    let nextIdx = Math.floor(Math.random() * MOTIVATION_MISSIONS.length);
    if (MOTIVATION_MISSIONS.length > 1 && nextIdx === lastIdx) {
      nextIdx = (nextIdx + 1 + Math.floor(Math.random() * (MOTIVATION_MISSIONS.length - 1))) % MOTIVATION_MISSIONS.length;
    }
    localStorage.setItem(LS_LAST_MOTIVATION_IDX, String(nextIdx));

    const item = MOTIVATION_MISSIONS[nextIdx];
    mainEl.innerHTML = item.main;
    subEl.innerHTML = item.sub;
  }

  function openMotivationPopup() {
    pickNextMotivation();
    modal.classList.add("active");
  }

  function closeMotivationPopup() {
    modal.classList.remove("active");
  }

  window.openMotivationPopup = openMotivationPopup;

  // Automatically open popup on every app entry (if department is already selected)
  const existingDept = localStorage.getItem(LS_DEPT_PREF);
  if (existingDept && ["CSE", "AG", "BBA"].includes(existingDept)) {
    setTimeout(() => {
      openMotivationPopup();
    }, 250);
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerHaptic();
      closeMotivationPopup();
    });
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      triggerHaptic();
      closeMotivationPopup();
    }
  });
}





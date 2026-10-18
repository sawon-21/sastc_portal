import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NoticeItem, DeptCode, TabType } from './types';
import {
  loadCachedData,
  fetchLiveData,
  indexDataset
} from './utils/notices';
import { Header } from './components/Header';
import { BackgroundAnimation } from './components/BackgroundAnimation';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/views/HomeView';
import { NoticeView } from './components/views/NoticeView';
import { ResultView } from './components/views/ResultView';
import { CalculatorView } from './components/views/CalculatorView';
import { SettingsView } from './components/views/SettingsView';
import { PdfModal } from './components/PdfModal';
import { DepartmentSelectModal } from './components/DepartmentSelectModal';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { Toast } from './components/Toast';

const LS_DEPT_PREF = "sastc_dept_preference";
const LS_DEPT_FIRST_SELECTED = "sastc_dept_first_selected";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [deptPreference, setDeptPreference] = useState<DeptCode>(() => {
    const saved = localStorage.getItem(LS_DEPT_PREF) as DeptCode;
    return (saved && ['CSE', 'AG', 'BBA'].includes(saved)) ? saved : 'CSE';
  });

  // First-visit mandatory department selection modal
  const [showFirstVisitModal, setShowFirstVisitModal] = useState<boolean>(() => {
    return localStorage.getItem(LS_DEPT_FIRST_SELECTED) !== "true";
  });

  const [noticesData, setNoticesData] = useState<NoticeItem[]>([]);
  const [resultsData, setResultsData] = useState<NoticeItem[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalUrl, setModalUrl] = useState('');
  const [modalText, setModalText] = useState<string | undefined>(undefined);

  // Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState<string>('fa-circle-check');

  // PWA Prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState<boolean>(false);

  // Initialize cached data
  useEffect(() => {
    const cached = loadCachedData();
    setNoticesData(cached.noticesData);
    setResultsData(cached.resultsData);

    // Background live fetch (lightweight)
    fetchLiveData().then(live => {
      if (live.noticesData && live.noticesData.length > 0) {
        setNoticesData(live.noticesData);
      }
      if (live.resultsData && live.resultsData.length > 0) {
        setResultsData(live.resultsData);
      }
    });
  }, []);

  // Indexed Master Dataset
  const masterDataset = useMemo(() => {
    return indexDataset(noticesData, resultsData);
  }, [noticesData, resultsData]);

  // Compute notice and result filtered sets for badge calculations
  const filteredNoticesSet = useMemo(() => {
    let filtered = masterDataset.filter(item => !item._isResult);
    if (deptPreference !== "ALL") {
      filtered = filtered.filter(item => item._deptCode === deptPreference);
    }
    return filtered;
  }, [masterDataset, deptPreference]);

  const filteredResultsSet = useMemo(() => {
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
  }, [masterDataset, deptPreference]);

  // Badges state
  const [noticeBadgeCount, setNoticeBadgeCount] = useState<number>(0);
  const [resultBadgeCount, setResultBadgeCount] = useState<number>(0);

  const updateBadges = useCallback(() => {
    const seenNoticesKey = `seen_notices_${deptPreference}`;
    const seenResultsKey = `seen_results_${deptPreference}`;

    const seenNotices = parseInt(localStorage.getItem(seenNoticesKey) || "0", 10);
    const seenResults = parseInt(localStorage.getItem(seenResultsKey) || "0", 10);

    const newNotices = Math.max(0, filteredNoticesSet.length - seenNotices);
    const newResults = Math.max(0, filteredResultsSet.length - seenResults);

    setNoticeBadgeCount(newNotices);
    setResultBadgeCount(newResults);
  }, [deptPreference, filteredNoticesSet.length, filteredResultsSet.length]);

  useEffect(() => {
    updateBadges();
  }, [updateBadges]);

  // Toast helper
  const showToast = useCallback((msg: string, icon = "fa-circle-check") => {
    setToastMsg(msg);
    setToastIcon(icon);
    setTimeout(() => {
      setToastMsg(null);
    }, 2000);
  }, []);

  // Department Preference change
  const handleDeptChange = (newDept: DeptCode) => {
    setDeptPreference(newDept);
    localStorage.setItem(LS_DEPT_PREF, newDept);

    const seenNoticesKey = `seen_notices_${newDept}`;
    const seenResultsKey = `seen_results_${newDept}`;

    if (activeTab === "notice") {
      localStorage.setItem(seenNoticesKey, String(filteredNoticesSet.length));
      setNoticeBadgeCount(0);
    } else if (activeTab === "result") {
      localStorage.setItem(seenResultsKey, String(filteredResultsSet.length));
      setResultBadgeCount(0);
    }

    showToast(`Department set to ${newDept}`, "fa-sliders");
  };

  // First-visit department selection
  const handleFirstVisitDepartmentSelect = (chosenDept: DeptCode) => {
    setDeptPreference(chosenDept);
    localStorage.setItem(LS_DEPT_PREF, chosenDept);
    localStorage.setItem(LS_DEPT_FIRST_SELECTED, "true");
    setShowFirstVisitModal(false);
    showToast(`Welcome! Department set to ${chosenDept}`, "fa-circle-check");
  };

  // Tab switching
  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);

    const seenNoticesKey = `seen_notices_${deptPreference}`;
    const seenResultsKey = `seen_results_${deptPreference}`;

    if (tab === "notice") {
      localStorage.setItem(seenNoticesKey, String(filteredNoticesSet.length));
      setNoticeBadgeCount(0);
    } else if (tab === "result") {
      localStorage.setItem(seenResultsKey, String(filteredResultsSet.length));
      setResultBadgeCount(0);
    }
  };

  // Open Notice in Modal
  const handleOpenNotice = (url: string, title: string, textContent?: string) => {
    setModalTitle(title);
    setModalUrl(url);
    setModalText(textContent);
    setModalOpen(true);
  };

  // Share Link
  const handleShare = async (url: string, title: string) => {
    if (!url || url === "#") {
      showToast("No valid link available to share", "fa-circle-exclamation");
      return;
    }

    const appUrl = window.location.href.split('#')[0];
    const shareText = `📌 ${title}\n\n📄 Document Link: ${url}\n\n🌐 Shared via SASTC Portal:\n${appUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: shareText
        });
        showToast("Link shared successfully!", "fa-circle-check");
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          copyToClipboard(shareText);
        }
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => showToast("Link copied to clipboard!", "fa-circle-check"),
        () => showToast("Failed to copy link", "fa-circle-xmark")
      );
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        showToast("Link copied to clipboard!", "fa-circle-check");
      } catch {
        showToast("Failed to copy link", "fa-circle-xmark");
      }
      document.body.removeChild(textArea);
    }
  };

  // PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!sessionStorage.getItem("pwa_install_dismissed")) {
        setTimeout(() => {
          setShowPwaBanner(true);
        }, 2000);
      }
    };

    const handleAppInstalled = () => {
      setShowPwaBanner(false);
      setDeferredPrompt(null);
      showToast("Application is now available on Home Screen", "fa-circle-check");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [showToast]);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    setShowPwaBanner(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      showToast("SASTC Portal installed successfully!", "fa-circle-check");
    }
    setDeferredPrompt(null);
  };

  const handleDismissPwa = () => {
    setShowPwaBanner(false);
    sessionStorage.setItem("pwa_install_dismissed", "true");
  };

  return (
    <div className="relative min-h-screen">
      {/* Background Animated Floating Icons (Hardware accelerated & optimized) */}
      <BackgroundAnimation />

      {/* Sticky App Header */}
      <Header />

      {/* Main Container */}
      <div className="app-container">
        {activeTab === 'home' && (
          <HomeView
            masterDataset={masterDataset}
            deptPreference={deptPreference}
            onOpenNotice={handleOpenNotice}
            onShare={handleShare}
          />
        )}

        {activeTab === 'notice' && (
          <NoticeView
            masterDataset={masterDataset}
            deptPreference={deptPreference}
            onOpenNotice={handleOpenNotice}
            onShare={handleShare}
          />
        )}

        {activeTab === 'result' && (
          <ResultView
            masterDataset={masterDataset}
            deptPreference={deptPreference}
            onOpenNotice={handleOpenNotice}
            onShare={handleShare}
          />
        )}

        {activeTab === 'calculator' && (
          <CalculatorView
            deptPreference={deptPreference}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            deptPreference={deptPreference}
            onDeptChange={handleDeptChange}
            onShowToast={showToast}
          />
        )}
      </div>

      {/* Floating Bottom Navigation with Notice & Result unread badges */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        noticeBadgeCount={noticeBadgeCount}
        resultBadgeCount={resultBadgeCount}
        isModalOpen={modalOpen || showFirstVisitModal}
      />

      {/* First-Visit Mandatory Department Selection Popup */}
      <DepartmentSelectModal
        isOpen={showFirstVisitModal}
        onSelectDepartment={handleFirstVisitDepartmentSelect}
      />

      {/* PDF / Document Modal */}
      <PdfModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        url={modalUrl}
        textContent={modalText}
      />

      {/* PWA Install Banner */}
      <PwaInstallBanner
        show={showPwaBanner}
        onInstall={handleInstallPwa}
        onDismiss={handleDismissPwa}
      />

      {/* Toast Notification */}
      <Toast message={toastMsg} icon={toastIcon} />
    </div>
  );
};
export default App;

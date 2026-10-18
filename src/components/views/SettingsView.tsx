import React, { useState, useEffect } from 'react';
import { DeptCode } from '../../types';

interface SettingsViewProps {
  deptPreference: DeptCode;
  onDeptChange: (newDept: DeptCode) => void;
  onShowToast: (msg: string, icon?: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  deptPreference,
  onDeptChange,
  onShowToast
}) => {
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState<string>('');

  useEffect(() => {
    try {
      const keys = JSON.parse(localStorage.getItem("geminiApiKeys") || "[]");
      setApiKeys(keys);
    } catch {
      setApiKeys([]);
    }
  }, []);

  const handleAddApiKey = () => {
    const trimmed = newKey.trim();
    if (!trimmed) {
      onShowToast("Please enter an API key", "fa-circle-exclamation");
      return;
    }
    if (apiKeys.includes(trimmed)) {
      onShowToast("Key already exists", "fa-circle-exclamation");
      return;
    }

    const updated = [...apiKeys, trimmed];
    setApiKeys(updated);
    localStorage.setItem("geminiApiKeys", JSON.stringify(updated));
    setNewKey('');
    onShowToast("API key added successfully", "fa-circle-check");
  };

  const handleDeleteApiKey = (idx: number) => {
    const updated = apiKeys.filter((_, i) => i !== idx);
    setApiKeys(updated);
    localStorage.setItem("geminiApiKeys", JSON.stringify(updated));
    onShowToast("API key removed", "fa-trash-can");
  };

  return (
    <section id="view-settings" className="tab-view active">
      <div className="settings-header-main">
        <h2>Settings</h2>
        <p>Manage your application preferences</p>
      </div>

      {/* Department Preferences */}
      <div className="settings-card card-animate visible">
        <div className="settings-header">
          <i className="fa-solid fa-sliders"></i>
          <h3>Department Preferences</h3>
        </div>

        <div className="setting-item flex-col-start">
          <div className="setting-info w-full">
            <label htmlFor="deptPreferenceSelect">
              <strong>Selected Department</strong>
            </label>
            <p>Show notices strictly for your department</p>
          </div>
          <select
            id="deptPreferenceSelect"
            className="setting-select w-full mt-2"
            value={deptPreference}
            onChange={(e) => onDeptChange(e.target.value as DeptCode)}
          >
            <option value="CSE">Computer Science (CSE)</option>
            <option value="AG">B.Sc in Agriculture</option>
            <option value="BBA">Business Admin (BBA)</option>
          </select>
        </div>
      </div>

      {/* Developer Details */}
      <div className="settings-card card-animate visible dev-card">
        <div className="dev-profile">
          <div className="dev-avatar">
            <i className="fa-solid fa-code"></i>
          </div>
          <div className="dev-info">
            <h4>Mehedi Al Hasan Sawon</h4>
            <p className="dev-org">Developed & Maintained </p>
            <p className="dev-meta">Version 2.1.0 • Last Update: 25 Aug 2026</p>
            <div className="dev-socials mt-2">
              <a
                href="https://www.facebook.com/mehedialhasansawon"
                target="_blank"
                rel="noopener noreferrer"
                className="social-link fb"
              >
                <i className="fa-brands fa-facebook"></i> Facebook
              </a>
            </div>
            <br />
            <hr />
            <p className="dev-org">Feedback me </p>
            <a
              href="https://t.me/t9xql"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link gh"
            >
              <i className="fa-brands fa-telegram"></i> Telegram
            </a>
          </div>
        </div>
      </div>

      {/* API Keys Management */}
      <div className="settings-card card-animate visible shadow-sm rounded-xl mb-4 p-4 bg-white border border-[#85bdf0]">
        <div className="settings-header mb-2 flex items-center gap-2 text-primary">
          <i className="fa-solid fa-key text-lg"></i>
          <h3 className="font-bold text-lg m-0">Gemini API Keys</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Add multiple API keys to avoid rate limits. The AI Advisor will automatically rotate them.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="password"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="setting-select flex-1 p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Enter Gemini API Key"
          />
          <button
            type="button"
            onClick={handleAddApiKey}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Add
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
          {apiKeys.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No API keys added yet.</p>
          ) : (
            apiKeys.map((k, idx) => {
              const masked = k.length > 12 ? `${k.substring(0, 8)}...${k.substring(k.length - 4)}` : '••••••••••••';
              return (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-[#85bdf0]"
                >
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-key text-gray-400"></i>
                    <span className="font-mono text-sm text-gray-700">{masked}</span>
                  </div>
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-600 p-1 transition-colors"
                    title="Delete Key"
                    onClick={() => handleDeleteApiKey(idx)}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

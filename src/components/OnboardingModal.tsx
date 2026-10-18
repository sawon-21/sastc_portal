import React, { useState } from 'react';
import { DeptCode } from '../types';

interface OnboardingModalProps {
  isOpen: boolean;
  onConfirm: (dept: DeptCode) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onConfirm }) => {
  const [selectedDept, setSelectedDept] = useState<DeptCode>('CSE');

  if (!isOpen) return null;

  const departments: Array<{
    code: DeptCode;
    title: string;
    sub: string;
    icon: string;
    badgeColor: string;
  }> = [
    {
      code: 'CSE',
      title: 'Computer Science (CSE)',
      sub: 'Computer Science and Engineering',
      icon: 'fa-solid fa-code',
      badgeColor: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    {
      code: 'AG',
      title: 'B.Sc in Agriculture (AG)',
      sub: 'Faculty of Agriculture',
      icon: 'fa-solid fa-wheat-awn',
      badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    {
      code: 'BBA',
      title: 'Business Admin (BBA)',
      sub: 'Business Administration & Management',
      icon: 'fa-solid fa-chart-line',
      badgeColor: 'text-amber-600 bg-amber-50 border-amber-200'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-slate-100 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
            <i className="fa-solid fa-building-columns text-lg"></i>
          </div>
          <h2 id="onboarding-title" className="text-xl font-bold text-slate-900 m-0">
            Select Your Department
          </h2>
          <p className="text-xs text-slate-500 mt-1 m-0">
            নোটিশ, রেজাল্ট ও সিলেবাস পেতে আপনার ডিপার্টমেন্ট নির্বাচন করুন
          </p>
        </div>

        {/* Department Options */}
        <div className="p-4 space-y-2.5">
          {departments.map((dept) => {
            const isSelected = selectedDept === dept.code;
            return (
              <button
                key={dept.code}
                type="button"
                onClick={() => setSelectedDept(dept.code)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex items-center gap-3.5 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-base border shrink-0 ${dept.badgeColor}`}
                >
                  <i className={dept.icon}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {dept.title}
                    </span>
                    {isSelected && (
                      <i className="fa-solid fa-circle-check text-indigo-600 text-sm shrink-0 ml-2"></i>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate m-0">
                    {dept.sub}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Button & Developer Attribution */}
        <div className="p-4 pt-2 bg-slate-50/50 border-t border-slate-100 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => onConfirm(selectedDept)}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-semibold text-sm rounded-xl shadow-md transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Confirm & Continue</span>
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </button>

          <p className="text-[11px] text-slate-600 font-medium tracking-tight m-0 text-center">
            Developed &amp; Maintained by <span className="text-slate-800 font-semibold">Mehedi Al Hasan Sawon</span>
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { DeptCode } from '../types';

interface DepartmentSelectModalProps {
  isOpen: boolean;
  onSelectDepartment: (dept: DeptCode) => void;
}

export const DepartmentSelectModal: React.FC<DepartmentSelectModalProps> = ({
  isOpen,
  onSelectDepartment
}) => {
  const [selected, setSelected] = useState<DeptCode>('CSE');

  if (!isOpen) return null;

  const departments: Array<{
    code: DeptCode;
    title: string;
    subtitle: string;
    icon: string;
    color: string;
  }> = [
    {
      code: 'CSE',
      title: 'Computer Science (CSE)',
      subtitle: 'Computer Science & Engineering',
      icon: 'fa-solid fa-code',
      color: '#3b82f6'
    },
    {
      code: 'AG',
      title: 'Agriculture (AG)',
      subtitle: 'Faculty of Agriculture',
      icon: 'fa-solid fa-wheat-awn',
      color: '#22c55e'
    },
    {
      code: 'BBA',
      title: 'Business Admin (BBA)',
      subtitle: 'Faculty of Business Studies',
      icon: 'fa-solid fa-chart-line',
      color: '#f59e0b'
    }
  ];

  const handleConfirm = () => {
    onSelectDepartment(selected);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 text-white p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center text-xl text-blue-400 border border-white/20">
            <i className="fa-solid fa-building-columns"></i>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">
            SASTC Portal
          </h2>
          <p className="text-sm text-zinc-300">
            অনুগ্রহ করে আপনার ডিপার্টমেন্ট নির্বাচন করুন
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            (Select your department to personalize notices)
          </p>
        </div>

        {/* Department Options */}
        <div className="p-5 flex flex-col gap-3 bg-zinc-50/50">
          {departments.map((dept) => {
            const isChosen = selected === dept.code;
            return (
              <div
                key={dept.code}
                onClick={() => setSelected(dept.code)}
                className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  isChosen
                    ? 'border-indigo-600 bg-indigo-50/60 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-base"
                    style={{
                      backgroundColor: `${dept.color}15`,
                      color: dept.color
                    }}
                  >
                    <i className={dept.icon}></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm m-0">
                      {dept.title}
                    </h4>
                    <p className="text-xs text-gray-500 m-0 mt-0.5">
                      {dept.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isChosen
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isChosen && (
                      <i className="fa-solid fa-check text-white text-[10px]"></i>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleConfirm}
            className="w-full mt-2 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
          >
            <span>Confirm & Continue</span>
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </button>
        </div>

        {/* Footer with Developer Name */}
        <div className="py-2.5 px-4 bg-white border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-500 m-0">
            Developed with <span className="text-red-500">❤️</span> by <strong className="text-gray-700 font-medium">Mehedi Al Hasan Sawon</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

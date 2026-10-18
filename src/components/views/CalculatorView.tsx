import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { Course, SemesterRecord, AdvisorHistoryItem, DeptCode } from '../../types';
import { syllabusData } from '../../data/syllabus';

interface CalculatorViewProps {
  deptPreference: DeptCode;
  onShowToast: (msg: string, icon?: string) => void;
  onBookmarkSyllabus?: (dept: string, level: string, semester: string, courses: Course[]) => void;
  isSyllabusBookmarked?: (id: string) => boolean;
}

const GRADE_POINTS: Record<string, number> = {
  "A+": 4.00, "A": 3.75, "A-": 3.50,
  "B+": 3.25, "B": 3.00, "B-": 2.75,
  "C+": 2.50, "C": 2.25,
  "D": 2.00, "F": 0.00
};

export const CalculatorView: React.FC<CalculatorViewProps> = ({
  deptPreference,
  onShowToast,
  onBookmarkSyllabus,
  isSyllabusBookmarked
}) => {
  const [level, setLevel] = useState<string>("1");
  const [semester, setSemester] = useState<string>("I");
  const [isCoursesExpanded, setIsCoursesExpanded] = useState<boolean>(true);
  const [currentCourses, setCurrentCourses] = useState<Course[]>([]);
  const [semesterHistory, setSemesterHistory] = useState<SemesterRecord[]>([]);
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState<number | null>(null);

  // Clear confirmation state
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);

  // AI Advisor state
  const [isAdvisorLoading, setIsAdvisorLoading] = useState<boolean>(false);
  const [advisorFeedback, setAdvisorFeedback] = useState<string | null>(null);
  const [advisorHistory, setAdvisorHistory] = useState<AdvisorHistoryItem[]>([]);
  const [expandedAdvisorIdx, setExpandedAdvisorIdx] = useState<number | null>(null);

  // Save term button feedback
  const [isSavedRecently, setIsSavedRecently] = useState<boolean>(false);

  const activeDept = deptPreference === "ALL" ? "CSE" : deptPreference;

  // Load history from localStorage
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem('sastcGpaHistory') || '[]');
      setSemesterHistory(history);
    } catch {
      setSemesterHistory([]);
    }

    try {
      const advHistory = JSON.parse(localStorage.getItem('sastc_advisor_history') || '[]');
      setAdvisorHistory(advHistory);
    } catch {
      setAdvisorHistory([]);
    }
  }, []);

  // Save history to localStorage on changes
  const saveSemesterHistory = (newHistory: SemesterRecord[]) => {
    setSemesterHistory(newHistory);
    localStorage.setItem('sastcGpaHistory', JSON.stringify(newHistory));
  };

  const saveAdvisorHistory = (newHistory: AdvisorHistoryItem[]) => {
    setAdvisorHistory(newHistory);
    localStorage.setItem('sastc_advisor_history', JSON.stringify(newHistory));
  };

  // Load courses when dept, level, or semester changes
  useEffect(() => {
    const courses = syllabusData[activeDept]?.[level]?.[semester] || [];
    const populated = courses.map(c => ({
      ...c,
      grade: c.grade || "A"
    }));
    setCurrentCourses(populated);
  }, [activeDept, level, semester]);

  // Calculate Term GPA
  const calculateTermGpa = (courses: Course[]): { gpa: number; credits: number } => {
    let termCredits = 0;
    let termPoints = 0;

    courses.forEach(c => {
      const cred = Number(c.credits) || 0;
      const gp = GRADE_POINTS[c.grade || "A"];
      if (gp !== undefined) {
        termCredits += cred;
        termPoints += (cred * gp);
      }
    });

    const gpa = termCredits > 0 ? Number((termPoints / termCredits).toFixed(2)) : 0;
    return { gpa, credits: termCredits };
  };

  const currentTermStats = calculateTermGpa(currentCourses);

  // Calculate Cumulative CGPA
  let totalCumulativeCredits = 0;
  let totalCumulativePoints = 0;
  semesterHistory.forEach(s => {
    totalCumulativeCredits += s.totalCredits;
    totalCumulativePoints += (s.totalCredits * s.gpa);
  });
  const cumulativeCgpa = totalCumulativeCredits > 0
    ? (totalCumulativePoints / totalCumulativeCredits).toFixed(2)
    : "0.00";

  // Handle grade change for current courses
  const handleGradeChange = (index: number, newGrade: string) => {
    const updated = [...currentCourses];
    updated[index].grade = newGrade;
    setCurrentCourses(updated);
  };

  // Save current semester to history
  const handleSaveSemester = () => {
    if (currentCourses.length === 0 || currentTermStats.credits === 0) return;

    const record: SemesterRecord = {
      dept: activeDept,
      level: level,
      semester: semester,
      gpa: currentTermStats.gpa,
      totalCredits: currentTermStats.credits,
      courses: currentCourses.map(c => ({
        code: c.code,
        credits: c.credits,
        grade: c.grade || "A"
      }))
    };

    const existingIdx = semesterHistory.findIndex(
      s => s.dept === record.dept && s.level === record.level && s.semester === record.semester
    );

    let updatedHistory: SemesterRecord[];
    if (existingIdx >= 0) {
      updatedHistory = [...semesterHistory];
      updatedHistory[existingIdx] = record;
    } else {
      updatedHistory = [...semesterHistory, record];
    }

    saveSemesterHistory(updatedHistory);
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2000);
    onShowToast("Semester saved to history!", "fa-circle-check");
  };

  // Clear history handler with 2-step confirmation
  const handleClearHistory = () => {
    if (isConfirmingClear) {
      saveSemesterHistory([]);
      setAdvisorFeedback(null);
      setIsConfirmingClear(false);
      onShowToast("GPA history cleared", "fa-trash-can");
    } else {
      setIsConfirmingClear(true);
      setTimeout(() => {
        setIsConfirmingClear(false);
      }, 3000);
    }
  };

  // Delete single semester
  const handleDeleteSemester = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = semesterHistory.filter((_, i) => i !== idx);
    if (expandedHistoryIdx === idx) {
      setExpandedHistoryIdx(null);
    } else if (expandedHistoryIdx !== null && expandedHistoryIdx > idx) {
      setExpandedHistoryIdx(expandedHistoryIdx - 1);
    }
    saveSemesterHistory(updated);
    onShowToast("Semester removed", "fa-trash-can");
  };

  // Edit semester course credits/grade
  const handleHistoryCourseChange = (
    semIdx: number,
    courseIdx: number,
    field: 'credits' | 'grade',
    value: string | number
  ) => {
    const updated = [...semesterHistory];
    const sem = { ...updated[semIdx], courses: [...updated[semIdx].courses] };
    const course = { ...sem.courses[courseIdx] };

    if (field === 'credits') {
      course.credits = parseFloat(value as string) || 0;
    } else {
      course.grade = value as string;
    }
    sem.courses[courseIdx] = course;

    // Recalculate semester GPA
    let totCr = 0;
    let totPts = 0;
    sem.courses.forEach(c => {
      const gp = GRADE_POINTS[c.grade] ?? 0;
      totCr += c.credits;
      totPts += (c.credits * gp);
    });
    sem.totalCredits = totCr;
    sem.gpa = totCr > 0 ? Number((totPts / totCr).toFixed(2)) : 0;

    updated[semIdx] = sem;
    saveSemesterHistory(updated);
  };

  // AI Advisor Insights
  const handleGetAiInsights = async () => {
    setIsAdvisorLoading(true);
    setAdvisorFeedback(null);

    let apiKeys: string[] = [];
    try {
      apiKeys = JSON.parse(localStorage.getItem("geminiApiKeys") || "[]");
    } catch {
      apiKeys = [];
    }

    const payload = {
      cgpa: cumulativeCgpa,
      termGpa: currentTermStats.gpa,
      currentSemCourses: currentCourses,
      level: level,
      semester: semester,
      history: semesterHistory
    };

    // If no client keys, call once with empty key header so server uses process.env.GEMINI_API_KEY
    const keysToTry = apiKeys.length > 0 ? [...apiKeys].sort(() => 0.5 - Math.random()) : [''];
    let success = false;
    let lastErrorMsg = "Error connecting to AI Advisor.";

    for (const key of keysToTry) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (key) {
          headers["x-gemini-api-key"] = key;
        }

        const res = await fetch("/api/advisor", {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });

        if (res.status === 429) {
          lastErrorMsg = "Rate limited. Trying next key...";
          continue;
        }

        const data = await res.json();
        if (data.error) {
          if ((res.status === 400 && data.error.includes("Invalid")) || res.status === 403) {
            lastErrorMsg = data.error;
            continue;
          }
          setAdvisorFeedback(`<span class="text-red-500 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> ${data.error}</span>`);
          success = true;
          break;
        } else if (data.text) {
          const parsedHtml = marked.parse(data.text) as string;
          setAdvisorFeedback(parsedHtml);

          // Save to advisor history
          const newAdvisorHistory: AdvisorHistoryItem[] = [
            ...advisorHistory,
            {
              date: new Date().toISOString(),
              level: level,
              semester: semester,
              text: data.text,
              html: parsedHtml
            }
          ];
          saveAdvisorHistory(newAdvisorHistory);

          success = true;
          break;
        }
      } catch (err: any) {
        console.error("AI Advisor request error:", err);
        lastErrorMsg = "Network error. Please try again.";
      }
    }

    if (!success) {
      setAdvisorFeedback(`<span class="text-red-500 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> ${lastErrorMsg}</span>`);
    }

    setIsAdvisorLoading(false);
  };

  // Delete single advisor insight
  const handleDeleteAdvisorInsight = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = advisorHistory.filter((_, i) => i !== idx);
    if (expandedAdvisorIdx === idx) {
      setExpandedAdvisorIdx(null);
    } else if (expandedAdvisorIdx !== null && expandedAdvisorIdx > idx) {
      setExpandedAdvisorIdx(expandedAdvisorIdx - 1);
    }
    saveAdvisorHistory(updated);
    onShowToast("Insight removed", "fa-trash-can");
  };

  return (
    <section id="view-calculator" className="tab-view active">
      <div className="settings-header-main" style={{ marginBottom: '16px' }}>
        <h2>CGPA Calculator</h2> <h1 style={{ color: 'green', display: 'inline', fontSize: '18px', fontWeight: 'bold' }}>Active</h1>
        <p>HSTU AI-Powered Academic Advisor</p>
      </div>

      {/* Settings: Level & Semester */}
      <div className="settings-card card-animate visible shadow-sm rounded-xl mb-4 p-4 bg-white border border-[#85bdf0]">
        <div className="settings-header mb-4 flex items-center gap-2 text-primary">
          <i className="fa-solid fa-sliders text-lg"></i>
          <h3 className="font-bold text-lg m-0">Academic Target</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="flex-1 flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="setting-select w-full p-2.5 rounded-lg border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-[#85bdf0] transition-all outline-none"
            >
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
              <option value="4">Level 4</option>
            </select>
          </div>
          <div className="flex-1 flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="setting-select w-full p-2.5 rounded-lg border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-[#85bdf0] transition-all outline-none"
            >
              <option value="I">Semester I</option>
              <option value="II">Semester II</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cumulative History Summary */}
      <div className="settings-card card-animate visible shadow-sm rounded-xl mb-4 p-4 bg-white border border-[#85bdf0] flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 text-primary">
            <i className="fa-solid fa-clock-rotate-left text-lg"></i>
            <h3 className="font-bold text-lg m-0">GPA History</h3>
          </div>
          <button
            type="button"
            onClick={handleClearHistory}
            className={`font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-sm border ${
              isConfirmingClear
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 border-red-100'
            }`}
          >
            <i className={`fa-solid ${isConfirmingClear ? 'fa-triangle-exclamation' : 'fa-trash-can'}`}></i>
            <span>{isConfirmingClear ? 'Sure?' : 'Clear'}</span>
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-3 mt-2 w-full max-h-[50vh] md:max-h-[70vh] overflow-y-auto pr-1">
          {semesterHistory.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No saved semesters yet.</p>
          ) : (
            semesterHistory.map((sem, sIdx) => {
              const isExpanded = expandedHistoryIdx === sIdx;
              return (
                <div
                  key={sIdx}
                  className="flex flex-col bg-white rounded-lg border border-gray-200 text-sm overflow-hidden shadow-sm transition-all mb-2"
                >
                  <div
                    className="flex justify-between items-center p-3 hover:bg-indigo-50/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedHistoryIdx(isExpanded ? null : sIdx)}
                  >
                    <div>
                      <span className="font-bold text-gray-800">
                        {sem.dept} L{sem.level} S{sem.semester}
                      </span>
                      <span className="text-gray-500 ml-2 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                        Cr: {sem.totalCredits}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-indigo-600 text-[15px]">
                        {sem.gpa.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
                        title="Edit Courses"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedHistoryIdx(isExpanded ? null : sIdx);
                        }}
                      >
                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-up text-indigo-600' : 'fa-pencil'}`}></i>
                      </button>
                      <button
                        type="button"
                        className="text-red-300 hover:text-red-500 transition-colors p-1"
                        title="Delete Semester"
                        onClick={(e) => handleDeleteSemester(sIdx, e)}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 border-t border-indigo-100 bg-white">
                      <div className="flex items-center gap-2 mb-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                        <i className="fa-solid fa-layer-group"></i> Update Courses
                      </div>
                      {sem.courses && sem.courses.length > 0 ? (
                        sem.courses.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100 gap-2 mb-1.5"
                          >
                            <div className="font-medium text-gray-700 flex-1 truncate" title={c.code}>
                              {c.code}
                            </div>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="6"
                              className="w-16 p-1 border border-indigo-200 rounded text-sm text-center outline-none focus:ring-1 focus:ring-indigo-500"
                              value={c.credits}
                              onChange={(e) => handleHistoryCourseChange(sIdx, cIdx, 'credits', e.target.value)}
                            />
                            <select
                              className="w-[70px] p-1 border border-indigo-200 rounded text-sm bg-white font-bold text-indigo-600 outline-none focus:ring-1 focus:ring-indigo-500"
                              value={c.grade}
                              onChange={(e) => handleHistoryCourseChange(sIdx, cIdx, 'grade', e.target.value)}
                            >
                              {Object.keys(GRADE_POINTS).map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500 italic p-2 text-center">
                          No detailed course data available.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-[#85bdf0] pt-3 flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cumulative</span>
            <span className="text-sm text-gray-700">Total Credits: <strong>{totalCumulativeCredits.toFixed(2)}</strong></span>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">CGPA</span>
            <span className="text-2xl font-black text-indigo-600 leading-none">{cumulativeCgpa}</span>
          </div>
        </div>
      </div>

      {/* Current Semester Courses */}
      <div className="settings-card card-animate visible shadow-sm rounded-xl mb-4 p-4 bg-white border border-[#85bdf0]">
        <div className="settings-header mb-4 flex justify-between items-center text-primary">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-book-open text-lg"></i>
            <h3 className="font-bold text-lg m-0">
              Courses <span className="text-sm font-normal text-gray-500 ml-1">({activeDept} L{level} S{semester})</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {onBookmarkSyllabus && (
              <button
                type="button"
                onClick={() => onBookmarkSyllabus(activeDept, level, semester, currentCourses)}
                className={`p-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  isSyllabusBookmarked && isSyllabusBookmarked(`syllabus_${activeDept}_${level}_${semester}`)
                    ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                    : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
                }`}
                title="Save Syllabus to Favorites"
              >
                <i className={`fa-${isSyllabusBookmarked && isSyllabusBookmarked(`syllabus_${activeDept}_${level}_${semester}`) ? 'solid' : 'regular'} fa-bookmark`}></i>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCoursesExpanded(!isCoursesExpanded)}
              className="text-gray-400 hover:text-indigo-600 transition-colors p-2 rounded-lg bg-gray-50 hover:bg-indigo-50 cursor-pointer"
            >
              <i className={`fa-solid ${isCoursesExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
            </button>
          </div>
        </div>

        {isCoursesExpanded && (
          <div>
            <div className="flex flex-col gap-3">
              {currentCourses.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No courses found for this selection.</p>
              ) : (
                currentCourses.map((c, idx) => (
                  <div
                    key={c.code || idx}
                    className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-indigo-600">{c.code}</div>
                      <div className="text-sm text-gray-700 truncate" title={c.name}>{c.name}</div>
                    </div>
                    <div className="text-sm font-medium text-gray-500 w-12 text-center bg-white border border-gray-200 rounded p-1">
                      {c.credits} Cr
                    </div>
                    <select
                      className="setting-select w-20 p-1.5 rounded border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700"
                      value={c.grade || "A"}
                      onChange={(e) => handleGradeChange(idx, e.target.value)}
                    >
                      {Object.keys(GRADE_POINTS).map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 border-t border-[#85bdf0] pt-4">
              <div className="flex justify-between items-center mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <span className="font-semibold text-gray-700">Term GPA</span>
                <span className="text-2xl font-black text-indigo-600">{currentTermStats.gpa.toFixed(2)}</span>
              </div>

              <button
                type="button"
                onClick={handleSaveSemester}
                className={`w-full text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 ${
                  isSavedRecently ? 'bg-green-600' : 'bg-primary hover:bg-gray-800'
                }`}
              >
                <i className={`fa-solid ${isSavedRecently ? 'fa-check' : 'fa-floppy-disk'}`}></i>
                <span>{isSavedRecently ? 'Saved!' : 'Calculate & Save Semester'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Advisor Section */}
      <div className="settings-card card-animate visible shadow-lg rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-5 border-0">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <h3 className="font-bold text-lg m-0 text-white">AI Academic Advisor</h3>
              <p className="text-indigo-100 text-sm m-0">Personalized insights based on your grades</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isAdvisorLoading}
            onClick={handleGetAiInsights}
            className="w-full bg-white text-indigo-700 hover:bg-indigo-50 font-bold py-3 px-4 rounded-xl shadow transition-colors flex justify-center items-center gap-2 disabled:opacity-75"
          >
            {isAdvisorLoading ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin"></i>
                <span>Analyzing your performance...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-brain"></i>
                <span>Get AI Insights</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI Advisor Feedback Card */}
      {advisorFeedback && (
        <div className="settings-card card-animate visible mt-4 shadow-md rounded-xl bg-white border-l-4 border-[#85bdf0] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-indigo-700">
              <i className="fa-solid fa-robot text-lg"></i>
              <h3 className="font-bold text-lg m-0">Advisor Feedback</h3>
            </div>
          </div>
          <div
            className="text-[15px] leading-relaxed text-gray-700 prose prose-sm prose-indigo"
            dangerouslySetInnerHTML={{ __html: advisorFeedback }}
          />
        </div>
      )}

      {/* Advisor History Section */}
      {advisorHistory.length > 0 && (
        <div className="settings-card card-animate visible mt-4 shadow-md rounded-xl bg-gray-50 border border-[#85bdf0] p-5">
          <h3 className="font-bold text-gray-700 mb-3">
            <i className="fa-solid fa-clock-rotate-left"></i> Past Insights
          </h3>
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {advisorHistory.slice().reverse().map((item, rIdx) => {
              const origIdx = advisorHistory.length - 1 - rIdx;
              const isExpanded = expandedAdvisorIdx === origIdx;
              const dateStr = new Date(item.date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={origIdx}
                  className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden transition-all shrink-0"
                >
                  <div
                    className="flex justify-between items-center p-3 cursor-pointer hover:bg-indigo-50/50 transition-colors"
                    onClick={() => setExpandedAdvisorIdx(isExpanded ? null : origIdx)}
                  >
                    <div>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                        L{item.level} S{item.semester}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-red-300 hover:text-red-500 transition-colors p-1"
                        title="Delete Insight"
                        onClick={(e) => handleDeleteAdvisorInsight(origIdx, e)}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
                        title="Toggle Details"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedAdvisorIdx(isExpanded ? null : origIdx);
                        }}
                      >
                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-up text-indigo-600' : 'fa-chevron-down'}`}></i>
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div
                      className="p-3 border-t border-gray-100 text-sm text-gray-700 prose prose-sm max-w-none bg-gray-50"
                      dangerouslySetInnerHTML={{
                        __html: item.html || (marked.parse(item.text) as string)
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

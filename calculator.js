import { syllabusData } from './syllabus.js';
import { showToast } from './utils.js';

export function initCalculator() {
  const calcLevel = document.getElementById("calcLevel");
  const calcSemester = document.getElementById("calcSemester");
  const courseList = document.getElementById("courseList");
  
  const currentSemLabel = document.getElementById("currentSemLabel");
  const termGpaDisplay = document.getElementById("termGpaDisplay");
  const saveTermBtn = document.getElementById("saveTermBtn");
  
  const historyList = document.getElementById("historyList");
  const emptyHistoryMsg = document.getElementById("emptyHistoryMsg");
  const cumCreditsDisplay = document.getElementById("cumCredits");
  const cumCgpaDisplay = document.getElementById("cumCgpa");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  const getAdviceBtn = document.getElementById("getAdviceBtn");
  const aiAdvisorCard = document.getElementById("aiAdvisorCard");
  const aiAdvisorText = document.getElementById("aiAdvisorText");

  const gradePoints = {
    "A+": 4.00, "A": 3.75, "A-": 3.50,
    "B+": 3.25, "B": 3.00, "B-": 2.75,
    "C+": 2.50, "C": 2.25,
    "D": 2.00, "F": 0.00
  };

  let currentCourses = [];
  let semesterHistory = JSON.parse(localStorage.getItem('sastcGpaHistory')) || [];

  function getActiveDepartment() {
    let savedDept = localStorage.getItem('sastc_dept_preference') || 'CSE';
    if (savedDept === 'ALL') {
      savedDept = 'CSE'; // Default fallback if set to all
    }
    return ['CSE', 'AG', 'BBA'].includes(savedDept) ? savedDept : 'CSE';
  }

  let expandedHistoryIdx = null;

  function renderHistory() {
    if (semesterHistory.length === 0) {
      emptyHistoryMsg.style.display = 'block';
      historyList.innerHTML = '';
      historyList.appendChild(emptyHistoryMsg);
      cumCreditsDisplay.textContent = '0.00';
      cumCgpaDisplay.textContent = '0.00';
      return;
    }

    emptyHistoryMsg.style.display = 'none';
    historyList.innerHTML = '';
    
    let totalCredits = 0;
    let totalPoints = 0;

    semesterHistory.forEach((sem, index) => {
      totalCredits += sem.totalCredits;
      totalPoints += (sem.totalCredits * sem.gpa);

      let coursesHtml = '';
      if (sem.courses && sem.courses.length > 0) {
        coursesHtml = sem.courses.map((c, cIdx) => `
          <div class="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100 gap-2 mb-1.5">
            <div class="font-medium text-gray-700 flex-1 truncate" title="${c.code}">${c.code}</div>
            <input type="number" step="0.5" min="0" max="6" class="w-16 p-1 border border-indigo-200 rounded text-sm text-center outline-none focus:ring-1 focus:ring-indigo-500 course-cr-input" data-cidx="${cIdx}" value="${c.credits}">
            <select class="w-[70px] p-1 border border-indigo-200 rounded text-sm bg-white font-bold text-indigo-600 outline-none focus:ring-1 focus:ring-indigo-500 course-grade-select" data-cidx="${cIdx}">
              ${Object.keys(gradePoints).map(g => `<option value="${g}" ${g === c.grade ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
        `).join('');
      } else {
        coursesHtml = `<div class="text-xs text-gray-500 italic p-2 text-center">No detailed course data available.</div>`;
      }

      const div = document.createElement('div');
      div.className = 'flex flex-col bg-white rounded-lg border border-gray-200 text-sm overflow-hidden shadow-sm transition-all mb-3';
      const isExpanded = expandedHistoryIdx === index;
      
      div.innerHTML = `
        <div class="flex justify-between items-center p-3 hover:bg-indigo-50/30 transition-colors cursor-pointer history-header" data-idx="${index}">
          <div>
            <span class="font-bold text-gray-800">${sem.dept} L${sem.level} S${sem.semester}</span>
            <span class="text-gray-500 ml-2 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">Cr: ${sem.totalCredits}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-black text-indigo-600 text-[15px] gpa-display">${sem.gpa.toFixed(2)}</span>
            <button class="text-gray-400 hover:text-indigo-600 transition-colors edit-sem-btn p-1" data-idx="${index}" title="Edit Courses">
              <i class="fa-solid ${isExpanded ? 'fa-chevron-up text-indigo-600' : 'fa-pencil'}"></i>
            </button>
            <button class="text-red-300 hover:text-red-500 transition-colors delete-sem-btn p-1" data-idx="${index}" title="Delete Semester">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="course-edit-panel ${isExpanded ? 'block' : 'hidden'} p-3 border-t border-indigo-100 bg-white">
          <div class="flex items-center gap-2 mb-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
            <i class="fa-solid fa-layer-group"></i> Update Courses
          </div>
          ${coursesHtml}
        </div>
      `;
      
      const editBtn = div.querySelector('.edit-sem-btn');
      const headerClick = div.querySelector('.history-header');
      
      const toggleExpand = (e) => {
        if (e.target.closest('.delete-sem-btn')) return;
        expandedHistoryIdx = isExpanded ? null : index;
        renderHistory();
      };
      
      headerClick.addEventListener('click', toggleExpand);
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExpand(e);
      });

      if (sem.courses && sem.courses.length > 0) {
        div.querySelectorAll('.course-cr-input').forEach(input => {
          input.addEventListener('change', (e) => {
            const cIdx = parseInt(e.target.getAttribute('data-cidx'));
            const newCr = parseFloat(e.target.value) || 0;
            sem.courses[cIdx].credits = newCr;
            recalculateSemester(index);
          });
        });
        div.querySelectorAll('.course-grade-select').forEach(select => {
          select.addEventListener('change', (e) => {
            const cIdx = parseInt(e.target.getAttribute('data-cidx'));
            sem.courses[cIdx].grade = e.target.value;
            recalculateSemester(index);
          });
        });
      }

      const deleteBtn = div.querySelector('.delete-sem-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        semesterHistory.splice(index, 1);
        if (expandedHistoryIdx === index) expandedHistoryIdx = null;
        else if (expandedHistoryIdx > index) expandedHistoryIdx--;
        saveHistory();
        renderHistory();
      });

      historyList.appendChild(div);
    });

    const cgpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "0.00";
    cumCreditsDisplay.textContent = totalCredits.toFixed(2);
    cumCgpaDisplay.textContent = cgpa;
  }

  function recalculateSemester(index) {
    const sem = semesterHistory[index];
    if (!sem.courses || sem.courses.length === 0) return;
    
    let totalCr = 0;
    let totalPts = 0;
    sem.courses.forEach(c => {
      const gp = gradePoints[c.grade] || 0;
      totalCr += c.credits;
      totalPts += (c.credits * gp);
    });
    
    sem.totalCredits = totalCr;
    sem.gpa = totalCr > 0 ? (totalPts / totalCr) : 0;
    
    saveHistory();
    renderHistory();
  }

  function saveHistory() {
    localStorage.setItem('sastcGpaHistory', JSON.stringify(semesterHistory));
  }

  function calculateTermGPA() {
    let termCredits = 0;
    let termPoints = 0;

    currentCourses.forEach(c => {
      const cred = parseFloat(c.credits) || 0;
      const gp = gradePoints[c.grade];
      if (gp !== undefined) {
        termCredits += cred;
        termPoints += (cred * gp);
      }
    });

    const gpa = termCredits > 0 ? (termPoints / termCredits).toFixed(2) : "0.00";
    if (termGpaDisplay) termGpaDisplay.textContent = gpa;
    return { gpa: parseFloat(gpa), credits: termCredits };
  }

  function loadCourses() {
    const dept = getActiveDepartment();
    const level = calcLevel.value;
    const sem = calcSemester.value;

    currentSemLabel.textContent = `(${dept} L${level} S${sem})`;
    courseList.innerHTML = '';
    currentCourses = [];

    const courses = syllabusData[dept]?.[level]?.[sem] || [];

    if (courses.length === 0) {
      courseList.innerHTML = '<p class="text-sm text-gray-500 italic">No courses found for this selection.</p>';
      calculateTermGPA();
      return;
    }

    courses.forEach((c, index) => {
      currentCourses.push({ ...c, grade: "A" }); // default grade
      
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100";
      
      row.innerHTML = `
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold text-indigo-600">${c.code}</div>
          <div class="text-sm text-gray-700 truncate" title="${c.name}">${c.name}</div>
        </div>
        <div class="text-sm font-medium text-gray-500 w-12 text-center bg-white border border-gray-200 rounded p-1">
          ${c.credits} Cr
        </div>
        <select class="setting-select w-20 p-1.5 rounded border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700 grade-select" data-idx="${index}">
          ${Object.keys(gradePoints).map(g => `<option value="${g}" ${g === 'A' ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      `;
      courseList.appendChild(row);
    });

    document.querySelectorAll('.grade-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = e.target.getAttribute('data-idx');
        currentCourses[idx].grade = e.target.value;
        calculateTermGPA();
      });
    });

    calculateTermGPA();
  }

  // Event Listeners
  [calcLevel, calcSemester].forEach(el => {
    if (el) el.addEventListener('change', loadCourses);
  });

  const toggleCoursesBtn = document.getElementById("toggleCoursesBtn");
  const toggleCoursesIcon = document.getElementById("toggleCoursesIcon");
  const courseContentWrapper = document.getElementById("courseContentWrapper");

  if (toggleCoursesBtn) {
    toggleCoursesBtn.addEventListener('click', () => {
      courseContentWrapper.classList.toggle('hidden');
      if (courseContentWrapper.classList.contains('hidden')) {
        toggleCoursesIcon.classList.replace('fa-chevron-up', 'fa-chevron-down');
      } else {
        toggleCoursesIcon.classList.replace('fa-chevron-down', 'fa-chevron-up');
      }
    });
  }

  // Listen for custom event from settings to reload if department changes
  window.addEventListener('sastc_dept_changed', () => {
    loadCourses();
  });

  if (saveTermBtn) {
    saveTermBtn.addEventListener('click', () => {
      if (currentCourses.length === 0) return;
      const { gpa, credits } = calculateTermGPA();
      if (credits === 0) return;

      const record = {
        dept: getActiveDepartment(),
        level: calcLevel.value,
        semester: calcSemester.value,
        gpa: gpa,
        totalCredits: credits,
        courses: currentCourses.map(c => ({ code: c.code, credits: c.credits, grade: c.grade }))
      };

      // Check if this semester already exists and replace it, or push new
      const existingIdx = semesterHistory.findIndex(s => s.dept === record.dept && s.level === record.level && s.semester === record.semester);
      if (existingIdx >= 0) {
        semesterHistory[existingIdx] = record;
      } else {
        semesterHistory.push(record);
      }

      saveHistory();
      renderHistory();
      
      // Visual feedback
      const originalText = saveTermBtn.innerHTML;
      saveTermBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
      saveTermBtn.classList.replace('bg-primary', 'bg-green-600');
      setTimeout(() => {
        saveTermBtn.innerHTML = originalText;
        saveTermBtn.classList.replace('bg-green-600', 'bg-primary');
      }, 2000);
    });
  }

  if (clearHistoryBtn) {
    let confirmTimeout;
    clearHistoryBtn.addEventListener('click', () => {
      if (clearHistoryBtn.classList.contains('confirming')) {
        semesterHistory = [];
        saveHistory();
        renderHistory();
        aiAdvisorCard.classList.add('hidden');
        
        clearHistoryBtn.classList.remove('confirming', 'bg-red-600', 'text-white');
        clearHistoryBtn.classList.add('bg-red-50', 'text-red-500');
        clearHistoryBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Clear</span>';
        clearTimeout(confirmTimeout);
        showToast("GPA history cleared");
      } else {
        clearHistoryBtn.classList.add('confirming', 'bg-red-600', 'text-white');
        clearHistoryBtn.classList.remove('bg-red-50', 'text-red-500');
        clearHistoryBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span>Sure?</span>';
        
        confirmTimeout = setTimeout(() => {
          clearHistoryBtn.classList.remove('confirming', 'bg-red-600', 'text-white');
          clearHistoryBtn.classList.add('bg-red-50', 'text-red-500');
          clearHistoryBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Clear</span>';
        }, 3000);
      }
    });
  }

  if (getAdviceBtn) {
    getAdviceBtn.addEventListener('click', async () => {
      const { gpa, credits } = calculateTermGPA();
      
      const apiKeys = JSON.parse(localStorage.getItem("geminiApiKeys")) || [];
      if (apiKeys.length === 0) {
        showToast("Please add a Gemini API Key in the Settings tab first.");
        return;
      }

      aiAdvisorCard.classList.remove('hidden');
      aiAdvisorText.innerHTML = '<div class="flex items-center gap-2"><i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing your performance...</div>';

      // Randomize keys for load balancing
      const shuffledKeys = [...apiKeys].sort(() => 0.5 - Math.random());
      let success = false;
      let lastErrorMsg = "Error connecting to AI Advisor.";

      for (const key of shuffledKeys) {
        try {
          const res = await fetch("/api/advisor", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-gemini-api-key": key
            },
            body: JSON.stringify({
              cgpa: cumCgpaDisplay.textContent,
              termGpa: gpa,
              currentSemCourses: currentCourses,
              level: calcLevel.value,
              semester: calcSemester.value,
              history: semesterHistory
            })
          });

          // Check if it's a rate limit error to auto-retry
          if (res.status === 429) {
            console.warn("Rate limited, falling back to next API key...");
            lastErrorMsg = "Rate limited. All keys exhausted.";
            continue;
          }

          const data = await res.json();
          if (data.error) {
            if ((res.status === 400 && data.error.includes("Invalid")) || res.status === 403) {
              console.warn("Invalid or denied key encountered:", key);
              lastErrorMsg = data.error;
              continue; // try next key
            }
            aiAdvisorText.innerHTML = `<span class="text-red-500 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> ${data.error}</span>`;
            success = true;
            break;
          } else if (data.text) {
            const htmlContent = marked.parse(data.text);
            aiAdvisorText.innerHTML = htmlContent;
            
            // Save to localStorage as structured history
            const analysisHistory = JSON.parse(localStorage.getItem('sastc_advisor_history')) || [];
            analysisHistory.push({
              date: new Date().toISOString(),
              level: calcLevel.value,
              semester: calcSemester.value,
              text: data.text
            });
            localStorage.setItem('sastc_advisor_history', JSON.stringify(analysisHistory));
            
            renderAdvisorHistory(); // refresh the view

            success = true;
            break;
          }
        } catch (err) {
          console.error("Network error on key fallback:", err);
        }
      }

      if (!success) {
        aiAdvisorText.innerHTML = `<span class="text-red-500 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> ${lastErrorMsg}</span>`;
      }
    });
  }

  // History functionality
  let expandedAdvisorHistoryIdx = null;

  function renderAdvisorHistory() {
    const analysisHistory = JSON.parse(localStorage.getItem('sastc_advisor_history')) || [];
    const historySection = document.getElementById('advisorHistorySection');
    const historyList = document.getElementById('advisorHistoryList');
    
    if (analysisHistory.length > 0) {
      if (historySection) historySection.classList.remove('hidden');
      if (historyList) {
        historyList.innerHTML = '';
        analysisHistory.slice().reverse().forEach((item, reverseIndex) => {
          const originalIndex = analysisHistory.length - 1 - reverseIndex;
          const isExpanded = expandedAdvisorHistoryIdx === originalIndex;
          const dateStr = new Date(item.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

          const div = document.createElement('div');
          div.className = 'bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden transition-all shrink-0';
          
          const htmlContent = item.html || (window.marked ? marked.parse(item.text) : item.text);
          
          div.innerHTML = `
            <div class="flex justify-between items-center p-3 cursor-pointer hover:bg-indigo-50/50 transition-colors advisor-history-header" data-idx="${originalIndex}">
              <div>
                <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">L${item.level} S${item.semester}</span>
                <span class="text-xs text-gray-500 ml-2">${dateStr}</span>
              </div>
              <div class="flex items-center gap-2">
                <button class="text-red-300 hover:text-red-500 transition-colors p-1 delete-insight-btn" title="Delete Insight">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
                <button class="text-gray-400 hover:text-indigo-600 transition-colors p-1" title="Toggle Details">
                  <i class="fa-solid ${isExpanded ? 'fa-chevron-up text-indigo-600' : 'fa-chevron-down'}"></i>
                </button>
              </div>
            </div>
            <div class="advisor-history-body ${isExpanded ? 'block' : 'hidden'} p-3 border-t border-gray-100 text-sm text-gray-700 prose prose-sm max-w-none bg-gray-50">
              ${htmlContent}
            </div>
          `;

          const headerClick = div.querySelector('.advisor-history-header');
          headerClick.addEventListener('click', (e) => {
            if (e.target.closest('.delete-insight-btn')) return;
            expandedAdvisorHistoryIdx = isExpanded ? null : originalIndex;
            renderAdvisorHistory();
          });

          const deleteBtn = div.querySelector('.delete-insight-btn');
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            analysisHistory.splice(originalIndex, 1);
            localStorage.setItem('sastc_advisor_history', JSON.stringify(analysisHistory));
            if (expandedAdvisorHistoryIdx === originalIndex) {
              expandedAdvisorHistoryIdx = null;
            } else if (expandedAdvisorHistoryIdx > originalIndex) {
              expandedAdvisorHistoryIdx--;
            }
            renderAdvisorHistory();
          });

          historyList.appendChild(div);
        });
      }
    } else {
      if (historySection) historySection.classList.add('hidden');
    }
  }

  // Init
  if (calcLevel) {
    loadCourses();
    renderHistory();
    renderAdvisorHistory();
  }
}

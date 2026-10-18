export interface NoticeItem {
  id?: string;
  title: string;
  date?: string;
  department?: string;
  category?: string;
  url?: string;
  pdf?: string;
  pdf_url?: string;
  pdfUrl?: string;
  link?: string;
  desc?: string;
  description?: string;
  text?: string;
  deptCode?: string;
  isResult?: boolean;
  isResultApi?: boolean;
  _key?: string;
  _deptCode?: string;
  _isResult?: boolean;
  _searchableText?: string;
  _dateMs?: number;
  _isNew?: boolean;
}

export interface Course {
  code: string;
  name: string;
  credits: number;
  grade?: string;
}

export interface SemesterRecord {
  dept: string;
  level: string;
  semester: string;
  gpa: number;
  totalCredits: number;
  courses: Array<{
    code: string;
    credits: number;
    grade: string;
  }>;
}

export interface AdvisorHistoryItem {
  date: string;
  level: string;
  semester: string;
  text: string;
  html?: string;
}

export interface FavoriteItem {
  id: string;
  title: string;
  type: 'notice' | 'result' | 'syllabus' | 'document';
  date?: string;
  department?: string;
  category?: string;
  url?: string;
  textContent?: string;
  savedAt: string;
  extra?: any;
}

export type DeptCode = 'CSE' | 'AG' | 'BBA' | 'ALL';
export type TabType = 'home' | 'notice' | 'result' | 'calculator' | 'settings' | 'favorites';

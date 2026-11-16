import {
  AcademicActivityRecord,
  AcademicSettingsBundle,
  AcademicWarningRecord,
  AcademicYearRecord,
  ClassSectionRecord,
  CompletionStatus,
  EnrollmentRecord,
  GradeApprovalRecord,
  GradeChangeLogRecord,
  GradeSubmissionRecord,
  LecturerProfile,
  SemesterRecord,
  StudentAcademicSummary,
  StudentProfile,
  UserRole,
} from '../../shared/academicLogic.ts';

export interface AcademicTermsBundle {
  years: AcademicYearRecord[];
  semesters: SemesterRecord[];
}

export interface AuthUser {
  user_id: string;
  username: string;
  email: string;
  role: UserRole;
  display_name: string;
  avatar_url: string;
  student_id: string | null;
  lecturer_id: string | null;
}

export interface StudentOverviewResponse {
  student: StudentProfile;
  summary: StudentAcademicSummary;
  enrollments: EnrollmentRecord[];
  warnings: AcademicWarningRecord[];
  activities: AcademicActivityRecord[];
  settings: AcademicSettingsBundle;
  academicTerms: AcademicTermsBundle;
}

export interface CatalogCourse {
  course_id: string;
  course_code: string;
  course_name: string;
  credit_hours: number;
  department: string;
  description: string;
}

export interface AdminEnrichedStudent extends StudentProfile {
  cgpa: number | null;
  earnedCredits: number;
  failedCredits: number;
  gpaEligibleCredits: number;
  classification: string;
  activeWarningCount: number;
}

export interface AdminOverviewResponse {
  metrics: {
    totalStudents: number;
    activeStudents: number;
    totalLecturers: number;
    activeSections: number;
    pendingApprovals: number;
    studentsWithWarnings: number;
    studentsWithLowGpa: number;
    totalCourses: number;
    averageCgpa: number;
  };
  students: AdminEnrichedStudent[];
  lecturers: LecturerProfile[];
  sections: ClassSectionRecord[];
  submissions: GradeSubmissionRecord[];
  approvalHistory: Array<
    GradeApprovalRecord & {
      section_code: string;
      course_code: string;
      course_name: string;
      semester: string;
      academic_year: string;
    }
  >;
  warnings: AcademicWarningRecord[];
  charts: {
    gpaDistribution: Array<{ range: string; label: string; count: number }>;
    warningDistribution: Array<{ type: string; label: string; count: number }>;
    semesterAverages: Array<{ semester: string; averageGpa: number; studentsCount: number }>;
  };
  recentActivities: AcademicActivityRecord[];
  settings: AcademicSettingsBundle;
  academicTerms: AcademicTermsBundle;
}

export interface LecturerNotificationItem {
  id: string;
  title: string;
  description: string;
  tone: 'warning' | 'info' | 'danger' | 'success';
  section_id: string;
  date: string;
}

export interface LecturerOverviewResponse {
  lecturer: LecturerProfile;
  metrics: {
    assignedSectionsCount: number;
    totalSectionsCount: number;
    totalStudentsCount: number;
    incompleteGradingCount: number;
    failedStudentsCount: number;
  };
  sections: ClassSectionRecord[];
  charts: {
    gradeDistribution: Array<{ group: string; count: number }>;
    passFailDistribution: Array<{ name: string; count: number }>;
  };
  notifications: LecturerNotificationItem[];
  settings: AcademicSettingsBundle;
  academicTerms: AcademicTermsBundle;
}

export interface SectionDetailResponse {
  section: ClassSectionRecord;
  enrollments: EnrollmentRecord[];
  submissions: GradeSubmissionRecord[];
  approvals: GradeApprovalRecord[];
  changeLogs: GradeChangeLogRecord[];
  settings: AcademicSettingsBundle;
}

export interface LecturerScopedStudentRow {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_major: string;
  student_cohort: string;
  section_id: string;
  section_code: string;
  course_code: string;
  course_name: string;
  semester: string;
  academic_year: string;
  grade_status: string;
  attendance_status: string;
  numeric_grade: number | null;
  letter_grade: string | null;
  grade_point: number | null;
  completion_status: CompletionStatus;
}

const TOKEN_STORAGE_KEY = 'uniportal_auth_token';
const REMEMBERED_ID_KEY = 'uniportal_remembered_identifier';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getAuthToken(): string | null {
  try {
    return (
      window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
      window.localStorage.getItem(TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function saveAuthToken(token: string, rememberMe: boolean): void {
  try {
    if (rememberMe) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

export function clearAuthToken(): void {
  try {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function getRememberedIdentifier(): string {
  try {
    return window.localStorage.getItem(REMEMBERED_ID_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveRememberedIdentifier(identifier: string | null): void {
  try {
    if (identifier) {
      window.localStorage.setItem(REMEMBERED_ID_KEY, identifier);
    } else {
      window.localStorage.removeItem(REMEMBERED_ID_KEY);
    }
  } catch {
    // Ignore
  }
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/login')) {
      clearAuthToken();
    }
    throw new ApiError(
      (data as { error?: string }).error || `Yêu cầu thất bại (${res.status})`,
      res.status
    );
  }
  return data as T;
}

export const api = {
  login: async (identifier: string, password: string, rememberMe = true) => {
    const data = await requestJson<{
      token: string;
      user: AuthUser;
      student: StudentProfile | null;
      lecturer: LecturerProfile | null;
      settings: AcademicSettingsBundle;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    if (data.token) {
      saveAuthToken(data.token, rememberMe);
    }
    saveRememberedIdentifier(rememberMe ? identifier.trim() : null);
    return data;
  },

  logout: async () => {
    try {
      return await requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
    }
  },

  me: () =>
    requestJson<{
      user: AuthUser;
      student: StudentProfile | null;
      lecturer: LecturerProfile | null;
      settings: AcademicSettingsBundle;
    }>('/api/auth/me'),

  getCourses: () => requestJson<CatalogCourse[]>('/api/courses'),

  getStudentOverview: (studentId: string) =>
    requestJson<StudentOverviewResponse>(`/api/students/${encodeURIComponent(studentId)}/overview`),

  updateStudentProfile: (studentId: string, payload: { email: string; phone: string }) =>
    requestJson<{ student: StudentProfile }>(
      `/api/students/${encodeURIComponent(studentId)}/profile`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  addEnrollment: (
    studentId: string,
    payload: {
      course_code: string;
      course_name: string;
      credit_hours: number;
      semester: string;
      academic_year: string;
      letter_grade: string | null;
      numeric_grade: number | null;
      completion_status: CompletionStatus;
    }
  ) =>
    requestJson<{ enrollment_id: string; summary: StudentAcademicSummary }>(
      `/api/students/${encodeURIComponent(studentId)}/enrollments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  updateEnrollment: (
    studentId: string,
    enrollmentId: string,
    payload: {
      course_code: string;
      course_name: string;
      credit_hours: number;
      semester: string;
      academic_year: string;
      letter_grade: string | null;
      numeric_grade: number | null;
      completion_status: CompletionStatus;
    }
  ) =>
    requestJson<{ summary: StudentAcademicSummary }>(
      `/api/students/${encodeURIComponent(studentId)}/enrollments/${encodeURIComponent(enrollmentId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  deleteEnrollment: (studentId: string, enrollmentId: string) =>
    requestJson<{ ok: boolean; summary: StudentAcademicSummary }>(
      `/api/students/${encodeURIComponent(studentId)}/enrollments/${encodeURIComponent(enrollmentId)}`,
      {
        method: 'DELETE',
      }
    ),

  markWarningRead: (studentId: string, warningId: string) =>
    requestJson<{ ok: boolean }>(
      `/api/students/${encodeURIComponent(studentId)}/warnings/${encodeURIComponent(warningId)}/read`,
      { method: 'PATCH' }
    ),

  // Lecturer APIs
  getLecturerOverview: () => requestJson<LecturerOverviewResponse>('/api/lecturer/overview'),

  getLecturerSectionDetail: (sectionId: string) =>
    requestJson<SectionDetailResponse>(`/api/lecturer/sections/${encodeURIComponent(sectionId)}`),

  saveSectionGrades: (
    sectionId: string,
    grades: Array<{
      enrollment_id: string;
      attendance_status?: string;
      attendance_score?: number | null;
      assignment_score?: number | null;
      midterm_score?: number | null;
      final_score?: number | null;
      reason?: string;
    }>
  ) =>
    requestJson<SectionDetailResponse>(
      `/api/lecturer/sections/${encodeURIComponent(sectionId)}/grades`,
      {
        method: 'PUT',
        body: JSON.stringify({ grades }),
      }
    ),

  submitSectionGrades: (sectionId: string, note?: string) =>
    requestJson<{ submission_id: string; detail: SectionDetailResponse }>(
      `/api/lecturer/sections/${encodeURIComponent(sectionId)}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({ note }),
      }
    ),

  getLecturerStudents: () =>
    requestJson<{ students: LecturerScopedStudentRow[] }>('/api/lecturer/students'),

  updateLecturerProfile: (payload: {
    phone?: string;
    office_location?: string;
    specialization?: string;
  }) =>
    requestJson<{ lecturer: LecturerProfile }>('/api/lecturer/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Training Department APIs
  getAdminOverview: () => requestJson<AdminOverviewResponse>('/api/training/overview'),

  createStudent: (payload: Record<string, unknown>) =>
    requestJson<{ student: StudentProfile }>('/api/training/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateStudentAdmin: (studentId: string, payload: Record<string, unknown>) =>
    requestJson<{ student: StudentProfile }>(
      `/api/training/students/${encodeURIComponent(studentId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  deleteStudentAdmin: (studentId: string) =>
    requestJson<{ ok: boolean }>(`/api/training/students/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
    }),

  createLecturer: (payload: Record<string, unknown>) =>
    requestJson<{ lecturer: LecturerProfile }>('/api/training/lecturers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateLecturer: (lecturerId: string, payload: Record<string, unknown>) =>
    requestJson<{ lecturer: LecturerProfile }>(
      `/api/training/lecturers/${encodeURIComponent(lecturerId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  deleteLecturer: (lecturerId: string) =>
    requestJson<{ ok: boolean }>(`/api/training/lecturers/${encodeURIComponent(lecturerId)}`, {
      method: 'DELETE',
    }),

  createSection: (payload: {
    section_code: string;
    course_id: string;
    semester_id: string;
    lecturer_id?: string | null;
    schedule_info?: string;
    max_students?: number;
    submission_deadline?: string;
  }) =>
    requestJson<{ section: ClassSectionRecord }>('/api/training/sections', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSection: (
    sectionId: string,
    payload: {
      schedule_info?: string;
      max_students?: number;
      submission_deadline?: string;
      is_active?: boolean | number;
    }
  ) =>
    requestJson<{ section: ClassSectionRecord }>(
      `/api/training/sections/${encodeURIComponent(sectionId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  deleteSection: (sectionId: string) =>
    requestJson<{ ok: boolean }>(`/api/training/sections/${encodeURIComponent(sectionId)}`, {
      method: 'DELETE',
    }),

  assignLecturerToSection: (sectionId: string, lecturerId: string | null) =>
    requestJson<{ section: ClassSectionRecord }>(
      `/api/training/sections/${encodeURIComponent(sectionId)}/assign-lecturer`,
      {
        method: 'POST',
        body: JSON.stringify({ lecturer_id: lecturerId }),
      }
    ),

  enrollStudentInSection: (sectionId: string, studentId: string) =>
    requestJson<SectionDetailResponse>(
      `/api/training/sections/${encodeURIComponent(sectionId)}/enrollments`,
      {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId }),
      }
    ),

  removeStudentFromSection: (sectionId: string, enrollmentId: string) =>
    requestJson<SectionDetailResponse>(
      `/api/training/sections/${encodeURIComponent(sectionId)}/enrollments/${encodeURIComponent(enrollmentId)}`,
      { method: 'DELETE' }
    ),

  getTrainingSectionSubmission: (sectionId: string) =>
    requestJson<SectionDetailResponse>(
      `/api/training/grade-submissions/${encodeURIComponent(sectionId)}`
    ),

  approveSectionGrades: (sectionId: string, reason?: string) =>
    requestJson<{ ok: boolean; detail: SectionDetailResponse }>(
      `/api/training/grade-submissions/${encodeURIComponent(sectionId)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),

  returnSectionGrades: (sectionId: string, reason: string) =>
    requestJson<{ ok: boolean; detail: SectionDetailResponse }>(
      `/api/training/grade-submissions/${encodeURIComponent(sectionId)}/return`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),

  rejectSectionGrades: (sectionId: string, reason: string) =>
    requestJson<{ ok: boolean; detail: SectionDetailResponse }>(
      `/api/training/grade-submissions/${encodeURIComponent(sectionId)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),

  reopenSectionGrades: (sectionId: string, reason?: string) =>
    requestJson<{ ok: boolean; detail: SectionDetailResponse }>(
      `/api/training/grade-submissions/${encodeURIComponent(sectionId)}/reopen`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),

  createCatalogCourse: (payload: {
    course_code: string;
    course_name: string;
    credit_hours: number;
    department: string;
    description: string;
  }) =>
    requestJson<CatalogCourse>('/api/training/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCatalogCourse: (
    courseId: string,
    payload: {
      course_code: string;
      course_name: string;
      credit_hours: number;
      department: string;
      description: string;
    }
  ) =>
    requestJson<CatalogCourse>(`/api/training/courses/${encodeURIComponent(courseId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteCatalogCourse: (courseId: string) =>
    requestJson<{ ok: boolean }>(`/api/training/courses/${encodeURIComponent(courseId)}`, {
      method: 'DELETE',
    }),

  updateSetting: (
    settingName:
      | 'grading_scale'
      | 'classification_bands'
      | 'warning_thresholds'
      | 'gpa_policy'
      | 'assessment_weights',
    value: unknown
  ) =>
    requestJson<{ settings: AcademicSettingsBundle }>(
      `/api/training/settings/${encodeURIComponent(settingName)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }
    ),

  getAcademicTerms: () => requestJson<AcademicTermsBundle>('/api/academic-terms'),

  createAcademicYear: (payload: {
    year_code: string;
    year_name?: string;
    create_default_semesters?: boolean;
  }) =>
    requestJson<AcademicTermsBundle>('/api/training/academic-years', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAcademicYear: (yearId: string, payload: { year_name?: string; is_active?: boolean }) =>
    requestJson<AcademicTermsBundle>(
      `/api/training/academic-years/${encodeURIComponent(yearId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  createSemester: (payload: {
    year_id: string;
    semester_name: string;
    semester_code?: string;
    sort_order?: number;
  }) =>
    requestJson<AcademicTermsBundle>('/api/training/semesters', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSemester: (
    semesterId: string,
    payload: { semester_name?: string; is_active?: boolean; sort_order?: number }
  ) =>
    requestJson<AcademicTermsBundle>(
      `/api/training/semesters/${encodeURIComponent(semesterId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),
};

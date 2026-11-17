export type UserRole = 'STUDENT' | 'LECTURER' | 'TRAINING_DEPARTMENT';

export function normalizeUserRole(raw: string): UserRole {
  const up = raw.trim().toUpperCase();
  if (up === 'ADMIN' || up === 'TRAINING_DEPARTMENT') return 'TRAINING_DEPARTMENT';
  if (up === 'LECTURER') return 'LECTURER';
  return 'STUDENT';
}

export function translateUserRole(role: UserRole): string {
  switch (role) {
    case 'TRAINING_DEPARTMENT':
      return 'Phòng Đào tạo';
    case 'LECTURER':
      return 'Giảng viên';
    default:
      return 'Sinh viên';
  }
}

export type CompletionStatus = 'Completed' | 'Failed' | 'In Progress' | 'Withdrawn';

export type GradeWorkflowStatus =
  | 'NOT_ENTERED'
  | 'IN_PROGRESS'
  | 'PENDING_APPROVAL'
  | 'NEEDS_REVISION'
  | 'APPROVED';

export function translateGradeWorkflowStatus(status: GradeWorkflowStatus | string): string {
  switch (status) {
    case 'NOT_ENTERED':
      return 'Chưa nhập điểm';
    case 'IN_PROGRESS':
      return 'Đang nhập điểm';
    case 'PENDING_APPROVAL':
      return 'Chờ duyệt';
    case 'NEEDS_REVISION':
      return 'Cần chỉnh sửa';
    case 'APPROVED':
      return 'Đã phê duyệt';
    default:
      return status;
  }
}

export type WarningType =
  | 'LOW_GPA'
  | 'FAILED_CREDITS'
  | 'LOW_SEMESTER_GPA'
  | 'ACADEMIC_PROGRESS'
  | 'REPEATED_FAILED_COURSES';

export interface AcademicYearRecord {
  year_id: string;
  year_code: string;
  year_name: string;
  start_year: number;
  end_year: number;
  is_active: number;
}

export interface SemesterRecord {
  semester_id: string;
  year_id: string;
  academic_year: string;
  semester_code: string;
  semester_name: string;
  sort_order: number;
  is_active: number;
}

export type WarningSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type WarningStatus = 'Active' | 'Read' | 'Resolved';

export type RepeatPolicy = 'replace_highest' | 'replace_latest' | 'include_all';

export interface GradeScaleEntry {
  letter: string;
  point: number;
  minNumeric: number;
  maxNumeric: number;
  passing: boolean;
}

export interface ClassificationBand {
  label: string;
  minGpa: number;
  maxGpa: number;
  color: 'emerald' | 'blue' | 'sky' | 'amber' | 'orange' | 'red';
}

export interface WarningThresholds {
  lowCgpaThreshold: number;
  criticalCgpaThreshold: number;
  failedCreditsThreshold: number;
  criticalFailedCreditsThreshold: number;
  lowSemesterGpaThreshold: number;
  progressBehindRatio: number;
}

export interface GpaPolicySettings {
  repeatPolicy: RepeatPolicy;
  failedCourseInGpa: boolean;
  defaultRequiredCredits: number;
}

export interface AssessmentWeightsConfig {
  attendanceWeight: number;
  assignmentWeight: number;
  midtermWeight: number;
  finalWeight: number;
}

export interface AcademicSettingsBundle {
  gradingScale: GradeScaleEntry[];
  classificationBands: ClassificationBand[];
  warningThresholds: WarningThresholds;
  gpaPolicy: GpaPolicySettings;
  assessmentWeights: AssessmentWeightsConfig;
}

export interface StudentProfile {
  student_id: string;
  user_id: string;
  full_name: string;
  email: string;
  faculty: string;
  major: string;
  academic_year: string;
  enrollment_year: number;
  total_required_credits: number;
  expected_credits_per_semester: number;
  academic_status: string;
  phone: string;
  advisor_name: string;
  avatar_url: string;
}

export interface LecturerProfile {
  lecturer_id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string;
  academic_rank: string;
  specialization: string;
  phone: string;
  office_location: string;
  status: 'active' | 'inactive';
  avatar_url: string;
  created_at: string;
}

export interface ClassSectionRecord {
  section_id: string;
  section_code: string;
  course_id: string;
  course_code: string;
  course_name: string;
  credit_hours: number;
  department: string;
  semester_id: string;
  semester: string;
  academic_year: string;
  lecturer_id: string | null;
  lecturer_name: string | null;
  lecturer_email?: string | null;
  schedule_info: string;
  max_students: number;
  submission_deadline: string;
  grade_status: GradeWorkflowStatus;
  is_active: number;
  enrolled_count: number;
  graded_count: number;
  ungraded_count: number;
  passed_count: number;
  failed_count: number;
  latest_submission_at?: string | null;
  latest_review_reason?: string | null;
}

export interface GradeSubmissionRecord {
  submission_id: string;
  section_id: string;
  section_code: string;
  course_code: string;
  course_name: string;
  semester: string;
  academic_year: string;
  lecturer_id: string;
  lecturer_name: string;
  submitted_by_user_id: string;
  submitted_at: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'NEEDS_REVISION' | 'REJECTED';
  student_count: number;
  graded_count: number;
  note: string;
}

export interface GradeApprovalRecord {
  approval_id: string;
  submission_id: string;
  section_id: string;
  reviewed_by_user_id: string;
  reviewer_name: string;
  decision: 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_REVISION' | 'REOPENED';
  reason: string;
  reviewed_at: string;
}

export interface GradeChangeLogRecord {
  log_id: string;
  enrollment_id: string;
  section_id: string | null;
  student_id: string;
  course_code: string;
  changed_by_user_id: string;
  changed_by_name: string;
  changed_by_role: string;
  previous_numeric_grade: number | null;
  new_numeric_grade: number | null;
  previous_letter_grade: string | null;
  new_letter_grade: string | null;
  reason: string;
  changed_at: string;
}

export interface EnrollmentRecord {
  enrollment_id: string;
  student_id: string;
  student_name?: string;
  student_major?: string;
  course_id: string;
  course_code: string;
  course_name: string;
  credit_hours: number;
  department?: string;
  section_id?: string | null;
  section_code?: string | null;
  semester: string;
  academic_year: string;
  attendance_score?: number | null;
  assignment_score?: number | null;
  midterm_score?: number | null;
  final_score?: number | null;
  attendance_status?: string | null;
  letter_grade: string | null;
  numeric_grade: number | null;
  grade_point: number | null;
  completion_status: CompletionStatus;
  is_repeated: number;
  is_official?: number;
  updated_at: string;
}

export interface GpaCourseBreakdownItem {
  enrollment_id: string;
  course_code: string;
  course_name: string;
  semester: string;
  academic_year: string;
  credit_hours: number;
  letter_grade: string | null;
  grade_point: number | null;
  weighted_points: number;
  completion_status: CompletionStatus;
  included_in_gpa: boolean;
  exclusion_reason: string | null;
}

export interface SemesterGpaSummary {
  semesterKey: string;
  semester: string;
  academic_year: string;
  semesterGpa: number | null;
  cumulativeGpa: number | null;
  semesterGpaCredits: number;
  semesterWeightedPoints: number;
  earnedCredits: number;
  cumulativeEarnedCredits: number;
  failedCredits: number;
  courseCount: number;
  completedCoursesCount: number;
  passedCoursesCount: number;
  failedCoursesCount: number;
  inProgressCoursesCount: number;
  withdrawnCoursesCount: number;
  courses: GpaCourseBreakdownItem[];
}

export interface RetakeCourseNotice {
  course_code: string;
  course_name: string;
  credit_hours: number;
  failedAttempts: number;
  lastSemester: string;
  lastAcademicYear: string;
}

export interface StudentAcademicSummary {
  cgpa: number | null;
  latestSemesterGpa: number | null;
  latestSemesterLabel: string | null;
  gpaEligibleCredits: number;
  totalWeightedPoints: number;
  earnedCredits: number;
  failedCredits: number;
  inProgressCredits: number;
  totalRequiredCredits: number;
  remainingCreditsToGraduation: number;
  completionPercentage: number;
  totalCoursesCount: number;
  completedCoursesCount: number;
  inProgressCoursesCount: number;
  failedCoursesCount: number;
  retakeRequiredCourses: RetakeCourseNotice[];
  classification: ClassificationBand;
  semesters: SemesterGpaSummary[];
  breakdown: GpaCourseBreakdownItem[];
}

export interface WarningEvaluationCandidate {
  warning_type: WarningType;
  warning_title: string;
  description: string;
  triggering_condition: string;
  severity: WarningSeverity;
  suggested_action: string;
  academic_year: string;
  semester: string;
}

export interface AcademicWarningRecord {
  warning_id: string;
  student_id: string;
  student_name?: string;
  warning_type: WarningType;
  warning_title: string;
  description: string;
  triggering_condition: string;
  severity: WarningSeverity;
  warning_status: WarningStatus;
  suggested_action: string;
  academic_year: string;
  semester: string;
  generated_at: string;
}

export interface AcademicActivityRecord {
  activity_id: string;
  student_id: string | null;
  actor_user_id: string;
  activity_type: string;
  description: string;
  created_at: string;
}

export const DEFAULT_GRADING_SCALE: GradeScaleEntry[] = [
  { letter: 'A', point: 4.0, minNumeric: 90, maxNumeric: 100, passing: true },
  { letter: 'A-', point: 3.7, minNumeric: 85, maxNumeric: 89.99, passing: true },
  { letter: 'B+', point: 3.5, minNumeric: 80, maxNumeric: 84.99, passing: true },
  { letter: 'B', point: 3.0, minNumeric: 75, maxNumeric: 79.99, passing: true },
  { letter: 'B-', point: 2.7, minNumeric: 70, maxNumeric: 74.99, passing: true },
  { letter: 'C+', point: 2.5, minNumeric: 65, maxNumeric: 69.99, passing: true },
  { letter: 'C', point: 2.0, minNumeric: 55, maxNumeric: 64.99, passing: true },
  { letter: 'D+', point: 1.5, minNumeric: 50, maxNumeric: 54.99, passing: true },
  { letter: 'D', point: 1.0, minNumeric: 40, maxNumeric: 49.99, passing: true },
  { letter: 'F', point: 0.0, minNumeric: 0, maxNumeric: 39.99, passing: false },
];

export const DEFAULT_CLASSIFICATION_BANDS: ClassificationBand[] = [
  { label: 'Xuất sắc', minGpa: 3.6, maxGpa: 4.0, color: 'emerald' },
  { label: 'Giỏi', minGpa: 3.2, maxGpa: 3.59, color: 'blue' },
  { label: 'Khá', minGpa: 2.5, maxGpa: 3.19, color: 'sky' },
  { label: 'Trung bình', minGpa: 2.0, maxGpa: 2.49, color: 'amber' },
  { label: 'Yếu', minGpa: 1.0, maxGpa: 1.99, color: 'orange' },
  { label: 'Kém', minGpa: 0.0, maxGpa: 0.99, color: 'red' },
];

export const DEFAULT_WARNING_THRESHOLDS: WarningThresholds = {
  lowCgpaThreshold: 2.0,
  criticalCgpaThreshold: 1.5,
  failedCreditsThreshold: 6,
  criticalFailedCreditsThreshold: 12,
  lowSemesterGpaThreshold: 2.0,
  progressBehindRatio: 0.7,
};

export const DEFAULT_GPA_POLICY: GpaPolicySettings = {
  repeatPolicy: 'replace_highest',
  failedCourseInGpa: true,
  defaultRequiredCredits: 130,
};

export const DEFAULT_ASSESSMENT_WEIGHTS: AssessmentWeightsConfig = {
  attendanceWeight: 0.1,
  assignmentWeight: 0.2,
  midtermWeight: 0.2,
  finalWeight: 0.5,
};

export function computeWeightedNumericGrade(
  scores: {
    attendance_score?: number | null;
    assignment_score?: number | null;
    midterm_score?: number | null;
    final_score?: number | null;
  },
  weights: AssessmentWeightsConfig
): number | null {
  const hasAtt = scores.attendance_score !== null && scores.attendance_score !== undefined;
  const hasAsg = scores.assignment_score !== null && scores.assignment_score !== undefined;
  const hasMid = scores.midterm_score !== null && scores.midterm_score !== undefined;
  const hasFin = scores.final_score !== null && scores.final_score !== undefined;

  if (!hasAtt && !hasAsg && !hasMid && !hasFin) return null;
  if (!hasFin) return null; // Final exam score required for finalized grade

  const a = hasAtt ? Number(scores.attendance_score) : 0;
  const b = hasAsg ? Number(scores.assignment_score) : 0;
  const m = hasMid ? Number(scores.midterm_score) : 0;
  const f = Number(scores.final_score);

  const wSum =
    (hasAtt ? weights.attendanceWeight : 0) +
    (hasAsg ? weights.assignmentWeight : 0) +
    (hasMid ? weights.midtermWeight : 0) +
    weights.finalWeight;
  if (wSum <= 0) return null;

  const raw =
    (a * (hasAtt ? weights.attendanceWeight : 0) +
      b * (hasAsg ? weights.assignmentWeight : 0) +
      m * (hasMid ? weights.midtermWeight : 0) +
      f * weights.finalWeight) /
    wSum;

  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

export function roundGpa(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function formatGpa(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return '—';
  }
  return val.toFixed(2);
}

export function translateCompletionStatus(status: CompletionStatus): string {
  switch (status) {
    case 'Completed':
      return 'Đạt';
    case 'Failed':
      return 'Chưa đạt';
    case 'In Progress':
      return 'Đang học';
    case 'Withdrawn':
      return 'Đã rút';
  }
}

export function translateSeverity(severity: WarningSeverity): string {
  switch (severity) {
    case 'Low':
      return 'Nhẹ';
    case 'Medium':
      return 'Trung bình';
    case 'High':
      return 'Cao';
    case 'Critical':
      return 'Nghiêm trọng';
  }
}

export function translateWarningStatus(status: WarningStatus): string {
  switch (status) {
    case 'Active':
      return 'Chưa đọc';
    case 'Read':
      return 'Đã đọc';
    case 'Resolved':
      return 'Đã khắc phục';
  }
}

export function translateStudentAcademicStatus(status: string): string {
  switch (status) {
    case 'Active':
      return 'Đang học';
    case 'Warning':
      return 'Cảnh báo học vụ';
    case 'Academic Probation':
      return 'Cảnh báo mức cao';
    case 'Graduated':
      return 'Đã tốt nghiệp';
    default:
      return status;
  }
}

export function resolveGradeFromScale(
  letterGrade: string | null | undefined,
  scale: GradeScaleEntry[]
): GradeScaleEntry | null {
  if (!letterGrade) return null;
  const normalized = letterGrade.trim().toUpperCase();
  return scale.find((g) => g.letter.toUpperCase() === normalized) ?? null;
}

export function resolveLetterFromNumeric(
  numericGrade: number,
  scale: GradeScaleEntry[]
): GradeScaleEntry | null {
  const sorted = [...scale].sort((a, b) => b.minNumeric - a.minNumeric);
  return sorted.find((g) => numericGrade >= g.minNumeric) ?? sorted[sorted.length - 1] ?? null;
}

export function getClassificationForGpa(
  gpa: number | null,
  bands: ClassificationBand[]
): ClassificationBand {
  if (gpa === null) {
    return { label: 'Chưa xếp loại', minGpa: 0, maxGpa: 0, color: 'sky' };
  }
  const rounded = roundGpa(gpa);
  const sorted = [...bands].sort((a, b) => b.minGpa - a.minGpa);
  for (const band of sorted) {
    if (rounded >= band.minGpa) {
      return band;
    }
  }
  return (
    sorted[sorted.length - 1] ??
    DEFAULT_CLASSIFICATION_BANDS[DEFAULT_CLASSIFICATION_BANDS.length - 1]
  );
}

export function semesterSortRank(semester: string): number {
  const s = semester.toLowerCase();
  if (s.includes('hè') || s.includes('he') || s.includes('summer')) return 3;
  const numMatch = s.match(/(\d+)/);
  if (numMatch) return Number(numMatch[1]);
  if (s.includes('thu') || s.includes('fall')) return 1;
  if (s.includes('đông') || s.includes('winter')) return 2;
  if (s.includes('xuân') || s.includes('spring')) return 3;
  return 99;
}

export function compareTermChronology(
  a: { academic_year: string; semester: string },
  b: { academic_year: string; semester: string }
): number {
  const yearCmp = a.academic_year.localeCompare(b.academic_year);
  if (yearCmp !== 0) return yearCmp;
  const semCmp = semesterSortRank(a.semester) - semesterSortRank(b.semester);
  if (semCmp !== 0) return semCmp;
  return a.semester.localeCompare(b.semester);
}

export function calculateStudentAcademicSummary(
  enrollments: EnrollmentRecord[],
  settings: AcademicSettingsBundle,
  totalRequiredCredits = settings.gpaPolicy.defaultRequiredCredits
): StudentAcademicSummary {
  const officialGated = enrollments.map((rec) => {
    if (rec.is_official === 0 && (rec.completion_status === 'Completed' || rec.completion_status === 'Failed')) {
      return {
        ...rec,
        completion_status: 'In Progress' as CompletionStatus,
        letter_grade: null,
        numeric_grade: null,
        grade_point: null,
      };
    }
    return rec;
  });
  const sorted = [...officialGated].sort(compareTermChronology);
  const { gradingScale, classificationBands, gpaPolicy } = settings;

  const enriched = sorted.map((e) => {
    const isFinalStatus = e.completion_status === 'Completed' || e.completion_status === 'Failed';
    const scaleMatch = resolveGradeFromScale(e.letter_grade, gradingScale);
    const effectivePoint =
      isFinalStatus && scaleMatch
        ? scaleMatch.point
        : isFinalStatus && e.grade_point !== null
          ? e.grade_point
          : null;
    const isPassing =
      e.completion_status === 'Completed' &&
      (scaleMatch ? scaleMatch.passing : (effectivePoint ?? 0) > 0);

    return {
      record: e,
      isFinalStatus,
      scaleMatch,
      effectivePoint,
      isPassing,
    };
  });

  const finalizedByCourse = new Map<string, typeof enriched>();
  for (const item of enriched) {
    if (!item.isFinalStatus || item.effectivePoint === null) continue;
    if (!gpaPolicy.failedCourseInGpa && item.record.completion_status === 'Failed') continue;
    const key = item.record.course_code.trim().toUpperCase();
    const list = finalizedByCourse.get(key) ?? [];
    list.push(item);
    finalizedByCourse.set(key, list);
  }

  const winningAttemptIds = new Set<string>();
  const supersededReasonById = new Map<string, string>();

  for (const [, attempts] of finalizedByCourse.entries()) {
    if (attempts.length === 1 || gpaPolicy.repeatPolicy === 'include_all') {
      for (const a of attempts) winningAttemptIds.add(a.record.enrollment_id);
      continue;
    }

    let winner = attempts[attempts.length - 1];
    if (gpaPolicy.repeatPolicy === 'replace_highest') {
      winner = attempts.reduce((best, curr) => {
        const bestPt = best.effectivePoint ?? 0;
        const currPt = curr.effectivePoint ?? 0;
        if (currPt > bestPt) return curr;
        if (currPt === bestPt) return curr;
        return best;
      }, attempts[0]);
    }
    winningAttemptIds.add(winner.record.enrollment_id);
    for (const a of attempts) {
      if (a.record.enrollment_id !== winner.record.enrollment_id) {
        supersededReasonById.set(
          a.record.enrollment_id,
          gpaPolicy.repeatPolicy === 'replace_highest'
            ? `Không tính theo quy chế học cải thiện (đã thay bằng điểm cao hơn tại ${winner.record.semester} ${winner.record.academic_year})`
            : `Không tính theo quy chế học lại (đã thay bằng lần học gần nhất tại ${winner.record.semester} ${winner.record.academic_year})`
        );
      }
    }
  }

  const passedCourseCodes = new Set<string>();
  let earnedCredits = 0;
  let inProgressCredits = 0;
  let gpaEligibleCredits = 0;
  let totalWeightedPoints = 0;

  const breakdown: GpaCourseBreakdownItem[] = [];

  for (const item of enriched) {
    const e = item.record;
    const courseKey = e.course_code.trim().toUpperCase();

    if (e.completion_status === 'In Progress') {
      inProgressCredits += e.credit_hours;
    }
    if (item.isPassing && !passedCourseCodes.has(courseKey)) {
      passedCourseCodes.add(courseKey);
      earnedCredits += e.credit_hours;
    }

    let included = false;
    let exclusionReason: string | null = null;

    if (e.completion_status === 'In Progress') {
      exclusionReason = 'Học phần đang học (chưa có điểm cuối kỳ)';
    } else if (e.completion_status === 'Withdrawn') {
      exclusionReason = 'Học phần đã rút không tính vào GPA';
    } else if (item.effectivePoint === null) {
      exclusionReason = 'Chưa có điểm quy đổi hợp lệ trên thang điểm';
    } else if (!gpaPolicy.failedCourseInGpa && e.completion_status === 'Failed') {
      exclusionReason = 'Học phần chưa đạt được loại trừ theo cấu hình';
    } else if (!winningAttemptIds.has(e.enrollment_id)) {
      exclusionReason = supersededReasonById.get(e.enrollment_id) ?? 'Loại trừ do quy chế học lại';
    } else {
      included = true;
    }

    const weighted = included && item.effectivePoint !== null ? e.credit_hours * item.effectivePoint : 0;
    if (included) {
      gpaEligibleCredits += e.credit_hours;
      totalWeightedPoints += weighted;
    }

    breakdown.push({
      enrollment_id: e.enrollment_id,
      course_code: e.course_code,
      course_name: e.course_name,
      semester: e.semester,
      academic_year: e.academic_year,
      credit_hours: e.credit_hours,
      letter_grade: e.letter_grade,
      grade_point: item.effectivePoint,
      weighted_points: weighted,
      completion_status: e.completion_status,
      included_in_gpa: included,
      exclusion_reason: exclusionReason,
    });
  }

  let failedCredits = 0;
  for (const item of enriched) {
    if (item.record.completion_status === 'Failed') {
      const key = item.record.course_code.trim().toUpperCase();
      if (gpaPolicy.repeatPolicy === 'include_all' || !passedCourseCodes.has(key)) {
        failedCredits += item.record.credit_hours;
      }
    }
  }

  const termGroups = new Map<
    string,
    { semester: string; academic_year: string; items: GpaCourseBreakdownItem[] }
  >();
  for (const b of breakdown) {
    const key = `${b.academic_year}::${b.semester}`;
    const existing = termGroups.get(key);
    if (existing) {
      existing.items.push(b);
    } else {
      termGroups.set(key, { semester: b.semester, academic_year: b.academic_year, items: [b] });
    }
  }

  const semesters: SemesterGpaSummary[] = [];
  let runningWeighted = 0;
  let runningGpaCredits = 0;
  const runningPassedCourses = new Set<string>();
  let runningEarnedCredits = 0;

  for (const [key, group] of termGroups.entries()) {
    let semCredits = 0;
    let semWeighted = 0;
    let semEarned = 0;
    let semFailed = 0;
    let completedCoursesCount = 0;
    let passedCoursesCount = 0;
    let failedCoursesCount = 0;
    let inProgressCoursesCount = 0;
    let withdrawnCoursesCount = 0;

    for (const c of group.items) {
      const courseKey = c.course_code.trim().toUpperCase();
      const isFinal = c.completion_status === 'Completed' || c.completion_status === 'Failed';
      if (isFinal) completedCoursesCount += 1;
      if (c.completion_status === 'In Progress') inProgressCoursesCount += 1;
      if (c.completion_status === 'Withdrawn') withdrawnCoursesCount += 1;

      const scaleEntry = resolveGradeFromScale(c.letter_grade, gradingScale);
      const isPass =
        c.completion_status === 'Completed' &&
        (scaleEntry ? scaleEntry.passing : (c.grade_point ?? 0) > 0);
      if (isPass) {
        semEarned += c.credit_hours;
        passedCoursesCount += 1;
        if (!runningPassedCourses.has(courseKey)) {
          runningPassedCourses.add(courseKey);
          runningEarnedCredits += c.credit_hours;
        }
      }
      if (c.completion_status === 'Failed') {
        semFailed += c.credit_hours;
        failedCoursesCount += 1;
      }

      if (
        isFinal &&
        c.grade_point !== null &&
        (gpaPolicy.failedCourseInGpa || c.completion_status !== 'Failed')
      ) {
        semCredits += c.credit_hours;
        semWeighted += c.credit_hours * c.grade_point;
      }

      if (c.included_in_gpa) {
        runningGpaCredits += c.credit_hours;
        runningWeighted += c.weighted_points;
      }
    }

    const semesterGpa = semCredits > 0 ? roundGpa(semWeighted / semCredits) : null;
    const cumulativeGpa = runningGpaCredits > 0 ? roundGpa(runningWeighted / runningGpaCredits) : null;

    semesters.push({
      semesterKey: key,
      semester: group.semester,
      academic_year: group.academic_year,
      semesterGpa,
      cumulativeGpa,
      semesterGpaCredits: semCredits,
      semesterWeightedPoints: roundGpa(semWeighted),
      earnedCredits: semEarned,
      cumulativeEarnedCredits: runningEarnedCredits,
      failedCredits: semFailed,
      courseCount: group.items.length,
      completedCoursesCount,
      passedCoursesCount,
      failedCoursesCount,
      inProgressCoursesCount,
      withdrawnCoursesCount,
      courses: group.items,
    });
  }

  // Track courses needing retakes (failed & not yet passed, plus repeated failed attempt count)
  const failedTracker = new Map<string, RetakeCourseNotice>();
  for (const item of enriched) {
    const e = item.record;
    const key = e.course_code.trim().toUpperCase();
    if (e.completion_status === 'Failed' && !passedCourseCodes.has(key)) {
      const cur = failedTracker.get(key);
      if (cur) {
        cur.failedAttempts += 1;
        cur.lastSemester = e.semester;
        cur.lastAcademicYear = e.academic_year;
      } else {
        failedTracker.set(key, {
          course_code: e.course_code,
          course_name: e.course_name,
          credit_hours: e.credit_hours,
          failedAttempts: 1,
          lastSemester: e.semester,
          lastAcademicYear: e.academic_year,
        });
      }
    }
  }
  const retakeRequiredCourses = Array.from(failedTracker.values());
  const inProgressCoursesCount = enriched.filter(
    (x) => x.record.completion_status === 'In Progress'
  ).length;

  const cgpa = gpaEligibleCredits > 0 ? roundGpa(totalWeightedPoints / gpaEligibleCredits) : null;
  const finalizedSemesters = semesters.filter((s) => s.semesterGpa !== null);
  const latestSem = finalizedSemesters[finalizedSemesters.length - 1] ?? null;

  const remainingCreditsToGraduation = Math.max(0, totalRequiredCredits - earnedCredits);
  const completionPercentage =
    totalRequiredCredits > 0
      ? Math.min(100, Number(((earnedCredits / totalRequiredCredits) * 100).toFixed(2)))
      : 0;

  return {
    cgpa,
    latestSemesterGpa: latestSem ? latestSem.semesterGpa : null,
    latestSemesterLabel: latestSem ? `${latestSem.semester} (${latestSem.academic_year})` : null,
    gpaEligibleCredits,
    totalWeightedPoints: roundGpa(totalWeightedPoints),
    earnedCredits,
    failedCredits,
    inProgressCredits,
    totalRequiredCredits,
    remainingCreditsToGraduation,
    completionPercentage,
    totalCoursesCount: enriched.length,
    completedCoursesCount: passedCourseCodes.size,
    inProgressCoursesCount,
    failedCoursesCount: retakeRequiredCourses.length,
    retakeRequiredCourses,
    classification: getClassificationForGpa(cgpa, classificationBands),
    semesters,
    breakdown,
  };
}

export interface TargetGpaCalculationInput {
  currentCgpa: number;
  currentCredits: number;
  targetCgpa: number;
  futureCredits: number;
}

export interface TargetGpaCalculationResult {
  valid: boolean;
  errorMessage?: string;
  currentCgpa: number;
  currentCredits: number;
  targetCgpa: number;
  futureCredits: number;
  requiredFutureGpa: number | null;
  projectedFinalCgpa: number | null;
  feasibilityStatus: 'achieved' | 'achievable' | 'challenging' | 'impossible' | 'invalid';
  statusTitle: string;
  explanation: string;
}

export function calculateTargetGpaPlan(
  input: TargetGpaCalculationInput
): TargetGpaCalculationResult {
  const { currentCgpa, currentCredits, targetCgpa, futureCredits } = input;

  if (
    Number.isNaN(currentCgpa) ||
    Number.isNaN(currentCredits) ||
    Number.isNaN(targetCgpa) ||
    Number.isNaN(futureCredits)
  ) {
    return {
      valid: false,
      errorMessage: 'Vui lòng nhập đầy đủ giá trị số hợp lệ.',
      currentCgpa,
      currentCredits,
      targetCgpa,
      futureCredits,
      requiredFutureGpa: null,
      projectedFinalCgpa: null,
      feasibilityStatus: 'invalid',
      statusTitle: 'Dữ liệu chưa hợp lệ',
      explanation: 'Các giá trị GPA và số tín chỉ phải là số hợp lệ.',
    };
  }

  if (currentCgpa < 0 || currentCgpa > 4.0 || targetCgpa < 0 || targetCgpa > 4.0) {
    return {
      valid: false,
      errorMessage: 'Giá trị GPA phải nằm trong khoảng từ 0.00 đến 4.00.',
      currentCgpa,
      currentCredits,
      targetCgpa,
      futureCredits,
      requiredFutureGpa: null,
      projectedFinalCgpa: null,
      feasibilityStatus: 'invalid',
      statusTitle: 'GPA vượt ngoài thang điểm 4.00',
      explanation: 'GPA hiện tại và GPA mục tiêu phải nằm trong thang điểm 0.00 – 4.00.',
    };
  }

  if (currentCredits < 0 || futureCredits < 0) {
    return {
      valid: false,
      errorMessage: 'Số tín chỉ không được mang giá trị âm.',
      currentCgpa,
      currentCredits,
      targetCgpa,
      futureCredits,
      requiredFutureGpa: null,
      projectedFinalCgpa: null,
      feasibilityStatus: 'invalid',
      statusTitle: 'Số tín chỉ không hợp lệ',
      explanation: 'Số tín chỉ đã tích lũy và tín chỉ dự kiến phải lớn hơn hoặc bằng 0.',
    };
  }

  if (futureCredits === 0) {
    return {
      valid: false,
      errorMessage: 'Số tín chỉ dự kiến trong tương lai phải lớn hơn 0 để lập kế hoạch.',
      currentCgpa,
      currentCredits,
      targetCgpa,
      futureCredits,
      requiredFutureGpa: null,
      projectedFinalCgpa: null,
      feasibilityStatus: 'invalid',
      statusTitle: 'Chưa có tín chỉ tương lai',
      explanation: 'Cần tối thiểu 1 tín chỉ dự kiến để tính GPA trung bình cần đạt.',
    };
  }

  const totalCredits = currentCredits + futureCredits;
  const requiredRaw = (targetCgpa * totalCredits - currentCgpa * currentCredits) / futureCredits;
  const requiredRounded = roundGpa(requiredRaw);

  if (requiredRaw > 4.0) {
    const maxPossible = roundGpa((currentCgpa * currentCredits + 4.0 * futureCredits) / totalCredits);
    return {
      valid: true,
      currentCgpa,
      currentCredits,
      targetCgpa,
      futureCredits,
      requiredFutureGpa: requiredRounded,
      projectedFinalCgpa: maxPossible,
      feasibilityStatus: 'impossible',
      statusTitle: 'Mục tiêu không khả thi về mặt toán học',
      explanation: `Để đạt GPA tích lũy ${targetCgpa.toFixed(2)}, bạn cần đạt trung bình ${requiredRounded.toFixed(2)} trong ${futureCredits} tín chỉ sắp tới — vượt quá mức tối đa 4.00. Ngay cả khi đạt 4.00 ở tất cả học phần còn lại, GPA tối đa có thể đạt là ${maxPossible.toFixed(2)}.`,
    };
  }

  if (currentCgpa >= targetCgpa && requiredRaw <= currentCgpa) {
    const clampedReq = Math.max(0, requiredRounded);
    return {
      valid: true,
      currentCgpa,
      currentCredits,
      targetCgpa,
      futureCredits,
      requiredFutureGpa: clampedReq,
      projectedFinalCgpa: roundGpa(targetCgpa),
      feasibilityStatus: 'achieved',
      statusTitle: 'Đã đạt mức GPA mục tiêu',
      explanation: `GPA hiện tại (${currentCgpa.toFixed(2)}) đã đạt hoặc vượt mục tiêu ${targetCgpa.toFixed(2)}. Bạn chỉ cần duy trì trung bình tối thiểu ${clampedReq.toFixed(2)} trong ${futureCredits} tín chỉ tiếp theo.`,
    };
  }

  if (requiredRaw >= 3.5) {
    return {
      valid: true,
      currentCgpa,
      currentCredits,
      targetCgpa,
      futureCredits,
      requiredFutureGpa: requiredRounded,
      projectedFinalCgpa: roundGpa(targetCgpa),
      feasibilityStatus: 'challenging',
      statusTitle: 'Mục tiêu đầy thử thách',
      explanation: `Bạn cần đạt GPA trung bình ${requiredRounded.toFixed(2)} trong ${futureCredits} tín chỉ sắp tới (chủ yếu điểm A- và A) để chạm mốc ${targetCgpa.toFixed(2)}.`,
    };
  }

  return {
    valid: true,
    currentCgpa,
    currentCredits,
    targetCgpa,
    futureCredits,
    requiredFutureGpa: Math.max(0, requiredRounded),
    projectedFinalCgpa: roundGpa(targetCgpa),
    feasibilityStatus: 'achievable',
    statusTitle: 'Mục tiêu hoàn toàn khả thi',
    explanation: `Bạn cần đạt GPA trung bình ${Math.max(0, requiredRounded).toFixed(2)} trong ${futureCredits} tín chỉ sắp tới để đạt mục tiêu GPA ${targetCgpa.toFixed(2)}.`,
  };
}

export function evaluateStudentWarnings(
  student: StudentProfile,
  summary: StudentAcademicSummary,
  thresholds: WarningThresholds
): WarningEvaluationCandidate[] {
  const candidates: WarningEvaluationCandidate[] = [];
  const latestSemObj = summary.semesters[summary.semesters.length - 1];
  const latestFinalizedSemObj = [...summary.semesters]
    .reverse()
    .find((s) => s.semesterGpa !== null);
  const latestYear =
    latestFinalizedSemObj?.academic_year ??
    latestSemObj?.academic_year ??
    `${student.enrollment_year}-${student.enrollment_year + 1}`;
  const latestSemester =
    latestFinalizedSemObj?.semester ?? latestSemObj?.semester ?? 'Học kỳ 1';

  if (
    summary.cgpa !== null &&
    summary.gpaEligibleCredits > 0 &&
    summary.cgpa < thresholds.lowCgpaThreshold
  ) {
    const isCritical = summary.cgpa < thresholds.criticalCgpaThreshold;
    candidates.push({
      warning_type: 'LOW_GPA',
      warning_title: isCritical
        ? 'Cảnh báo GPA tích lũy ở mức nghiêm trọng'
        : 'GPA tích lũy thấp hơn ngưỡng chuẩn',
      description: `GPA tích lũy hiện tại của bạn là ${summary.cgpa.toFixed(2)}, thấp hơn ngưỡng tối thiểu ${thresholds.lowCgpaThreshold.toFixed(2)} theo quy chế trường.`,
      triggering_condition: `GPA tích lũy (${summary.cgpa.toFixed(2)}) < ${thresholds.lowCgpaThreshold.toFixed(2)}`,
      severity: isCritical ? 'Critical' : 'High',
      suggested_action:
        'Rà soát lại kết quả các học phần điểm thấp, trao đổi với cố vấn học tập và lập kế hoạch học cải thiện điểm.',
      academic_year: latestYear,
      semester: latestSemester,
    });
  }

  if (summary.failedCredits >= thresholds.failedCreditsThreshold) {
    const isCritical = summary.failedCredits >= thresholds.criticalFailedCreditsThreshold;
    candidates.push({
      warning_type: 'FAILED_CREDITS',
      warning_title: 'Số tín chỉ chưa đạt vượt ngưỡng quy định',
      description: `Bạn đang tích lũy ${summary.failedCredits} tín chỉ chưa đạt chưa được học cải thiện, vượt ngưỡng cảnh báo ${thresholds.failedCreditsThreshold} tín chỉ.`,
      triggering_condition: `Tín chỉ chưa đạt (${summary.failedCredits}) >= ${thresholds.failedCreditsThreshold}`,
      severity: isCritical ? 'Critical' : 'High',
      suggested_action:
        'Ưu tiên đăng ký học lại các học phần bắt buộc chưa đạt để thay thế điểm theo quy chế đào tạo.',
      academic_year: latestYear,
      semester: latestSemester,
    });
  }

  if (
    summary.latestSemesterGpa !== null &&
    summary.latestSemesterGpa < thresholds.lowSemesterGpaThreshold
  ) {
    const isHigh = summary.latestSemesterGpa < 1.5;
    candidates.push({
      warning_type: 'LOW_SEMESTER_GPA',
      warning_title: 'Điểm GPA học kỳ gần nhất giảm thấp',
      description: `Học kỳ hoàn thành gần nhất (${summary.latestSemesterLabel}) có GPA là ${summary.latestSemesterGpa.toFixed(2)}, dưới mức chuẩn ${thresholds.lowSemesterGpaThreshold.toFixed(2)}.`,
      triggering_condition: `GPA học kỳ (${summary.latestSemesterGpa.toFixed(2)}) < ${thresholds.lowSemesterGpaThreshold.toFixed(2)}`,
      severity: isHigh ? 'High' : 'Medium',
      suggested_action:
        'Điều chỉnh khối lượng tín chỉ đăng ký kỳ tới hợp lý hơn và tận dụng tài nguyên phụ đạo học tập.',
      academic_year: latestFinalizedSemObj?.academic_year ?? latestYear,
      semester: latestFinalizedSemObj?.semester ?? latestSemester,
    });
  }

  const repeatedFailed = summary.retakeRequiredCourses.filter((c) => c.failedAttempts >= 2);
  if (repeatedFailed.length > 0) {
    const codes = repeatedFailed.map((c) => `${c.course_code} (${c.failedAttempts} lần)`).join(', ');
    candidates.push({
      warning_type: 'REPEATED_FAILED_COURSES',
      warning_title: 'Học phần học lại nhiều lần chưa đạt',
      description: `Sinh viên có học phần chưa đạt từ 2 lần trở lên: ${codes}. Cần gặp cố vấn học tập để xây dựng phương án học bù và phụ đạo.`,
      triggering_condition: `Học phần trượt lặp lại >= 2 lần (${repeatedFailed.length} môn)`,
      severity: repeatedFailed.some((c) => c.failedAttempts >= 3) ? 'Critical' : 'High',
      suggested_action:
        'Đăng ký tham gia lớp phụ đạo chuyên môn và hoàn tất học phần này trong học kỳ kế tiếp hoặc học kỳ hè.',
      academic_year: repeatedFailed[0].lastAcademicYear,
      semester: repeatedFailed[0].lastSemester,
    });
  }

  const completedSemestersCount = summary.semesters.filter((s) => s.semesterGpa !== null).length;
  if (completedSemestersCount >= 2 && student.expected_credits_per_semester > 0) {
    const expectedCredits = completedSemestersCount * student.expected_credits_per_semester;
    const minimumExpected = Math.round(expectedCredits * thresholds.progressBehindRatio);
    if (summary.earnedCredits < minimumExpected) {
      candidates.push({
        warning_type: 'ACADEMIC_PROGRESS',
        warning_title: 'Tiến độ tích lũy tín chỉ chậm so với kế hoạch',
        description: `Bạn mới tích lũy ${summary.earnedCredits} tín chỉ sau ${completedSemestersCount} học kỳ, thấp hơn mức kỳ vọng ${expectedCredits} tín chỉ (tối thiểu ${minimumExpected}).`,
        triggering_condition: `Tín chỉ đạt (${summary.earnedCredits}) < ${Math.round(thresholds.progressBehindRatio * 100)}% tiến độ chuẩn (${expectedCredits})`,
        severity: 'Medium',
        suggested_action:
          'Đăng ký bổ sung học phần trong học kỳ hè hoặc trao đổi với cố vấn để đảm bảo tiến độ tốt nghiệp đúng hạn.',
        academic_year: latestYear,
        semester: latestSemester,
      });
    }
  }

  return candidates;
}

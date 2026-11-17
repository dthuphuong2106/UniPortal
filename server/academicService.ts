import crypto from 'crypto';
import { db } from './db.ts';
import {
  AcademicReportRecord,
  AcademicReportType,
  AcademicSettingsBundle,
  AcademicWarningRecord,
  AcademicYearRecord,
  AssessmentWeightsConfig,
  calculateStudentAcademicSummary,
  ClassificationBand,
  ClassSectionRecord,
  CompletionStatus,
  DEFAULT_ASSESSMENT_WEIGHTS,
  DEFAULT_CLASSIFICATION_BANDS,
  DEFAULT_GPA_POLICY,
  DEFAULT_GRADING_SCALE,
  DEFAULT_TUITION_CONFIG,
  DEFAULT_WARNING_THRESHOLDS,
  EnrollmentRecord,
  evaluateStudentWarnings,
  GpaPolicySettings,
  GradeApprovalRecord,
  GradeChangeLogRecord,
  GradeScaleEntry,
  GradeSubmissionRecord,
  LecturerProfile,
  SemesterRecord,
  StudentAcademicSummary,
  StudentProfile,
  StudentTuitionInvoice,
  TuitionConfig,
  TuitionPaymentRecord,
  WarningThresholds,
  buildStudentTuitionInvoices,
} from '../shared/academicLogic.ts';

export function getAcademicTerms(): {
  years: AcademicYearRecord[];
  semesters: SemesterRecord[];
} {
  const years = db
    .prepare('SELECT year_id, year_code, year_name, start_year, end_year, is_active FROM academic_years ORDER BY start_year ASC')
    .all() as AcademicYearRecord[];
  const semesters = db
    .prepare(
      'SELECT semester_id, year_id, academic_year, semester_code, semester_name, sort_order, is_active FROM semesters ORDER BY academic_year ASC, sort_order ASC'
    )
    .all() as SemesterRecord[];
  return { years, semesters };
}

export function getAcademicSettings(): AcademicSettingsBundle {
  const rows = db.prepare('SELECT setting_name, setting_value FROM academic_settings').all() as Array<{
    setting_name: string;
    setting_value: string;
  }>;
  const map = new Map(rows.map((r) => [r.setting_name, r.setting_value]));

  const parseJson = <T>(key: string, fallback: T): T => {
    const raw = map.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const rawScale = parseJson<GradeScaleEntry[]>('grading_scale', DEFAULT_GRADING_SCALE);
  const hasLegacyScale =
    !Array.isArray(rawScale) ||
    rawScale.length === 0 ||
    rawScale.some((item) => Number(item.maxNumeric ?? 0) > 10 || item.letter === 'A-' || item.letter === 'B-');

  return {
    gradingScale: hasLegacyScale ? DEFAULT_GRADING_SCALE : rawScale,
    classificationBands: parseJson<ClassificationBand[]>('classification_bands', DEFAULT_CLASSIFICATION_BANDS),
    warningThresholds: parseJson<WarningThresholds>('warning_thresholds', DEFAULT_WARNING_THRESHOLDS),
    gpaPolicy: parseJson<GpaPolicySettings>('gpa_policy', DEFAULT_GPA_POLICY),
    assessmentWeights: parseJson<AssessmentWeightsConfig>('assessment_weights', DEFAULT_ASSESSMENT_WEIGHTS),
  };
}

export function getStudentById(studentId: string): StudentProfile | undefined {
  return db.prepare('SELECT * FROM students WHERE student_id = ?').get(studentId) as StudentProfile | undefined;
}

export function getStudentByUserId(userId: string): StudentProfile | undefined {
  return db.prepare('SELECT * FROM students WHERE user_id = ?').get(userId) as StudentProfile | undefined;
}

export function getLecturerById(lecturerId: string): LecturerProfile | undefined {
  return db.prepare('SELECT * FROM lecturers WHERE lecturer_id = ?').get(lecturerId) as LecturerProfile | undefined;
}

export function getLecturerByUserId(userId: string): LecturerProfile | undefined {
  return db.prepare('SELECT * FROM lecturers WHERE user_id = ?').get(userId) as LecturerProfile | undefined;
}

export function getAllLecturers(): LecturerProfile[] {
  return db
    .prepare('SELECT * FROM lecturers ORDER BY full_name ASC')
    .all() as LecturerProfile[];
}

export function getStudentEnrollments(
  studentId: string,
  options?: { maskUnofficial?: boolean }
): EnrollmentRecord[] {
  const rows = db
    .prepare(
      `SELECT e.*, c.course_code, c.course_name, c.credit_hours, c.department, cs.section_code
       FROM enrollments e
       JOIN courses c ON e.course_id = c.course_id
       LEFT JOIN class_sections cs ON e.section_id = cs.section_id
       WHERE e.student_id = ?`
    )
    .all(studentId) as EnrollmentRecord[];

  if (!options?.maskUnofficial) {
    return rows;
  }

  return rows.map((row) => {
    if (row.is_official === 0) {
      return {
        ...row,
        attendance_score: null,
        assignment_score: null,
        midterm_score: null,
        final_score: null,
        letter_grade: null,
        numeric_grade: null,
        grade_point: null,
        completion_status: 'In Progress' as CompletionStatus,
      };
    }
    return row;
  });
}

export function getClassSections(filters?: {
  lecturerId?: string;
  semesterId?: string;
  academicYear?: string;
  gradeStatus?: string;
}): ClassSectionRecord[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters?.lecturerId) {
    clauses.push('cs.lecturer_id = ?');
    params.push(filters.lecturerId);
  }
  if (filters?.semesterId) {
    clauses.push('cs.semester_id = ?');
    params.push(filters.semesterId);
  }
  if (filters?.academicYear) {
    clauses.push('cs.academic_year = ?');
    params.push(filters.academicYear);
  }
  if (filters?.gradeStatus) {
    clauses.push('cs.grade_status = ?');
    params.push(filters.gradeStatus);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT
        cs.section_id,
        cs.section_code,
        cs.course_id,
        c.course_code,
        c.course_name,
        c.credit_hours,
        c.department,
        cs.semester_id,
        cs.semester,
        cs.academic_year,
        cs.lecturer_id,
        l.full_name as lecturer_name,
        l.email as lecturer_email,
        cs.schedule_info,
        cs.max_students,
        cs.submission_deadline,
        cs.grade_status,
        cs.is_active,
        COUNT(e.enrollment_id) as enrolled_count,
        SUM(CASE WHEN e.final_score IS NOT NULL OR e.letter_grade IS NOT NULL THEN 1 ELSE 0 END) as graded_count,
        SUM(CASE WHEN e.enrollment_id IS NOT NULL AND e.final_score IS NULL AND e.letter_grade IS NULL THEN 1 ELSE 0 END) as ungraded_count,
        SUM(CASE WHEN e.completion_status = 'Completed' THEN 1 ELSE 0 END) as passed_count,
        SUM(CASE WHEN e.completion_status = 'Failed' THEN 1 ELSE 0 END) as failed_count,
        (SELECT gs.submitted_at FROM grade_submissions gs WHERE gs.section_id = cs.section_id ORDER BY gs.submitted_at DESC LIMIT 1) as latest_submission_at,
        (SELECT ga.reason FROM grade_approvals ga WHERE ga.section_id = cs.section_id ORDER BY ga.reviewed_at DESC LIMIT 1) as latest_review_reason
      FROM class_sections cs
      JOIN courses c ON cs.course_id = c.course_id
      LEFT JOIN lecturers l ON cs.lecturer_id = l.lecturer_id
      LEFT JOIN enrollments e ON e.section_id = cs.section_id
      ${whereSql}
      GROUP BY cs.section_id
      ORDER BY cs.academic_year DESC, cs.semester DESC, cs.section_code ASC`
    )
    .all(...params) as Array<ClassSectionRecord>;

  return rows.map((r) => ({
    ...r,
    enrolled_count: Number(r.enrolled_count ?? 0),
    graded_count: Number(r.graded_count ?? 0),
    ungraded_count: Number(r.ungraded_count ?? 0),
    passed_count: Number(r.passed_count ?? 0),
    failed_count: Number(r.failed_count ?? 0),
  }));
}

export function getSectionDetail(sectionId: string): {
  section: ClassSectionRecord;
  enrollments: EnrollmentRecord[];
  submissions: GradeSubmissionRecord[];
  approvals: GradeApprovalRecord[];
  changeLogs: GradeChangeLogRecord[];
  settings: AcademicSettingsBundle;
} | null {
  const sections = getClassSections();
  const section = sections.find((s) => s.section_id === sectionId);
  if (!section) return null;

  const enrollments = db
    .prepare(
      `SELECT e.*, s.full_name as student_name, s.major as student_major,
              c.course_code, c.course_name, c.credit_hours, c.department, cs.section_code
       FROM enrollments e
       JOIN students s ON e.student_id = s.student_id
       JOIN courses c ON e.course_id = c.course_id
       LEFT JOIN class_sections cs ON e.section_id = cs.section_id
       WHERE e.section_id = ?
       ORDER BY s.student_id ASC`
    )
    .all(sectionId) as EnrollmentRecord[];

  const submissions = db
    .prepare(
      `SELECT gs.*, cs.section_code, c.course_code, c.course_name, cs.semester, cs.academic_year, l.full_name as lecturer_name
       FROM grade_submissions gs
       JOIN class_sections cs ON gs.section_id = cs.section_id
       JOIN courses c ON cs.course_id = c.course_id
       JOIN lecturers l ON gs.lecturer_id = l.lecturer_id
       WHERE gs.section_id = ?
       ORDER BY gs.submitted_at DESC`
    )
    .all(sectionId) as GradeSubmissionRecord[];

  const approvals = db
    .prepare(
      `SELECT * FROM grade_approvals
       WHERE section_id = ?
       ORDER BY reviewed_at DESC`
    )
    .all(sectionId) as GradeApprovalRecord[];

  const changeLogs = db
    .prepare(
      `SELECT * FROM grade_change_logs
       WHERE section_id = ?
       ORDER BY changed_at DESC
       LIMIT 100`
    )
    .all(sectionId) as GradeChangeLogRecord[];

  return {
    section,
    enrollments,
    submissions,
    approvals,
    changeLogs,
    settings: getAcademicSettings(),
  };
}

export function logAcademicActivity(
  studentId: string | null,
  actorUserId: string,
  activityType: string,
  description: string
): void {
  const id = `ACT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  db.prepare(
    `INSERT INTO academic_activities (activity_id, student_id, actor_user_id, activity_type, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, studentId, actorUserId, activityType, description, new Date().toISOString());
}

/**
 * Recalculates grade_records, gpa_records, evaluates academic_warnings without duplicating
 * active warnings for the same rule, and updates the student's academic_status.
 */
export function syncStudentDerivedRecords(studentId: string): StudentAcademicSummary | null {
  const student = getStudentById(studentId);
  if (!student) return null;

  const settings = getAcademicSettings();
  const enrollments = getStudentEnrollments(studentId);
  const summary = calculateStudentAcademicSummary(
    enrollments,
    settings,
    student.total_required_credits
  );
  const now = new Date().toISOString();

  const syncTransaction = db.transaction(() => {
    // 0. Keep grade_records synchronized with finalized/official enrollments
    db.prepare('DELETE FROM grade_records WHERE student_id = ?').run(studentId);
    const insertGrade = db.prepare(
      `INSERT INTO grade_records (
        grade_id, enrollment_id, student_id, course_id, letter_grade, numeric_grade, grade_point, is_final, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const e of enrollments) {
      const isOfficial = e.is_official !== 0;
      const isFinal =
        isOfficial && (e.completion_status === 'Completed' || e.completion_status === 'Failed')
          ? 1
          : 0;
      insertGrade.run(
        `GRD-${e.enrollment_id}`,
        e.enrollment_id,
        studentId,
        e.course_id,
        isOfficial ? e.letter_grade : null,
        isOfficial ? e.numeric_grade : null,
        isOfficial ? e.grade_point : null,
        isFinal,
        e.updated_at || now
      );
    }

    // 1. Rebuild GPA_Records for this student from official source enrollments
    db.prepare('DELETE FROM gpa_records WHERE student_id = ?').run(studentId);
    const insertGpa = db.prepare(
      `INSERT INTO gpa_records (
        gpa_id, student_id, semester, academic_year, semester_gpa, cumulative_gpa,
        semester_credits, earned_credits, calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const sem of summary.semesters) {
      insertGpa.run(
        `GPA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        studentId,
        sem.semester,
        sem.academic_year,
        sem.semesterGpa,
        sem.cumulativeGpa,
        sem.semesterGpaCredits,
        sem.earnedCredits,
        now
      );
    }

    // 2. Evaluate Academic Warnings against actual records (no duplicate active warnings)
    const candidates = evaluateStudentWarnings(student, summary, settings.warningThresholds);
    const existingWarnings = db
      .prepare('SELECT * FROM academic_warnings WHERE student_id = ?')
      .all(studentId) as AcademicWarningRecord[];

    const candidateByType = new Map(candidates.map((c) => [c.warning_type, c]));

    // Update or resolve existing non-resolved warnings
    for (const existing of existingWarnings) {
      if (existing.warning_status === 'Resolved') continue;
      const match = candidateByType.get(existing.warning_type);
      if (match) {
        db.prepare(
          `UPDATE academic_warnings
           SET warning_title = ?, description = ?, triggering_condition = ?,
               severity = ?, suggested_action = ?, academic_year = ?, semester = ?
           WHERE warning_id = ?`
        ).run(
          match.warning_title,
          match.description,
          match.triggering_condition,
          match.severity,
          match.suggested_action,
          match.academic_year,
          match.semester,
          existing.warning_id
        );
        candidateByType.delete(existing.warning_type);
      } else {
        db.prepare(
          `UPDATE academic_warnings SET warning_status = 'Resolved' WHERE warning_id = ?`
        ).run(existing.warning_id);
      }
    }

    // Insert newly triggered warnings
    const insertWarning = db.prepare(
      `INSERT INTO academic_warnings (
        warning_id, student_id, warning_type, warning_title, description,
        triggering_condition, severity, warning_status, suggested_action,
        academic_year, semester, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)`
    );

    for (const candidate of candidateByType.values()) {
      insertWarning.run(
        `WRN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        studentId,
        candidate.warning_type,
        candidate.warning_title,
        candidate.description,
        candidate.triggering_condition,
        candidate.severity,
        candidate.suggested_action,
        candidate.academic_year,
        candidate.semester,
        now
      );
    }

    // 3. Keep academic_status synchronized unless explicitly Graduated
    if (student.academic_status !== 'Graduated') {
      let nextStatus = 'Active';
      if (candidates.some((c) => c.severity === 'Critical')) {
        nextStatus = 'Academic Probation';
      } else if (candidates.length > 0) {
        nextStatus = 'Warning';
      }
      if (nextStatus !== student.academic_status) {
        db.prepare('UPDATE students SET academic_status = ? WHERE student_id = ?').run(
          nextStatus,
          studentId
        );
      }
    }
  });

  syncTransaction();
  return summary;
}

export function recalculateAllStudents(): void {
  const students = db.prepare('SELECT student_id FROM students').all() as Array<{ student_id: string }>;
  for (const s of students) {
    syncStudentDerivedRecords(s.student_id);
  }
}

export function getStudentReports(studentId: string): {
  reports: AcademicReportRecord[];
  unreadReportsCount: number;
} {
  const rows = db
    .prepare(
      `SELECT
         r.report_id,
         r.student_id,
         r.title,
         r.report_type,
         r.semester,
         r.academic_year,
         r.summary,
         r.content,
         r.created_at,
         CASE WHEN sr.read_at IS NOT NULL THEN 1 ELSE 0 END as is_read_int,
         sr.read_at as read_at
       FROM academic_reports r
       LEFT JOIN student_report_reads sr
         ON sr.report_id = r.report_id AND sr.student_id = ?
       WHERE r.student_id IS NULL OR r.student_id = ?
       ORDER BY (sr.read_at IS NOT NULL) ASC, r.created_at DESC`
    )
    .all(studentId, studentId) as Array<{
    report_id: string;
    student_id: string | null;
    title: string;
    report_type: AcademicReportType;
    semester: string;
    academic_year: string;
    summary: string;
    content: string;
    created_at: string;
    is_read_int: number;
    read_at: string | null;
  }>;

  const reports: AcademicReportRecord[] = rows.map((row) => ({
    report_id: row.report_id,
    student_id: row.student_id,
    title: row.title,
    report_type: row.report_type,
    semester: row.semester,
    academic_year: row.academic_year,
    summary: row.summary,
    content: row.content,
    created_at: row.created_at,
    is_read: row.is_read_int === 1,
    read_at: row.read_at ?? null,
  }));

  const unreadReportsCount = reports.filter((r) => !r.is_read).length;
  return { reports, unreadReportsCount };
}

export function markStudentReportRead(
  studentId: string,
  reportId: string,
  actorUserId?: string
): { report: AcademicReportRecord; unreadReportsCount: number } | null {
  const targetReport = db
    .prepare(
      `SELECT report_id, student_id, title
       FROM academic_reports
       WHERE report_id = ? AND (student_id IS NULL OR student_id = ?)`
    )
    .get(reportId, studentId) as { report_id: string; student_id: string | null; title: string } | undefined;

  if (!targetReport) {
    return null;
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO student_report_reads (read_id, student_id, report_id, read_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(`RDR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, studentId, reportId, now);

  if (result.changes > 0 && actorUserId) {
    logAcademicActivity(
      studentId,
      actorUserId,
      'ĐÃ ĐỌC BÁO CÁO',
      `Đã xác nhận đọc báo cáo học vụ: ${targetReport.title}.`
    );
  }

  const { reports, unreadReportsCount } = getStudentReports(studentId);
  const updated = reports.find((r) => r.report_id === reportId);
  if (!updated) return null;
  return { report: updated, unreadReportsCount };
}

// --- TUITION & QR PAYMENT SERVICE ---

export function getTuitionConfig(): TuitionConfig {
  const row = db
    .prepare("SELECT setting_value, updated_at FROM academic_settings WHERE setting_name = 'tuition_config'")
    .get() as { setting_value: string; updated_at: string } | undefined;

  if (!row) {
    return { ...DEFAULT_TUITION_CONFIG };
  }

  try {
    const parsed = JSON.parse(row.setting_value) as Partial<TuitionConfig>;
    return {
      pricePerCredit:
        Number.isInteger(parsed.pricePerCredit) && (parsed.pricePerCredit ?? 0) > 0
          ? Number(parsed.pricePerCredit)
          : DEFAULT_TUITION_CONFIG.pricePerCredit,
      debtAlertThreshold:
        Number.isInteger(parsed.debtAlertThreshold) && (parsed.debtAlertThreshold ?? -1) >= 0
          ? Number(parsed.debtAlertThreshold)
          : DEFAULT_TUITION_CONFIG.debtAlertThreshold,
      bankName: parsed.bankName?.trim() || DEFAULT_TUITION_CONFIG.bankName,
      accountNumber: parsed.accountNumber?.trim() || DEFAULT_TUITION_CONFIG.accountNumber,
      accountHolder: parsed.accountHolder?.trim() || DEFAULT_TUITION_CONFIG.accountHolder,
      transferNotePrefix:
        parsed.transferNotePrefix?.trim() || DEFAULT_TUITION_CONFIG.transferNotePrefix,
      qrImageDataUrl:
        typeof parsed.qrImageDataUrl === 'string' && parsed.qrImageDataUrl.startsWith('data:image/')
          ? parsed.qrImageDataUrl
          : null,
      updatedAt: parsed.updatedAt || row.updated_at,
    };
  } catch {
    return { ...DEFAULT_TUITION_CONFIG };
  }
}

export function getStudentTuitionOverview(studentId: string): {
  config: TuitionConfig;
  invoices: StudentTuitionInvoice[];
  payments: TuitionPaymentRecord[];
  summary: {
    totalBilled: number;
    totalPaid: number;
    totalUnpaid: number;
    paidCount: number;
    unpaidCount: number;
    totalBillableCredits: number;
    debtAlertThreshold: number;
    isDebtOverThreshold: boolean;
  };
} {
  const config = getTuitionConfig();
  const enrollments = getStudentEnrollments(studentId);
  const payments = db
    .prepare(
      `SELECT p.*, s.full_name as student_name, s.major as student_major
       FROM tuition_payments p
       JOIN students s ON p.student_id = s.student_id
       WHERE p.student_id = ?
       ORDER BY p.paid_at DESC`
    )
    .all(studentId) as TuitionPaymentRecord[];

  const invoices = buildStudentTuitionInvoices(studentId, enrollments, payments, config);
  const totalBilled = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPaid = invoices
    .filter((inv) => inv.status === 'PAID')
    .reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalUnpaid = Math.max(0, totalBilled - totalPaid);
  const paidCount = invoices.filter((inv) => inv.status === 'PAID').length;
  const unpaidCount = invoices.filter((inv) => inv.status === 'UNPAID').length;
  const totalBillableCredits = invoices.reduce((sum, inv) => sum + inv.totalCredits, 0);
  const debtAlertThreshold = config.debtAlertThreshold;
  const isDebtOverThreshold = totalUnpaid > debtAlertThreshold;

  return {
    config,
    invoices,
    payments,
    summary: {
      totalBilled,
      totalPaid,
      totalUnpaid,
      paidCount,
      unpaidCount,
      totalBillableCredits,
      debtAlertThreshold,
      isDebtOverThreshold,
    },
  };
}

export function getTrainingTuitionOverview(): {
  config: TuitionConfig;
  payments: TuitionPaymentRecord[];
  studentSummaries: Array<{
    student_id: string;
    full_name: string;
    major: string;
    totalCredits: number;
    totalBilled: number;
    totalPaid: number;
    totalUnpaid: number;
    unpaidSemestersCount: number;
    latestUnpaidLabel: string | null;
  }>;
  totals: {
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
    totalTransactions: number;
  };
} {
  const config = getTuitionConfig();
  const students = db
    .prepare('SELECT student_id, full_name, major FROM students ORDER BY student_id ASC')
    .all() as Array<{ student_id: string; full_name: string; major: string }>;

  const payments = db
    .prepare(
      `SELECT p.*, s.full_name as student_name, s.major as student_major
       FROM tuition_payments p
       JOIN students s ON p.student_id = s.student_id
       ORDER BY p.paid_at DESC`
    )
    .all() as TuitionPaymentRecord[];

  const studentSummaries = students.map((stu) => {
    const overview = getStudentTuitionOverview(stu.student_id);
    const unpaidInvoices = overview.invoices.filter((inv) => inv.status === 'UNPAID');
    const latestUnpaid = unpaidInvoices[unpaidInvoices.length - 1] ?? null;

    return {
      student_id: stu.student_id,
      full_name: stu.full_name,
      major: stu.major,
      totalCredits: overview.summary.totalBillableCredits,
      totalBilled: overview.summary.totalBilled,
      totalPaid: overview.summary.totalPaid,
      totalUnpaid: overview.summary.totalUnpaid,
      unpaidSemestersCount: unpaidInvoices.length,
      latestUnpaidLabel: latestUnpaid
        ? `${latestUnpaid.semester} (${latestUnpaid.academic_year})`
        : null,
    };
  });

  const totalBilled = studentSummaries.reduce((sum, s) => sum + s.totalBilled, 0);
  const totalCollected = studentSummaries.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalOutstanding = Math.max(0, totalBilled - totalCollected);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

  return {
    config,
    payments,
    studentSummaries,
    totals: {
      totalBilled,
      totalCollected,
      totalOutstanding,
      collectionRate,
      totalTransactions: payments.length,
    },
  };
}



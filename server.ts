import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  db,
  getJwtSecret,
  initializeDatabaseSchema,
  resolveOrCreateSemesterId,
  seedDatabaseIfEmpty,
} from './server/db.ts';
import {
  getAcademicSettings,
  getAcademicTerms,
  getAllLecturers,
  getClassSections,
  getLecturerById,
  getLecturerByUserId,
  getSectionDetail,
  getStudentById,
  getStudentByUserId,
  getStudentEnrollments,
  getStudentReports,
  getStudentTuitionOverview,
  getTrainingTuitionOverview,
  getTuitionConfig,
  logAcademicActivity,
  markStudentReportRead,
  recalculateAllStudents,
  syncStudentDerivedRecords,
} from './server/academicService.ts';
import {
  AcademicWarningRecord,
  AssessmentWeightsConfig,
  calculateStudentAcademicSummary,
  CompletionStatus,
  computeWeightedNumericGrade,
  GradeApprovalRecord,
  GradeSubmissionRecord,
  isValidIntegerCredit,
  LecturerProfile,
  normalizeUserRole,
  resolveGradeFromScale,
  resolveLetterFromNumeric,
  StudentProfile,
  TuitionConfig,
  TuitionPaymentRecord,
  UserRole,
  buildTuitionTransferNote,
  validateCourseCredit,
  validateScoreOnTenScale,
} from './shared/academicLogic.ts';

interface AuthTokenPayload {
  user_id: string;
  role: UserRole;
  student_id: string | null;
  lecturer_id: string | null;
}

interface AuthenticatedRequest extends Request {
  authUser?: {
    user_id: string;
    username: string;
    email: string;
    role: UserRole;
    display_name: string;
    avatar_url: string;
    student_id: string | null;
    lecturer_id: string | null;
  };
}

const COOKIE_NAME = 'uniportal_session';
const LEGACY_COOKIE_NAMES = ['studyflow_session', 'meridian_session'];
const JWT_SECRET = getJwtSecret();

// Initialize DB & seed demo accounts/records on boot
initializeDatabaseSchema();
seedDatabaseIfEmpty();
recalculateAllStudents();
db.pragma('wal_checkpoint(TRUNCATE)');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

function isRequestHttps(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const https = isRequestHttps(req);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(req: Request, res: Response): void {
  const https = isRequestHttps(req);
  const opts = {
    httpOnly: true,
    sameSite: https ? ('none' as const) : ('lax' as const),
    secure: https,
    path: '/',
  };
  res.clearCookie(COOKIE_NAME, opts);
  for (const name of LEGACY_COOKIE_NAMES) {
    res.clearCookie(name, opts);
  }
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const cookieToken =
    (req.cookies?.[COOKIE_NAME] as string | undefined) ||
    (req.cookies?.[LEGACY_COOKIE_NAMES[0]] as string | undefined) ||
    (req.cookies?.[LEGACY_COOKIE_NAMES[1]] as string | undefined);
  const token = bearerToken || cookieToken;

  if (!token) {
    res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    const userRow = db
      .prepare(
        'SELECT user_id, username, email, role, account_status, display_name, avatar_url FROM users WHERE user_id = ?'
      )
      .get(decoded.user_id) as
      | {
          user_id: string;
          username: string;
          email: string;
          role: string;
          account_status: string;
          display_name: string;
          avatar_url: string;
        }
      | undefined;

    if (!userRow || userRow.account_status !== 'active') {
      res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa.' });
      return;
    }

    const role = normalizeUserRole(userRow.role);
    const student = role === 'STUDENT' ? getStudentByUserId(userRow.user_id) : undefined;
    const lecturer = role === 'LECTURER' ? getLecturerByUserId(userRow.user_id) : undefined;

    req.authUser = {
      user_id: userRow.user_id,
      username: userRow.username,
      email: userRow.email,
      role,
      display_name: userRow.display_name,
      avatar_url: userRow.avatar_url,
      student_id: student?.student_id ?? null,
      lecturer_id: lecturer?.lecturer_id ?? null,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  }
}

function requireTrainingDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.role !== 'TRAINING_DEPARTMENT') {
    res.status(403).json({ error: 'Thao tác này chỉ dành cho Phòng Đào tạo.' });
    return;
  }
  next();
}

function requireLecturer(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.role !== 'LECTURER' || !req.authUser.lecturer_id) {
    res.status(403).json({ error: 'Thao tác này chỉ dành cho tài khoản Giảng viên hợp lệ.' });
    return;
  }
  next();
}

function assertStudentAccess(req: AuthenticatedRequest, res: Response, targetStudentId: string): boolean {
  if (!req.authUser) {
    res.status(401).json({ error: 'Yêu cầu xác thực tài khoản.' });
    return false;
  }
  if (req.authUser.role === 'TRAINING_DEPARTMENT') {
    return true;
  }
  if (req.authUser.role === 'LECTURER') {
    res.status(403).json({
      error: 'Truy cập bị từ chối: Giảng viên chỉ được xem dữ liệu sinh viên trong lớp học phần được phân công.',
    });
    return false;
  }
  if (req.authUser.student_id !== targetStudentId) {
    res.status(403).json({
      error: 'Truy cập bị từ chối: Sinh viên không thể xem hoặc chỉnh sửa dữ liệu học tập của sinh viên khác.',
    });
    return false;
  }
  return true;
}

// --- AUTH ROUTES ---

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body as { identifier?: string; password?: string };
  if (!identifier || !password) {
    res.status(400).json({ error: 'Vui lòng nhập email (hoặc mã định danh) và mật khẩu.' });
    return;
  }

  const normalized = identifier.trim().toLowerCase();
  const user = db
    .prepare(
      `SELECT user_id, username, email, password_hash, role, account_status, display_name, avatar_url
       FROM users
       WHERE LOWER(email) = ?
          OR LOWER(username) = ?
          OR EXISTS (
            SELECT 1 FROM students s
            WHERE s.user_id = users.user_id AND LOWER(s.student_id) = ?
          )
          OR EXISTS (
            SELECT 1 FROM lecturers l
            WHERE l.user_id = users.user_id AND LOWER(l.lecturer_id) = ?
          )`
    )
    .get(normalized, normalized, normalized, normalized) as
    | {
        user_id: string;
        username: string;
        email: string;
        password_hash: string;
        role: string;
        account_status: string;
        display_name: string;
        avatar_url: string;
      }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.' });
    return;
  }

  if (user.account_status !== 'active') {
    res.status(403).json({ error: 'Tài khoản này hiện đang bị tạm khóa bởi Phòng Đào tạo.' });
    return;
  }

  const role = normalizeUserRole(user.role);
  const student = role === 'STUDENT' ? getStudentByUserId(user.user_id) : undefined;
  const lecturer = role === 'LECTURER' ? getLecturerByUserId(user.user_id) : undefined;

  const payload: AuthTokenPayload = {
    user_id: user.user_id,
    role,
    student_id: student?.student_id ?? null,
    lecturer_id: lecturer?.lecturer_id ?? null,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  setSessionCookie(req, res, token);

  res.json({
    token,
    user: {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      student_id: student?.student_id ?? null,
      lecturer_id: lecturer?.lecturer_id ?? null,
    },
    student: student ?? null,
    lecturer: lecturer ?? null,
    settings: getAcademicSettings(),
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const auth = req.authUser!;
  const student = auth.student_id ? getStudentById(auth.student_id) ?? null : null;
  const lecturer = auth.lecturer_id ? getLecturerById(auth.lecturer_id) ?? null : null;
  res.json({
    user: auth,
    student,
    lecturer,
    settings: getAcademicSettings(),
  });
});

// --- SHARED CATALOG & SETTINGS ---

app.get('/api/settings', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json(getAcademicSettings());
});

app.get('/api/academic-terms', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json(getAcademicTerms());
});

app.get('/api/courses', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const courses = db.prepare('SELECT * FROM courses ORDER BY course_code ASC').all();
  res.json(courses);
});

// --- STUDENT DATA & PORTAL ROUTES ---

app.get('/api/students/:studentId/overview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { studentId } = req.params;
  if (!assertStudentAccess(req, res, studentId)) return;

  const student = getStudentById(studentId);
  if (!student) {
    res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.' });
    return;
  }

  const settings = getAcademicSettings();
  const isStudentViewer = req.authUser!.role === 'STUDENT';
  const enrollments = getStudentEnrollments(studentId, { maskUnofficial: isStudentViewer });
  const summary = calculateStudentAcademicSummary(
    enrollments,
    settings,
    student.total_required_credits
  );

  const warnings = db
    .prepare(
      `SELECT * FROM academic_warnings
       WHERE student_id = ?
       ORDER BY CASE warning_status WHEN 'Active' THEN 0 WHEN 'Read' THEN 1 ELSE 2 END, generated_at DESC`
    )
    .all(studentId) as AcademicWarningRecord[];

  const activities = db
    .prepare(
      `SELECT * FROM academic_activities
       WHERE student_id = ?
       ORDER BY created_at DESC LIMIT 20`
    )
    .all(studentId);

  const { reports, unreadReportsCount } = getStudentReports(studentId);
  const tuitionOverview = getStudentTuitionOverview(studentId);

  res.json({
    student,
    summary,
    enrollments,
    warnings,
    reports,
    unreadReportsCount,
    activities,
    settings,
    academicTerms: getAcademicTerms(),
    tuitionSummary: tuitionOverview.summary,
  });
});

app.get('/api/students/:studentId/reports', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { studentId } = req.params;
  if (!assertStudentAccess(req, res, studentId)) return;

  const student = getStudentById(studentId);
  if (!student) {
    res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.' });
    return;
  }

  res.json(getStudentReports(studentId));
});

app.patch(
  '/api/students/:studentId/reports/:reportId/read',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId, reportId } = req.params;
    if (!assertStudentAccess(req, res, studentId)) return;

    const student = getStudentById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.' });
      return;
    }

    const updated = markStudentReportRead(studentId, reportId, req.authUser?.user_id);
    if (!updated) {
      res.status(404).json({ error: 'Không tìm thấy báo cáo học vụ phù hợp.' });
      return;
    }

    res.json({
      ok: true,
      report: updated.report,
      unreadReportsCount: updated.unreadReportsCount,
    });
  }
);

app.post(
  '/api/students/:studentId/reports/:reportId/read',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId, reportId } = req.params;
    if (!assertStudentAccess(req, res, studentId)) return;

    const student = getStudentById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.' });
      return;
    }

    const updated = markStudentReportRead(studentId, reportId, req.authUser?.user_id);
    if (!updated) {
      res.status(404).json({ error: 'Không tìm thấy báo cáo học vụ phù hợp.' });
      return;
    }

    res.json({
      ok: true,
      report: updated.report,
      unreadReportsCount: updated.unreadReportsCount,
    });
  }
);

app.put('/api/students/:studentId/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { studentId } = req.params;
  if (!assertStudentAccess(req, res, studentId)) return;

  const student = getStudentById(studentId);
  if (!student) {
    res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.' });
    return;
  }

  const { phone, email } = req.body as { phone?: string; email?: string };
  const nextEmail = email !== undefined ? email.trim() : student.email;
  const nextPhone = phone !== undefined ? phone.trim() : student.phone;

  if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    res.status(400).json({ error: 'Vui lòng nhập địa chỉ email hợp lệ.' });
    return;
  }

  const conflict = db
    .prepare('SELECT user_id FROM users WHERE LOWER(email) = LOWER(?) AND user_id != ?')
    .get(nextEmail, student.user_id);
  if (conflict) {
    res.status(409).json({ error: 'Địa chỉ email này đã được sử dụng cho tài khoản khác.' });
    return;
  }

  db.transaction(() => {
    db.prepare('UPDATE students SET email = ?, phone = ? WHERE student_id = ?').run(
      nextEmail,
      nextPhone,
      studentId
    );
    db.prepare('UPDATE users SET email = ? WHERE user_id = ?').run(nextEmail, student.user_id);
    logAcademicActivity(
      studentId,
      req.authUser!.user_id,
      'CẬP NHẬT HỒ SƠ',
      `Đã cập nhật thông tin liên hệ cá nhân (${nextEmail}).`
    );
  })();

  res.json({ student: getStudentById(studentId) });
});

app.post(
  '/api/students/:studentId/enrollments',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId } = req.params;
    const student = getStudentById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.' });
      return;
    }

    const {
      course_code,
      course_name,
      credit_hours,
      semester,
      academic_year,
      letter_grade,
      numeric_grade,
      completion_status,
    } = req.body as {
      course_code?: string;
      course_name?: string;
      credit_hours?: number;
      semester?: string;
      academic_year?: string;
      letter_grade?: string | null;
      numeric_grade?: number | null;
      completion_status?: CompletionStatus;
    };

    const code = course_code?.trim().toUpperCase() ?? '';
    const name = course_name?.trim() ?? '';
    const creditCheck = validateCourseCredit(credit_hours);
    const sem = semester?.trim() ?? '';
    const year = academic_year?.trim() ?? '';
    const status: CompletionStatus = completion_status ?? 'Completed';

    if (!code || !name) {
      res.status(400).json({ error: 'Mã học phần và tên học phần là bắt buộc.' });
      return;
    }
    if (!creditCheck.valid) {
      res.status(400).json({ error: creditCheck.error });
      return;
    }
    const credits = creditCheck.value;
    if (!sem || !year) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ học kỳ và năm học.' });
      return;
    }
    if (!['Completed', 'Failed', 'In Progress', 'Withdrawn'].includes(status)) {
      res.status(400).json({ error: 'Trạng thái học phần không hợp lệ.' });
      return;
    }

    const settings = getAcademicSettings();
    let finalLetter: string | null = letter_grade ? letter_grade.trim().toUpperCase() : null;
    const scoreCheck = validateScoreOnTenScale(numeric_grade);
    if (!scoreCheck.valid) {
      res.status(400).json({ error: scoreCheck.error });
      return;
    }
    let finalNumeric: number | null = scoreCheck.value;

    let finalPoint: number | null = null;
    if (status === 'Completed' || status === 'Failed') {
      if (!finalLetter && finalNumeric !== null) {
        const resolved = resolveLetterFromNumeric(finalNumeric, settings.gradingScale);
        finalLetter = resolved?.letter ?? null;
      }
      const scaleMatch = resolveGradeFromScale(finalLetter, settings.gradingScale);
      if (!scaleMatch) {
        res.status(400).json({
          error: 'Học phần đã có kết quả bắt buộc phải chọn điểm chữ hợp lệ theo thang điểm của trường.',
        });
        return;
      }
      if (status === 'Failed' && scaleMatch.passing) {
        res.status(400).json({
          error: `Điểm "${scaleMatch.letter}" là điểm đạt. Vui lòng đổi trạng thái thành Đạt hoặc chọn điểm F.`,
        });
        return;
      }
      if (status === 'Completed' && !scaleMatch.passing) {
        res.status(400).json({
          error: `Điểm "${scaleMatch.letter}" là điểm chưa đạt. Vui lòng đặt trạng thái là Chưa đạt.`,
        });
        return;
      }
      finalLetter = scaleMatch.letter;
      finalPoint = scaleMatch.point;
    } else {
      finalLetter = null;
      finalPoint = null;
      finalNumeric = null;
    }

    let courseRow = db.prepare('SELECT * FROM courses WHERE UPPER(course_code) = ?').get(code) as
      | { course_id: string; course_code: string; course_name: string; credit_hours: number }
      | undefined;

    if (!courseRow) {
      const newCourseId = `CRS-${code.replace(/[^A-Z0-9]/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      db.prepare(
        `INSERT INTO courses (course_id, course_code, course_name, credit_hours, department, description)
         VALUES (?, ?, ?, ?, 'Khoa học cơ bản', '')`
      ).run(newCourseId, code, name, credits);
      courseRow = { course_id: newCourseId, course_code: code, course_name: name, credit_hours: credits };
    }

    const duplicateTerm = db
      .prepare(
        `SELECT enrollment_id FROM enrollments
         WHERE student_id = ? AND course_id = ? AND LOWER(semester) = LOWER(?) AND academic_year = ?`
      )
      .get(studentId, courseRow.course_id, sem, year);

    if (duplicateTerm) {
      res.status(409).json({
        error: `Học phần ${code} đã tồn tại trong ${sem} (${year}). Vui lòng chỉnh sửa bản ghi hiện có.`,
      });
      return;
    }

    const priorAttempts = db
      .prepare('SELECT COUNT(*) as cnt FROM enrollments WHERE student_id = ? AND course_id = ?')
      .get(studentId, courseRow.course_id) as { cnt: number };

    const enrollmentId = `ENR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const semesterId = resolveOrCreateSemesterId(year, sem);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO enrollments (
        enrollment_id, student_id, course_id, semester_id, semester, academic_year,
        letter_grade, numeric_grade, grade_point, completion_status, is_repeated, is_official, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(
      enrollmentId,
      studentId,
      courseRow.course_id,
      semesterId,
      sem,
      year,
      finalLetter,
      finalNumeric,
      finalPoint,
      status,
      priorAttempts.cnt > 0 ? 1 : 0,
      now
    );

    const summary = syncStudentDerivedRecords(studentId);
    logAcademicActivity(
      studentId,
      req.authUser!.user_id,
      'THÊM HỌC PHẦN',
      `Phòng Đào tạo đã thêm ${code} (${name}, ${credits} tín chỉ) tại ${sem} ${year}${finalLetter ? ` — Điểm: ${finalLetter}` : ' — Đang học'}.`
    );

    res.status(201).json({
      enrollment_id: enrollmentId,
      summary,
    });
  }
);

app.put(
  '/api/students/:studentId/enrollments/:enrollmentId',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId, enrollmentId } = req.params;
    const existing = db
      .prepare(
        `SELECT e.*, c.course_code, c.course_name, c.credit_hours
         FROM enrollments e JOIN courses c ON e.course_id = c.course_id
         WHERE e.enrollment_id = ? AND e.student_id = ?`
      )
      .get(enrollmentId, studentId) as
      | {
          enrollment_id: string;
          student_id: string;
          course_id: string;
          course_code: string;
          course_name: string;
          credit_hours: number;
          semester: string;
          academic_year: string;
        }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy bản ghi học phần của sinh viên.' });
      return;
    }

    const {
      course_code,
      course_name,
      credit_hours,
      semester,
      academic_year,
      letter_grade,
      numeric_grade,
      completion_status,
    } = req.body as {
      course_code?: string;
      course_name?: string;
      credit_hours?: number;
      semester?: string;
      academic_year?: string;
      letter_grade?: string | null;
      numeric_grade?: number | null;
      completion_status?: CompletionStatus;
    };

    const code = (course_code ?? existing.course_code).trim().toUpperCase();
    const name = (course_name ?? existing.course_name).trim();
    const creditCheck =
      credit_hours !== undefined
        ? validateCourseCredit(credit_hours)
        : { valid: true, value: Math.max(1, Math.round(existing.credit_hours)) };
    const sem = (semester ?? existing.semester).trim();
    const year = (academic_year ?? existing.academic_year).trim();
    const status: CompletionStatus = completion_status ?? 'Completed';

    if (!code || !name || !sem || !year) {
      res.status(400).json({ error: 'Mã học phần, tên học phần, học kỳ và năm học là bắt buộc.' });
      return;
    }
    if (!creditCheck.valid) {
      res.status(400).json({ error: creditCheck.error });
      return;
    }
    const credits = creditCheck.value;
    if (!['Completed', 'Failed', 'In Progress', 'Withdrawn'].includes(status)) {
      res.status(400).json({ error: 'Trạng thái học phần không hợp lệ.' });
      return;
    }

    const settings = getAcademicSettings();
    let finalLetter: string | null = letter_grade ? letter_grade.trim().toUpperCase() : null;
    const scoreCheck = validateScoreOnTenScale(numeric_grade);
    if (!scoreCheck.valid) {
      res.status(400).json({ error: scoreCheck.error });
      return;
    }
    let finalNumeric: number | null = scoreCheck.value;

    let finalPoint: number | null = null;
    if (status === 'Completed' || status === 'Failed') {
      if (!finalLetter && finalNumeric !== null) {
        finalLetter = resolveLetterFromNumeric(finalNumeric, settings.gradingScale)?.letter ?? null;
      }
      const scaleMatch = resolveGradeFromScale(finalLetter, settings.gradingScale);
      if (!scaleMatch) {
        res.status(400).json({
          error: 'Cần chọn điểm chữ hợp lệ theo thang điểm của trường.',
        });
        return;
      }
      if (status === 'Failed' && scaleMatch.passing) {
        res.status(400).json({
          error: `Điểm "${scaleMatch.letter}" là điểm đạt. Vui lòng chọn trạng thái Đạt hoặc điểm F.`,
        });
        return;
      }
      if (status === 'Completed' && !scaleMatch.passing) {
        res.status(400).json({
          error: `Điểm "${scaleMatch.letter}" là điểm chưa đạt. Vui lòng chọn trạng thái Chưa đạt.`,
        });
        return;
      }
      finalLetter = scaleMatch.letter;
      finalPoint = scaleMatch.point;
    } else {
      finalLetter = null;
      finalPoint = null;
      finalNumeric = null;
    }

    let targetCourseId = existing.course_id;
    if (code !== existing.course_code) {
      const matched = db.prepare('SELECT course_id FROM courses WHERE UPPER(course_code) = ?').get(code) as
        | { course_id: string }
        | undefined;
      if (matched) {
        targetCourseId = matched.course_id;
      } else {
        targetCourseId = `CRS-${code.replace(/[^A-Z0-9]/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
        db.prepare(
          `INSERT INTO courses (course_id, course_code, course_name, credit_hours, department, description)
           VALUES (?, ?, ?, ?, 'Khoa học cơ bản', '')`
        ).run(targetCourseId, code, name, credits);
      }
    } else {
      db.prepare('UPDATE courses SET course_name = ?, credit_hours = ? WHERE course_id = ?').run(
        name,
        credits,
        targetCourseId
      );
    }

    const dupCheck = db
      .prepare(
        `SELECT enrollment_id FROM enrollments
         WHERE student_id = ? AND course_id = ? AND LOWER(semester) = LOWER(?) AND academic_year = ? AND enrollment_id != ?`
      )
      .get(studentId, targetCourseId, sem, year, enrollmentId);
    if (dupCheck) {
      res.status(409).json({
        error: `Đã có học phần ${code} trong ${sem} (${year}).`,
      });
      return;
    }

    const nextSemesterId = resolveOrCreateSemesterId(year, sem);
    db.prepare(
      `UPDATE enrollments
       SET course_id = ?, semester_id = ?, semester = ?, academic_year = ?, letter_grade = ?,
           numeric_grade = ?, grade_point = ?, completion_status = ?, is_official = 1, updated_at = ?
       WHERE enrollment_id = ? AND student_id = ?`
    ).run(
      targetCourseId,
      nextSemesterId,
      sem,
      year,
      finalLetter,
      finalNumeric,
      finalPoint,
      status,
      new Date().toISOString(),
      enrollmentId,
      studentId
    );

    const summary = syncStudentDerivedRecords(studentId);
    logAcademicActivity(
      studentId,
      req.authUser!.user_id,
      'CẬP NHẬT ĐIỂM',
      `Phòng Đào tạo đã cập nhật ${code} (${sem} ${year})${finalLetter ? ` — Điểm: ${finalLetter} (${finalPoint?.toFixed(2)})` : ' — Đang học'}.`
    );

    res.json({ summary });
  }
);

app.delete(
  '/api/students/:studentId/enrollments/:enrollmentId',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId, enrollmentId } = req.params;
    const existing = db
      .prepare(
        `SELECT e.enrollment_id, c.course_code, e.semester, e.academic_year
         FROM enrollments e JOIN courses c ON e.course_id = c.course_id
         WHERE e.enrollment_id = ? AND e.student_id = ?`
      )
      .get(enrollmentId, studentId) as
      | { enrollment_id: string; course_code: string; semester: string; academic_year: string }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy bản ghi học phần.' });
      return;
    }

    db.prepare('DELETE FROM enrollments WHERE enrollment_id = ? AND student_id = ?').run(
      enrollmentId,
      studentId
    );

    const summary = syncStudentDerivedRecords(studentId);
    logAcademicActivity(
      studentId,
      req.authUser!.user_id,
      'XÓA HỌC PHẦN',
      `Phòng Đào tạo đã xóa học phần ${existing.course_code} (${existing.semester} ${existing.academic_year}) khỏi bảng điểm.`
    );

    res.json({ ok: true, summary });
  }
);

app.patch(
  '/api/students/:studentId/warnings/:warningId/read',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId, warningId } = req.params;
    if (!assertStudentAccess(req, res, studentId)) return;

    const warning = db
      .prepare('SELECT * FROM academic_warnings WHERE warning_id = ? AND student_id = ?')
      .get(warningId, studentId) as AcademicWarningRecord | undefined;

    if (!warning) {
      res.status(404).json({ error: 'Không tìm thấy bản ghi cảnh báo học vụ.' });
      return;
    }

    if (warning.warning_status === 'Active') {
      db.prepare("UPDATE academic_warnings SET warning_status = 'Read' WHERE warning_id = ?").run(
        warningId
      );
      logAcademicActivity(
        studentId,
        req.authUser!.user_id,
        'ĐÃ ĐỌC CẢNH BÁO',
        `Đã xác nhận đọc cảnh báo học vụ: ${warning.warning_title}.`
      );
    }

    const unreadCountRow = db
      .prepare("SELECT COUNT(*) as cnt FROM academic_warnings WHERE student_id = ? AND warning_status = 'Active'")
      .get(studentId) as { cnt: number };

    res.json({
      ok: true,
      warning_id: warningId,
      warning_status: warning.warning_status === 'Resolved' ? 'Resolved' : 'Read',
      unreadWarningsCount: Number(unreadCountRow.cnt ?? 0),
    });
  }
);

// --- LECTURER ROUTES ---

app.get('/api/lecturer/overview', requireAuth, requireLecturer, (req: AuthenticatedRequest, res: Response) => {
  const lecturerId = req.authUser!.lecturer_id!;
  const lecturer = getLecturerById(lecturerId)!;
  const sections = getClassSections({ lecturerId });
  const settings = getAcademicSettings();

  const sectionIds = sections.map((s) => s.section_id);
  const enrolledRows =
    sectionIds.length > 0
      ? (db
          .prepare(
            `SELECT e.section_id, e.student_id, e.letter_grade, e.numeric_grade, e.completion_status
             FROM enrollments e
             WHERE e.section_id IN (${sectionIds.map(() => '?').join(',')})`
          )
          .all(...sectionIds) as Array<{
          section_id: string;
          student_id: string;
          letter_grade: string | null;
          numeric_grade: number | null;
          completion_status: CompletionStatus;
        }>)
      : [];

  const distinctStudents = new Set(enrolledRows.map((r) => r.student_id));
  const incompleteGradingCount = sections.filter(
    (s) => s.is_active === 1 && s.grade_status !== 'APPROVED' && s.grade_status !== 'PENDING_APPROVAL'
  ).length;
  const failedStudentsCount = enrolledRows.filter((r) => r.completion_status === 'Failed').length;

  const gradeBuckets = [
    { group: 'A+ / A', count: 0 },
    { group: 'B+ / B', count: 0 },
    { group: 'C+ / C', count: 0 },
    { group: 'D+ / D', count: 0 },
    { group: 'F', count: 0 },
  ];
  let passedCount = 0;
  let failedCount = 0;

  for (const row of enrolledRows) {
    if (row.completion_status === 'Completed') passedCount += 1;
    if (row.completion_status === 'Failed') failedCount += 1;
    const lg = row.letter_grade;
    if (lg === 'A+' || lg === 'A') gradeBuckets[0].count += 1;
    else if (lg === 'B+' || lg === 'B') gradeBuckets[1].count += 1;
    else if (lg === 'C+' || lg === 'C') gradeBuckets[2].count += 1;
    else if (lg === 'D+' || lg === 'D') gradeBuckets[3].count += 1;
    else if (lg === 'F') gradeBuckets[4].count += 1;
  }

  const notifications: Array<{
    id: string;
    title: string;
    description: string;
    tone: 'warning' | 'info' | 'danger' | 'success';
    section_id: string;
    date: string;
  }> = [];

  for (const s of sections) {
    if (s.grade_status === 'NEEDS_REVISION') {
      notifications.push({
        id: `notif-rev-${s.section_id}`,
        title: `${s.section_code} · Cần chỉnh sửa bảng điểm`,
        description: s.latest_review_reason || 'Phòng Đào tạo đã trả lại bảng điểm để giảng viên rà soát.',
        tone: 'danger',
        section_id: s.section_id,
        date: s.submission_deadline || new Date().toISOString().slice(0, 10),
      });
    } else if (s.grade_status === 'NOT_ENTERED' || s.grade_status === 'IN_PROGRESS') {
      notifications.push({
        id: `notif-due-${s.section_id}`,
        title: `${s.section_code} (${s.course_name}) chưa hoàn tất nộp điểm`,
        description: `Còn ${s.ungraded_count}/${s.enrolled_count} sinh viên chưa có điểm cuối kỳ · Hạn nộp ${s.submission_deadline || 'theo lịch học kỳ'}.`,
        tone: 'warning',
        section_id: s.section_id,
        date: s.submission_deadline || new Date().toISOString().slice(0, 10),
      });
    } else if (s.grade_status === 'PENDING_APPROVAL') {
      notifications.push({
        id: `notif-pend-${s.section_id}`,
        title: `${s.section_code} đang chờ Phòng Đào tạo duyệt`,
        description: `Đã nộp đủ điểm cho ${s.enrolled_count} sinh viên. Bảng điểm được khóa tạm thời trong quá trình thẩm định.`,
        tone: 'info',
        section_id: s.section_id,
        date: s.latest_submission_at || new Date().toISOString(),
      });
    }
  }

  res.json({
    lecturer,
    metrics: {
      assignedSectionsCount: sections.filter((s) => s.is_active === 1 && s.grade_status !== 'APPROVED').length,
      totalSectionsCount: sections.length,
      totalStudentsCount: distinctStudents.size,
      incompleteGradingCount,
      failedStudentsCount,
    },
    sections,
    charts: {
      gradeDistribution: gradeBuckets,
      passFailDistribution: [
        { name: 'Đạt', count: passedCount },
        { name: 'Chưa đạt', count: failedCount },
      ],
    },
    notifications: notifications.slice(0, 8),
    settings,
    academicTerms: getAcademicTerms(),
  });
});

app.get(
  '/api/lecturer/sections/:sectionId',
  requireAuth,
  requireLecturer,
  (req: AuthenticatedRequest, res: Response) => {
    const detail = getSectionDetail(req.params.sectionId);
    if (!detail) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần.' });
      return;
    }
    if (detail.section.lecturer_id !== req.authUser!.lecturer_id) {
      res.status(403).json({
        error: 'Truy cập bị từ chối: Bạn chỉ được phép xem và quản lý lớp học phần được phân công cho mình.',
      });
      return;
    }
    res.json(detail);
  }
);

app.put(
  '/api/lecturer/sections/:sectionId/grades',
  requireAuth,
  requireLecturer,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId } = req.params;
    const detail = getSectionDetail(sectionId);
    if (!detail) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần.' });
      return;
    }
    if (detail.section.lecturer_id !== req.authUser!.lecturer_id) {
      res.status(403).json({
        error: 'Truy cập bị từ chối: Bạn không có quyền nhập điểm cho lớp học phần này.',
      });
      return;
    }
    if (detail.section.grade_status === 'APPROVED') {
      res.status(403).json({
        error: 'Bảng điểm đã được Phòng Đào tạo phê duyệt chính thức. Giảng viên không thể chỉnh sửa sau khi duyệt.',
      });
      return;
    }
    if (detail.section.grade_status === 'PENDING_APPROVAL') {
      res.status(403).json({
        error: 'Bảng điểm đang chờ Phòng Đào tạo phê duyệt, không thể chỉnh sửa khi chưa được trả lại.',
      });
      return;
    }

    const { grades } = req.body as {
      grades?: Array<{
        enrollment_id: string;
        attendance_status?: string;
        attendance_score?: number | null;
        assignment_score?: number | null;
        midterm_score?: number | null;
        final_score?: number | null;
        reason?: string;
      }>;
    };

    if (!Array.isArray(grades) || grades.length === 0) {
      res.status(400).json({ error: 'Danh sách điểm cập nhật không hợp lệ.' });
      return;
    }

    const settings = getAcademicSettings();
    const enrollmentMap = new Map(detail.enrollments.map((e) => [e.enrollment_id, e]));

    const parseScore = (val: unknown, label: string): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        throw new Error(`${label} phải nằm trong khoảng từ 0.00 đến 10.00 (thang điểm 10).`);
      }
      return Math.round((n + Number.EPSILON) * 100) / 100;
    };

    try {
      const now = new Date().toISOString();
      db.transaction(() => {
        const updEnr = db.prepare(
          `UPDATE enrollments
           SET attendance_status = ?, attendance_score = ?, assignment_score = ?, midterm_score = ?, final_score = ?,
               numeric_grade = ?, letter_grade = ?, grade_point = ?, completion_status = ?, is_official = 0, updated_at = ?
           WHERE enrollment_id = ? AND section_id = ?`
        );
        const insLog = db.prepare(
          `INSERT INTO grade_change_logs (
            log_id, enrollment_id, section_id, student_id, course_code,
            changed_by_user_id, changed_by_name, changed_by_role,
            previous_numeric_grade, new_numeric_grade, previous_letter_grade, new_letter_grade,
            reason, changed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        let anyScoreEntered = false;

        for (const item of grades) {
          const existing = enrollmentMap.get(item.enrollment_id);
          if (!existing) continue;

          const att = parseScore(item.attendance_score, 'Điểm chuyên cần');
          const asg = parseScore(item.assignment_score, 'Điểm bài tập');
          const mid = parseScore(item.midterm_score, 'Điểm giữa kỳ');
          const fin = parseScore(item.final_score, 'Điểm cuối kỳ');
          const attStatus = item.attendance_status?.trim() || existing.attendance_status || 'Đủ điều kiện';

          if (att !== null || asg !== null || mid !== null || fin !== null) {
            anyScoreEntered = true;
          }

          const computedNumeric = computeWeightedNumericGrade(
            { attendance_score: att, assignment_score: asg, midterm_score: mid, final_score: fin },
            settings.assessmentWeights
          );

          let letter: string | null = null;
          let point: number | null = null;
          let completion: CompletionStatus = 'In Progress';

          if (computedNumeric !== null) {
            const resolved = resolveLetterFromNumeric(computedNumeric, settings.gradingScale);
            if (resolved) {
              letter = resolved.letter;
              point = resolved.point;
              completion = resolved.passing ? 'Completed' : 'Failed';
            }
          }

          updEnr.run(
            attStatus,
            att,
            asg,
            mid,
            fin,
            computedNumeric,
            letter,
            point,
            completion,
            now,
            existing.enrollment_id,
            sectionId
          );

          const changed =
            existing.numeric_grade !== computedNumeric ||
            existing.letter_grade !== letter ||
            existing.attendance_score !== att ||
            existing.assignment_score !== asg ||
            existing.midterm_score !== mid ||
            existing.final_score !== fin;

          if (changed) {
            insLog.run(
              `GCL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
              existing.enrollment_id,
              sectionId,
              existing.student_id,
              detail.section.course_code,
              req.authUser!.user_id,
              req.authUser!.display_name,
              req.authUser!.role,
              existing.numeric_grade,
              computedNumeric,
              existing.letter_grade,
              letter,
              item.reason?.trim() || 'Giảng viên cập nhật điểm thành phần lớp học phần',
              now
            );
          }
        }

        const nextStatus =
          detail.section.grade_status === 'NEEDS_REVISION'
            ? 'NEEDS_REVISION'
            : anyScoreEntered
              ? 'IN_PROGRESS'
              : 'NOT_ENTERED';

        db.prepare('UPDATE class_sections SET grade_status = ?, updated_at = ? WHERE section_id = ?').run(
          nextStatus,
          now,
          sectionId
        );
      })();
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Điểm nhập không hợp lệ.' });
      return;
    }

    res.json(getSectionDetail(sectionId));
  }
);

app.post(
  '/api/lecturer/sections/:sectionId/submit',
  requireAuth,
  requireLecturer,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId } = req.params;
    const detail = getSectionDetail(sectionId);
    if (!detail) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần.' });
      return;
    }
    if (detail.section.lecturer_id !== req.authUser!.lecturer_id) {
      res.status(403).json({
        error: 'Truy cập bị từ chối: Bạn không phải giảng viên phụ trách lớp học phần này.',
      });
      return;
    }
    if (detail.section.grade_status === 'APPROVED') {
      res.status(409).json({ error: 'Bảng điểm này đã được Phòng Đào tạo phê duyệt.' });
      return;
    }
    if (detail.section.grade_status === 'PENDING_APPROVAL') {
      res.status(409).json({ error: 'Bảng điểm đã được gửi và đang chờ Phòng Đào tạo phê duyệt.' });
      return;
    }
    if (detail.enrollments.length === 0) {
      res.status(400).json({ error: 'Lớp học phần chưa có sinh viên để gửi bảng điểm.' });
      return;
    }

    const incomplete = detail.enrollments.filter(
      (e) => e.final_score === null || e.letter_grade === null
    );
    if (incomplete.length > 0) {
      res.status(400).json({
        error: `Còn ${incomplete.length} sinh viên chưa có điểm cuối kỳ hoàn chỉnh. Vui lòng hoàn tất nhập điểm và lưu trước khi gửi duyệt.`,
      });
      return;
    }

    const { note } = req.body as { note?: string };
    const now = new Date().toISOString();
    const submissionId = `SUB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    db.transaction(() => {
      db.prepare("UPDATE class_sections SET grade_status = 'PENDING_APPROVAL', updated_at = ? WHERE section_id = ?").run(
        now,
        sectionId
      );
      db.prepare(
        `INSERT INTO grade_submissions (
          submission_id, section_id, lecturer_id, submitted_by_user_id, submitted_at, status, student_count, graded_count, note
        ) VALUES (?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?)`
      ).run(
        submissionId,
        sectionId,
        req.authUser!.lecturer_id,
        req.authUser!.user_id,
        now,
        detail.enrollments.length,
        detail.enrollments.length,
        note?.trim() || `Giảng viên ${req.authUser!.display_name} gửi bảng điểm lớp ${detail.section.section_code} chờ duyệt.`
      );

      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'GỬI DUYỆT BẢNG ĐIỂM',
        `Giảng viên ${req.authUser!.display_name} đã gửi bảng điểm lớp ${detail.section.section_code} (${detail.section.course_code}) cho Phòng Đào tạo.`
      );
    })();

    res.json({ submission_id: submissionId, detail: getSectionDetail(sectionId) });
  }
);

app.get('/api/lecturer/students', requireAuth, requireLecturer, (req: AuthenticatedRequest, res: Response) => {
  const lecturerId = req.authUser!.lecturer_id!;
  const rows = db
    .prepare(
      `SELECT e.enrollment_id, e.student_id, s.full_name as student_name, s.email as student_email,
              s.major as student_major, s.academic_year as student_cohort,
              cs.section_id, cs.section_code, c.course_code, c.course_name, cs.semester, cs.academic_year,
              cs.grade_status, e.attendance_status, e.numeric_grade, e.letter_grade, e.grade_point, e.completion_status
       FROM enrollments e
       JOIN class_sections cs ON e.section_id = cs.section_id
       JOIN students s ON e.student_id = s.student_id
       JOIN courses c ON cs.course_id = c.course_id
       WHERE cs.lecturer_id = ?
       ORDER BY cs.academic_year DESC, cs.section_code ASC, s.student_id ASC`
    )
    .all(lecturerId);

  res.json({ students: rows });
});

app.put('/api/lecturer/profile', requireAuth, requireLecturer, (req: AuthenticatedRequest, res: Response) => {
  const lecturerId = req.authUser!.lecturer_id!;
  const lecturer = getLecturerById(lecturerId)!;
  const { phone, office_location, specialization } = req.body as {
    phone?: string;
    office_location?: string;
    specialization?: string;
  };

  db.prepare(
    `UPDATE lecturers SET phone = ?, office_location = ?, specialization = ? WHERE lecturer_id = ?`
  ).run(
    phone !== undefined ? phone.trim() : lecturer.phone,
    office_location !== undefined ? office_location.trim() : lecturer.office_location,
    specialization !== undefined ? specialization.trim() : lecturer.specialization,
    lecturerId
  );

  res.json({ lecturer: getLecturerById(lecturerId) });
});

// --- TRAINING DEPARTMENT (& LEGACY /api/admin) OVERVIEW & MANAGEMENT ---

function buildTrainingOverviewPayload() {
  const settings = getAcademicSettings();
  const students = db.prepare('SELECT * FROM students ORDER BY full_name ASC').all() as StudentProfile[];
  const lecturers = getAllLecturers();
  const sections = getClassSections();
  const coursesCount = (db.prepare('SELECT COUNT(*) as cnt FROM courses').get() as { cnt: number }).cnt;

  const warnings = db
    .prepare(
      `SELECT w.*, s.full_name as student_name
       FROM academic_warnings w
       JOIN students s ON w.student_id = s.student_id
       ORDER BY w.generated_at DESC`
    )
    .all() as AcademicWarningRecord[];

  const enrichedStudents = students.map((student) => {
    const enrollments = getStudentEnrollments(student.student_id);
    const summary = calculateStudentAcademicSummary(
      enrollments,
      settings,
      student.total_required_credits
    );
    const activeWarnings = warnings.filter(
      (w) => w.student_id === student.student_id && w.warning_status !== 'Resolved'
    );
    return {
      ...student,
      cgpa: summary.cgpa,
      earnedCredits: summary.earnedCredits,
      failedCredits: summary.failedCredits,
      gpaEligibleCredits: summary.gpaEligibleCredits,
      classification: summary.classification.label,
      activeWarningCount: activeWarnings.length,
      semesters: summary.semesters,
    };
  });

  const validGpas = enrichedStudents.map((s) => s.cgpa).filter((g): g is number => g !== null);
  const averageCgpa =
    validGpas.length > 0
      ? Math.round((validGpas.reduce((a, b) => a + b, 0) / validGpas.length) * 100) / 100
      : 0;

  const gpaBuckets = [
    { range: '3.60 - 4.00', label: 'Xuất sắc', count: 0 },
    { range: '3.20 - 3.59', label: 'Giỏi', count: 0 },
    { range: '2.50 - 3.19', label: 'Khá', count: 0 },
    { range: '2.00 - 2.49', label: 'Trung bình', count: 0 },
    { range: 'Dưới 2.00', label: 'Cảnh báo', count: 0 },
  ];
  for (const g of validGpas) {
    if (g >= 3.6) gpaBuckets[0].count += 1;
    else if (g >= 3.2) gpaBuckets[1].count += 1;
    else if (g >= 2.5) gpaBuckets[2].count += 1;
    else if (g >= 2.0) gpaBuckets[3].count += 1;
    else gpaBuckets[4].count += 1;
  }

  const warningTypeCounts = [
    { type: 'LOW_GPA', label: 'GPA tích lũy thấp', count: 0 },
    { type: 'FAILED_CREDITS', label: 'Tín chỉ chưa đạt', count: 0 },
    { type: 'LOW_SEMESTER_GPA', label: 'GPA học kỳ thấp', count: 0 },
    { type: 'ACADEMIC_PROGRESS', label: 'Chậm tiến độ', count: 0 },
  ];
  for (const w of warnings) {
    if (w.warning_status === 'Resolved') continue;
    const item = warningTypeCounts.find((x) => x.type === w.warning_type);
    if (item) item.count += 1;
  }

  const semAgg = new Map<string, { label: string; total: number; count: number }>();
  for (const st of enrichedStudents) {
    for (const sem of st.semesters) {
      if (sem.semesterGpa === null) continue;
      const key = `${sem.academic_year} ${sem.semester}`;
      const cur = semAgg.get(key) ?? { label: `${sem.semester} (${sem.academic_year})`, total: 0, count: 0 };
      cur.total += sem.semesterGpa;
      cur.count += 1;
      semAgg.set(key, cur);
    }
  }
  const semesterAverages = Array.from(semAgg.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      semester: v.label,
      averageGpa: Math.round((v.total / v.count) * 100) / 100,
      studentsCount: v.count,
    }));

  const submissions = db
    .prepare(
      `SELECT gs.*, cs.section_code, c.course_code, c.course_name, cs.semester, cs.academic_year, l.full_name as lecturer_name
       FROM grade_submissions gs
       JOIN class_sections cs ON gs.section_id = cs.section_id
       JOIN courses c ON cs.course_id = c.course_id
       JOIN lecturers l ON gs.lecturer_id = l.lecturer_id
       ORDER BY gs.submitted_at DESC`
    )
    .all() as GradeSubmissionRecord[];

  const approvalHistory = db
    .prepare(
      `SELECT ga.*, cs.section_code, c.course_code, c.course_name, cs.semester, cs.academic_year
       FROM grade_approvals ga
       JOIN class_sections cs ON ga.section_id = cs.section_id
       JOIN courses c ON cs.course_id = c.course_id
       ORDER BY ga.reviewed_at DESC
       LIMIT 50`
    )
    .all() as Array<GradeApprovalRecord & { section_code: string; course_code: string; course_name: string; semester: string; academic_year: string }>;

  const recentActivities = db
    .prepare('SELECT * FROM academic_activities ORDER BY created_at DESC LIMIT 40')
    .all();

  const pendingSections = sections.filter((s) => s.grade_status === 'PENDING_APPROVAL');

  return {
    metrics: {
      totalStudents: enrichedStudents.length,
      activeStudents: enrichedStudents.filter((s) => s.academic_status !== 'Graduated').length,
      totalLecturers: lecturers.filter((l) => l.status === 'active').length,
      activeSections: sections.filter((s) => s.is_active === 1).length,
      pendingApprovals: pendingSections.length,
      studentsWithWarnings: enrichedStudents.filter((s) => s.activeWarningCount > 0).length,
      studentsWithLowGpa: enrichedStudents.filter(
        (s) => s.cgpa !== null && s.cgpa < settings.warningThresholds.lowCgpaThreshold
      ).length,
      totalCourses: coursesCount,
      averageCgpa,
    },
    students: enrichedStudents,
    lecturers,
    sections,
    submissions,
    approvalHistory,
    warnings,
    charts: {
      gpaDistribution: gpaBuckets,
      warningDistribution: warningTypeCounts,
      semesterAverages,
    },
    recentActivities,
    settings,
    academicTerms: getAcademicTerms(),
  };
}

app.get(
  ['/api/training/overview', '/api/admin/overview'],
  requireAuth,
  requireTrainingDepartment,
  (_req: AuthenticatedRequest, res: Response) => {
    res.json(buildTrainingOverviewPayload());
  }
);

// --- LECTURER MANAGEMENT (TRAINING DEPT) ---

app.post(
  '/api/training/lecturers',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const {
      lecturer_id,
      full_name,
      email,
      password,
      department,
      academic_rank,
      specialization,
      phone,
      office_location,
    } = req.body as Partial<LecturerProfile> & { password?: string };

    if (!lecturer_id?.trim() || !full_name?.trim() || !email?.trim() || !department?.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập mã giảng viên, họ tên, email và khoa/bộ môn.' });
      return;
    }

    const cleanId = lecturer_id.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    const dup = db
      .prepare('SELECT lecturer_id FROM lecturers WHERE lecturer_id = ? OR LOWER(email) = ?')
      .get(cleanId, cleanEmail);
    const dupUser = db
      .prepare('SELECT user_id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
      .get(cleanEmail, cleanId.toLowerCase());

    if (dup || dupUser) {
      res.status(409).json({ error: 'Mã giảng viên hoặc email đã tồn tại trong hệ thống.' });
      return;
    }

    const userId = `USR-LEC-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const passHash = bcrypt.hashSync(password?.trim() || 'Uni@12345', 10);
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(
        `INSERT INTO users (user_id, username, email, password_hash, role, account_status, display_name, avatar_url, created_at)
         VALUES (?, ?, ?, ?, 'LECTURER', 'active', ?, '/src/assets/images/avatar_admin_elena_1794819040716.jpg', ?)`
      ).run(userId, cleanId, cleanEmail, passHash, full_name.trim(), now);

      db.prepare(
        `INSERT INTO lecturers (
          lecturer_id, user_id, full_name, email, department, academic_rank, specialization, phone, office_location, status, avatar_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '/src/assets/images/avatar_admin_elena_1794819040716.jpg', ?)`
      ).run(
        cleanId,
        userId,
        full_name.trim(),
        cleanEmail,
        department.trim(),
        academic_rank?.trim() || 'Giảng viên',
        specialization?.trim() || '',
        phone?.trim() || '',
        office_location?.trim() || '',
        now
      );

      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'THÊM GIẢNG VIÊN',
        `Đã thêm giảng viên ${full_name.trim()} (${cleanId}) thuộc ${department.trim()}.`
      );
    })();

    res.status(201).json({ lecturer: getLecturerById(cleanId) });
  }
);

app.put(
  '/api/training/lecturers/:lecturerId',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { lecturerId } = req.params;
    const existing = getLecturerById(lecturerId);
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy giảng viên.' });
      return;
    }

    const body = req.body as Partial<LecturerProfile>;
    const fullName = body.full_name?.trim() || existing.full_name;
    const email = body.email?.trim().toLowerCase() || existing.email;
    const department = body.department?.trim() || existing.department;
    const rank = body.academic_rank?.trim() || existing.academic_rank;
    const specialization = body.specialization?.trim() ?? existing.specialization;
    const phone = body.phone?.trim() ?? existing.phone;
    const office = body.office_location?.trim() ?? existing.office_location;
    const status = body.status === 'inactive' ? 'inactive' : 'active';

    db.transaction(() => {
      db.prepare(
        `UPDATE lecturers
         SET full_name = ?, email = ?, department = ?, academic_rank = ?, specialization = ?, phone = ?, office_location = ?, status = ?
         WHERE lecturer_id = ?`
      ).run(fullName, email, department, rank, specialization, phone, office, status, lecturerId);

      db.prepare('UPDATE users SET display_name = ?, email = ?, account_status = ? WHERE user_id = ?').run(
        fullName,
        email,
        status,
        existing.user_id
      );

      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'CẬP NHẬT GIẢNG VIÊN',
        `Phòng Đào tạo đã cập nhật hồ sơ giảng viên ${fullName} (${lecturerId}).`
      );
    })();

    res.json({ lecturer: getLecturerById(lecturerId) });
  }
);

app.delete(
  '/api/training/lecturers/:lecturerId',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { lecturerId } = req.params;
    const existing = getLecturerById(lecturerId);
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy giảng viên.' });
      return;
    }

    const activeSubmissions = db
      .prepare('SELECT COUNT(*) as cnt FROM grade_submissions WHERE lecturer_id = ?')
      .get(lecturerId) as { cnt: number };
    if (activeSubmissions.cnt > 0) {
      res.status(409).json({
        error: 'Giảng viên đã có lịch sử nộp bảng điểm học vụ, vui lòng chuyển sang trạng thái Ngừng hoạt động thay vì xóa.',
      });
      return;
    }

    db.transaction(() => {
      db.prepare('UPDATE class_sections SET lecturer_id = NULL WHERE lecturer_id = ?').run(lecturerId);
      db.prepare('DELETE FROM users WHERE user_id = ?').run(existing.user_id);
      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'XÓA GIẢNG VIÊN',
        `Đã xóa tài khoản giảng viên ${existing.full_name} (${lecturerId}).`
      );
    })();

    res.json({ ok: true });
  }
);

// --- CLASS SECTIONS & TEACHING ASSIGNMENTS (TRAINING DEPT) ---

app.post(
  '/api/training/sections',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const {
      section_code,
      course_id,
      semester_id,
      lecturer_id,
      schedule_info,
      max_students,
      submission_deadline,
    } = req.body as {
      section_code?: string;
      course_id?: string;
      semester_id?: string;
      lecturer_id?: string | null;
      schedule_info?: string;
      max_students?: number;
      submission_deadline?: string;
    };

    const code = section_code?.trim().toUpperCase() ?? '';
    if (!code || !course_id || !semester_id) {
      res.status(400).json({ error: 'Vui lòng nhập mã lớp học phần, chọn học phần và học kỳ.' });
      return;
    }

    const course = db.prepare('SELECT course_id, course_code FROM courses WHERE course_id = ?').get(course_id) as
      | { course_id: string; course_code: string }
      | undefined;
    const sem = db
      .prepare('SELECT semester_id, academic_year, semester_name FROM semesters WHERE semester_id = ?')
      .get(semester_id) as { semester_id: string; academic_year: string; semester_name: string } | undefined;

    if (!course || !sem) {
      res.status(404).json({ error: 'Học phần hoặc học kỳ không tồn tại.' });
      return;
    }

    const dup = db.prepare('SELECT section_id FROM class_sections WHERE UPPER(section_code) = ?').get(code);
    if (dup) {
      res.status(409).json({ error: `Mã lớp học phần ${code} đã tồn tại.` });
      return;
    }

    const sectionId = `SEC-${code.replace(/[^A-Z0-9]/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const now = new Date().toISOString();
    const cleanLecturerId = lecturer_id?.trim() || null;

    db.transaction(() => {
      db.prepare(
        `INSERT INTO class_sections (
          section_id, section_code, course_id, semester_id, semester, academic_year,
          lecturer_id, schedule_info, max_students, submission_deadline, grade_status, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOT_ENTERED', 1, ?, ?)`
      ).run(
        sectionId,
        code,
        course.course_id,
        sem.semester_id,
        sem.semester_name,
        sem.academic_year,
        cleanLecturerId,
        schedule_info?.trim() || '',
        Number(max_students) > 0 ? Number(max_students) : 60,
        submission_deadline?.trim() || '',
        now,
        now
      );

      if (cleanLecturerId) {
        db.prepare(
          `INSERT OR IGNORE INTO lecturer_assignments (assignment_id, section_id, lecturer_id, assigned_by_user_id, assigned_at, is_primary)
           VALUES (?, ?, ?, ?, ?, 1)`
        ).run(`ASN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, sectionId, cleanLecturerId, req.authUser!.user_id, now);
      }

      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'MỞ LỚP HỌC PHẦN',
        `Đã tạo lớp học phần ${code} (${course.course_code} · ${sem.semester_name} ${sem.academic_year}).`
      );
    })();

    res.status(201).json({ section: getClassSections().find((s) => s.section_id === sectionId) });
  }
);

app.put(
  '/api/training/sections/:sectionId',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId } = req.params;
    const existing = db.prepare('SELECT * FROM class_sections WHERE section_id = ?').get(sectionId) as
      | {
          section_id: string;
          section_code: string;
          lecturer_id: string | null;
          schedule_info: string;
          max_students: number;
          submission_deadline: string;
          is_active: number;
        }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần.' });
      return;
    }

    const { schedule_info, max_students, submission_deadline, is_active } = req.body as {
      schedule_info?: string;
      max_students?: number;
      submission_deadline?: string;
      is_active?: number | boolean;
    };

    db.prepare(
      `UPDATE class_sections
       SET schedule_info = ?, max_students = ?, submission_deadline = ?, is_active = ?, updated_at = ?
       WHERE section_id = ?`
    ).run(
      schedule_info !== undefined ? schedule_info.trim() : existing.schedule_info,
      max_students !== undefined ? Math.max(1, Number(max_students)) : existing.max_students,
      submission_deadline !== undefined ? submission_deadline.trim() : existing.submission_deadline,
      is_active === undefined ? existing.is_active : is_active ? 1 : 0,
      new Date().toISOString(),
      sectionId
    );

    res.json({ section: getClassSections().find((s) => s.section_id === sectionId) });
  }
);

app.delete(
  '/api/training/sections/:sectionId',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId } = req.params;
    const countRow = db
      .prepare('SELECT COUNT(*) as cnt FROM enrollments WHERE section_id = ?')
      .get(sectionId) as { cnt: number };

    if (countRow.cnt > 0) {
      res.status(409).json({
        error: `Không thể xóa lớp học phần đang có ${countRow.cnt} sinh viên theo học.`,
      });
      return;
    }

    const resDel = db.prepare('DELETE FROM class_sections WHERE section_id = ?').run(sectionId);
    if (resDel.changes === 0) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần.' });
      return;
    }
    res.json({ ok: true });
  }
);

app.post(
  '/api/training/sections/:sectionId/assign-lecturer',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId } = req.params;
    const { lecturer_id } = req.body as { lecturer_id?: string | null };

    const section = db.prepare('SELECT * FROM class_sections WHERE section_id = ?').get(sectionId) as
      | { section_id: string; section_code: string }
      | undefined;
    if (!section) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần.' });
      return;
    }

    const cleanLecturerId = lecturer_id?.trim() || null;
    const lecturer = cleanLecturerId ? getLecturerById(cleanLecturerId) : null;
    if (cleanLecturerId && !lecturer) {
      res.status(404).json({ error: 'Không tìm thấy giảng viên được chọn.' });
      return;
    }

    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare('UPDATE class_sections SET lecturer_id = ?, updated_at = ? WHERE section_id = ?').run(
        cleanLecturerId,
        now,
        sectionId
      );
      if (cleanLecturerId) {
        db.prepare(
          `INSERT OR IGNORE INTO lecturer_assignments (assignment_id, section_id, lecturer_id, assigned_by_user_id, assigned_at, is_primary)
           VALUES (?, ?, ?, ?, ?, 1)`
        ).run(`ASN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, sectionId, cleanLecturerId, req.authUser!.user_id, now);
      }

      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'PHÂN CÔNG GIẢNG DẠY',
        lecturer
          ? `Đã phân công ${lecturer.full_name} (${lecturer.lecturer_id}) giảng dạy lớp ${section.section_code}.`
          : `Đã gỡ phân công giảng viên khỏi lớp ${section.section_code}.`
      );
    })();

    res.json({ section: getClassSections().find((s) => s.section_id === sectionId) });
  }
);

app.post(
  '/api/training/sections/:sectionId/enrollments',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId } = req.params;
    const { student_id } = req.body as { student_id?: string };
    if (!student_id?.trim()) {
      res.status(400).json({ error: 'Vui lòng chọn sinh viên.' });
      return;
    }

    const section = db.prepare('SELECT * FROM class_sections WHERE section_id = ?').get(sectionId) as
      | {
          section_id: string;
          section_code: string;
          course_id: string;
          semester_id: string;
          semester: string;
          academic_year: string;
        }
      | undefined;
    const student = getStudentById(student_id.trim());
    if (!section || !student) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần hoặc sinh viên.' });
      return;
    }

    const dup = db
      .prepare('SELECT enrollment_id FROM enrollments WHERE student_id = ? AND section_id = ?')
      .get(student.student_id, sectionId);
    if (dup) {
      res.status(409).json({ error: `Sinh viên ${student.full_name} đã có tên trong lớp ${section.section_code}.` });
      return;
    }

    const prior = db
      .prepare('SELECT COUNT(*) as cnt FROM enrollments WHERE student_id = ? AND course_id = ?')
      .get(student.student_id, section.course_id) as { cnt: number };

    const enrollmentId = `ENR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    db.prepare(
      `INSERT INTO enrollments (
        enrollment_id, student_id, course_id, section_id, semester_id, semester, academic_year,
        completion_status, is_repeated, is_official, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'In Progress', ?, 0, ?)`
    ).run(
      enrollmentId,
      student.student_id,
      section.course_id,
      section.section_id,
      section.semester_id,
      section.semester,
      section.academic_year,
      prior.cnt > 0 ? 1 : 0,
      new Date().toISOString()
    );

    logAcademicActivity(
      student.student_id,
      req.authUser!.user_id,
      'GHI DANH LỚP HỌC PHẦN',
      `Đã ghi danh sinh viên ${student.full_name} (${student.student_id}) vào lớp ${section.section_code}.`
    );

    res.status(201).json(getSectionDetail(sectionId));
  }
);

app.delete(
  '/api/training/sections/:sectionId/enrollments/:enrollmentId',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId, enrollmentId } = req.params;
    const existing = db
      .prepare('SELECT enrollment_id, student_id FROM enrollments WHERE enrollment_id = ? AND section_id = ?')
      .get(enrollmentId, sectionId) as { enrollment_id: string; student_id: string } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy sinh viên trong lớp học phần.' });
      return;
    }

    db.prepare('DELETE FROM enrollments WHERE enrollment_id = ?').run(enrollmentId);
    syncStudentDerivedRecords(existing.student_id);
    res.json(getSectionDetail(sectionId));
  }
);

// --- GRADE APPROVAL WORKFLOW (TRAINING DEPT) ---

app.get(
  '/api/training/grade-submissions/:sectionId',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const detail = getSectionDetail(req.params.sectionId);
    if (!detail) {
      res.status(404).json({ error: 'Không tìm thấy bảng điểm lớp học phần.' });
      return;
    }
    res.json(detail);
  }
);

app.post(
  '/api/training/grade-submissions/:sectionId/approve',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId } = req.params;
    const { reason } = req.body as { reason?: string };
    const detail = getSectionDetail(sectionId);
    if (!detail) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần.' });
      return;
    }

    if (detail.enrollments.length === 0) {
      res.status(400).json({ error: 'Lớp học phần chưa có sinh viên để phê duyệt.' });
      return;
    }

    const incomplete = detail.enrollments.filter(
      (e) => e.letter_grade === null || e.grade_point === null
    );
    if (incomplete.length > 0) {
      res.status(400).json({
        error: `Còn ${incomplete.length} sinh viên chưa có điểm tổng kết hợp lệ. Không thể phê duyệt.`,
      });
      return;
    }

    const now = new Date().toISOString();
    const latestSub = detail.submissions[0];

    db.transaction(() => {
      db.prepare('UPDATE enrollments SET is_official = 1, updated_at = ? WHERE section_id = ?').run(
        now,
        sectionId
      );
      db.prepare("UPDATE class_sections SET grade_status = 'APPROVED', updated_at = ? WHERE section_id = ?").run(
        now,
        sectionId
      );

      let submissionId = latestSub?.submission_id;
      if (latestSub) {
        db.prepare("UPDATE grade_submissions SET status = 'APPROVED' WHERE submission_id = ?").run(
          latestSub.submission_id
        );
      } else {
        submissionId = `SUB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        db.prepare(
          `INSERT INTO grade_submissions (
            submission_id, section_id, lecturer_id, submitted_by_user_id, submitted_at, status, student_count, graded_count, note
          ) VALUES (?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?)`
        ).run(
          submissionId,
          sectionId,
          detail.section.lecturer_id || 'GV001',
          req.authUser!.user_id,
          now,
          detail.enrollments.length,
          detail.enrollments.length,
          'Phê duyệt bảng điểm'
        );
      }

      db.prepare(
        `INSERT INTO grade_approvals (
          approval_id, submission_id, section_id, reviewed_by_user_id, reviewer_name, decision, reason, reviewed_at
        ) VALUES (?, ?, ?, ?, ?, 'APPROVED', ?, ?)`
      ).run(
        `APR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        submissionId,
        sectionId,
        req.authUser!.user_id,
        req.authUser!.display_name,
        reason?.trim() || 'Bảng điểm đầy đủ, hợp lệ theo quy chế đào tạo.',
        now
      );

      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'PHÊ DUYỆT BẢNG ĐIỂM',
        `Phòng Đào tạo đã phê duyệt bảng điểm lớp ${detail.section.section_code} (${detail.section.course_code}) và công bố kết quả chính thức cho ${detail.enrollments.length} sinh viên.`
      );
    })();

    // Recalculate GPA, credits, and warnings for all affected students immediately!
    const uniqueStudentIds = Array.from(new Set(detail.enrollments.map((e) => e.student_id)));
    for (const sid of uniqueStudentIds) {
      syncStudentDerivedRecords(sid);
    }

    res.json({ ok: true, detail: getSectionDetail(sectionId) });
  }
);

app.post(
  '/api/training/grade-submissions/:sectionId/return',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId } = req.params;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập lý do yêu cầu giảng viên chỉnh sửa lại bảng điểm.' });
      return;
    }

    const detail = getSectionDetail(sectionId);
    if (!detail) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần.' });
      return;
    }

    const now = new Date().toISOString();
    const latestSub = detail.submissions[0];

    db.transaction(() => {
      db.prepare('UPDATE enrollments SET is_official = 0, updated_at = ? WHERE section_id = ?').run(
        now,
        sectionId
      );
      db.prepare("UPDATE class_sections SET grade_status = 'NEEDS_REVISION', updated_at = ? WHERE section_id = ?").run(
        now,
        sectionId
      );
      if (latestSub) {
        db.prepare("UPDATE grade_submissions SET status = 'NEEDS_REVISION' WHERE submission_id = ?").run(
          latestSub.submission_id
        );
        db.prepare(
          `INSERT INTO grade_approvals (
            approval_id, submission_id, section_id, reviewed_by_user_id, reviewer_name, decision, reason, reviewed_at
          ) VALUES (?, ?, ?, ?, ?, 'RETURNED_FOR_REVISION', ?, ?)`
        ).run(
          `APR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          latestSub.submission_id,
          sectionId,
          req.authUser!.user_id,
          req.authUser!.display_name,
          reason.trim(),
          now
        );
      }

      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'TRẢ LẠI BẢNG ĐIỂM',
        `Phòng Đào tạo yêu cầu chỉnh sửa bảng điểm lớp ${detail.section.section_code}: ${reason.trim()}`
      );
    })();

    for (const sid of Array.from(new Set(detail.enrollments.map((e) => e.student_id)))) {
      syncStudentDerivedRecords(sid);
    }

    res.json({ ok: true, detail: getSectionDetail(sectionId) });
  }
);

app.post(
  '/api/training/grade-submissions/:sectionId/reject',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId } = req.params;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập lý do từ chối bảng điểm.' });
      return;
    }

    const detail = getSectionDetail(sectionId);
    if (!detail) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần.' });
      return;
    }

    const now = new Date().toISOString();
    const latestSub = detail.submissions[0];

    db.transaction(() => {
      db.prepare('UPDATE enrollments SET is_official = 0, updated_at = ? WHERE section_id = ?').run(
        now,
        sectionId
      );
      db.prepare("UPDATE class_sections SET grade_status = 'NEEDS_REVISION', updated_at = ? WHERE section_id = ?").run(
        now,
        sectionId
      );
      if (latestSub) {
        db.prepare("UPDATE grade_submissions SET status = 'REJECTED' WHERE submission_id = ?").run(
          latestSub.submission_id
        );
        db.prepare(
          `INSERT INTO grade_approvals (
            approval_id, submission_id, section_id, reviewed_by_user_id, reviewer_name, decision, reason, reviewed_at
          ) VALUES (?, ?, ?, ?, ?, 'REJECTED', ?, ?)`
        ).run(
          `APR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          latestSub.submission_id,
          sectionId,
          req.authUser!.user_id,
          req.authUser!.display_name,
          reason.trim(),
          now
        );
      }

      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'TỪ CHỐI BẢNG ĐIỂM',
        `Phòng Đào tạo đã từ chối bảng điểm lớp ${detail.section.section_code}: ${reason.trim()}`
      );
    })();

    for (const sid of Array.from(new Set(detail.enrollments.map((e) => e.student_id)))) {
      syncStudentDerivedRecords(sid);
    }

    res.json({ ok: true, detail: getSectionDetail(sectionId) });
  }
);

app.post(
  '/api/training/grade-submissions/:sectionId/reopen',
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { sectionId } = req.params;
    const { reason } = req.body as { reason?: string };
    const detail = getSectionDetail(sectionId);
    if (!detail) {
      res.status(404).json({ error: 'Không tìm thấy lớp học phần.' });
      return;
    }

    const now = new Date().toISOString();
    const latestSub = detail.submissions[0];

    db.transaction(() => {
      db.prepare('UPDATE enrollments SET is_official = 0, updated_at = ? WHERE section_id = ?').run(
        now,
        sectionId
      );
      db.prepare("UPDATE class_sections SET grade_status = 'IN_PROGRESS', updated_at = ? WHERE section_id = ?").run(
        now,
        sectionId
      );
      if (latestSub) {
        db.prepare(
          `INSERT INTO grade_approvals (
            approval_id, submission_id, section_id, reviewed_by_user_id, reviewer_name, decision, reason, reviewed_at
          ) VALUES (?, ?, ?, ?, ?, 'REOPENED', ?, ?)`
        ).run(
          `APR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          latestSub.submission_id,
          sectionId,
          req.authUser!.user_id,
          req.authUser!.display_name,
          reason?.trim() || 'Phòng Đào tạo mở lại bảng điểm để điều chỉnh theo đề nghị.',
          now
        );
      }

      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'MỞ LẠI BẢNG ĐIỂM',
        `Phòng Đào tạo đã mở lại bảng điểm lớp ${detail.section.section_code} để giảng viên cập nhật.`
      );
    })();

    for (const sid of Array.from(new Set(detail.enrollments.map((e) => e.student_id)))) {
      syncStudentDerivedRecords(sid);
    }

    res.json({ ok: true, detail: getSectionDetail(sectionId) });
  }
);

// --- STUDENTS / COURSES / SETTINGS / TERMS CRUD (TRAINING DEPT) ---

app.post(
  ['/api/training/students', '/api/admin/students'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const {
      student_id,
      full_name,
      email,
      password,
      faculty,
      major,
      academic_year,
      enrollment_year,
      total_required_credits,
      expected_credits_per_semester,
      advisor_name,
    } = req.body as Partial<StudentProfile> & { password?: string };

    if (!student_id?.trim() || !full_name?.trim() || !email?.trim() || !faculty?.trim() || !major?.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ mã sinh viên, họ tên, email, khoa và ngành học.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanId = student_id.trim().toUpperCase();
    const reqCredits = Number(total_required_credits ?? 130);
    const expCredits = Number(expected_credits_per_semester ?? 15);
    const enrollYr = Number(enrollment_year ?? new Date().getFullYear());

    if (!isValidIntegerCredit(reqCredits, 1, 300) || !isValidIntegerCredit(expCredits, 1, 60)) {
      res.status(400).json({
        error: 'Số tín chỉ yêu cầu và tín chỉ kỳ vọng mỗi học kỳ phải là số nguyên dương.',
      });
      return;
    }

    const existing = db
      .prepare('SELECT student_id FROM students WHERE student_id = ? OR LOWER(email) = ?')
      .get(cleanId, cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'Mã sinh viên hoặc email đã tồn tại trong hệ thống.' });
      return;
    }

    const userId = `USR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const username = cleanEmail.split('@')[0] + '-' + crypto.randomUUID().slice(0, 3);
    const passHash = bcrypt.hashSync(password?.trim() || 'Student@2026!', 10);
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(
        `INSERT INTO users (user_id, username, email, password_hash, role, account_status, display_name, avatar_url, created_at)
         VALUES (?, ?, ?, ?, 'STUDENT', 'active', ?, '/src/assets/images/avatar_student_alex_1794819039297.jpg', ?)`
      ).run(userId, username, cleanEmail, passHash, full_name.trim(), now);

      db.prepare(
        `INSERT INTO students (
          student_id, user_id, full_name, email, faculty, major, academic_year,
          enrollment_year, total_required_credits, expected_credits_per_semester,
          academic_status, phone, advisor_name, avatar_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', '', ?, '/src/assets/images/avatar_student_alex_1794819039297.jpg')`
      ).run(
        cleanId,
        userId,
        full_name.trim(),
        cleanEmail,
        faculty.trim(),
        major.trim(),
        academic_year?.trim() || 'Năm thứ 1',
        enrollYr,
        reqCredits,
        expCredits,
        advisor_name?.trim() || 'Văn phòng Cố vấn học tập'
      );

      logAcademicActivity(
        cleanId,
        req.authUser!.user_id,
        'THÊM SINH VIÊN',
        `Đã tạo hồ sơ sinh viên ${full_name.trim()} (${cleanId}).`
      );
    })();

    res.status(201).json({ student: getStudentById(cleanId) });
  }
);

app.put(
  ['/api/training/students/:studentId', '/api/admin/students/:studentId'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId } = req.params;
    const student = getStudentById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.' });
      return;
    }

    const body = req.body as Partial<StudentProfile>;
    const fullName = body.full_name?.trim() || student.full_name;
    const email = body.email?.trim().toLowerCase() || student.email;
    const faculty = body.faculty?.trim() || student.faculty;
    const major = body.major?.trim() || student.major;
    const academicYear = body.academic_year?.trim() || student.academic_year;
    const enrollmentYear = Number(body.enrollment_year ?? student.enrollment_year);
    const requiredCredits = Number(body.total_required_credits ?? student.total_required_credits);
    const expectedCredits = Number(body.expected_credits_per_semester ?? student.expected_credits_per_semester);
    const academicStatus = body.academic_status?.trim() || student.academic_status;
    const advisorName = body.advisor_name?.trim() ?? student.advisor_name;
    const phone = body.phone?.trim() ?? student.phone;

    if (!isValidIntegerCredit(requiredCredits, 1, 300) || !isValidIntegerCredit(expectedCredits, 1, 60)) {
      res.status(400).json({ error: 'Số tín chỉ yêu cầu và tín chỉ kỳ vọng phải là số nguyên dương.' });
      return;
    }

    db.transaction(() => {
      db.prepare(
        `UPDATE students
         SET full_name = ?, email = ?, faculty = ?, major = ?, academic_year = ?,
             enrollment_year = ?, total_required_credits = ?, expected_credits_per_semester = ?,
             academic_status = ?, advisor_name = ?, phone = ?
         WHERE student_id = ?`
      ).run(
        fullName,
        email,
        faculty,
        major,
        academicYear,
        enrollmentYear,
        requiredCredits,
        expectedCredits,
        academicStatus,
        advisorName,
        phone,
        studentId
      );
      db.prepare('UPDATE users SET display_name = ?, email = ? WHERE user_id = ?').run(
        fullName,
        email,
        student.user_id
      );
    })();

    syncStudentDerivedRecords(studentId);
    logAcademicActivity(
      studentId,
      req.authUser!.user_id,
      'CẬP NHẬT SINH VIÊN',
      `Phòng Đào tạo đã cập nhật hồ sơ sinh viên ${fullName} (${studentId}).`
    );

    res.json({ student: getStudentById(studentId) });
  }
);

app.delete(
  ['/api/training/students/:studentId', '/api/admin/students/:studentId'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId } = req.params;
    const student = getStudentById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.' });
      return;
    }

    db.transaction(() => {
      db.prepare('DELETE FROM users WHERE user_id = ?').run(student.user_id);
      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'XÓA SINH VIÊN',
        `Đã xóa tài khoản sinh viên ${student.full_name} (${studentId}).`
      );
    })();

    res.json({ ok: true });
  }
);

app.post(
  ['/api/training/courses', '/api/admin/courses'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { course_code, course_name, credit_hours, department, description } = req.body as {
      course_code?: string;
      course_name?: string;
      credit_hours?: number;
      department?: string;
      description?: string;
    };

    const code = course_code?.trim().toUpperCase() ?? '';
    const name = course_name?.trim() ?? '';
    const creditCheck = validateCourseCredit(credit_hours);

    if (!code || !name) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ mã học phần và tên học phần.' });
      return;
    }
    if (!creditCheck.valid) {
      res.status(400).json({ error: creditCheck.error });
      return;
    }
    const credits = creditCheck.value;

    const dup = db.prepare('SELECT course_id FROM courses WHERE UPPER(course_code) = ?').get(code);
    if (dup) {
      res.status(409).json({ error: `Mã học phần ${code} đã tồn tại trong danh mục.` });
      return;
    }

    const courseId = `CRS-${code.replace(/[^A-Z0-9]/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    db.prepare(
      `INSERT INTO courses (course_id, course_code, course_name, credit_hours, department, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(courseId, code, name, credits, department?.trim() || 'Khoa học cơ bản', description?.trim() || '');

    logAcademicActivity(
      null,
      req.authUser!.user_id,
      'THÊM DANH MỤC HỌC PHẦN',
      `Đã thêm học phần ${code} — ${name} (${credits} tín chỉ) vào danh mục.`
    );

    res.status(201).json(db.prepare('SELECT * FROM courses WHERE course_id = ?').get(courseId));
  }
);

app.put(
  ['/api/training/courses/:courseId', '/api/admin/courses/:courseId'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { courseId } = req.params;
    const existing = db.prepare('SELECT * FROM courses WHERE course_id = ?').get(courseId) as
      | { course_id: string; course_code: string; course_name: string; credit_hours: number; department: string; description: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy học phần.' });
      return;
    }

    const { course_code, course_name, credit_hours, department, description } = req.body as {
      course_code?: string;
      course_name?: string;
      credit_hours?: number;
      department?: string;
      description?: string;
    };

    const code = (course_code ?? existing.course_code).trim().toUpperCase();
    const name = (course_name ?? existing.course_name).trim();
    const creditCheck =
      credit_hours !== undefined
        ? validateCourseCredit(credit_hours)
        : { valid: true, value: Math.max(1, Math.round(existing.credit_hours)) };

    if (!code || !name) {
      res.status(400).json({ error: 'Mã học phần và tên học phần phải hợp lệ.' });
      return;
    }
    if (!creditCheck.valid) {
      res.status(400).json({ error: creditCheck.error });
      return;
    }
    const credits = creditCheck.value;

    db.prepare(
      `UPDATE courses SET course_code = ?, course_name = ?, credit_hours = ?, department = ?, description = ?
       WHERE course_id = ?`
    ).run(
      code,
      name,
      credits,
      department?.trim() ?? existing.department,
      description?.trim() ?? existing.description,
      courseId
    );

    recalculateAllStudents();
    logAcademicActivity(
      null,
      req.authUser!.user_id,
      'CẬP NHẬT HỌC PHẦN',
      `Đã cập nhật học phần ${code} — ${name} (${credits} tín chỉ).`
    );

    res.json(db.prepare('SELECT * FROM courses WHERE course_id = ?').get(courseId));
  }
);

app.delete(
  ['/api/training/courses/:courseId', '/api/admin/courses/:courseId'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { courseId } = req.params;
    const inUse = db
      .prepare('SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ?')
      .get(courseId) as { cnt: number };

    if (inUse.cnt > 0) {
      res.status(409).json({
        error: `Không thể xóa học phần vì đang được liên kết với ${inUse.cnt} bản ghi đăng ký của sinh viên.`,
      });
      return;
    }

    const result = db.prepare('DELETE FROM courses WHERE course_id = ?').run(courseId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Không tìm thấy học phần.' });
      return;
    }
    res.json({ ok: true });
  }
);

app.put(
  ['/api/training/settings/:settingName', '/api/admin/settings/:settingName'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { settingName } = req.params;
    if (
      ![
        'grading_scale',
        'classification_bands',
        'warning_thresholds',
        'gpa_policy',
        'assessment_weights',
      ].includes(settingName)
    ) {
      res.status(400).json({ error: 'Khóa cấu hình học vụ không hợp lệ.' });
      return;
    }

    const { value } = req.body as { value?: unknown };
    if (value === undefined || value === null) {
      res.status(400).json({ error: 'Giá trị cấu hình không được để trống.' });
      return;
    }

    if (settingName === 'grading_scale') {
      if (!Array.isArray(value) || value.length === 0) {
        res.status(400).json({ error: 'Thang điểm phải chứa ít nhất một mức điểm hợp lệ.' });
        return;
      }
      for (const item of value) {
        if (
          typeof item.letter !== 'string' ||
          !item.letter.trim() ||
          typeof item.point !== 'number' ||
          item.point < 0 ||
          item.point > 4.0 ||
          typeof item.minNumeric !== 'number' ||
          typeof item.maxNumeric !== 'number' ||
          item.minNumeric < 0 ||
          item.maxNumeric > 10 ||
          item.minNumeric > item.maxNumeric
        ) {
          res.status(400).json({
            error:
              'Mỗi dòng thang điểm cần có điểm chữ hợp lệ, điểm hệ 4 (0.00–4.00) và ngưỡng thang 10 hợp lệ (0.00–10.00).',
          });
          return;
        }
      }
    }

    if (settingName === 'warning_thresholds') {
      const wt = value as Record<string, number>;
      if (
        wt.lowCgpaThreshold < 0 ||
        wt.lowCgpaThreshold > 4 ||
        wt.failedCreditsThreshold < 1 ||
        wt.lowSemesterGpaThreshold < 0 ||
        wt.lowSemesterGpaThreshold > 4
      ) {
        res.status(400).json({ error: 'Ngưỡng cảnh báo chứa giá trị nằm ngoài giới hạn cho phép.' });
        return;
      }
    }

    if (settingName === 'assessment_weights') {
      const aw = value as AssessmentWeightsConfig;
      const weights = [
        Number(aw.attendanceWeight),
        Number(aw.assignmentWeight),
        Number(aw.midtermWeight),
        Number(aw.finalWeight),
      ];
      if (weights.some((w) => !Number.isFinite(w) || w < 0 || w > 1)) {
        res.status(400).json({ error: 'Mỗi trọng số thành phần điểm phải nằm trong khoảng 0 đến 1 (0% - 100%).' });
        return;
      }
      const sum = weights.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1) > 0.01) {
        res.status(400).json({ error: 'Tổng 4 trọng số thành phần điểm phải bằng 100% (1.00).' });
        return;
      }
    }

    db.prepare(
      `INSERT INTO academic_settings (setting_id, setting_name, setting_value, description, updated_at)
       VALUES (?, ?, ?, '', ?)
       ON CONFLICT(setting_name) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`
    ).run(
      `SET-${settingName.toUpperCase()}`,
      settingName,
      JSON.stringify(value),
      new Date().toISOString()
    );

    recalculateAllStudents();
    const settingLabels: Record<string, string> = {
      grading_scale: 'thang điểm quy đổi',
      classification_bands: 'ngưỡng phân loại học lực',
      warning_thresholds: 'ngưỡng cảnh báo học vụ',
      gpa_policy: 'quy chế tính điểm GPA',
      assessment_weights: 'trọng số thành phần điểm',
    };
    logAcademicActivity(
      null,
      req.authUser!.user_id,
      'CẬP NHẬT CẤU HÌNH',
      `Phòng Đào tạo đã cập nhật ${settingLabels[settingName] || settingName} và tính toán lại dữ liệu toàn trường.`
    );

    res.json({ settings: getAcademicSettings() });
  }
);

app.post(
  ['/api/training/academic-years', '/api/admin/academic-years'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { year_code, year_name, create_default_semesters } = req.body as {
      year_code?: string;
      year_name?: string;
      create_default_semesters?: boolean;
    };
    const code = (year_code ?? '').trim().replace('–', '-');
    const match = code.match(/^(\d{4})-(\d{4})$/);
    if (!match) {
      res.status(400).json({ error: 'Mã năm học phải theo định dạng YYYY-YYYY (ví dụ: 2027-2028).' });
      return;
    }
    const startYear = Number(match[1]);
    const endYear = Number(match[2]);
    if (endYear !== startYear + 1) {
      res.status(400).json({ error: 'Năm kết thúc phải liền sau năm bắt đầu đúng 1 năm.' });
      return;
    }

    const dup = db.prepare('SELECT year_id FROM academic_years WHERE year_code = ?').get(code);
    if (dup) {
      res.status(409).json({ error: `Năm học ${code} đã tồn tại trong hệ thống.` });
      return;
    }

    const yearId = `AY-${code}`;
    const cleanName = year_name?.trim() || `Năm học ${startYear}–${endYear}`;
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(
        `INSERT INTO academic_years (year_id, year_code, year_name, start_year, end_year, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      ).run(yearId, code, cleanName, startYear, endYear, now);

      if (create_default_semesters !== false) {
        const defaults = [
          { code: 'HK1', name: 'Học kỳ 1', order: 1 },
          { code: 'HK2', name: 'Học kỳ 2', order: 2 },
          { code: 'HK_HE', name: 'Học kỳ hè', order: 3 },
        ];
        const insertSem = db.prepare(
          `INSERT INTO semesters (semester_id, year_id, academic_year, semester_code, semester_name, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`
        );
        for (const s of defaults) {
          insertSem.run(`SEM-${code}-${s.code}`, yearId, code, s.code, s.name, s.order);
        }
      }

      logAcademicActivity(
        null,
        req.authUser!.user_id,
        'CẤU HÌNH NĂM HỌC',
        `Đã tạo ${cleanName} (${code}) trong danh mục kỳ học.`
      );
    })();

    res.status(201).json(getAcademicTerms());
  }
);

app.put(
  ['/api/training/academic-years/:yearId', '/api/admin/academic-years/:yearId'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { yearId } = req.params;
    const existing = db.prepare('SELECT * FROM academic_years WHERE year_id = ?').get(yearId) as
      | { year_id: string; year_name: string; is_active: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy năm học.' });
      return;
    }

    const { year_name, is_active } = req.body as { year_name?: string; is_active?: boolean | number };
    const nextName = year_name?.trim() || existing.year_name;
    const nextActive = is_active === undefined ? existing.is_active : is_active ? 1 : 0;

    db.prepare('UPDATE academic_years SET year_name = ?, is_active = ? WHERE year_id = ?').run(
      nextName,
      nextActive,
      yearId
    );

    res.json(getAcademicTerms());
  }
);

app.post(
  ['/api/training/semesters', '/api/admin/semesters'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { year_id, semester_code, semester_name, sort_order } = req.body as {
      year_id?: string;
      semester_code?: string;
      semester_name?: string;
      sort_order?: number;
    };

    if (!year_id || !semester_name?.trim()) {
      res.status(400).json({ error: 'Vui lòng chọn năm học và nhập tên học kỳ.' });
      return;
    }

    const yearRow = db
      .prepare('SELECT year_id, year_code FROM academic_years WHERE year_id = ?')
      .get(year_id) as { year_id: string; year_code: string } | undefined;
    if (!yearRow) {
      res.status(404).json({ error: 'Năm học không tồn tại.' });
      return;
    }

    const cleanName = semester_name.trim();
    const dup = db
      .prepare('SELECT semester_id FROM semesters WHERE year_id = ? AND LOWER(semester_name) = LOWER(?)')
      .get(yearRow.year_id, cleanName);
    if (dup) {
      res.status(409).json({ error: `${cleanName} đã tồn tại trong năm học ${yearRow.year_code}.` });
      return;
    }

    const cleanCode =
      semester_code?.trim().toUpperCase() ||
      (cleanName.toLowerCase().includes('hè') ? 'HK_HE' : cleanName.includes('2') ? 'HK2' : 'HK1');
    const order = Number(sort_order) || (cleanCode === 'HK_HE' ? 3 : cleanCode === 'HK2' ? 2 : 1);
    const semId = `SEM-${yearRow.year_code}-${cleanCode}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    db.prepare(
      `INSERT INTO semesters (semester_id, year_id, academic_year, semester_code, semester_name, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).run(semId, yearRow.year_id, yearRow.year_code, cleanCode, cleanName, order);

    logAcademicActivity(
      null,
      req.authUser!.user_id,
      'CẤU HÌNH HỌC KỲ',
      `Đã thêm ${cleanName} cho năm học ${yearRow.year_code}.`
    );

    res.status(201).json(getAcademicTerms());
  }
);

app.put(
  ['/api/training/semesters/:semesterId', '/api/admin/semesters/:semesterId'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { semesterId } = req.params;
    const existing = db.prepare('SELECT * FROM semesters WHERE semester_id = ?').get(semesterId) as
      | { semester_id: string; semester_name: string; is_active: number; sort_order: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy học kỳ.' });
      return;
    }

    const { semester_name, is_active, sort_order } = req.body as {
      semester_name?: string;
      is_active?: boolean | number;
      sort_order?: number;
    };
    const nextName = semester_name?.trim() || existing.semester_name;
    const nextActive = is_active === undefined ? existing.is_active : is_active ? 1 : 0;
    const nextOrder = sort_order !== undefined ? Number(sort_order) : existing.sort_order;

    db.prepare('UPDATE semesters SET semester_name = ?, is_active = ?, sort_order = ? WHERE semester_id = ?').run(
      nextName,
      nextActive,
      nextOrder,
      semesterId
    );

    res.json(getAcademicTerms());
  }
);

// --- TUITION & REAL QR PAYMENT ROUTES ---

const MAX_QR_DATA_URL_CHARS = 3_500_000;
const QR_DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

app.get(
  '/api/students/:studentId/tuition',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId } = req.params;
    if (!assertStudentAccess(req, res, studentId)) return;
    const student = getStudentById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.' });
      return;
    }
    res.json(getStudentTuitionOverview(studentId));
  }
);

app.post(
  '/api/students/:studentId/tuition/pay',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const { studentId } = req.params;
    if (!assertStudentAccess(req, res, studentId)) return;
    const student = getStudentById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ sinh viên.' });
      return;
    }

    const { semester, academic_year, transfer_note } = req.body as {
      semester?: string;
      academic_year?: string;
      transfer_note?: string;
    };

    const cleanSemester = semester?.trim();
    const cleanYear = academic_year?.trim();
    if (!cleanSemester || !cleanYear) {
      res.status(400).json({ error: 'Vui lòng chọn học kỳ và năm học cần thanh toán.' });
      return;
    }

    const currentOverview = getStudentTuitionOverview(studentId);
    const targetInvoice = currentOverview.invoices.find(
      (inv) => inv.semester === cleanSemester && inv.academic_year === cleanYear
    );

    if (!targetInvoice || targetInvoice.totalCredits <= 0) {
      res.status(404).json({ error: 'Không tìm thấy hóa đơn học phí cho học kỳ đã chọn.' });
      return;
    }

    if (targetInvoice.status === 'PAID') {
      res.status(409).json({ error: 'Học kỳ này đã được thanh toán hoàn tất trước đó.' });
      return;
    }

    const now = new Date().toISOString();
    const paymentId = `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const transactionRef = `UNI-QR-${Date.now().toString().slice(-6)}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;
    const resolvedNote =
      transfer_note?.trim() ||
      buildTuitionTransferNote(
        currentOverview.config.transferNotePrefix,
        studentId,
        cleanSemester,
        cleanYear
      );

    db.prepare(
      `INSERT INTO tuition_payments (
        payment_id, student_id, semester, academic_year, total_credits, unit_price, amount,
        payment_method, transaction_ref, transfer_note, status, paid_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'QR_SCAN', ?, ?, 'PAID', ?, ?)`
    ).run(
      paymentId,
      studentId,
      cleanSemester,
      cleanYear,
      targetInvoice.totalCredits,
      targetInvoice.unitPrice,
      targetInvoice.totalAmount,
      transactionRef,
      resolvedNote,
      now,
      now
    );

    const payment = db
      .prepare(
        `SELECT p.*, s.full_name as student_name, s.major as student_major
         FROM tuition_payments p
         JOIN students s ON p.student_id = s.student_id
         WHERE p.payment_id = ?`
      )
      .get(paymentId) as TuitionPaymentRecord;

    logAcademicActivity(
      studentId,
      req.authUser!.user_id,
      'THANH TOÁN HỌC PHÍ',
      `Xác nhận thanh toán QR học phí ${cleanSemester} (${cleanYear}) — ${targetInvoice.totalCredits} TC (${targetInvoice.totalAmount.toLocaleString('vi-VN')} đ). Mã GD: ${transactionRef}.`
    );

    res.status(201).json({
      ok: true,
      payment,
      overview: getStudentTuitionOverview(studentId),
    });
  }
);

app.get(
  ['/api/training/tuition', '/api/admin/tuition'],
  requireAuth,
  requireTrainingDepartment,
  (_req: AuthenticatedRequest, res: Response) => {
    res.json(getTrainingTuitionOverview());
  }
);

app.put(
  ['/api/training/tuition-config', '/api/admin/tuition-config'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const current = getTuitionConfig();
    const body = req.body as Partial<TuitionConfig>;

    const nextPrice =
      body.pricePerCredit !== undefined ? Number(body.pricePerCredit) : current.pricePerCredit;
    if (!Number.isInteger(nextPrice) || nextPrice < 1000 || nextPrice > 50_000_000) {
      res.status(400).json({
        error: 'Đơn giá mỗi tín chỉ phải là số nguyên hợp lệ (từ 1.000 đ đến 50.000.000 đ).',
      });
      return;
    }

    const nextDebtThreshold =
      body.debtAlertThreshold !== undefined
        ? Number(body.debtAlertThreshold)
        : current.debtAlertThreshold;
    if (!Number.isInteger(nextDebtThreshold) || nextDebtThreshold < 0 || nextDebtThreshold > 500_000_000) {
      res.status(400).json({
        error: 'Ngưỡng cảnh báo công nợ phải là số nguyên không âm hợp lệ (tối đa 500.000.000 đ).',
      });
      return;
    }

    const nextBankName = (body.bankName ?? current.bankName).trim();
    const nextAccountNumber = (body.accountNumber ?? current.accountNumber).trim();
    const nextAccountHolder = (body.accountHolder ?? current.accountHolder).trim();
    const nextPrefix = (body.transferNotePrefix ?? current.transferNotePrefix)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');

    if (!nextBankName || !nextAccountNumber || !nextAccountHolder || !nextPrefix) {
      res.status(400).json({
        error: 'Vui lòng điền đầy đủ tên ngân hàng, số tài khoản, chủ tài khoản và tiền tố nội dung.',
      });
      return;
    }

    let nextQrImage: string | null = current.qrImageDataUrl;
    if (body.qrImageDataUrl !== undefined) {
      if (body.qrImageDataUrl === null || body.qrImageDataUrl === '') {
        nextQrImage = null;
      } else if (typeof body.qrImageDataUrl === 'string') {
        const trimmed = body.qrImageDataUrl.trim();
        if (trimmed.length > MAX_QR_DATA_URL_CHARS) {
          res.status(400).json({
            error: 'Ảnh mã QR quá lớn. Vui lòng chọn ảnh dung lượng tối đa 2.5MB.',
          });
          return;
        }
        if (!QR_DATA_URL_REGEX.test(trimmed)) {
          res.status(400).json({
            error: 'Định dạng ảnh mã QR không hợp lệ. Chỉ chấp nhận PNG, JPG, WEBP hoặc GIF.',
          });
          return;
        }
        nextQrImage = trimmed;
      } else {
        res.status(400).json({ error: 'Dữ liệu ảnh QR không hợp lệ.' });
        return;
      }
    }

    const now = new Date().toISOString();
    const updatedConfig: TuitionConfig = {
      pricePerCredit: nextPrice,
      debtAlertThreshold: nextDebtThreshold,
      bankName: nextBankName,
      accountNumber: nextAccountNumber,
      accountHolder: nextAccountHolder,
      transferNotePrefix: nextPrefix,
      qrImageDataUrl: nextQrImage,
      updatedAt: now,
    };

    db.prepare(
      `INSERT INTO academic_settings (setting_id, setting_name, setting_value, description, updated_at)
       VALUES ('SET-TUITION-CONFIG', 'tuition_config', ?, ?, ?)
       ON CONFLICT(setting_name) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = excluded.updated_at`
    ).run(
      JSON.stringify(updatedConfig),
      'Đơn giá tín chỉ, thông tin ngân hàng và mã QR thu học phí chính thức của nhà trường',
      now
    );

    logAcademicActivity(
      null,
      req.authUser!.user_id,
      'CẤU HÌNH HỌC PHÍ & QR',
      `Cập nhật đơn giá ${nextPrice.toLocaleString('vi-VN')} đ/TC, tài khoản ${nextAccountNumber}${nextQrImage ? ' và ảnh QR chính thức' : ''}.`
    );

    res.json({
      ok: true,
      config: updatedConfig,
      overview: getTrainingTuitionOverview(),
    });
  }
);

app.delete(
  ['/api/training/tuition/payments/:paymentId', '/api/admin/tuition/payments/:paymentId'],
  requireAuth,
  requireTrainingDepartment,
  (req: AuthenticatedRequest, res: Response) => {
    const { paymentId } = req.params;
    const existing = db
      .prepare('SELECT * FROM tuition_payments WHERE payment_id = ?')
      .get(paymentId) as TuitionPaymentRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy giao dịch thanh toán học phí.' });
      return;
    }

    db.prepare('DELETE FROM tuition_payments WHERE payment_id = ?').run(paymentId);

    logAcademicActivity(
      existing.student_id,
      req.authUser!.user_id,
      'HOÀN TÁC GIAO DỊCH HỌC PHÍ',
      `Phòng Đào tạo đã đặt lại trạng thái chưa thanh toán cho hóa đơn ${existing.semester} (${existing.academic_year}) — Mã GD ${existing.transaction_ref}.`
    );

    res.json({
      ok: true,
      overview: getTrainingTuitionOverview(),
    });
  }
);

// --- VITE DEV / PRODUCTION STATIC SERVER ---

function resolveCliArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === flag && args[i + 1]) {
      return args[i + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

function resolveServerPort(): number {
  const cliPort = Number(resolveCliArg('--port'));
  if (Number.isInteger(cliPort) && cliPort > 0) {
    return cliPort;
  }
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  if (Number.isInteger(envPort) && envPort > 0 && envPort !== nginxPort) {
    return envPort;
  }
  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT);
  if (Number.isInteger(defaultAppPort) && defaultAppPort > 0) {
    return defaultAppPort;
  }
  return 3000;
}

function resolveServerHost(): string {
  return resolveCliArg('--host') || process.env.HOST || '0.0.0.0';
}

async function startServer(): Promise<void> {
  const PORT = resolveServerPort();
  const HOST = resolveServerHost();
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`UniPortal Academic Portal listening on http://${HOST}:${PORT}`);
  });

  const shutdown = (): void => {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
    } catch {
      // Ignore shutdown DB errors
    }
    httpServer.close(() => process.exit(0));
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

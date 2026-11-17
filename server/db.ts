import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  DEFAULT_ASSESSMENT_WEIGHTS,
  DEFAULT_CLASSIFICATION_BANDS,
  DEFAULT_GPA_POLICY,
  DEFAULT_GRADING_SCALE,
  DEFAULT_TUITION_CONFIG,
  DEFAULT_WARNING_THRESHOLDS,
  buildTuitionTransferNote,
  resolveLetterFromNumeric,
} from '../shared/academicLogic.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'academic.db');

function removeSqliteSidecars(dbPath: string): void {
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${dbPath}${suffix}`;
    if (fs.existsSync(sidecar)) {
      fs.unlinkSync(sidecar);
    }
  }
}

function removeDatabaseFiles(dbPath: string): void {
  removeSqliteSidecars(dbPath);
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

function openHealthyDatabase(dbPath: string): Database.Database {
  const dbMissingOrEmpty = !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0;
  if (dbMissingOrEmpty) {
    // Prevent SQLite from replaying orphaned WAL/SHM files against an empty DB
    removeSqliteSidecars(dbPath);
  }

  let instance: Database.Database | null = null;
  try {
    instance = new Database(dbPath);
    instance.pragma('journal_mode = WAL');
    const check = instance.pragma('quick_check', { simple: true });
    if (check !== 'ok') {
      throw new Error(`SQLite quick_check failed: ${String(check)}`);
    }
    instance.pragma('foreign_keys = ON');
    return instance;
  } catch (err) {
    console.warn('[UniPortal DB] Corrupted or orphaned SQLite state detected, rebuilding clean database:', err);
    try {
      instance?.close();
    } catch {
      // Ignore close error on broken handle
    }
    removeDatabaseFiles(dbPath);
    const fresh = new Database(dbPath);
    fresh.pragma('journal_mode = WAL');
    fresh.pragma('foreign_keys = ON');
    return fresh;
  }
}

export const db = openHealthyDatabase(DB_PATH);

export function getJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'MY_SESSION_SECRET') {
    return process.env.JWT_SECRET;
  }
  const secretFile = path.join(DATA_DIR, '.jwt_secret');
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf8').trim();
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretFile, generated, { encoding: 'utf8', mode: 0o600 });
  return generated;
}

export function initializeDatabaseSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('STUDENT', 'LECTURER', 'TRAINING_DEPARTMENT')),
      account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'inactive')),
      display_name TEXT NOT NULL,
      avatar_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lecturers (
      lecturer_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      academic_rank TEXT NOT NULL DEFAULT 'Giảng viên',
      specialization TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      office_location TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      avatar_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS students (
      student_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      faculty TEXT NOT NULL,
      major TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      enrollment_year INTEGER NOT NULL,
      total_required_credits INTEGER NOT NULL DEFAULT 130 CHECK (total_required_credits > 0),
      expected_credits_per_semester INTEGER NOT NULL DEFAULT 15 CHECK (expected_credits_per_semester > 0),
      academic_status TEXT NOT NULL DEFAULT 'Active',
      phone TEXT NOT NULL DEFAULT '',
      advisor_name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS courses (
      course_id TEXT PRIMARY KEY,
      course_code TEXT NOT NULL UNIQUE,
      course_name TEXT NOT NULL,
      credit_hours REAL NOT NULL CHECK (credit_hours > 0),
      department TEXT NOT NULL DEFAULT 'Khoa học cơ bản',
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      enrollment_id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      semester TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      letter_grade TEXT,
      numeric_grade REAL,
      grade_point REAL,
      completion_status TEXT NOT NULL CHECK (completion_status IN ('Completed', 'Failed', 'In Progress', 'Withdrawn')),
      is_repeated INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS gpa_records (
      gpa_id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      semester TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      semester_gpa REAL,
      cumulative_gpa REAL,
      semester_credits REAL NOT NULL DEFAULT 0,
      earned_credits REAL NOT NULL DEFAULT 0,
      calculated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS academic_warnings (
      warning_id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      warning_type TEXT NOT NULL CHECK (warning_type IN ('LOW_GPA', 'FAILED_CREDITS', 'LOW_SEMESTER_GPA', 'ACADEMIC_PROGRESS')),
      warning_title TEXT NOT NULL,
      description TEXT NOT NULL,
      triggering_condition TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
      warning_status TEXT NOT NULL CHECK (warning_status IN ('Active', 'Read', 'Resolved')),
      suggested_action TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      year_id TEXT PRIMARY KEY,
      year_code TEXT NOT NULL UNIQUE,
      year_name TEXT NOT NULL,
      start_year INTEGER NOT NULL,
      end_year INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS semesters (
      semester_id TEXT PRIMARY KEY,
      year_id TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      semester_code TEXT NOT NULL,
      semester_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (year_id) REFERENCES academic_years(year_id) ON DELETE CASCADE,
      UNIQUE (year_id, semester_name)
    );

    CREATE TABLE IF NOT EXISTS grade_records (
      grade_id TEXT PRIMARY KEY,
      enrollment_id TEXT NOT NULL UNIQUE,
      student_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      letter_grade TEXT,
      numeric_grade REAL,
      grade_point REAL,
      is_final INTEGER NOT NULL DEFAULT 0,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (enrollment_id) REFERENCES enrollments(enrollment_id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS academic_settings (
      setting_id TEXT PRIMARY KEY,
      setting_name TEXT NOT NULL UNIQUE,
      setting_value TEXT NOT NULL,
      description TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_activities (
      activity_id TEXT PRIMARY KEY,
      student_id TEXT,
      actor_user_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_key TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_sections (
      section_id TEXT PRIMARY KEY,
      section_code TEXT NOT NULL UNIQUE,
      course_id TEXT NOT NULL,
      semester_id TEXT NOT NULL,
      semester TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      lecturer_id TEXT,
      schedule_info TEXT NOT NULL DEFAULT '',
      max_students INTEGER NOT NULL DEFAULT 60,
      submission_deadline TEXT NOT NULL DEFAULT '',
      grade_status TEXT NOT NULL DEFAULT 'NOT_ENTERED' CHECK (grade_status IN ('NOT_ENTERED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'APPROVED')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE RESTRICT,
      FOREIGN KEY (semester_id) REFERENCES semesters(semester_id) ON DELETE RESTRICT,
      FOREIGN KEY (lecturer_id) REFERENCES lecturers(lecturer_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS lecturer_assignments (
      assignment_id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      lecturer_id TEXT NOT NULL,
      assigned_by_user_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (section_id) REFERENCES class_sections(section_id) ON DELETE CASCADE,
      FOREIGN KEY (lecturer_id) REFERENCES lecturers(lecturer_id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
      UNIQUE (section_id, lecturer_id)
    );

    CREATE TABLE IF NOT EXISTS grade_submissions (
      submission_id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      lecturer_id TEXT NOT NULL,
      submitted_by_user_id TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'NEEDS_REVISION', 'REJECTED')),
      student_count INTEGER NOT NULL DEFAULT 0,
      graded_count INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (section_id) REFERENCES class_sections(section_id) ON DELETE CASCADE,
      FOREIGN KEY (lecturer_id) REFERENCES lecturers(lecturer_id) ON DELETE RESTRICT,
      FOREIGN KEY (submitted_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS grade_approvals (
      approval_id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      reviewed_by_user_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION', 'REOPENED')),
      reason TEXT NOT NULL DEFAULT '',
      reviewed_at TEXT NOT NULL,
      FOREIGN KEY (submission_id) REFERENCES grade_submissions(submission_id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES class_sections(section_id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS grade_change_logs (
      log_id TEXT PRIMARY KEY,
      enrollment_id TEXT NOT NULL,
      section_id TEXT,
      student_id TEXT NOT NULL,
      course_code TEXT NOT NULL,
      changed_by_user_id TEXT NOT NULL,
      changed_by_name TEXT NOT NULL,
      changed_by_role TEXT NOT NULL,
      previous_numeric_grade REAL,
      new_numeric_grade REAL,
      previous_letter_grade TEXT,
      new_letter_grade TEXT,
      reason TEXT NOT NULL DEFAULT '',
      changed_at TEXT NOT NULL,
      FOREIGN KEY (enrollment_id) REFERENCES enrollments(enrollment_id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES class_sections(section_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS academic_reports (
      report_id TEXT PRIMARY KEY,
      student_id TEXT,
      title TEXT NOT NULL,
      report_type TEXT NOT NULL CHECK (report_type IN ('SEMESTER_SUMMARY', 'ADVISORY_NOTICE', 'PROGRESS_REVIEW', 'OFFICIAL_TRANSCRIPT')),
      semester TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_report_reads (
      read_id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      read_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (report_id) REFERENCES academic_reports(report_id) ON DELETE CASCADE,
      UNIQUE (student_id, report_id)
    );

    CREATE TABLE IF NOT EXISTS tuition_payments (
      payment_id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      semester TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      total_credits INTEGER NOT NULL CHECK (total_credits > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price > 0),
      amount INTEGER NOT NULL CHECK (amount > 0),
      payment_method TEXT NOT NULL DEFAULT 'QR_SCAN',
      transaction_ref TEXT NOT NULL,
      transfer_note TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'PENDING_CONFIRMATION')),
      paid_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      UNIQUE (student_id, semester, academic_year)
    );
  `);

  // Safe migration for users role CHECK constraint (preserves all existing users & password hashes)
  const usersTableSql = (
    db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get() as { sql?: string } | undefined
  )?.sql ?? '';

  if (!usersTableSql.includes('LECTURER') || !usersTableSql.includes('TRAINING_DEPARTMENT')) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          user_id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('STUDENT', 'LECTURER', 'TRAINING_DEPARTMENT')),
          account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'inactive')),
          display_name TEXT NOT NULL,
          avatar_url TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        );
        INSERT INTO users_new (
          user_id, username, email, password_hash, role, account_status, display_name, avatar_url, created_at
        )
        SELECT
          user_id, username, email, password_hash,
          CASE
            WHEN LOWER(role) = 'admin' OR UPPER(role) = 'TRAINING_DEPARTMENT' THEN 'TRAINING_DEPARTMENT'
            WHEN UPPER(role) = 'LECTURER' THEN 'LECTURER'
            ELSE 'STUDENT'
          END,
          account_status, display_name, avatar_url, created_at
        FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
    })();
    db.pragma('foreign_keys = ON');
  }

  // Safe column additions on pre-existing enrollments table
  const enrollmentCols = db.prepare('PRAGMA table_info(enrollments)').all() as Array<{ name: string }>;
  if (!enrollmentCols.some((c) => c.name === 'semester_id')) {
    db.exec('ALTER TABLE enrollments ADD COLUMN semester_id TEXT REFERENCES semesters(semester_id) ON DELETE SET NULL');
  }
  if (!enrollmentCols.some((c) => c.name === 'section_id')) {
    db.exec('ALTER TABLE enrollments ADD COLUMN section_id TEXT REFERENCES class_sections(section_id) ON DELETE SET NULL');
  }
  if (!enrollmentCols.some((c) => c.name === 'attendance_score')) {
    db.exec('ALTER TABLE enrollments ADD COLUMN attendance_score REAL');
  }
  if (!enrollmentCols.some((c) => c.name === 'assignment_score')) {
    db.exec('ALTER TABLE enrollments ADD COLUMN assignment_score REAL');
  }
  if (!enrollmentCols.some((c) => c.name === 'midterm_score')) {
    db.exec('ALTER TABLE enrollments ADD COLUMN midterm_score REAL');
  }
  if (!enrollmentCols.some((c) => c.name === 'final_score')) {
    db.exec('ALTER TABLE enrollments ADD COLUMN final_score REAL');
  }
  if (!enrollmentCols.some((c) => c.name === 'attendance_status')) {
    db.exec("ALTER TABLE enrollments ADD COLUMN attendance_status TEXT NOT NULL DEFAULT 'Đủ điều kiện'");
  }
  if (!enrollmentCols.some((c) => c.name === 'is_official')) {
    db.exec('ALTER TABLE enrollments ADD COLUMN is_official INTEGER NOT NULL DEFAULT 1');
  }

  // Upgrade academic_warnings safely if missing semester column or REPEATED_FAILED_COURSES constraint
  const warningTableSql = (
    db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'academic_warnings'")
      .get() as { sql?: string } | undefined
  )?.sql ?? '';

  if (!warningTableSql.includes('REPEATED_FAILED_COURSES') || !warningTableSql.includes('semester')) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE academic_warnings_new (
          warning_id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL,
          warning_type TEXT NOT NULL CHECK (warning_type IN ('LOW_GPA', 'FAILED_CREDITS', 'LOW_SEMESTER_GPA', 'ACADEMIC_PROGRESS', 'REPEATED_FAILED_COURSES')),
          warning_title TEXT NOT NULL,
          description TEXT NOT NULL,
          triggering_condition TEXT NOT NULL,
          severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
          warning_status TEXT NOT NULL CHECK (warning_status IN ('Active', 'Read', 'Resolved')),
          suggested_action TEXT NOT NULL,
          academic_year TEXT NOT NULL,
          semester TEXT NOT NULL DEFAULT 'Học kỳ 1',
          generated_at TEXT NOT NULL,
          FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
        );
        INSERT INTO academic_warnings_new (
          warning_id, student_id, warning_type, warning_title, description,
          triggering_condition, severity, warning_status, suggested_action,
          academic_year, semester, generated_at
        )
        SELECT
          warning_id, student_id, warning_type, warning_title, description,
          triggering_condition, severity, warning_status, suggested_action,
          academic_year, 'Học kỳ 1', generated_at
        FROM academic_warnings;
        DROP TABLE academic_warnings;
        ALTER TABLE academic_warnings_new RENAME TO academic_warnings;
      `);
    })();
    db.pragma('foreign_keys = ON');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_enrollments_student_term ON enrollments(student_id, academic_year, semester);
    CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_section ON enrollments(section_id);
    CREATE INDEX IF NOT EXISTS idx_gpa_records_student ON gpa_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_warnings_student ON academic_warnings(student_id);
    CREATE INDEX IF NOT EXISTS idx_activities_student ON academic_activities(student_id);
    CREATE INDEX IF NOT EXISTS idx_grade_records_student ON grade_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_semesters_year ON semesters(year_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_sections_lecturer ON class_sections(lecturer_id);
    CREATE INDEX IF NOT EXISTS idx_sections_semester ON class_sections(semester_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_section ON grade_submissions(section_id, status);
    CREATE INDEX IF NOT EXISTS idx_grade_logs_section ON grade_change_logs(section_id, changed_at);
    CREATE INDEX IF NOT EXISTS idx_academic_reports_student ON academic_reports(student_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_report_reads_student ON student_report_reads(student_id, report_id);
  `);
}

export function ensureDefaultAcademicYearsAndSemesters(): void {
  const now = new Date().toISOString();
  const years = [
    { year_id: 'AY-2022-2023', year_code: '2022-2023', year_name: 'Năm học 2022–2023', start_year: 2022, end_year: 2023 },
    { year_id: 'AY-2023-2024', year_code: '2023-2024', year_name: 'Năm học 2023–2024', start_year: 2023, end_year: 2024 },
    { year_id: 'AY-2024-2025', year_code: '2024-2025', year_name: 'Năm học 2024–2025', start_year: 2024, end_year: 2025 },
    { year_id: 'AY-2025-2026', year_code: '2025-2026', year_name: 'Năm học 2025–2026', start_year: 2025, end_year: 2026 },
    { year_id: 'AY-2026-2027', year_code: '2026-2027', year_name: 'Năm học 2026–2027', start_year: 2026, end_year: 2027 },
  ];

  const insertYear = db.prepare(`
    INSERT OR IGNORE INTO academic_years (year_id, year_code, year_name, start_year, end_year, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);
  const insertSem = db.prepare(`
    INSERT OR IGNORE INTO semesters (semester_id, year_id, academic_year, semester_code, semester_name, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  const templates = [
    { code: 'HK1', name: 'Học kỳ 1', order: 1 },
    { code: 'HK2', name: 'Học kỳ 2', order: 2 },
    { code: 'HK_HE', name: 'Học kỳ hè', order: 3 },
  ];

  db.transaction(() => {
    for (const y of years) {
      insertYear.run(y.year_id, y.year_code, y.year_name, y.start_year, y.end_year, now);
      for (const t of templates) {
        insertSem.run(
          `SEM-${y.year_code}-${t.code}`,
          y.year_id,
          y.year_code,
          t.code,
          t.name,
          t.order
        );
      }
    }
  })();
}

export function resolveOrCreateSemesterId(academicYear: string, semesterName: string): string {
  const cleanYear = academicYear.trim();
  const cleanSem = semesterName.trim();

  const existingSem = db
    .prepare('SELECT semester_id FROM semesters WHERE academic_year = ? AND LOWER(semester_name) = LOWER(?)')
    .get(cleanYear, cleanSem) as { semester_id: string } | undefined;
  if (existingSem) return existingSem.semester_id;

  const yearMatch = cleanYear.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  const startYr = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
  const endYr = yearMatch ? Number(yearMatch[2]) : startYr + 1;
  const yearId = `AY-${cleanYear.replace(/[^0-9-]/g, '') || startYr}`;

  let yearRow = db
    .prepare('SELECT year_id FROM academic_years WHERE year_code = ?')
    .get(cleanYear) as { year_id: string } | undefined;
  if (!yearRow) {
    db.prepare(
      `INSERT OR IGNORE INTO academic_years (year_id, year_code, year_name, start_year, end_year, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    ).run(yearId, cleanYear, `Năm học ${cleanYear.replace('-', '–')}`, startYr, endYr, new Date().toISOString());
    yearRow = { year_id: yearId };
  }

  const lower = cleanSem.toLowerCase();
  const semCode = lower.includes('hè') || lower.includes('he') || lower.includes('summer')
    ? 'HK_HE'
    : lower.includes('2')
      ? 'HK2'
      : 'HK1';
  const sortOrder = semCode === 'HK1' ? 1 : semCode === 'HK2' ? 2 : 3;
  const semId = `SEM-${cleanYear}-${semCode}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  db.prepare(
    `INSERT OR IGNORE INTO semesters (semester_id, year_id, academic_year, semester_code, semester_name, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).run(semId, yearRow.year_id, cleanYear, semCode, cleanSem, sortOrder);

  const resolved = db
    .prepare('SELECT semester_id FROM semesters WHERE year_id = ? AND LOWER(semester_name) = LOWER(?)')
    .get(yearRow.year_id, cleanSem) as { semester_id: string };
  return resolved.semester_id;
}

export function migrateLegacyTermsAndEnsureDemoJourney(): void {
  ensureDefaultAcademicYearsAndSemesters();

  const alreadyApplied = db
    .prepare("SELECT migration_key FROM schema_migrations WHERE migration_key = 'uniportal_multiterm_v1'")
    .get();

  if (!alreadyApplied) {
    const now = new Date().toISOString();
    db.transaction(() => {
      // Normalize sequential semester labels (HK 3/4/5/6) into canonical HK1/HK2 within each academic_year
      db.prepare("UPDATE enrollments SET semester = 'Học kỳ 1' WHERE semester IN ('Học kỳ 3', 'Học kỳ 5', 'Học kỳ 6')").run();
      db.prepare("UPDATE enrollments SET semester = 'Học kỳ 2' WHERE semester IN ('Học kỳ 4')").run();

      // Add realistic retake course in Học kỳ hè (2024-2025) for Student A if missing (demonstrates repeat policy without double counting credits)
      const stuA = db.prepare("SELECT student_id FROM students WHERE student_id = '22000001'").get();
      if (stuA) {
        db.prepare(
          `INSERT OR IGNORE INTO enrollments (
            enrollment_id, student_id, course_id, semester, academic_year,
            letter_grade, numeric_grade, grade_point, completion_status, is_repeated, updated_at
          ) VALUES (?, '22000001', 'CRS-MAT101', 'Học kỳ hè', '2024-2025', 'A', 9.2, 4.0, 'Completed', 1, ?)`
        ).run('ENR-P-RETAKE-1', now);
      }

      // Add realistic repeated failed attempt in Học kỳ hè (2024-2025) for Student B if missing (demonstrates repeated failed course warning)
      const stuB = db.prepare("SELECT student_id FROM students WHERE student_id = '22000002'").get();
      if (stuB) {
        db.prepare(
          `INSERT OR IGNORE INTO enrollments (
            enrollment_id, student_id, course_id, semester, academic_year,
            letter_grade, numeric_grade, grade_point, completion_status, is_repeated, updated_at
          ) VALUES (?, '22000002', 'CRS-STA201', 'Học kỳ hè', '2024-2025', 'F', 3.6, 0.0, 'Failed', 1, ?)`
        ).run('ENR-N-RETAKE-1', now);
      }

      db.prepare("INSERT INTO schema_migrations (migration_key, applied_at) VALUES ('uniportal_multiterm_v1', ?)").run(now);
    })();
  }

  // Ensure every enrollment row has a valid semester_id foreign key
  const unlinked = db
    .prepare('SELECT enrollment_id, academic_year, semester FROM enrollments WHERE semester_id IS NULL')
    .all() as Array<{ enrollment_id: string; academic_year: string; semester: string }>;

  if (unlinked.length > 0) {
    const updateSem = db.prepare('UPDATE enrollments SET semester_id = ? WHERE enrollment_id = ?');
    db.transaction(() => {
      for (const row of unlinked) {
        const semId = resolveOrCreateSemesterId(row.academic_year, row.semester);
        updateSem.run(semId, row.enrollment_id);
      }
    })();
  }
}

export function ensureThreeRoleSystemAndDemoAccounts(): void {
  const now = new Date().toISOString();

  // Ensure configurable assessment_weights exists in academic_settings
  db.prepare(
    `INSERT OR IGNORE INTO academic_settings (setting_id, setting_name, setting_value, description, updated_at)
     VALUES ('SET-ASSESSMENT-WEIGHTS', 'assessment_weights', ?, 'Trọng số thành phần điểm (Chuyên cần, Bài tập, Giữa kỳ, Cuối kỳ) do Phòng Đào tạo cấu hình', ?)`
  ).run(JSON.stringify(DEFAULT_ASSESSMENT_WEIGHTS), now);

  const alreadyApplied = db
    .prepare("SELECT migration_key FROM schema_migrations WHERE migration_key = 'uniportal_threerole_v1'")
    .get();

  const demoHash = bcrypt.hashSync('Uni@12345', 10);

  db.transaction(() => {
    // 1. Ensure Demo Account 1: TRAINING_DEPARTMENT (training@uniportal.demo) — never overwrite if already exists
    const existingTraining = db
      .prepare("SELECT user_id FROM users WHERE LOWER(email) = 'training@uniportal.demo'")
      .get() as { user_id: string } | undefined;

    const trainingUserId = existingTraining?.user_id ?? 'USR-TRD-DEMO';
    if (!existingTraining) {
      db.prepare(
        `INSERT INTO users (user_id, username, email, password_hash, role, account_status, display_name, avatar_url, created_at)
         VALUES (?, 'training.dept', 'training@uniportal.demo', ?, 'TRAINING_DEPARTMENT', 'active', 'Phòng Đào tạo UniPortal', '/src/assets/images/avatar_admin_elena_1794819040716.jpg', ?)`
      ).run(trainingUserId, demoHash, now);
    }

    // 2. Ensure Demo Account 2: LECTURER (lecturer@uniportal.demo -> GV001) + secondary lecturer GV002
    const existingLecturerUser = db
      .prepare("SELECT user_id FROM users WHERE LOWER(email) = 'lecturer@uniportal.demo'")
      .get() as { user_id: string } | undefined;

    const lecturerUserId = existingLecturerUser?.user_id ?? 'USR-LEC-01';
    if (!existingLecturerUser) {
      db.prepare(
        `INSERT INTO users (user_id, username, email, password_hash, role, account_status, display_name, avatar_url, created_at)
         VALUES (?, 'GV001', 'lecturer@uniportal.demo', ?, 'LECTURER', 'active', 'TS. Nguyễn Minh Quân', '/src/assets/images/avatar_admin_elena_1794819040716.jpg', ?)`
      ).run(lecturerUserId, demoHash, now);
    }

    db.prepare(
      `INSERT OR IGNORE INTO lecturers (
        lecturer_id, user_id, full_name, email, department, academic_rank, specialization, phone, office_location, status, avatar_url, created_at
      ) VALUES ('GV001', ?, 'TS. Nguyễn Minh Quân', 'lecturer@uniportal.demo', 'Khoa Hệ thống Thông tin & Kinh tế số', 'Tiến sĩ', 'Thương mại điện tử & Trí tuệ nhân tạo', '0918 220 118', 'Phòng B402 · Nhà B', 'active', '/src/assets/images/avatar_admin_elena_1794819040716.jpg', ?)`
    ).run(lecturerUserId, now);

    const existingLec2 = db
      .prepare("SELECT user_id FROM users WHERE LOWER(email) = 'yen.le@uniportal.demo'")
      .get() as { user_id: string } | undefined;
    const lec2UserId = existingLec2?.user_id ?? 'USR-LEC-02';
    if (!existingLec2) {
      db.prepare(
        `INSERT INTO users (user_id, username, email, password_hash, role, account_status, display_name, avatar_url, created_at)
         VALUES (?, 'GV002', 'yen.le@uniportal.demo', ?, 'LECTURER', 'active', 'ThS. Lê Hải Yến', '/src/assets/images/avatar_student_alex_1794819039297.jpg', ?)`
      ).run(lec2UserId, demoHash, now);
    }

    db.prepare(
      `INSERT OR IGNORE INTO lecturers (
        lecturer_id, user_id, full_name, email, department, academic_rank, specialization, phone, office_location, status, avatar_url, created_at
      ) VALUES ('GV002', ?, 'ThS. Lê Hải Yến', 'yen.le@uniportal.demo', 'Khoa Tài chính - Ngân hàng', 'Thạc sĩ', 'Đầu tư tài chính & Quản trị rủi ro', '0909 445 667', 'Phòng A208 · Nhà A', 'active', '/src/assets/images/avatar_student_alex_1794819039297.jpg', ?)`
    ).run(lec2UserId, now);

    // 3. Ensure Demo Account 3: STUDENT (student@uniportal.demo -> 22000100)
    const existingStudentUser = db
      .prepare("SELECT user_id FROM users WHERE LOWER(email) = 'student@uniportal.demo'")
      .get() as { user_id: string } | undefined;

    const studentUserId = existingStudentUser?.user_id ?? 'USR-STU-DEMO';
    if (!existingStudentUser) {
      db.prepare(
        `INSERT INTO users (user_id, username, email, password_hash, role, account_status, display_name, avatar_url, created_at)
         VALUES (?, '22000100', 'student@uniportal.demo', ?, 'STUDENT', 'active', 'Phạm Gia Hân', '/src/assets/images/avatar_student_alex_1794819039297.jpg', ?)`
      ).run(studentUserId, demoHash, now);
    }

    db.prepare(
      `INSERT OR IGNORE INTO students (
        student_id, user_id, full_name, email, faculty, major, academic_year,
        enrollment_year, total_required_credits, expected_credits_per_semester,
        academic_status, phone, advisor_name, avatar_url
      ) VALUES (
        '22000100', ?, 'Phạm Gia Hân', 'student@uniportal.demo',
        'Khoa Hệ thống Thông tin & Kinh tế số', 'Hệ thống thông tin quản lý',
        'Năm thứ 3 · K67', 2023, 130, 15, 'Active', '0936 778 990',
        'TS. Nguyễn Minh Quân', '/src/assets/images/avatar_student_alex_1794819039297.jpg'
      )`
    ).run(studentUserId);

    if (!alreadyApplied) {
      // Seed academic records for student@uniportal.demo (22000100) so she has rich multi-semester history
      const demoStudentEnrollments: Array<[string, string, string, string, string | null, number | null, number | null, string, number]> = [
        ['ENR-D-01', 'CRS-CS101', 'Học kỳ 1', '2023-2024', 'A', 8.7, 4.0, 'Completed', 1],
        ['ENR-D-02', 'CRS-MAT101', 'Học kỳ 1', '2023-2024', 'B+', 8.2, 3.5, 'Completed', 1],
        ['ENR-D-03', 'CRS-ENG101', 'Học kỳ 1', '2023-2024', 'A', 9.1, 4.0, 'Completed', 1],
        ['ENR-D-04', 'CRS-ECO101', 'Học kỳ 1', '2023-2024', 'B', 7.8, 3.0, 'Completed', 1],
        ['ENR-D-05', 'CRS-CS102', 'Học kỳ 2', '2023-2024', 'B+', 8.4, 3.5, 'Completed', 1],
        ['ENR-D-06', 'CRS-MAT102', 'Học kỳ 2', '2023-2024', 'B', 7.6, 3.0, 'Completed', 1],
        ['ENR-D-07', 'CRS-MIS201', 'Học kỳ 2', '2023-2024', 'A', 8.6, 4.0, 'Completed', 1],
        ['ENR-D-08', 'CRS-STA201', 'Học kỳ 2', '2023-2024', 'B+', 8.1, 3.5, 'Completed', 1],
        ['ENR-D-09', 'CRS-CS201', 'Học kỳ 1', '2024-2025', 'A', 9.2, 4.0, 'Completed', 1],
        ['ENR-D-10', 'CRS-CS202', 'Học kỳ 1', '2024-2025', 'B+', 8.3, 3.5, 'Completed', 1],
        ['ENR-D-11', 'CRS-CS203', 'Học kỳ 1', '2024-2025', 'A', 8.8, 4.0, 'Completed', 1],
        ['ENR-D-12', 'CRS-SE201', 'Học kỳ 1', '2024-2025', 'B+', 8.0, 3.5, 'Completed', 1],
      ];

      const insEnr = db.prepare(
        `INSERT OR IGNORE INTO enrollments (
          enrollment_id, student_id, course_id, semester_id, semester, academic_year,
          letter_grade, numeric_grade, grade_point, completion_status, is_repeated, is_official, updated_at
        ) VALUES (?, '22000100', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      );
      for (const row of demoStudentEnrollments) {
        const semId = resolveOrCreateSemesterId(row[3], row[2]);
        insEnr.run(row[0], row[1], semId, row[2], row[3], row[4], row[5], row[6], row[7], row[8], now);
      }

      // Seed Class Sections
      const sem25_1 = resolveOrCreateSemesterId('2025-2026', 'Học kỳ 1');
      const sem24_2 = resolveOrCreateSemesterId('2024-2025', 'Học kỳ 2');

      const insSection = db.prepare(
        `INSERT OR IGNORE INTO class_sections (
          section_id, section_code, course_id, semester_id, semester, academic_year,
          lecturer_id, schedule_info, max_students, submission_deadline, grade_status, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      );

      // Class 1 (GV001): IN_PROGRESS
      insSection.run(
        'SEC-MIS401-01',
        'MIS401.01',
        'CRS-CS401',
        sem25_1,
        'Học kỳ 1',
        '2025-2026',
        'GV001',
        'Thứ 2 (Tiết 1–3) · Phòng B302',
        60,
        '2026-01-25',
        'IN_PROGRESS',
        now,
        now
      );
      // Class 2 (GV001): NOT_ENTERED
      insSection.run(
        'SEC-INT304-01',
        'INT304.01',
        'CRS-AI301',
        sem25_1,
        'Học kỳ 1',
        '2025-2026',
        'GV001',
        'Thứ 4 (Tiết 4–6) · Phòng Lab C201',
        55,
        '2026-01-28',
        'NOT_ENTERED',
        now,
        now
      );
      // Class 3 (GV001): PENDING_APPROVAL (submitted to Training Dept for immediate approval queue!)
      insSection.run(
        'SEC-MGT202-01',
        'MGT202.01',
        'CRS-MGT202',
        sem25_1,
        'Học kỳ 1',
        '2025-2026',
        'GV001',
        'Thứ 6 (Tiết 1–3) · Phòng A405',
        50,
        '2026-01-18',
        'PENDING_APPROVAL',
        now,
        now
      );
      // Class 4 (GV001): APPROVED (Historical teaching record in 2024-2025 HK2)
      insSection.run(
        'SEC-INT303-01',
        'INT303.01',
        'CRS-CS303',
        sem24_2,
        'Học kỳ 2',
        '2024-2025',
        'GV001',
        'Thứ 3 (Tiết 7–9) · Phòng Lab C104',
        60,
        '2025-06-15',
        'APPROVED',
        now,
        now
      );
      // Class 5 (GV002 - unassigned to GV001, tests RBAC): IN_PROGRESS
      insSection.run(
        'SEC-FIN301-01',
        'FIN301.01',
        'CRS-FIN301',
        sem25_1,
        'Học kỳ 1',
        '2025-2026',
        'GV002',
        'Thứ 5 (Tiết 4–6) · Phòng A202',
        45,
        '2026-01-30',
        'IN_PROGRESS',
        now,
        now
      );

      // Seed lecturer_assignments
      const insAssign = db.prepare(
        `INSERT OR IGNORE INTO lecturer_assignments (assignment_id, section_id, lecturer_id, assigned_by_user_id, assigned_at, is_primary)
         VALUES (?, ?, ?, ?, ?, 1)`
      );
      insAssign.run('ASN-01', 'SEC-MIS401-01', 'GV001', trainingUserId, now);
      insAssign.run('ASN-02', 'SEC-INT304-01', 'GV001', trainingUserId, now);
      insAssign.run('ASN-03', 'SEC-MGT202-01', 'GV001', trainingUserId, now);
      insAssign.run('ASN-04', 'SEC-INT303-01', 'GV001', trainingUserId, now);
      insAssign.run('ASN-05', 'SEC-FIN301-01', 'GV002', trainingUserId, now);

      // Link existing ENR-P-26 (Student 22000001) & ENR-N-19 (Student 22000002) to active sections
      db.prepare("UPDATE enrollments SET section_id = 'SEC-MIS401-01', is_official = 0 WHERE enrollment_id = 'ENR-P-26'").run();
      db.prepare(
        "UPDATE enrollments SET section_id = 'SEC-MGT202-01', semester = 'Học kỳ 1', academic_year = '2025-2026', semester_id = ?, attendance_score = 7.5, assignment_score = 7.0, midterm_score = 6.8, final_score = 6.5, numeric_grade = 6.76, letter_grade = 'C+', grade_point = 2.5, completion_status = 'Completed', is_official = 0 WHERE enrollment_id = 'ENR-N-19'"
      ).run(sem25_1);

      // Enroll Student 22000100 & 23000018 & 22000002 across active sections
      const insSecEnr = db.prepare(
        `INSERT OR IGNORE INTO enrollments (
          enrollment_id, student_id, course_id, section_id, semester_id, semester, academic_year,
          attendance_score, assignment_score, midterm_score, final_score,
          letter_grade, numeric_grade, grade_point, completion_status, is_repeated, is_official, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      );

      // SEC-MIS401-01 (IN_PROGRESS, partial draft scores for 22000100, ungraded for 22000001 & 23000018)
      insSecEnr.run('ENR-SEC1-D1', '22000100', 'CRS-CS401', 'SEC-MIS401-01', sem25_1, 'Học kỳ 1', '2025-2026', 9.2, 8.6, 8.4, null, null, null, null, 'In Progress', 0, now);
      insSecEnr.run('ENR-SEC1-V1', '23000018', 'CRS-CS401', 'SEC-MIS401-01', sem25_1, 'Học kỳ 1', '2025-2026', 9.5, 9.0, 8.8, null, null, null, null, 'In Progress', 0, now);

      // SEC-INT304-01 (NOT_ENTERED)
      insSecEnr.run('ENR-SEC2-D1', '22000100', 'CRS-AI301', 'SEC-INT304-01', sem25_1, 'Học kỳ 1', '2025-2026', null, null, null, null, null, null, null, 'In Progress', 0, now);
      insSecEnr.run('ENR-SEC2-V1', '23000018', 'CRS-AI301', 'SEC-INT304-01', sem25_1, 'Học kỳ 1', '2025-2026', null, null, null, null, null, null, null, 'In Progress', 0, now);
      insSecEnr.run('ENR-SEC2-N1', '22000002', 'CRS-AI301', 'SEC-INT304-01', sem25_1, 'Học kỳ 1', '2025-2026', null, null, null, null, null, null, null, 'In Progress', 0, now);

      // SEC-MGT202-01 (PENDING_APPROVAL — Student 22000100 A 8.64, Student 23000018 A 9.23, Student 22000002 C+ 6.76)
      insSecEnr.run('ENR-SEC3-D1', '22000100', 'CRS-MGT202', 'SEC-MGT202-01', sem25_1, 'Học kỳ 1', '2025-2026', 9.5, 8.8, 8.5, 8.5, 'A', 8.64, 4.0, 'Completed', 0, now);
      insSecEnr.run('ENR-SEC3-V1', '23000018', 'CRS-MGT202', 'SEC-MGT202-01', sem25_1, 'Học kỳ 1', '2025-2026', 9.8, 9.2, 9.1, 9.2, 'A', 9.23, 4.0, 'Completed', 0, now);

      // SEC-INT303-01 (APPROVED in 2024-2025 HK2 — official results)
      insSecEnr.run('ENR-SEC4-D1', '22000100', 'CRS-CS303', 'SEC-INT303-01', sem24_2, 'Học kỳ 2', '2024-2025', 9.4, 8.8, 8.6, 8.9, 'A', 8.87, 4.0, 'Completed', 1, now);
      insSecEnr.run('ENR-SEC4-V1', '23000018', 'CRS-CS303', 'SEC-INT303-01', sem24_2, 'Học kỳ 2', '2024-2025', 9.6, 9.4, 9.2, 9.5, 'A', 9.43, 4.0, 'Completed', 1, now);
      insSecEnr.run('ENR-SEC4-N1', '22000002', 'CRS-CS303', 'SEC-INT303-01', sem24_2, 'Học kỳ 2', '2024-2025', 6.5, 5.0, 4.2, 3.0, 'F', 3.89, 0.0, 'Failed', 1, now);

      // SEC-FIN301-01 (GV002 — IN_PROGRESS)
      insSecEnr.run('ENR-SEC5-D1', '22000100', 'CRS-FIN301', 'SEC-FIN301-01', sem25_1, 'Học kỳ 1', '2025-2026', 9.0, 8.2, 8.0, null, null, null, null, 'In Progress', 0, now);

      // Seed Grade Submissions & Approvals
      db.prepare(
        `INSERT OR IGNORE INTO grade_submissions (
          submission_id, section_id, lecturer_id, submitted_by_user_id, submitted_at, status, student_count, graded_count, note
        ) VALUES ('SUB-MGT202-01', 'SEC-MGT202-01', 'GV001', ?, ?, 'PENDING_APPROVAL', 3, 3, 'Đã hoàn tất nhập điểm chuyên cần, bài tập, giữa kỳ và thi cuối kỳ cho lớp MGT202.01.')`
      ).run(lecturerUserId, now);

      db.prepare(
        `INSERT OR IGNORE INTO grade_submissions (
          submission_id, section_id, lecturer_id, submitted_by_user_id, submitted_at, status, student_count, graded_count, note
        ) VALUES ('SUB-INT303-01', 'SEC-INT303-01', 'GV001', ?, '2025-06-12T10:30:00.000Z', 'APPROVED', 3, 3, 'Hoàn tất bảng điểm cuối kỳ học phần Phát triển ứng dụng Web.')`
      ).run(lecturerUserId);

      db.prepare(
        `INSERT OR IGNORE INTO grade_approvals (
          approval_id, submission_id, section_id, reviewed_by_user_id, reviewer_name, decision, reason, reviewed_at
        ) VALUES ('APR-INT303-01', 'SUB-INT303-01', 'SEC-INT303-01', ?, 'Phòng Đào tạo UniPortal', 'APPROVED', 'Bảng điểm hợp lệ và khớp biên bản chấm thi.', '2025-06-14T08:45:00.000Z')`
      ).run(trainingUserId);

      db.prepare(
        `INSERT OR IGNORE INTO grade_change_logs (
          log_id, enrollment_id, section_id, student_id, course_code,
          changed_by_user_id, changed_by_name, changed_by_role,
          previous_numeric_grade, new_numeric_grade, previous_letter_grade, new_letter_grade,
          reason, changed_at
        ) VALUES ('GCL-INIT-01', 'ENR-SEC3-D1', 'SEC-MGT202-01', '22000100', 'MGT202', ?, 'TS. Nguyễn Minh Quân', 'LECTURER', null, 8.64, null, 'A', 'Nhập điểm tổng kết đợt thi cuối kỳ', ?)`
      ).run(lecturerUserId, now);

      db.prepare("INSERT INTO schema_migrations (migration_key, applied_at) VALUES ('uniportal_threerole_v1', ?)").run(now);
    }
  })();
}

export function ensureAcademicReportsSeeded(): void {
  const reports: Array<{
    report_id: string;
    student_id: string | null;
    title: string;
    report_type: string;
    semester: string;
    academic_year: string;
    summary: string;
    content: string;
    created_at: string;
  }> = [
    {
      report_id: 'RPT-COHORT-2025-HK1',
      student_id: null,
      title: 'Tổng kết kết quả học tập Học kỳ 1 năm học 2025–2026',
      report_type: 'SEMESTER_SUMMARY',
      semester: 'Học kỳ 1',
      academic_year: '2025-2026',
      summary: 'Thông báo tổng hợp điểm chính thức các lớp học phần đã được Phòng Đào tạo phê duyệt trong Học kỳ 1.',
      content:
        'Phòng Đào tạo thông báo tiến độ công bố điểm chính thức Học kỳ 1 (2025–2026). Sinh viên cần đối chiếu kết quả quy đổi song song thang điểm 10 và hệ 4 trên cổng UniPortal; mọi thắc mắc phúc khảo gửi trước ngày 15/02/2026.',
      created_at: '2026-01-20T08:30:00.000Z',
    },
    {
      report_id: 'RPT-COHORT-SCALE10-2025',
      student_id: null,
      title: 'Hướng dẫn áp dụng thang điểm 10 – hệ 4 (9 bậc chữ) và kế hoạch GPA',
      report_type: 'ADVISORY_NOTICE',
      semester: 'Học kỳ 1',
      academic_year: '2025-2026',
      summary: 'Áp dụng thống nhất 9 mức điểm chữ (A+, A, B+, B, C+, C, D+, D, F) quy đổi từ thang điểm 0.00 – 10.00.',
      content:
        'Từ năm học 2025–2026, bảng điểm UniPortal hiển thị đồng thời điểm thang 10 và điểm hệ 4 chuẩn 9 bậc (A+ = 4.0 từ 9.5; A = 4.0 từ 8.5; B+ = 3.5; B = 3.0; C+ = 2.5; C = 2.0; D+ = 1.5; D = 1.0; F = 0.0). Sinh viên sử dụng Công cụ Lập kế hoạch GPA Mục tiêu trên Dashboard để xây dựng lộ trình tín chỉ tùy chọn tiếp theo.',
      created_at: '2026-01-12T09:00:00.000Z',
    },
    {
      report_id: 'RPT-COHORT-PROGRESS-2025',
      student_id: null,
      title: 'Báo cáo rà soát tiến độ tín chỉ tốt nghiệp đợt 1 năm 2026',
      report_type: 'PROGRESS_REVIEW',
      semester: 'Học kỳ 1',
      academic_year: '2025-2026',
      summary: 'Đánh giá tỷ lệ hoàn thành tín chỉ bắt buộc và khuyến nghị đăng ký học cải thiện cho học kỳ kế tiếp.',
      content:
        'Sinh viên kiểm tra số tín chỉ đã tích lũy, số tín chỉ còn lại đến mốc tốt nghiệp và danh sách học phần chưa đạt (nếu có) tại mục Tiến độ tốt nghiệp. Các môn học cải thiện sẽ tự động thay thế điểm theo quy chế hiện hành của nhà trường.',
      created_at: '2026-01-05T10:15:00.000Z',
    },
    {
      report_id: 'RPT-22000100-TRANSCRIPT',
      student_id: '22000100',
      title: 'Bảng điểm tích lũy chính thức đến năm thứ 3 · K67 (Phạm Gia Hân)',
      report_type: 'OFFICIAL_TRANSCRIPT',
      semester: 'Học kỳ 2',
      academic_year: '2024-2025',
      summary: 'Xác nhận hoàn thành 13 học phần chính thức với thành tích nổi bật tại khoa Hệ thống thông tin & Kinh tế số.',
      content:
        'Hồ sơ học tập của sinh viên Phạm Gia Hân (22000100) ghi nhận tiến độ ổn định, xếp loại học lực Giỏi – Xuất sắc. Bạn có thể xuất bảng điểm PDF hoặc mô phỏng mục tiêu nâng hạng GPA ngay trên trang Tổng quan học tập.',
      created_at: '2025-07-01T14:00:00.000Z',
    },
    {
      report_id: 'RPT-22000001-TRANSCRIPT',
      student_id: '22000001',
      title: 'Báo cáo rà soát học lực Giỏi & lộ trình tốt nghiệp (Nguyễn Minh Phương)',
      report_type: 'PROGRESS_REVIEW',
      semester: 'Học kỳ hè',
      academic_year: '2024-2025',
      summary: 'Ghi nhận hoàn thành học cải thiện MAT101 (A · 4.0) và đạt ngưỡng học lực Giỏi.',
      content:
        'Sinh viên Nguyễn Minh Phương (22000001) đã hoàn thành học cải thiện Toán cao cấp 1 đạt 9.2/10 (A · 4.0), nâng điểm trung bình tích lũy vượt mốc 3.20. Tiếp tục duy trì tối thiểu 3.60 ở các học kỳ cuối để hướng tới bằng Xuất sắc.',
      created_at: '2025-08-25T11:20:00.000Z',
    },
    {
      report_id: 'RPT-22000002-ADVISORY',
      student_id: '22000002',
      title: 'Thông báo tư vấn học vụ & kế hoạch học lại bắt buộc (Trần Hoàng Nam)',
      report_type: 'ADVISORY_NOTICE',
      semester: 'Học kỳ hè',
      academic_year: '2024-2025',
      summary: 'Khuyến nghị ưu tiên đăng ký học lại các học phần điểm F để nâng GPA tích lũy trên 2.00.',
      content:
        'Phòng Đào tạo và Cố vấn học tập đề nghị sinh viên Trần Hoàng Nam (22000002) sắp xếp lịch gặp cố vấn trước tuần học thứ 2 để lập kế hoạch học lại các môn chưa đạt và sử dụng trình lập kế hoạch GPA mục tiêu kiểm soát khối lượng tín chỉ hợp lý.',
      created_at: '2025-08-28T09:45:00.000Z',
    },
    {
      report_id: 'RPT-23000018-HONORS',
      student_id: '23000018',
      title: 'Ghi nhận thành tích học tập Xuất sắc năm học 2024–2025 (Lê Thảo Vy)',
      report_type: 'SEMESTER_SUMMARY',
      semester: 'Học kỳ 2',
      academic_year: '2024-2025',
      summary: 'Sinh viên đạt GPA tích lũy thuộc nhóm Xuất sắc toàn khoa Tài chính – Ngân hàng.',
      content:
        'Chúc mừng sinh viên Lê Thảo Vy (23000018) duy trì chuỗi kết quả đạt A/A+ ấn tượng trong các học kỳ liên tiếp. Báo cáo này xác nhận hồ sơ đủ điều kiện xét học bổng khuyến khích học tập.',
      created_at: '2025-07-05T08:00:00.000Z',
    },
  ];

  const insReport = db.prepare(
    `INSERT OR IGNORE INTO academic_reports (
      report_id, student_id, title, report_type, semester, academic_year, summary, content, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  db.transaction(() => {
    for (const r of reports) {
      if (r.student_id) {
        const stuExists = db
          .prepare('SELECT 1 FROM students WHERE student_id = ?')
          .get(r.student_id);
        if (!stuExists) continue;
      }
      insReport.run(
        r.report_id,
        r.student_id,
        r.title,
        r.report_type,
        r.semester,
        r.academic_year,
        r.summary,
        r.content,
        r.created_at
      );
    }
  })();
}

function ensureTuitionModuleInitialized(): void {
  const now = new Date().toISOString();

  db.prepare(
    `INSERT OR IGNORE INTO academic_settings (setting_id, setting_name, setting_value, description, updated_at)
     VALUES (?, 'tuition_config', ?, ?, ?)`
  ).run(
    'SET-TUITION-CONFIG',
    JSON.stringify({ ...DEFAULT_TUITION_CONFIG, updatedAt: now }),
    'Đơn giá tín chỉ, thông tin ngân hàng và mã QR thu học phí chính thức của nhà trường',
    now
  );

  const alreadyMigrated = db
    .prepare("SELECT migration_key FROM schema_migrations WHERE migration_key = 'uniportal_tuition_module_v1'")
    .get();
  if (alreadyMigrated) {
    return;
  }

  db.transaction(() => {
    const configRow = db
      .prepare("SELECT setting_value FROM academic_settings WHERE setting_name = 'tuition_config'")
      .get() as { setting_value: string } | undefined;
    let pricePerCredit = DEFAULT_TUITION_CONFIG.pricePerCredit;
    let prefix = DEFAULT_TUITION_CONFIG.transferNotePrefix;
    if (configRow) {
      try {
        const parsed = JSON.parse(configRow.setting_value) as {
          pricePerCredit?: number;
          transferNotePrefix?: string;
        };
        if (parsed.pricePerCredit && parsed.pricePerCredit > 0) {
          pricePerCredit = Math.round(parsed.pricePerCredit);
        }
        if (parsed.transferNotePrefix) {
          prefix = parsed.transferNotePrefix;
        }
      } catch {
        // Use defaults
      }
    }

    // Mark completed historical terms prior to 2025-2026 as PAID so students have realistic receipt history
    // while leaving 2025-2026 invoices UNPAID for immediate QR scanning & payment testing.
    const termTotals = db
      .prepare(
        `SELECT e.student_id, e.semester, e.academic_year, SUM(CAST(ROUND(c.credit_hours) AS INTEGER)) as total_credits
         FROM enrollments e
         JOIN courses c ON e.course_id = c.course_id
         WHERE e.completion_status != 'Withdrawn'
           AND e.academic_year < '2025-2026'
         GROUP BY e.student_id, e.semester, e.academic_year`
      )
      .all() as Array<{
      student_id: string;
      semester: string;
      academic_year: string;
      total_credits: number;
    }>;

    const insertPayment = db.prepare(
      `INSERT OR IGNORE INTO tuition_payments (
        payment_id, student_id, semester, academic_year, total_credits, unit_price, amount,
        payment_method, transaction_ref, transfer_note, status, paid_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'QR_SCAN', ?, ?, 'PAID', ?, ?)`
    );

    termTotals.forEach((row, idx) => {
      const credits = Math.max(1, Math.round(Number(row.total_credits) || 1));
      const amount = credits * pricePerCredit;
      const startYear = Number(row.academic_year.slice(0, 4)) || 2024;
      const isSecondSem = row.semester.includes('2');
      const isSummer = row.semester.toLowerCase().includes('hè');
      const paidDate = isSummer
        ? `${startYear + 1}-07-10T09:15:00.000Z`
        : isSecondSem
          ? `${startYear + 1}-02-18T10:30:00.000Z`
          : `${startYear}-09-20T08:45:00.000Z`;
      const ref = `UNI-QR-${row.academic_year.slice(2, 4)}${String(idx + 1).padStart(4, '0')}`;
      const note = buildTuitionTransferNote(prefix, row.student_id, row.semester, row.academic_year);

      insertPayment.run(
        `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        row.student_id,
        row.semester,
        row.academic_year,
        credits,
        pricePerCredit,
        amount,
        ref,
        note,
        paidDate,
        paidDate
      );
    });

    db.prepare(
      "INSERT INTO schema_migrations (migration_key, applied_at) VALUES ('uniportal_tuition_module_v1', ?)"
    ).run(now);
  })();
}

export function migrateToTenScaleIntegerCreditsAndReports(): void {
  const alreadyMigrated = db
    .prepare("SELECT migration_key FROM schema_migrations WHERE migration_key = 'uniportal_scale10_intcredits_reports_v1'")
    .get();

  if (!alreadyMigrated) {
    const now = new Date().toISOString();
    db.transaction(() => {
      // 1. Update grading_scale in academic_settings if still on legacy 0-100 or contains A-/B-
      const scaleRow = db
        .prepare("SELECT setting_value FROM academic_settings WHERE setting_name = 'grading_scale'")
        .get() as { setting_value: string } | undefined;

      let shouldResetScale = false;
      if (scaleRow) {
        try {
          const parsed = JSON.parse(scaleRow.setting_value) as Array<{
            letter?: string;
            maxNumeric?: number;
          }>;
          shouldResetScale =
            !Array.isArray(parsed) ||
            parsed.some(
              (item) =>
                Number(item.maxNumeric ?? 0) > 10 ||
                item.letter === 'A-' ||
                item.letter === 'B-'
            );
        } catch {
          shouldResetScale = true;
        }
      }
      if (shouldResetScale) {
        db.prepare(
          `UPDATE academic_settings SET setting_value = ?, updated_at = ? WHERE setting_name = 'grading_scale'`
        ).run(JSON.stringify(DEFAULT_GRADING_SCALE), now);
      }

      // 2. Ensure all course credit_hours are positive integers >= 1
      const courses = db
        .prepare('SELECT course_id, credit_hours FROM courses')
        .all() as Array<{ course_id: string; credit_hours: number }>;
      const updCourse = db.prepare('UPDATE courses SET credit_hours = ? WHERE course_id = ?');
      for (const c of courses) {
        if (!Number.isInteger(c.credit_hours) || c.credit_hours < 1) {
          updCourse.run(Math.max(1, Math.round(Number(c.credit_hours) || 1)), c.course_id);
        }
      }

      // 3. Migrate enrollment scores from 0-100 to 0-10 and map A-/B- to 9-letter scale
      const convertTen = (val: number | null): number | null => {
        if (val === null || val === undefined) return null;
        const num = Number(val);
        if (!Number.isFinite(num)) return null;
        const scaled = num > 10 ? num / 10 : num;
        return Math.round((scaled + Number.EPSILON) * 100) / 100;
      };

      const enrollments = db
        .prepare(
          `SELECT enrollment_id, attendance_score, assignment_score, midterm_score, final_score,
                  numeric_grade, letter_grade, grade_point, completion_status
           FROM enrollments`
        )
        .all() as Array<{
        enrollment_id: string;
        attendance_score: number | null;
        assignment_score: number | null;
        midterm_score: number | null;
        final_score: number | null;
        numeric_grade: number | null;
        letter_grade: string | null;
        grade_point: number | null;
        completion_status: string;
      }>;

      const updEnr = db.prepare(
        `UPDATE enrollments
         SET attendance_score = ?, assignment_score = ?, midterm_score = ?, final_score = ?,
             numeric_grade = ?, letter_grade = ?, grade_point = ?
         WHERE enrollment_id = ?`
      );

      for (const e of enrollments) {
        const att = convertTen(e.attendance_score);
        const asg = convertTen(e.assignment_score);
        const mid = convertTen(e.midterm_score);
        const fin = convertTen(e.final_score);
        const num = convertTen(e.numeric_grade);

        let letter = e.letter_grade;
        let point = e.grade_point;

        if (e.completion_status === 'Completed' || e.completion_status === 'Failed') {
          if (num !== null) {
            const resolved = resolveLetterFromNumeric(num, DEFAULT_GRADING_SCALE);
            if (resolved) {
              letter = resolved.letter;
              point = resolved.point;
            }
          } else if (letter === 'A-') {
            letter = 'A';
            point = 4.0;
          } else if (letter === 'B-') {
            letter = 'B';
            point = 3.0;
          }
        }

        updEnr.run(att, asg, mid, fin, num, letter, point, e.enrollment_id);
      }

      // 4. Normalize grade_change_logs scores/letters
      const logs = db
        .prepare(
          'SELECT log_id, previous_numeric_grade, new_numeric_grade, previous_letter_grade, new_letter_grade FROM grade_change_logs'
        )
        .all() as Array<{
        log_id: string;
        previous_numeric_grade: number | null;
        new_numeric_grade: number | null;
        previous_letter_grade: string | null;
        new_letter_grade: string | null;
      }>;
      const updLog = db.prepare(
        `UPDATE grade_change_logs
         SET previous_numeric_grade = ?, new_numeric_grade = ?, previous_letter_grade = ?, new_letter_grade = ?
         WHERE log_id = ?`
      );
      const mapLegacyLetter = (l: string | null): string | null => {
        if (l === 'A-') return 'A';
        if (l === 'B-') return 'B';
        return l;
      };
      for (const l of logs) {
        updLog.run(
          convertTen(l.previous_numeric_grade),
          convertTen(l.new_numeric_grade),
          mapLegacyLetter(l.previous_letter_grade),
          mapLegacyLetter(l.new_letter_grade),
          l.log_id
        );
      }

      db.prepare(
        "INSERT INTO schema_migrations (migration_key, applied_at) VALUES ('uniportal_scale10_intcredits_reports_v1', ?)"
      ).run(now);
    })();
  }

  ensureAcademicReportsSeeded();
}

export function seedDatabaseIfEmpty(): boolean {
  ensureDefaultAcademicYearsAndSemesters();

  // Detect legacy English Meridian seed and upgrade cleanly to UniPortal Vietnamese dataset
  const hasLegacySeed = db
    .prepare("SELECT COUNT(*) as cnt FROM users WHERE email = 'alex.morgan@meridian.edu'")
    .get() as { cnt: number };

  if (hasLegacySeed.cnt > 0) {
    db.exec(`
      DELETE FROM academic_activities;
      DELETE FROM academic_warnings;
      DELETE FROM grade_records;
      DELETE FROM gpa_records;
      DELETE FROM enrollments;
      DELETE FROM courses;
      DELETE FROM students;
      DELETE FROM users;
      DELETE FROM academic_settings;
    `);
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) {
    migrateLegacyTermsAndEnsureDemoJourney();
    ensureThreeRoleSystemAndDemoAccounts();
    migrateToTenScaleIntegerCreditsAndReports();
    ensureTuitionModuleInitialized();
    return false;
  }

  const now = new Date().toISOString();
  const adminHash = bcrypt.hashSync('Admin@2026!', 10);
  const studentHash = bcrypt.hashSync('Student@2026!', 10);

  const insertSetting = db.prepare(`
    INSERT INTO academic_settings (setting_id, setting_name, setting_value, description, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertSetting.run(
    'SET-GRADING-SCALE',
    'grading_scale',
    JSON.stringify(DEFAULT_GRADING_SCALE),
    'Thang điểm chữ quy đổi sang thang điểm hệ 4 chuẩn của nhà trường',
    now
  );
  insertSetting.run(
    'SET-CLASSIFICATION',
    'classification_bands',
    JSON.stringify(DEFAULT_CLASSIFICATION_BANDS),
    'Ngưỡng phân loại học lực theo GPA tích lũy',
    now
  );
  insertSetting.run(
    'SET-WARNINGS',
    'warning_thresholds',
    JSON.stringify(DEFAULT_WARNING_THRESHOLDS),
    'Ngưỡng tự động sinh cảnh báo học vụ',
    now
  );
  insertSetting.run(
    'SET-GPA-POLICY',
    'gpa_policy',
    JSON.stringify(DEFAULT_GPA_POLICY),
    'Quy chế tính điểm môn học lại, môn chưa đạt và tín chỉ tốt nghiệp',
    now
  );

  insertSetting.run(
    'SET-ASSESSMENT-WEIGHTS',
    'assessment_weights',
    JSON.stringify(DEFAULT_ASSESSMENT_WEIGHTS),
    'Trọng số thành phần điểm (Chuyên cần, Bài tập, Giữa kỳ, Cuối kỳ) do Phòng Đào tạo cấu hình',
    now
  );

  const insertUser = db.prepare(`
    INSERT INTO users (user_id, username, email, password_hash, role, account_status, display_name, avatar_url, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `);

  insertUser.run(
    'USR-ADM-01',
    'lananh.pham',
    'admin@studyflow.edu.vn',
    adminHash,
    'TRAINING_DEPARTMENT',
    'TS. Phạm Lan Anh',
    '/src/assets/images/avatar_admin_elena_1794819040716.jpg',
    now
  );
  insertUser.run(
    'USR-STU-01',
    '22000001',
    'phuong.nguyen@studyflow.edu.vn',
    studentHash,
    'STUDENT',
    'Nguyễn Minh Phương',
    '/src/assets/images/avatar_student_alex_1794819039297.jpg',
    now
  );
  insertUser.run(
    'USR-STU-02',
    '22000002',
    'nam.tran@studyflow.edu.vn',
    studentHash,
    'STUDENT',
    'Trần Hoàng Nam',
    '/src/assets/images/avatar_student_jordan_1794819039202.jpg',
    now
  );
  insertUser.run(
    'USR-STU-03',
    '23000018',
    'vy.le@studyflow.edu.vn',
    studentHash,
    'STUDENT',
    'Lê Thảo Vy',
    '/src/assets/images/avatar_student_alex_1794819039297.jpg',
    now
  );

  const insertStudent = db.prepare(`
    INSERT INTO students (
      student_id, user_id, full_name, email, faculty, major, academic_year,
      enrollment_year, total_required_credits, expected_credits_per_semester,
      academic_status, phone, advisor_name, avatar_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStudent.run(
    '22000001',
    'USR-STU-01',
    'Nguyễn Minh Phương',
    'phuong.nguyen@studyflow.edu.vn',
    'Khoa Hệ thống Thông tin & Kinh tế số',
    'Hệ thống thông tin quản lý',
    'Năm thứ 3 · K67',
    2022,
    130,
    15,
    'Active',
    '0912 345 678',
    'PGS.TS. Trần Đức Minh',
    '/src/assets/images/avatar_student_alex_1794819039297.jpg'
  );
  insertStudent.run(
    '22000002',
    'USR-STU-02',
    'Trần Hoàng Nam',
    'nam.tran@studyflow.edu.vn',
    'Khoa Quản trị Kinh doanh',
    'Quản trị kinh doanh số',
    'Năm thứ 3 · K67',
    2022,
    130,
    15,
    'Warning',
    '0987 654 321',
    'TS. Nguyễn Thu Hà',
    '/src/assets/images/avatar_student_jordan_1794819039202.jpg'
  );
  insertStudent.run(
    '23000018',
    'USR-STU-03',
    'Lê Thảo Vy',
    'vy.le@studyflow.edu.vn',
    'Khoa Công nghệ Thông tin',
    'Khoa học dữ liệu & AI',
    'Năm thứ 2 · K68',
    2023,
    130,
    15,
    'Active',
    '0904 112 233',
    'TS. Hoàng Anh Tuấn',
    '/src/assets/images/avatar_student_alex_1794819039297.jpg'
  );

  const coursesData: Array<[string, string, string, number, string, string]> = [
    ['CRS-CS101', 'INT101', 'Nhập môn Lập trình', 3, 'Công nghệ Thông tin', 'Tư duy lập trình cấu trúc và hướng đối tượng cơ bản.'],
    ['CRS-MAT101', 'MAT101', 'Toán cao cấp 1', 3, 'Toán học', 'Giải tích hàm một biến và ứng dụng trong kinh tế - kỹ thuật.'],
    ['CRS-ENG101', 'ENG101', 'Tiếng Anh học thuật', 3, 'Ngoại ngữ', 'Kỹ năng viết luận học thuật và đọc hiểu tài liệu chuyên ngành.'],
    ['CRS-ECO101', 'ECO101', 'Kinh tế vi mô', 3, 'Kinh tế học', 'Cung cầu thị trường, hành vi người tiêu dùng và cấu trúc thị trường.'],
    ['CRS-PHY101', 'BAS102', 'Triết học đại cương', 3, 'Khoa học cơ bản', 'Phương pháp luận tư duy khoa học và nhận thức luận.'],
    ['CRS-CS102', 'INT102', 'Cấu trúc dữ liệu & Giải thuật', 3, 'Công nghệ Thông tin', 'Danh sách, cây, đồ thị, bảng băm và đánh giá độ phức tạp thuật toán.'],
    ['CRS-MAT102', 'MAT102', 'Đại số tuyến tính', 3, 'Toán học', 'Ma trận, không gian véc-tơ, trị riêng và biến đổi tuyến tính.'],
    ['CRS-MIS201', 'MIS201', 'Hệ thống thông tin quản lý', 3, 'Hệ thống thông tin', 'Chiến lược CNTT doanh nghiệp, quy trình ERP và hệ hỗ trợ ra quyết định.'],
    ['CRS-STA201', 'STA201', 'Xác suất & Thống kê', 3, 'Toán học', 'Biến ngẫu nhiên, phân phối xác suất, kiểm định giả thuyết và hồi quy.'],
    ['CRS-HUM102', 'LAW101', 'Pháp luật đại cương', 3, 'Pháp luật', 'Hệ thống pháp luật cơ bản, hợp đồng và quyền sở hữu trí tuệ.'],
    ['CRS-CS201', 'MIS202', 'Phân tích & Thiết kế Hệ thống', 3, 'Hệ thống thông tin', 'Mô hình hóa nghiệp vụ, UML, thiết kế kiến trúc và giao diện hệ thống.'],
    ['CRS-CS202', 'INT202', 'Hệ quản trị Cơ sở dữ liệu', 3, 'Công nghệ Thông tin', 'Đại số quan hệ, chuẩn hóa SQL, lập chỉ mục và quản trị giao dịch.'],
    ['CRS-CS203', 'INT203', 'Mạng máy tính', 3, 'Công nghệ Thông tin', 'Kiến trúc TCP/IP, định tuyến, bảo mật truyền thông và giao thức mạng.'],
    ['CRS-SE201', 'INT204', 'Công nghệ phần mềm', 3, 'Công nghệ Thông tin', 'Quy trình phát triển phần mềm, kiểm thử và quản lý chất lượng Agile.'],
    ['CRS-MGT202', 'MGT202', 'Quản trị dự án CNTT', 3, 'Quản trị', 'Lập kế hoạch phạm vi, tiến độ, chi phí và quản lý rủi ro dự án số.'],
    ['CRS-CS301', 'MIS301', 'Hoạch định nguồn lực doanh nghiệp', 3, 'Hệ thống thông tin', 'Triển khai hệ thống ERP tích hợp tài chính, kho vận và nhân sự.'],
    ['CRS-CS302', 'MIS302', 'Kho dữ liệu & Kinh doanh thông minh', 3, 'Hệ thống thông tin', 'Data Warehouse, ETL, OLAP và trực quan hóa dữ liệu quản trị.'],
    ['CRS-CS303', 'INT303', 'Phát triển ứng dụng Web', 3, 'Công nghệ Thông tin', 'Kiến trúc Web hiện đại, REST API và xây dựng giao diện tương tác.'],
    ['CRS-AI301', 'INT304', 'Nhập môn Trí tuệ nhân tạo', 3, 'Công nghệ Thông tin', 'Học có giám sát, không giám sát và đánh giá mô hình dự báo.'],
    ['CRS-SEC301', 'INT305', 'An toàn thông tin', 3, 'Công nghệ Thông tin', 'Mật mã học ứng dụng, kiểm soát truy cập và phòng thủ hệ thống.'],
    ['CRS-CS401', 'MIS401', 'Thương mại điện tử nâng cao', 3, 'Hệ thống thông tin', 'Mô hình kinh doanh số, thanh toán trực tuyến và phân tích chuyển đổi.'],
    ['CRS-MGT101', 'MGT101', 'Quản trị học đại cương', 3, 'Quản trị', 'Hoạch định, tổ chức, lãnh đạo và kiểm soát trong doanh nghiệp.'],
    ['CRS-ACC101', 'ACC101', 'Nguyên lý kế toán', 3, 'Kinh doanh', 'Báo cáo tài chính, sổ cái và ghi nhận doanh thu - chi phí.'],
    ['CRS-FIN201', 'FIN201', 'Tài chính doanh nghiệp', 3, 'Kinh doanh', 'Giá trị thời gian của tiền, thẩm định dự án và cấu trúc vốn.'],
    ['CRS-BUS102', 'BUS102', 'Giao tiếp kinh doanh', 3, 'Kinh doanh', 'Thuyết trình điều hành, đàm phán và soạn thảo văn bản quản trị.'],
    ['CRS-ECO201', 'ECO201', 'Kinh tế vĩ mô', 3, 'Kinh tế học', 'Thu nhập quốc dân, chính sách tiền tệ, lạm phát và tăng trưởng.'],
    ['CRS-LAW201', 'LAW201', 'Luật kinh doanh', 3, 'Pháp luật', 'Pháp luật doanh nghiệp, hợp đồng thương mại và giải quyết tranh chấp.'],
    ['CRS-MKT201', 'MKT201', 'Marketing căn bản', 3, 'Kinh doanh', 'Phân khúc thị trường, định vị thương hiệu và truyền thông số.'],
    ['CRS-FIN301', 'FIN301', 'Phân tích đầu tư tài chính', 3, 'Kinh doanh', 'Lý thuyết danh mục, định giá tài sản và công cụ thu nhập cố định.'],
    ['CRS-OPS301', 'OPS301', 'Quản trị vận hành', 3, 'Quản trị', 'Chuỗi cung ứng, kiểm soát chất lượng và tối ưu hóa năng lực.'],
    ['CRS-HRM201', 'HRM201', 'Quản trị nguồn nhân lực', 3, 'Quản trị', 'Tuyển dụng, đãi ngộ và đánh giá hiệu suất nhân sự.'],
  ];

  const insertCourse = db.prepare(`
    INSERT INTO courses (course_id, course_code, course_name, credit_hours, department, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const c of coursesData) {
    insertCourse.run(...c);
  }

  const insertEnrollment = db.prepare(`
    INSERT INTO enrollments (
      enrollment_id, student_id, course_id, semester, academic_year,
      letter_grade, numeric_grade, grade_point, completion_status, is_repeated, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Sinh viên 1: Nguyễn Minh Phương (22000001) — 75/130 tín chỉ, Giỏi
  const phuongEnrollments: Array<[string, string, string, string, string | null, number | null, number | null, string]> = [
    // Học kỳ 1 (2022-2023)
    ['ENR-P-01', 'CRS-CS101', 'Học kỳ 1', '2022-2023', 'B', 7.6, 3.0, 'Completed'],
    ['ENR-P-02', 'CRS-MAT101', 'Học kỳ 1', '2022-2023', 'C+', 6.7, 2.5, 'Completed'],
    ['ENR-P-03', 'CRS-ENG101', 'Học kỳ 1', '2022-2023', 'B', 7.8, 3.0, 'Completed'],
    ['ENR-P-04', 'CRS-ECO101', 'Học kỳ 1', '2022-2023', 'C+', 6.8, 2.5, 'Completed'],
    ['ENR-P-05', 'CRS-PHY101', 'Học kỳ 1', '2022-2023', 'C+', 6.6, 2.5, 'Completed'],
    // Học kỳ 2 (2022-2023)
    ['ENR-P-06', 'CRS-CS102', 'Học kỳ 2', '2022-2023', 'B+', 8.1, 3.5, 'Completed'],
    ['ENR-P-07', 'CRS-MAT102', 'Học kỳ 2', '2022-2023', 'B', 7.7, 3.0, 'Completed'],
    ['ENR-P-08', 'CRS-MIS201', 'Học kỳ 2', '2022-2023', 'B', 7.9, 3.0, 'Completed'],
    ['ENR-P-09', 'CRS-STA201', 'Học kỳ 2', '2022-2023', 'C+', 6.8, 2.5, 'Completed'],
    ['ENR-P-10', 'CRS-HUM102', 'Học kỳ 2', '2022-2023', 'C+', 6.9, 2.5, 'Completed'],
    // Học kỳ 3 (2023-2024)
    ['ENR-P-11', 'CRS-CS201', 'Học kỳ 3', '2023-2024', 'B+', 8.2, 3.5, 'Completed'],
    ['ENR-P-12', 'CRS-CS202', 'Học kỳ 3', '2023-2024', 'B+', 8.3, 3.5, 'Completed'],
    ['ENR-P-13', 'CRS-CS203', 'Học kỳ 3', '2023-2024', 'B', 7.6, 3.0, 'Completed'],
    ['ENR-P-14', 'CRS-SE201', 'Học kỳ 3', '2023-2024', 'B', 7.7, 3.0, 'Completed'],
    ['ENR-P-15', 'CRS-MGT202', 'Học kỳ 3', '2023-2024', 'C+', 6.8, 2.5, 'Completed'],
    // Học kỳ 4 (2023-2024)
    ['ENR-P-16', 'CRS-CS301', 'Học kỳ 4', '2023-2024', 'A', 9.1, 4.0, 'Completed'],
    ['ENR-P-17', 'CRS-CS302', 'Học kỳ 4', '2023-2024', 'B+', 8.3, 3.5, 'Completed'],
    ['ENR-P-18', 'CRS-CS303', 'Học kỳ 4', '2023-2024', 'B+', 8.4, 3.5, 'Completed'],
    ['ENR-P-19', 'CRS-AI301', 'Học kỳ 4', '2023-2024', 'B+', 8.1, 3.5, 'Completed'],
    ['ENR-P-20', 'CRS-SEC301', 'Học kỳ 4', '2023-2024', 'B', 7.8, 3.0, 'Completed'],
    // Học kỳ 5 (2024-2025)
    ['ENR-P-21', 'CRS-MGT101', 'Học kỳ 5', '2024-2025', 'A', 9.3, 4.0, 'Completed'],
    ['ENR-P-22', 'CRS-ACC101', 'Học kỳ 5', '2024-2025', 'A', 9.2, 4.0, 'Completed'],
    ['ENR-P-23', 'CRS-FIN201', 'Học kỳ 5', '2024-2025', 'A', 9.0, 4.0, 'Completed'],
    ['ENR-P-24', 'CRS-BUS102', 'Học kỳ 5', '2024-2025', 'B+', 8.4, 3.5, 'Completed'],
    ['ENR-P-25', 'CRS-MKT201', 'Học kỳ 5', '2024-2025', 'B+', 8.2, 3.5, 'Completed'],
    // Học kỳ 6 (2025-2026): Đang học (không tính vào GPA)
    ['ENR-P-26', 'CRS-CS401', 'Học kỳ 6', '2025-2026', null, null, null, 'In Progress'],
  ];

  for (const row of phuongEnrollments) {
    insertEnrollment.run(row[0], '22000001', row[1], row[2], row[3], row[4], row[5], row[6], row[7], 0, now);
  }

  // Sinh viên 2: Trần Hoàng Nam (22000002) — 45/130 tín chỉ đạt, 9 tín chỉ chưa đạt, CGPA < 2.00
  const namEnrollments: Array<[string, string, string, string, string | null, number | null, number | null, string]> = [
    ['ENR-N-01', 'CRS-ECO101', 'Học kỳ 1', '2022-2023', 'C', 6.0, 2.0, 'Completed'],
    ['ENR-N-02', 'CRS-MAT101', 'Học kỳ 1', '2022-2023', 'D+', 5.2, 1.5, 'Completed'],
    ['ENR-N-03', 'CRS-ENG101', 'Học kỳ 1', '2022-2023', 'C+', 6.6, 2.5, 'Completed'],
    ['ENR-N-04', 'CRS-CS101', 'Học kỳ 1', '2022-2023', 'C', 5.8, 2.0, 'Completed'],
    ['ENR-N-05', 'CRS-MGT101', 'Học kỳ 1', '2022-2023', 'B', 7.2, 3.0, 'Completed'],
    ['ENR-N-06', 'CRS-ACC101', 'Học kỳ 2', '2022-2023', 'D+', 5.1, 1.5, 'Completed'],
    ['ENR-N-07', 'CRS-STA201', 'Học kỳ 2', '2022-2023', 'F', 3.4, 0.0, 'Failed'],
    ['ENR-N-08', 'CRS-MIS201', 'Học kỳ 2', '2022-2023', 'C+', 6.7, 2.5, 'Completed'],
    ['ENR-N-09', 'CRS-FIN201', 'Học kỳ 2', '2022-2023', 'D', 4.5, 1.0, 'Completed'],
    ['ENR-N-10', 'CRS-BUS102', 'Học kỳ 2', '2022-2023', 'C', 5.9, 2.0, 'Completed'],
    ['ENR-N-11', 'CRS-ECO201', 'Học kỳ 3', '2023-2024', 'B+', 8.1, 3.5, 'Completed'],
    ['ENR-N-12', 'CRS-CS202', 'Học kỳ 3', '2023-2024', 'F', 3.1, 0.0, 'Failed'],
    ['ENR-N-13', 'CRS-LAW201', 'Học kỳ 3', '2023-2024', 'B', 7.1, 3.0, 'Completed'],
    ['ENR-N-14', 'CRS-MKT201', 'Học kỳ 3', '2023-2024', 'C', 6.1, 2.0, 'Completed'],
    ['ENR-N-15', 'CRS-CS301', 'Học kỳ 4', '2023-2024', 'B', 7.3, 3.0, 'Completed'],
    ['ENR-N-16', 'CRS-FIN301', 'Học kỳ 4', '2023-2024', 'F', 2.8, 0.0, 'Failed'],
    ['ENR-N-17', 'CRS-OPS301', 'Học kỳ 4', '2023-2024', 'B', 7.1, 3.0, 'Completed'],
    ['ENR-N-18', 'CRS-HRM201', 'Học kỳ 4', '2023-2024', 'C', 6.2, 2.0, 'Completed'],
    ['ENR-N-19', 'CRS-MGT202', 'Học kỳ 5', '2024-2025', null, null, null, 'In Progress'],
  ];

  for (const row of namEnrollments) {
    insertEnrollment.run(row[0], '22000002', row[1], row[2], row[3], row[4], row[5], row[6], row[7], 0, now);
  }

  // Sinh viên 3: Lê Thảo Vy (23000018) — 30/130 tín chỉ, Xuất sắc
  const vyEnrollments: Array<[string, string, string, string, string | null, number | null, number | null, string]> = [
    ['ENR-V-01', 'CRS-CS101', 'Học kỳ 1', '2023-2024', 'A+', 9.5, 4.0, 'Completed'],
    ['ENR-V-02', 'CRS-MAT101', 'Học kỳ 1', '2023-2024', 'A', 8.8, 4.0, 'Completed'],
    ['ENR-V-03', 'CRS-ENG101', 'Học kỳ 1', '2023-2024', 'A', 9.2, 4.0, 'Completed'],
    ['ENR-V-04', 'CRS-PHY101', 'Học kỳ 1', '2023-2024', 'B+', 8.3, 3.5, 'Completed'],
    ['ENR-V-05', 'CRS-ECO101', 'Học kỳ 1', '2023-2024', 'A', 8.7, 4.0, 'Completed'],
    ['ENR-V-06', 'CRS-CS102', 'Học kỳ 2', '2023-2024', 'A+', 9.6, 4.0, 'Completed'],
    ['ENR-V-07', 'CRS-MAT102', 'Học kỳ 2', '2023-2024', 'A', 9.1, 4.0, 'Completed'],
    ['ENR-V-08', 'CRS-STA201', 'Học kỳ 2', '2023-2024', 'A', 8.6, 4.0, 'Completed'],
    ['ENR-V-09', 'CRS-CS201', 'Học kỳ 2', '2023-2024', 'A', 9.4, 4.0, 'Completed'],
    ['ENR-V-10', 'CRS-HUM102', 'Học kỳ 2', '2023-2024', 'B+', 8.4, 3.5, 'Completed'],
  ];

  for (const row of vyEnrollments) {
    insertEnrollment.run(row[0], '23000018', row[1], row[2], row[3], row[4], row[5], row[6], row[7], 0, now);
  }

  migrateLegacyTermsAndEnsureDemoJourney();
  ensureThreeRoleSystemAndDemoAccounts();
  migrateToTenScaleIntegerCreditsAndReports();
  ensureTuitionModuleInitialized();

  const insertActivity = db.prepare(`
    INSERT INTO academic_activities (activity_id, student_id, actor_user_id, activity_type, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertActivity.run('ACT-01', '22000001', 'USR-ADM-01', 'CẬP NHẬT ĐIỂM', 'Hoàn tất điểm học phần MGT101 Quản trị học đại cương (Điểm chữ: A, 4.00).', now);
  insertActivity.run('ACT-02', '22000001', 'USR-STU-01', 'HỌC CẢI THIỆN', 'Hoàn thành học cải thiện MAT101 Toán cao cấp 1 (Học kỳ hè 2024-2025 — Điểm: A, 4.00).', now);
  insertActivity.run('ACT-03', '22000001', 'USR-STU-01', 'ĐĂNG KÝ HỌC PHẦN', 'Đăng ký học phần MIS401 Thương mại điện tử nâng cao cho Học kỳ 1 (2025-2026).', now);
  insertActivity.run('ACT-04', '22000002', 'USR-ADM-01', 'CẬP NHẬT ĐIỂM', 'Cập nhật kết quả học phần FIN301 Phân tích đầu tư tài chính (Điểm: F, 0.00).', now);
  insertActivity.run('ACT-05', '22000002', 'USR-ADM-01', 'CẢNH BÁO HỌC VỤ', 'Hệ thống tự động phát sinh cảnh báo học vụ do GPA tích lũy thấp và học phần chưa đạt lặp lại.', now);

  return true;
}

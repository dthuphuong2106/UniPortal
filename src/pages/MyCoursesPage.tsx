import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  CompletionStatus,
  EnrollmentRecord,
  formatGpa,
  roundGpa,
  resolveGradeFromScale,
  resolveLetterFromNumeric,
  semesterSortRank,
  translateCompletionStatus,
} from '../../shared/academicLogic.ts';
import { api, CatalogCourse, StudentOverviewResponse } from '../services/api.ts';
import { ConfirmModal, SemanticStatusBadge, SemanticTone } from '../components/PortalUI.tsx';

function statusTone(status: CompletionStatus): SemanticTone {
  if (status === 'Completed') return 'success';
  if (status === 'Failed') return 'danger';
  if (status === 'In Progress') return 'info';
  return 'neutral';
}

interface CourseFormState {
  course_code: string;
  course_name: string;
  credit_hours: string;
  semester: string;
  academic_year: string;
  completion_status: CompletionStatus;
  letter_grade: string;
  numeric_grade: string;
}

const EMPTY_FORM: CourseFormState = {
  course_code: '',
  course_name: '',
  credit_hours: '3',
  semester: 'Học kỳ 1',
  academic_year: '2025-2026',
  completion_status: 'Completed',
  letter_grade: 'B+',
  numeric_grade: '',
};

const PAGE_SIZE = 10;

export function MyCoursesPage({
  overview,
  catalog,
  targetStudentId,
  viewMode = 'table',
  readOnly = false,
  onReload,
}: {
  overview: StudentOverviewResponse;
  catalog: CatalogCourse[];
  targetStudentId?: string;
  viewMode?: 'table' | 'cards';
  readOnly?: boolean;
  onReload: () => Promise<void>;
}) {
  const studentId = targetStudentId || overview.student.student_id;
  const { enrollments, settings, summary } = overview;

  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EnrollmentRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<EnrollmentRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<EnrollmentRecord | null>(null);

  const [form, setForm] = useState<CourseFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const { academicTerms } = overview;

  const uniqueSemesters = useMemo(
    () =>
      Array.from(
        new Set([
          ...enrollments.map((e) => e.semester),
          ...(academicTerms?.semesters ?? []).map((s) => s.semester_name),
        ])
      ).sort((a, b) => semesterSortRank(a) - semesterSortRank(b) || a.localeCompare(b)),
    [enrollments, academicTerms]
  );

  const uniqueYears = useMemo(
    () =>
      Array.from(
        new Set([
          ...enrollments.map((e) => e.academic_year),
          ...(academicTerms?.years ?? []).map((y) => y.year_code),
        ])
      ).sort((a, b) => a.localeCompare(b)),
    [enrollments, academicTerms]
  );

  const modalYearOptions = useMemo(() => {
    const activeYears = (academicTerms?.years ?? [])
      .filter((y) => y.is_active === 1 || y.year_code === form.academic_year)
      .map((y) => y.year_code);
    return Array.from(new Set([...activeYears, form.academic_year].filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [academicTerms, form.academic_year]);

  const modalSemesterOptions = useMemo(() => {
    const forYear = (academicTerms?.semesters ?? [])
      .filter(
        (s) =>
          s.academic_year === form.academic_year &&
          (s.is_active === 1 || s.semester_name === form.semester)
      )
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => s.semester_name);
    const fallback = forYear.length > 0 ? forYear : ['Học kỳ 1', 'Học kỳ 2', 'Học kỳ hè'];
    return Array.from(new Set([...fallback, form.semester].filter(Boolean))).sort(
      (a, b) => semesterSortRank(a) - semesterSortRank(b) || a.localeCompare(b)
    );
  }, [academicTerms, form.academic_year, form.semester]);

  const filteredEnrollments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrollments.filter((e) => {
      if (semesterFilter !== 'ALL' && e.semester !== semesterFilter) return false;
      if (yearFilter !== 'ALL' && e.academic_year !== yearFilter) return false;
      if (statusFilter !== 'ALL' && e.completion_status !== statusFilter) return false;
      if (
        q &&
        !e.course_code.toLowerCase().includes(q) &&
        !e.course_name.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [enrollments, search, semesterFilter, yearFilter, statusFilter]);

  // Live stats for the currently filtered view
  const filteredStats = useMemo(() => {
    let earned = 0;
    let failed = 0;
    let gpaCredits = 0;
    let weighted = 0;
    for (const e of filteredEnrollments) {
      if (e.completion_status === 'Completed') {
        earned += e.credit_hours;
      } else if (e.completion_status === 'Failed') {
        failed += e.credit_hours;
      }
      if (
        (e.completion_status === 'Completed' || e.completion_status === 'Failed') &&
        e.grade_point !== null &&
        (settings.gpaPolicy.failedCourseInGpa || e.completion_status !== 'Failed')
      ) {
        gpaCredits += e.credit_hours;
        weighted += e.credit_hours * e.grade_point;
      }
    }
    return {
      count: filteredEnrollments.length,
      earned,
      failed,
      termGpa: gpaCredits > 0 ? roundGpa(weighted / gpaCredits) : null,
    };
  }, [filteredEnrollments, settings.gpaPolicy.failedCourseInGpa]);

  const totalPages = Math.max(1, Math.ceil(filteredEnrollments.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedEnrollments = useMemo(() => {
    if (viewMode === 'cards') return filteredEnrollments;
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredEnrollments.slice(start, start + PAGE_SIZE);
  }, [filteredEnrollments, safePage, viewMode]);

  const openAddModal = () => {
    setEditingRecord(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (rec: EnrollmentRecord) => {
    setEditingRecord(rec);
    setForm({
      course_code: rec.course_code,
      course_name: rec.course_name,
      credit_hours: String(rec.credit_hours),
      semester: rec.semester,
      academic_year: rec.academic_year,
      completion_status: rec.completion_status,
      letter_grade: rec.letter_grade ?? '',
      numeric_grade: rec.numeric_grade !== null ? String(rec.numeric_grade) : '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleCatalogPick = (courseCode: string) => {
    const match = catalog.find((c) => c.course_code === courseCode);
    if (match) {
      setForm((prev) => ({
        ...prev,
        course_code: match.course_code,
        course_name: match.course_name,
        credit_hours: String(match.credit_hours),
      }));
    }
  };

  const handleNumericChange = (val: string) => {
    setForm((prev) => {
      const next = { ...prev, numeric_grade: val };
      const num = Number(val);
      if (val.trim() !== '' && Number.isFinite(num) && num >= 0 && num <= 100) {
        const resolved = resolveLetterFromNumeric(num, settings.gradingScale);
        if (resolved) {
          next.letter_grade = resolved.letter;
          next.completion_status = resolved.passing ? 'Completed' : 'Failed';
        }
      }
      return next;
    });
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const code = form.course_code.trim().toUpperCase();
    const name = form.course_name.trim();
    const credits = Number(form.credit_hours);

    if (!code) {
      setFormError('Vui lòng nhập mã học phần.');
      return;
    }
    if (!name) {
      setFormError('Vui lòng nhập tên học phần.');
      return;
    }
    if (!Number.isFinite(credits) || credits <= 0 || credits > 12) {
      setFormError('Số tín chỉ phải nằm trong khoảng từ 0.5 đến 12.');
      return;
    }
    if (!form.semester.trim() || !form.academic_year.trim()) {
      setFormError('Vui lòng nhập học kỳ và năm học.');
      return;
    }

    const isFinalized =
      form.completion_status === 'Completed' || form.completion_status === 'Failed';

    let finalLetter: string | null = form.letter_grade.trim().toUpperCase() || null;
    let finalNumeric: number | null =
      form.numeric_grade.trim() !== '' ? Number(form.numeric_grade) : null;

    if (
      finalNumeric !== null &&
      (!Number.isFinite(finalNumeric) || finalNumeric < 0 || finalNumeric > 100)
    ) {
      setFormError('Điểm số (thang 100) phải nằm trong khoảng 0 đến 100.');
      return;
    }

    if (isFinalized) {
      const match = resolveGradeFromScale(finalLetter, settings.gradingScale);
      if (!match) {
        setFormError('Vui lòng chọn điểm chữ hợp lệ theo thang điểm của nhà trường.');
        return;
      }
      if (form.completion_status === 'Failed' && match.passing) {
        setFormError(
          `Điểm "${match.letter}" là điểm đạt. Vui lòng đổi trạng thái thành Đạt hoặc chọn điểm F.`
        );
        return;
      }
      if (form.completion_status === 'Completed' && !match.passing) {
        setFormError(
          `Điểm "${match.letter}" là điểm chưa đạt. Vui lòng đổi trạng thái thành Chưa đạt.`
        );
        return;
      }
      finalLetter = match.letter;
    } else {
      finalLetter = null;
      finalNumeric = null;
    }

    setSubmitting(true);
    try {
      const payload = {
        course_code: code,
        course_name: name,
        credit_hours: credits,
        semester: form.semester.trim(),
        academic_year: form.academic_year.trim(),
        letter_grade: finalLetter,
        numeric_grade: finalNumeric,
        completion_status: form.completion_status,
      };

      if (editingRecord) {
        await api.updateEnrollment(studentId, editingRecord.enrollment_id, payload);
        setActionFeedback(`Đã cập nhật học phần ${code} và tự động tính lại GPA cùng cảnh báo học vụ.`);
      } else {
        await api.addEnrollment(studentId, payload);
        setActionFeedback(`Đã thêm học phần ${code} và tự động tính lại GPA cùng cảnh báo học vụ.`);
      }

      setModalOpen(false);
      await onReload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể lưu thông tin học phần.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;
    setSubmitting(true);
    try {
      await api.deleteEnrollment(studentId, deletingRecord.enrollment_id);
      setActionFeedback(
        `Đã xóa học phần ${deletingRecord.course_code} và cập nhật lại bảng điểm tích lũy.`
      );
      setDeletingRecord(null);
      await onReload();
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : 'Xóa học phần thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Statistics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4">
          <div className="text-xs font-medium text-[#858BA3]">GPA tích lũy toàn khóa</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-[#6558E8]">
              {formatGpa(summary.cgpa)}
            </span>
            <span className="text-xs font-mono text-[#858BA3]">/ 4.00</span>
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4">
          <div className="text-xs font-medium text-[#858BA3]">
            {semesterFilter === 'ALL' && yearFilter === 'ALL' ? 'GPA theo bộ lọc' : 'GPA học kỳ đã lọc'}
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#20243A]">
            {formatGpa(filteredStats.termGpa)}
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4">
          <div className="text-xs font-medium text-[#858BA3]">Tín chỉ tích lũy</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-[#36B37E]">
              {summary.earnedCredits}
            </span>
            <span className="text-xs font-mono text-[#858BA3]">/ {summary.totalRequiredCredits}</span>
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-[#858BA3]">Tín chỉ chưa đạt</div>
            <div
              className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
                summary.failedCredits > 0 ? 'text-[#EF6472]' : 'text-[#20243A]'
              }`}
            >
              {summary.failedCredits}
            </div>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm học phần</span>
            </button>
          )}
        </div>
      </div>

      {actionFeedback && (
        <div className="bg-[#F0EDFF] border border-[#8174F7]/30 text-[#20243A] rounded-2xl px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{actionFeedback}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-[#6558E8] hover:text-[#20243A] p-1"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#858BA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm mã hoặc tên học phần..."
            className="w-full pl-10 pr-3 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A] placeholder:text-[#858BA3] focus:outline-none focus:bg-white focus:border-[#8174F7]"
          />
        </div>

        <select
          value={semesterFilter}
          onChange={(e) => {
            setSemesterFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo học kỳ"
          className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A] focus:outline-none focus:bg-white focus:border-[#8174F7]"
        >
          <option value="ALL">Tất cả học kỳ</option>
          {uniqueSemesters.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => {
            setYearFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo năm học"
          className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A] focus:outline-none focus:bg-white focus:border-[#8174F7]"
        >
          <option value="ALL">Tất cả năm học</option>
          {uniqueYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo trạng thái"
          className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A] focus:outline-none focus:bg-white focus:border-[#8174F7]"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="Completed">Đạt</option>
          <option value="Failed">Chưa đạt</option>
          <option value="In Progress">Đang học</option>
          <option value="Withdrawn">Đã rút</option>
        </select>
      </div>

      {/* Empty State */}
      {filteredEnrollments.length === 0 ? (
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="text-base font-bold text-[#20243A]">Không tìm thấy học phần phù hợp</div>
          <p className="text-sm text-[#858BA3] mt-1 mb-5">
            {enrollments.length === 0
              ? 'Hãy bắt đầu bằng cách thêm học phần đầu tiên của bạn.'
              : 'Thử điều chỉnh từ khóa tìm kiếm hoặc bộ lọc học kỳ.'}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2.5 bg-[#8174F7] text-white text-sm font-semibold rounded-xl hover:bg-[#6558E8] transition-colors"
            >
              Thêm học phần
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* Trang 4: Danh sách học phần (Card View) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {paginatedEnrollments.map((rec) => (
            <div
              key={rec.enrollment_id}
              className="bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#8174F7]/50 transition-all flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="px-2.5 py-1 rounded-lg bg-[#F0EDFF] text-[#6558E8] font-mono text-xs font-semibold">
                    {rec.course_code}
                  </span>
                  <SemanticStatusBadge
                    tone={statusTone(rec.completion_status)}
                    label={translateCompletionStatus(rec.completion_status)}
                  />
                </div>

                <h3 className="text-base font-bold text-[#20243A] leading-snug">
                  {rec.course_name}
                </h3>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#858BA3]">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {rec.semester} · {rec.academic_year}
                    </span>
                  </span>
                  <span className="font-mono font-medium text-[#20243A]">
                    {rec.credit_hours} tín chỉ
                  </span>
                </div>
              </div>

              <div className="pt-3.5 border-t border-[#ECEEF5] flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-[#858BA3]">Kết quả:</span>
                  <span className="font-mono font-bold text-base text-[#20243A]">
                    {rec.letter_grade ?? '—'}
                  </span>
                  {rec.grade_point !== null && (
                    <span className="font-mono text-xs text-[#6558E8] tabular-nums">
                      ({rec.grade_point.toFixed(2)})
                    </span>
                  )}
                </div>

                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewingRecord(rec)}
                    className="p-2 text-[#858BA3] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-lg transition-colors"
                    aria-label={`Xem chi tiết ${rec.course_code}`}
                    title="Xem chi tiết"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(rec)}
                        className="p-2 text-[#858BA3] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-lg transition-colors"
                        aria-label={`Chỉnh sửa ${rec.course_code}`}
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRecord(rec)}
                        className="p-2 text-[#858BA3] hover:text-[#C83D4C] hover:bg-[#EF6472]/10 rounded-lg transition-colors"
                        aria-label={`Xóa ${rec.course_code}`}
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Trang 3: Kết quả học tập (Minimalist Table View) */
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                  <th className="py-3.5 px-5">Mã học phần</th>
                  <th className="py-3.5 px-5">Tên học phần</th>
                  <th className="py-3.5 px-5">Học kỳ</th>
                  <th className="py-3.5 px-5">Năm học</th>
                  <th className="py-3.5 px-5 text-right">Tín chỉ</th>
                  <th className="py-3.5 px-5 text-center">Điểm chữ</th>
                  <th className="py-3.5 px-5 text-right">Điểm hệ 4</th>
                  <th className="py-3.5 px-5">Trạng thái</th>
                  <th className="py-3.5 px-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5] text-sm">
                {paginatedEnrollments.map((rec) => {
                  const isPendingOfficial =
                    rec.is_official === 0 ||
                    (Boolean(rec.section_code) && rec.completion_status === 'In Progress');
                  return (
                  <tr key={rec.enrollment_id} className="hover:bg-[#F8F9FD]/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono font-semibold text-[#6558E8] whitespace-nowrap">
                      {rec.course_code}
                    </td>
                    <td className="py-3.5 px-5 text-[#20243A] font-medium min-w-[210px]">
                      <div>{rec.course_name}</div>
                      {isPendingOfficial && (
                        <div className="text-[11px] font-normal text-[#858BA3] mt-0.5">
                          {rec.section_code
                            ? `Lớp ${rec.section_code} · Chờ duyệt bảng điểm`
                            : 'Chờ duyệt bảng điểm'}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-[#555C75] whitespace-nowrap">{rec.semester}</td>
                    <td className="py-3.5 px-5 font-mono text-[#858BA3] whitespace-nowrap tabular-nums">
                      {rec.academic_year}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono tabular-nums text-[#20243A]">
                      {rec.credit_hours}
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono font-semibold text-[#20243A]">
                      {rec.letter_grade ?? '—'}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono tabular-nums text-[#20243A]">
                      {rec.grade_point !== null ? rec.grade_point.toFixed(2) : '—'}
                    </td>
                    <td className="py-3.5 px-5">
                      <SemanticStatusBadge
                        tone={statusTone(rec.completion_status)}
                        label={translateCompletionStatus(rec.completion_status)}
                      />
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingRecord(rec)}
                          className="p-1.5 text-[#858BA3] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-lg transition-colors"
                          aria-label={`Xem ${rec.course_code}`}
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(rec)}
                              className="p-1.5 text-[#858BA3] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-lg transition-colors"
                              aria-label={`Sửa ${rec.course_code}`}
                              title="Chỉnh sửa học phần"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingRecord(rec)}
                              className="p-1.5 text-[#858BA3] hover:text-[#C83D4C] hover:bg-[#EF6472]/10 rounded-lg transition-colors"
                              aria-label={`Xóa ${rec.course_code}`}
                              title="Xóa học phần"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-[#ECEEF5] bg-[#F8F9FD]/60 flex flex-wrap items-center justify-between gap-3 text-xs text-[#858BA3]">
              <div>
                Hiển thị{' '}
                <span className="font-mono font-semibold text-[#20243A]">
                  {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filteredEnrollments.length)}
                </span>{' '}
                trên tổng số{' '}
                <span className="font-mono font-semibold text-[#20243A]">
                  {filteredEnrollments.length}
                </span>{' '}
                học phần
              </div>
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-[#ECEEF5] bg-white text-[#20243A] disabled:opacity-40 hover:bg-[#F0EDFF]"
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono text-[#20243A]">
                  Trang {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-[#ECEEF5] bg-white text-[#20243A] disabled:opacity-40 hover:bg-[#F0EDFF]"
                  aria-label="Trang tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Thêm / Chỉnh sửa học phần */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-3.5 border-b border-[#ECEEF5] mb-4">
              <h3 className="text-lg font-bold text-[#20243A]">
                {editingRecord
                  ? `Chỉnh sửa học phần (${editingRecord.course_code})`
                  : 'Thêm học phần mới'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[#858BA3] hover:text-[#20243A] p-1 rounded-lg"
                aria-label="Đóng hộp thoại"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCourse} className="space-y-4">
              {!editingRecord && catalog.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#858BA3] mb-1.5">
                    Chọn nhanh từ danh mục học phần (Không bắt buộc)
                  </label>
                  <select
                    onChange={(e) => handleCatalogPick(e.target.value)}
                    defaultValue=""
                    className="w-full px-3.5 py-2 text-sm border border-[#ECEEF5] rounded-xl bg-[#F8F9FD] text-[#20243A]"
                  >
                    <option value="" disabled>
                      Chọn học phần có sẵn hoặc tự nhập bên dưới...
                    </option>
                    {catalog.map((c) => (
                      <option key={c.course_id} value={c.course_code}>
                        {c.course_code} — {c.course_name} ({c.credit_hours} tín chỉ)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="course-code"
                    className="block text-xs font-medium text-[#20243A] mb-1.5"
                  >
                    Mã học phần *
                  </label>
                  <input
                    id="course-code"
                    type="text"
                    value={form.course_code}
                    onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                    placeholder="VD: INT304"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="course-credits"
                    className="block text-xs font-medium text-[#20243A] mb-1.5"
                  >
                    Số tín chỉ *
                  </label>
                  <input
                    id="course-credits"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="12"
                    value={form.credit_hours}
                    onChange={(e) => setForm({ ...form, credit_hours: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="course-name"
                  className="block text-xs font-medium text-[#20243A] mb-1.5"
                >
                  Tên học phần *
                </label>
                <input
                  id="course-name"
                  type="text"
                  value={form.course_name}
                  onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                  placeholder="VD: Nhập môn Trí tuệ nhân tạo"
                  className="w-full px-3.5 py-2 text-sm border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="course-year"
                    className="block text-xs font-medium text-[#20243A] mb-1.5"
                  >
                    Năm học *
                  </label>
                  <select
                    id="course-year"
                    value={form.academic_year}
                    onChange={(e) => {
                      const nextYear = e.target.value;
                      const yearSems = (academicTerms?.semesters ?? [])
                        .filter((s) => s.academic_year === nextYear && s.is_active === 1)
                        .sort((a, b) => a.sort_order - b.sort_order);
                      setForm((prev) => ({
                        ...prev,
                        academic_year: nextYear,
                        semester:
                          yearSems.some((s) => s.semester_name === prev.semester)
                            ? prev.semester
                            : yearSems[0]?.semester_name ?? 'Học kỳ 1',
                      }));
                    }}
                    className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl bg-white focus:outline-none focus:border-[#8174F7]"
                  >
                    {modalYearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="course-semester"
                    className="block text-xs font-medium text-[#20243A] mb-1.5"
                  >
                    Học kỳ *
                  </label>
                  <select
                    id="course-semester"
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-[#ECEEF5] rounded-xl bg-white focus:outline-none focus:border-[#8174F7]"
                  >
                    {modalSemesterOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="course-status"
                    className="block text-xs font-medium text-[#20243A] mb-1.5"
                  >
                    Trạng thái *
                  </label>
                  <select
                    id="course-status"
                    value={form.completion_status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as CompletionStatus;
                      setForm((prev) => ({
                        ...prev,
                        completion_status: nextStatus,
                        letter_grade:
                          nextStatus === 'Failed'
                            ? 'F'
                            : nextStatus === 'Completed' && prev.letter_grade === 'F'
                              ? 'C'
                              : prev.letter_grade,
                      }));
                    }}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl bg-white"
                  >
                    <option value="Completed">Đạt</option>
                    <option value="Failed">Chưa đạt</option>
                    <option value="In Progress">Đang học</option>
                    <option value="Withdrawn">Đã rút</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="course-letter"
                    className="block text-xs font-medium text-[#20243A] mb-1.5"
                  >
                    Điểm chữ
                  </label>
                  <select
                    id="course-letter"
                    disabled={
                      form.completion_status === 'In Progress' ||
                      form.completion_status === 'Withdrawn'
                    }
                    value={form.letter_grade}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = resolveGradeFromScale(val, settings.gradingScale);
                      setForm((prev) => ({
                        ...prev,
                        letter_grade: val,
                        completion_status:
                          match && !match.passing ? 'Failed' : prev.completion_status,
                      }));
                    }}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl bg-white disabled:bg-[#F8F9FD] disabled:text-[#858BA3]"
                  >
                    <option value="">Chọn điểm</option>
                    {settings.gradingScale.map((g) => (
                      <option key={g.letter} value={g.letter}>
                        {g.letter} ({g.point.toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="course-numeric"
                    className="block text-xs font-medium text-[#20243A] mb-1.5"
                  >
                    Điểm số (0–100)
                  </label>
                  <input
                    id="course-numeric"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    disabled={
                      form.completion_status === 'In Progress' ||
                      form.completion_status === 'Withdrawn'
                    }
                    value={form.numeric_grade}
                    onChange={(e) => handleNumericChange(e.target.value)}
                    placeholder="Không bắt buộc"
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl disabled:bg-[#F8F9FD]"
                  />
                </div>
              </div>

              {(form.completion_status === 'In Progress' ||
                form.completion_status === 'Withdrawn') && (
                <div className="text-xs text-[#6558E8] bg-[#F0EDFF] border border-[#8174F7]/25 rounded-xl p-3">
                  Học phần ở trạng thái{' '}
                  <strong>{translateCompletionStatus(form.completion_status)}</strong> chưa có điểm
                  tổng kết nên sẽ không tính vào GPA học kỳ và GPA tích lũy.
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#ECEEF5]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#20243A] bg-white border border-[#ECEEF5] rounded-xl hover:bg-[#F8F9FD]"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] disabled:opacity-60 rounded-xl transition-colors"
                >
                  {submitting
                    ? 'Đang lưu...'
                    : editingRecord
                      ? 'Lưu thay đổi'
                      : 'Thêm học phần'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xem chi tiết học phần */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-[#ECEEF5] mb-4">
              <div>
                <div className="text-xs font-mono font-semibold text-[#6558E8]">
                  {viewingRecord.course_code}
                </div>
                <h3 className="text-lg font-bold text-[#20243A] mt-0.5">
                  {viewingRecord.course_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="text-[#858BA3] hover:text-[#20243A] p-1"
                aria-label="Đóng chi tiết"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-[#ECEEF5]">
                <dt className="text-[#858BA3]">Học kỳ & Năm học</dt>
                <dd className="font-medium text-[#20243A]">
                  {viewingRecord.semester} · {viewingRecord.academic_year}
                </dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#ECEEF5]">
                <dt className="text-[#858BA3]">Số tín chỉ</dt>
                <dd className="font-mono font-semibold text-[#20243A]">
                  {viewingRecord.credit_hours}
                </dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#ECEEF5]">
                <dt className="text-[#858BA3]">Trạng thái</dt>
                <dd>
                  <SemanticStatusBadge
                    tone={statusTone(viewingRecord.completion_status)}
                    label={translateCompletionStatus(viewingRecord.completion_status)}
                  />
                </dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#ECEEF5]">
                <dt className="text-[#858BA3]">Điểm chữ / Hệ 4</dt>
                <dd className="font-mono font-semibold text-[#20243A]">
                  {viewingRecord.letter_grade ?? '—'} (
                  {viewingRecord.grade_point !== null
                    ? viewingRecord.grade_point.toFixed(2)
                    : '—'}
                  )
                </dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#ECEEF5]">
                <dt className="text-[#858BA3]">Điểm hệ 100</dt>
                <dd className="font-mono text-[#20243A]">
                  {viewingRecord.numeric_grade !== null
                    ? `${viewingRecord.numeric_grade} / 100`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between py-1.5">
                <dt className="text-[#858BA3]">Điểm trọng số</dt>
                <dd className="font-mono font-bold text-[#6558E8]">
                  {viewingRecord.grade_point !== null
                    ? (viewingRecord.credit_hours * viewingRecord.grade_point).toFixed(2)
                    : 'Không tính vào GPA'}
                </dd>
              </div>
            </dl>
            <div className="mt-6 text-right">
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="px-4 py-2 text-sm font-semibold bg-[#8174F7] hover:bg-[#6558E8] text-white rounded-xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deletingRecord)}
        title="Xác nhận xóa học phần"
        message={
          deletingRecord
            ? `Bạn có chắc muốn xóa học phần ${deletingRecord.course_code} (${deletingRecord.course_name}, ${deletingRecord.semester} ${deletingRecord.academic_year})? GPA học kỳ, GPA tích lũy và cảnh báo học vụ sẽ được tự động tính toán lại.`
            : ''
        }
        confirmLabel="Xóa học phần"
        danger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeletingRecord(null)}
      />
    </div>
  );
}

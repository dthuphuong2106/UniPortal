import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  CompletionStatus,
  formatGpa,
  formatTenScale,
  resolveGradeFromScale,
  resolveLetterFromNumeric,
  SemesterGpaSummary,
  translateCompletionStatus,
  validateCourseCredit,
  validateScoreOnTenScale,
} from '../../shared/academicLogic.ts';
import { api, CatalogCourse, StudentOverviewResponse } from '../services/api.ts';
import { SemanticStatusBadge, SemanticTone } from '../components/PortalUI.tsx';

function statusTone(status: CompletionStatus): SemanticTone {
  if (status === 'Completed') return 'success';
  if (status === 'Failed') return 'danger';
  if (status === 'In Progress') return 'info';
  return 'neutral';
}

export function AcademicHistoryPage({
  overview,
  catalog,
  readOnly = false,
  onReload,
}: {
  overview: StudentOverviewResponse;
  catalog: CatalogCourse[];
  readOnly?: boolean;
  onReload: () => Promise<void>;
}) {
  const { student, summary, academicTerms, settings } = overview;
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [showEmptyTerms, setShowEmptyTerms] = useState<boolean>(false);

  const semesterMap = useMemo(() => {
    const map = new Map<string, SemesterGpaSummary>();
    for (const sem of summary.semesters) {
      map.set(`${sem.academic_year}::${sem.semester}`, sem);
    }
    return map;
  }, [summary.semesters]);

  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    const latest = summary.semesters[summary.semesters.length - 1];
    if (latest) {
      init[`${latest.academic_year}::${latest.semester}`] = true;
    }
    return init;
  });

  // Quick Add Course modal right inside Lịch sử học tập
  const [addModalTerm, setAddModalTerm] = useState<{ academicYear: string; semester: string } | null>(
    null
  );
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [creditHours, setCreditHours] = useState('3');
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus>('Completed');
  const [letterGrade, setLetterGrade] = useState('B+');
  const [numericGrade, setNumericGrade] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const yearGroups = useMemo(() => {
    const allYearCodes = new Set<string>();
    for (const y of academicTerms.years) {
      allYearCodes.add(y.year_code);
    }
    for (const s of summary.semesters) {
      allYearCodes.add(s.academic_year);
    }

    const sortedYears = Array.from(allYearCodes).sort((a, b) => a.localeCompare(b));

    return sortedYears
      .map((yearCode) => {
        const yearMeta = academicTerms.years.find((y) => y.year_code === yearCode);
        const configuredSems = academicTerms.semesters
          .filter((s) => s.academic_year === yearCode)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => s.semester_name);

        const defaultSems = ['Học kỳ 1', 'Học kỳ 2', 'Học kỳ hè'];
        const semNames = Array.from(
          new Set([
            ...(configuredSems.length > 0 ? configuredSems : defaultSems),
            ...summary.semesters
              .filter((s) => s.academic_year === yearCode)
              .map((s) => s.semester),
          ])
        );

        const terms = semNames
          .map((semName) => {
            const key = `${yearCode}::${semName}`;
            const data = semesterMap.get(key) ?? null;
            return { key, semester: semName, data };
          })
          .filter((t) => showEmptyTerms || t.data !== null);

        return {
          yearCode,
          yearName: yearMeta?.year_name ?? `Năm học ${yearCode.replace('-', '–')}`,
          terms,
        };
      })
      .filter((yg) => showEmptyTerms || yg.terms.length > 0);
  }, [academicTerms, summary.semesters, semesterMap, showEmptyTerms]);

  const visibleYears = useMemo(
    () =>
      selectedYear === 'ALL'
        ? yearGroups
        : yearGroups.filter((y) => y.yearCode === selectedYear),
    [yearGroups, selectedYear]
  );

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const y of visibleYears) {
      for (const t of y.terms) {
        if (t.data) next[t.key] = true;
      }
    }
    setExpandedKeys(next);
  };

  const collapseAll = () => {
    setExpandedKeys({});
  };

  const openQuickAdd = (academicYear: string, semester: string) => {
    setAddModalTerm({ academicYear, semester });
    setCourseCode('');
    setCourseName('');
    setCreditHours('3');
    setCompletionStatus('Completed');
    setLetterGrade('B+');
    setNumericGrade('');
    setFormError(null);
  };

  const handleCatalogPick = (code: string) => {
    const found = catalog.find((c) => c.course_code === code);
    if (found) {
      setCourseCode(found.course_code);
      setCourseName(found.course_name);
      setCreditHours(String(found.credit_hours));
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addModalTerm) return;
    setFormError(null);
    const creditCheck = validateCourseCredit(creditHours);
    if (!creditCheck.valid) {
      setFormError(creditCheck.error ?? 'Số tín chỉ phải là số nguyên dương từ 1 đến 12.');
      return;
    }
    const isFinalized = completionStatus === 'Completed' || completionStatus === 'Failed';
    const scoreCheck = validateScoreOnTenScale(numericGrade);
    if (isFinalized && !scoreCheck.valid) {
      setFormError(scoreCheck.error ?? 'Điểm hệ 10 phải nằm trong khoảng 0.00 đến 10.00.');
      return;
    }
    setSaving(true);
    try {
      await api.addEnrollment(student.student_id, {
        course_code: courseCode.trim().toUpperCase(),
        course_name: courseName.trim(),
        credit_hours: creditCheck.value,
        semester: addModalTerm.semester,
        academic_year: addModalTerm.academicYear,
        completion_status: completionStatus,
        letter_grade: isFinalized ? letterGrade : null,
        numeric_grade: isFinalized ? scoreCheck.value : null,
      });
      setExpandedKeys((prev) => ({
        ...prev,
        [`${addModalTerm.academicYear}::${addModalTerm.semester}`]: true,
      }));
      setAddModalTerm(null);
      await onReload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể thêm học phần vào học kỳ.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary Strip */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div>
          <h2 className="text-lg font-bold text-[#20243A]">
            Lịch sử học tập toàn khóa học
          </h2>
          <p className="text-xs text-[#858BA3] mt-1">
            Tổng hợp kết quả từng năm học và học kỳ theo trình tự thời gian từ lúc nhập học đến hiện tại.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-2xl bg-[#F0EDFF]/70 border border-[#8174F7]/20">
            <div className="text-[11px] text-[#6558E8] font-medium">GPA tích lũy (CGPA)</div>
            <div className="text-lg font-bold font-mono text-[#20243A] tabular-nums">
              {formatGpa(summary.cgpa)}
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5]">
            <div className="text-[11px] text-[#858BA3] font-medium">Số học kỳ đã học</div>
            <div className="text-lg font-bold font-mono text-[#20243A] tabular-nums">
              {summary.semesters.length}
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-[#36B37E]/[0.08] border border-[#36B37E]/25">
            <div className="text-[11px] text-[#238A5E] font-medium">Tín chỉ đạt</div>
            <div className="text-lg font-bold font-mono text-[#238A5E] tabular-nums">
              {summary.earnedCredits} / {summary.totalRequiredCredits}
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5]">
            <div className="text-[11px] text-[#858BA3] font-medium">Tổng học phần</div>
            <div className="text-lg font-bold font-mono text-[#20243A] tabular-nums">
              {summary.totalCoursesCount}
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#8174F7]" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label="Lọc lịch sử theo năm học"
              className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A] focus:outline-none focus:border-[#8174F7]"
            >
              <option value="ALL">Tất cả năm học</option>
              {academicTerms.years.map((y) => (
                <option key={y.year_id} value={y.year_code}>
                  {y.year_name}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-[#555C75] cursor-pointer select-none px-3 py-2 rounded-xl bg-[#F8F9FD] border border-[#ECEEF5]">
            <input
              type="checkbox"
              checked={showEmptyTerms}
              onChange={(e) => setShowEmptyTerms(e.target.checked)}
              className="accent-[#8174F7] rounded"
            />
            <span>Hiển thị cả học kỳ chưa có học phần</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl transition-colors"
          >
            Mở rộng tất cả
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-medium text-[#555C75] bg-[#F8F9FD] hover:bg-[#ECEEF5] rounded-xl transition-colors"
          >
            Thu gọn tất cả
          </button>
        </div>
      </div>

      {/* Chronological Academic Years */}
      {visibleYears.length === 0 ? (
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-12 text-center">
          <Layers className="w-10 h-10 text-[#8174F7] mx-auto mb-3" />
          <div className="text-base font-bold text-[#20243A]">Chưa có dữ liệu lịch sử học tập</div>
          <p className="text-sm text-[#858BA3] mt-1">
            Bật tùy chọn &ldquo;Hiển thị cả học kỳ chưa có học phần&rdquo; để thêm học phần vào năm học bất kỳ.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleYears.map((yearGroup) => (
            <section
              key={yearGroup.yearCode}
              className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden"
            >
              <div className="px-6 py-4 bg-[#F8F9FD] border-b border-[#ECEEF5] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8174F7]" />
                  <h3 className="text-base font-bold text-[#20243A]">{yearGroup.yearName}</h3>
                  <span className="text-xs font-mono text-[#858BA3]">({yearGroup.yearCode})</span>
                </div>
                <span className="text-xs font-medium text-[#6558E8] bg-[#F0EDFF] px-3 py-1 rounded-full">
                  {yearGroup.terms.filter((t) => t.data !== null).length} học kỳ có dữ liệu
                </span>
              </div>

              <div className="divide-y divide-[#ECEEF5]">
                {yearGroup.terms.map(({ key, semester, data }) => {
                  const isExpanded = Boolean(expandedKeys[key]);

                  if (!data) {
                    return (
                      <div
                        key={key}
                        className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-[#B5BAC9]" />
                          <div>
                            <div className="text-sm font-semibold text-[#555C75]">{semester}</div>
                            <div className="text-xs text-[#858BA3]">Chưa đăng ký học phần trong kỳ này</div>
                          </div>
                        </div>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => openQuickAdd(yearGroup.yearCode, semester)}
                            className="px-3 py-1.5 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm học phần</span>
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={key} className="bg-white">
                      {/* Semester Header Row */}
                      <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-[#F8F9FD]/60 transition-colors">
                        <button
                          type="button"
                          onClick={() => toggleExpand(key)}
                          className="flex items-center gap-3 text-left min-w-0 flex-1"
                        >
                          <span className="w-7 h-7 rounded-lg bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-[#20243A]">{semester}</span>
                              <span className="text-xs font-mono text-[#858BA3]">
                                · {data.courseCount} học phần
                              </span>
                              {data.failedCoursesCount > 0 && (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EF6472]/12 text-[#C83D4C]">
                                  {data.failedCoursesCount} chưa đạt
                                </span>
                              )}
                              {data.inProgressCoursesCount > 0 && (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F0EDFF] text-[#6558E8]">
                                  {data.inProgressCoursesCount} đang học
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#858BA3] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                              <span>
                                Đã hoàn thành: <strong className="text-[#20243A]">{data.completedCoursesCount}</strong>
                              </span>
                              <span>
                                Đạt: <strong className="text-[#238A5E]">{data.passedCoursesCount}</strong>
                              </span>
                              <span>
                                Tín chỉ đạt: <strong className="font-mono text-[#20243A]">{data.earnedCredits}</strong>
                              </span>
                              <span>
                                Tín chỉ tính GPA: <strong className="font-mono text-[#20243A]">{data.semesterGpaCredits}</strong>
                              </span>
                            </div>
                          </div>
                        </button>

                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                          <div className="px-3.5 py-2 rounded-xl bg-[#F8F9FD] border border-[#ECEEF5] text-center min-w-[96px]">
                            <div className="text-[10px] font-medium text-[#858BA3]">GPA học kỳ</div>
                            <div className="text-base font-bold font-mono text-[#6558E8] tabular-nums">
                              {formatGpa(data.semesterGpa)}
                            </div>
                          </div>
                          <div className="px-3.5 py-2 rounded-xl bg-[#F0EDFF]/60 border border-[#8174F7]/20 text-center min-w-[104px]">
                            <div className="text-[10px] font-medium text-[#6558E8]">GPA tích lũy</div>
                            <div className="text-base font-bold font-mono text-[#20243A] tabular-nums">
                              {formatGpa(data.cumulativeGpa)}
                            </div>
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => openQuickAdd(yearGroup.yearCode, semester)}
                              className="px-3 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl inline-flex items-center gap-1 transition-colors"
                              title="Thêm học phần vào kỳ này"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Thêm môn</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Courses Table */}
                      {isExpanded && (
                        <div className="px-6 pb-5 pt-1">
                          <div className="overflow-x-auto border border-[#ECEEF5] rounded-2xl">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                                  <th className="py-2.5 px-4">Mã HP</th>
                                  <th className="py-2.5 px-4">Tên học phần</th>
                                  <th className="py-2.5 px-4 text-center">Tín chỉ</th>
                                  <th className="py-2.5 px-4 text-center">Hệ 10</th>
                                  <th className="py-2.5 px-4 text-center">Điểm chữ</th>
                                  <th className="py-2.5 px-4 text-center">Hệ 4</th>
                                  <th className="py-2.5 px-4">Trạng thái</th>
                                  <th className="py-2.5 px-4">Ghi chú tính GPA</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#ECEEF5]">
                                {data.courses.map((c) => {
                                  const rawEnrollment = overview.enrollments.find(
                                    (e) => e.enrollment_id === c.enrollment_id
                                  );
                                  const isRetake = Boolean(rawEnrollment?.is_repeated);
                                  return (
                                    <tr key={c.enrollment_id} className="hover:bg-[#F8F9FD]/60">
                                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#6558E8] whitespace-nowrap">
                                        {c.course_code}
                                      </td>
                                      <td className="py-3 px-4 font-medium text-[#20243A]">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span>{c.course_name}</span>
                                          {isRetake && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-[#F0EDFF] text-[#6558E8]">
                                              <RotateCcw className="w-3 h-3" />
                                              <span>Học lại / cải thiện</span>
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 text-center font-mono tabular-nums">
                                        {c.credit_hours}
                                      </td>
                                      <td className="py-3 px-4 text-center font-mono text-[#555C75] tabular-nums">
                                        {formatTenScale(c.numeric_grade)}
                                      </td>
                                      <td className="py-3 px-4 text-center font-mono font-bold text-[#20243A]">
                                        {c.letter_grade ?? '—'}
                                      </td>
                                      <td className="py-3 px-4 text-center font-mono text-[#6558E8] tabular-nums">
                                        {c.grade_point !== null ? c.grade_point.toFixed(1) : '—'}
                                      </td>
                                      <td className="py-3 px-4">
                                        <SemanticStatusBadge
                                          tone={statusTone(c.completion_status)}
                                          label={translateCompletionStatus(c.completion_status)}
                                        />
                                      </td>
                                      <td className="py-3 px-4 text-xs text-[#858BA3]">
                                        {c.included_in_gpa ? (
                                          <span className="inline-flex items-center gap-1 text-[#238A5E] font-medium">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Tính vào CGPA</span>
                                          </span>
                                        ) : rawEnrollment?.is_official === 0 ? (
                                          <span>Chờ Phòng Đào tạo duyệt bảng điểm</span>
                                        ) : (
                                          <span>{c.exclusion_reason || 'Không tính vào CGPA'}</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Quick Add Enrollment Modal */}
      {addModalTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-[#ECEEF5] mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#20243A]">
                  Thêm học phần vào {addModalTerm.semester}
                </h3>
                <p className="text-xs text-[#858BA3] mt-0.5">
                  Năm học {addModalTerm.academicYear.replace('-', '–')} · Kết quả GPA và lịch sử học tập sẽ tự động cập nhật.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalTerm(null)}
                className="text-[#858BA3] hover:text-[#20243A] p-1"
                aria-label="Đóng hộp thoại"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/25 text-[#C83D4C] text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              {catalog.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#858BA3] mb-1.5">
                    Chọn nhanh từ danh mục học phần (tùy chọn)
                  </label>
                  <select
                    value=""
                    onChange={(e) => handleCatalogPick(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A]"
                  >
                    <option value="">-- Chọn học phần mẫu hoặc tự nhập --</option>
                    {catalog.map((c) => (
                      <option key={c.course_id} value={c.course_code}>
                        {c.course_code} — {c.course_name} ({c.credit_hours} TC)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">
                    Mã học phần *
                  </label>
                  <input
                    type="text"
                    required
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="VD: INT304"
                    className="w-full px-3 py-2 text-sm font-mono uppercase border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">
                    Số tín chỉ (số nguyên) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={creditHours}
                    onKeyDown={(e) => {
                      if (['.', ',', '-', '+', 'e', 'E'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => setCreditHours(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#20243A] mb-1">
                  Tên học phần *
                </label>
                <input
                  type="text"
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="VD: Trí tuệ nhân tạo ứng dụng"
                  className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={completionStatus}
                    onChange={(e) => {
                      const next = e.target.value as CompletionStatus;
                      setCompletionStatus(next);
                      if (next === 'Failed') setLetterGrade('F');
                      else if (next === 'Completed' && letterGrade === 'F') setLetterGrade('C');
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
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Điểm chữ</label>
                  <select
                    disabled={completionStatus === 'In Progress' || completionStatus === 'Withdrawn'}
                    value={letterGrade}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLetterGrade(val);
                      const match = resolveGradeFromScale(val, settings.gradingScale);
                      if (match && !match.passing) setCompletionStatus('Failed');
                    }}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl bg-white disabled:bg-[#F8F9FD]"
                  >
                    {settings.gradingScale.map((g) => (
                      <option key={g.letter} value={g.letter}>
                        {g.letter} ({g.point.toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">
                    Điểm hệ 10 (0–10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    disabled={completionStatus === 'In Progress' || completionStatus === 'Withdrawn'}
                    value={numericGrade}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNumericGrade(val);
                      const num = Number(val);
                      if (val !== '' && Number.isFinite(num) && num >= 0 && num <= 10) {
                        const resolved = resolveLetterFromNumeric(num, settings.gradingScale);
                        if (resolved) {
                          setLetterGrade(resolved.letter);
                          setCompletionStatus(resolved.passing ? 'Completed' : 'Failed');
                        }
                      }
                    }}
                    placeholder="VD: 8.5"
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl disabled:bg-[#F8F9FD]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#ECEEF5]">
                <button
                  type="button"
                  onClick={() => setAddModalTerm(null)}
                  className="px-4 py-2 text-sm font-medium border border-[#ECEEF5] rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl"
                >
                  {saving ? 'Đang lưu...' : 'Lưu học phần'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Info, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  formatGpa,
  formatTenScale,
  getClassificationForGpa,
  roundGpa,
  validateCourseCredit,
} from '../../shared/academicLogic.ts';
import { StudentOverviewResponse } from '../services/api.ts';
import { SemanticStatusBadge, SemanticTone } from '../components/PortalUI.tsx';

interface SandboxRow {
  id: string;
  name: string;
  credits: number;
  gradePoint: number;
}

const DEFAULT_SANDBOX_ROWS: SandboxRow[] = [
  { id: '1', name: 'Học phần A', credits: 3, gradePoint: 4.0 },
  { id: '2', name: 'Học phần B', credits: 3, gradePoint: 3.0 },
  { id: '3', name: 'Học phần C', credits: 2, gradePoint: 3.5 },
];

function classificationTone(color: string): SemanticTone {
  if (color === 'emerald') return 'success';
  if (color === 'blue' || color === 'sky') return 'info';
  if (color === 'amber' || color === 'orange') return 'warning';
  return 'danger';
}

function repeatPolicyLabel(policy: string): string {
  if (policy === 'replace_highest') return 'Lấy điểm cao nhất';
  if (policy === 'replace_latest') return 'Lấy điểm lần học gần nhất';
  return 'Tính tất cả các lần học';
}

export function GpaCalculatorPage({ overview }: { overview: StudentOverviewResponse }) {
  const { summary, settings } = overview;
  const [mode, setMode] = useState<'official' | 'sandbox'>('official');
  const [selectedSemKey, setSelectedSemKey] = useState<string>(
    summary.semesters[summary.semesters.length - 1]?.semesterKey ?? ''
  );

  // Interactive What-If Calculator state
  const [sandboxRows, setSandboxRows] = useState<SandboxRow[]>(DEFAULT_SANDBOX_ROWS);
  const [sandboxCalculatedTick, setSandboxCalculatedTick] = useState(0);

  const selectedSemester = useMemo(
    () =>
      summary.semesters.find((s) => s.semesterKey === selectedSemKey) ??
      summary.semesters[summary.semesters.length - 1] ??
      null,
    [summary.semesters, selectedSemKey]
  );

  const sandboxValidationError = useMemo(() => {
    for (const row of sandboxRows) {
      const check = validateCourseCredit(row.credits);
      if (!check.valid) {
        return `"${row.name || 'Học phần'}": ${check.error}`;
      }
    }
    return null;
  }, [sandboxRows]);

  const sandboxResult = useMemo(() => {
    let totalCredits = 0;
    let totalWeighted = 0;
    for (const row of sandboxRows) {
      if (Number.isInteger(row.credits) && row.credits >= 1 && row.gradePoint >= 0) {
        totalCredits += row.credits;
        totalWeighted += row.credits * row.gradePoint;
      }
    }
    const gpa = totalCredits > 0 ? roundGpa(totalWeighted / totalCredits) : null;
    const classification = getClassificationForGpa(gpa, settings.classificationBands);
    return {
      totalCredits,
      totalWeighted: roundGpa(totalWeighted),
      gpa,
      classification,
    };
  }, [sandboxRows, settings.classificationBands, sandboxCalculatedTick]);

  const addSandboxRow = () => {
    setSandboxRows((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: `Học phần ${prev.length + 1}`,
        credits: 3,
        gradePoint: 3.0,
      },
    ]);
  };

  const loadSemesterIntoSandbox = () => {
    if (!selectedSemester) return;
    const rows: SandboxRow[] = selectedSemester.courses.map((c, idx) => ({
      id: `${c.enrollment_id}-${idx}`,
      name: `${c.course_code} — ${c.course_name}`,
      credits: c.credit_hours,
      gradePoint: c.grade_point ?? 3.0,
    }));
    if (rows.length > 0) {
      setSandboxRows(rows);
      setMode('sandbox');
    }
  };

  const updateSandboxRow = (id: string, patch: Partial<SandboxRow>) => {
    setSandboxRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeSandboxRow = (id: string) => {
    setSandboxRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Right column active GPA ring calculation
  const activeDisplayGpa =
    mode === 'official'
      ? selectedSemester?.semesterGpa ?? summary.cgpa
      : sandboxResult.gpa;
  const activeDisplayCredits =
    mode === 'official'
      ? selectedSemester?.semesterGpaCredits ?? summary.gpaEligibleCredits
      : sandboxResult.totalCredits;
  const activeClassification = getClassificationForGpa(
    activeDisplayGpa,
    settings.classificationBands
  );

  const ringRadius = 62;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringRatio = activeDisplayGpa !== null ? Math.min(1, Math.max(0, activeDisplayGpa / 4.0)) : 0;
  const ringOffset = ringCircumference - ringRatio * ringCircumference;

  return (
    <div className="space-y-6">
      {/* Mode Switcher & Active Policy */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#ECEEF5] rounded-2xl">
          <button
            type="button"
            onClick={() => setMode('official')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              mode === 'official'
                ? 'bg-[#8174F7] text-white'
                : 'text-[#555C75] hover:text-[#20243A]'
            }`}
          >
            Bảng điểm chính thức
          </button>
          <button
            type="button"
            onClick={() => setMode('sandbox')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              mode === 'sandbox'
                ? 'bg-[#8174F7] text-white'
                : 'text-[#555C75] hover:text-[#20243A]'
            }`}
          >
            Tính thử GPA tự chọn
          </button>
        </div>

        <div className="text-xs text-[#858BA3] bg-white border border-[#ECEEF5] rounded-xl px-3.5 py-2">
          Quy chế học lại:{' '}
          <span className="font-semibold text-[#20243A]">
            {repeatPolicyLabel(settings.gpaPolicy.repeatPolicy)}
          </span>{' '}
          · Điểm F:{' '}
          <span className="font-semibold text-[#20243A]">
            {settings.gpaPolicy.failedCourseInGpa ? 'Tính vào GPA' : 'Loại trừ'}
          </span>
        </div>
      </div>

      {/* 2-Column Main Calculator Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Course Rows / Term Selection */}
        <div className="lg:col-span-7 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-5">
          {mode === 'official' ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#ECEEF5]">
                <div>
                  <h2 className="text-base font-bold text-[#20243A]">
                    Chọn học kỳ để tính chi tiết
                  </h2>
                  <p className="text-xs text-[#858BA3] mt-0.5">
                    Xem chi tiết điểm từng học kỳ hoặc chuyển sang chế độ tính thử
                  </p>
                </div>

                <select
                  value={selectedSemester?.semesterKey ?? ''}
                  onChange={(e) => setSelectedSemKey(e.target.value)}
                  aria-label="Chọn học kỳ"
                  className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A] focus:outline-none focus:border-[#8174F7]"
                >
                  {summary.semesters.map((s) => (
                    <option key={s.semesterKey} value={s.semesterKey}>
                      {s.semester} ({s.academic_year})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSemester ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                          <th className="py-2.5 px-3">Học phần</th>
                          <th className="py-2.5 px-3 text-right">Tín chỉ</th>
                          <th className="py-2.5 px-3 text-right">Hệ 10</th>
                          <th className="py-2.5 px-3 text-center">Điểm chữ</th>
                          <th className="py-2.5 px-3 text-right">Hệ 4</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEEF5] text-sm">
                        {selectedSemester.courses.map((c) => (
                          <tr key={c.enrollment_id} className="hover:bg-[#F8F9FD]/60">
                            <td className="py-3 px-3">
                              <div className="font-mono text-xs font-semibold text-[#6558E8]">
                                {c.course_code}
                              </div>
                              <div className="text-[#20243A] font-medium">{c.course_name}</div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              {c.credit_hours}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-[#555C75]">
                              {formatTenScale(c.numeric_grade)}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-semibold">
                              {c.letter_grade ?? '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              {c.grade_point !== null ? c.grade_point.toFixed(1) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#ECEEF5]">
                    <div className="text-xs text-[#858BA3]">
                      GPA tích lũy tính đến hết kỳ này:{' '}
                      <span className="font-mono font-bold text-[#20243A]">
                        {formatGpa(selectedSemester.cumulativeGpa)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={loadSemesterIntoSandbox}
                      className="px-3.5 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl transition-colors inline-flex items-center gap-1.5"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Thử chỉnh điểm kỳ này</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-[#858BA3]">
                  Chưa có dữ liệu học kỳ nào.
                </div>
              )}
            </>
          ) : (
            /* Sandbox Editable Rows */
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#ECEEF5]">
                <div>
                  <h2 className="text-base font-bold text-[#20243A]">
                    Bảng tính thử GPA theo môn học
                  </h2>
                  <p className="text-xs text-[#858BA3] mt-0.5">
                    Nhập tên môn, số tín chỉ và điểm dự kiến. Không làm thay đổi bảng điểm chính thức.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSandboxRow}
                  className="px-3.5 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm môn học</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {sandboxRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-12 gap-2.5 items-center bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl p-2.5"
                  >
                    <div className="col-span-12 sm:col-span-5">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateSandboxRow(row.id, { name: e.target.value })}
                        placeholder="Tên học phần"
                        className="w-full px-3 py-1.5 text-sm bg-white border border-[#ECEEF5] rounded-lg focus:outline-none focus:border-[#8174F7]"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row.credits}
                        onKeyDown={(e) => {
                          if (['.', ',', '-', '+', 'e', 'E'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) =>
                          updateSandboxRow(row.id, {
                            credits: Number(e.target.value),
                          })
                        }
                        aria-label="Số tín chỉ (nguyên dương)"
                        className="w-full px-2.5 py-1.5 text-sm font-mono bg-white border border-[#ECEEF5] rounded-lg text-center"
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-4">
                      <select
                        value={row.gradePoint}
                        onChange={(e) =>
                          updateSandboxRow(row.id, { gradePoint: Number(e.target.value) })
                        }
                        aria-label="Điểm chữ"
                        className="w-full px-2.5 py-1.5 text-sm font-mono bg-white border border-[#ECEEF5] rounded-lg"
                      >
                        {settings.gradingScale.map((g) => (
                          <option key={g.letter} value={g.point}>
                            {g.letter} ({g.point.toFixed(1)} · {g.minNumeric}–{g.maxNumeric})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeSandboxRow(row.id)}
                        className="p-1.5 text-[#858BA3] hover:text-[#C83D4C] rounded-lg"
                        aria-label={`Xóa ${row.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {sandboxValidationError && (
                  <p role="alert" className="text-xs font-medium text-[#C83D4C] px-1">
                    {sandboxValidationError}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#ECEEF5]">
                <button
                  type="button"
                  onClick={() => setSandboxRows(DEFAULT_SANDBOX_ROWS)}
                  className="px-4 py-2 text-sm font-medium text-[#20243A] bg-white border border-[#ECEEF5] hover:bg-[#F8F9FD] rounded-xl inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Làm mới</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSandboxCalculatedTick((t) => t + 1)}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl inline-flex items-center gap-2 transition-colors"
                >
                  <Calculator className="w-4 h-4" />
                  <span>Tính GPA</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Large Circular GPA Ring & Breakdown */}
        <div className="lg:col-span-5 bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col justify-between space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#20243A]">
                {mode === 'official'
                  ? selectedSemester
                    ? `Kết quả ${selectedSemester.semester}`
                    : 'Kết quả GPA tích lũy'
                  : 'Kết quả tính thử GPA'}
              </h2>
              <p className="text-xs text-[#858BA3] mt-0.5">
                {mode === 'official' && selectedSemester
                  ? `Năm học ${selectedSemester.academic_year}`
                  : 'Tính theo số tín chỉ trên thang điểm 4.00'}
              </p>
            </div>
            <SemanticStatusBadge
              tone={classificationTone(activeClassification.color)}
              label={activeClassification.label}
            />
          </div>

          {/* Circular GPA Ring */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-44 h-44 -rotate-90" viewBox="0 0 150 150">
                <circle
                  cx="75"
                  cy="75"
                  r={ringRadius}
                  fill="none"
                  stroke="#F0EDFF"
                  strokeWidth="12"
                />
                <circle
                  cx="75"
                  cy="75"
                  r={ringRadius}
                  fill="none"
                  stroke="#8174F7"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold font-mono tabular-nums text-[#20243A]">
                  {formatGpa(activeDisplayGpa)}
                </span>
                <span className="text-xs font-mono text-[#858BA3] mt-0.5">/ 4.00</span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#ECEEF5]">
                <div className="text-xs text-[#858BA3]">Tổng tín chỉ tính GPA</div>
                <div className="font-mono font-bold text-lg text-[#20243A] mt-0.5 tabular-nums">
                  {activeDisplayCredits}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#ECEEF5]">
                <div className="text-xs text-[#858BA3]">Xếp loại học lực</div>
                <div className="font-semibold text-base text-[#6558E8] mt-1">
                  {activeClassification.label}
                </div>
              </div>
            </div>

            {mode === 'official' && (
              <div className="pt-2 border-t border-[#ECEEF5] flex items-center justify-between text-xs">
                <span className="text-[#858BA3]">GPA tích lũy toàn khóa (CGPA)</span>
                <span className="font-mono font-bold text-sm text-[#20243A] tabular-nums">
                  {formatGpa(summary.cgpa)} ({summary.classification.label})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Complete Transcript GPA Inclusion Audit Table */}
      {mode === 'official' && (
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#ECEEF5] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#20243A]">
                Chi tiết quy đổi toàn bộ bảng điểm
              </h2>
              <p className="text-xs text-[#858BA3] mt-0.5">
                Hiển thị chính xác từng học phần được tính vào GPA hoặc lý do loại trừ theo quy chế
              </p>
            </div>
            <div className="text-xs font-mono text-[#6558E8] font-semibold tabular-nums">
              GPA tích lũy: {formatGpa(summary.cgpa)} ({summary.gpaEligibleCredits} tín chỉ tính GPA)
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                  <th className="py-3 px-5">Kỳ học</th>
                  <th className="py-3 px-5">Học phần</th>
                  <th className="py-3 px-5 text-right">Tín chỉ</th>
                  <th className="py-3 px-5 text-right">Hệ 10</th>
                  <th className="py-3 px-5 text-center">Điểm chữ</th>
                  <th className="py-3 px-5 text-right">Hệ 4</th>
                  <th className="py-3 px-5">Trạng thái tính GPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5] text-sm">
                {summary.breakdown.map((row) => (
                  <tr
                    key={row.enrollment_id}
                    className={
                      row.included_in_gpa ? 'hover:bg-[#F8F9FD]/70' : 'bg-[#F8F9FD]/50 text-[#858BA3]'
                    }
                  >
                    <td className="py-3 px-5 text-xs whitespace-nowrap">
                      {row.semester} · {row.academic_year}
                    </td>
                    <td className="py-3 px-5">
                      <span className="font-mono font-semibold text-[#6558E8] mr-2">
                        {row.course_code}
                      </span>
                      <span className="text-[#20243A] font-medium">{row.course_name}</span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums">
                      {row.credit_hours}
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-[#555C75]">
                      {formatTenScale(row.numeric_grade)}
                    </td>
                    <td className="py-3 px-5 text-center font-mono font-semibold">
                      {row.letter_grade ?? '—'}
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums">
                      {row.grade_point !== null ? row.grade_point.toFixed(1) : '—'}
                    </td>
                    <td className="py-3 px-5 text-xs">
                      {row.included_in_gpa ? (
                        <span className="inline-flex items-center gap-1.5 text-[#238A5E] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tính vào GPA</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[#858BA3]">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          <span>{row.exclusion_reason}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

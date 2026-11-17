import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Lock,
  Save,
  Search,
  Send,
} from 'lucide-react';
import {
  computeWeightedNumericGrade,
  resolveLetterFromNumeric,
  translateCompletionStatus,
  translateGradeWorkflowStatus,
} from '../../shared/academicLogic.ts';
import { api, LecturerOverviewResponse, SectionDetailResponse } from '../services/api.ts';
import { ConfirmModal, PageLoadingSkeleton, SemanticStatusBadge, SemanticTone } from '../components/PortalUI.tsx';

interface DraftGradeRow {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  attendance_status: string;
  attendance_score: string;
  assignment_score: string;
  midterm_score: string;
  final_score: string;
}

function gradeStatusTone(status: string): SemanticTone {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'PENDING_APPROVAL':
      return 'info';
    case 'NEEDS_REVISION':
      return 'danger';
    case 'IN_PROGRESS':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function LecturerClassWorkspacePage({
  overview,
  selectedSectionId,
  onSelectSection,
  onReloadOverview,
  onToast,
}: {
  overview: LecturerOverviewResponse;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  onReloadOverview: () => Promise<void>;
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const activeSectionId = selectedSectionId || overview.sections[0]?.section_id || '';
  const [detail, setDetail] = useState<SectionDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DraftGradeRow[]>([]);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNGRADED' | 'PASSED' | 'FAILED'>('ALL');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitNote, setSubmitNote] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSection = async (secId: string) => {
    if (!secId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLecturerSectionDetail(secId);
      setDetail(res);
      setRows(
        res.enrollments.map((e) => ({
          enrollment_id: e.enrollment_id,
          student_id: e.student_id,
          student_name: e.student_name ?? e.student_id,
          attendance_status: e.attendance_status ?? 'Đủ điều kiện',
          attendance_score:
            e.attendance_score !== null && e.attendance_score !== undefined
              ? String(e.attendance_score)
              : '',
          assignment_score:
            e.assignment_score !== null && e.assignment_score !== undefined
              ? String(e.assignment_score)
              : '',
          midterm_score:
            e.midterm_score !== null && e.midterm_score !== undefined
              ? String(e.midterm_score)
              : '',
          final_score:
            e.final_score !== null && e.final_score !== undefined ? String(e.final_score) : '',
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải bảng điểm lớp học phần.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSectionId) {
      void loadSection(activeSectionId);
    }
  }, [activeSectionId]);

  const weights = detail?.settings.assessmentWeights ?? overview.settings.assessmentWeights;
  const gradingScale = detail?.settings.gradingScale ?? overview.settings.gradingScale;
  const isLocked =
    detail?.section.grade_status === 'PENDING_APPROVAL' ||
    detail?.section.grade_status === 'APPROVED';

  const computedRows = useMemo(() => {
    return rows.map((row) => {
      const att = row.attendance_score.trim() === '' ? null : Number(row.attendance_score);
      const asg = row.assignment_score.trim() === '' ? null : Number(row.assignment_score);
      const mid = row.midterm_score.trim() === '' ? null : Number(row.midterm_score);
      const fin = row.final_score.trim() === '' ? null : Number(row.final_score);

      const invalid = [att, asg, mid, fin].some(
        (v) => v !== null && (!Number.isFinite(v) || v < 0 || v > 10)
      );

      const numeric = invalid
        ? null
        : computeWeightedNumericGrade(
            {
              attendance_score: att,
              assignment_score: asg,
              midterm_score: mid,
              final_score: fin,
            },
            weights
          );
      const matched = numeric !== null ? resolveLetterFromNumeric(numeric, gradingScale) : null;
      const status = matched ? (matched.passing ? 'Completed' : 'Failed') : 'In Progress';

      return {
        row,
        att,
        asg,
        mid,
        fin,
        invalid,
        numeric,
        letter: matched?.letter ?? null,
        point: matched?.point ?? null,
        status: status as 'Completed' | 'Failed' | 'In Progress',
      };
    });
  }, [rows, weights, gradingScale]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return computedRows.filter((item) => {
      if (filterMode === 'UNGRADED' && item.numeric !== null) return false;
      if (filterMode === 'PASSED' && item.status !== 'Completed') return false;
      if (filterMode === 'FAILED' && item.status !== 'Failed') return false;
      if (
        q &&
        !item.row.student_id.toLowerCase().includes(q) &&
        !item.row.student_name.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [computedRows, search, filterMode]);

  const updateRowField = (
    enrollmentId: string,
    field: keyof Omit<DraftGradeRow, 'enrollment_id' | 'student_id' | 'student_name'>,
    value: string
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.enrollment_id === enrollmentId ? { ...r, [field]: value } : r))
    );
  };

  const buildPayload = () => {
    return computedRows.map((c) => ({
      enrollment_id: c.row.enrollment_id,
      attendance_status: c.row.attendance_status,
      attendance_score: c.att,
      assignment_score: c.asg,
      midterm_score: c.mid,
      final_score: c.fin,
    }));
  };

  const handleSaveDraft = async () => {
    if (!detail) return;
    if (computedRows.some((c) => c.invalid)) {
      setError('Điểm thành phần (thang 10) phải nằm trong khoảng từ 0 đến 10.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await api.saveSectionGrades(detail.section.section_id, buildPayload());
      setDetail(updated);
      await onReloadOverview();
      onToast('Đã lưu bản nháp bảng điểm thành công.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu bản nháp bảng điểm.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!detail) return;
    if (computedRows.some((c) => c.invalid)) {
      setError('Vui lòng sửa các điểm vượt ngoài phạm vi 0–10 trước khi gửi duyệt.');
      setSubmitModalOpen(false);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Save any pending draft edits first before submitting
      await api.saveSectionGrades(detail.section.section_id, buildPayload());
      const res = await api.submitSectionGrades(detail.section.section_id, submitNote.trim());
      setDetail(res.detail);
      setSubmitModalOpen(false);
      setSubmitNote('');
      await onReloadOverview();
      onToast('Đã gửi bảng điểm lên Phòng Đào tạo để phê duyệt.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi duyệt bảng điểm.');
      setSubmitModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    if (!detail) return;
    const headers = [
      'MSSV',
      'Họ và tên',
      'Trạng thái chuyên cần',
      'Chuyên cần',
      'Bài tập',
      'Giữa kỳ',
      'Cuối kỳ',
      'Tổng kết (Hệ 10)',
      'Điểm chữ',
      'Hệ 4',
      'Kết quả',
    ];
    const lines = [
      headers.join(','),
      ...computedRows.map((c) =>
        [
          c.row.student_id,
          `"${c.row.student_name.replace(/"/g, '""')}"`,
          `"${c.row.attendance_status}"`,
          c.att ?? '',
          c.asg ?? '',
          c.mid ?? '',
          c.fin ?? '',
          c.numeric ?? '',
          c.letter ?? '',
          c.point ?? '',
          `"${translateCompletionStatus(c.status)}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BangDiem_${detail.section.section_code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (overview.sections.length === 0) {
    return (
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-12 text-center text-sm text-[#858BA3]">
        Hiện chưa có lớp học phần nào được phân công cho Thầy/Cô.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bộ chọn lớp học phần */}
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="lec-sec-select" className="text-xs font-semibold text-[#858BA3]">
            Lớp học phần:
          </label>
          <select
            id="lec-sec-select"
            value={activeSectionId}
            onChange={(e) => onSelectSection(e.target.value)}
            className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A] min-w-[280px] focus:outline-none focus:border-[#8174F7]"
          >
            {overview.sections.map((s) => (
              <option key={s.section_id} value={s.section_id}>
                {s.section_code} — {s.course_name} ({s.semester} · {s.academic_year})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!detail}
          className="px-3.5 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl inline-flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Xuất CSV</span>
        </button>
      </div>

      {loading || !detail ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          {/* Thông tin lớp học phần + Trọng số */}
          <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <div className="text-xs font-mono font-semibold text-[#6558E8]">
                  {detail.section.section_code} · {detail.section.course_code} · {detail.section.credit_hours} tín chỉ
                </div>
                <h2 className="text-lg font-bold text-[#20243A] mt-0.5">
                  {detail.section.course_name}
                </h2>
                <p className="text-xs text-[#858BA3] mt-1">
                  {detail.section.semester} · {detail.section.academic_year} · Giảng viên:{' '}
                  {detail.section.lecturer_name} · Lịch học: {detail.section.schedule_info} · Sĩ số:{' '}
                  {detail.section.enrolled_count} SV · Hạn nộp: {detail.section.submission_deadline}
                </p>
              </div>
              <SemanticStatusBadge
                tone={gradeStatusTone(detail.section.grade_status)}
                label={translateGradeWorkflowStatus(detail.section.grade_status)}
              />
            </div>

            <div className="px-4 py-3 rounded-xl bg-[#F8F9FD] border border-[#ECEEF5] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#20243A]">
                Trọng số điểm do Phòng Đào tạo cấu hình:
              </span>
              <span className="font-mono text-[#6558E8] tabular-nums">
                Chuyên cần {Math.round(weights.attendanceWeight * 100)}% · Bài tập{' '}
                {Math.round(weights.assignmentWeight * 100)}% · Giữa kỳ{' '}
                {Math.round(weights.midtermWeight * 100)}% · Cuối kỳ{' '}
                {Math.round(weights.finalWeight * 100)}%
              </span>
            </div>

            {detail.section.grade_status === 'NEEDS_REVISION' && (
              <div className="p-4 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-xs text-[#C83D4C] flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Bảng điểm được trả lại để chỉnh sửa</div>
                  <p className="mt-0.5">
                    Lý do từ Phòng Đào tạo:{' '}
                    {detail.section.latest_review_reason ||
                      detail.approvals[0]?.reason ||
                      'Vui lòng kiểm tra lại điểm thành phần và gửi duyệt lại.'}
                  </p>
                </div>
              </div>
            )}

            {isLocked && (
              <div className="p-3.5 rounded-xl bg-[#F0EDFF] border border-[#8174F7]/25 text-xs text-[#6558E8] flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  {detail.section.grade_status === 'APPROVED'
                    ? 'Bảng điểm đã được Phòng Đào tạo phê duyệt chính thức và công bố cho sinh viên. Chỉ Phòng Đào tạo mới có quyền mở khóa chỉnh sửa.'
                    : 'Bảng điểm đang chờ Phòng Đào tạo phê duyệt nên tạm khóa chỉnh sửa.'}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bộ lọc & Thanh thao tác */}
          <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 text-[#858BA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm MSSV hoặc họ tên..."
                  className="w-full pl-10 pr-3 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
                />
              </div>

              <select
                value={filterMode}
                onChange={(e) =>
                  setFilterMode(e.target.value as 'ALL' | 'UNGRADED' | 'PASSED' | 'FAILED')
                }
                aria-label="Lọc trạng thái điểm"
                className="px-3 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A]"
              >
                <option value="ALL">Tất cả sinh viên ({computedRows.length})</option>
                <option value="UNGRADED">Chưa nhập đủ điểm</option>
                <option value="PASSED">Đạt</option>
                <option value="FAILED">Chưa đạt</option>
              </select>
            </div>

            {!isLocked && (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveDraft()}
                  className="px-4 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] disabled:opacity-60 rounded-xl inline-flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Đang lưu...' : 'Lưu bản nháp'}</span>
                </button>
                <button
                  type="button"
                  disabled={submitting || computedRows.length === 0}
                  onClick={() => setSubmitModalOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] disabled:opacity-60 rounded-xl inline-flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi bảng điểm duyệt</span>
                </button>
              </div>
            )}
          </div>

          {/* Bảng nhập điểm sinh viên */}
          <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                    <th className="py-3 px-4">MSSV</th>
                    <th className="py-3 px-4">Họ và tên</th>
                    <th className="py-3 px-4">Chuyên cần (TT)</th>
                    <th className="py-3 px-4 text-center">Chuyên cần (0–10)</th>
                    <th className="py-3 px-4 text-center">Bài tập (0–10)</th>
                    <th className="py-3 px-4 text-center">Giữa kỳ (0–10)</th>
                    <th className="py-3 px-4 text-center">Cuối kỳ (0–10)</th>
                    <th className="py-3 px-4 text-right">Tổng kết (Hệ 10)</th>
                    <th className="py-3 px-4 text-center">Điểm chữ · Hệ 4</th>
                    <th className="py-3 px-4">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEEF5]">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-sm text-[#858BA3]">
                        Không có sinh viên nào phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(({ row, invalid, numeric, letter, point, status }) => (
                      <tr key={row.enrollment_id} className="hover:bg-[#F8F9FD]/60">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-[#6558E8] whitespace-nowrap">
                          {row.student_id}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#20243A] whitespace-nowrap">
                          {row.student_name}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            disabled={isLocked}
                            value={row.attendance_status}
                            onChange={(e) =>
                              updateRowField(row.enrollment_id, 'attendance_status', e.target.value)
                            }
                            aria-label={`Trạng thái chuyên cần ${row.student_name}`}
                            className="px-2.5 py-1.5 text-xs bg-white border border-[#ECEEF5] rounded-lg disabled:bg-[#F8F9FD]"
                          >
                            <option value="Đủ điều kiện">Đủ điều kiện</option>
                            <option value="Cảnh báo vắng">Cảnh báo vắng</option>
                            <option value="Cấm thi">Cấm thi</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            disabled={isLocked}
                            value={row.attendance_score}
                            onChange={(e) =>
                              updateRowField(row.enrollment_id, 'attendance_score', e.target.value)
                            }
                            aria-label={`Điểm chuyên cần ${row.student_id}`}
                            className="w-16 px-2 py-1 text-center font-mono text-xs border border-[#ECEEF5] rounded-lg disabled:bg-[#F8F9FD]"
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            disabled={isLocked}
                            value={row.assignment_score}
                            onChange={(e) =>
                              updateRowField(row.enrollment_id, 'assignment_score', e.target.value)
                            }
                            aria-label={`Điểm bài tập ${row.student_id}`}
                            className="w-16 px-2 py-1 text-center font-mono text-xs border border-[#ECEEF5] rounded-lg disabled:bg-[#F8F9FD]"
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            disabled={isLocked}
                            value={row.midterm_score}
                            onChange={(e) =>
                              updateRowField(row.enrollment_id, 'midterm_score', e.target.value)
                            }
                            aria-label={`Điểm giữa kỳ ${row.student_id}`}
                            className="w-16 px-2 py-1 text-center font-mono text-xs border border-[#ECEEF5] rounded-lg disabled:bg-[#F8F9FD]"
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            disabled={isLocked}
                            value={row.final_score}
                            onChange={(e) =>
                              updateRowField(row.enrollment_id, 'final_score', e.target.value)
                            }
                            aria-label={`Điểm cuối kỳ ${row.student_id}`}
                            className="w-16 px-2 py-1 text-center font-mono text-xs border border-[#ECEEF5] rounded-lg disabled:bg-[#F8F9FD]"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                          {invalid ? (
                            <span className="text-xs text-[#C83D4C]">Lỗi (0–10)</span>
                          ) : numeric !== null ? (
                            <span>
                              {Number(numeric.toFixed(2)).toString()}{' '}
                              <span className="text-xs font-normal text-[#858BA3]">/ 10</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums text-[#20243A] whitespace-nowrap">
                          {letter && point !== null ? (
                            <span>
                              <span className="font-bold text-[#6558E8]">{letter}</span>{' '}
                              <span className="text-[#858BA3]">/ {point.toFixed(1)}</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <SemanticStatusBadge
                            tone={
                              status === 'Completed'
                                ? 'success'
                                : status === 'Failed'
                                  ? 'danger'
                                  : 'info'
                            }
                            label={translateCompletionStatus(status)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lịch sử chỉnh sửa điểm */}
          <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowLogs((v) => !v)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#F8F9FD]/70 transition-colors"
            >
              <div>
                <h3 className="text-sm font-bold text-[#20243A]">
                  Lịch sử chỉnh sửa điểm ({detail.changeLogs.length})
                </h3>
                <p className="text-xs text-[#858BA3]">
                  Theo dõi chi tiết các lần lưu điểm và phản hồi phê duyệt của lớp học phần này
                </p>
              </div>
              {showLogs ? (
                <ChevronUp className="w-4 h-4 text-[#858BA3]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#858BA3]" />
              )}
            </button>

            {showLogs && (
              <div className="border-t border-[#ECEEF5] divide-y divide-[#ECEEF5] px-6 py-2">
                {detail.changeLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#858BA3]">
                    Chưa có lịch sử chỉnh sửa điểm nào cho lớp học phần này.
                  </div>
                ) : (
                  detail.changeLogs.map((log) => (
                    <div key={log.log_id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-mono font-semibold text-[#6558E8]">
                          {log.student_id}
                        </span>{' '}
                        <span className="text-[#20243A]">
                          {log.previous_letter_grade ?? 'Chưa có'} →{' '}
                          <strong>{log.new_letter_grade ?? 'Chưa có'}</strong>
                        </span>{' '}
                        <span className="text-[#858BA3]">({log.reason})</span>
                      </div>
                      <div className="text-[#858BA3] font-mono">
                        {log.changed_by_name} · {new Date(log.changed_at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal xác nhận gửi duyệt bảng điểm */}
      {submitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#20243A]">Gửi bảng điểm để phê duyệt</h3>
                <p className="text-xs text-[#858BA3] mt-1">
                  Sau khi gửi, bảng điểm sẽ chuyển sang trạng thái Chờ duyệt và tạm khóa chỉnh sửa cho đến khi Phòng Đào tạo xử lý.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Ghi chú gửi Phòng Đào tạo (không bắt buộc)
              </label>
              <textarea
                rows={3}
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
                placeholder="VD: Đã hoàn tất chấm bài thi cuối kỳ và kiểm tra lại danh sách chuyên cần..."
                className="w-full px-3.5 py-2 text-sm border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="px-4 py-2 text-xs font-medium border border-[#ECEEF5] rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleConfirmSubmit()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl"
              >
                {submitting ? 'Đang gửi...' : 'Xác nhận gửi duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

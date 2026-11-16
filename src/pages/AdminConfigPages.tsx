import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, CheckCircle2, Plus, Power, Save, Trash2 } from 'lucide-react';
import {
  AssessmentWeightsConfig,
  ClassificationBand,
  formatGpa,
  GpaPolicySettings,
  GradeScaleEntry,
  RepeatPolicy,
  translateSeverity,
  translateWarningStatus,
  WarningThresholds,
} from '../../shared/academicLogic.ts';
import { AdminOverviewResponse, api, StudentOverviewResponse } from '../services/api.ts';
import { PageLoadingSkeleton, SemanticStatusBadge } from '../components/PortalUI.tsx';
import { AcademicReportsPage } from './AcademicReportsPage.tsx';

export function AdminGradeConfigView({
  data,
  onReload,
}: {
  data: AdminOverviewResponse;
  onReload: () => Promise<void>;
}) {
  const [scale, setScale] = useState<GradeScaleEntry[]>(data.settings.gradingScale);
  const [bands, setBands] = useState<ClassificationBand[]>(data.settings.classificationBands);
  const [policy, setPolicy] = useState<GpaPolicySettings>(data.settings.gpaPolicy);
  const [weights, setWeights] = useState<AssessmentWeightsConfig>(data.settings.assessmentWeights);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weightsTotalPct = Math.round(
    (weights.attendanceWeight +
      weights.assignmentWeight +
      weights.midtermWeight +
      weights.finalWeight) *
      100
  );

  const handleSaveAll = async () => {
    setError(null);
    setFeedback(null);
    if (Math.abs(weightsTotalPct - 100) > 1) {
      setError('Tổng trọng số điểm thành phần phải đúng bằng 100%.');
      return;
    }
    setSaving(true);
    try {
      await api.updateSetting('grading_scale', scale);
      await api.updateSetting('classification_bands', bands);
      await api.updateSetting('gpa_policy', policy);
      await api.updateSetting('assessment_weights', weights);
      await onReload();
      setFeedback(
        'Đã cập nhật thang điểm, ngưỡng xếp loại, trọng số điểm thành phần và quy chế học lại. Toàn bộ GPA và cảnh báo của sinh viên đã được tính lại tự động.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3.5 rounded-2xl bg-[#36B37E]/10 border border-[#36B37E]/30 text-[#238A5E] text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-2xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bảng cấu hình thang điểm 4.0 */}
        <div className="lg:col-span-7 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#20243A]">
                Cấu hình thang điểm hệ 4.0
              </h2>
              <p className="text-xs text-[#858BA3] mt-0.5">
                Điều chỉnh điểm chữ, điểm quy đổi hệ 4, ngưỡng phần trăm và trạng thái đạt
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setScale((prev) => [
                  ...prev,
                  { letter: 'MỚI', point: 0, minNumeric: 0, maxNumeric: 0, passing: false },
                ])
              }
              className="px-3.5 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm mức điểm</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                  <th className="py-2.5 px-3">Điểm chữ</th>
                  <th className="py-2.5 px-3">Hệ 4 (0–4)</th>
                  <th className="py-2.5 px-3">Tối thiểu (%)</th>
                  <th className="py-2.5 px-3">Đạt</th>
                  <th className="py-2.5 px-3 text-right">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5]">
                {scale.map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={row.letter}
                        onChange={(e) =>
                          setScale((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, letter: e.target.value } : x))
                          )
                        }
                        className="w-16 px-2.5 py-1 font-mono border border-[#ECEEF5] rounded-lg"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="4"
                        value={row.point}
                        onChange={(e) =>
                          setScale((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, point: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-20 px-2.5 py-1 font-mono border border-[#ECEEF5] rounded-lg"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={row.minNumeric}
                        onChange={(e) =>
                          setScale((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, minNumeric: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-20 px-2.5 py-1 font-mono border border-[#ECEEF5] rounded-lg"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={row.passing}
                        onChange={(e) =>
                          setScale((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, passing: e.target.checked } : x
                            )
                          )
                        }
                        className="accent-[#8174F7]"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setScale((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-[#858BA3] hover:text-[#C83D4C] rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ngưỡng xếp loại & Quy chế học lại */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-3">
            <h2 className="text-base font-bold text-[#20243A]">
              Ngưỡng phân loại học lực
            </h2>
            {bands.map((b, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center text-sm">
                <input
                  type="text"
                  value={b.label}
                  onChange={(e) =>
                    setBands((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x))
                    )
                  }
                  className="col-span-6 px-3 py-1.5 border border-[#ECEEF5] rounded-lg"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="4"
                  value={b.minGpa}
                  onChange={(e) =>
                    setBands((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, minGpa: Number(e.target.value) } : x
                      )
                    )
                  }
                  className="col-span-3 px-2.5 py-1.5 font-mono border border-[#ECEEF5] rounded-lg"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="4"
                  value={b.maxGpa}
                  onChange={(e) =>
                    setBands((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, maxGpa: Number(e.target.value) } : x
                      )
                    )
                  }
                  className="col-span-3 px-2.5 py-1.5 font-mono border border-[#ECEEF5] rounded-lg"
                />
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
            <h2 className="text-base font-bold text-[#20243A]">
              Quy chế học lại & Điểm chưa đạt
            </h2>
            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Cách tính điểm khi sinh viên học lại / cải thiện
              </label>
              <select
                value={policy.repeatPolicy}
                onChange={(e) =>
                  setPolicy({ ...policy, repeatPolicy: e.target.value as RepeatPolicy })
                }
                className="w-full px-3.5 py-2 text-sm border border-[#ECEEF5] rounded-xl bg-white"
              >
                <option value="replace_highest">Lấy điểm cao nhất trong các lần học (Khuyến nghị)</option>
                <option value="replace_latest">Lấy điểm lần học gần nhất</option>
                <option value="include_all">Tính tất cả các lần học vào GPA</option>
              </select>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-[#20243A]">
              <input
                type="checkbox"
                checked={policy.failedCourseInGpa}
                onChange={(e) => setPolicy({ ...policy, failedCourseInGpa: e.target.checked })}
                className="accent-[#8174F7]"
              />
              <span>Tính điểm học phần chưa đạt (0.00) vào GPA tích lũy</span>
            </label>
          </div>

          <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#20243A]">Trọng số điểm thành phần</h2>
              <span
                className={`text-xs font-mono font-semibold tabular-nums ${
                  weightsTotalPct === 100 ? 'text-[#238A5E]' : 'text-[#C83D4C]'
                }`}
              >
                Tổng: {weightsTotalPct}%
              </span>
            </div>
            <p className="text-xs text-[#858BA3]">
              Áp dụng thống nhất khi giảng viên nhập điểm chuyên cần, bài tập, giữa kỳ và cuối kỳ.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-[#20243A] mb-1">Chuyên cần (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(weights.attendanceWeight * 100)}
                  onChange={(e) =>
                    setWeights({ ...weights, attendanceWeight: Math.max(0, Number(e.target.value)) / 100 })
                  }
                  className="w-full px-3 py-1.5 font-mono border border-[#ECEEF5] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-[#20243A] mb-1">Bài tập (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(weights.assignmentWeight * 100)}
                  onChange={(e) =>
                    setWeights({ ...weights, assignmentWeight: Math.max(0, Number(e.target.value)) / 100 })
                  }
                  className="w-full px-3 py-1.5 font-mono border border-[#ECEEF5] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-[#20243A] mb-1">Giữa kỳ (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(weights.midtermWeight * 100)}
                  onChange={(e) =>
                    setWeights({ ...weights, midtermWeight: Math.max(0, Number(e.target.value)) / 100 })
                  }
                  className="w-full px-3 py-1.5 font-mono border border-[#ECEEF5] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-[#20243A] mb-1">Cuối kỳ (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(weights.finalWeight * 100)}
                  onChange={(e) =>
                    setWeights({ ...weights, finalWeight: Math.max(0, Number(e.target.value)) / 100 })
                  }
                  className="w-full px-3 py-1.5 font-mono border border-[#ECEEF5] rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSaveAll()}
          className="px-5 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Đang áp dụng & tính lại...' : 'Lưu cấu hình thang điểm'}</span>
        </button>
      </div>
    </div>
  );
}

export function AdminWarningsConfigView({
  data,
  onReload,
}: {
  data: AdminOverviewResponse;
  onReload: () => Promise<void>;
}) {
  const [thresholds, setThresholds] = useState<WarningThresholds>(data.settings.warningThresholds);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const years = useMemo(
    () => Array.from(new Set(data.warnings.map((w) => w.academic_year))).sort(),
    [data.warnings]
  );

  const filteredWarnings = useMemo(() => {
    return data.warnings.filter((w) => {
      if (severityFilter !== 'ALL' && w.severity !== severityFilter) return false;
      if (typeFilter !== 'ALL' && w.warning_type !== typeFilter) return false;
      if (yearFilter !== 'ALL' && w.academic_year !== yearFilter) return false;
      return true;
    });
  }, [data.warnings, severityFilter, typeFilter, yearFilter]);

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await api.updateSetting('warning_thresholds', thresholds);
      await onReload();
      setFeedback('Đã lưu ngưỡng cảnh báo học vụ và rà soát lại toàn bộ hồ sơ sinh viên.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3.5 rounded-2xl bg-[#36B37E]/10 border border-[#36B37E]/30 text-[#238A5E] text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Cấu hình ngưỡng cảnh báo tự động */}
      <form
        onSubmit={handleSaveThresholds}
        className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#ECEEF5]">
          <div>
            <h2 className="text-base font-bold text-[#20243A]">
              Ngưỡng tự động sinh cảnh báo học vụ
            </h2>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Khi cập nhật ngưỡng, hệ thống tự động đánh giá lại trạng thái cảnh báo của tất cả sinh viên
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang cập nhật...' : 'Lưu ngưỡng cảnh báo'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#20243A] mb-1.5">
              Ngưỡng GPA tích lũy thấp
            </label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="4"
              value={thresholds.lowCgpaThreshold}
              onChange={(e) =>
                setThresholds({ ...thresholds, lowCgpaThreshold: Number(e.target.value) })
              }
              className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#20243A] mb-1.5">
              Ngưỡng GPA mức nghiêm trọng
            </label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="4"
              value={thresholds.criticalCgpaThreshold}
              onChange={(e) =>
                setThresholds({ ...thresholds, criticalCgpaThreshold: Number(e.target.value) })
              }
              className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#20243A] mb-1.5">
              Số tín chỉ chưa đạt cảnh báo
            </label>
            <input
              type="number"
              min="1"
              value={thresholds.failedCreditsThreshold}
              onChange={(e) =>
                setThresholds({ ...thresholds, failedCreditsThreshold: Number(e.target.value) })
              }
              className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#20243A] mb-1.5">
              Số tín chỉ chưa đạt nghiêm trọng
            </label>
            <input
              type="number"
              min="1"
              value={thresholds.criticalFailedCreditsThreshold}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  criticalFailedCreditsThreshold: Number(e.target.value),
                })
              }
              className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#20243A] mb-1.5">
              Ngưỡng GPA học kỳ thấp
            </label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="4"
              value={thresholds.lowSemesterGpaThreshold}
              onChange={(e) =>
                setThresholds({ ...thresholds, lowSemesterGpaThreshold: Number(e.target.value) })
              }
              className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#20243A] mb-1.5">
              Tỷ lệ tiến độ tín chỉ tối thiểu (0.10 – 1.00)
            </label>
            <input
              type="number"
              step="0.05"
              min="0.1"
              max="1"
              value={thresholds.progressBehindRatio}
              onChange={(e) =>
                setThresholds({ ...thresholds, progressBehindRatio: Number(e.target.value) })
              }
              className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
            />
          </div>
        </div>
      </form>

      {/* Danh sách cảnh báo toàn trường */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
        <div className="p-5 border-b border-[#ECEEF5] flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#20243A]">
            Báo cáo cảnh báo học vụ toàn trường
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl"
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="Critical">Nghiêm trọng</option>
              <option value="High">Cao</option>
              <option value="Medium">Trung bình</option>
              <option value="Low">Nhẹ</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl"
            >
              <option value="ALL">Tất cả loại cảnh báo</option>
              <option value="LOW_GPA">GPA tích lũy thấp</option>
              <option value="FAILED_CREDITS">Tín chỉ chưa đạt</option>
              <option value="LOW_SEMESTER_GPA">GPA học kỳ thấp</option>
              <option value="ACADEMIC_PROGRESS">Chậm tiến độ</option>
              <option value="REPEATED_FAILED_COURSES">Học phần trượt nhiều lần</option>
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl"
            >
              <option value="ALL">Tất cả năm học</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                <th className="py-3.5 px-5">Sinh viên</th>
                <th className="py-3.5 px-5">Tiêu đề cảnh báo</th>
                <th className="py-3.5 px-5">Điều kiện kích hoạt</th>
                <th className="py-3.5 px-5">Học kỳ &amp; Năm học</th>
                <th className="py-3.5 px-5">Mức độ</th>
                <th className="py-3.5 px-5">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5] text-sm">
              {filteredWarnings.map((w) => (
                <tr key={w.warning_id} className="hover:bg-[#F8F9FD]/70">
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-[#20243A]">{w.student_name}</div>
                    <div className="text-xs font-mono text-[#6558E8]">{w.student_id}</div>
                  </td>
                  <td className="py-3.5 px-5 font-medium text-[#20243A]">{w.warning_title}</td>
                  <td className="py-3.5 px-5 font-mono text-xs text-[#555C75]">
                    {w.triggering_condition}
                  </td>
                  <td className="py-3.5 px-5 font-mono text-xs text-[#858BA3] whitespace-nowrap">
                    {w.semester ? `${w.semester} · ${w.academic_year}` : w.academic_year}
                  </td>
                  <td className="py-3.5 px-5">
                    <SemanticStatusBadge
                      tone={w.severity === 'Critical' ? 'danger' : 'warning'}
                      label={translateSeverity(w.severity)}
                    />
                  </td>
                  <td className="py-3.5 px-5">
                    <SemanticStatusBadge
                      tone={w.warning_status === 'Resolved' ? 'success' : 'info'}
                      label={translateWarningStatus(w.warning_status)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminStudentReportInspector({ data }: { data: AdminOverviewResponse }) {
  const [selectedId, setSelectedId] = useState(data.students[0]?.student_id ?? '');
  const [studentOverview, setStudentOverview] = useState<StudentOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    api
      .getStudentOverview(selectedId)
      .then(setStudentOverview)
      .finally(() => setLoading(false));
  }, [selectedId]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#20243A]">Chọn báo cáo học tập của sinh viên</h2>
          <p className="text-xs text-[#858BA3] mt-0.5">
            Xem biểu đồ xu hướng GPA, bảng điểm chi tiết và xuất báo cáo PDF cho từng sinh viên
          </p>
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="px-4 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl min-w-[280px] text-[#20243A]"
        >
          {data.students.map((s) => (
            <option key={s.student_id} value={s.student_id}>
              {s.full_name} ({s.student_id}) — GPA {formatGpa(s.cgpa)}
            </option>
          ))}
        </select>
      </div>

      {loading || !studentOverview ? (
        <PageLoadingSkeleton />
      ) : (
        <AcademicReportsPage overview={studentOverview} />
      )}
    </div>
  );
}

export function AdminTermsConfigView({
  data,
  onReload,
}: {
  data: AdminOverviewResponse;
  onReload: () => Promise<void>;
}) {
  const years = data.academicTerms?.years ?? [];
  const semesters = data.academicTerms?.semesters ?? [];

  const [newYearCode, setNewYearCode] = useState('2027-2028');
  const [newYearName, setNewYearName] = useState('');
  const [createDefaults, setCreateDefaults] = useState(true);

  const [targetYearId, setTargetYearId] = useState(years[years.length - 1]?.year_id ?? '');
  const [newSemName, setNewSemName] = useState('Học kỳ hè');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetYearId && years.length > 0) {
      setTargetYearId(years[years.length - 1].year_id);
    }
  }, [years, targetYearId]);

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setSaving(true);
    try {
      await api.createAcademicYear({
        year_code: newYearCode.trim(),
        year_name: newYearName.trim() || undefined,
        create_default_semesters: createDefaults,
      });
      setNewYearName('');
      await onReload();
      setFeedback(`Đã thêm năm học ${newYearCode.trim()} vào hệ thống.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể thêm năm học.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetYearId) return;
    setError(null);
    setFeedback(null);
    setSaving(true);
    try {
      await api.createSemester({
        year_id: targetYearId,
        semester_name: newSemName.trim(),
      });
      await onReload();
      setFeedback(`Đã thêm ${newSemName.trim()} vào năm học đã chọn.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể thêm học kỳ.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleYear = async (yearId: string, currentActive: number) => {
    setError(null);
    setFeedback(null);
    setSaving(true);
    try {
      await api.updateAcademicYear(yearId, { is_active: currentActive !== 1 });
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái năm học.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSemester = async (semesterId: string, currentActive: number) => {
    setError(null);
    setFeedback(null);
    setSaving(true);
    try {
      await api.updateSemester(semesterId, { is_active: currentActive !== 1 });
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái học kỳ.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3.5 rounded-2xl bg-[#36B37E]/10 border border-[#36B37E]/30 text-[#238A5E] text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-2xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-sm">
          {error}
        </div>
      )}

      {/* Forms to create Academic Year and Semester */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleAddYear}
          className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center">
              <CalendarRange className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#20243A]">Thêm năm học mới</h2>
              <p className="text-xs text-[#858BA3]">
                Định dạng YYYY-YYYY (ví dụ: 2027-2028)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Mã năm học *
              </label>
              <input
                type="text"
                value={newYearCode}
                onChange={(e) => setNewYearCode(e.target.value)}
                placeholder="VD: 2027-2028"
                className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Tên hiển thị (Không bắt buộc)
              </label>
              <input
                type="text"
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
                placeholder="VD: Năm học 2027–2028"
                className="w-full px-3.5 py-2 text-sm border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#20243A]">
            <input
              type="checkbox"
              checked={createDefaults}
              onChange={(e) => setCreateDefaults(e.target.checked)}
              className="accent-[#8174F7]"
            />
            <span>Tự động tạo 3 học kỳ chuẩn (Học kỳ 1, Học kỳ 2, Học kỳ hè)</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm năm học</span>
          </button>
        </form>

        <form
          onSubmit={handleAddSemester}
          className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4"
        >
          <div>
            <h2 className="text-base font-bold text-[#20243A]">Thêm học kỳ cho năm học</h2>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Bổ sung Học kỳ 1, Học kỳ 2, Học kỳ hè hoặc học kỳ chuyên đề cho năm học hiện có
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Chọn năm học *
              </label>
              <select
                value={targetYearId}
                onChange={(e) => setTargetYearId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl bg-white focus:outline-none focus:border-[#8174F7]"
              >
                {years.map((y) => (
                  <option key={y.year_id} value={y.year_id}>
                    {y.year_code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Tên học kỳ *
              </label>
              <select
                value={newSemName}
                onChange={(e) => setNewSemName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-[#ECEEF5] rounded-xl bg-white focus:outline-none focus:border-[#8174F7]"
              >
                <option value="Học kỳ 1">Học kỳ 1</option>
                <option value="Học kỳ 2">Học kỳ 2</option>
                <option value="Học kỳ hè">Học kỳ hè</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !targetYearId}
            className="px-4 py-2.5 bg-[#F0EDFF] hover:bg-[#e5e0ff] text-[#6558E8] disabled:opacity-60 text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm học kỳ</span>
          </button>
        </form>
      </div>

      {/* Existing Years & Semesters Directory */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#20243A]">
            Danh mục Năm học &amp; Học kỳ đang cấu hình
          </h2>
          <p className="text-xs text-[#858BA3] mt-0.5">
            Quản lý trạng thái mở/khóa đăng ký kết quả học tập cho từng năm học và học kỳ
          </p>
        </div>

        <div className="space-y-4">
          {[...years]
            .sort((a, b) => b.start_year - a.start_year)
            .map((yr) => {
              const yrSemesters = semesters
                .filter((s) => s.year_id === yr.year_id)
                .sort((a, b) => a.sort_order - b.sort_order);

              return (
                <div
                  key={yr.year_id}
                  className="border border-[#ECEEF5] rounded-2xl p-4 sm:p-5 bg-[#F8F9FD]/60 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm px-3 py-1 rounded-xl bg-[#F0EDFF] text-[#6558E8]">
                        {yr.year_code}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-[#20243A]">{yr.year_name}</div>
                        <div className="text-xs text-[#858BA3]">
                          {yrSemesters.length} học kỳ được cấu hình
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <SemanticStatusBadge
                        tone={yr.is_active === 1 ? 'success' : 'neutral'}
                        label={yr.is_active === 1 ? 'Đang kích hoạt' : 'Tạm khóa'}
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleToggleYear(yr.year_id, yr.is_active)}
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-[#ECEEF5] hover:border-[#8174F7] rounded-xl text-[#20243A] inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Power className="w-3.5 h-3.5 text-[#8174F7]" />
                        <span>{yr.is_active === 1 ? 'Tạm khóa' : 'Kích hoạt'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {yrSemesters.map((sem) => (
                      <div
                        key={sem.semester_id}
                        className="bg-white border border-[#ECEEF5] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-xs font-semibold text-[#20243A]">
                            {sem.semester_name}
                          </div>
                          <div className="text-[11px] font-mono text-[#858BA3]">
                            {sem.semester_code}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleToggleSemester(sem.semester_id, sem.is_active)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                            sem.is_active === 1
                              ? 'bg-[#36B37E]/12 text-[#238A5E] hover:bg-[#36B37E]/20'
                              : 'bg-[#ECEEF5] text-[#555C75] hover:bg-[#dfe2ec]'
                          }`}
                        >
                          {sem.is_active === 1 ? 'Mở' : 'Khóa'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

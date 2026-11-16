import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  ShieldAlert,
  Target,
  X,
} from 'lucide-react';
import {
  AcademicWarningRecord,
  translateSeverity,
  translateWarningStatus,
  WarningSeverity,
  WarningType,
} from '../../shared/academicLogic.ts';
import { api, StudentOverviewResponse } from '../services/api.ts';
import { SemanticStatusBadge, SemanticTone } from '../components/PortalUI.tsx';
import { ActiveRouteKey } from '../components/ShellLayout.tsx';

function severityTone(severity: WarningSeverity): SemanticTone {
  if (severity === 'Critical') return 'danger';
  if (severity === 'High' || severity === 'Medium') return 'warning';
  return 'info';
}

function warningTypeLabel(type: WarningType): string {
  switch (type) {
    case 'LOW_GPA':
      return 'GPA tích lũy thấp';
    case 'FAILED_CREDITS':
      return 'Tín chỉ chưa đạt';
    case 'LOW_SEMESTER_GPA':
      return 'GPA học kỳ thấp';
    case 'ACADEMIC_PROGRESS':
      return 'Chậm tiến độ';
    case 'REPEATED_FAILED_COURSES':
      return 'Học lại nhiều lần chưa đạt';
  }
}

function cardAccentClasses(severity: WarningSeverity, resolved: boolean): string {
  if (resolved) {
    return 'bg-white border-[#ECEEF5]';
  }
  if (severity === 'Critical') {
    return 'bg-[#EF6472]/[0.04] border-[#EF6472]/35';
  }
  if (severity === 'High') {
    return 'bg-[#F5AE48]/[0.06] border-[#F5AE48]/40';
  }
  return 'bg-[#F5AE48]/[0.04] border-[#F5AE48]/30';
}

export function AcademicWarningsPage({
  overview,
  onReload,
  onNavigate,
}: {
  overview: StudentOverviewResponse;
  onReload: () => Promise<void>;
  onNavigate: (route: ActiveRouteKey) => void;
}) {
  const { student, warnings, settings } = overview;
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRESOLVED' | 'Resolved'>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedWarning, setSelectedWarning] = useState<AcademicWarningRecord | null>(null);

  const filtered = warnings.filter((w) => {
    if (statusFilter === 'UNRESOLVED') return w.warning_status !== 'Resolved';
    if (statusFilter === 'Resolved') return w.warning_status === 'Resolved';
    return true;
  });

  const activeWarnings = warnings.filter((w) => w.warning_status !== 'Resolved');
  const criticalCount = activeWarnings.filter((w) => w.severity === 'Critical').length;
  const unreadCount = warnings.filter((w) => w.warning_status === 'Active').length;

  const handleMarkRead = async (w: AcademicWarningRecord) => {
    setBusyId(w.warning_id);
    try {
      await api.markWarningRead(student.student_id, w.warning_id);
      await onReload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Center Summary Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col justify-between space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#20243A]">
                Trung tâm cảnh báo học vụ
              </h2>
              <p className="text-xs text-[#858BA3] mt-1">
                Hệ thống tự động rà soát kết quả học phần, tín chỉ chưa đạt và tiến độ học tập theo quy chế.
              </p>
            </div>
            <SemanticStatusBadge
              tone={activeWarnings.length > 0 ? 'warning' : 'success'}
              label={
                activeWarnings.length > 0
                  ? `${activeWarnings.length} cảnh báo đang hiệu lực`
                  : 'Học tập ổn định'
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5]">
              <div className="text-xs text-[#858BA3]">Tổng cảnh báo</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#20243A] mt-0.5">
                {activeWarnings.length}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#EF6472]/[0.06] border border-[#EF6472]/20">
              <div className="text-xs text-[#C83D4C]">Mức nghiêm trọng</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#C83D4C] mt-0.5">
                {criticalCount}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#F0EDFF]/70 border border-[#8174F7]/20">
              <div className="text-xs text-[#6558E8]">Chưa đọc</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#6558E8] mt-0.5">
                {unreadCount}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#ECEEF5]">
            <div className="inline-flex items-center gap-1 p-1 bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl">
              {(['ALL', 'UNRESOLVED', 'Resolved'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    statusFilter === tab
                      ? 'bg-white text-[#6558E8] shadow-xs'
                      : 'text-[#858BA3] hover:text-[#20243A]'
                  }`}
                >
                  {tab === 'ALL'
                    ? 'Tất cả lịch sử'
                    : tab === 'UNRESOLVED'
                      ? 'Đang hiệu lực'
                      : 'Đã khắc phục'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('student_planner')}
              className="px-4 py-2 text-xs font-semibold bg-[#8174F7] hover:bg-[#6558E8] text-white rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Lập kế hoạch cải thiện GPA</span>
            </button>
          </div>
        </div>

        {/* Configured Warning Rules */}
        <div className="lg:col-span-5 bg-white border border-[#ECEEF5] rounded-[18px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#20243A]">Ngưỡng cảnh báo đang áp dụng</h3>
            <div className="w-8 h-8 rounded-xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <dl className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-[#ECEEF5]">
              <dt className="text-[#858BA3]">Ngưỡng GPA tích lũy thấp</dt>
              <dd className="font-mono font-semibold text-[#20243A] tabular-nums">
                &lt; {settings.warningThresholds.lowCgpaThreshold.toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between py-2 border-b border-[#ECEEF5]">
              <dt className="text-[#858BA3]">Ngưỡng tín chỉ chưa đạt</dt>
              <dd className="font-mono font-semibold text-[#20243A] tabular-nums">
                &ge; {settings.warningThresholds.failedCreditsThreshold} tín chỉ
              </dd>
            </div>
            <div className="flex justify-between py-2 border-b border-[#ECEEF5]">
              <dt className="text-[#858BA3]">Ngưỡng GPA học kỳ thấp</dt>
              <dd className="font-mono font-semibold text-[#20243A] tabular-nums">
                &lt; {settings.warningThresholds.lowSemesterGpaThreshold.toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[#858BA3]">Tỷ lệ tiến độ tín chỉ tối thiểu</dt>
              <dd className="font-mono font-semibold text-[#20243A] tabular-nums">
                {Math.round(settings.warningThresholds.progressBehindRatio * 100)}% kế hoạch chuẩn
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Individual Warning Notification Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#36B37E]/12 text-[#36B37E] flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="text-base font-bold text-[#20243A]">
            Không có cảnh báo học vụ nào trong mục này
          </div>
          <p className="text-sm text-[#858BA3] mt-1">
            Kết quả học tập hiện tại của bạn đang đáp ứng đầy đủ các ngưỡng quy định của nhà trường.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((w) => {
            const isResolved = w.warning_status === 'Resolved';
            return (
              <div
                key={w.warning_id}
                className={`border rounded-[18px] p-6 transition-all ${cardAccentClasses(
                  w.severity,
                  isResolved
                )}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-[#ECEEF5]">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#858BA3]">
                      <span className="font-mono font-semibold text-[#6558E8]">
                        {w.warning_id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{warningTypeLabel(w.warning_type)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">
                        {w.semester ? `${w.semester} · ${w.academic_year}` : w.academic_year}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(w.generated_at).toLocaleDateString('vi-VN')}</span>
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-[#20243A] flex items-center gap-2.5">
                      <AlertTriangle
                        className={`w-5 h-5 shrink-0 ${
                          isResolved
                            ? 'text-[#36B37E]'
                            : w.severity === 'Critical'
                              ? 'text-[#EF6472]'
                              : 'text-[#F5AE48]'
                        }`}
                      />
                      <span>{w.warning_title}</span>
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <SemanticStatusBadge
                      tone={severityTone(w.severity)}
                      label={`Mức ${translateSeverity(w.severity)}`}
                    />
                    <SemanticStatusBadge
                      tone={
                        w.warning_status === 'Resolved'
                          ? 'success'
                          : w.warning_status === 'Read'
                            ? 'neutral'
                            : 'info'
                      }
                      label={translateWarningStatus(w.warning_status)}
                    />
                  </div>
                </div>

                <div className="py-4 space-y-3.5 text-sm">
                  <p className="text-[#20243A] leading-relaxed">{w.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/90 border border-[#ECEEF5] rounded-xl p-3.5">
                      <div className="text-xs font-semibold text-[#858BA3] mb-1">
                        Nguyên nhân kích hoạt
                      </div>
                      <div className="font-mono text-xs text-[#20243A] font-medium">
                        {w.triggering_condition}
                      </div>
                    </div>
                    <div className="bg-[#F0EDFF]/60 border border-[#8174F7]/20 rounded-xl p-3.5">
                      <div className="text-xs font-semibold text-[#6558E8] mb-1">
                        Khuyến nghị xử lý
                      </div>
                      <div className="text-xs text-[#20243A] leading-relaxed">
                        {w.suggested_action}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#ECEEF5] flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedWarning(w)}
                    className="px-3.5 py-2 text-xs font-semibold text-[#20243A] bg-white border border-[#ECEEF5] hover:bg-[#F8F9FD] rounded-xl inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem chi tiết</span>
                  </button>
                  {w.warning_status === 'Active' && (
                    <button
                      type="button"
                      disabled={busyId === w.warning_id}
                      onClick={() => void handleMarkRead(w)}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] disabled:opacity-60 rounded-xl inline-flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {busyId === w.warning_id ? 'Đang cập nhật...' : 'Đánh dấu đã đọc'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Chi tiết cảnh báo */}
      {selectedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-[#ECEEF5] mb-4">
              <div>
                <div className="text-xs font-mono font-semibold text-[#6558E8]">
                  {selectedWarning.warning_id} · {warningTypeLabel(selectedWarning.warning_type)}
                </div>
                <h3 className="text-lg font-bold text-[#20243A] mt-0.5">
                  {selectedWarning.warning_title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWarning(null)}
                className="text-[#858BA3] hover:text-[#20243A] p-1"
                aria-label="Đóng chi tiết cảnh báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <p className="text-[#20243A] leading-relaxed">{selectedWarning.description}</p>
              <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#ECEEF5] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#858BA3]">Kỳ học phát sinh</span>
                  <span className="font-mono font-semibold text-[#20243A]">
                    {selectedWarning.semester
                      ? `${selectedWarning.semester} (${selectedWarning.academic_year})`
                      : selectedWarning.academic_year}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#858BA3]">Điều kiện kích hoạt</span>
                  <span className="font-mono font-semibold text-[#C83D4C]">
                    {selectedWarning.triggering_condition}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#858BA3]">Trạng thái</span>
                  <span className="font-semibold text-[#20243A]">
                    {translateWarningStatus(selectedWarning.warning_status)}
                  </span>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F0EDFF] border border-[#8174F7]/25 text-xs text-[#20243A] leading-relaxed">
                <div className="font-semibold text-[#6558E8] mb-1">Hướng dẫn khắc phục</div>
                {selectedWarning.suggested_action}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedWarning(null);
                  onNavigate('student_planner');
                }}
                className="px-4 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl"
              >
                Mở Kế hoạch GPA mục tiêu
              </button>
              <button
                type="button"
                onClick={() => setSelectedWarning(null)}
                className="px-4 py-2 text-xs font-semibold bg-[#8174F7] hover:bg-[#6558E8] text-white rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

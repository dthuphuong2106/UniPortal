import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BookCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  GraduationCap,
  QrCode,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildTargetGpaScenarios,
  calculateTargetGpaPlan,
  formatDisplayDate,
  formatGpa,
  formatVnd,
  translateSeverity,
  validatePlannedCredits,
} from '../../shared/academicLogic.ts';
import { StudentOverviewResponse } from '../services/api.ts';
import {
  ACADEMIC_BADGE_IMG,
  AcademicIllustration,
  SemanticStatusBadge,
  SemanticTone,
} from '../components/PortalUI.tsx';
import { ActiveRouteKey } from '../components/ShellLayout.tsx';

function classificationTone(color: string): SemanticTone {
  if (color === 'emerald') return 'success';
  if (color === 'blue' || color === 'sky') return 'info';
  if (color === 'amber' || color === 'orange') return 'warning';
  return 'danger';
}

export function StudentDashboardPage({
  overview,
  onNavigate,
  onToast,
}: {
  overview: StudentOverviewResponse;
  onNavigate: (route: ActiveRouteKey) => void;
  onToast?: (message: string, tone?: 'success' | 'error' | 'info' | 'warning') => void;
}) {
  const { student, summary, warnings, academicTerms, settings, tuitionSummary } = overview;
  const activeWarnings = warnings.filter((w) => w.warning_status !== 'Resolved');
  const firstName = student.full_name.trim().split(' ').slice(-1)[0] || student.full_name;
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [debtBannerDismissed, setDebtBannerDismissed] = useState(false);
  const [dueBannerDismissed, setDueBannerDismissed] = useState(false);
  const notifiedTuitionKeyRef = useRef<string | null>(null);

  const isDebtOverThreshold = Boolean(
    tuitionSummary &&
      tuitionSummary.totalUnpaid > tuitionSummary.debtAlertThreshold &&
      tuitionSummary.totalUnpaid > 0
  );

  const nextDue = tuitionSummary?.nextUnpaidDue ?? null;
  const shouldShowDueReminder = Boolean(nextDue && (nextDue.isDueSoon || nextDue.isOverdue));

  useEffect(() => {
    if (!tuitionSummary || !onToast) return;
    if (!isDebtOverThreshold && !shouldShowDueReminder) return;

    const key = [
      student.student_id,
      tuitionSummary.totalUnpaid,
      tuitionSummary.debtAlertThreshold,
      nextDue?.dueDate ?? '',
      nextDue?.daysRemaining ?? '',
    ].join(':');

    if (notifiedTuitionKeyRef.current === key) return;
    notifiedTuitionKeyRef.current = key;

    if (shouldShowDueReminder && nextDue) {
      const dueStr = formatDisplayDate(nextDue.dueDate);
      const timingText = nextDue.isOverdue
        ? `đã quá hạn ${Math.abs(nextDue.daysRemaining)} ngày`
        : nextDue.daysRemaining === 0
          ? 'đến hạn hôm nay'
          : `còn ${nextDue.daysRemaining} ngày`;

      if (isDebtOverThreshold) {
        onToast(
          `Nhắc nhở học phí (${nextDue.semester}): Dư nợ ${formatVnd(tuitionSummary.totalUnpaid)} vượt ngưỡng & ${timingText} (hạn ${dueStr}).`,
          nextDue.isOverdue ? 'error' : 'warning'
        );
      } else {
        onToast(
          `Nhắc nhở hạn nộp học phí ${nextDue.semester} (${nextDue.academic_year}): ${timingText} (hạn ${dueStr}) — ${formatVnd(nextDue.amount)}.`,
          nextDue.isOverdue ? 'error' : 'warning'
        );
      }
      return;
    }

    if (isDebtOverThreshold) {
      onToast(
        `Cảnh báo công nợ học phí: Dư nợ ${formatVnd(tuitionSummary.totalUnpaid)} đã vượt ngưỡng ${formatVnd(tuitionSummary.debtAlertThreshold)}. Vui lòng thanh toán QR.`,
        'warning'
      );
    }
  }, [
    isDebtOverThreshold,
    nextDue,
    onToast,
    shouldShowDueReminder,
    student.student_id,
    tuitionSummary,
  ]);

  const currentCgpaNum = summary.cgpa ?? 0;
  const currentCreditsNum = summary.gpaEligibleCredits;
  const defaultTargetGpa = useMemo(() => {
    if (currentCgpaNum >= 3.6) return 3.8;
    if (currentCgpaNum >= 3.2) return 3.6;
    if (currentCgpaNum >= 2.5) return 3.2;
    return 2.5;
  }, [currentCgpaNum]);

  const [targetGpaStr, setTargetGpaStr] = useState<string>(() => defaultTargetGpa.toFixed(2));
  const [plannedCreditsStr, setPlannedCreditsStr] = useState<string>(() =>
    String(
      summary.remainingCreditsToGraduation > 0
        ? Math.min(15, summary.remainingCreditsToGraduation)
        : 12
    )
  );

  const classificationGoals = useMemo(
    () =>
      [...settings.classificationBands]
        .filter((b) => b.minGpa >= 2.0)
        .sort((a, b) => b.minGpa - a.minGpa),
    [settings.classificationBands]
  );

  const plannedCreditCheck = useMemo(
    () => validatePlannedCredits(plannedCreditsStr),
    [plannedCreditsStr]
  );

  const targetGpaNum = Number(targetGpaStr);
  const plannerResult = useMemo(
    () =>
      calculateTargetGpaPlan({
        currentCgpa: currentCgpaNum,
        currentCredits: currentCreditsNum,
        currentWeightedPoints: summary.totalWeightedPoints,
        targetCgpa: Number.isFinite(targetGpaNum) ? targetGpaNum : NaN,
        futureCredits: plannedCreditCheck.valid ? plannedCreditCheck.value : Number(plannedCreditsStr),
      }),
    [
      currentCgpaNum,
      currentCreditsNum,
      summary.totalWeightedPoints,
      targetGpaNum,
      plannedCreditCheck.valid,
      plannedCreditCheck.value,
      plannedCreditsStr,
    ]
  );

  const scenarios = useMemo(
    () =>
      buildTargetGpaScenarios({
        currentCgpa: currentCgpaNum,
        currentCredits: currentCreditsNum,
        currentWeightedPoints: summary.totalWeightedPoints,
        targetCgpa:
          Number.isFinite(targetGpaNum) && targetGpaNum >= 0 && targetGpaNum <= 4
            ? targetGpaNum
            : defaultTargetGpa,
        plannedCredits: plannedCreditCheck.valid ? plannedCreditCheck.value : 12,
      }),
    [
      currentCgpaNum,
      currentCreditsNum,
      summary.totalWeightedPoints,
      targetGpaNum,
      defaultTargetGpa,
      plannedCreditCheck.valid,
      plannedCreditCheck.value,
    ]
  );

  const selectedClassification = useMemo(() => {
    if (!Number.isFinite(targetGpaNum)) return null;
    return (
      classificationGoals.find(
        (b) => targetGpaNum >= b.minGpa && targetGpaNum <= b.maxGpa
      ) ?? null
    );
  }, [classificationGoals, targetGpaNum]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const s of summary.semesters) {
      years.add(s.academic_year);
    }
    for (const y of academicTerms?.years ?? []) {
      if (summary.semesters.some((s) => s.academic_year === y.year_code)) {
        years.add(y.year_code);
      }
    }
    return Array.from(years).sort((a, b) => a.localeCompare(b));
  }, [summary.semesters, academicTerms]);

  const filteredSemesters = useMemo(() => {
    if (yearFilter === 'ALL') return summary.semesters;
    return summary.semesters.filter((s) => s.academic_year === yearFilter);
  }, [summary.semesters, yearFilter]);

  const chartData = useMemo(
    () =>
      filteredSemesters
        .filter((s) => s.semesterGpa !== null)
        .map((s) => ({
          name: `${s.semester.replace('Học kỳ ', 'HK').replace('hè', 'Hè')} (${s.academic_year.slice(2, 4)}-${s.academic_year.slice(7, 9)})`,
          fullLabel: `${s.semester} (${s.academic_year})`,
          semesterGpa: s.semesterGpa,
          cumulativeGpa: s.cumulativeGpa,
        })),
    [filteredSemesters]
  );

  const allCompletedSemesters = summary.semesters.filter((s) => s.semesterGpa !== null);
  const prevSem =
    allCompletedSemesters.length >= 2
      ? allCompletedSemesters[allCompletedSemesters.length - 2].semesterGpa ?? null
      : null;
  const currSem =
    allCompletedSemesters.length >= 1
      ? allCompletedSemesters[allCompletedSemesters.length - 1].semesterGpa ?? null
      : null;
  const semDelta =
    prevSem !== null && currSem !== null ? Number((currSem - prevSem).toFixed(2)) : null;

  const performanceSummaryText = useMemo(() => {
    if (summary.cgpa === null) {
      return 'Chưa có học kỳ chính thức hoàn tất để đánh giá xu hướng GPA.';
    }
    if (semDelta !== null && semDelta > 0) {
      return `Học lực hiện đạt loại ${summary.classification.label} (CGPA ${formatGpa(summary.cgpa)}), GPA kỳ gần nhất tăng ${semDelta.toFixed(2)} điểm so với kỳ trước.`;
    }
    if (semDelta !== null && semDelta < 0) {
      return `Học lực hiện đạt loại ${summary.classification.label} (CGPA ${formatGpa(summary.cgpa)}), GPA kỳ gần nhất giảm ${Math.abs(semDelta).toFixed(2)} điểm — cần lưu ý cải thiện.`;
    }
    return `Học lực hiện đạt loại ${summary.classification.label} với GPA tích lũy ${formatGpa(summary.cgpa)} trên ${summary.gpaEligibleCredits} tín chỉ hợp lệ.`;
  }, [summary.cgpa, summary.classification.label, summary.gpaEligibleCredits, semDelta]);

  const statusVisual = useMemo(() => {
    if (!plannerResult.valid) {
      return {
        badgeBg: 'bg-[#EF6472]/12 text-[#C83D4C] border-[#EF6472]/30',
        label: 'Dữ liệu chưa hợp lệ',
        icon: AlertCircle,
      };
    }
    if (plannerResult.feasibilityStatus === 'impossible') {
      return {
        badgeBg: 'bg-[#EF6472]/12 text-[#C83D4C] border-[#EF6472]/30',
        label: 'Not achievable under the current plan · Không khả thi',
        icon: AlertCircle,
      };
    }
    if (plannerResult.feasibilityStatus === 'challenging') {
      return {
        badgeBg: 'bg-[#F5AE48]/15 text-[#9A5F0D] border-[#F5AE48]/35',
        label: 'Challenging · Khả thi nhưng thử thách',
        icon: AlertTriangle,
      };
    }
    return {
      badgeBg: 'bg-[#36B37E]/12 text-[#1F7A54] border-[#36B37E]/30',
      label: 'Achievable · Khả thi',
      icon: CheckCircle2,
    };
  }, [plannerResult]);

  const StatusIcon = statusVisual.icon;
  const validTargetForBar =
    Number.isFinite(targetGpaNum) && targetGpaNum > 0 && targetGpaNum <= 4
      ? targetGpaNum
      : defaultTargetGpa;
  const progressRatio = Math.min(100, Math.max(0, (currentCgpaNum / validTargetForBar) * 100));

  return (
    <div className="space-y-6">
      {/* Header gọn gàng: Lời chào · Họ tên · MSSV · Năm học & Học kỳ */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <div className="hidden sm:block w-14 h-14 rounded-2xl overflow-hidden border border-[#ECEEF5] bg-[#F0EDFF] shrink-0">
            <AcademicIllustration
              src={ACADEMIC_BADGE_IMG}
              alt="Biểu tượng học tập UniPortal"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#6558E8]">
              {student.faculty} · {student.major}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#20243A] tracking-tight mt-0.5 truncate">
              Xin chào, {firstName}!
            </h2>
            <p className="text-xs sm:text-sm text-[#858BA3] mt-1 font-mono">
              {student.full_name} · MSSV: {student.student_id} · 2025-2026 · Học kỳ 1
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <SemanticStatusBadge
            tone={classificationTone(summary.classification.color)}
            label={`Xếp loại: ${summary.classification.label}`}
          />
          <button
            type="button"
            onClick={() => onNavigate('student_results')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl transition-colors"
          >
            Xem kết quả học tập
          </button>
        </div>
      </div>

      {/* Cảnh báo công nợ học phí vượt ngưỡng */}
      {isDebtOverThreshold && tuitionSummary && !debtBannerDismissed && (
        <div
          role="alert"
          className="rounded-[18px] border border-[#F5AE48]/45 bg-[#FFF8EC] p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#F5AE48]/20 text-[#9A5F0D] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#7A4A06]">
                Cảnh báo công nợ học phí vượt ngưỡng cho phép
              </div>
              <p className="text-xs text-[#7A4A06]/90 mt-1 leading-relaxed">
                Số dư công nợ hiện tại là{' '}
                <span className="font-mono font-bold tabular-nums text-[#C83D4C]">
                  {formatVnd(tuitionSummary.totalUnpaid)}
                </span>{' '}
                ({tuitionSummary.unpaidCount} học kỳ chưa thanh toán), vượt ngưỡng cảnh báo{' '}
                <span className="font-mono font-semibold tabular-nums">
                  {formatVnd(tuitionSummary.debtAlertThreshold)}
                </span>
                . Vui lòng hoàn tất thanh toán để đảm bảo tiến độ đăng ký học phần và xét điểm.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              type="button"
              onClick={() => onNavigate('student_tuition')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#6558E8] hover:bg-[#5246D4] rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Thanh toán QR ngay</span>
            </button>
            <button
              type="button"
              onClick={() => setDebtBannerDismissed(true)}
              className="p-2 text-[#9A5F0D] hover:bg-[#F5AE48]/20 rounded-xl transition-colors"
              aria-label="Đóng cảnh báo học phí"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Nhắc nhở ngày đến hạn thanh toán học phí sắp tới */}
      {shouldShowDueReminder && nextDue && !dueBannerDismissed && (
        <div
          role="region"
          aria-label="Nhắc nhở ngày đến hạn thanh toán học phí"
          className={`rounded-[18px] border p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
            nextDue.isOverdue
              ? 'border-[#EF6472]/45 bg-[#FFF4F5]'
              : 'border-[#8174F7]/35 bg-[#F5F3FF]'
          }`}
        >
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                nextDue.isOverdue
                  ? 'bg-[#EF6472]/15 text-[#C83D4C]'
                  : 'bg-[#8174F7]/15 text-[#6558E8]'
              }`}
            >
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm font-bold ${
                    nextDue.isOverdue ? 'text-[#9F2432]' : 'text-[#20243A]'
                  }`}
                >
                  {nextDue.isOverdue
                    ? 'Học phí đã quá hạn thanh toán'
                    : 'Nhắc nhở ngày đến hạn thanh toán học phí sắp tới'}
                </span>
                <span
                  className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded-full ${
                    nextDue.isOverdue
                      ? 'bg-[#EF6472]/15 text-[#C83D4C]'
                      : nextDue.daysRemaining <= 3
                        ? 'bg-[#F5AE48]/20 text-[#9A5F0D]'
                        : 'bg-white text-[#6558E8] border border-[#8174F7]/30'
                  }`}
                >
                  {nextDue.isOverdue
                    ? `Quá hạn ${Math.abs(nextDue.daysRemaining)} ngày`
                    : nextDue.daysRemaining === 0
                      ? 'Hôm nay là hạn cuối'
                      : `Còn ${nextDue.daysRemaining} ngày`}
                </span>
              </div>
              <p className="text-xs text-[#555C75] mt-1 leading-relaxed">
                Hóa đơn{' '}
                <span className="font-semibold text-[#20243A]">
                  {nextDue.semester} ({nextDue.academic_year})
                </span>{' '}
                số tiền{' '}
                <span className="font-mono font-bold tabular-nums text-[#6558E8]">
                  {formatVnd(nextDue.amount)}
                </span>{' '}
                có hạn nộp vào ngày{' '}
                <span className="font-mono font-bold tabular-nums text-[#20243A]">
                  {formatDisplayDate(nextDue.dueDate)}
                </span>
                . Vui lòng hoàn tất quét mã QR trước thời hạn trên.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              type="button"
              onClick={() => onNavigate('student_tuition')}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-xl inline-flex items-center gap-1.5 transition-colors ${
                nextDue.isOverdue
                  ? 'bg-[#C83D4C] hover:bg-[#AE313F]'
                  : 'bg-[#6558E8] hover:bg-[#5246D4]'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Thanh toán ngay</span>
            </button>
            <button
              type="button"
              onClick={() => setDueBannerDismissed(true)}
              className="p-2 text-[#858BA3] hover:text-[#20243A] hover:bg-white/70 rounded-xl transition-colors"
              aria-label="Đóng nhắc nhở hạn thanh toán"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Đúng 4 thẻ KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#D7D2FC] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">GPA tích lũy</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
              {formatGpa(summary.cgpa)}
            </span>
            <span className="text-sm font-mono text-[#858BA3]">/ 4.00</span>
          </div>
          <div className="mt-2.5 text-xs text-[#858BA3]">
            Trên {summary.gpaEligibleCredits} tín chỉ tính GPA
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#D7D2FC] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">GPA học kỳ hiện tại</span>
            <div className="w-9 h-9 rounded-xl bg-[#36B37E]/12 text-[#36B37E] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
              {formatGpa(summary.latestSemesterGpa)}
            </span>
            {semDelta !== null && (
              <span
                className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                  semDelta >= 0
                    ? 'bg-[#36B37E]/12 text-[#238A5E]'
                    : 'bg-[#EF6472]/12 text-[#C83D4C]'
                }`}
              >
                {semDelta >= 0 ? `+${semDelta.toFixed(2)}` : semDelta.toFixed(2)}
              </span>
            )}
          </div>
          <div className="mt-2.5 text-xs text-[#858BA3] truncate">
            {summary.latestSemesterLabel || 'Chưa có học kỳ hoàn tất'}
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#D7D2FC] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Tín chỉ đã tích lũy</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center">
              <BookCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
              {summary.earnedCredits}
            </span>
            <span className="text-sm font-mono text-[#858BA3] tabular-nums">
              / {summary.totalRequiredCredits}
            </span>
          </div>
          <div className="mt-2.5 text-xs text-[#858BA3]">
            Hoàn thành {summary.completionPercentage.toFixed(1)}% chương trình
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('student_warnings')}
          className="text-left bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#8174F7] transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Cảnh báo đang hoạt động</span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                activeWarnings.length > 0
                  ? 'bg-[#EF6472]/12 text-[#EF6472]'
                  : 'bg-[#36B37E]/12 text-[#36B37E]'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
              {activeWarnings.length}
            </span>
            <span className="text-xs font-medium text-[#858BA3]">
              {activeWarnings.length > 0 ? 'cảnh báo cần lưu ý' : 'trạng thái ổn định'}
            </span>
          </div>
          <div className="mt-2.5 text-xs font-medium text-[#6558E8] inline-flex items-center gap-1 group-hover:underline">
            <span>Xem cảnh báo học vụ</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* SIGNATURE FEATURE: Trợ lý lập kế hoạch GPA mục tiêu */}
      <section
        aria-label="Trợ lý lập kế hoạch GPA mục tiêu"
        className="relative overflow-hidden rounded-[22px] border border-[#C9C1FA] bg-gradient-to-br from-[#F6F4FF] via-white to-[#EEF3FF] p-6 sm:p-7 shadow-[0_12px_32px_rgba(101,88,232,0.08)]"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-[#E3DFFD]">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#6558E8] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6558E8]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Trợ lý học tập nổi bật · GPA Target Planner</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#20243A] mt-0.5">
                Lập kế hoạch chinh phục GPA mục tiêu
              </h3>
              <p className="text-xs text-[#555C75] mt-1">
                Tính toán dựa trên {summary.gpaEligibleCredits} tín chỉ hợp lệ (đã xử lý học lại, môn chưa đạt &amp; môn loại trừ).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${statusVisual.badgeBg}`}
            >
              <StatusIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{statusVisual.label}</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('student_planner')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#6558E8] hover:bg-[#5246D4] rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Mô phỏng từng môn học</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <div className="text-xs font-semibold text-[#555C75] mb-2">
                Chọn nhanh xếp loại mục tiêu
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {classificationGoals.map((band) => {
                  const isActive = Math.abs(targetGpaNum - band.minGpa) < 0.001;
                  return (
                    <button
                      key={band.label}
                      type="button"
                      onClick={() => setTargetGpaStr(band.minGpa.toFixed(2))}
                      className={`px-2.5 py-2 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'bg-[#6558E8] text-white border-[#6558E8] shadow-sm'
                          : 'bg-white text-[#20243A] border-[#E3DFFD] hover:border-[#8174F7]'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{band.label}</div>
                      <div
                        className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                          isActive ? 'text-white/90' : 'text-[#6558E8]'
                        }`}
                      >
                        ≥ {band.minGpa.toFixed(2)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="dash-target-gpa"
                  className="block text-xs font-semibold text-[#20243A] mb-1.5"
                >
                  GPA mục tiêu (0.00 – 4.00)
                </label>
                <input
                  id="dash-target-gpa"
                  type="number"
                  min="0"
                  max="4"
                  step="0.01"
                  value={targetGpaStr}
                  onChange={(e) => setTargetGpaStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono font-semibold bg-white border border-[#DCD7FA] rounded-xl focus:outline-none focus:border-[#6558E8]"
                />
                {selectedClassification && (
                  <div className="text-[11px] text-[#6558E8] mt-1 font-medium">
                    Mức xếp loại: {selectedClassification.label}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="dash-planned-credits"
                  className="block text-xs font-semibold text-[#20243A] mb-1.5"
                >
                  Tín chỉ dự kiến (số nguyên)
                </label>
                <input
                  id="dash-planned-credits"
                  type="number"
                  min="1"
                  step="1"
                  value={plannedCreditsStr}
                  onKeyDown={(e) => {
                    if (['.', ',', '-', '+', 'e', 'E'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => setPlannedCreditsStr(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm font-mono font-semibold bg-white border rounded-xl focus:outline-none ${
                    plannedCreditCheck.valid
                      ? 'border-[#DCD7FA] focus:border-[#6558E8]'
                      : 'border-[#EF6472] focus:border-[#EF6472]'
                  }`}
                />
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  {[6, 9, 12, 15, 18].map((cr) => (
                    <button
                      key={cr}
                      type="button"
                      onClick={() => setPlannedCreditsStr(String(cr))}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded-lg border transition-colors ${
                        Number(plannedCreditsStr) === cr
                          ? 'bg-[#6558E8] text-white border-[#6558E8]'
                          : 'bg-white text-[#555C75] border-[#ECEEF5] hover:border-[#8174F7]'
                      }`}
                    >
                      {cr} TC
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!plannedCreditCheck.valid && (
              <div className="p-3 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-xs text-[#C83D4C] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{plannedCreditCheck.error}</span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-white/90 border border-[#E3DFFD] text-xs text-[#555C75] leading-relaxed">
              {plannerResult.errorMessage || plannerResult.explanation}
            </div>
          </div>

          {/* Metrics & Visual Progress & Scenarios Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-[#E3DFFD] p-3.5">
                <div className="text-[11px] font-medium text-[#858BA3]">GPA hiện tại</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#20243A] mt-1">
                  {formatGpa(summary.cgpa)}
                </div>
                <div className="text-[11px] font-mono text-[#858BA3] mt-0.5">
                  {summary.gpaEligibleCredits} TC hợp lệ
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E3DFFD] p-3.5">
                <div className="text-[11px] font-medium text-[#858BA3]">GPA mục tiêu</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#6558E8] mt-1">
                  {Number.isFinite(targetGpaNum) ? targetGpaNum.toFixed(2) : '—'}
                </div>
                <div className="text-[11px] font-mono text-[#858BA3] mt-0.5">
                  Chênh lệch:{' '}
                  {plannerResult.gpaGap !== null
                    ? `${plannerResult.gpaGap >= 0 ? '+' : ''}${plannerResult.gpaGap.toFixed(2)}`
                    : '—'}
                </div>
              </div>

              <div className="bg-[#6558E8] text-white rounded-2xl p-3.5 shadow-sm">
                <div className="text-[11px] font-medium text-white/85">GPA cần đạt sắp tới</div>
                <div className="text-2xl font-bold font-mono tabular-nums mt-1">
                  {plannerResult.valid ? formatGpa(plannerResult.requiredFutureGpa) : '—'}
                </div>
                <div className="text-[11px] font-mono text-white/80 mt-0.5">
                  Trong {plannedCreditCheck.valid ? plannedCreditCheck.value : '—'} tín chỉ
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E3DFFD] p-3.5">
                <div className="text-[11px] font-medium text-[#858BA3]">Trần tối đa có thể</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#238A5E] mt-1">
                  {plannerResult.valid ? formatGpa(plannerResult.maxPossibleCgpa) : '—'}
                </div>
                <div className="text-[11px] font-mono text-[#858BA3] mt-0.5">
                  Nếu đạt 4.00 toàn bộ
                </div>
              </div>
            </div>

            {/* Visual Gap & Progress Gauge */}
            <div className="bg-white rounded-2xl border border-[#E3DFFD] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#20243A] inline-flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[#6558E8]" />
                  <span>Tiến độ chạm mốc GPA mục tiêu</span>
                </span>
                <span className="font-mono font-semibold text-[#6558E8] tabular-nums">
                  {currentCgpaNum.toFixed(2)} → {validTargetForBar.toFixed(2)} ({progressRatio.toFixed(1)}%)
                </span>
              </div>
              <div className="relative h-3.5 w-full rounded-full bg-[#F0EDFF] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#8174F7] to-[#6558E8] transition-all duration-300"
                  style={{ width: `${progressRatio}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-[#858BA3]">
                <span>0.00</span>
                <span>Mốc Khá (2.50)</span>
                <span>Giỏi (3.20)</span>
                <span>Xuất sắc (3.60)</span>
                <span>4.00</span>
              </div>
            </div>

            {/* Scenario Comparison Cards */}
            <div>
              <div className="text-xs font-semibold text-[#555C75] mb-2">
                So sánh nhanh các phương án tín chỉ
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {scenarios.map((sc) => {
                  const isCurrent =
                    plannedCreditCheck.valid && sc.futureCredits === plannedCreditCheck.value;
                  const imp = sc.result.feasibilityStatus === 'impossible';
                  const chal = sc.result.feasibilityStatus === 'challenging';
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setPlannedCreditsStr(String(sc.futureCredits))}
                      className={`text-left p-3.5 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-white border-[#6558E8] ring-2 ring-[#6558E8]/15'
                          : 'bg-white/85 border-[#E3DFFD] hover:border-[#8174F7]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#20243A]">
                          {sc.futureCredits} tín chỉ tới
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            imp
                              ? 'bg-[#EF6472]/12 text-[#C83D4C]'
                              : chal
                                ? 'bg-[#F5AE48]/15 text-[#9A5F0D]'
                                : 'bg-[#36B37E]/12 text-[#1F7A54]'
                          }`}
                        >
                          {imp ? 'Không khả thi' : chal ? 'Thử thách' : 'Khả thi'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-[11px] text-[#858BA3]">Cần TB:</span>
                        <span
                          className={`text-lg font-bold font-mono tabular-nums ${
                            imp ? 'text-[#C83D4C]' : 'text-[#6558E8]'
                          }`}
                        >
                          {formatGpa(sc.result.requiredFutureGpa)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#858BA3] font-mono mt-0.5">
                        Trần: {formatGpa(sc.result.maxPossibleCgpa)}/4.00
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Khu vực A — Tiến trình GPA (1 LineChart) + Khu vực B — Tiến độ tốt nghiệp */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#20243A]">Tiến trình GPA qua các học kỳ</h3>
              <p className="text-xs text-[#858BA3] mt-0.5">{performanceSummaryText}</p>
            </div>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              aria-label="Lọc biểu đồ theo năm học"
              className="px-3 py-1.5 text-xs font-medium bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A] focus:outline-none focus:border-[#8174F7]"
            >
              <option value="ALL">Tất cả năm học</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Năm học {yr}
                </option>
              ))}
            </select>
          </div>

          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-[#858BA3]">
              Chưa có học kỳ hoàn tất điểm trong phạm vi năm học đã chọn.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 16, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#858BA3' }}
                    axisLine={{ stroke: '#ECEEF5' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 4]}
                    ticks={[0, 1, 2, 3, 4]}
                    tick={{ fontSize: 12, fill: '#858BA3' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val, name) => [
                      typeof val === 'number' ? val.toFixed(2) : String(val ?? ''),
                      name === 'semesterGpa' ? 'GPA học kỳ' : 'GPA tích lũy',
                    ]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ''}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #ECEEF5',
                      boxShadow: '0 8px 24px rgba(32, 36, 58, 0.06)',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="semesterGpa"
                    name="semesterGpa"
                    stroke="#8174F7"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#8174F7', strokeWidth: 2, stroke: '#FFFFFF' }}
                    activeDot={{ r: 6, fill: '#6558E8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeGpa"
                    name="cumulativeGpa"
                    stroke="#20243A"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3.5, fill: '#20243A' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="flex items-center gap-5 text-xs text-[#858BA3] pt-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8174F7]" />
              <span>GPA học kỳ</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#20243A]" />
              <span>GPA tích lũy</span>
            </span>
          </div>
        </div>

        {/* Khu vực B — Tiến độ tốt nghiệp */}
        <div className="lg:col-span-4 bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col justify-between space-y-5">
          <div>
            <h3 className="text-base font-bold text-[#20243A]">Tiến độ tốt nghiệp</h3>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Khối lượng tín chỉ đạt chuẩn so với chương trình đào tạo
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-[#6558E8]">
                {summary.completionPercentage.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-[#858BA3] tabular-nums">
                {summary.earnedCredits} / {summary.totalRequiredCredits} tín chỉ
              </span>
            </div>
            <div className="w-full h-3 bg-[#F0EDFF] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8174F7] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, summary.completionPercentage)}%` }}
              />
            </div>
          </div>

          <dl className="space-y-2.5 text-sm border-t border-[#ECEEF5] pt-4">
            <div className="flex items-center justify-between">
              <dt className="text-[#858BA3]">Tín chỉ đã tích lũy</dt>
              <dd className="font-mono font-semibold text-[#238A5E] tabular-nums">
                {summary.earnedCredits} tín chỉ
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[#858BA3]">Tổng tín chỉ yêu cầu</dt>
              <dd className="font-mono font-semibold text-[#20243A] tabular-nums">
                {summary.totalRequiredCredits} tín chỉ
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[#858BA3]">Tín chỉ còn lại</dt>
              <dd className="font-mono font-semibold text-[#6558E8] tabular-nums">
                {summary.remainingCreditsToGraduation} tín chỉ
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => onNavigate('student_progress')}
            className="w-full py-2.5 px-4 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <span>Xem chi tiết</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Khu vực C — Thông báo gần đây (tối đa 3 mục) */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#20243A]">Thông báo gần đây</h3>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Cảnh báo học vụ và nhắc nhở quan trọng mới nhất dành cho bạn
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('student_warnings')}
            className="text-xs font-semibold text-[#6558E8] hover:underline inline-flex items-center gap-1"
          >
            <span>Xem tất cả</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeWarnings.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-[#36B37E]/12 text-[#36B37E] flex items-center justify-center mx-auto mb-2.5">
              <BookCheck className="w-5 h-5" />
            </div>
            <div className="text-sm font-semibold text-[#20243A]">Chưa có thông báo cảnh báo nào</div>
            <p className="text-xs text-[#858BA3] mt-1">
              Kết quả học tập hiện tại của bạn đang đáp ứng tốt quy chế đào tạo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeWarnings.slice(0, 3).map((w) => (
              <div
                key={w.warning_id}
                className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5] flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#20243A]">
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 ${
                          w.severity === 'Critical' ? 'text-[#EF6472]' : 'text-[#F5AE48]'
                        }`}
                      />
                      <span>{w.warning_title}</span>
                    </div>
                    <span
                      className={`text-[11px] font-medium shrink-0 ${
                        w.severity === 'Critical' ? 'text-[#C83D4C]' : 'text-[#B77416]'
                      }`}
                    >
                      {translateSeverity(w.severity)}
                    </span>
                  </div>
                  <p className="text-xs text-[#858BA3] mt-2 line-clamp-2 leading-relaxed">
                    {w.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#858BA3] font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(w.generated_at).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

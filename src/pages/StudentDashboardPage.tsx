import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookCheck,
  ChevronRight,
  Clock,
  GraduationCap,
  TrendingUp,
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
import { formatGpa, translateSeverity } from '../../shared/academicLogic.ts';
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
}: {
  overview: StudentOverviewResponse;
  onNavigate: (route: ActiveRouteKey) => void;
}) {
  const { student, summary, warnings, academicTerms } = overview;
  const activeWarnings = warnings.filter((w) => w.warning_status !== 'Resolved');
  const firstName = student.full_name.trim().split(' ').slice(-1)[0] || student.full_name;
  const [yearFilter, setYearFilter] = useState<string>('ALL');

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

      {/* Đúng 4 thẻ KPI: GPA tích lũy, GPA học kỳ hiện tại, Tín chỉ đã tích lũy, Cảnh báo đang hoạt động */}
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

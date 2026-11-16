import React, { useMemo } from 'react';
import {
  AlertTriangle,
  BookCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  RotateCcw,
  Target,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatGpa } from '../../shared/academicLogic.ts';
import { StudentOverviewResponse } from '../services/api.ts';
import { ActiveRouteKey } from '../components/ShellLayout.tsx';
import { SemanticStatusBadge } from '../components/PortalUI.tsx';

export function AcademicProgressPage({
  overview,
  onNavigate,
}: {
  overview: StudentOverviewResponse;
  onNavigate: (route: ActiveRouteKey) => void;
}) {
  const { student, summary, enrollments } = overview;

  const inProgressCourses = useMemo(
    () => enrollments.filter((e) => e.completion_status === 'In Progress'),
    [enrollments]
  );

  const semesterChartData = useMemo(
    () =>
      summary.semesters.map((s) => ({
        term: `${s.semester.replace('Học kỳ ', 'HK').replace('hè', 'Hè')} (${s.academic_year.slice(2, 4)}-${s.academic_year.slice(7, 9)})`,
        fullLabel: `${s.semester} (${s.academic_year})`,
        earned: s.earnedCredits,
        failed: s.failedCredits,
        cumulativeEarned: s.cumulativeEarnedCredits,
      })),
    [summary.semesters]
  );

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (summary.completionPercentage / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Main Progress Overview Banner */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-8 space-y-5">
          <div>
            <div className="text-xs font-semibold text-[#6558E8] mb-1">
              {student.faculty} · {student.major}
            </div>
            <h2 className="text-xl font-bold text-[#20243A]">
              Tiến độ tích lũy tín chỉ &amp; hoàn thành chương trình
            </h2>
            <p className="text-sm text-[#858BA3] mt-1">
              Số liệu được tính toán trực tiếp từ các học phần đã đạt (không bao gồm học phần chưa đạt, đang học hoặc đã rút).
            </p>
          </div>

          {/* Linear Progress Bar */}
          <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-[#20243A]">
                Đã tích lũy {summary.earnedCredits} / {summary.totalRequiredCredits} tín chỉ chuẩn tốt nghiệp
              </span>
              <span className="font-mono font-bold text-[#6558E8] tabular-nums">
                {summary.completionPercentage.toFixed(2)}%
              </span>
            </div>
            <div className="w-full h-3 bg-[#ECEEF5] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8174F7] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, summary.completionPercentage)}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#858BA3]">
              <span>
                Tín chỉ còn lại cần hoàn thành:{' '}
                <strong className="font-mono text-[#20243A]">
                  {summary.remainingCreditsToGraduation} tín chỉ
                </strong>
              </span>
              <span>
                Đang đăng ký học:{' '}
                <strong className="font-mono text-[#6558E8]">
                  {summary.inProgressCredits} tín chỉ
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('student_history')}
              className="px-4 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl transition-colors"
            >
              Xem lịch sử từng học kỳ
            </button>
            <button
              type="button"
              onClick={() => onNavigate('student_planner')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Lập kế hoạch đạt GPA mục tiêu</span>
            </button>
          </div>
        </div>

        {/* Circular Ring */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-2xl bg-[#F0EDFF]/45 border border-[#8174F7]/20">
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 140 140">
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="12"
              />
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="#8174F7"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-mono tabular-nums text-[#20243A]">
                {summary.completionPercentage.toFixed(2)}%
              </span>
              <span className="text-[11px] text-[#6558E8] font-medium">chương trình</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-[#555C75] text-center">
            GPA tích lũy hiện tại:{' '}
            <strong className="font-mono text-[#20243A]">{formatGpa(summary.cgpa)}</strong>
          </div>
        </div>
      </div>

      {/* 4 Credit & Course Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Học phần đã đạt</span>
            <div className="w-9 h-9 rounded-xl bg-[#36B37E]/12 text-[#36B37E] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
            {summary.completedCoursesCount}
          </div>
          <div className="text-xs text-[#858BA3] mt-2">
            Tương đương <strong className="text-[#238A5E]">{summary.earnedCredits} tín chỉ</strong> tích lũy
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Học phần đang học</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
            {summary.inProgressCoursesCount}
          </div>
          <div className="text-xs text-[#858BA3] mt-2">
            Gồm <strong className="text-[#6558E8]">{summary.inProgressCredits} tín chỉ</strong> chưa tổng kết
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Môn chưa đạt / cần học lại</span>
            <div className="w-9 h-9 rounded-xl bg-[#EF6472]/12 text-[#EF6472] flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
            {summary.failedCoursesCount}
          </div>
          <div className="text-xs text-[#858BA3] mt-2">
            Tổng <strong className="text-[#C83D4C]">{summary.failedCredits} tín chỉ</strong> chưa đạt
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Tín chỉ còn lại</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
            {summary.remainingCreditsToGraduation}
          </div>
          <div className="text-xs text-[#858BA3] mt-2">
            Trên tổng chuẩn <strong className="text-[#20243A]">{summary.totalRequiredCredits} tín chỉ</strong>
          </div>
        </div>
      </div>

      {/* Credit Accumulation Chart */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-[#20243A]">
              Biểu đồ tích lũy tín chỉ qua các học kỳ
            </h3>
            <p className="text-xs text-[#858BA3] mt-0.5">
              So sánh số tín chỉ đạt mới và tín chỉ chưa đạt trong từng học kỳ
            </p>
          </div>
        </div>

        {semesterChartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-[#858BA3]">
            Chưa có học phần nào được ghi nhận để vẽ biểu đồ.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={semesterChartData} margin={{ top: 8, right: 16, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                <XAxis
                  dataKey="term"
                  tick={{ fontSize: 11, fill: '#858BA3' }}
                  axisLine={{ stroke: '#ECEEF5' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#858BA3' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ''}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #ECEEF5',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="earned" name="Tín chỉ đạt" fill="#8174F7" radius={[6, 6, 0, 0]} />
                <Bar dataKey="failed" name="Tín chỉ chưa đạt" fill="#EF6472" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Retake Required & In-Progress Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EF6472]/12 text-[#EF6472] flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#20243A]">Học phần cần học lại</h3>
                <p className="text-xs text-[#858BA3]">Các môn chưa đạt và chưa có kết quả đạt thay thế</p>
              </div>
            </div>
            <SemanticStatusBadge
              tone={summary.retakeRequiredCourses.length > 0 ? 'danger' : 'success'}
              label={
                summary.retakeRequiredCourses.length > 0
                  ? `${summary.retakeRequiredCourses.length} môn`
                  : 'Không có'
              }
            />
          </div>

          {summary.retakeRequiredCourses.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#858BA3]">
              Bạn không có học phần nào cần học lại. Hãy tiếp tục phát huy!
            </div>
          ) : (
            <div className="divide-y divide-[#ECEEF5]">
              {summary.retakeRequiredCourses.map((c) => (
                <div key={c.course_code} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#C83D4C]">
                        {c.course_code}
                      </span>
                      <span className="text-sm font-semibold text-[#20243A]">{c.course_name}</span>
                    </div>
                    <div className="text-xs text-[#858BA3] mt-0.5">
                      {c.credit_hours} tín chỉ · Lần gần nhất: {c.lastSemester} ({c.lastAcademicYear})
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EF6472]/12 text-[#C83D4C] shrink-0">
                    {c.failedAttempts > 1 ? `Trượt ${c.failedAttempts} lần` : 'Chưa đạt'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center">
                <BookCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#20243A]">Học phần đang theo học</h3>
                <p className="text-xs text-[#858BA3]">Chưa tổng kết điểm và chưa cộng vào tín chỉ tích lũy</p>
              </div>
            </div>
            <SemanticStatusBadge tone="info" label={`${inProgressCourses.length} môn`} />
          </div>

          {inProgressCourses.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#858BA3]">
              Hiện không có học phần nào ở trạng thái Đang học.
            </div>
          ) : (
            <div className="divide-y divide-[#ECEEF5]">
              {inProgressCourses.map((c) => (
                <div key={c.enrollment_id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#6558E8]">
                        {c.course_code}
                      </span>
                      <span className="text-sm font-semibold text-[#20243A]">{c.course_name}</span>
                    </div>
                    <div className="text-xs text-[#858BA3] mt-0.5">
                      {c.semester} · {c.academic_year}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#6558E8] shrink-0">
                    {c.credit_hours} tín chỉ
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {summary.failedCredits > 0 && (
        <div className="p-4 rounded-2xl bg-[#F5AE48]/10 border border-[#F5AE48]/30 flex items-start gap-3 text-xs text-[#9A5F0D]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Lưu ý tốt nghiệp:</strong> Các học phần có kết quả chưa đạt không được cộng vào
            tổng tín chỉ tích lũy ({summary.earnedCredits} tín chỉ). Hãy ưu tiên đăng ký học lại ở
            học kỳ tiếp theo hoặc học kỳ hè để hoàn thành đủ {summary.totalRequiredCredits} tín chỉ.
          </div>
        </div>
      )}
    </div>
  );
}

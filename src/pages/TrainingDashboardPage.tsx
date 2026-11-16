import React from 'react';
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Layers,
  UserCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { translateGradeWorkflowStatus } from '../../shared/academicLogic.ts';
import { AdminOverviewResponse } from '../services/api.ts';
import { SemanticStatusBadge, SemanticTone } from '../components/PortalUI.tsx';
import { ActiveRouteKey } from '../components/ShellLayout.tsx';

function approvalTone(status: string): SemanticTone {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'PENDING_APPROVAL':
      return 'info';
    case 'NEEDS_REVISION':
    case 'REJECTED':
      return 'danger';
    default:
      return 'warning';
  }
}

export function TrainingDashboardPage({
  data,
  onNavigate,
  onInspectSubmission,
}: {
  data: AdminOverviewResponse;
  onNavigate: (route: ActiveRouteKey) => void;
  onInspectSubmission: (sectionId: string) => void;
}) {
  const { metrics, charts, submissions, warnings, recentActivities } = data;
  const pendingQueue = submissions.filter((s) => s.status === 'PENDING_APPROVAL');
  const activeWarnings = warnings.filter((w) => w.warning_status !== 'Resolved');
  const criticalWarningsCount = activeWarnings.filter((w) => w.severity === 'Critical').length;

  return (
    <div className="space-y-6">
      {/* Header điều hành Phòng Đào tạo */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-[#6558E8]">
            UniPortal · Hệ thống điều hành Phòng Đào tạo
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#20243A] tracking-tight mt-0.5">
            Tổng quan đào tạo &amp; kiểm soát học vụ
          </h2>
          <p className="text-xs sm:text-sm text-[#858BA3] mt-1">
            Năm học hiện hành: 2025-2026 · Học kỳ 1 · GPA trung bình toàn trường:{' '}
            <strong className="font-mono text-[#20243A]">{metrics.averageCgpa.toFixed(2)}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('td_assignments')}
            className="px-4 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl transition-colors"
          >
            Phân công giảng dạy
          </button>
          <button
            type="button"
            onClick={() => onNavigate('td_approvals')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl transition-colors"
          >
            Duyệt bảng điểm ({metrics.pendingApprovals})
          </button>
        </div>
      </div>

      {/* Đúng 4 thẻ KPI: Tổng sinh viên, Tổng giảng viên, Lớp học phần hoạt động, Bảng điểm chờ duyệt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <button
          type="button"
          onClick={() => onNavigate('td_students')}
          className="text-left bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#8174F7] transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Tổng số sinh viên</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
            {metrics.totalStudents}
          </div>
          <div className="mt-2.5 text-xs text-[#858BA3]">
            {metrics.activeStudents} sinh viên trạng thái bình thường
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('td_lecturers')}
          className="text-left bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#8174F7] transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Tổng số giảng viên</span>
            <div className="w-9 h-9 rounded-xl bg-[#36B37E]/12 text-[#36B37E] flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
            {metrics.totalLecturers}
          </div>
          <div className="mt-2.5 text-xs text-[#858BA3]">
            Đang tham gia giảng dạy các học phần
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('td_sections')}
          className="text-left bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#8174F7] transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Lớp học phần đang hoạt động</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
            {metrics.activeSections}
          </div>
          <div className="mt-2.5 text-xs text-[#858BA3]">
            Trên tổng {metrics.totalCourses} học phần danh mục
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('td_approvals')}
          className="text-left bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#8174F7] transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Bảng điểm chờ duyệt</span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                metrics.pendingApprovals > 0
                  ? 'bg-[#F5AE48]/14 text-[#B77416]'
                  : 'bg-[#36B37E]/12 text-[#36B37E]'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#6558E8]">
            {metrics.pendingApprovals}
          </div>
          <div className="mt-2.5 text-xs font-medium text-[#6558E8] inline-flex items-center gap-1">
            <span>Mở hàng đợi phê duyệt</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Khu vực A — Tổng quan toàn trường (Đúng 2 biểu đồ) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
          <h3 className="text-base font-bold text-[#20243A]">Phân bố GPA toàn trường</h3>
          <p className="text-xs text-[#858BA3] mt-0.5 mb-4">
            Số lượng sinh viên theo các nhóm xếp loại học lực hiện tại
          </p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={charts.gpaDistribution}
                margin={{ top: 8, right: 12, left: -20, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#858BA3' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#858BA3' }} />
                <Tooltip />
                <Bar dataKey="count" name="Sinh viên" fill="#8174F7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
          <h3 className="text-base font-bold text-[#20243A]">Điểm trung bình qua các học kỳ</h3>
          <p className="text-xs text-[#858BA3] mt-0.5 mb-4">
            Xu hướng GPA trung bình toàn trường theo tiến trình học kỳ
          </p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={charts.semesterAverages}
                margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                <XAxis dataKey="semester" tick={{ fontSize: 10, fill: '#858BA3' }} />
                <YAxis
                  domain={[0, 4]}
                  ticks={[0, 1, 2, 3, 4]}
                  tick={{ fontSize: 11, fill: '#858BA3' }}
                />
                <Tooltip
                  formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? ''))}
                />
                <Line
                  type="monotone"
                  dataKey="averageGpa"
                  name="GPA trung bình"
                  stroke="#6558E8"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#6558E8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Khu vực B — Hàng đợi duyệt bảng điểm */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#ECEEF5] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#20243A]">Hàng đợi duyệt bảng điểm</h3>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Các lớp học phần giảng viên đã gửi điểm chờ Phòng Đào tạo xác nhận và công bố chính thức
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('td_approvals')}
            className="text-xs font-semibold text-[#6558E8] hover:underline inline-flex items-center gap-1"
          >
            <span>Xem toàn bộ hàng đợi</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                <th className="py-3 px-5">Học phần</th>
                <th className="py-3 px-5">Giảng viên</th>
                <th className="py-3 px-5">Học kỳ</th>
                <th className="py-3 px-5 text-center">Số SV</th>
                <th className="py-3 px-5">Ngày gửi</th>
                <th className="py-3 px-5">Trạng thái</th>
                <th className="py-3 px-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5]">
              {pendingQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-[#858BA3]">
                    Hiện không có bảng điểm nào đang chờ phê duyệt.
                  </td>
                </tr>
              ) : (
                pendingQueue.slice(0, 5).map((sub) => (
                  <tr key={sub.submission_id} className="hover:bg-[#F8F9FD]/70">
                    <td className="py-3.5 px-5">
                      <div className="font-mono text-xs font-semibold text-[#6558E8]">
                        {sub.section_code} · {sub.course_code}
                      </div>
                      <div className="font-medium text-[#20243A]">{sub.course_name}</div>
                    </td>
                    <td className="py-3.5 px-5 text-[#20243A]">{sub.lecturer_name}</td>
                    <td className="py-3.5 px-5 text-xs text-[#555C75]">
                      {sub.semester} · {sub.academic_year}
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono">{sub.student_count}</td>
                    <td className="py-3.5 px-5 font-mono text-xs text-[#858BA3]">
                      {new Date(sub.submitted_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3.5 px-5">
                      <SemanticStatusBadge
                        tone={approvalTone(sub.status)}
                        label={translateGradeWorkflowStatus(sub.status)}
                      />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => onInspectSubmission(sub.section_id)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl transition-colors"
                      >
                        Xem &amp; Duyệt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Khu vực C — Cảnh báo học vụ + Khu vực D — Hoạt động gần đây (tối đa 3 mục) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#20243A]">Tổng hợp cảnh báo học vụ</h3>
              <AlertTriangle className="w-5 h-5 text-[#F5AE48]" />
            </div>
            <p className="text-xs text-[#858BA3]">
              Tình hình sinh viên có nguy cơ chậm tiến độ hoặc GPA dưới chuẩn quy chế
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5]">
              <div className="text-xs text-[#858BA3]">SV có cảnh báo</div>
              <div className="text-2xl font-bold font-mono text-[#B77416] mt-1">
                {metrics.studentsWithWarnings}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#EF6472]/[0.06] border border-[#EF6472]/20">
              <div className="text-xs text-[#C83D4C]">Mức nghiêm trọng</div>
              <div className="text-2xl font-bold font-mono text-[#C83D4C] mt-1">
                {criticalWarningsCount}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('td_warnings')}
            className="w-full py-2.5 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl transition-colors"
          >
            Quản lý cảnh báo &amp; quy tắc
          </button>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#20243A]">Hoạt động gần đây</h3>
              <button
                type="button"
                onClick={() => onNavigate('td_logs')}
                className="text-xs font-semibold text-[#6558E8] hover:underline"
              >
                Xem nhật ký
              </button>
            </div>
            <div className="divide-y divide-[#ECEEF5]">
              {recentActivities.slice(0, 3).map((act) => (
                <div key={act.activity_id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-[#6558E8] mr-2">
                      [{act.activity_type}]
                    </span>
                    <span className="text-[#20243A]">{act.description}</span>
                  </div>
                  <span className="font-mono text-[#858BA3] shrink-0">
                    {new Date(act.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

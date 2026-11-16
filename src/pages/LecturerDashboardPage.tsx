import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Layers,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { translateGradeWorkflowStatus } from '../../shared/academicLogic.ts';
import { LecturerOverviewResponse } from '../services/api.ts';
import { SemanticStatusBadge, SemanticTone } from '../components/PortalUI.tsx';
import { ActiveRouteKey } from '../components/ShellLayout.tsx';

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

export function LecturerDashboardPage({
  overview,
  onNavigate,
  onOpenSection,
}: {
  overview: LecturerOverviewResponse;
  onNavigate: (route: ActiveRouteKey) => void;
  onOpenSection: (sectionId: string) => void;
}) {
  const { lecturer, metrics, sections, charts, notifications } = overview;

  return (
    <div className="space-y-6">
      {/* Header giảng viên */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-[#6558E8]">
            {lecturer.department} · {lecturer.academic_rank}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#20243A] tracking-tight mt-0.5">
            Chào mừng trở lại, Thầy/Cô!
          </h2>
          <p className="text-xs sm:text-sm text-[#858BA3] mt-1 font-mono">
            {lecturer.full_name} · Mã GV: {lecturer.lecturer_id} · 2025-2026 · Học kỳ 1
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('lecturer_sections')}
            className="px-4 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl transition-colors"
          >
            Tất cả lớp học phần
          </button>
          <button
            type="button"
            onClick={() => onNavigate('lecturer_grading')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl transition-colors"
          >
            Mở bảng nhập điểm
          </button>
        </div>
      </div>

      {/* Đúng 4 thẻ KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#D7D2FC] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Lớp học phần đang phụ trách</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
            {metrics.assignedSectionsCount}
          </div>
          <div className="mt-2.5 text-xs text-[#858BA3]">
            Tổng cộng {metrics.totalSectionsCount} lớp trong hệ thống
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#D7D2FC] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Tổng số sinh viên</span>
            <div className="w-9 h-9 rounded-xl bg-[#36B37E]/12 text-[#36B37E] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#20243A]">
            {metrics.totalStudentsCount}
          </div>
          <div className="mt-2.5 text-xs text-[#858BA3]">
            Thuộc các lớp học phần được phân công
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#D7D2FC] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Lớp chưa hoàn tất nhập điểm</span>
            <div className="w-9 h-9 rounded-xl bg-[#F5AE48]/14 text-[#B77416] flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#B77416]">
            {metrics.incompleteGradingCount}
          </div>
          <div className="mt-2.5 text-xs text-[#858BA3]">
            Cần hoàn tất nhập điểm và gửi duyệt
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5 hover:border-[#D7D2FC] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#858BA3]">Sinh viên chưa đạt</span>
            <div className="w-9 h-9 rounded-xl bg-[#EF6472]/12 text-[#EF6472] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#C83D4C]">
            {metrics.failedStudentsCount}
          </div>
          <div className="mt-2.5 text-xs text-[#858BA3]">
            Lượt ghi nhận điểm dưới ngưỡng đạt
          </div>
        </div>
      </div>

      {/* Khu vực A — Lớp học phần đang giảng dạy */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#20243A]">Lớp học phần đang giảng dạy</h3>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Chọn lớp học phần để mở bảng điểm chi tiết và cập nhật kết quả đánh giá sinh viên
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('lecturer_sections')}
            className="text-xs font-semibold text-[#6558E8] hover:underline inline-flex items-center gap-1"
          >
            <span>Xem toàn bộ ({sections.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {sections.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#858BA3]">
            Hiện chưa có lớp học phần nào được phân công cho Thầy/Cô.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sections.slice(0, 4).map((sec) => (
              <div
                key={sec.section_id}
                className="p-5 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5] hover:border-[#D7D2FC] transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs font-semibold text-[#6558E8]">
                      {sec.course_code} · {sec.section_code}
                    </span>
                    <SemanticStatusBadge
                      tone={gradeStatusTone(sec.grade_status)}
                      label={translateGradeWorkflowStatus(sec.grade_status)}
                    />
                  </div>
                  <h4 className="text-base font-bold text-[#20243A] leading-snug">
                    {sec.course_name}
                  </h4>
                  <div className="text-xs text-[#858BA3]">
                    {sec.semester} · {sec.academic_year} · {sec.enrolled_count} sinh viên
                  </div>
                </div>

                <div className="pt-3 border-t border-[#ECEEF5] flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-[#555C75] tabular-nums">
                    Đã nhập: {sec.graded_count}/{sec.enrolled_count} SV
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenSection(sec.section_id)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl transition-colors"
                  >
                    Quản lý lớp
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Khu vực B — Tình trạng nộp điểm + Khu vực C — Thống kê lớp học (2 biểu đồ) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#20243A]">Tình trạng nộp bảng điểm</h3>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Theo dõi tiến độ nhập điểm, hạn nộp và trạng thái phê duyệt từ Phòng Đào tạo
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                  <th className="py-2.5 px-3">Lớp học phần</th>
                  <th className="py-2.5 px-3 text-center">Đã nhập</th>
                  <th className="py-2.5 px-3">Hạn nộp</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5]">
                {sections.map((sec) => (
                  <tr key={sec.section_id} className="hover:bg-[#F8F9FD]/60">
                    <td className="py-3 px-3">
                      <div className="font-mono text-xs font-semibold text-[#6558E8]">
                        {sec.section_code}
                      </div>
                      <div className="text-xs text-[#20243A] font-medium truncate max-w-[180px]">
                        {sec.course_name}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-xs tabular-nums">
                      {sec.graded_count}/{sec.enrolled_count}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-[#858BA3] whitespace-nowrap">
                      {sec.submission_deadline}
                    </td>
                    <td className="py-3 px-3">
                      <SemanticStatusBadge
                        tone={gradeStatusTone(sec.grade_status)}
                        label={translateGradeWorkflowStatus(sec.grade_status)}
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenSection(sec.section_id)}
                        className="text-xs font-semibold text-[#6558E8] hover:underline"
                      >
                        Mở
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Khu vực C — Thống kê lớp học (2 biểu đồ) */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#20243A]">Phân bố xếp loại điểm</h3>
              <p className="text-xs text-[#858BA3] mt-0.5">
                Phân bổ nhóm điểm chữ tại các lớp giảng dạy
              </p>
            </div>
            <div className="h-52 w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.gradeDistribution}
                  margin={{ top: 8, right: 8, left: -24, bottom: 2 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                  <XAxis dataKey="group" tick={{ fontSize: 11, fill: '#858BA3' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#858BA3' }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Số sinh viên" fill="#8174F7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#20243A]">Tỷ lệ Đạt / Chưa đạt</h3>
              <p className="text-xs text-[#858BA3] mt-0.5">
                Tổng hợp trạng thái kết quả học tập hiện có
              </p>
            </div>
            <div className="h-52 w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.passFailDistribution}
                  margin={{ top: 8, right: 8, left: -24, bottom: 2 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#858BA3' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#858BA3' }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Số lượng" radius={[6, 6, 0, 0]}>
                    {charts.passFailDistribution.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === 'Đạt'
                            ? '#36B37E'
                            : entry.name === 'Chưa đạt'
                              ? '#EF6472'
                              : '#8174F7'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Khu vực D — Thông báo quan trọng (tối đa 3 mục) */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#20243A]">Thông báo quan trọng</h3>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Nhắc nhở hạn nộp điểm và yêu cầu chỉnh sửa bảng điểm từ Phòng Đào tạo
            </p>
          </div>
          <BookOpen className="w-4 h-4 text-[#8174F7]" />
        </div>

        {notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-[#858BA3]">
            Không có thông báo tồn đọng. Tất cả bảng điểm đang đúng tiến độ.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {notifications.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5] flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-[#20243A]">{item.title}</div>
                  <p className="text-xs text-[#858BA3] mt-1.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#ECEEF5]">
                  <span className="font-mono text-[#858BA3]">{item.date}</span>
                  <button
                    type="button"
                    onClick={() => onOpenSection(item.section_id)}
                    className="font-semibold text-[#6558E8] hover:underline"
                  >
                    Xử lý ngay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Layers,
  Mail,
  MapPin,
  Phone,
  Save,
  Search,
  User,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  formatDualGrade,
  translateCompletionStatus,
  translateGradeWorkflowStatus,
} from '../../shared/academicLogic.ts';
import {
  api,
  LecturerOverviewResponse,
  LecturerScopedStudentRow,
} from '../services/api.ts';
import { PageLoadingSkeleton, SemanticStatusBadge, SemanticTone } from '../components/PortalUI.tsx';

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

export function LecturerSectionsListView({
  overview,
  onOpenSection,
}: {
  overview: LecturerOverviewResponse;
  onOpenSection: (sectionId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return overview.sections.filter((s) => {
      if (statusFilter !== 'ALL' && s.grade_status !== statusFilter) return false;
      if (
        q &&
        !s.section_code.toLowerCase().includes(q) &&
        !s.course_code.toLowerCase().includes(q) &&
        !s.course_name.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [overview.sections, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-[#858BA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã lớp, mã hoặc tên học phần..."
            className="w-full pl-10 pr-3 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A]"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="NOT_ENTERED">Chưa nhập điểm</option>
          <option value="IN_PROGRESS">Đang nhập điểm</option>
          <option value="PENDING_APPROVAL">Chờ duyệt</option>
          <option value="NEEDS_REVISION">Cần chỉnh sửa</option>
          <option value="APPROVED">Đã phê duyệt</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-12 text-center">
          <Layers className="w-10 h-10 text-[#8174F7] mx-auto mb-3" />
          <div className="text-base font-bold text-[#20243A]">Không có lớp học phần phù hợp</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((sec) => (
            <div
              key={sec.section_id}
              className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col justify-between gap-4 hover:border-[#D7D2FC] transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-[#6558E8]">
                    {sec.section_code} · {sec.course_code} ({sec.credit_hours} TC)
                  </span>
                  <SemanticStatusBadge
                    tone={gradeStatusTone(sec.grade_status)}
                    label={translateGradeWorkflowStatus(sec.grade_status)}
                  />
                </div>
                <h3 className="text-base font-bold text-[#20243A]">{sec.course_name}</h3>
                <p className="text-xs text-[#858BA3]">
                  {sec.semester} · {sec.academic_year} · {sec.schedule_info}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center py-3 rounded-xl bg-[#F8F9FD] border border-[#ECEEF5]">
                <div>
                  <div className="text-[11px] text-[#858BA3]">Sĩ số</div>
                  <div className="font-mono font-bold text-sm text-[#20243A] tabular-nums">
                    {sec.enrolled_count}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#858BA3]">Đã nhập điểm</div>
                  <div className="font-mono font-bold text-sm text-[#6558E8] tabular-nums">
                    {sec.graded_count}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#858BA3]">Hạn nộp</div>
                  <div className="font-mono font-semibold text-xs text-[#20243A] mt-0.5">
                    {sec.submission_deadline}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onOpenSection(sec.section_id)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl transition-colors"
                >
                  Quản lý &amp; Nhập điểm
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LecturerStudentsView({ overview }: { overview: LecturerOverviewResponse }) {
  const [rows, setRows] = useState<LecturerScopedStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .getLecturerStudents()
      .then((res) => setRows(res.students))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sectionFilter !== 'ALL' && r.section_id !== sectionFilter) return false;
      if (
        q &&
        !r.student_id.toLowerCase().includes(q) &&
        !r.student_name.toLowerCase().includes(q) &&
        !r.course_code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, sectionFilter, search]);

  if (loading) return <PageLoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-[#858BA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm MSSV, họ tên sinh viên..."
            className="w-full pl-10 pr-3 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
          />
        </div>

        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A]"
        >
          <option value="ALL">Tất cả lớp phụ trách ({rows.length} lượt SV)</option>
          {overview.sections.map((s) => (
            <option key={s.section_id} value={s.section_id}>
              {s.section_code} — {s.course_name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                <th className="py-3.5 px-5">MSSV</th>
                <th className="py-3.5 px-5">Họ và tên</th>
                <th className="py-3.5 px-5">Lớp học phần</th>
                <th className="py-3.5 px-5">Ngành / Khóa</th>
                <th className="py-3.5 px-5">Chuyên cần</th>
                <th className="py-3.5 px-5 text-center">Điểm tổng kết</th>
                <th className="py-3.5 px-5">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#858BA3]">
                    Không tìm thấy sinh viên thuộc lớp phụ trách của Thầy/Cô.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.enrollment_id} className="hover:bg-[#F8F9FD]/70">
                    <td className="py-3.5 px-5 font-mono text-xs font-semibold text-[#6558E8]">
                      {r.student_id}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-[#20243A]">{r.student_name}</div>
                      <div className="text-xs text-[#858BA3]">{r.student_email}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-mono text-xs font-semibold text-[#20243A]">
                        {r.section_code}
                      </div>
                      <div className="text-xs text-[#858BA3]">{r.course_name}</div>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-[#555C75]">
                      <div>{r.student_major}</div>
                      <div className="text-[#858BA3]">{r.student_cohort}</div>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-[#555C75]">{r.attendance_status}</td>
                    <td className="py-3.5 px-5 text-center font-mono font-bold text-[#20243A] whitespace-nowrap">
                      {formatDualGrade(r.numeric_grade, r.letter_grade, r.grade_point)}
                    </td>
                    <td className="py-3.5 px-5">
                      <SemanticStatusBadge
                        tone={
                          r.completion_status === 'Completed'
                            ? 'success'
                            : r.completion_status === 'Failed'
                              ? 'danger'
                              : 'info'
                        }
                        label={translateCompletionStatus(r.completion_status)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function LecturerAnalyticsView({ overview }: { overview: LecturerOverviewResponse }) {
  const [selectedId, setSelectedId] = useState<string>('ALL');

  const scopedSections = useMemo(
    () =>
      selectedId === 'ALL'
        ? overview.sections
        : overview.sections.filter((s) => s.section_id === selectedId),
    [overview.sections, selectedId]
  );

  const sectionComparison = useMemo(
    () =>
      scopedSections.map((s) => ({
        name: s.section_code,
        passed: s.passed_count,
        failed: s.failed_count,
        ungraded: s.ungraded_count,
      })),
    [scopedSections]
  );

  const totals = useMemo(() => {
    return scopedSections.reduce(
      (acc, s) => ({
        enrolled: acc.enrolled + s.enrolled_count,
        graded: acc.graded + s.graded_count,
        passed: acc.passed + s.passed_count,
        failed: acc.failed + s.failed_count,
      }),
      { enrolled: 0, graded: 0, passed: 0, failed: 0 }
    );
  }, [scopedSections]);

  const passRate = totals.graded > 0 ? Math.round((totals.passed / totals.graded) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#20243A]">Thống kê kết quả các lớp học phần</h2>
          <p className="text-xs text-[#858BA3]">Chỉ tổng hợp trên các lớp được phân công cho Thầy/Cô</p>
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A]"
        >
          <option value="ALL">Tất cả lớp phụ trách</option>
          {overview.sections.map((s) => (
            <option key={s.section_id} value={s.section_id}>
              {s.section_code} — {s.course_name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5">
          <div className="text-xs text-[#858BA3]">Tổng sinh viên</div>
          <div className="text-2xl font-bold font-mono text-[#20243A] mt-1">{totals.enrolled}</div>
        </div>
        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5">
          <div className="text-xs text-[#858BA3]">Đã có điểm</div>
          <div className="text-2xl font-bold font-mono text-[#6558E8] mt-1">{totals.graded}</div>
        </div>
        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5">
          <div className="text-xs text-[#858BA3]">Tỷ lệ đạt</div>
          <div className="text-2xl font-bold font-mono text-[#238A5E] mt-1">{passRate}%</div>
        </div>
        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5">
          <div className="text-xs text-[#858BA3]">Chưa đạt</div>
          <div className="text-2xl font-bold font-mono text-[#C83D4C] mt-1">{totals.failed}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
          <h3 className="text-sm font-bold text-[#20243A] mb-4">So sánh kết quả theo lớp học phần</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionComparison} margin={{ top: 8, right: 12, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#858BA3' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#858BA3' }} />
                <Tooltip />
                <Bar dataKey="passed" name="Đạt" fill="#36B37E" radius={[6, 6, 0, 0]} />
                <Bar dataKey="failed" name="Chưa đạt" fill="#EF6472" radius={[6, 6, 0, 0]} />
                <Bar dataKey="ungraded" name="Chưa nhập" fill="#8174F7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
          <h3 className="text-sm font-bold text-[#20243A] mb-4">Phổ điểm chữ tổng hợp</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview.charts.gradeDistribution}
                margin={{ top: 8, right: 12, left: -20, bottom: 4 }}
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
      </div>
    </div>
  );
}

export function LecturerHistoryView({
  overview,
  onOpenSection,
}: {
  overview: LecturerOverviewResponse;
  onOpenSection: (sectionId: string) => void;
}) {
  return (
    <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#ECEEF5]">
        <h2 className="text-base font-bold text-[#20243A]">Lịch sử giảng dạy &amp; nộp bảng điểm</h2>
        <p className="text-xs text-[#858BA3] mt-0.5">
          Tổng hợp toàn bộ các lớp học phần đã và đang phụ trách qua các học kỳ
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
              <th className="py-3.5 px-5">Mã lớp</th>
              <th className="py-3.5 px-5">Học phần</th>
              <th className="py-3.5 px-5">Học kỳ &amp; Năm học</th>
              <th className="py-3.5 px-5 text-center">Sĩ số</th>
              <th className="py-3.5 px-5 text-center">Đạt / Chưa đạt</th>
              <th className="py-3.5 px-5">Trạng thái duyệt</th>
              <th className="py-3.5 px-5 text-right">Xem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECEEF5]">
            {overview.sections.map((s) => (
              <tr key={s.section_id} className="hover:bg-[#F8F9FD]/70">
                <td className="py-3.5 px-5 font-mono text-xs font-semibold text-[#6558E8]">
                  {s.section_code}
                </td>
                <td className="py-3.5 px-5">
                  <div className="font-semibold text-[#20243A]">{s.course_name}</div>
                  <div className="text-xs font-mono text-[#858BA3]">{s.course_code}</div>
                </td>
                <td className="py-3.5 px-5 text-xs text-[#555C75]">
                  {s.semester} · {s.academic_year}
                </td>
                <td className="py-3.5 px-5 text-center font-mono">{s.enrolled_count}</td>
                <td className="py-3.5 px-5 text-center font-mono text-xs">
                  <span className="text-[#238A5E] font-semibold">{s.passed_count}</span> /{' '}
                  <span className="text-[#C83D4C] font-semibold">{s.failed_count}</span>
                </td>
                <td className="py-3.5 px-5">
                  <SemanticStatusBadge
                    tone={gradeStatusTone(s.grade_status)}
                    label={translateGradeWorkflowStatus(s.grade_status)}
                  />
                </td>
                <td className="py-3.5 px-5 text-right">
                  <button
                    type="button"
                    onClick={() => onOpenSection(s.section_id)}
                    className="text-xs font-semibold text-[#6558E8] hover:underline"
                  >
                    Chi tiết
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LecturerProfileView({
  overview,
  onReload,
}: {
  overview: LecturerOverviewResponse;
  onReload: () => Promise<void>;
}) {
  const { lecturer } = overview;
  const [phone, setPhone] = useState(lecturer.phone);
  const [officeLocation, setOfficeLocation] = useState(lecturer.office_location);
  const [specialization, setSpecialization] = useState(lecturer.specialization);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      await api.updateLecturerProfile({
        phone: phone.trim(),
        office_location: officeLocation.trim(),
        specialization: specialization.trim(),
      });
      await onReload();
      setSavedMsg('Đã cập nhật thông tin hồ sơ giảng viên.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center">
            <User className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#20243A]">{lecturer.full_name}</h2>
            <p className="text-xs font-mono text-[#6558E8]">{lecturer.lecturer_id}</p>
            <p className="text-xs text-[#858BA3] mt-0.5">
              {lecturer.academic_rank} · {lecturer.department}
            </p>
          </div>
        </div>

        <dl className="space-y-3 text-sm pt-3 border-t border-[#ECEEF5]">
          <div className="flex items-center justify-between">
            <dt className="text-[#858BA3] inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>Email công vụ</span>
            </dt>
            <dd className="font-mono text-xs text-[#20243A]">{lecturer.email}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[#858BA3] inline-flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>Điện thoại</span>
            </dt>
            <dd className="font-mono text-xs text-[#20243A]">{lecturer.phone || '—'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[#858BA3] inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>Phòng làm việc</span>
            </dt>
            <dd className="text-xs text-[#20243A]">{lecturer.office_location || '—'}</dd>
          </div>
        </dl>
      </div>

      <form
        onSubmit={handleSave}
        className="lg:col-span-7 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4"
      >
        <h3 className="text-base font-bold text-[#20243A]">Cập nhật thông tin liên hệ</h3>
        {savedMsg && (
          <div className="p-3 rounded-xl bg-[#36B37E]/10 border border-[#36B37E]/30 text-[#238A5E] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{savedMsg}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#20243A] mb-1.5">Số điện thoại</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#20243A] mb-1.5">Phòng làm việc</label>
            <input
              type="text"
              value={officeLocation}
              onChange={(e) => setOfficeLocation(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-[#ECEEF5] rounded-xl"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#20243A] mb-1.5">
            Chuyên ngành / Hướng nghiên cứu
          </label>
          <input
            type="text"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-[#ECEEF5] rounded-xl"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</span>
        </button>
      </form>
    </div>
  );
}

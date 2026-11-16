import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Edit2,
  Eye,
  GraduationCap,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
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
import { formatGpa, translateStudentAcademicStatus } from '../../shared/academicLogic.ts';
import {
  AdminEnrichedStudent,
  AdminOverviewResponse,
  api,
  CatalogCourse,
  StudentOverviewResponse,
} from '../services/api.ts';
import { ConfirmModal, SemanticStatusBadge } from '../components/PortalUI.tsx';
import { MyCoursesPage } from './MyCoursesPage.tsx';

export function AdminOverviewView({ data }: { data: AdminOverviewResponse }) {
  const { metrics, charts, recentActivities } = data;

  return (
    <div className="space-y-6">
      {/* 6 System Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#858BA3] mb-2">
            <span>Tổng sinh viên</span>
            <Users className="w-4 h-4 text-[#8174F7]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#20243A]">
            {metrics.totalStudents}
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#858BA3] mb-2">
            <span>Đang theo học</span>
            <UserCheck className="w-4 h-4 text-[#36B37E]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#20243A]">
            {metrics.activeStudents}
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#858BA3] mb-2">
            <span>Có cảnh báo</span>
            <AlertTriangle className="w-4 h-4 text-[#F5AE48]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#B77416]">
            {metrics.studentsWithWarnings}
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#858BA3] mb-2">
            <span>GPA dưới ngưỡng</span>
            <AlertTriangle className="w-4 h-4 text-[#EF6472]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#C83D4C]">
            {metrics.studentsWithLowGpa}
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#858BA3] mb-2">
            <span>Học phần danh mục</span>
            <BookOpen className="w-4 h-4 text-[#6558E8]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#20243A]">
            {metrics.totalCourses}
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#858BA3] mb-2">
            <span>GPA trung bình</span>
            <GraduationCap className="w-4 h-4 text-[#8174F7]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#6558E8]">
            {metrics.averageCgpa.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 3 Institutional Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <h2 className="text-sm font-bold text-[#20243A] mb-1">Phân bố GPA sinh viên</h2>
          <p className="text-xs text-[#858BA3] mb-4">Số lượng sinh viên theo nhóm xếp loại học lực</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={charts.gpaDistribution}
                margin={{ top: 8, right: 8, left: -20, bottom: 4 }}
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

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <h2 className="text-sm font-bold text-[#20243A] mb-1">Phân bố cảnh báo học vụ</h2>
          <p className="text-xs text-[#858BA3] mb-4">Cảnh báo đang hiệu lực theo quy tắc</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={charts.warningDistribution}
                margin={{ top: 8, right: 8, left: -20, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#858BA3' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#858BA3' }} />
                <Tooltip />
                <Bar dataKey="count" name="Cảnh báo" fill="#F5AE48" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <h2 className="text-sm font-bold text-[#20243A] mb-1">Điểm trung bình theo học kỳ</h2>
          <p className="text-xs text-[#858BA3] mb-4">GPA trung bình toàn trường qua từng kỳ</p>
          <div className="h-56 w-full">
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

      {/* Recent System Activities */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
        <h2 className="text-base font-bold text-[#20243A] mb-4">Nhật ký hoạt động hệ thống</h2>
        <div className="divide-y divide-[#ECEEF5]">
          {recentActivities.slice(0, 8).map((act) => (
            <div
              key={act.activity_id}
              className="py-3 flex items-center justify-between gap-4 text-sm"
            >
              <div className="min-w-0">
                <span className="font-mono text-xs font-semibold text-[#6558E8] mr-2">
                  [{act.activity_type}]
                </span>
                <span className="text-[#20243A]">{act.description}</span>
              </div>
              <span className="text-xs font-mono text-[#858BA3] shrink-0 tabular-nums">
                {new Date(act.created_at).toLocaleDateString('vi-VN')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminStudentsView({
  data,
  catalog,
  onReload,
}: {
  data: AdminOverviewResponse;
  catalog: CatalogCourse[];
  onReload: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<AdminEnrichedStudent | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<AdminEnrichedStudent | null>(null);
  const [inspectingOverview, setInspectingOverview] = useState<StudentOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    student_id: '',
    full_name: '',
    email: '',
    password: '',
    faculty: 'Khoa Công nghệ Thông tin',
    major: 'Hệ thống thông tin quản lý',
    academic_year: 'Năm thứ 1 · K69',
    enrollment_year: '2025',
    total_required_credits: '130',
    expected_credits_per_semester: '15',
    academic_status: 'Active',
    advisor_name: 'PGS.TS. Trần Đức Minh',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.students.filter((s) => {
      if (statusFilter !== 'ALL' && s.academic_status !== statusFilter) return false;
      if (
        q &&
        !s.full_name.toLowerCase().includes(q) &&
        !s.student_id.toLowerCase().includes(q) &&
        !s.major.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data.students, search, statusFilter]);

  const openAdd = () => {
    setEditingStudent(null);
    setForm({
      student_id: `25${String(Math.floor(100000 + Math.random() * 899999))}`,
      full_name: '',
      email: '',
      password: '',
      faculty: 'Khoa Công nghệ Thông tin',
      major: 'Hệ thống thông tin quản lý',
      academic_year: 'Năm thứ 1 · K69',
      enrollment_year: '2025',
      total_required_credits: '130',
      expected_credits_per_semester: '15',
      academic_status: 'Active',
      advisor_name: 'PGS.TS. Trần Đức Minh',
    });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (s: AdminEnrichedStudent) => {
    setEditingStudent(s);
    setForm({
      student_id: s.student_id,
      full_name: s.full_name,
      email: s.email,
      password: '',
      faculty: s.faculty,
      major: s.major,
      academic_year: s.academic_year,
      enrollment_year: String(s.enrollment_year),
      total_required_credits: String(s.total_required_credits),
      expected_credits_per_semester: String(s.expected_credits_per_semester),
      academic_status: s.academic_status,
      advisor_name: s.advisor_name,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleInspect = async (studentId: string) => {
    const res = await api.getStudentOverview(studentId);
    setInspectingOverview(res);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        enrollment_year: Number(form.enrollment_year),
        total_required_credits: Number(form.total_required_credits),
        expected_credits_per_semester: Number(form.expected_credits_per_semester),
      };
      if (editingStudent) {
        await api.updateStudentAdmin(editingStudent.student_id, payload);
      } else {
        await api.createStudent(payload);
      }
      setModalOpen(false);
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu hồ sơ sinh viên.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStudent) return;
    await api.deleteStudentAdmin(deletingStudent.student_id);
    setDeletingStudent(null);
    await onReload();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#858BA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã sinh viên, họ tên hoặc ngành học..."
              className="w-full pl-10 pr-3 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="Active">Đang học</option>
            <option value="Warning">Cảnh báo học vụ</option>
            <option value="Academic Probation">Cảnh báo mức cao</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm sinh viên</span>
        </button>
      </div>

      <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                <th className="py-3.5 px-5">Mã SV</th>
                <th className="py-3.5 px-5">Họ và tên</th>
                <th className="py-3.5 px-5">Khoa & Ngành học</th>
                <th className="py-3.5 px-5 text-right">GPA</th>
                <th className="py-3.5 px-5 text-right">TC đạt</th>
                <th className="py-3.5 px-5 text-right">TC chưa đạt</th>
                <th className="py-3.5 px-5">Tình trạng</th>
                <th className="py-3.5 px-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5] text-sm">
              {filtered.map((s) => (
                <tr key={s.student_id} className="hover:bg-[#F8F9FD]/70">
                  <td className="py-3.5 px-5 font-mono font-semibold text-[#6558E8] whitespace-nowrap">
                    {s.student_id}
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-[#20243A]">{s.full_name}</div>
                    <div className="text-xs text-[#858BA3]">{s.email}</div>
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="text-[#20243A] font-medium">{s.major}</div>
                    <div className="text-xs text-[#858BA3]">{s.faculty}</div>
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono font-bold tabular-nums text-[#20243A]">
                    {formatGpa(s.cgpa)}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono tabular-nums text-[#36B37E] font-semibold">
                    {s.earnedCredits}/{s.total_required_credits}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono tabular-nums text-[#C83D4C] font-semibold">
                    {s.failedCredits}
                  </td>
                  <td className="py-3.5 px-5">
                    <SemanticStatusBadge
                      tone={
                        s.academic_status === 'Active'
                          ? 'success'
                          : s.academic_status === 'Warning'
                            ? 'warning'
                            : 'danger'
                      }
                      label={translateStudentAcademicStatus(s.academic_status)}
                    />
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleInspect(s.student_id)}
                        className="p-1.5 text-[#858BA3] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-lg"
                        title="Quản lý bảng điểm sinh viên"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="p-1.5 text-[#858BA3] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-lg"
                        title="Chỉnh sửa hồ sơ"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingStudent(s)}
                        className="p-1.5 text-[#858BA3] hover:text-[#C83D4C] hover:bg-[#EF6472]/10 rounded-lg"
                        title="Xóa tài khoản sinh viên"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm / Sửa sinh viên */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#ECEEF5] mb-4">
              <h3 className="text-lg font-bold text-[#20243A]">
                {editingStudent
                  ? `Cập nhật sinh viên (${editingStudent.student_id})`
                  : 'Thêm hồ sơ sinh viên mới'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#858BA3] hover:text-[#20243A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-xs">
                {error}
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Mã sinh viên</label>
                  <input
                    type="text"
                    disabled={Boolean(editingStudent)}
                    value={form.student_id}
                    onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl disabled:bg-[#F8F9FD]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Họ và tên</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                {!editingStudent && (
                  <div>
                    <label className="block text-xs font-medium text-[#20243A] mb-1">
                      Mật khẩu khởi tạo
                    </label>
                    <input
                      type="text"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Để trống để dùng mặc định hệ thống"
                      className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Khoa</label>
                  <input
                    type="text"
                    value={form.faculty}
                    onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Ngành học</label>
                  <input
                    type="text"
                    value={form.major}
                    onChange={(e) => setForm({ ...form, major: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">
                    TC tốt nghiệp
                  </label>
                  <input
                    type="number"
                    value={form.total_required_credits}
                    onChange={(e) => setForm({ ...form, total_required_credits: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">
                    Năm nhập học
                  </label>
                  <input
                    type="number"
                    value={form.enrollment_year}
                    onChange={(e) => setForm({ ...form, enrollment_year: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">
                    Khóa học
                  </label>
                  <input
                    type="text"
                    value={form.academic_year}
                    onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#ECEEF5]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium border border-[#ECEEF5] rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold bg-[#8174F7] hover:bg-[#6558E8] text-white rounded-xl"
                >
                  {saving ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Quản lý bảng điểm sinh viên */}
      {inspectingOverview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-[#F8F9FD] border border-[#ECEEF5] rounded-2xl max-w-5xl w-full p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#ECEEF5] mb-5">
              <div>
                <div className="text-xs font-mono font-semibold text-[#6558E8]">
                  {inspectingOverview.student.student_id} · {inspectingOverview.student.major}
                </div>
                <h3 className="text-lg font-bold text-[#20243A]">
                  {inspectingOverview.student.full_name} — Bảng điểm & Học phần
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingOverview(null)}
                className="p-2 bg-white border border-[#ECEEF5] rounded-xl text-[#858BA3] hover:text-[#20243A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <MyCoursesPage
              overview={inspectingOverview}
              catalog={catalog}
              targetStudentId={inspectingOverview.student.student_id}
              viewMode="table"
              readOnly={false}
              onReload={async () => {
                await onReload();
                await handleInspect(inspectingOverview.student.student_id);
              }}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deletingStudent)}
        title="Xóa tài khoản sinh viên"
        message={
          deletingStudent
            ? `Xóa vĩnh viễn sinh viên ${deletingStudent.full_name} (${deletingStudent.student_id}) cùng toàn bộ kết quả học tập và cảnh báo liên quan?`
            : ''
        }
        confirmLabel="Xóa sinh viên"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeletingStudent(null)}
      />
    </div>
  );
}

export function AdminCoursesView({
  catalog,
  onReload,
}: {
  catalog: CatalogCourse[];
  onReload: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogCourse | null>(null);
  const [deleting, setDeleting] = useState<CatalogCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    course_code: '',
    course_name: '',
    credit_hours: '3',
    department: 'Công nghệ Thông tin',
    description: '',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter(
      (c) =>
        !q ||
        c.course_code.toLowerCase().includes(q) ||
        c.course_name.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      course_code: '',
      course_name: '',
      credit_hours: '3',
      department: 'Công nghệ Thông tin',
      description: '',
    });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (c: CatalogCourse) => {
    setEditing(c);
    setForm({
      course_code: c.course_code,
      course_name: c.course_name,
      credit_hours: String(c.credit_hours),
      department: c.department,
      description: c.description,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        ...form,
        credit_hours: Number(form.credit_hours),
      };
      if (editing) {
        await api.updateCatalogCourse(editing.course_id, payload);
      } else {
        await api.createCatalogCourse(payload);
      }
      setModalOpen(false);
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu học phần.');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.deleteCatalogCourse(deleting.course_id);
      setDeleting(null);
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa học phần.');
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-[#858BA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm trong danh mục học phần..."
            className="w-full pl-10 pr-3 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
          />
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm học phần danh mục</span>
        </button>
      </div>

      {error && !modalOpen && (
        <div className="p-3.5 rounded-2xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                <th className="py-3.5 px-5">Mã HP</th>
                <th className="py-3.5 px-5">Tên học phần</th>
                <th className="py-3.5 px-5">Khoa / Bộ môn</th>
                <th className="py-3.5 px-5 text-right">Số tín chỉ</th>
                <th className="py-3.5 px-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5] text-sm">
              {filtered.map((c) => (
                <tr key={c.course_id} className="hover:bg-[#F8F9FD]/70">
                  <td className="py-3.5 px-5 font-mono font-semibold text-[#6558E8]">
                    {c.course_code}
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-[#20243A]">{c.course_name}</div>
                    {c.description && <div className="text-xs text-[#858BA3]">{c.description}</div>}
                  </td>
                  <td className="py-3.5 px-5 text-[#555C75]">{c.department}</td>
                  <td className="py-3.5 px-5 text-right font-mono tabular-nums">
                    {c.credit_hours}
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="p-1.5 text-[#858BA3] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-lg"
                      title="Chỉnh sửa"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(c)}
                      className="p-1.5 text-[#858BA3] hover:text-[#C83D4C] hover:bg-[#EF6472]/10 rounded-lg"
                      title="Xóa"
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#ECEEF5] mb-4">
              <h3 className="text-lg font-bold text-[#20243A]">
                {editing ? `Chỉnh sửa ${editing.course_code}` : 'Thêm học phần danh mục'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#858BA3]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && (
              <div className="mb-3 p-3 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-xs">
                {error}
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Mã học phần</label>
                  <input
                    type="text"
                    value={form.course_code}
                    onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Số tín chỉ</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={form.credit_hours}
                    onChange={(e) => setForm({ ...form, credit_hours: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#20243A] mb-1">Tên học phần</label>
                <input
                  type="text"
                  value={form.course_name}
                  onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#20243A] mb-1">Khoa / Bộ môn</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#20243A] mb-1">Mô tả ngắn</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#ECEEF5]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-[#8174F7] hover:bg-[#6558E8] text-white rounded-xl"
                >
                  Lưu học phần
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleting)}
        title="Xóa học phần danh mục"
        message={
          deleting
            ? `Bạn có chắc muốn xóa ${deleting.course_code} (${deleting.course_name}) khỏi danh mục đào tạo?`
            : ''
        }
        confirmLabel="Xóa"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

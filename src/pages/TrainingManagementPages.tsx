import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Edit2,
  Eye,
  LockOpen,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  ClassSectionRecord,
  formatDualGrade,
  formatGpa,
  formatTenScale,
  LecturerProfile,
  translateCompletionStatus,
  translateGradeWorkflowStatus,
} from '../../shared/academicLogic.ts';
import {
  AdminOverviewResponse,
  api,
  CatalogCourse,
  SectionDetailResponse,
  StudentOverviewResponse,
} from '../services/api.ts';
import {
  ConfirmModal,
  PageLoadingSkeleton,
  SemanticStatusBadge,
  SemanticTone,
} from '../components/PortalUI.tsx';
import { MyCoursesPage } from './MyCoursesPage.tsx';

function gradeStatusTone(status: string): SemanticTone {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'PENDING_APPROVAL':
      return 'info';
    case 'NEEDS_REVISION':
    case 'REJECTED':
      return 'danger';
    case 'IN_PROGRESS':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function TrainingLecturersView({
  data,
  onReload,
  onToast,
}: {
  data: AdminOverviewResponse;
  onReload: () => Promise<void>;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LecturerProfile | null>(null);
  const [deleting, setDeleting] = useState<LecturerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    lecturer_id: '',
    full_name: '',
    email: '',
    password: '',
    department: 'Khoa Công nghệ Thông tin',
    academic_rank: 'Giảng viên',
    specialization: '',
    phone: '',
    office_location: '',
    status: 'active',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.lecturers.filter(
      (l) =>
        !q ||
        l.lecturer_id.toLowerCase().includes(q) ||
        l.full_name.toLowerCase().includes(q) ||
        l.department.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q)
    );
  }, [data.lecturers, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      lecturer_id: `GV${String(Math.floor(100 + Math.random() * 899))}`,
      full_name: '',
      email: '',
      password: '',
      department: 'Khoa Công nghệ Thông tin',
      academic_rank: 'Giảng viên',
      specialization: '',
      phone: '',
      office_location: '',
      status: 'active',
    });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (l: LecturerProfile) => {
    setEditing(l);
    setForm({
      lecturer_id: l.lecturer_id,
      full_name: l.full_name,
      email: l.email,
      password: '',
      department: l.department,
      academic_rank: l.academic_rank,
      specialization: l.specialization,
      phone: l.phone,
      office_location: l.office_location,
      status: l.status,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editing) {
        await api.updateLecturer(editing.lecturer_id, form);
        onToast(`Đã cập nhật giảng viên ${form.full_name}.`, 'success');
      } else {
        await api.createLecturer(form);
        onToast(`Đã thêm giảng viên ${form.full_name}.`, 'success');
      }
      setModalOpen(false);
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu hồ sơ giảng viên.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.deleteLecturer(deleting.lecturer_id);
      onToast(`Đã xóa giảng viên ${deleting.full_name}.`, 'success');
      setDeleting(null);
      await onReload();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Không thể xóa giảng viên.', 'error');
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
            placeholder="Tìm mã GV, họ tên, khoa..."
            className="w-full pl-10 pr-3 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
          />
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm giảng viên</span>
        </button>
      </div>

      <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                <th className="py-3.5 px-5">Mã GV</th>
                <th className="py-3.5 px-5">Họ và tên</th>
                <th className="py-3.5 px-5">Khoa &amp; Học hàm</th>
                <th className="py-3.5 px-5">Chuyên môn</th>
                <th className="py-3.5 px-5">Trạng thái</th>
                <th className="py-3.5 px-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5]">
              {filtered.map((l) => (
                <tr key={l.lecturer_id} className="hover:bg-[#F8F9FD]/70">
                  <td className="py-3.5 px-5 font-mono text-xs font-semibold text-[#6558E8]">
                    {l.lecturer_id}
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-[#20243A]">{l.full_name}</div>
                    <div className="text-xs text-[#858BA3]">{l.email}</div>
                  </td>
                  <td className="py-3.5 px-5 text-xs text-[#555C75]">
                    <div className="font-medium text-[#20243A]">{l.academic_rank}</div>
                    <div>{l.department}</div>
                  </td>
                  <td className="py-3.5 px-5 text-xs text-[#555C75]">{l.specialization || '—'}</td>
                  <td className="py-3.5 px-5">
                    <SemanticStatusBadge
                      tone={l.status === 'active' ? 'success' : 'neutral'}
                      label={l.status === 'active' ? 'Đang công tác' : 'Tạm ngưng'}
                    />
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(l)}
                      className="p-1.5 text-[#858BA3] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-lg"
                      title="Chỉnh sửa"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(l)}
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
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#ECEEF5] mb-4">
              <h3 className="text-lg font-bold text-[#20243A]">
                {editing ? `Cập nhật giảng viên (${editing.lecturer_id})` : 'Thêm giảng viên mới'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-[#858BA3]">
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
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Mã giảng viên</label>
                  <input
                    type="text"
                    disabled={Boolean(editing)}
                    value={form.lecturer_id}
                    onChange={(e) => setForm({ ...form, lecturer_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl disabled:bg-[#F8F9FD]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                {!editing && (
                  <div>
                    <label className="block text-xs font-medium text-[#20243A] mb-1">
                      Mật khẩu khởi tạo
                    </label>
                    <input
                      type="text"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Để trống để dùng mặc định"
                      className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Khoa / Đơn vị</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Học hàm / Học vị</label>
                  <input
                    type="text"
                    value={form.academic_rank}
                    onChange={(e) => setForm({ ...form, academic_rank: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Chuyên môn</label>
                  <input
                    type="text"
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Phòng làm việc</label>
                  <input
                    type="text"
                    value={form.office_location}
                    onChange={(e) => setForm({ ...form, office_location: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
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
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold bg-[#8174F7] hover:bg-[#6558E8] text-white rounded-xl"
                >
                  {saving ? 'Đang lưu...' : 'Lưu giảng viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleting)}
        title="Xóa giảng viên"
        message={deleting ? `Xóa tài khoản và hồ sơ giảng viên ${deleting.full_name} (${deleting.lecturer_id})?` : ''}
        confirmLabel="Xóa"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

export function TrainingSectionsAndAssignmentsView({
  data,
  catalog,
  mode,
  onReload,
  onToast,
}: {
  data: AdminOverviewResponse;
  catalog: CatalogCourse[];
  mode: 'sections' | 'assignments';
  onReload: () => Promise<void>;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [assigningSection, setAssigningSection] = useState<ClassSectionRecord | null>(null);
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>('');
  const [rosterSectionId, setRosterSectionId] = useState<string | null>(null);
  const [rosterDetail, setRosterDetail] = useState<SectionDetailResponse | null>(null);
  const [enrollStudentId, setEnrollStudentId] = useState<string>(data.students[0]?.student_id ?? '');
  const [deletingSection, setDeletingSection] = useState<ClassSectionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newSection, setNewSection] = useState({
    section_code: '',
    course_id: catalog[0]?.course_id ?? '',
    semester_id: data.academicTerms.semesters[data.academicTerms.semesters.length - 1]?.semester_id ?? '',
    lecturer_id: data.lecturers[0]?.lecturer_id ?? '',
    schedule_info: 'Thứ 3 (Tiết 1-3) · Phòng A204',
    max_students: '60',
    submission_deadline: '2026-01-25',
  });

  useEffect(() => {
    if (!newSection.course_id && catalog.length > 0) {
      setNewSection((p) => ({ ...p, course_id: catalog[0].course_id }));
    }
  }, [catalog, newSection.course_id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.sections.filter(
      (s) =>
        !q ||
        s.section_code.toLowerCase().includes(q) ||
        s.course_code.toLowerCase().includes(q) ||
        s.course_name.toLowerCase().includes(q) ||
        (s.lecturer_name ?? '').toLowerCase().includes(q)
    );
  }, [data.sections, search]);

  const openRoster = async (secId: string) => {
    setRosterSectionId(secId);
    const res = await api.getTrainingSectionSubmission(secId);
    setRosterDetail(res);
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createSection({
        section_code: newSection.section_code.trim().toUpperCase(),
        course_id: newSection.course_id,
        semester_id: newSection.semester_id,
        lecturer_id: newSection.lecturer_id || null,
        schedule_info: newSection.schedule_info,
        max_students: Number(newSection.max_students) || 60,
        submission_deadline: newSection.submission_deadline,
      });
      setCreateOpen(false);
      setNewSection((p) => ({ ...p, section_code: '' }));
      await onReload();
      onToast('Đã tạo lớp học phần mới.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo lớp học phần.');
    }
  };

  const handleAssignLecturer = async () => {
    if (!assigningSection) return;
    try {
      await api.assignLecturerToSection(assigningSection.section_id, selectedLecturerId || null);
      setAssigningSection(null);
      await onReload();
      onToast('Đã cập nhật phân công giảng viên.', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Phân công thất bại.', 'error');
    }
  };

  const handleEnrollStudent = async () => {
    if (!rosterSectionId || !enrollStudentId) return;
    try {
      const updated = await api.enrollStudentInSection(rosterSectionId, enrollStudentId);
      setRosterDetail(updated);
      await onReload();
      onToast('Đã thêm sinh viên vào lớp học phần.', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Không thể ghi danh sinh viên.', 'error');
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    if (!rosterSectionId) return;
    try {
      const updated = await api.removeStudentFromSection(rosterSectionId, enrollmentId);
      setRosterDetail(updated);
      await onReload();
      onToast('Đã xóa sinh viên khỏi lớp học phần.', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Không thể xóa sinh viên.', 'error');
    }
  };

  const handleDeleteSection = async () => {
    if (!deletingSection) return;
    try {
      await api.deleteSection(deletingSection.section_id);
      setDeletingSection(null);
      await onReload();
      onToast('Đã xóa lớp học phần.', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Không thể xóa lớp học phần.', 'error');
      setDeletingSection(null);
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
            placeholder="Tìm mã lớp, học phần hoặc giảng viên..."
            className="w-full pl-10 pr-3 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
          />
        </div>

        {mode === 'sections' && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setCreateOpen(true);
            }}
            className="px-4 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Mở lớp học phần mới</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                <th className="py-3.5 px-5">Mã lớp</th>
                <th className="py-3.5 px-5">Học phần</th>
                <th className="py-3.5 px-5">Học kỳ</th>
                <th className="py-3.5 px-5">Giảng viên phụ trách</th>
                <th className="py-3.5 px-5 text-center">Sĩ số</th>
                <th className="py-3.5 px-5">Trạng thái điểm</th>
                <th className="py-3.5 px-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5]">
              {filtered.map((s) => (
                <tr key={s.section_id} className="hover:bg-[#F8F9FD]/70">
                  <td className="py-3.5 px-5 font-mono text-xs font-semibold text-[#6558E8]">
                    {s.section_code}
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-[#20243A]">{s.course_name}</div>
                    <div className="text-xs font-mono text-[#858BA3]">
                      {s.course_code} · {s.schedule_info}
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-xs text-[#555C75]">
                    {s.semester} · {s.academic_year}
                  </td>
                  <td className="py-3.5 px-5">
                    {s.lecturer_name ? (
                      <div>
                        <div className="font-medium text-[#20243A]">{s.lecturer_name}</div>
                        <div className="text-xs font-mono text-[#858BA3]">{s.lecturer_id}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-[#B77416] font-medium">Chưa phân công</span>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-center font-mono text-xs">
                    {s.enrolled_count}/{s.max_students}
                  </td>
                  <td className="py-3.5 px-5">
                    <SemanticStatusBadge
                      tone={gradeStatusTone(s.grade_status)}
                      label={translateGradeWorkflowStatus(s.grade_status)}
                    />
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningSection(s);
                          setSelectedLecturerId(s.lecturer_id ?? '');
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-lg inline-flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Phân công GV</span>
                      </button>
                      {mode === 'sections' && (
                        <>
                          <button
                            type="button"
                            onClick={() => void openRoster(s.section_id)}
                            className="p-1.5 text-[#858BA3] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-lg"
                            title="Danh sách sinh viên lớp"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingSection(s)}
                            className="p-1.5 text-[#858BA3] hover:text-[#C83D4C] hover:bg-[#EF6472]/10 rounded-lg"
                            title="Xóa lớp học phần"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tạo lớp học phần */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#ECEEF5] mb-4">
              <h3 className="text-lg font-bold text-[#20243A]">Mở lớp học phần mới</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="p-1 text-[#858BA3]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && (
              <div className="mb-3 p-3 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-xs">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateSection} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Mã lớp học phần *</label>
                  <input
                    type="text"
                    required
                    value={newSection.section_code}
                    onChange={(e) => setNewSection({ ...newSection, section_code: e.target.value })}
                    placeholder="VD: INT304-02"
                    className="w-full px-3 py-2 text-sm font-mono uppercase border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Học kỳ *</label>
                  <select
                    value={newSection.semester_id}
                    onChange={(e) => setNewSection({ ...newSection, semester_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl bg-white"
                  >
                    {data.academicTerms.semesters.map((sem) => (
                      <option key={sem.semester_id} value={sem.semester_id}>
                        {sem.semester_name} ({sem.academic_year})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#20243A] mb-1">Học phần *</label>
                <select
                  value={newSection.course_id}
                  onChange={(e) => setNewSection({ ...newSection, course_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl bg-white"
                >
                  {catalog.map((c) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.course_code} — {c.course_name} ({c.credit_hours} TC)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#20243A] mb-1">Giảng viên phụ trách</label>
                <select
                  value={newSection.lecturer_id}
                  onChange={(e) => setNewSection({ ...newSection, lecturer_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl bg-white"
                >
                  <option value="">Chưa phân công</option>
                  {data.lecturers.map((l) => (
                    <option key={l.lecturer_id} value={l.lecturer_id}>
                      {l.lecturer_id} — {l.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Lịch học &amp; Phòng</label>
                  <input
                    type="text"
                    value={newSection.schedule_info}
                    onChange={(e) => setNewSection({ ...newSection, schedule_info: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#20243A] mb-1">Hạn nộp điểm</label>
                  <input
                    type="date"
                    value={newSection.submission_deadline}
                    onChange={(e) =>
                      setNewSection({ ...newSection, submission_deadline: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-[#ECEEF5] rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#ECEEF5]">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 text-sm border border-[#ECEEF5] rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-[#8174F7] hover:bg-[#6558E8] text-white rounded-xl"
                >
                  Tạo lớp học phần
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal phân công giảng viên */}
      {assigningSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#20243A]">
              Phân công giảng viên — {assigningSection.section_code}
            </h3>
            <p className="text-xs text-[#858BA3]">
              {assigningSection.course_code} · {assigningSection.course_name}
            </p>
            <select
              value={selectedLecturerId}
              onChange={(e) => setSelectedLecturerId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-[#ECEEF5] rounded-xl bg-white"
            >
              <option value="">-- Gỡ phân công --</option>
              {data.lecturers.map((l) => (
                <option key={l.lecturer_id} value={l.lecturer_id}>
                  {l.lecturer_id} — {l.full_name} ({l.department})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAssigningSection(null)}
                className="px-4 py-2 text-xs border border-[#ECEEF5] rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => void handleAssignLecturer()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl"
              >
                Lưu phân công
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal danh sách sinh viên trong lớp học phần */}
      {rosterSectionId && rosterDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-3xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#ECEEF5]">
              <div>
                <div className="text-xs font-mono font-semibold text-[#6558E8]">
                  {rosterDetail.section.section_code} · {rosterDetail.section.course_code}
                </div>
                <h3 className="text-base font-bold text-[#20243A]">
                  Danh sách sinh viên lớp {rosterDetail.section.course_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRosterSectionId(null);
                  setRosterDetail(null);
                }}
                className="p-1 text-[#858BA3]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={enrollStudentId}
                onChange={(e) => setEnrollStudentId(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-[#ECEEF5] rounded-xl bg-white"
              >
                {data.students.map((st) => (
                  <option key={st.student_id} value={st.student_id}>
                    {st.student_id} — {st.full_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleEnrollStudent()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl"
              >
                Ghi danh vào lớp
              </button>
            </div>

            <div className="border border-[#ECEEF5] rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                    <th className="py-2.5 px-4">MSSV</th>
                    <th className="py-2.5 px-4">Họ và tên</th>
                    <th className="py-2.5 px-4 text-center">Tổng kết</th>
                    <th className="py-2.5 px-4">Trạng thái</th>
                    <th className="py-2.5 px-4 text-right">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEEF5]">
                  {rosterDetail.enrollments.map((e) => (
                    <tr key={e.enrollment_id}>
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold text-[#6558E8]">
                        {e.student_id}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-[#20243A]">
                        {e.student_name ?? e.student_id}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono text-xs">
                        {formatDualGrade(e.numeric_grade, e.letter_grade, e.grade_point)}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {translateCompletionStatus(e.completion_status)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => void handleRemoveEnrollment(e.enrollment_id)}
                          className="p-1 text-[#858BA3] hover:text-[#C83D4C]"
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
        </div>
      )}

      <ConfirmModal
        open={Boolean(deletingSection)}
        title="Xóa lớp học phần"
        message={
          deletingSection
            ? `Xóa lớp học phần ${deletingSection.section_code} (${deletingSection.course_name})?`
            : ''
        }
        confirmLabel="Xóa"
        danger
        onConfirm={() => void handleDeleteSection()}
        onCancel={() => setDeletingSection(null)}
      />
    </div>
  );
}

export function TrainingGradeApprovalsView({
  data,
  selectedSectionId,
  onSelectSection,
  onReload,
  onToast,
}: {
  data: AdminOverviewResponse;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string | null) => void;
  onReload: () => Promise<void>;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const [tab, setTab] = useState<'PENDING' | 'ALL' | 'HISTORY'>('PENDING');
  const [detail, setDetail] = useState<SectionDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionModal, setActionModal] = useState<'approve' | 'return' | 'reject' | 'reopen' | null>(
    null
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSectionId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    api
      .getTrainingSectionSubmission(selectedSectionId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : 'Không thể tải bảng điểm.'))
      .finally(() => setLoadingDetail(false));
  }, [selectedSectionId]);

  const sectionsList = useMemo(() => {
    if (tab === 'PENDING') {
      return data.sections.filter((s) => s.grade_status === 'PENDING_APPROVAL');
    }
    return data.sections;
  }, [data.sections, tab]);

  const executeDecision = async () => {
    if (!detail || !actionModal) return;
    if ((actionModal === 'return' || actionModal === 'reject') && !reason.trim()) {
      setError('Vui lòng nhập lý do gửi lại giảng viên.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (actionModal === 'approve') {
        const res = await api.approveSectionGrades(detail.section.section_id, reason.trim());
        setDetail(res.detail);
        onToast('Đã phê duyệt và công bố bảng điểm chính thức cho sinh viên.', 'success');
      } else if (actionModal === 'return') {
        const res = await api.returnSectionGrades(detail.section.section_id, reason.trim());
        setDetail(res.detail);
        onToast('Đã trả bảng điểm về cho giảng viên chỉnh sửa.', 'info');
      } else if (actionModal === 'reject') {
        const res = await api.rejectSectionGrades(detail.section.section_id, reason.trim());
        setDetail(res.detail);
        onToast('Đã từ chối bảng điểm và yêu cầu giảng viên nhập lại.', 'info');
      } else {
        const res = await api.reopenSectionGrades(detail.section.section_id, reason.trim());
        setDetail(res.detail);
        onToast('Đã mở khóa bảng điểm để giảng viên cập nhật lại.', 'info');
      }
      setActionModal(null);
      setReason('');
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xử lý phê duyệt bảng điểm.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#ECEEF5] rounded-2xl">
          <button
            type="button"
            onClick={() => setTab('PENDING')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              tab === 'PENDING' ? 'bg-[#8174F7] text-white' : 'text-[#555C75] hover:text-[#20243A]'
            }`}
          >
            Chờ duyệt ({data.metrics.pendingApprovals})
          </button>
          <button
            type="button"
            onClick={() => setTab('ALL')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              tab === 'ALL' ? 'bg-[#8174F7] text-white' : 'text-[#555C75] hover:text-[#20243A]'
            }`}
          >
            Tất cả bảng điểm ({data.sections.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('HISTORY')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              tab === 'HISTORY' ? 'bg-[#8174F7] text-white' : 'text-[#555C75] hover:text-[#20243A]'
            }`}
          >
            Lịch sử phê duyệt ({data.approvalHistory.length})
          </button>
        </div>
      </div>

      {tab === 'HISTORY' ? (
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                  <th className="py-3.5 px-5">Lớp học phần</th>
                  <th className="py-3.5 px-5">Quyết định</th>
                  <th className="py-3.5 px-5">Người duyệt</th>
                  <th className="py-3.5 px-5">Lý do / Ghi chú</th>
                  <th className="py-3.5 px-5 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5]">
                {data.approvalHistory.map((h) => (
                  <tr key={h.approval_id} className="hover:bg-[#F8F9FD]/60">
                    <td className="py-3.5 px-5">
                      <div className="font-mono text-xs font-semibold text-[#6558E8]">
                        {h.section_code} · {h.course_code}
                      </div>
                      <div className="text-xs text-[#20243A]">{h.course_name}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <SemanticStatusBadge
                        tone={
                          h.decision === 'APPROVED'
                            ? 'success'
                            : h.decision === 'REOPENED'
                              ? 'info'
                              : 'danger'
                        }
                        label={
                          h.decision === 'APPROVED'
                            ? 'Đã phê duyệt'
                            : h.decision === 'RETURNED_FOR_REVISION'
                              ? 'Trả chỉnh sửa'
                              : h.decision === 'REJECTED'
                                ? 'Từ chối'
                                : 'Mở khóa lại'
                        }
                      />
                    </td>
                    <td className="py-3.5 px-5 text-xs text-[#20243A]">{h.reviewer_name}</td>
                    <td className="py-3.5 px-5 text-xs text-[#555C75]">{h.reason || '—'}</td>
                    <td className="py-3.5 px-5 text-right font-mono text-xs text-[#858BA3]">
                      {new Date(h.reviewed_at).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                  <th className="py-3.5 px-5">Lớp học phần</th>
                  <th className="py-3.5 px-5">Giảng viên</th>
                  <th className="py-3.5 px-5">Học kỳ</th>
                  <th className="py-3.5 px-5 text-center">Đã nhập</th>
                  <th className="py-3.5 px-5">Trạng thái</th>
                  <th className="py-3.5 px-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5]">
                {sectionsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-[#858BA3]">
                      Không có bảng điểm nào trong mục này.
                    </td>
                  </tr>
                ) : (
                  sectionsList.map((s) => (
                    <tr key={s.section_id} className="hover:bg-[#F8F9FD]/70">
                      <td className="py-3.5 px-5">
                        <div className="font-mono text-xs font-semibold text-[#6558E8]">
                          {s.section_code} · {s.course_code}
                        </div>
                        <div className="font-medium text-[#20243A]">{s.course_name}</div>
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[#20243A]">
                        {s.lecturer_name || 'Chưa phân công'}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[#555C75]">
                        {s.semester} · {s.academic_year}
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono text-xs">
                        {s.graded_count}/{s.enrolled_count}
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
                          onClick={() => onSelectSection(s.section_id)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Kiểm tra bảng điểm</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal kiểm tra & phê duyệt chi tiết */}
      {selectedSectionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/45 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-5xl w-full p-6 shadow-xl max-h-[92vh] overflow-y-auto space-y-5">
            {loadingDetail || !detail ? (
              <PageLoadingSkeleton />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#ECEEF5]">
                  <div>
                    <div className="text-xs font-mono font-semibold text-[#6558E8]">
                      {detail.section.section_code} · {detail.section.course_code} ·{' '}
                      {detail.section.credit_hours} tín chỉ
                    </div>
                    <h3 className="text-lg font-bold text-[#20243A] mt-0.5">
                      {detail.section.course_name}
                    </h3>
                    <p className="text-xs text-[#858BA3] mt-1">
                      Giảng viên: {detail.section.lecturer_name || 'Chưa phân công'} ·{' '}
                      {detail.section.semester} · {detail.section.academic_year}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <SemanticStatusBadge
                      tone={gradeStatusTone(detail.section.grade_status)}
                      label={translateGradeWorkflowStatus(detail.section.grade_status)}
                    />
                    <button
                      type="button"
                      onClick={() => onSelectSection(null)}
                      className="p-1.5 text-[#858BA3] hover:text-[#20243A]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-xs">
                    {error}
                  </div>
                )}

                <div className="overflow-x-auto border border-[#ECEEF5] rounded-2xl">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                        <th className="py-2.5 px-4">MSSV</th>
                        <th className="py-2.5 px-4">Họ và tên</th>
                        <th className="py-2.5 px-4 text-center">CC</th>
                        <th className="py-2.5 px-4 text-center">BT</th>
                        <th className="py-2.5 px-4 text-center">GK</th>
                        <th className="py-2.5 px-4 text-center">CK</th>
                        <th className="py-2.5 px-4 text-right">Tổng kết (Hệ 10)</th>
                        <th className="py-2.5 px-4 text-center">Điểm chữ · Hệ 4</th>
                        <th className="py-2.5 px-4">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEEF5]">
                      {detail.enrollments.map((e) => (
                        <tr key={e.enrollment_id}>
                          <td className="py-2.5 px-4 font-mono text-xs font-semibold text-[#6558E8]">
                            {e.student_id}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-[#20243A]">
                            {e.student_name ?? e.student_id}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-xs">
                            {e.attendance_score ?? '—'}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-xs">
                            {e.assignment_score ?? '—'}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-xs">
                            {e.midterm_score ?? '—'}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-xs">
                            {e.final_score ?? '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            {formatTenScale(e.numeric_grade)}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-[#6558E8] whitespace-nowrap">
                            {e.letter_grade
                              ? `${e.letter_grade}${e.grade_point !== null ? ` / ${e.grade_point.toFixed(1)}` : ''}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-xs">
                            {translateCompletionStatus(e.completion_status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Nút xử lý phê duyệt */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#ECEEF5]">
                  <div className="text-xs text-[#858BA3]">
                    {detail.submissions[0]?.note
                      ? `Ghi chú giảng viên: "${detail.submissions[0].note}"`
                      : 'Phòng Đào tạo kiểm tra đầy đủ cột điểm trước khi công bố chính thức.'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {detail.section.grade_status === 'APPROVED' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActionModal('reopen');
                          setReason('');
                        }}
                        className="px-4 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl inline-flex items-center gap-1.5"
                      >
                        <LockOpen className="w-3.5 h-3.5" />
                        <span>Mở khóa chỉnh sửa lại</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setActionModal('return');
                            setReason('');
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-[#B77416] bg-[#F5AE48]/14 hover:bg-[#F5AE48]/25 rounded-xl inline-flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Trả chỉnh sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionModal('reject');
                            setReason('');
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-[#C83D4C] bg-[#EF6472]/12 hover:bg-[#EF6472]/20 rounded-xl inline-flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Từ chối</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionModal('approve');
                            setReason('');
                          }}
                          className="px-4 py-2 text-xs font-semibold text-white bg-[#36B37E] hover:bg-[#2b9a6b] rounded-xl inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Phê duyệt &amp; Công bố điểm</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal nhập lý do phê duyệt / trả chỉnh sửa / từ chối / mở khóa */}
      {actionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#20243A]/50 p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-[#20243A]">
              {actionModal === 'approve'
                ? 'Xác nhận phê duyệt bảng điểm'
                : actionModal === 'return'
                  ? 'Trả bảng điểm để giảng viên chỉnh sửa'
                  : actionModal === 'reject'
                    ? 'Từ chối bảng điểm'
                    : 'Mở khóa bảng điểm đã duyệt'}
            </h4>
            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                {actionModal === 'return' || actionModal === 'reject'
                  ? 'Lý do bắt buộc *'
                  : 'Ghi chú (không bắt buộc)'}
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập nhận xét hoặc lý do gửi giảng viên..."
                className="w-full px-3.5 py-2 text-sm border border-[#ECEEF5] rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="px-4 py-2 text-xs border border-[#ECEEF5] rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void executeDecision()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl"
              >
                {busy ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TrainingResultsExplorerView({
  data,
  catalog,
  onReload,
}: {
  data: AdminOverviewResponse;
  catalog: CatalogCourse[];
  onReload: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(data.students[0]?.student_id ?? '');
  const [overview, setOverview] = useState<StudentOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOverview = async (sid: string) => {
    if (!sid) return;
    setLoading(true);
    try {
      const res = await api.getStudentOverview(sid);
      setOverview(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) void fetchOverview(selectedId);
  }, [selectedId]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#20243A]">Tra cứu &amp; Quản lý kết quả học tập</h2>
          <p className="text-xs text-[#858BA3] mt-0.5">
            Chọn sinh viên để kiểm tra toàn bộ bảng điểm chính thức, điểm thành phần và cập nhật khi cần
          </p>
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="px-4 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl min-w-[280px]"
        >
          {data.students.map((s) => (
            <option key={s.student_id} value={s.student_id}>
              {s.full_name} ({s.student_id}) — GPA {formatGpa(s.cgpa)}
            </option>
          ))}
        </select>
      </div>

      {loading || !overview ? (
        <PageLoadingSkeleton />
      ) : (
        <MyCoursesPage
          overview={overview}
          catalog={catalog}
          targetStudentId={overview.student.student_id}
          viewMode="table"
          readOnly={false}
          onReload={async () => {
            await onReload();
            await fetchOverview(overview.student.student_id);
          }}
        />
      )}
    </div>
  );
}

export function TrainingActivityLogsView({ data }: { data: AdminOverviewResponse }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.recentActivities.filter(
      (a) =>
        !q ||
        a.activity_type.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.student_id ?? '').toLowerCase().includes(q)
    );
  }, [data.recentActivities, search]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#858BA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm loại sự kiện, MSSV hoặc nội dung nhật ký..."
            className="w-full pl-10 pr-3 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl"
          />
        </div>
        <span className="text-xs font-mono text-[#858BA3]">{filtered.length} bản ghi</span>
      </div>

      <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                <th className="py-3 px-5">Loại hoạt động</th>
                <th className="py-3 px-5">Nội dung</th>
                <th className="py-3 px-5">Đối tượng</th>
                <th className="py-3 px-5 text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5]">
              {filtered.map((act) => (
                <tr key={act.activity_id} className="hover:bg-[#F8F9FD]/60">
                  <td className="py-3 px-5 font-mono text-xs font-semibold text-[#6558E8]">
                    {act.activity_type}
                  </td>
                  <td className="py-3 px-5 text-[#20243A]">{act.description}</td>
                  <td className="py-3 px-5 font-mono text-xs text-[#555C75]">
                    {act.student_id || 'Hệ thống'}
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-xs text-[#858BA3] whitespace-nowrap">
                    {new Date(act.created_at).toLocaleString('vi-VN')}
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

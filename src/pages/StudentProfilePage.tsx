import React, { useState } from 'react';
import { CheckCircle2, Lock, Save } from 'lucide-react';
import { translateStudentAcademicStatus } from '../../shared/academicLogic.ts';
import { api, StudentOverviewResponse } from '../services/api.ts';
import { SemanticStatusBadge, UserAvatar } from '../components/PortalUI.tsx';

export function StudentProfilePage({
  overview,
  onReload,
}: {
  overview: StudentOverviewResponse;
  onReload: () => Promise<void>;
}) {
  const { student, summary } = overview;
  const [email, setEmail] = useState(student.email);
  const [phone, setPhone] = useState(student.phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setSaving(true);
    try {
      await api.updateStudentProfile(student.student_id, {
        email: email.trim(),
        phone: phone.trim(),
      });
      await onReload();
      setSavedMsg('Đã lưu thông tin liên hệ cá nhân.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Hồ sơ sinh viên từ Nhà trường */}
      <div className="lg:col-span-5 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-[#ECEEF5]">
          <UserAvatar src={student.avatar_url} name={student.full_name} className="w-16 h-16" />
          <div>
            <h2 className="text-lg font-bold text-[#20243A]">{student.full_name}</h2>
            <div className="text-sm font-mono text-[#6558E8] font-semibold">
              MSSV: {student.student_id}
            </div>
            <div className="mt-2">
              <SemanticStatusBadge
                tone={
                  student.academic_status === 'Active'
                    ? 'success'
                    : student.academic_status === 'Warning'
                      ? 'warning'
                      : 'danger'
                }
                label={translateStudentAcademicStatus(student.academic_status)}
              />
            </div>
          </div>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4 py-1.5 border-b border-[#ECEEF5]">
            <dt className="text-[#858BA3]">Khoa</dt>
            <dd className="font-medium text-[#20243A] text-right">{student.faculty}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5 border-b border-[#ECEEF5]">
            <dt className="text-[#858BA3]">Ngành học</dt>
            <dd className="font-medium text-[#20243A] text-right">{student.major}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5 border-b border-[#ECEEF5]">
            <dt className="text-[#858BA3]">Khóa / Niên khóa</dt>
            <dd className="font-medium text-[#20243A]">{student.academic_year}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5 border-b border-[#ECEEF5]">
            <dt className="text-[#858BA3]">Năm nhập học</dt>
            <dd className="font-mono text-[#20243A]">{student.enrollment_year}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5 border-b border-[#ECEEF5]">
            <dt className="text-[#858BA3]">Tổng tín chỉ yêu cầu</dt>
            <dd className="font-mono font-semibold text-[#20243A]">
              {student.total_required_credits} tín chỉ
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5 border-b border-[#ECEEF5]">
            <dt className="text-[#858BA3]">Cố vấn học tập</dt>
            <dd className="font-medium text-[#20243A] text-right">{student.advisor_name}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-[#858BA3]">GPA tích lũy hiện tại</dt>
            <dd className="font-mono font-bold text-[#6558E8]">
              {summary.cgpa !== null ? summary.cgpa.toFixed(2) : '—'}
            </dd>
          </div>
        </dl>

        <div className="text-xs text-[#555C75] bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl p-3.5 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-[#8174F7] shrink-0 mt-0.5" />
          <span>
            Mã sinh viên, Khoa, Ngành học, Năm nhập học và Trạng thái học vụ do Phòng Đào tạo quản lý.
          </span>
        </div>
      </div>

      {/* Chỉnh sửa thông tin liên hệ cá nhân */}
      <form
        onSubmit={handleSave}
        className="lg:col-span-7 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-5"
      >
        <div className="pb-4 border-b border-[#ECEEF5]">
          <h2 className="text-base font-bold text-[#20243A]">Thông tin liên hệ cá nhân</h2>
          <p className="text-xs text-[#858BA3] mt-0.5">
            Cập nhật email và số điện thoại liên hệ của bạn. Thay đổi được lưu đồng bộ trong hệ thống.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-sm">
            {error}
          </div>
        )}
        {savedMsg && (
          <div className="p-3.5 rounded-xl bg-[#36B37E]/10 border border-[#36B37E]/30 text-[#238A5E] text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{savedMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#858BA3] mb-1.5">
              Mã sinh viên (Cố định)
            </label>
            <input
              type="text"
              value={student.student_id}
              disabled
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#858BA3]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#858BA3] mb-1.5">
              Họ và tên (Theo hồ sơ gốc)
            </label>
            <input
              type="text"
              value={student.full_name}
              disabled
              className="w-full px-3.5 py-2.5 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#858BA3]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="prof-email" className="block text-xs font-medium text-[#20243A] mb-1.5">
            Email liên hệ *
          </label>
          <input
            id="prof-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
          />
        </div>

        <div>
          <label htmlFor="prof-phone" className="block text-xs font-medium text-[#20243A] mb-1.5">
            Số điện thoại
          </label>
          <input
            id="prof-phone"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="VD: 0912 345 678"
            className="w-full px-3.5 py-2.5 text-sm border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
          />
        </div>

        <div className="pt-4 border-t border-[#ECEEF5] flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : 'Lưu thông tin cá nhân'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

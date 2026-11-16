import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { AcademicSettingsBundle } from '../../shared/academicLogic.ts';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';

function repeatPolicyLabel(policy: string): string {
  if (policy === 'replace_highest') return 'Lấy điểm cao nhất trong các lần học';
  if (policy === 'replace_latest') return 'Lấy điểm lần học gần nhất';
  return 'Tính tất cả các lần học vào GPA';
}

export function StudentSettingsPage({ settings }: { settings: AcademicSettingsBundle }) {
  const { student } = useAuth();
  const [rbacResult, setRbacResult] = useState<string | null>(null);

  const handleTestUnauthorizedAccess = async () => {
    const otherId = student?.student_id === '22000001' ? '22000002' : '22000001';
    try {
      await api.getStudentOverview(otherId);
      setRbacResult('Cảnh báo: Quyền truy cập không mong muốn đã được cho phép.');
    } catch (err) {
      setRbacResult(
        `Máy chủ đã từ chối truy cập (HTTP 403) với mã sinh viên ${otherId}: "${
          err instanceof Error ? err.message : 'Từ chối truy cập'
        }"`
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#20243A]">
              Thang điểm quy đổi hệ 4.0 đang áp dụng
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#F0EDFF] text-[#6558E8] font-medium">
              Cấu hình bởi Nhà trường
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                  <th className="py-2.5 px-3">Điểm chữ</th>
                  <th className="py-2.5 px-3 text-right">Điểm hệ 4</th>
                  <th className="py-2.5 px-3 text-right">Thang 100</th>
                  <th className="py-2.5 px-3 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5]">
                {settings.gradingScale.map((g) => (
                  <tr key={g.letter}>
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#6558E8]">
                      {g.letter}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#20243A]">
                      {g.point.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-[#858BA3] tabular-nums">
                      {g.minNumeric}–{g.maxNumeric}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs font-medium">
                      <span className={g.passing ? 'text-[#238A5E]' : 'text-[#C83D4C]'}>
                        {g.passing ? 'Đạt' : 'Chưa đạt'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
            <h2 className="text-base font-bold text-[#20243A] mb-4">
              Quy chế tính điểm & Tốt nghiệp
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 py-2 border-b border-[#ECEEF5]">
                <dt className="text-[#858BA3]">Quy chế học lại / cải thiện</dt>
                <dd className="font-semibold text-[#20243A] text-right">
                  {repeatPolicyLabel(settings.gpaPolicy.repeatPolicy)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2 border-b border-[#ECEEF5]">
                <dt className="text-[#858BA3]">Học phần điểm F trong GPA</dt>
                <dd className="font-semibold text-[#20243A]">
                  {settings.gpaPolicy.failedCourseInGpa ? 'Có tính (0.00)' : 'Không tính'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-[#858BA3]">Số tín chỉ chuẩn toàn khóa</dt>
                <dd className="font-mono font-semibold text-[#6558E8]">
                  {settings.gpaPolicy.defaultRequiredCredits} tín chỉ
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-3.5">
            <div className="flex items-center gap-2.5 text-[#20243A] font-bold text-base">
              <div className="w-8 h-8 rounded-xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span>Bảo mật & Phân quyền dữ liệu</span>
            </div>
            <p className="text-xs text-[#555C75] leading-relaxed">
              Mọi yêu cầu API đều được kiểm tra quyền truy cập tại máy chủ. Tài khoản sinh viên chỉ được phép xem và chỉnh sửa hồ sơ học tập của chính mình ({student?.student_id}).
            </p>
            <button
              type="button"
              onClick={() => void handleTestUnauthorizedAccess()}
              className="px-4 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kiểm tra bảo vệ dữ liệu chéo giữa sinh viên</span>
            </button>
            {rbacResult && (
              <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#ECEEF5] text-xs font-mono text-[#20243A]">
                {rbacResult}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

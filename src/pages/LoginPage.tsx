import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  Mail,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getRememberedIdentifier } from '../services/api.ts';
import {
  AcademicIllustration,
  LOGIN_ABSTRACT_IMG,
  UniPortalLogo,
} from '../components/PortalUI.tsx';

export function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState(() => getRememberedIdentifier());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim()) {
      setError('Vui lòng nhập email hoặc mã định danh (SV / GV).');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu đăng nhập.');
      return;
    }
    setSubmitting(true);
    try {
      await login(identifier.trim(), password, rememberMe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto bg-white border border-[#ECEEF5] rounded-[20px] overflow-hidden shadow-xs grid grid-cols-1 lg:grid-cols-12">
        {/* Bên trái: Soft Lavender Brand & Illustration */}
        <div className="lg:col-span-6 bg-[#F0EDFF] p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#ECEEF5]">
          <div>
            <UniPortalLogo />

            <div className="mt-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#20243A] tracking-tight leading-snug">
                Chào mừng đến với UniPortal!
              </h1>
              <p className="text-sm text-[#555C75] mt-2.5 leading-relaxed max-w-md">
                Cổng thông tin và quản lý học tập sinh viên toàn khóa học — kết nối Sinh viên, Giảng viên và Phòng Đào tạo trên một nền tảng thống nhất.
              </p>
            </div>
          </div>

          <div className="my-8 rounded-2xl overflow-hidden border border-[#E2DCFE] bg-white/70 aspect-[4/3]">
            <AcademicIllustration
              src={LOGIN_ABSTRACT_IMG}
              alt="Minh họa hành trình học tập và biểu đồ UniPortal"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="text-xs text-[#6558E8] font-medium">
            UniPortal · Cổng thông tin và quản lý học tập sinh viên
          </div>
        </div>

        {/* Bên phải: Form đăng nhập */}
        <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between">
          <div className="my-auto py-4">
            <h2 className="text-xl font-bold text-[#20243A]">Đăng nhập hệ thống</h2>
            <p className="text-sm text-[#858BA3] mt-1 mb-6">
              Nhập email hoặc mã định danh (mã sinh viên / mã giảng viên) cùng mật khẩu của bạn để tiếp tục.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/25 text-[#C83D4C] text-sm flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-[#20243A] mb-1.5"
                >
                  Email hoặc Mã định danh (SV / GV)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#858BA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-email"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Nhập email, mã sinh viên hoặc mã giảng viên"
                    autoComplete="username"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#ECEEF5] rounded-xl text-[#20243A] placeholder:text-[#B5BAC9] focus:outline-none focus:ring-2 focus:ring-[#8174F7]/30 focus:border-[#8174F7] transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-[#20243A] mb-1.5"
                >
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#858BA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-[#ECEEF5] rounded-xl text-[#20243A] placeholder:text-[#B5BAC9] focus:outline-none focus:ring-2 focus:ring-[#8174F7]/30 focus:border-[#8174F7] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858BA3] hover:text-[#20243A] p-1"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 text-[#555C75] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-[#ECEEF5] text-[#8174F7] focus:ring-[#8174F7]"
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-[#6558E8] hover:underline font-medium"
                >
                  Quên mật khẩu?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-[#8174F7] hover:bg-[#6558E8] active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <span>{submitting ? 'Đang xác thực...' : 'Đăng nhập'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="pt-6 border-t border-[#ECEEF5] flex items-center gap-2 text-xs text-[#858BA3]">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Cần hỗ trợ tài khoản? Liên hệ Phòng Đào tạo: hotro@uniportal.edu.vn</span>
          </div>
        </div>
      </div>

      {/* Quên mật khẩu Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/35 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="text-lg font-semibold text-[#20243A]">Khôi phục mật khẩu</h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="text-[#858BA3] hover:text-[#20243A] p-1"
                aria-label="Đóng hộp thoại"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[#555C75] leading-relaxed mb-5">
              Để đảm bảo an toàn thông tin học vụ trên UniPortal, mật khẩu tài khoản sinh viên được
              quản lý tập trung bởi nhà trường. Nếu bạn quên mật khẩu hoặc gặp sự cố đăng nhập, vui
              lòng liên hệ Phòng Đào tạo qua email{' '}
              <span className="font-semibold text-[#6558E8]">hotro@uniportal.edu.vn</span> hoặc
              quầy hỗ trợ sinh viên để được cấp lại quyền truy cập.
            </p>
            <div className="text-right">
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="px-4 py-2 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-medium rounded-xl"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

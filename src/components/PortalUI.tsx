import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  X,
} from 'lucide-react';

export const LOGIN_ABSTRACT_IMG = '/src/assets/images/studyflow_login_abstract_1794819830760.jpg';
export const ACADEMIC_BADGE_IMG = '/src/assets/images/studyflow_academic_badge_1794819830902.jpg';

export function UniPortalLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-xl bg-[#8174F7] text-white flex items-center justify-center shrink-0 shadow-xs">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1">
          <path d="M4 17l5-5 4 4 7-8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 8h4v4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="text-[17px] font-bold tracking-tight text-[#20243A] leading-tight truncate">
            UniPortal
          </div>
          <div className="text-[11px] text-[#858BA3] truncate">
            Cổng thông tin &amp; quản lý học tập
          </div>
        </div>
      )}
    </div>
  );
}

export function AcademicIllustration({
  src,
  alt,
  className = 'w-full h-full object-cover',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${className} bg-[#F0EDFF] flex items-center justify-center text-[#8174F7]`}>
        <Sparkles className="w-8 h-8" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function UserAvatar({
  src,
  name,
  className = 'w-9 h-9',
}: {
  src?: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  if (!src || failed) {
    return (
      <div
        className={`${className} rounded-full bg-[#F0EDFF] text-[#6558E8] font-semibold text-xs flex items-center justify-center shrink-0 border border-[#E4DFFE]`}
      >
        {initials || 'UP'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Ảnh đại diện ${name}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover border border-[#ECEEF5] bg-[#F8F9FD] shrink-0`}
    />
  );
}

export type SemanticTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function SemanticStatusBadge({
  tone,
  label,
}: {
  tone: SemanticTone;
  label: string;
}) {
  const styles: Record<SemanticTone, string> = {
    success: 'bg-[#36B37E]/12 text-[#238A5E] border-[#36B37E]/25',
    warning: 'bg-[#F5AE48]/14 text-[#B77416] border-[#F5AE48]/30',
    danger: 'bg-[#EF6472]/12 text-[#C83D4C] border-[#EF6472]/25',
    info: 'bg-[#F0EDFF] text-[#6558E8] border-[#8174F7]/25',
    neutral: 'bg-[#F8F9FD] text-[#858BA3] border-[#ECEEF5]',
  };

  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'warning'
        ? AlertTriangle
        : tone === 'danger'
          ? AlertCircle
          : Info;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border whitespace-nowrap shrink-0 ${styles[tone]}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 bg-white border border-[#ECEEF5] rounded-2xl p-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-[#ECEEF5] rounded-2xl p-5 h-32">
            <div className="h-3 w-24 bg-[#ECEEF5] rounded mb-4" />
            <div className="h-7 w-20 bg-[#ECEEF5] rounded mb-3" />
            <div className="h-3 w-36 bg-[#F8F9FD] rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-[#ECEEF5] rounded-2xl p-6 h-72" />
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/35 backdrop-blur-[2px] p-4">
      <div className="bg-white border border-[#ECEEF5] rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-lg font-semibold text-[#20243A]">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#858BA3] hover:text-[#20243A] p-1 rounded-lg transition-colors"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-[#858BA3] leading-relaxed mb-6">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#20243A] bg-white border border-[#ECEEF5] rounded-xl hover:bg-[#F8F9FD] transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors ${
              danger
                ? 'bg-[#EF6472] hover:bg-[#dc4e5d]'
                : 'bg-[#8174F7] hover:bg-[#6558E8]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastBanner({
  message,
  tone = 'success',
  onClose,
}: {
  message: string | null;
  tone?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}) {
  if (!message) return null;
  const styles = {
    success: 'bg-[#20243A] text-white border-[#36B37E]/40',
    error: 'bg-[#C83D4C] text-white border-[#EF6472]/50',
    info: 'bg-[#6558E8] text-white border-[#8174F7]/50',
    warning: 'bg-[#20243A] text-white border-[#F5AE48]/60',
  };
  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm no-print">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-medium ${styles[tone]}`}
      >
        {tone === 'error' ? (
          <AlertCircle className="w-4 h-4 shrink-0" />
        ) : tone === 'warning' ? (
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#F5AE48]" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#36B37E]" />
        )}
        <span className="leading-snug">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 opacity-80 hover:opacity-100 rounded-lg"
          aria-label="Đóng thông báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

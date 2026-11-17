import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Settings,
  ShieldAlert,
  Sliders,
  Target,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AcademicWarningRecord,
  translateSeverity,
  translateUserRole,
  translateWarningStatus,
} from '../../shared/academicLogic.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { LecturerNotificationItem } from '../services/api.ts';
import { UniPortalLogo, UserAvatar } from './PortalUI.tsx';

export type StudentNavKey =
  | 'student_dashboard'
  | 'student_results'
  | 'student_history'
  | 'student_progress'
  | 'student_planner'
  | 'student_tuition'
  | 'student_warnings'
  | 'student_reports'
  | 'student_profile';

export type LecturerNavKey =
  | 'lecturer_dashboard'
  | 'lecturer_sections'
  | 'lecturer_grading'
  | 'lecturer_students'
  | 'lecturer_analytics'
  | 'lecturer_history'
  | 'lecturer_profile';

export type TrainingNavKey =
  | 'td_overview'
  | 'td_students'
  | 'td_lecturers'
  | 'td_courses'
  | 'td_sections'
  | 'td_assignments'
  | 'td_terms'
  | 'td_results'
  | 'td_approvals'
  | 'td_tuition'
  | 'td_warnings'
  | 'td_grade_rules'
  | 'td_settings'
  | 'td_reports'
  | 'td_logs';

export type ActiveRouteKey = StudentNavKey | LecturerNavKey | TrainingNavKey;

interface NavItem {
  key: ActiveRouteKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface ShellLayoutProps {
  activeRoute: ActiveRouteKey;
  onNavigate: (route: ActiveRouteKey) => void;
  pageTitle: string;
  breadcrumbs: string[];
  headerActions?: React.ReactNode;
  activeWarnings?: AcademicWarningRecord[];
  lecturerNotifications?: LecturerNotificationItem[];
  pendingApprovalCount?: number;
  unreadReportsCount?: number;
  onMarkWarningRead?: (warningId: string) => void;
  children: React.ReactNode;
}

export function ShellLayout({
  activeRoute,
  onNavigate,
  pageTitle,
  breadcrumbs,
  headerActions,
  activeWarnings = [],
  lecturerNotifications = [],
  pendingApprovalCount = 0,
  unreadReportsCount = 0,
  onMarkWarningRead,
  children,
}: ShellLayoutProps) {
  const { user, student, lecturer, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const unreadWarningsCount = activeWarnings.filter((w) => w.warning_status === 'Active').length;
  const unresolvedWarningsCount = activeWarnings.filter((w) => w.warning_status !== 'Resolved').length;

  const badgeBellCount =
    user?.role === 'LECTURER'
      ? lecturerNotifications.length
      : user?.role === 'TRAINING_DEPARTMENT'
        ? pendingApprovalCount
        : unreadWarningsCount;

  // ROLE 1: STUDENT — strictly 8 focused menu items
  const studentGroups: NavGroup[] = [
    {
      title: 'Cổng sinh viên',
      items: [
        { key: 'student_dashboard', label: 'Tổng quan', icon: LayoutDashboard },
        { key: 'student_results', label: 'Kết quả học tập', icon: Award },
        { key: 'student_history', label: 'Lịch sử học tập', icon: History },
        { key: 'student_progress', label: 'Tiến độ tốt nghiệp', icon: TrendingUp },
        { key: 'student_planner', label: 'Kế hoạch GPA mục tiêu', icon: Target },
        { key: 'student_tuition', label: 'Học phí & Thanh toán QR', icon: QrCode },
        {
          key: 'student_warnings',
          label: 'Cảnh báo học vụ',
          icon: AlertTriangle,
          badgeCount: unresolvedWarningsCount > 0 ? unresolvedWarningsCount : undefined,
        },
        {
          key: 'student_reports',
          label: 'Báo cáo học tập',
          icon: BarChart3,
          badgeCount: unreadReportsCount > 0 ? unreadReportsCount : undefined,
        },
        { key: 'student_profile', label: 'Hồ sơ cá nhân', icon: User },
      ],
    },
  ];

  // ROLE 2: LECTURER — strictly 7 focused menu items
  const lecturerGroups: NavGroup[] = [
    {
      title: 'Cổng giảng viên',
      items: [
        { key: 'lecturer_dashboard', label: 'Tổng quan', icon: LayoutDashboard },
        { key: 'lecturer_sections', label: 'Lớp học phần', icon: Layers },
        { key: 'lecturer_grading', label: 'Nhập và quản lý điểm', icon: FileSpreadsheet },
        { key: 'lecturer_students', label: 'Danh sách sinh viên', icon: Users },
        { key: 'lecturer_analytics', label: 'Thống kê lớp học', icon: BarChart3 },
        { key: 'lecturer_history', label: 'Lịch sử giảng dạy', icon: History },
        { key: 'lecturer_profile', label: 'Hồ sơ cá nhân', icon: User },
      ],
    },
  ];

  // ROLE 3: TRAINING_DEPARTMENT — strictly 4 grouped sections, 14 items
  const trainingGroups: NavGroup[] = [
    {
      title: 'Tổng quan',
      items: [{ key: 'td_overview', label: 'Tổng quan', icon: LayoutDashboard }],
    },
    {
      title: 'Quản lý đào tạo',
      items: [
        { key: 'td_students', label: 'Sinh viên', icon: GraduationCap },
        { key: 'td_lecturers', label: 'Giảng viên', icon: UserCheck },
        { key: 'td_courses', label: 'Học phần', icon: BookOpen },
        { key: 'td_sections', label: 'Lớp học phần', icon: Layers },
        { key: 'td_assignments', label: 'Phân công giảng dạy', icon: UserPlus },
        { key: 'td_terms', label: 'Năm học và học kỳ', icon: CalendarRange },
      ],
    },
    {
      title: 'Quản lý kết quả',
      items: [
        { key: 'td_results', label: 'Kết quả học tập', icon: Award },
        {
          key: 'td_approvals',
          label: 'Duyệt bảng điểm',
          icon: ClipboardCheck,
          badgeCount: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
        },
        {
          key: 'td_warnings',
          label: 'Cảnh báo học vụ',
          icon: ShieldAlert,
          badgeCount: unresolvedWarningsCount > 0 ? unresolvedWarningsCount : undefined,
        },
      ],
    },
    {
      title: 'Hệ thống',
      items: [
        { key: 'td_tuition', label: 'Quản lý học phí & QR', icon: CreditCard },
        { key: 'td_grade_rules', label: 'Quy chế điểm', icon: Sliders },
        { key: 'td_settings', label: 'Cấu hình học vụ', icon: Settings },
        { key: 'td_reports', label: 'Báo cáo thống kê', icon: BarChart3 },
        { key: 'td_logs', label: 'Nhật ký hoạt động', icon: Activity },
      ],
    },
  ];

  const navGroups =
    user?.role === 'TRAINING_DEPARTMENT'
      ? trainingGroups
      : user?.role === 'LECTURER'
        ? lecturerGroups
        : studentGroups;

  const displayName =
    student?.full_name || lecturer?.full_name || user?.display_name || 'Người dùng';
  const displayId =
    student?.student_id ||
    lecturer?.lecturer_id ||
    (user?.role === 'TRAINING_DEPARTMENT' ? 'PĐT-001' : user?.user_id || '');
  const roleLabel = user ? translateUserRole(user.role) : 'Thành viên';

  const handleSelectNav = (key: ActiveRouteKey) => {
    onNavigate(key);
    setMobileMenuOpen(false);
  };

  const renderNavItem = (item: NavItem, compact: boolean) => {
    const Icon = item.icon;
    const active = activeRoute === item.key;
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => handleSelectNav(item.key)}
        title={compact ? item.label : undefined}
        className={`w-full flex items-center ${
          compact ? 'justify-center px-2.5' : 'justify-between px-3.5'
        } py-2.5 rounded-xl text-sm transition-all duration-150 whitespace-nowrap ${
          active
            ? 'bg-[#F0EDFF] text-[#6558E8] font-semibold'
            : 'text-[#555C75] hover:bg-[#F8F9FD] hover:text-[#20243A] font-medium'
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <Icon
            className={`w-[18px] h-[18px] shrink-0 transition-colors ${
              active ? 'text-[#8174F7]' : 'text-[#858BA3]'
            }`}
          />
          {!compact && <span className="truncate">{item.label}</span>}
        </span>
        {!compact && item.badgeCount !== undefined && (
          <span
            className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded-full tabular-nums ${
              active ? 'bg-[#8174F7] text-white' : 'bg-[#EF6472]/12 text-[#C83D4C]'
            }`}
          >
            {item.badgeCount}
          </span>
        )}
      </button>
    );
  };

  const renderSidebarBody = (compact: boolean) => (
    <div className="flex flex-col h-full bg-white">
      <div
        className={`px-4 py-5 border-b border-[#ECEEF5] flex items-center ${
          compact ? 'justify-center' : 'justify-between'
        } gap-2`}
      >
        <UniPortalLogo compact={compact} />
        {!compact && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            className="hidden lg:inline-flex p-1.5 text-[#858BA3] hover:text-[#20243A] hover:bg-[#F8F9FD] rounded-lg transition-colors"
            aria-label="Thu gọn thanh điều hướng"
            title="Thu gọn thanh điều hướng"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {compact && (
        <div className="hidden lg:flex justify-center pt-3">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="p-1.5 text-[#858BA3] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-lg transition-colors"
            aria-label="Mở rộng thanh điều hướng"
            title="Mở rộng thanh điều hướng"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto" aria-label="Điều hướng chính">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!compact && (
              <div className="px-3.5 pb-1 text-[11px] font-semibold tracking-wider text-[#858BA3] uppercase">
                {group.title}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => renderNavItem(item, compact))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-[#ECEEF5] space-y-1">
        {!compact && (
          <div className="px-3.5 py-1.5 text-[11px] text-[#858BA3] flex items-center justify-between">
            <span>Vai trò</span>
            <span className="font-semibold text-[#6558E8]">{roleLabel}</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => void logout()}
          title={compact ? 'Đăng xuất' : undefined}
          className={`w-full flex items-center ${
            compact ? 'justify-center px-2.5' : 'gap-3 px-3.5'
          } py-2.5 rounded-xl text-sm font-medium text-[#858BA3] hover:bg-[#EF6472]/10 hover:text-[#C83D4C] transition-colors`}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!compact && <span>Đăng xuất</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8F9FD] text-[#20243A]">
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-[#ECEEF5] z-30 transition-all duration-200 no-print ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-[272px]'
        }`}
      >
        {renderSidebarBody(sidebarCollapsed)}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-[#20243A]/35 backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full z-10 flex flex-col border-r border-[#ECEEF5]">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-3 text-[#858BA3] hover:text-[#20243A] p-1.5 rounded-lg"
              aria-label="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
            {renderSidebarBody(false)}
          </aside>
        </div>
      )}

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[272px]'
        }`}
      >
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#ECEEF5] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-[#555C75] hover:text-[#20243A] hover:bg-[#F8F9FD] rounded-xl"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <nav
                aria-label="Đường dẫn"
                className="flex items-center gap-1.5 text-xs text-[#858BA3] leading-none mb-1"
              >
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={`${crumb}-${idx}`}>
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-[#B5BAC9]" />}
                    <span
                      className={
                        idx === breadcrumbs.length - 1 ? 'text-[#6558E8] font-medium' : ''
                      }
                    >
                      {crumb}
                    </span>
                  </React.Fragment>
                ))}
              </nav>
              <h1 className="text-base sm:text-lg font-bold text-[#20243A] tracking-tight truncate leading-tight">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {headerActions && (
              <div className="hidden sm:flex items-center gap-2">{headerActions}</div>
            )}

            {/* Notification Popover */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2.5 text-[#555C75] hover:text-[#6558E8] hover:bg-[#F0EDFF] rounded-xl transition-colors"
                aria-label="Thông báo"
              >
                <Bell className="w-[18px] h-[18px]" />
                {badgeBellCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#EF6472] text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                    {badgeBellCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#ECEEF5] rounded-2xl shadow-xl z-40 overflow-hidden">
                  <div className="px-4 py-3.5 border-b border-[#ECEEF5] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#20243A]">
                      {user?.role === 'LECTURER'
                        ? 'Thông báo giảng dạy'
                        : user?.role === 'TRAINING_DEPARTMENT'
                          ? 'Hàng đợi phê duyệt'
                          : 'Thông báo học vụ'}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F0EDFF] text-[#6558E8] font-medium tabular-nums">
                      {badgeBellCount} mục
                    </span>
                  </div>

                  {user?.role === 'LECTURER' ? (
                    <div className="max-h-80 overflow-y-auto divide-y divide-[#ECEEF5]">
                      {lecturerNotifications.length === 0 ? (
                        <div className="p-6 text-sm text-[#858BA3] text-center">
                          Tất cả lớp học phần đã hoàn tất đúng tiến độ.
                        </div>
                      ) : (
                        lecturerNotifications.slice(0, 5).map((n) => (
                          <div key={n.id} className="p-3.5 hover:bg-[#F8F9FD]">
                            <div className="text-xs font-semibold text-[#20243A]">{n.title}</div>
                            <p className="text-xs text-[#858BA3] mt-1">{n.description}</p>
                          </div>
                        ))
                      )}
                    </div>
                  ) : user?.role === 'TRAINING_DEPARTMENT' ? (
                    <div className="p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#555C75]">Bảng điểm đang chờ duyệt</span>
                        <span className="font-mono font-bold text-[#6558E8]">{pendingApprovalCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#555C75]">Cảnh báo sinh viên hiệu lực</span>
                        <span className="font-mono font-bold text-[#C83D4C]">{unresolvedWarningsCount}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          onNavigate('td_approvals');
                        }}
                        className="w-full py-2 bg-[#F0EDFF] text-[#6558E8] font-semibold rounded-xl hover:bg-[#e5e0ff] flex items-center justify-center gap-1.5"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Đi tới Duyệt bảng điểm</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-80 overflow-y-auto divide-y divide-[#ECEEF5]">
                        {activeWarnings.filter((w) => w.warning_status !== 'Resolved').length === 0 ? (
                          <div className="p-6 text-sm text-[#858BA3] text-center">
                            Không có cảnh báo học vụ nào đang hoạt động.
                          </div>
                        ) : (
                          activeWarnings
                            .filter((w) => w.warning_status !== 'Resolved')
                            .slice(0, 5)
                            .map((w) => (
                              <div key={w.warning_id} className="p-3.5 hover:bg-[#F8F9FD]">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-xs font-semibold text-[#20243A]">
                                    {w.warning_title}
                                  </div>
                                  <span
                                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                      w.severity === 'Critical'
                                        ? 'bg-[#EF6472]/12 text-[#C83D4C]'
                                        : 'bg-[#F5AE48]/15 text-[#B77416]'
                                    }`}
                                  >
                                    {translateSeverity(w.severity)}
                                  </span>
                                </div>
                                <p className="text-xs text-[#858BA3] mt-1 line-clamp-2">{w.description}</p>
                                <div className="mt-2 flex items-center justify-between text-xs">
                                  <span className="text-[#858BA3] font-mono">{w.academic_year}</span>
                                  {w.warning_status === 'Active' && onMarkWarningRead ? (
                                    <button
                                      type="button"
                                      onClick={() => onMarkWarningRead(w.warning_id)}
                                      className="text-[#6558E8] hover:underline font-medium"
                                    >
                                      Đánh dấu đã đọc
                                    </button>
                                  ) : (
                                    <span className="text-[#858BA3]">
                                      {translateWarningStatus(w.warning_status)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                      <div className="px-4 py-2.5 bg-[#F8F9FD] border-t border-[#ECEEF5] text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            onNavigate('student_warnings');
                          }}
                          className="text-xs font-semibold text-[#6558E8] hover:underline"
                        >
                          Xem tất cả thông báo
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-[#F8F9FD] transition-colors border border-transparent hover:border-[#ECEEF5]"
              >
                <UserAvatar
                  src={student?.avatar_url || lecturer?.avatar_url || user?.avatar_url}
                  name={displayName}
                  className="w-8 h-8"
                />
                <div className="hidden md:block text-left">
                  <div className="text-sm font-semibold text-[#20243A] leading-tight whitespace-nowrap">
                    {displayName}
                  </div>
                  <div className="text-[11px] font-mono text-[#858BA3] leading-tight tabular-nums">
                    {displayId}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-[#858BA3] shrink-0" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-[#ECEEF5] rounded-2xl shadow-xl z-40 py-1.5">
                  <div className="px-4 py-2.5 border-b border-[#ECEEF5]">
                    <div className="text-sm font-semibold text-[#20243A] truncate">
                      {displayName}
                    </div>
                    <div className="text-xs text-[#858BA3] truncate">{user?.email}</div>
                    <div className="text-[11px] font-mono text-[#858BA3] mt-0.5">
                      {displayId} · {roleLabel}
                    </div>
                  </div>
                  {user?.role === 'STUDENT' && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        onNavigate('student_profile');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[#20243A] hover:bg-[#F8F9FD] flex items-center gap-2.5"
                    >
                      <User className="w-4 h-4 text-[#858BA3]" />
                      <span>Hồ sơ cá nhân</span>
                    </button>
                  )}
                  {user?.role === 'LECTURER' && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        onNavigate('lecturer_profile');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[#20243A] hover:bg-[#F8F9FD] flex items-center gap-2.5"
                    >
                      <User className="w-4 h-4 text-[#858BA3]" />
                      <span>Hồ sơ giảng viên</span>
                    </button>
                  )}
                  {user?.role === 'TRAINING_DEPARTMENT' && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        onNavigate('td_settings');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[#20243A] hover:bg-[#F8F9FD] flex items-center gap-2.5"
                    >
                      <Settings className="w-4 h-4 text-[#858BA3]" />
                      <span>Cấu hình học vụ</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-[#ECEEF5]" />
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="w-full px-4 py-2 text-left text-sm text-[#C83D4C] hover:bg-[#EF6472]/10 flex items-center gap-2.5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1380px] w-full mx-auto">
          {children}
        </main>

        <footer className="px-4 sm:px-6 lg:px-8 py-4 border-t border-[#ECEEF5] bg-white/70 text-xs text-[#858BA3] flex flex-wrap items-center justify-between gap-2 no-print">
          <span>UniPortal — Cổng thông tin và quản lý học tập sinh viên</span>
          <span>Hệ thống quản trị học vụ ba vai trò: Sinh viên · Giảng viên · Phòng Đào tạo</span>
        </footer>
      </div>
    </div>
  );
}

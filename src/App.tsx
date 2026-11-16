import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import {
  AdminOverviewResponse,
  api,
  ApiError,
  CatalogCourse,
  LecturerOverviewResponse,
  StudentOverviewResponse,
} from './services/api.ts';
import { ActiveRouteKey, ShellLayout } from './components/ShellLayout.tsx';
import { PageLoadingSkeleton, ToastBanner } from './components/PortalUI.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { StudentDashboardPage } from './pages/StudentDashboardPage.tsx';
import { AcademicHistoryPage } from './pages/AcademicHistoryPage.tsx';
import { AcademicProgressPage } from './pages/AcademicProgressPage.tsx';
import { MyCoursesPage } from './pages/MyCoursesPage.tsx';
import { TargetGpaPlannerPage } from './pages/TargetGpaPlannerPage.tsx';
import { AcademicWarningsPage } from './pages/AcademicWarningsPage.tsx';
import { AcademicReportsPage } from './pages/AcademicReportsPage.tsx';
import { StudentProfilePage } from './pages/StudentProfilePage.tsx';
import { AdminCoursesView, AdminStudentsView } from './pages/AdminDashboardPage.tsx';
import {
  AdminGradeConfigView,
  AdminStudentReportInspector,
  AdminTermsConfigView,
  AdminWarningsConfigView,
} from './pages/AdminConfigPages.tsx';
import { LecturerDashboardPage } from './pages/LecturerDashboardPage.tsx';
import { LecturerClassWorkspacePage } from './pages/LecturerClassWorkspacePage.tsx';
import {
  LecturerAnalyticsView,
  LecturerHistoryView,
  LecturerProfileView,
  LecturerSectionsListView,
  LecturerStudentsView,
} from './pages/LecturerPortalPages.tsx';
import { TrainingDashboardPage } from './pages/TrainingDashboardPage.tsx';
import {
  TrainingActivityLogsView,
  TrainingGradeApprovalsView,
  TrainingLecturersView,
  TrainingResultsExplorerView,
  TrainingSectionsAndAssignmentsView,
} from './pages/TrainingManagementPages.tsx';

function AdminSystemSettingsView({
  data,
  onReload,
}: {
  data: AdminOverviewResponse;
  onReload: () => Promise<void>;
}) {
  const [defaultCredits, setDefaultCredits] = useState(
    String(data.settings.gpaPolicy.defaultRequiredCredits)
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      await api.updateSetting('gpa_policy', {
        ...data.settings.gpaPolicy,
        defaultRequiredCredits: Math.max(1, Number(defaultCredits) || 130),
      });
      await onReload();
      setSavedMsg('Đã cập nhật số tín chỉ chuẩn tốt nghiệp mặc định.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form
        onSubmit={handleSave}
        className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4"
      >
        <h2 className="text-base font-bold text-[#20243A]">Cấu hình chương trình đào tạo</h2>
        <p className="text-xs text-[#858BA3]">
          Thiết lập giá trị mặc định toàn trường cho hồ sơ sinh viên mới và chuẩn xét tốt nghiệp.
        </p>
        {savedMsg && (
          <div className="p-3.5 rounded-xl bg-[#36B37E]/10 border border-[#36B37E]/30 text-[#238A5E] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedMsg}</span>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-[#20243A] mb-1.5">
            Tổng số tín chỉ chuẩn để tốt nghiệp
          </label>
          <input
            type="number"
            min="30"
            max="240"
            value={defaultCredits}
            onChange={(e) => setDefaultCredits(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Đang lưu...' : 'Lưu cài đặt học vụ'}</span>
        </button>
      </form>

      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-3.5">
        <div className="flex items-center gap-2.5 text-[#20243A] font-bold text-base">
          <div className="w-8 h-8 rounded-xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span>Bảo mật &amp; Phân quyền ba vai trò</span>
        </div>
        <p className="text-xs text-[#555C75] leading-relaxed">
          Toàn bộ hồ sơ sinh viên, danh sách giảng viên, lớp học phần, quy trình duyệt bảng điểm và nhật ký kiểm soát đều được bảo vệ theo vai trò tại máy chủ.
        </p>
        <dl className="space-y-2.5 text-xs pt-2 border-t border-[#ECEEF5]">
          <div className="flex justify-between">
            <dt className="text-[#858BA3]">Phân quyền truy cập dữ liệu</dt>
            <dd className="font-semibold text-[#238A5E]">Đã kích hoạt</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#858BA3]">Tổng sinh viên đang quản lý</dt>
            <dd className="font-mono font-semibold text-[#6558E8]">{data.metrics.totalStudents}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#858BA3]">Tổng giảng viên đang công tác</dt>
            <dd className="font-mono font-semibold text-[#20243A]">{data.metrics.totalLecturers}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

const ROUTE_META: Record<ActiveRouteKey, { title: string; breadcrumbs: string[] }> = {
  // Vai trò Sinh viên
  student_dashboard: {
    title: 'Tổng quan học tập',
    breadcrumbs: ['UniPortal', 'Cổng sinh viên', 'Tổng quan'],
  },
  student_results: {
    title: 'Kết quả học tập',
    breadcrumbs: ['UniPortal', 'Cổng sinh viên', 'Kết quả học tập'],
  },
  student_history: {
    title: 'Lịch sử học tập',
    breadcrumbs: ['UniPortal', 'Cổng sinh viên', 'Lịch sử học tập'],
  },
  student_progress: {
    title: 'Tiến độ tốt nghiệp',
    breadcrumbs: ['UniPortal', 'Cổng sinh viên', 'Tiến độ tốt nghiệp'],
  },
  student_planner: {
    title: 'Kế hoạch GPA mục tiêu',
    breadcrumbs: ['UniPortal', 'Cổng sinh viên', 'Kế hoạch GPA mục tiêu'],
  },
  student_warnings: {
    title: 'Cảnh báo học vụ',
    breadcrumbs: ['UniPortal', 'Cổng sinh viên', 'Cảnh báo học vụ'],
  },
  student_reports: {
    title: 'Báo cáo học tập',
    breadcrumbs: ['UniPortal', 'Cổng sinh viên', 'Báo cáo học tập'],
  },
  student_profile: {
    title: 'Hồ sơ cá nhân',
    breadcrumbs: ['UniPortal', 'Cổng sinh viên', 'Hồ sơ cá nhân'],
  },

  // Vai trò Giảng viên
  lecturer_dashboard: {
    title: 'Tổng quan giảng dạy',
    breadcrumbs: ['UniPortal', 'Cổng giảng viên', 'Tổng quan'],
  },
  lecturer_sections: {
    title: 'Lớp học phần phụ trách',
    breadcrumbs: ['UniPortal', 'Cổng giảng viên', 'Lớp học phần'],
  },
  lecturer_grading: {
    title: 'Nhập và quản lý điểm',
    breadcrumbs: ['UniPortal', 'Cổng giảng viên', 'Nhập điểm'],
  },
  lecturer_students: {
    title: 'Danh sách sinh viên lớp',
    breadcrumbs: ['UniPortal', 'Cổng giảng viên', 'Danh sách sinh viên'],
  },
  lecturer_analytics: {
    title: 'Thống kê lớp học',
    breadcrumbs: ['UniPortal', 'Cổng giảng viên', 'Thống kê lớp học'],
  },
  lecturer_history: {
    title: 'Lịch sử giảng dạy',
    breadcrumbs: ['UniPortal', 'Cổng giảng viên', 'Lịch sử giảng dạy'],
  },
  lecturer_profile: {
    title: 'Hồ sơ giảng viên',
    breadcrumbs: ['UniPortal', 'Cổng giảng viên', 'Hồ sơ cá nhân'],
  },

  // Vai trò Phòng Đào tạo
  td_overview: {
    title: 'Tổng quan điều hành đào tạo',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Tổng quan'],
  },
  td_students: {
    title: 'Quản lý sinh viên',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Sinh viên'],
  },
  td_lecturers: {
    title: 'Quản lý giảng viên',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Giảng viên'],
  },
  td_courses: {
    title: 'Danh mục học phần',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Học phần'],
  },
  td_sections: {
    title: 'Quản lý lớp học phần',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Lớp học phần'],
  },
  td_assignments: {
    title: 'Phân công giảng dạy',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Phân công giảng dạy'],
  },
  td_terms: {
    title: 'Năm học và học kỳ',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Năm học và học kỳ'],
  },
  td_results: {
    title: 'Tra cứu kết quả học tập',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Kết quả học tập'],
  },
  td_approvals: {
    title: 'Phê duyệt bảng điểm',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Duyệt bảng điểm'],
  },
  td_warnings: {
    title: 'Cảnh báo học vụ toàn trường',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Cảnh báo học vụ'],
  },
  td_grade_rules: {
    title: 'Quy chế & thang điểm',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Quy chế điểm'],
  },
  td_settings: {
    title: 'Cấu hình học vụ',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Cấu hình học vụ'],
  },
  td_reports: {
    title: 'Báo cáo thống kê sinh viên',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Báo cáo thống kê'],
  },
  td_logs: {
    title: 'Nhật ký hoạt động hệ thống',
    breadcrumbs: ['UniPortal', 'Phòng Đào tạo', 'Nhật ký hoạt động'],
  },
};

function defaultRouteForRole(role: string | undefined): ActiveRouteKey {
  if (role === 'TRAINING_DEPARTMENT') return 'td_overview';
  if (role === 'LECTURER') return 'lecturer_dashboard';
  return 'student_dashboard';
}

function resolveEffectiveRoute(role: string | undefined, current: ActiveRouteKey): ActiveRouteKey {
  if (role === 'TRAINING_DEPARTMENT') {
    return current.startsWith('td_') ? current : 'td_overview';
  }
  if (role === 'LECTURER') {
    return current.startsWith('lecturer_') ? current : 'lecturer_dashboard';
  }
  return current.startsWith('student_') ? current : 'student_dashboard';
}

function PortalWorkspace() {
  const { user, loading: authLoading, refreshSession } = useAuth();
  const [route, setRoute] = useState<ActiveRouteKey>('student_dashboard');
  const [studentOverview, setStudentOverview] = useState<StudentOverviewResponse | null>(null);
  const [lecturerOverview, setLecturerOverview] = useState<LecturerOverviewResponse | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverviewResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [selectedLecturerSectionId, setSelectedLecturerSectionId] = useState<string | null>(null);
  const [selectedApprovalSectionId, setSelectedApprovalSectionId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(
    null
  );
  const loadSeqRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string, tone: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, tone });
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 4500);
    },
    []
  );

  const loadWorkspaceData = useCallback(async () => {
    if (!user) return;
    const seq = ++loadSeqRef.current;
    setDataLoading(true);
    setLoadError(null);
    try {
      if (user.role === 'TRAINING_DEPARTMENT') {
        const [adminData, courses] = await Promise.all([api.getAdminOverview(), api.getCourses()]);
        if (seq !== loadSeqRef.current) return;
        setStudentOverview(null);
        setLecturerOverview(null);
        setAdminOverview(adminData);
        setCatalog(courses);
      } else if (user.role === 'LECTURER') {
        const lecData = await api.getLecturerOverview();
        if (seq !== loadSeqRef.current) return;
        setStudentOverview(null);
        setAdminOverview(null);
        setLecturerOverview(lecData);
        setCatalog([]);
        setSelectedLecturerSectionId((prev) =>
          prev && lecData.sections.some((s) => s.section_id === prev)
            ? prev
            : lecData.sections[0]?.section_id ?? null
        );
      } else if (user.student_id) {
        const [stuData, courses] = await Promise.all([
          api.getStudentOverview(user.student_id),
          api.getCourses(),
        ]);
        if (seq !== loadSeqRef.current) return;
        setAdminOverview(null);
        setLecturerOverview(null);
        setStudentOverview(stuData);
        setCatalog(courses);
      } else {
        if (seq !== loadSeqRef.current) return;
        setStudentOverview(null);
        setLecturerOverview(null);
        setAdminOverview(null);
        setLoadError(
          'Tài khoản sinh viên chưa được liên kết với hồ sơ học tập. Vui lòng liên hệ Phòng Đào tạo để được kiểm tra.'
        );
      }
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      if (err instanceof ApiError && err.status === 401) {
        await refreshSession();
        return;
      }
      setLoadError(err instanceof Error ? err.message : 'Không thể tải dữ liệu học tập.');
    } finally {
      if (seq === loadSeqRef.current) {
        setDataLoading(false);
      }
    }
  }, [user, refreshSession]);

  useEffect(() => {
    loadSeqRef.current += 1;
    setStudentOverview(null);
    setLecturerOverview(null);
    setAdminOverview(null);
    setCatalog([]);
    setSelectedLecturerSectionId(null);
    setSelectedApprovalSectionId(null);
    setLoadError(null);
    if (!user) {
      return;
    }
    setRoute(defaultRouteForRole(user.role));
    void loadWorkspaceData();
  }, [user, loadWorkspaceData]);

  const effectiveRoute = resolveEffectiveRoute(user?.role, route);
  const meta = ROUTE_META[effectiveRoute];

  useEffect(() => {
    if (!user) {
      document.title = 'Đăng nhập — UniPortal | Cổng thông tin và quản lý học tập sinh viên';
    } else {
      document.title = `${meta.title} — UniPortal | Cổng thông tin và quản lý học tập sinh viên`;
    }
  }, [user, meta.title]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center p-6">
        <div className="text-sm text-[#858BA3] font-medium">
          Đang tải UniPortal — Cổng thông tin và quản lý học tập sinh viên...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleMarkWarningRead = async (warningId: string) => {
    if (!user.student_id) return;
    await api.markWarningRead(user.student_id, warningId);
    await loadWorkspaceData();
  };

  const handleOpenLecturerSection = (sectionId: string) => {
    setSelectedLecturerSectionId(sectionId);
    setRoute('lecturer_grading');
  };

  const handleInspectSubmission = (sectionId: string) => {
    setSelectedApprovalSectionId(sectionId);
    setRoute('td_approvals');
  };

  const activeWarningsList =
    user.role === 'TRAINING_DEPARTMENT'
      ? adminOverview?.warnings ?? []
      : user.role === 'STUDENT'
        ? studentOverview?.warnings ?? []
        : [];

  return (
    <>
      <ShellLayout
        activeRoute={effectiveRoute}
        onNavigate={setRoute}
        pageTitle={meta.title}
        breadcrumbs={meta.breadcrumbs}
        activeWarnings={activeWarningsList}
        lecturerNotifications={lecturerOverview?.notifications ?? []}
        pendingApprovalCount={adminOverview?.metrics.pendingApprovals ?? 0}
        onMarkWarningRead={user.role === 'STUDENT' ? handleMarkWarningRead : undefined}
        headerActions={
          <button
            type="button"
            onClick={() => void loadWorkspaceData()}
            className="px-3.5 py-2 text-xs font-semibold text-[#555C75] hover:text-[#6558E8] bg-[#F8F9FD] hover:bg-[#F0EDFF] border border-[#ECEEF5] rounded-xl transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        }
      >
        {loadError ? (
          <div className="bg-[#EF6472]/10 border border-[#EF6472]/30 rounded-2xl p-6 flex items-start justify-between gap-4 text-[#C83D4C]">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">Không thể tải dữ liệu học tập</div>
                <p className="text-xs mt-1">{loadError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadWorkspaceData()}
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-[#EF6472]/30 text-[#C83D4C] hover:bg-[#EF6472]/10 rounded-xl shrink-0"
            >
              Thử lại
            </button>
          </div>
        ) : user.role === 'STUDENT' ? (
          !studentOverview ? (
            <PageLoadingSkeleton />
          ) : (
            <>
              {effectiveRoute === 'student_dashboard' && (
                <StudentDashboardPage overview={studentOverview} onNavigate={setRoute} />
              )}
              {effectiveRoute === 'student_results' && (
                <MyCoursesPage
                  overview={studentOverview}
                  catalog={catalog}
                  viewMode="table"
                  readOnly={true}
                  onReload={loadWorkspaceData}
                />
              )}
              {effectiveRoute === 'student_history' && (
                <AcademicHistoryPage
                  overview={studentOverview}
                  catalog={catalog}
                  readOnly={true}
                  onReload={loadWorkspaceData}
                />
              )}
              {effectiveRoute === 'student_progress' && (
                <AcademicProgressPage overview={studentOverview} onNavigate={setRoute} />
              )}
              {effectiveRoute === 'student_planner' && (
                <TargetGpaPlannerPage overview={studentOverview} />
              )}
              {effectiveRoute === 'student_warnings' && (
                <AcademicWarningsPage
                  overview={studentOverview}
                  onReload={loadWorkspaceData}
                  onNavigate={setRoute}
                />
              )}
              {effectiveRoute === 'student_reports' && (
                <AcademicReportsPage overview={studentOverview} />
              )}
              {effectiveRoute === 'student_profile' && (
                <StudentProfilePage
                  overview={studentOverview}
                  onReload={async () => {
                    await Promise.all([loadWorkspaceData(), refreshSession()]);
                  }}
                />
              )}
            </>
          )
        ) : user.role === 'LECTURER' ? (
          !lecturerOverview ? (
            <PageLoadingSkeleton />
          ) : (
            <>
              {effectiveRoute === 'lecturer_dashboard' && (
                <LecturerDashboardPage
                  overview={lecturerOverview}
                  onNavigate={setRoute}
                  onOpenSection={handleOpenLecturerSection}
                />
              )}
              {effectiveRoute === 'lecturer_sections' && (
                <LecturerSectionsListView
                  overview={lecturerOverview}
                  onOpenSection={handleOpenLecturerSection}
                />
              )}
              {effectiveRoute === 'lecturer_grading' && (
                <LecturerClassWorkspacePage
                  overview={lecturerOverview}
                  selectedSectionId={selectedLecturerSectionId}
                  onSelectSection={setSelectedLecturerSectionId}
                  onReloadOverview={loadWorkspaceData}
                  onToast={showToast}
                />
              )}
              {effectiveRoute === 'lecturer_students' && (
                <LecturerStudentsView overview={lecturerOverview} />
              )}
              {effectiveRoute === 'lecturer_analytics' && (
                <LecturerAnalyticsView overview={lecturerOverview} />
              )}
              {effectiveRoute === 'lecturer_history' && (
                <LecturerHistoryView
                  overview={lecturerOverview}
                  onOpenSection={handleOpenLecturerSection}
                />
              )}
              {effectiveRoute === 'lecturer_profile' && (
                <LecturerProfileView
                  overview={lecturerOverview}
                  onReload={async () => {
                    await Promise.all([loadWorkspaceData(), refreshSession()]);
                  }}
                />
              )}
            </>
          )
        ) : !adminOverview ? (
          <PageLoadingSkeleton />
        ) : (
          <>
            {effectiveRoute === 'td_overview' && (
              <TrainingDashboardPage
                data={adminOverview}
                onNavigate={setRoute}
                onInspectSubmission={handleInspectSubmission}
              />
            )}
            {effectiveRoute === 'td_students' && (
              <AdminStudentsView
                data={adminOverview}
                catalog={catalog}
                onReload={loadWorkspaceData}
              />
            )}
            {effectiveRoute === 'td_lecturers' && (
              <TrainingLecturersView
                data={adminOverview}
                onReload={loadWorkspaceData}
                onToast={showToast}
              />
            )}
            {effectiveRoute === 'td_courses' && (
              <AdminCoursesView catalog={catalog} onReload={loadWorkspaceData} />
            )}
            {effectiveRoute === 'td_sections' && (
              <TrainingSectionsAndAssignmentsView
                data={adminOverview}
                catalog={catalog}
                mode="sections"
                onReload={loadWorkspaceData}
                onToast={showToast}
              />
            )}
            {effectiveRoute === 'td_assignments' && (
              <TrainingSectionsAndAssignmentsView
                data={adminOverview}
                catalog={catalog}
                mode="assignments"
                onReload={loadWorkspaceData}
                onToast={showToast}
              />
            )}
            {effectiveRoute === 'td_terms' && (
              <AdminTermsConfigView data={adminOverview} onReload={loadWorkspaceData} />
            )}
            {effectiveRoute === 'td_results' && (
              <TrainingResultsExplorerView
                data={adminOverview}
                catalog={catalog}
                onReload={loadWorkspaceData}
              />
            )}
            {effectiveRoute === 'td_approvals' && (
              <TrainingGradeApprovalsView
                data={adminOverview}
                selectedSectionId={selectedApprovalSectionId}
                onSelectSection={setSelectedApprovalSectionId}
                onReload={loadWorkspaceData}
                onToast={showToast}
              />
            )}
            {effectiveRoute === 'td_warnings' && (
              <AdminWarningsConfigView data={adminOverview} onReload={loadWorkspaceData} />
            )}
            {effectiveRoute === 'td_grade_rules' && (
              <AdminGradeConfigView data={adminOverview} onReload={loadWorkspaceData} />
            )}
            {effectiveRoute === 'td_settings' && (
              <AdminSystemSettingsView data={adminOverview} onReload={loadWorkspaceData} />
            )}
            {effectiveRoute === 'td_reports' && (
              <AdminStudentReportInspector data={adminOverview} />
            )}
            {effectiveRoute === 'td_logs' && (
              <TrainingActivityLogsView data={adminOverview} />
            )}
          </>
        )}
      </ShellLayout>

      <ToastBanner
        message={toast?.message ?? null}
        tone={toast?.tone ?? 'success'}
        onClose={() => setToast(null)}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PortalWorkspace />
    </AuthProvider>
  );
}

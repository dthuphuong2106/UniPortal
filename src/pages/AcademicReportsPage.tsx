import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  BellDot,
  CheckCircle2,
  Download,
  FileText,
  Inbox,
  MailOpen,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AcademicReportRecord,
  AcademicReportType,
  formatDualGrade,
  formatGpa,
  translateCompletionStatus,
  translateSeverity,
  translateWarningStatus,
} from '../../shared/academicLogic.ts';
import { api, MarkReportReadResponse, StudentOverviewResponse } from '../services/api.ts';
import { SemanticStatusBadge, SemanticTone } from '../components/PortalUI.tsx';

function toPdfSafeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function translateReportType(type: AcademicReportType): string {
  switch (type) {
    case 'SEMESTER_SUMMARY':
      return 'Tổng kết học kỳ';
    case 'ADVISORY_NOTICE':
      return 'Thông báo học vụ';
    case 'PROGRESS_REVIEW':
      return 'Đánh giá tiến độ';
    case 'OFFICIAL_TRANSCRIPT':
      return 'Bảng điểm chính thức';
    default:
      return type;
  }
}

function reportTypeTone(type: AcademicReportType): SemanticTone {
  switch (type) {
    case 'ADVISORY_NOTICE':
      return 'warning';
    case 'OFFICIAL_TRANSCRIPT':
      return 'success';
    case 'PROGRESS_REVIEW':
      return 'info';
    default:
      return 'neutral';
  }
}

export function AcademicReportsPage({
  overview,
  readOnly = false,
  onMarkReportRead,
}: {
  overview: StudentOverviewResponse;
  readOnly?: boolean;
  onMarkReportRead?: (reportId: string, response: MarkReportReadResponse) => void;
}) {
  const { student, summary, enrollments, warnings, settings } = overview;
  const reports: AcademicReportRecord[] = overview.reports ?? [];
  const unreadReportsCount =
    overview.unreadReportsCount ?? reports.filter((r) => !r.is_read).length;

  const [yearFilter, setYearFilter] = useState('ALL');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.report_id ?? '');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (readFilter === 'UNREAD' && r.is_read) return false;
      if (readFilter === 'READ' && !r.is_read) return false;
      return true;
    });
  }, [reports, readFilter]);

  useEffect(() => {
    if (
      filteredReports.length > 0 &&
      !filteredReports.some((r) => r.report_id === selectedReportId)
    ) {
      setSelectedReportId(filteredReports[0].report_id);
    }
  }, [filteredReports, selectedReportId]);

  const selectedReport = useMemo(
    () =>
      filteredReports.find((r) => r.report_id === selectedReportId) ??
      reports.find((r) => r.report_id === selectedReportId) ??
      filteredReports[0] ??
      null,
    [filteredReports, reports, selectedReportId]
  );

  const handleMarkReportRead = async (reportId: string) => {
    if (readOnly || markingId) return;
    setReportError(null);
    setMarkingId(reportId);
    try {
      const response = await api.markReportRead(student.student_id, reportId);
      onMarkReportRead?.(reportId, response);
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : 'Không thể cập nhật trạng thái đã đọc báo cáo.'
      );
    } finally {
      setMarkingId(null);
    }
  };

  const years = useMemo(
    () => Array.from(new Set(enrollments.map((e) => e.academic_year))).sort(),
    [enrollments]
  );
  const semesters = useMemo(
    () => Array.from(new Set(enrollments.map((e) => e.semester))).sort(),
    [enrollments]
  );

  const filteredEnrollments = useMemo(
    () =>
      enrollments.filter((e) => {
        if (yearFilter !== 'ALL' && e.academic_year !== yearFilter) return false;
        if (semesterFilter !== 'ALL' && e.semester !== semesterFilter) return false;
        return true;
      }),
    [enrollments, yearFilter, semesterFilter]
  );

  const filteredSemesters = useMemo(
    () =>
      summary.semesters.filter((s) => {
        if (yearFilter !== 'ALL' && s.academic_year !== yearFilter) return false;
        if (semesterFilter !== 'ALL' && s.semester !== semesterFilter) return false;
        return true;
      }),
    [summary.semesters, yearFilter, semesterFilter]
  );

  const filteredWarnings = useMemo(
    () =>
      warnings.filter((w) => {
        if (yearFilter !== 'ALL' && w.academic_year !== yearFilter) return false;
        return true;
      }),
    [warnings, yearFilter]
  );

  const passFailStats = useMemo(() => {
    const passed = filteredEnrollments.filter((e) => e.completion_status === 'Completed').length;
    const failed = filteredEnrollments.filter((e) => e.completion_status === 'Failed').length;
    const inProgress = filteredEnrollments.filter((e) => e.completion_status === 'In Progress').length;
    const finalized = passed + failed;
    const passRate = finalized > 0 ? Math.round((passed / finalized) * 100) : 100;
    return { passed, failed, inProgress, passRate };
  }, [filteredEnrollments]);

  const gradeDistributionData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of settings.gradingScale) {
      counts.set(g.letter, 0);
    }
    for (const e of filteredEnrollments) {
      if (e.letter_grade && counts.has(e.letter_grade)) {
        counts.set(e.letter_grade, (counts.get(e.letter_grade) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([grade, count]) => ({ grade, count }));
  }, [filteredEnrollments, settings.gradingScale]);

  const gpaTrendData = useMemo(
    () =>
      filteredSemesters
        .filter((s) => s.semesterGpa !== null)
        .map((s) => ({
          term: `${s.semester.replace('Học kỳ ', 'HK')} (${s.academic_year.slice(2, 4)}-${s.academic_year.slice(7, 9)})`,
          fullTerm: `${s.semester} (${s.academic_year})`,
          semesterGpa: s.semesterGpa,
          cumulativeGpa: s.cumulativeGpa,
        })),
    [filteredSemesters]
  );

  const creditAccumulationData = useMemo(() => {
    let runningEarned = 0;
    return filteredSemesters.map((s) => {
      runningEarned += s.earnedCredits;
      return {
        term: `${s.semester.replace('Học kỳ ', 'HK')} (${s.academic_year.slice(0, 4)})`,
        termEarned: s.earnedCredits,
        termFailed: s.failedCredits,
        cumulativeEarned: runningEarned,
      };
    });
  }, [filteredSemesters]);

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    let y = 48;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(32, 36, 58);
    doc.text('UNIPORTAL - BAO CAO KET QUA HOC TAP SINH VIEN', 40, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 108, 130);
    doc.text(
      toPdfSafeText(
        `Sinh vien: ${student.full_name} (${student.student_id}) | ${student.faculty} - ${student.major}`
      ),
      40,
      y
    );
    y += 16;
    doc.text(
      toPdfSafeText(
        `Ngay xuat: ${new Date().toLocaleDateString('vi-VN')} | Bo loc: ${
          yearFilter === 'ALL' ? 'Tat ca nam hoc' : yearFilter
        } / ${semesterFilter === 'ALL' ? 'Tat ca hoc ky' : semesterFilter}`
      ),
      40,
      y
    );
    y += 24;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(32, 36, 58);
    doc.text(
      toPdfSafeText(
        `GPA tich luy: ${formatGpa(summary.cgpa)} (${summary.classification.label})  |  Tin chi dat: ${summary.earnedCredits}/${summary.totalRequiredCredits}  |  Tin chi chua dat: ${summary.failedCredits}`
      ),
      40,
      y
    );
    y += 26;

    doc.setFontSize(12);
    doc.text('TONG KET THEO HOC KY', 40, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);

    for (const s of filteredSemesters) {
      if (y > 760) {
        doc.addPage();
        y = 48;
      }
      doc.text(
        toPdfSafeText(
          `${s.semester} (${s.academic_year}) - GPA ky: ${formatGpa(s.semesterGpa)} | GPA tich luy: ${formatGpa(s.cumulativeGpa)} | Dat: ${s.earnedCredits} TC | Chua dat: ${s.failedCredits} TC`
        ),
        48,
        y
      );
      y += 15;
    }

    y += 14;
    if (y > 740) {
      doc.addPage();
      y = 48;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('BANG DIEM CHI TIET HOC PHAN (HE 10 & HE 4)', 40, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    for (const e of filteredEnrollments) {
      if (y > 770) {
        doc.addPage();
        y = 48;
      }
      doc.text(
        toPdfSafeText(
          `${e.course_code.padEnd(8)} | ${e.course_name.slice(0, 28).padEnd(29)} | ${e.semester} ${e.academic_year} | ${e.credit_hours} TC | ${formatDualGrade(e.numeric_grade, e.letter_grade, e.grade_point)} | ${translateCompletionStatus(e.completion_status)}`
        ),
        40,
        y
      );
      y += 14;
    }

    if (filteredWarnings.length > 0) {
      y += 16;
      if (y > 740) {
        doc.addPage();
        y = 48;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('LICH SU CANH BAO HOC VU', 40, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const w of filteredWarnings) {
        if (y > 770) {
          doc.addPage();
          y = 48;
        }
        doc.text(
          toPdfSafeText(
            `[${translateSeverity(w.severity)} / ${translateWarningStatus(w.warning_status)}] ${w.warning_title} (${w.academic_year}) - ${w.triggering_condition}`
          ),
          40,
          y
        );
        y += 14;
      }
    }

    doc.save(`${student.student_id}_bao_cao_hoc_tap.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Hộp thư Báo cáo học vụ (Official Academic Reports with Read/Unread Persistence) */}
      <section className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden no-print">
        <div className="px-6 py-4 border-b border-[#ECEEF5] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center shrink-0">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[#20243A]">
                  Báo cáo học vụ từ Nhà trường
                </h2>
                {unreadReportsCount > 0 ? (
                  <span
                    data-testid="reports-unread-badge"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F5AE48]/15 text-[#B77416]"
                  >
                    <BellDot className="w-3.5 h-3.5" />
                    <span>{unreadReportsCount} chưa đọc</span>
                  </span>
                ) : (
                  <span
                    data-testid="reports-unread-badge"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#36B37E]/12 text-[#238A5E]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã đọc tất cả</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#858BA3] mt-0.5">
                Theo dõi báo cáo tổng kết học kỳ, thông báo học vụ và đánh dấu đã đọc để lưu vĩnh viễn trạng thái trên hồ sơ của bạn
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl">
            {(
              [
                { id: 'ALL', label: `Tất cả (${reports.length})` },
                { id: 'UNREAD', label: `Chưa đọc (${unreadReportsCount})` },
                { id: 'READ', label: `Đã đọc (${reports.length - unreadReportsCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setReadFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  readFilter === tab.id
                    ? 'bg-white text-[#6558E8] shadow-xs border border-[#ECEEF5]'
                    : 'text-[#858BA3] hover:text-[#20243A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {reportError && (
          <div
            role="alert"
            className="mx-6 mt-4 p-3 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-xs"
          >
            {reportError}
          </div>
        )}

        {reports.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#858BA3]">
            Chưa có báo cáo học vụ nào được ban hành cho tài khoản của bạn.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#ECEEF5]">
            {/* Report List */}
            <div className="lg:col-span-5 divide-y divide-[#ECEEF5] max-h-[380px] overflow-y-auto">
              {filteredReports.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#858BA3]">
                  Không có báo cáo nào phù hợp với bộ lọc trạng thái.
                </div>
              ) : (
                filteredReports.map((rep) => {
                  const isSelected = selectedReport?.report_id === rep.report_id;
                  return (
                    <button
                      key={rep.report_id}
                      type="button"
                      onClick={() => setSelectedReportId(rep.report_id)}
                      className={`w-full text-left p-4 transition-colors flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-[#F0EDFF]/70'
                          : !rep.is_read
                            ? 'bg-[#F5AE48]/[0.04] hover:bg-[#F8F9FD]'
                            : 'hover:bg-[#F8F9FD]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <SemanticStatusBadge
                          tone={reportTypeTone(rep.report_type)}
                          label={translateReportType(rep.report_type)}
                        />
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            rep.is_read
                              ? 'bg-[#36B37E]/12 text-[#238A5E]'
                              : 'bg-[#F5AE48]/18 text-[#B77416]'
                          }`}
                        >
                          {!rep.is_read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F5AE48]" />
                          )}
                          <span>{rep.is_read ? 'Đã đọc' : 'Chưa đọc'}</span>
                        </span>
                      </div>
                      <div className="text-sm font-bold text-[#20243A] leading-snug">
                        {rep.title}
                      </div>
                      <p className="text-xs text-[#555C75] line-clamp-2">{rep.summary}</p>
                      <div className="flex items-center justify-between text-[11px] text-[#858BA3] font-mono">
                        <span>
                          {rep.semester} · {rep.academic_year}
                        </span>
                        <span>{new Date(rep.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Report Detail Reader */}
            <div className="lg:col-span-7 p-6 flex flex-col justify-between gap-5 bg-[#F8F9FD]/40">
              {selectedReport ? (
                <>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <SemanticStatusBadge
                            tone={reportTypeTone(selectedReport.report_type)}
                            label={translateReportType(selectedReport.report_type)}
                          />
                          <SemanticStatusBadge
                            tone={selectedReport.is_read ? 'success' : 'warning'}
                            label={selectedReport.is_read ? 'Đã đọc' : 'Chưa đọc'}
                          />
                          <span className="text-xs font-mono text-[#858BA3]">
                            {selectedReport.semester} · {selectedReport.academic_year}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-[#20243A]">
                          {selectedReport.title}
                        </h3>
                      </div>

                      {!readOnly && !selectedReport.is_read && onMarkReportRead && (
                        <button
                          type="button"
                          disabled={markingId === selectedReport.report_id}
                          onClick={() => void handleMarkReportRead(selectedReport.report_id)}
                          className="px-4 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] disabled:opacity-60 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          <MailOpen className="w-3.5 h-3.5" />
                          <span>
                            {markingId === selectedReport.report_id
                              ? 'Đang lưu...'
                              : 'Đánh dấu đã đọc'}
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-[#ECEEF5] text-xs font-medium text-[#20243A]">
                      {selectedReport.summary}
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-[#ECEEF5] text-sm text-[#394058] leading-relaxed whitespace-pre-line">
                      {selectedReport.content}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#ECEEF5] text-xs text-[#858BA3]">
                    <span className="font-mono">Mã báo cáo: {selectedReport.report_id}</span>
                    <span>
                      {selectedReport.is_read && selectedReport.read_at
                        ? `Đã xác nhận đọc lúc ${new Date(selectedReport.read_at).toLocaleString('vi-VN')}`
                        : `Phát hành ngày ${new Date(selectedReport.created_at).toLocaleDateString('vi-VN')}`}
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-[#858BA3]">
                  Chọn một báo cáo ở danh sách bên trái để xem chi tiết.
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Filter Toolbar & PDF Export */}
      <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            aria-label="Lọc báo cáo theo năm học"
            className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A] focus:outline-none focus:border-[#8174F7]"
          >
            <option value="ALL">Tất cả năm học</option>
            {years.map((y) => (
              <option key={y} value={y}>
                Năm học {y}
              </option>
            ))}
          </select>

          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            aria-label="Lọc báo cáo theo học kỳ"
            className="px-3.5 py-2 text-sm bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl text-[#20243A] focus:outline-none focus:border-[#8174F7]"
          >
            <option value="ALL">Tất cả học kỳ</option>
            {semesters.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleExportPdf}
          className="px-4 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Xuất báo cáo PDF</span>
        </button>
      </div>

      {/* Passed / Failed Course Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-[#858BA3]">Số học phần đạt</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#36B37E] mt-1">
              {passFailStats.passed} môn
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#36B37E]/12 text-[#36B37E] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-[#858BA3]">Số học phần chưa đạt</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#EF6472] mt-1">
              {passFailStats.failed} môn
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EF6472]/12 text-[#EF6472] flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[16px] p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-[#858BA3]">Tỷ lệ qua môn</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#6558E8] mt-1">
              {passFailStats.passRate}%
            </div>
          </div>
          <div className="text-xs font-medium text-[#858BA3] bg-[#F8F9FD] px-3 py-1.5 rounded-lg border border-[#ECEEF5]">
            {passFailStats.inProgress} môn đang học
          </div>
        </div>
      </div>

      {/* Charts Row: GPA theo học kỳ & Phân bố điểm */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
          <h2 className="text-base font-bold text-[#20243A] mb-1">
            Xu hướng GPA theo học kỳ & tích lũy
          </h2>
          <p className="text-xs text-[#858BA3] mb-4">
            So sánh điểm trung bình từng học kỳ với đường GPA tích lũy
          </p>
          <div className="h-64 w-full">
            {gpaTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#858BA3]">
                Chưa có học kỳ hoàn tất phù hợp với bộ lọc.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gpaTrendData} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                  <XAxis dataKey="term" tick={{ fontSize: 11, fill: '#858BA3' }} />
                  <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={{ fontSize: 11, fill: '#858BA3' }} />
                  <Tooltip
                    formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? ''))}
                    labelFormatter={(_, p) => p?.[0]?.payload?.fullTerm ?? ''}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="semesterGpa"
                    name="GPA học kỳ"
                    stroke="#8174F7"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#8174F7' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeGpa"
                    name="GPA tích lũy"
                    stroke="#20243A"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6">
          <h2 className="text-base font-bold text-[#20243A] mb-1">Phân bố điểm chữ (Hệ 4.0)</h2>
          <p className="text-xs text-[#858BA3] mb-4">
            Tần suất các mức điểm chữ đạt được theo bộ lọc hiện tại
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={gradeDistributionData}
                margin={{ top: 8, right: 16, left: -16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#858BA3' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#858BA3' }} />
                <Tooltip />
                <Bar dataKey="count" name="Số học phần" fill="#8174F7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Credit Accumulation Chart + Semester Report Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#ECEEF5] rounded-[18px] p-6">
          <h2 className="text-base font-bold text-[#20243A] mb-1">
            Tín chỉ tích lũy theo học kỳ
          </h2>
          <p className="text-xs text-[#858BA3] mb-4">
            Tín chỉ đạt và chưa đạt mỗi học kỳ ({summary.earnedCredits} /{' '}
            {summary.totalRequiredCredits} yêu cầu)
          </p>
          <div className="h-64 w-full">
            {creditAccumulationData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#858BA3]">
                Không có dữ liệu tín chỉ cho bộ lọc này.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={creditAccumulationData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                  <XAxis dataKey="term" tick={{ fontSize: 11, fill: '#858BA3' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#858BA3' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="termEarned" name="Tín chỉ đạt" fill="#36B37E" radius={[5, 5, 0, 0]} />
                  <Bar
                    dataKey="termFailed"
                    name="Tín chỉ chưa đạt"
                    fill="#EF6472"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#ECEEF5] flex items-center justify-between">
            <h2 className="text-base font-bold text-[#20243A]">So sánh kết quả các học kỳ</h2>
            <FileText className="w-4 h-4 text-[#858BA3]" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                  <th className="py-3 px-4">Học kỳ</th>
                  <th className="py-3 px-4">Năm học</th>
                  <th className="py-3 px-4 text-right">TC tính GPA</th>
                  <th className="py-3 px-4 text-right">TC đạt</th>
                  <th className="py-3 px-4 text-right">GPA kỳ</th>
                  <th className="py-3 px-4 text-right">GPA tích lũy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5] text-sm">
                {filteredSemesters.map((s) => (
                  <tr key={s.semesterKey} className="hover:bg-[#F8F9FD]/70">
                    <td className="py-3 px-4 font-medium text-[#20243A]">{s.semester}</td>
                    <td className="py-3 px-4 font-mono text-[#858BA3]">{s.academic_year}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {s.semesterGpaCredits}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#36B37E] font-semibold">
                      {s.earnedCredits}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-[#6558E8]">
                      {formatGpa(s.semesterGpa)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-[#20243A]">
                      {formatGpa(s.cumulativeGpa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Warning History Table */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#ECEEF5]">
          <h2 className="text-base font-bold text-[#20243A]">Lịch sử cảnh báo học vụ</h2>
        </div>
        {filteredWarnings.length === 0 ? (
          <div className="p-8 text-sm text-[#858BA3] text-center">
            Không có cảnh báo học vụ nào được ghi nhận theo bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                  <th className="py-3 px-5">Mã CB</th>
                  <th className="py-3 px-5">Tiêu đề cảnh báo</th>
                  <th className="py-3 px-5">Điều kiện kích hoạt</th>
                  <th className="py-3 px-5">Năm học</th>
                  <th className="py-3 px-5">Mức độ</th>
                  <th className="py-3 px-5">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5] text-sm">
                {filteredWarnings.map((w) => (
                  <tr key={w.warning_id} className="hover:bg-[#F8F9FD]/60">
                    <td className="py-3 px-5 font-mono text-xs text-[#6558E8]">{w.warning_id}</td>
                    <td className="py-3 px-5 font-medium text-[#20243A]">{w.warning_title}</td>
                    <td className="py-3 px-5 font-mono text-xs text-[#555C75]">
                      {w.triggering_condition}
                    </td>
                    <td className="py-3 px-5 font-mono text-xs text-[#858BA3]">
                      {w.academic_year}
                    </td>
                    <td className="py-3 px-5">
                      <SemanticStatusBadge
                        tone={w.severity === 'Critical' ? 'danger' : 'warning'}
                        label={translateSeverity(w.severity)}
                      />
                    </td>
                    <td className="py-3 px-5">
                      <SemanticStatusBadge
                        tone={w.warning_status === 'Resolved' ? 'success' : 'info'}
                        label={translateWarningStatus(w.warning_status)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { CheckCircle2, Download, FileText, XCircle } from 'lucide-react';
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
  formatGpa,
  translateCompletionStatus,
  translateSeverity,
  translateWarningStatus,
} from '../../shared/academicLogic.ts';
import { StudentOverviewResponse } from '../services/api.ts';
import { SemanticStatusBadge } from '../components/PortalUI.tsx';

function toPdfSafeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function AcademicReportsPage({ overview }: { overview: StudentOverviewResponse }) {
  const { student, summary, enrollments, warnings, settings } = overview;

  const [yearFilter, setYearFilter] = useState('ALL');
  const [semesterFilter, setSemesterFilter] = useState('ALL');

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
    doc.text('BANG DIEM CHI TIET HOC PHAN', 40, y);
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
          `${e.course_code.padEnd(8)} | ${e.course_name.slice(0, 32).padEnd(33)} | ${e.semester} ${e.academic_year} | ${e.credit_hours} TC | ${e.letter_grade ?? '-'} (${e.grade_point !== null ? e.grade_point.toFixed(2) : '-'}) | ${translateCompletionStatus(e.completion_status)}`
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
          <h2 className="text-base font-bold text-[#20243A] mb-1">Phân bố điểm chữ</h2>
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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Download,
  QrCode,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DEFAULT_TUITION_CONFIG,
  formatDisplayDate,
  formatVnd,
  StudentTuitionInvoice,
  TuitionPaymentRecord,
} from '../../shared/academicLogic.ts';
import { api, StudentOverviewResponse, StudentTuitionOverviewResponse } from '../services/api.ts';
import { PageLoadingSkeleton, SemanticStatusBadge } from '../components/PortalUI.tsx';

function toPdfSafeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function exportReceiptPdf(
  studentName: string,
  studentId: string,
  major: string,
  invoice: StudentTuitionInvoice,
  payment: TuitionPaymentRecord,
  bankName: string,
  accountNumber: string
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 52;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(32, 36, 58);
  doc.text('UNIPORTAL - BIEN LAI THANH TOAN HOC PHI', 48, y);

  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 108, 130);
  doc.text(`Ma giao dich: ${payment.transaction_ref}   |   Ma phieu: ${payment.payment_id}`, 48, y);

  y += 14;
  doc.setDrawColor(236, 238, 245);
  doc.line(48, y, 547, y);

  y += 24;
  doc.setTextColor(32, 36, 58);
  doc.setFontSize(11);
  doc.text(`Sinh vien: ${toPdfSafeText(studentName)} (${studentId})`, 48, y);
  y += 18;
  doc.text(`Nganh hoc: ${toPdfSafeText(major)}`, 48, y);
  y += 18;
  doc.text(
    `Hoc ky: ${toPdfSafeText(invoice.semester)} - Nam hoc ${invoice.academic_year}`,
    48,
    y
  );
  y += 18;
  doc.text(
    `Thoi gian xac nhan: ${new Date(payment.paid_at).toLocaleString('vi-VN')}`,
    48,
    y
  );
  y += 18;
  doc.text(`Ngan hang thu huong: ${toPdfSafeText(bankName)} (${accountNumber})`, 48, y);
  y += 18;
  doc.text(`Noi dung chuyen khoan: ${toPdfSafeText(payment.transfer_note)}`, 48, y);

  y += 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Chi tiet hoc phan tinh phi:', 48, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const c of invoice.courses) {
    if (y > 750) {
      doc.addPage();
      y = 52;
    }
    const line = `${c.course_code} - ${toPdfSafeText(c.course_name)} (${c.credit_hours} TC)`;
    const feeText = toPdfSafeText(formatVnd(c.fee));
    doc.text(line.slice(0, 62), 54, y);
    doc.text(feeText, 540, y, { align: 'right' });
    y += 16;
  }

  y += 10;
  doc.line(48, y, 547, y);
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(35, 138, 94);
  doc.text(
    `TONG DA THANH TOAN (${payment.total_credits} tin chi): ${toPdfSafeText(formatVnd(payment.amount))}`,
    48,
    y
  );
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 108, 130);
  doc.text('Trang thai: DA THANH TOAN QUA QUET MA QR', 48, y);

  doc.save(`BienLai_HocPhi_${studentId}_${invoice.academic_year}.pdf`);
}

export function TuitionPaymentPage({
  overview,
  onToast,
  onReloadWorkspace,
}: {
  overview: StudentOverviewResponse;
  onToast?: (message: string, tone?: 'success' | 'error' | 'info') => void;
  onReloadWorkspace?: () => Promise<void>;
}) {
  const { student } = overview;

  const [tuitionData, setTuitionData] = useState<StudentTuitionOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedInvoiceKey, setSelectedInvoiceKey] = useState<string>('');
  const [expandedInvoiceKeys, setExpandedInvoiceKeys] = useState<Record<string, boolean>>({});
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadTuition = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getStudentTuition(student.student_id);
      setTuitionData(res);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Không thể tải thông tin học phí.');
    } finally {
      setLoading(false);
    }
  }, [student.student_id]);

  useEffect(() => {
    void loadTuition();
  }, [loadTuition]);

  const orderedInvoices = useMemo(() => {
    if (!tuitionData) return [];
    return [...tuitionData.invoices].reverse();
  }, [tuitionData]);

  useEffect(() => {
    if (!tuitionData || orderedInvoices.length === 0) return;
    if (!selectedInvoiceKey || !orderedInvoices.some((inv) => inv.key === selectedInvoiceKey)) {
      const firstUnpaid = orderedInvoices.find((inv) => inv.status === 'UNPAID');
      const fallback = firstUnpaid ?? orderedInvoices[0];
      setSelectedInvoiceKey(fallback.key);
      setExpandedInvoiceKeys((prev) => ({ ...prev, [fallback.key]: true }));
    }
  }, [tuitionData, orderedInvoices, selectedInvoiceKey]);

  const selectedInvoice = useMemo(
    () =>
      orderedInvoices.find((inv) => inv.key === selectedInvoiceKey) ??
      orderedInvoices[0] ??
      null,
    [orderedInvoices, selectedInvoiceKey]
  );

  const debtTrendData = useMemo(() => {
    if (!tuitionData) return [];
    let cumulativeBilled = 0;
    let cumulativePaid = 0;
    return tuitionData.invoices.map((inv) => {
      cumulativeBilled += inv.totalAmount;
      if (inv.status === 'PAID') {
        cumulativePaid += inv.totalAmount;
      }
      const outstandingBalance = Math.max(0, cumulativeBilled - cumulativePaid);
      const shortSem = inv.semester
        .replace('Học kỳ ', 'HK')
        .replace('hè', 'Hè');
      const shortYear = `${inv.academic_year.slice(2, 4)}-${inv.academic_year.slice(7, 9)}`;
      return {
        name: `${shortSem} (${shortYear})`,
        fullLabel: `${inv.semester} (${inv.academic_year})`,
        termFee: inv.totalAmount,
        cumulativePaid,
        outstandingBalance,
        statusLabel: inv.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán',
      };
    });
  }, [tuitionData]);

  const activeQrImage =
    tuitionData?.config.qrImageDataUrl ||
    DEFAULT_TUITION_CONFIG.qrImageDataUrl ||
    '/assets/aistudio/image_901c93aa.png';

  const handleCopy = (fieldKey: string, value: string) => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedField(fieldKey);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === fieldKey ? null : prev));
      }, 1800);
    });
  };

  const handleConfirmPayment = async () => {
    if (!selectedInvoice || selectedInvoice.status === 'PAID' || paying) return;
    setPayError(null);
    setPaying(true);
    try {
      const result = await api.payStudentTuition(student.student_id, {
        semester: selectedInvoice.semester,
        academic_year: selectedInvoice.academic_year,
        transfer_note: selectedInvoice.transferNote,
      });
      setTuitionData(result.overview);
      onToast?.(
        `Đã xác nhận thanh toán học phí ${selectedInvoice.semester} (${selectedInvoice.academic_year}) — Mã GD ${result.payment.transaction_ref}.`,
        'success'
      );
      if (onReloadWorkspace) {
        await onReloadWorkspace();
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Không thể xác nhận thanh toán.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (loadError || !tuitionData) {
    return (
      <div className="bg-[#EF6472]/10 border border-[#EF6472]/30 rounded-[18px] p-6 flex items-center justify-between gap-4 text-[#C83D4C]">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-sm font-medium">{loadError || 'Không thể tải dữ liệu học phí.'}</div>
        </div>
        <button
          type="button"
          onClick={() => void loadTuition()}
          className="px-4 py-2 text-xs font-semibold bg-white border border-[#EF6472]/30 rounded-xl hover:bg-[#EF6472]/10"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const { config, payments, summary } = tuitionData;

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <div className="text-xs font-medium text-[#858BA3]">Tổng học phí phát sinh</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#20243A]">
            {formatVnd(summary.totalBilled)}
          </div>
          <div className="mt-1.5 text-xs text-[#858BA3]">
            Tính trên{' '}
            <span className="font-mono font-semibold text-[#20243A]">
              {summary.totalBillableCredits}
            </span>{' '}
            tín chỉ đăng ký
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <div className="text-xs font-medium text-[#858BA3]">Đã thanh toán</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#238A5E]">
            {formatVnd(summary.totalPaid)}
          </div>
          <div className="mt-1.5 text-xs text-[#858BA3]">
            Hoàn tất{' '}
            <span className="font-mono font-semibold text-[#238A5E]">{summary.paidCount}</span>{' '}
            học kỳ
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <div className="text-xs font-medium text-[#858BA3]">Còn phải đóng</div>
          <div
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              summary.totalUnpaid > 0 ? 'text-[#C83D4C]' : 'text-[#238A5E]'
            }`}
          >
            {formatVnd(summary.totalUnpaid)}
          </div>
          <div className="mt-1.5 text-xs text-[#858BA3]">
            {summary.unpaidCount > 0 ? (
              <span>
                Còn{' '}
                <span className="font-mono font-semibold text-[#C83D4C]">
                  {summary.unpaidCount}
                </span>{' '}
                học kỳ chưa nộp
              </span>
            ) : (
              'Không còn công nợ học phí'
            )}
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <div className="text-xs font-medium text-[#858BA3]">Đơn giá / tín chỉ</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#6558E8]">
            {formatVnd(config.pricePerCredit)}
          </div>
          <div className="mt-1.5 text-xs text-[#858BA3] truncate">
            Áp dụng theo quy định Phòng Đào tạo
          </div>
        </div>
      </div>

      {/* Tuition Debt & Payment Trend Line Chart */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#20243A]">
                Biến động công nợ học phí theo thời gian
              </h2>
              <p className="text-xs text-[#858BA3] mt-0.5">
                Theo dõi dư nợ còn lại, tiến độ thanh toán lũy kế và học phí phát sinh qua từng học kỳ.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#555C75]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C83D4C]" />
              <span>Công nợ còn lại</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#238A5E]" />
              <span>Đã thanh toán lũy kế</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8174F7]" />
              <span>Học phí từng kỳ</span>
            </span>
          </div>
        </div>

        {debtTrendData.length === 0 ? (
          <div className="h-60 flex items-center justify-center text-sm text-[#858BA3] border border-dashed border-[#ECEEF5] rounded-2xl">
            Chưa có dữ liệu hóa đơn học phí để hiển thị biểu đồ biến động.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={debtTrendData} margin={{ top: 12, right: 20, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEF5" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#858BA3' }}
                  axisLine={{ stroke: '#ECEEF5' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val: number) =>
                    val === 0
                      ? '0'
                      : val >= 1_000_000
                        ? `${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)} tr`
                        : `${Math.round(val / 1000)}k`
                  }
                  tick={{ fontSize: 11, fill: '#858BA3' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                    const label =
                      name === 'outstandingBalance'
                        ? 'Công nợ còn lại'
                        : name === 'cumulativePaid'
                          ? 'Đã thanh toán lũy kế'
                          : 'Học phí kỳ';
                    return [formatVnd(numeric), label];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | { fullLabel?: string; statusLabel?: string }
                      | undefined;
                    return row ? `${row.fullLabel} · ${row.statusLabel}` : '';
                  }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #ECEEF5',
                    boxShadow: '0 8px 24px rgba(32, 36, 58, 0.06)',
                    fontSize: '12px',
                  }}
                />
                {config.debtAlertThreshold > 0 && (
                  <ReferenceLine
                    y={config.debtAlertThreshold}
                    stroke="#F5AE48"
                    strokeDasharray="4 4"
                    label={{
                      value: `Ngưỡng cảnh báo (${formatVnd(config.debtAlertThreshold)})`,
                      position: 'insideTopRight',
                      fill: '#B77416',
                      fontSize: 11,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="outstandingBalance"
                  name="outstandingBalance"
                  stroke="#C83D4C"
                  strokeWidth={3}
                  dot={{ r: 4.5, fill: '#C83D4C', strokeWidth: 2, stroke: '#FFFFFF' }}
                  activeDot={{ r: 6.5, fill: '#C83D4C' }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativePaid"
                  name="cumulativePaid"
                  stroke="#238A5E"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#238A5E', strokeWidth: 2, stroke: '#FFFFFF' }}
                  activeDot={{ r: 6, fill: '#238A5E' }}
                />
                <Line
                  type="monotone"
                  dataKey="termFee"
                  name="termFee"
                  stroke="#8174F7"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3.5, fill: '#8174F7' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Main Workspace: Semester Invoices (Left) + Real QR Payment Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#20243A]">Hóa đơn học phí theo học kỳ</h2>
              <p className="text-xs text-[#858BA3] mt-0.5">
                Học phí được tính tự động từ các học phần đăng ký (số tín chỉ nguyên × đơn giá).
              </p>
            </div>
            <div className="text-xs font-mono text-[#858BA3] bg-[#F8F9FD] border border-[#ECEEF5] px-3 py-1.5 rounded-xl">
              MSSV: <span className="font-semibold text-[#20243A]">{student.student_id}</span>
            </div>
          </div>

          {orderedInvoices.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#858BA3] border border-dashed border-[#ECEEF5] rounded-2xl">
              Chưa có dữ liệu học phần tính học phí.
            </div>
          ) : (
            <div className="space-y-3">
              {orderedInvoices.map((inv) => {
                const isSelected = selectedInvoice?.key === inv.key;
                const isExpanded = Boolean(expandedInvoiceKeys[inv.key]);
                return (
                  <div
                    key={inv.key}
                    className={`rounded-2xl border transition-colors ${
                      isSelected
                        ? 'border-[#8174F7] bg-[#F8F9FD]/60'
                        : 'border-[#ECEEF5] bg-white hover:border-[#D9DDF0]'
                    }`}
                  >
                    <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInvoiceKey(inv.key);
                          setExpandedInvoiceKeys((prev) => ({
                            ...prev,
                            [inv.key]: !prev[inv.key],
                          }));
                        }}
                        className="flex items-center gap-3 text-left min-w-0 flex-1"
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#20243A]">
                              {inv.semester} ({inv.academic_year})
                            </span>
                            <SemanticStatusBadge
                              tone={inv.status === 'PAID' ? 'success' : 'warning'}
                              label={inv.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                            />
                          </div>
                          <div className="text-xs text-[#858BA3] mt-1 font-mono tabular-nums">
                            {inv.courses.length} học phần · {inv.totalCredits} tín chỉ ·{' '}
                            {formatVnd(inv.unitPrice)}/TC
                            {inv.status === 'UNPAID' && config.paymentDueDate && (
                              <span className="ml-2 text-[#6558E8]">
                                · Hạn nộp: {formatDisplayDate(config.paymentDueDate)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[#858BA3] ml-1 shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </span>
                      </button>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-bold font-mono tabular-nums text-[#20243A]">
                            {formatVnd(inv.totalAmount)}
                          </div>
                          {inv.payment && (
                            <div className="text-[11px] font-mono text-[#238A5E]">
                              {inv.payment.transaction_ref}
                            </div>
                          )}
                        </div>

                        {inv.status === 'UNPAID' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceKey(inv.key);
                              setExpandedInvoiceKeys((prev) => ({ ...prev, [inv.key]: true }));
                              setPayError(null);
                            }}
                            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors ${
                              isSelected
                                ? 'bg-[#6558E8] text-white'
                                : 'bg-[#F0EDFF] text-[#6558E8] hover:bg-[#8174F7] hover:text-white'
                            }`}
                          >
                            Thanh toán QR
                          </button>
                        ) : (
                          inv.payment && (
                            <button
                              type="button"
                              onClick={() =>
                                exportReceiptPdf(
                                  student.full_name,
                                  student.student_id,
                                  student.major,
                                  inv,
                                  inv.payment!,
                                  config.bankName,
                                  config.accountNumber
                                )
                              }
                              className="px-3 py-2 text-xs font-semibold text-[#555C75] hover:text-[#6558E8] bg-white border border-[#ECEEF5] hover:border-[#8174F7] rounded-xl inline-flex items-center gap-1.5 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Biên lai</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1">
                        <div className="overflow-x-auto bg-white border border-[#ECEEF5] rounded-xl">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[#ECEEF5] text-[#858BA3] bg-[#F8F9FD]">
                                <th className="text-left font-semibold py-2.5 px-3">Mã HP</th>
                                <th className="text-left font-semibold py-2.5 px-3">Tên học phần</th>
                                <th className="text-center font-semibold py-2.5 px-3">Tín chỉ</th>
                                <th className="text-right font-semibold py-2.5 px-3">Thành tiền</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ECEEF5]">
                              {inv.courses.map((course) => (
                                <tr key={course.enrollment_id}>
                                  <td className="py-2.5 px-3 font-mono font-semibold text-[#20243A]">
                                    {course.course_code}
                                  </td>
                                  <td className="py-2.5 px-3 text-[#20243A]">
                                    {course.course_name}
                                    {course.is_repeated === 1 && (
                                      <span className="ml-1.5 text-[11px] text-[#B77416]">
                                        (Học cải thiện/lại)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono tabular-nums text-[#20243A]">
                                    {course.credit_hours}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-[#20243A]">
                                    {formatVnd(course.fee)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel: Direct QR Payment Portal */}
        <div className="lg:col-span-5 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-5 lg:sticky lg:top-20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#20243A]">Cổng thanh toán QR</h2>
              <p className="text-xs text-[#858BA3] mt-0.5">
                Quét mã VietQR bằng ứng dụng ngân hàng trên điện thoại để thanh toán học phí.
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
          </div>

          {!selectedInvoice ? (
            <div className="py-8 text-center text-xs text-[#858BA3]">
              Chọn một học kỳ bên trái để xem thông tin thanh toán.
            </div>
          ) : (
            <>
              <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5] flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium text-[#858BA3]">Kỳ đang chọn</div>
                  <div className="text-sm font-bold text-[#20243A]">
                    {selectedInvoice.semester} · {selectedInvoice.academic_year}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-medium text-[#858BA3]">Số tiền</div>
                  <div className="text-base font-bold font-mono tabular-nums text-[#6558E8]">
                    {formatVnd(selectedInvoice.totalAmount)}
                  </div>
                </div>
              </div>

              {/* Direct QR Display */}
              <div className="rounded-2xl border border-[#ECEEF5] bg-[#F8F9FD]/60 p-5 flex flex-col items-center text-center space-y-2.5">
                <div className="bg-white p-3 rounded-2xl border border-[#ECEEF5] shadow-xs">
                  <img
                    src={activeQrImage}
                    alt="Mã QR thanh toán học phí VietQR"
                    className="w-56 h-56 object-contain rounded-xl"
                  />
                </div>
                <div className="text-xs font-medium text-[#555C75]">
                  Mã QR thanh toán chính thức · VietQR / Napas 247
                </div>
              </div>

              {/* Bank Transfer Info */}
              <div className="space-y-2.5 text-xs border border-[#ECEEF5] rounded-2xl p-4">
                <div className="flex items-center gap-2 font-bold text-[#20243A] pb-1 border-b border-[#ECEEF5]">
                  <Building2 className="w-4 h-4 text-[#8174F7]" />
                  <span>Thông tin chuyển khoản</span>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="text-[#858BA3] shrink-0">Ngân hàng</span>
                  <span className="font-medium text-[#20243A] text-right">{config.bankName}</span>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-[#858BA3] shrink-0">Số tài khoản</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-[#20243A] tabular-nums">
                      {config.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('account', config.accountNumber)}
                      className="p-1 text-[#858BA3] hover:text-[#6558E8] rounded-md"
                      title="Sao chép số tài khoản"
                    >
                      {copiedField === 'account' ? (
                        <Check className="w-3.5 h-3.5 text-[#238A5E]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="text-[#858BA3] shrink-0">Chủ tài khoản</span>
                  <span className="font-semibold text-[#20243A] text-right">
                    {config.accountHolder}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-[#858BA3] shrink-0">Số tiền chính xác</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#6558E8] tabular-nums">
                      {formatVnd(selectedInvoice.totalAmount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('amount', String(selectedInvoice.totalAmount))}
                      className="p-1 text-[#858BA3] hover:text-[#6558E8] rounded-md"
                      title="Sao chép số tiền"
                    >
                      {copiedField === 'amount' ? (
                        <Check className="w-3.5 h-3.5 text-[#238A5E]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-[#858BA3] shrink-0">Nội dung CK</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-semibold text-[#20243A] truncate">
                      {selectedInvoice.transferNote}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('note', selectedInvoice.transferNote)}
                      className="p-1 text-[#858BA3] hover:text-[#6558E8] rounded-md shrink-0"
                      title="Sao chép nội dung chuyển khoản"
                    >
                      {copiedField === 'note' ? (
                        <Check className="w-3.5 h-3.5 text-[#238A5E]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {payError && (
                <div className="p-3 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              {selectedInvoice.status === 'UNPAID' ? (
                <button
                  type="button"
                  disabled={paying}
                  onClick={() => void handleConfirmPayment()}
                  className="w-full py-3 px-4 bg-[#8174F7] hover:bg-[#6558E8] disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {paying ? 'Đang ghi nhận giao dịch...' : 'Xác nhận đã quét QR & Thanh toán'}
                  </span>
                </button>
              ) : (
                <div className="p-4 rounded-2xl bg-[#36B37E]/10 border border-[#36B37E]/30 space-y-3">
                  <div className="flex items-center gap-2 text-[#238A5E] text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Học kỳ này đã thanh toán hoàn tất</span>
                  </div>
                  {selectedInvoice.payment && (
                    <div className="flex items-center justify-between gap-2 text-xs text-[#20243A]">
                      <span className="font-mono">{selectedInvoice.payment.transaction_ref}</span>
                      <button
                        type="button"
                        onClick={() =>
                          exportReceiptPdf(
                            student.full_name,
                            student.student_id,
                            student.major,
                            selectedInvoice,
                            selectedInvoice.payment!,
                            config.bankName,
                            config.accountNumber
                          )
                        }
                        className="px-3 py-1.5 bg-white border border-[#36B37E]/35 text-[#238A5E] hover:bg-[#36B37E]/10 rounded-lg font-semibold inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải biên lai PDF</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F0EDFF] text-[#6558E8] flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#20243A]">Lịch sử giao dịch học phí</h2>
              <p className="text-xs text-[#858BA3]">
                Lưu trữ các giao dịch thanh toán QR và cho phép tải biên lai điện tử.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-[#858BA3]">
            {payments.length} giao dịch
          </span>
        </div>

        {payments.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#858BA3] border border-dashed border-[#ECEEF5] rounded-2xl">
            Chưa có giao dịch thanh toán học phí nào được ghi nhận.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#ECEEF5] rounded-2xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-[#858BA3]">
                  <th className="text-left font-semibold py-3 px-4">Mã giao dịch</th>
                  <th className="text-left font-semibold py-3 px-4">Học kỳ</th>
                  <th className="text-center font-semibold py-3 px-4">Tín chỉ</th>
                  <th className="text-right font-semibold py-3 px-4">Số tiền</th>
                  <th className="text-left font-semibold py-3 px-4">Nội dung CK</th>
                  <th className="text-left font-semibold py-3 px-4">Thời gian</th>
                  <th className="text-center font-semibold py-3 px-4">Trạng thái</th>
                  <th className="text-right font-semibold py-3 px-4">Biên lai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEEF5]">
                {payments.map((p) => {
                  const matchedInvoice = tuitionData.invoices.find(
                    (inv) => inv.semester === p.semester && inv.academic_year === p.academic_year
                  );
                  return (
                    <tr key={p.payment_id} className="hover:bg-[#F8F9FD]/60">
                      <td className="py-3 px-4 font-mono font-semibold text-[#20243A]">
                        {p.transaction_ref}
                      </td>
                      <td className="py-3 px-4 text-[#20243A]">
                        {p.semester} ({p.academic_year})
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-[#20243A]">
                        {p.total_credits}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#20243A]">
                        {formatVnd(p.amount)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#555C75]">{p.transfer_note}</td>
                      <td className="py-3 px-4 font-mono text-[#858BA3]">
                        {new Date(p.paid_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <SemanticStatusBadge tone="success" label="Đã thanh toán" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {matchedInvoice && (
                          <button
                            type="button"
                            onClick={() =>
                              exportReceiptPdf(
                                student.full_name,
                                student.student_id,
                                student.major,
                                matchedInvoice,
                                p,
                                config.bankName,
                                config.accountNumber
                              )
                            }
                            className="px-2.5 py-1.5 text-xs font-semibold text-[#6558E8] hover:bg-[#F0EDFF] border border-[#ECEEF5] rounded-lg inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

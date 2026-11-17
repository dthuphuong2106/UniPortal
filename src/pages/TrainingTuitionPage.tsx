import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ImagePlus,
  QrCode,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  buildTuitionTransferNote,
  formatVnd,
  TuitionPaymentRecord,
} from '../../shared/academicLogic.ts';
import { api, TrainingTuitionOverviewResponse } from '../services/api.ts';
import { ConfirmModal, PageLoadingSkeleton, SemanticStatusBadge } from '../components/PortalUI.tsx';

const MAX_QR_FILE_BYTES = 2.5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

export function TrainingTuitionPage({
  onToast,
}: {
  onToast?: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const [data, setData] = useState<TrainingTuitionOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Config form state
  const [pricePerCredit, setPricePerCredit] = useState('850000');
  const [debtAlertThreshold, setDebtAlertThreshold] = useState('5000000');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [transferNotePrefix, setTransferNotePrefix] = useState('HOCPHI');
  const [qrImageDataUrl, setQrImageDataUrl] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Filters & reset confirmation
  const [searchQuery, setSearchQuery] = useState('');
  const [debtFilter, setDebtFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [paymentToReset, setPaymentToReset] = useState<TuitionPaymentRecord | null>(null);

  const syncFormFromConfig = (overview: TrainingTuitionOverviewResponse) => {
    setPricePerCredit(String(overview.config.pricePerCredit));
    setDebtAlertThreshold(String(overview.config.debtAlertThreshold ?? 5000000));
    setBankName(overview.config.bankName);
    setAccountNumber(overview.config.accountNumber);
    setAccountHolder(overview.config.accountHolder);
    setTransferNotePrefix(overview.config.transferNotePrefix);
    setQrImageDataUrl(overview.config.qrImageDataUrl);
  };

  const loadTrainingTuition = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getTrainingTuition();
      setData(res);
      syncFormFromConfig(res);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Không thể tải dữ liệu học phí.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrainingTuition();
  }, [loadTrainingTuition]);

  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfigError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setConfigError('Định dạng ảnh không hợp lệ. Vui lòng chọn PNG, JPG, WEBP hoặc GIF.');
      return;
    }
    if (file.size > MAX_QR_FILE_BYTES) {
      setConfigError('Dung lượng ảnh QR vượt quá 2.5MB. Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setQrImageDataUrl(reader.result);
      }
    };
    reader.onerror = () => {
      setConfigError('Không thể đọc tệp ảnh mã QR.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);
    const parsedPrice = Number(pricePerCredit);
    if (!Number.isInteger(parsedPrice) || parsedPrice < 1000 || parsedPrice > 50_000_000) {
      setConfigError('Đơn giá tín chỉ phải là số nguyên từ 1.000 đ đến 50.000.000 đ.');
      return;
    }
    const parsedThreshold = Number(debtAlertThreshold);
    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 500_000_000) {
      setConfigError('Ngưỡng cảnh báo công nợ phải là số nguyên không âm (tối đa 500.000.000 đ).');
      return;
    }
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim() || !transferNotePrefix.trim()) {
      setConfigError('Vui lòng nhập đầy đủ thông tin tài khoản ngân hàng và tiền tố nội dung.');
      return;
    }

    setSavingConfig(true);
    try {
      const res = await api.updateTuitionConfig({
        pricePerCredit: parsedPrice,
        debtAlertThreshold: parsedThreshold,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        transferNotePrefix: transferNotePrefix.trim().toUpperCase(),
        qrImageDataUrl,
      });
      setData(res.overview);
      syncFormFromConfig(res.overview);
      onToast?.('Đã lưu cấu hình đơn giá học phí và ảnh mã QR chính thức.', 'success');
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Không thể lưu cấu hình học phí.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleResetPayment = async () => {
    if (!paymentToReset) return;
    const target = paymentToReset;
    setPaymentToReset(null);
    try {
      const res = await api.deleteTuitionPayment(target.payment_id);
      setData(res.overview);
      onToast?.(
        `Đã đặt lại trạng thái chưa thanh toán cho ${target.student_id} (${target.semester} ${target.academic_year}).`,
        'info'
      );
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : 'Không thể hoàn tác giao dịch học phí.',
        'error'
      );
    }
  };

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.studentSummaries.filter((s) => {
      if (debtFilter === 'UNPAID' && s.totalUnpaid <= 0) return false;
      if (debtFilter === 'PAID' && s.totalUnpaid > 0) return false;
      if (
        q &&
        !s.student_id.toLowerCase().includes(q) &&
        !s.full_name.toLowerCase().includes(q) &&
        !s.major.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data, searchQuery, debtFilter]);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (loadError || !data) {
    return (
      <div className="bg-[#EF6472]/10 border border-[#EF6472]/30 rounded-[18px] p-6 flex items-center justify-between gap-4 text-[#C83D4C]">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-sm font-medium">{loadError || 'Không thể tải dữ liệu học phí.'}</div>
        </div>
        <button
          type="button"
          onClick={() => void loadTrainingTuition()}
          className="px-4 py-2 text-xs font-semibold bg-white border border-[#EF6472]/30 rounded-xl"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const { totals, payments } = data;

  return (
    <div className="space-y-6">
      {/* Institution Tuition KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <div className="text-xs font-medium text-[#858BA3]">Tổng học phí phát sinh</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#20243A]">
            {formatVnd(totals.totalBilled)}
          </div>
          <div className="mt-1.5 text-xs text-[#858BA3]">
            Trên toàn bộ sinh viên đang quản lý
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <div className="text-xs font-medium text-[#858BA3]">Đã thu thực tế</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#238A5E]">
            {formatVnd(totals.totalCollected)}
          </div>
          <div className="mt-1.5 text-xs text-[#858BA3]">
            <span className="font-mono font-semibold text-[#238A5E]">
              {totals.totalTransactions}
            </span>{' '}
            giao dịch đã xác nhận
          </div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <div className="text-xs font-medium text-[#858BA3]">Công nợ còn lại</div>
          <div
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              totals.totalOutstanding > 0 ? 'text-[#C83D4C]' : 'text-[#238A5E]'
            }`}
          >
            {formatVnd(totals.totalOutstanding)}
          </div>
          <div className="mt-1.5 text-xs text-[#858BA3]">Chờ sinh viên quét QR xác nhận</div>
        </div>

        <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-5">
          <div className="text-xs font-medium text-[#858BA3]">Tỷ lệ hoàn tất</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#6558E8]">
            {totals.collectionRate}%
          </div>
          <div className="mt-1.5 text-xs text-[#858BA3]">
            Đơn giá hiện tại:{' '}
            <span className="font-mono font-semibold text-[#20243A]">
              {formatVnd(data.config.pricePerCredit)}
            </span>
            /TC
          </div>
        </div>
      </div>

      {/* Config & Official QR Upload */}
      <form
        onSubmit={handleSaveConfig}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white border border-[#ECEEF5] rounded-[18px] p-6"
      >
        <div className="lg:col-span-7 space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#20243A]">
              Cấu hình đơn giá &amp; tài khoản thu học phí
            </h2>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Thiết lập đơn giá mỗi tín chỉ và thông tin chuyển khoản hiển thị tại cổng thanh toán của sinh viên.
            </p>
          </div>

          {configError && (
            <div className="p-3 rounded-xl bg-[#EF6472]/10 border border-[#EF6472]/30 text-[#C83D4C] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{configError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Đơn giá / 1 tín chỉ (VNĐ)
              </label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={pricePerCredit}
                onChange={(e) => setPricePerCredit(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Ngưỡng cảnh báo công nợ (VNĐ)
              </label>
              <input
                type="number"
                min="0"
                step="100000"
                value={debtAlertThreshold}
                onChange={(e) => setDebtAlertThreshold(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Tiền tố nội dung chuyển khoản
              </label>
              <input
                type="text"
                value={transferNotePrefix}
                onChange={(e) => setTransferNotePrefix(e.target.value.toUpperCase())}
                placeholder="HOCPHI"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#20243A] mb-1.5">
              Tên ngân hàng thụ hưởng
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Số tài khoản ngân hàng
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#20243A] mb-1.5">
                Chủ tài khoản
              </label>
              <input
                type="text"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7]"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#ECEEF5] text-xs text-[#555C75] flex flex-wrap items-center justify-between gap-2">
            <span>Mẫu nội dung chuyển khoản tự động:</span>
            <span className="font-mono font-semibold text-[#6558E8]">
              {buildTuitionTransferNote(transferNotePrefix, '22000100', 'Học kỳ 1', '2025-2026')}
            </span>
          </div>

          <button
            type="submit"
            disabled={savingConfig}
            className="px-5 py-2.5 bg-[#8174F7] hover:bg-[#6558E8] disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{savingConfig ? 'Đang lưu cấu hình...' : 'Lưu cấu hình học phí & QR'}</span>
          </button>
        </div>

        {/* Official University QR Upload */}
        <div className="lg:col-span-5 rounded-2xl border border-[#ECEEF5] bg-[#F8F9FD]/60 p-5 flex flex-col items-center justify-center text-center space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#20243A]">
            <QrCode className="w-4 h-4 text-[#6558E8]" />
            <span>Ảnh mã QR chính thức của Nhà trường</span>
          </div>
          <p className="text-xs text-[#858BA3] max-w-xs">
            Tải ảnh mã QR thật (PNG/JPG/WEBP ≤ 2.5MB). Tất cả sinh viên sẽ nhìn thấy mã này khi thanh toán học phí.
          </p>

          {qrImageDataUrl ? (
            <div className="bg-white p-3 rounded-2xl border border-[#ECEEF5] shadow-xs">
              <img
                src={qrImageDataUrl}
                alt="Mã QR thu học phí chính thức"
                className="w-48 h-48 object-contain rounded-xl"
              />
            </div>
          ) : (
            <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-[#D5D9EC] bg-white flex flex-col items-center justify-center px-4">
              <ImagePlus className="w-8 h-8 text-[#8174F7] mb-2" />
              <span className="text-xs font-medium text-[#858BA3]">Chưa tải ảnh QR lên</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <label className="cursor-pointer px-3.5 py-2 text-xs font-semibold text-[#6558E8] bg-white hover:bg-[#F0EDFF] border border-[#8174F7]/35 rounded-xl inline-flex items-center gap-1.5 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>{qrImageDataUrl ? 'Thay ảnh QR' : 'Tải ảnh QR thật'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleQrFileChange}
                className="hidden"
              />
            </label>

            {qrImageDataUrl && (
              <button
                type="button"
                onClick={() => setQrImageDataUrl(null)}
                className="px-3 py-2 text-xs font-medium text-[#C83D4C] bg-white border border-[#EF6472]/30 hover:bg-[#EF6472]/10 rounded-xl inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Gỡ ảnh</span>
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Student Tuition Ledger */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#20243A]">Theo dõi học phí sinh viên</h2>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Tổng hợp số tiền phải đóng, đã thanh toán và công nợ hiện hành của từng sinh viên.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#858BA3] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm MSSV hoặc họ tên..."
                className="pl-8 pr-3 py-2 text-xs border border-[#ECEEF5] rounded-xl focus:outline-none focus:border-[#8174F7] w-56"
              />
            </div>

            <select
              value={debtFilter}
              onChange={(e) => setDebtFilter(e.target.value as 'ALL' | 'UNPAID' | 'PAID')}
              className="px-3 py-2 text-xs border border-[#ECEEF5] rounded-xl bg-white focus:outline-none focus:border-[#8174F7]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="UNPAID">Còn công nợ</option>
              <option value="PAID">Đã hoàn tất</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-[#ECEEF5] rounded-2xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-[#858BA3]">
                <th className="text-left font-semibold py-3 px-4">MSSV</th>
                <th className="text-left font-semibold py-3 px-4">Sinh viên</th>
                <th className="text-center font-semibold py-3 px-4">Tín chỉ</th>
                <th className="text-right font-semibold py-3 px-4">Tổng học phí</th>
                <th className="text-right font-semibold py-3 px-4">Đã đóng</th>
                <th className="text-right font-semibold py-3 px-4">Còn nợ</th>
                <th className="text-center font-semibold py-3 px-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5]">
              {filteredStudents.map((s) => (
                <tr key={s.student_id} className="hover:bg-[#F8F9FD]/60">
                  <td className="py-3 px-4 font-mono font-semibold text-[#20243A]">
                    {s.student_id}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#20243A]">{s.full_name}</div>
                    <div className="text-[11px] text-[#858BA3]">{s.major}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono tabular-nums text-[#20243A]">
                    {s.totalCredits}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#20243A]">
                    {formatVnd(s.totalBilled)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-[#238A5E]">
                    {formatVnd(s.totalPaid)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                      s.totalUnpaid > 0 ? 'text-[#C83D4C]' : 'text-[#238A5E]'
                    }`}
                  >
                    {formatVnd(s.totalUnpaid)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <SemanticStatusBadge
                      tone={s.totalUnpaid > 0 ? 'warning' : 'success'}
                      label={
                        s.totalUnpaid > 0
                          ? `Nợ ${s.unpaidSemestersCount} kỳ`
                          : 'Hoàn tất'
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Audit Log with Reset/Test capability */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#20243A]">Lịch sử giao dịch thanh toán QR</h2>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Quản lý toàn bộ giao dịch đã xác nhận; có thể đặt lại giao dịch thử nghiệm về trạng thái chưa nộp để kiểm thử quét QR lại.
            </p>
          </div>
          <span className="text-xs font-mono text-[#858BA3]">{payments.length} giao dịch</span>
        </div>

        <div className="overflow-x-auto border border-[#ECEEF5] rounded-2xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-[#858BA3]">
                <th className="text-left font-semibold py-3 px-4">Mã GD</th>
                <th className="text-left font-semibold py-3 px-4">Sinh viên</th>
                <th className="text-left font-semibold py-3 px-4">Học kỳ</th>
                <th className="text-right font-semibold py-3 px-4">Số tiền</th>
                <th className="text-left font-semibold py-3 px-4">Nội dung CK</th>
                <th className="text-left font-semibold py-3 px-4">Thời gian</th>
                <th className="text-right font-semibold py-3 px-4">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5]">
              {payments.map((p) => (
                <tr key={p.payment_id} className="hover:bg-[#F8F9FD]/60">
                  <td className="py-3 px-4 font-mono font-semibold text-[#20243A]">
                    {p.transaction_ref}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#20243A]">
                      {p.student_name || p.student_id}
                    </div>
                    <div className="text-[11px] font-mono text-[#858BA3]">{p.student_id}</div>
                  </td>
                  <td className="py-3 px-4 text-[#20243A]">
                    {p.semester} ({p.academic_year})
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#238A5E]">
                    {formatVnd(p.amount)}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#555C75]">{p.transfer_note}</td>
                  <td className="py-3 px-4 font-mono text-[#858BA3]">
                    {new Date(p.paid_at).toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setPaymentToReset(p)}
                      className="px-2.5 py-1.5 text-xs font-medium text-[#C83D4C] hover:bg-[#EF6472]/10 border border-[#EF6472]/30 rounded-lg inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Đặt lại</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(paymentToReset)}
        title="Đặt lại trạng thái thanh toán?"
        message={
          paymentToReset
            ? `Hóa đơn ${paymentToReset.semester} (${paymentToReset.academic_year}) của sinh viên ${paymentToReset.student_id} (Mã GD: ${paymentToReset.transaction_ref}) sẽ được chuyển về trạng thái Chưa thanh toán để kiểm thử quét QR lại.`
            : ''
        }
        confirmLabel="Xác nhận đặt lại"
        danger={true}
        onConfirm={() => void handleResetPayment()}
        onCancel={() => setPaymentToReset(null)}
      />
    </div>
  );
}

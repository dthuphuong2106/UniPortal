import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import {
  calculateTargetGpaPlan,
  formatGpa,
  roundGpa,
  TargetGpaCalculationResult,
} from '../../shared/academicLogic.ts';
import { StudentOverviewResponse } from '../services/api.ts';
import { GpaCalculatorPage } from './GpaCalculatorPage.tsx';

interface PlannedFutureCourse {
  id: string;
  name: string;
  credits: number;
  letterGrade: string;
}

const PRESET_GOALS = [
  { label: 'Khá', gpa: 2.5 },
  { label: 'Giỏi', gpa: 3.2 },
  { label: 'Xuất sắc', gpa: 3.6 },
];

export function TargetGpaPlannerPage({ overview }: { overview: StudentOverviewResponse }) {
  const [activeTab, setActiveTab] = useState<'planner' | 'calculator'>('planner');
  const { summary, settings } = overview;

  const [currentCgpaStr, setCurrentCgpaStr] = useState(
    summary.cgpa !== null ? summary.cgpa.toFixed(2) : '2.80'
  );
  const [currentCreditsStr, setCurrentCreditsStr] = useState(
    String(summary.gpaEligibleCredits > 0 ? summary.gpaEligibleCredits : 60)
  );
  const [targetCgpaStr, setTargetCgpaStr] = useState('3.20');
  const [futureCreditsStr, setFutureCreditsStr] = useState(
    String(summary.remainingCreditsToGraduation > 0 ? summary.remainingCreditsToGraduation : 45)
  );
  const [expectedCourseCountStr, setExpectedCourseCountStr] = useState('4');

  const [result, setResult] = useState<TargetGpaCalculationResult>(() =>
    calculateTargetGpaPlan({
      currentCgpa: summary.cgpa !== null ? summary.cgpa : 2.8,
      currentCredits: summary.gpaEligibleCredits > 0 ? summary.gpaEligibleCredits : 60,
      targetCgpa: 3.2,
      futureCredits:
        summary.remainingCreditsToGraduation > 0 ? summary.remainingCreditsToGraduation : 45,
    })
  );

  useEffect(() => {
    const curGpa = summary.cgpa !== null ? summary.cgpa : 0;
    const curCr = summary.gpaEligibleCredits;
    const futCr = summary.remainingCreditsToGraduation > 0 ? summary.remainingCreditsToGraduation : 15;
    setCurrentCgpaStr(curGpa.toFixed(2));
    setCurrentCreditsStr(String(curCr));
    setFutureCreditsStr(String(futCr));
    setResult(
      calculateTargetGpaPlan({
        currentCgpa: curGpa,
        currentCredits: curCr,
        targetCgpa: Number(targetCgpaStr) || 3.2,
        futureCredits: futCr,
      })
    );
  }, [summary.cgpa, summary.gpaEligibleCredits, summary.remainingCreditsToGraduation]);

  const [futureCourses, setFutureCourses] = useState<PlannedFutureCourse[]>([
    { id: 'fc-1', name: 'Học phần dự kiến 1', credits: 3, letterGrade: 'A' },
    { id: 'fc-2', name: 'Học phần dự kiến 2', credits: 3, letterGrade: 'B+' },
    { id: 'fc-3', name: 'Học phần dự kiến 3', credits: 3, letterGrade: 'A-' },
    { id: 'fc-4', name: 'Học phần dự kiến 4', credits: 3, letterGrade: 'B+' },
  ]);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentCgpaStr.trim() === '' || currentCreditsStr.trim() === '') {
      setResult({
        valid: false,
        errorMessage:
          'Vui lòng nhập GPA tích lũy hiện tại và số tín chỉ hợp lệ đã tích lũy.',
        currentCgpa: 0,
        currentCredits: 0,
        targetCgpa: Number(targetCgpaStr) || 0,
        futureCredits: Number(futureCreditsStr) || 0,
        requiredFutureGpa: null,
        projectedFinalCgpa: null,
        feasibilityStatus: 'invalid',
        statusTitle: 'Thiếu dữ liệu đầu vào',
        explanation: 'Vui lòng cung cấp GPA hiện tại và số tín chỉ đã tích lũy hợp lệ.',
      });
      return;
    }

    const res = calculateTargetGpaPlan({
      currentCgpa: Number(currentCgpaStr),
      currentCredits: Number(currentCreditsStr),
      targetCgpa: Number(targetCgpaStr),
      futureCredits: Number(futureCreditsStr),
    });
    setResult(res);
  };

  const applyPreset = (gpa: number) => {
    const str = gpa.toFixed(2);
    setTargetCgpaStr(str);
    setResult(
      calculateTargetGpaPlan({
        currentCgpa: Number(currentCgpaStr),
        currentCredits: Number(currentCreditsStr),
        targetCgpa: gpa,
        futureCredits: Number(futureCreditsStr),
      })
    );
  };

  const handleSyncToMyRecords = () => {
    const curGpa = summary.cgpa !== null ? summary.cgpa.toFixed(2) : '0.00';
    const curCr = String(summary.gpaEligibleCredits);
    const futCr = String(summary.remainingCreditsToGraduation);
    setCurrentCgpaStr(curGpa);
    setCurrentCreditsStr(curCr);
    setFutureCreditsStr(futCr);
    setResult(
      calculateTargetGpaPlan({
        currentCgpa: Number(curGpa),
        currentCredits: Number(curCr),
        targetCgpa: Number(targetCgpaStr),
        futureCredits: Number(futCr),
      })
    );
  };

  const generateCoursesFromCount = () => {
    const count = Math.max(1, Math.min(20, Math.round(Number(expectedCourseCountStr) || 4)));
    const targetTotalFuture = Math.max(3, Number(futureCreditsStr) || count * 3);
    const avgCredit = Math.max(1, Math.round(targetTotalFuture / count));
    const list: PlannedFutureCourse[] = [];
    for (let i = 0; i < count; i++) {
      list.push({
        id: `fc-${Date.now()}-${i}`,
        name: `Học phần dự kiến ${i + 1}`,
        credits: avgCredit,
        letterGrade: 'B+',
      });
    }
    setFutureCourses(list);
  };

  const coursePlanMetrics = useMemo(() => {
    const curGpa = Math.max(0, Number(currentCgpaStr) || 0);
    const curCr = Math.max(0, Number(currentCreditsStr) || 0);
    const pointMap = new Map(settings.gradingScale.map((g) => [g.letter, g.point]));

    let plannedCredits = 0;
    let plannedWeighted = 0;
    for (const fc of futureCourses) {
      if (fc.credits > 0) {
        const pt = pointMap.get(fc.letterGrade) ?? 0;
        plannedCredits += fc.credits;
        plannedWeighted += fc.credits * pt;
      }
    }

    const plannedTermGpa = plannedCredits > 0 ? roundGpa(plannedWeighted / plannedCredits) : null;
    const totalCredits = curCr + plannedCredits;
    const projectedCgpa =
      totalCredits > 0
        ? roundGpa((curGpa * curCr + plannedWeighted) / totalCredits)
        : null;

    return {
      plannedCredits,
      plannedWeighted: roundGpa(plannedWeighted),
      plannedTermGpa,
      projectedCgpa,
    };
  }, [futureCourses, currentCgpaStr, currentCreditsStr, settings.gradingScale]);

  const handleSuggestGrades = () => {
    const curGpa = Math.max(0, Number(currentCgpaStr) || 0);
    const curCr = Math.max(0, Number(currentCreditsStr) || 0);
    const targetGpa = Math.min(4.0, Math.max(0, Number(targetCgpaStr) || 3.2));
    const plannedCredits = futureCourses.reduce((acc, c) => acc + Math.max(0, c.credits), 0);
    if (plannedCredits <= 0) return;

    const reqGpa = (targetGpa * (curCr + plannedCredits) - curGpa * curCr) / plannedCredits;
    const sortedAsc = [...settings.gradingScale].sort((a, b) => a.point - b.point);
    const lowest = sortedAsc[0];

    const indices = futureCourses.map(() => {
      const idx = sortedAsc.findIndex((g) => g.point >= Math.min(4.0, Math.max(0, reqGpa)));
      return idx >= 0 ? Math.max(0, idx - 1) : sortedAsc.length - 1;
    });

    const evalAvg = () => {
      let w = 0;
      for (let i = 0; i < futureCourses.length; i++) {
        w += futureCourses[i].credits * (sortedAsc[indices[i]]?.point ?? lowest.point);
      }
      return w / plannedCredits;
    };

    let guard = 0;
    while (evalAvg() < Math.min(4.0, reqGpa) && guard < 200) {
      guard++;
      let bumped = false;
      for (let i = 0; i < futureCourses.length; i++) {
        if (indices[i] < sortedAsc.length - 1) {
          indices[i] += 1;
          bumped = true;
          if (evalAvg() >= Math.min(4.0, reqGpa)) break;
        }
      }
      if (!bumped) break;
    }

    setFutureCourses((prev) =>
      prev.map((c, idx) => ({
        ...c,
        letterGrade: sortedAsc[indices[idx]]?.letter ?? 'A',
      }))
    );
  };

  const bannerStyles = {
    achieved: 'bg-[#36B37E]/10 border-[#36B37E]/30 text-[#1F7A54]',
    achievable: 'bg-[#F0EDFF] border-[#8174F7]/30 text-[#20243A]',
    challenging: 'bg-[#F5AE48]/12 border-[#F5AE48]/35 text-[#9A5F0D]',
    impossible: 'bg-[#EF6472]/10 border-[#EF6472]/30 text-[#C83D4C]',
    invalid: 'bg-[#EF6472]/10 border-[#EF6472]/30 text-[#C83D4C]',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#ECEEF5] rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('planner')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors ${
              activeTab === 'planner'
                ? 'bg-[#8174F7] text-white'
                : 'text-[#555C75] hover:text-[#20243A]'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Kế hoạch GPA mục tiêu</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors ${
              activeTab === 'calculator'
                ? 'bg-[#8174F7] text-white'
                : 'text-[#555C75] hover:text-[#20243A]'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Tính &amp; Mô phỏng GPA học kỳ</span>
          </button>
        </div>
      </div>

      {activeTab === 'calculator' ? (
        <GpaCalculatorPage overview={overview} />
      ) : (
        <>
          {/* Top Inspiring Header */}
          <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#F0EDFF] text-[#8174F7] flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#20243A]">Chinh phục GPA mục tiêu toàn khóa học</h2>
            <p className="text-sm text-[#858BA3] mt-0.5">
              Sử dụng GPA tích lũy hiện tại ({formatGpa(summary.cgpa)}) trên toàn bộ{' '}
              <strong className="text-[#20243A]">{summary.gpaEligibleCredits}</strong> tín chỉ đã hoàn tất và quy chế{' '}
              <strong className="text-[#6558E8]">
                {settings.gpaPolicy.repeatPolicy === 'replace_highest'
                  ? 'lấy điểm cao nhất khi học lại'
                  : settings.gpaPolicy.repeatPolicy === 'replace_latest'
                    ? 'lấy điểm lần học gần nhất'
                    : 'tính tất cả lần học'}
              </strong>
              .
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSyncToMyRecords}
          className="px-3.5 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap self-start sm:self-center transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Đồng bộ từ bảng điểm</span>
        </button>
      </div>

      {/* Main 2-Column Goal Form & Lavender Result */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleCalculate}
          className="lg:col-span-6 bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-5"
        >
          <div>
            <div className="text-xs font-semibold text-[#858BA3] uppercase tracking-wider mb-2.5">
              Chọn nhanh mục tiêu xếp loại
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {PRESET_GOALS.map((preset) => {
                const active = Number(targetCgpaStr) === preset.gpa;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset.gpa)}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                      active
                        ? 'bg-[#8174F7] text-white border-[#8174F7]'
                        : 'bg-[#F8F9FD] text-[#20243A] border-[#ECEEF5] hover:border-[#8174F7]'
                    }`}
                  >
                    <div>{preset.label}</div>
                    <div
                      className={`text-xs font-mono mt-0.5 ${
                        active ? 'text-white/90' : 'text-[#6558E8]'
                      }`}
                    >
                      {preset.gpa.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tp-current-cgpa"
                className="block text-xs font-medium text-[#20243A] mb-1.5"
              >
                GPA hiện tại (0.00 – 4.00)
              </label>
              <input
                id="tp-current-cgpa"
                type="number"
                step="0.01"
                value={currentCgpaStr}
                onChange={(e) => setCurrentCgpaStr(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
              />
            </div>

            <div>
              <label
                htmlFor="tp-current-credits"
                className="block text-xs font-medium text-[#20243A] mb-1.5"
              >
                Số tín chỉ đã tích lũy (tính GPA)
              </label>
              <input
                id="tp-current-credits"
                type="number"
                step="0.5"
                value={currentCreditsStr}
                onChange={(e) => setCurrentCreditsStr(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tp-target-cgpa"
                className="block text-xs font-medium text-[#20243A] mb-1.5"
              >
                GPA mục tiêu mong muốn
              </label>
              <input
                id="tp-target-cgpa"
                type="number"
                step="0.01"
                value={targetCgpaStr}
                onChange={(e) => setTargetCgpaStr(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
              />
            </div>

            <div>
              <label
                htmlFor="tp-future-credits"
                className="block text-xs font-medium text-[#20243A] mb-1.5"
              >
                Số tín chỉ dự kiến còn lại
              </label>
              <input
                id="tp-future-credits"
                type="number"
                step="0.5"
                value={futureCreditsStr}
                onChange={(e) => setFutureCreditsStr(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl focus:outline-none focus:bg-white focus:border-[#8174F7]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label
                htmlFor="tp-course-count"
                className="block text-xs font-medium text-[#20243A] mb-1.5"
              >
                Số môn học dự kiến mô phỏng
              </label>
              <div className="flex gap-2">
                <input
                  id="tp-course-count"
                  type="number"
                  min="1"
                  max="20"
                  value={expectedCourseCountStr}
                  onChange={(e) => setExpectedCourseCountStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl"
                />
                <button
                  type="button"
                  onClick={generateCoursesFromCount}
                  className="px-3.5 py-2.5 text-xs font-semibold bg-[#F0EDFF] hover:bg-[#e5e0ff] text-[#6558E8] rounded-xl whitespace-nowrap transition-colors"
                >
                  Tạo dòng
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-5 bg-[#8174F7] hover:bg-[#6558E8] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Lập kế hoạch
            </button>
          </div>
        </form>

        {/* Prominent Lavender Results Card */}
        <div className="lg:col-span-6 bg-white border border-[#ECEEF5] rounded-[18px] p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-[#20243A]">
              Phân tích khả thi & GPA tối thiểu cần đạt
            </h3>

            <div
              className={`border rounded-2xl p-4 flex items-start gap-3 ${
                bannerStyles[result.feasibilityStatus]
              }`}
            >
              {result.feasibilityStatus === 'achieved' ||
              result.feasibilityStatus === 'achievable' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#6558E8]" />
              ) : result.feasibilityStatus === 'challenging' ? (
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#F5AE48]" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#EF6472]" />
              )}
              <div>
                <div className="text-sm font-bold">{result.statusTitle}</div>
                <p className="text-xs mt-1 leading-relaxed opacity-90">
                  {result.errorMessage || result.explanation}
                </p>
              </div>
            </div>

            {result.valid && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-[#F0EDFF]/70 border border-[#8174F7]/25">
                    <div className="text-xs text-[#6558E8] font-medium">GPA cần đạt (tương lai)</div>
                    <div
                      className={`text-3xl font-bold font-mono tabular-nums mt-1 ${
                        result.feasibilityStatus === 'impossible'
                          ? 'text-[#C83D4C]'
                          : result.feasibilityStatus === 'challenging'
                            ? 'text-[#B77416]'
                            : 'text-[#6558E8]'
                      }`}
                    >
                      {formatGpa(result.requiredFutureGpa)}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5]">
                    <div className="text-xs text-[#858BA3]">GPA tối đa dự kiến</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-[#20243A] mt-1">
                      {formatGpa(result.projectedFinalCgpa)}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#ECEEF5]">
                    <div className="text-xs text-[#858BA3]">GPA mục tiêu</div>
                    <div className="text-3xl font-bold font-mono tabular-nums text-[#36B37E] mt-1">
                      {result.targetCgpa.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Progress Comparison Bar */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs text-[#858BA3]">
                    <span>
                      Hiện tại: <strong className="font-mono text-[#20243A]">{result.currentCgpa.toFixed(2)}</strong>
                    </span>
                    <span>
                      Mục tiêu: <strong className="font-mono text-[#6558E8]">{result.targetCgpa.toFixed(2)}</strong> / 4.00
                    </span>
                  </div>
                  <div className="relative w-full h-3 bg-[#F0EDFF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8174F7] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (result.currentCgpa / 4.0) * 100)}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-[#20243A]"
                      style={{ left: `${Math.min(99, (result.targetCgpa / 4.0) * 100)}%` }}
                      title={`Mục tiêu ${result.targetCgpa.toFixed(2)}`}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {result.valid && (
            <div className="bg-[#F8F9FD] border border-[#ECEEF5] rounded-xl p-3.5 font-mono text-xs text-[#555C75]">
              Công thức: ({result.targetCgpa.toFixed(2)} × ({result.currentCredits} +{' '}
              {result.futureCredits}) − {result.currentCgpa.toFixed(2)} × {result.currentCredits}) /{' '}
              {result.futureCredits} ={' '}
              <strong className="text-[#6558E8]">{formatGpa(result.requiredFutureGpa)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Course-Level Future Grade Simulator */}
      <div className="bg-white border border-[#ECEEF5] rounded-[18px] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#ECEEF5]">
          <div>
            <h3 className="text-base font-bold text-[#20243A]">
              Mô phỏng điểm từng học phần tương lai
            </h3>
            <p className="text-xs text-[#858BA3] mt-0.5">
              Thử nghiệm phân bổ điểm chữ cho từng môn học sắp tới để xem GPA tích lũy thay đổi theo thời gian thực.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSuggestGrades}
              className="px-3.5 py-2 text-xs font-semibold text-[#6558E8] bg-[#F0EDFF] hover:bg-[#e5e0ff] rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gợi ý tổ hợp điểm phù hợp</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setFutureCourses((prev) => [
                  ...prev,
                  {
                    id: `fc-${Date.now()}`,
                    name: `Học phần dự kiến ${prev.length + 1}`,
                    credits: 3,
                    letterGrade: 'B+',
                  },
                ])
              }
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#8174F7] hover:bg-[#6558E8] rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm môn dự kiến</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FD] border-b border-[#ECEEF5] text-xs font-semibold text-[#858BA3]">
                <th className="py-3 px-4">Tên học phần dự kiến</th>
                <th className="py-3 px-4">Số tín chỉ</th>
                <th className="py-3 px-4">Điểm dự kiến</th>
                <th className="py-3 px-4 text-right">Điểm trọng số</th>
                <th className="py-3 px-4 text-right">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEF5] text-sm">
              {futureCourses.map((fc) => {
                const pt =
                  settings.gradingScale.find((g) => g.letter === fc.letterGrade)?.point ?? 0;
                return (
                  <tr key={fc.id} className="hover:bg-[#F8F9FD]/60">
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={fc.name}
                        onChange={(e) =>
                          setFutureCourses((prev) =>
                            prev.map((x) => (x.id === fc.id ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="w-full px-3 py-1.5 text-sm border border-[#ECEEF5] rounded-lg focus:outline-none focus:border-[#8174F7]"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number"
                        min="0.5"
                        max="12"
                        step="0.5"
                        value={fc.credits}
                        onChange={(e) =>
                          setFutureCourses((prev) =>
                            prev.map((x) =>
                              x.id === fc.id
                                ? { ...x, credits: Math.max(0, Number(e.target.value)) }
                                : x
                            )
                          )
                        }
                        className="w-24 px-3 py-1.5 text-sm font-mono border border-[#ECEEF5] rounded-lg"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <select
                        value={fc.letterGrade}
                        onChange={(e) =>
                          setFutureCourses((prev) =>
                            prev.map((x) =>
                              x.id === fc.id ? { ...x, letterGrade: e.target.value } : x
                            )
                          )
                        }
                        className="px-3 py-1.5 text-sm font-mono border border-[#ECEEF5] rounded-lg bg-white"
                      >
                        {settings.gradingScale.map((g) => (
                          <option key={g.letter} value={g.letter}>
                            {g.letter} ({g.point.toFixed(1)})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-[#20243A]">
                      {(fc.credits * pt).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setFutureCourses((prev) => prev.filter((x) => x.id !== fc.id))
                        }
                        className="p-1.5 text-[#858BA3] hover:text-[#C83D4C] rounded-lg"
                        aria-label={`Xóa ${fc.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-[#F0EDFF]/60 border border-[#8174F7]/20 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-[#555C75] space-y-1">
            <div>
              Tổng tín chỉ mô phỏng:{' '}
              <span className="font-mono font-semibold text-[#20243A] tabular-nums">
                {coursePlanMetrics.plannedCredits} tín chỉ
              </span>{' '}
              · GPA nhóm môn này:{' '}
              <span className="font-mono font-semibold text-[#6558E8] tabular-nums">
                {formatGpa(coursePlanMetrics.plannedTermGpa)}
              </span>
            </div>
            <div className="text-[#858BA3]">
              Mọi tổ hợp điểm đạt tổng {coursePlanMetrics.plannedWeighted.toFixed(2)} điểm trọng số trên{' '}
              {coursePlanMetrics.plannedCredits} tín chỉ đều mang lại GPA tích lũy dự kiến như nhau.
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-[#6558E8] font-medium">GPA tích lũy dự kiến sau kỳ tới</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#20243A]">
              {formatGpa(coursePlanMetrics.projectedCgpa)}
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

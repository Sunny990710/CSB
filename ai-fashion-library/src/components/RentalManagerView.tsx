import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, ArrowUpRight, ArrowDownLeft, X, Check, Sparkles,
  Clock, History, AlertCircle, RefreshCw, ScanLine, Barcode, CheckCircle2,
  Search, Calendar, Trash2, Package,
} from 'lucide-react';
import { Sample, Rental, Member } from '../types';

interface RentalManagerViewProps {
  rentals: Rental[];
  samples: Sample[];
  members: Member[];
  onSaveDB: (newRentals: Rental[], newSamples: Sample[]) => void;
  onRefreshData?: () => void;
  view: 'scan' | 'status';
}

type ScanKind = 'borrow' | 'return' | 'error';
interface ScanLogEntry {
  id: string;
  kind: ScanKind;
  title: string;
  sub: string;
  time: string;
  image?: string;     // 제품 썸네일 (data URL)
  code?: string;      // 상품코드
  brand?: string;     // 브랜드
  locationNo?: string; // 위치번호
  dueDate?: string;   // 반납 예정일
  days?: string;      // 대여 기간(일)
}

const todayStr = () => new Date().toISOString().substring(0, 10);

export default function RentalManagerView({
  rentals,
  samples,
  members,
  onSaveDB,
  onRefreshData,
  view,
}: RentalManagerViewProps) {
  // --- Mode: 대여 / 반납 (within the 대여/반납 tab) ----------------------
  const [mode, setMode] = useState<'borrow' | 'return'>('borrow');

  // --- Borrow workflow states -------------------------------------------
  const [borrowerInput, setBorrowerInput] = useState('');
  const [borrowDays, setBorrowDays] = useState('7');
  const [borrowCode, setBorrowCode] = useState('');
  const [returnCode, setReturnCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);

  // --- Scan log (session) -----------------------------------------------
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>([]);

  // --- Status table states ----------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('전체');
  const [selectedRentalForHistory, setSelectedRentalForHistory] = useState<Rental | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  // 현황판 보기 모달 (대여자별 대여중/반납 목록)
  const [detailView, setDetailView] = useState<{ mode: 'active' | 'returned'; borrowerId: string; borrowerName: string } | null>(null);

  // Refs for focus flow
  const borrowerRef = useRef<HTMLInputElement>(null);
  const borrowCodeRef = useRef<HTMLInputElement>(null);
  const returnCodeRef = useRef<HTMLInputElement>(null);

  // Resolve borrower live from the input (사번 / 이름 / 이메일)
  const borrower = members.find((m) => {
    const q = borrowerInput.trim().toLowerCase();
    if (!q) return false;
    return (
      m.memberId.toLowerCase() === q ||
      m.name.toLowerCase() === q ||
      m.email.toLowerCase() === q
    );
  });

  // 검색어로 직원 목록 필터 (부분 일치)
  const filteredMembers = members.filter((m) => {
    const q = borrowerInput.trim().toLowerCase();
    if (!q || m.useYn !== '사용') return false;
    return (
      m.memberId.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.affiliation || m.groupName).toLowerCase().includes(q) ||
      (m.brand || '').toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const overdueCountOf = (memberId: string) =>
    rentals.filter((r) => r.borrowerId === memberId && r.status === '연체중').length;

  const selectBorrower = (member: Member) => {
    setBorrowerInput(member.memberId);
    window.setTimeout(() => borrowCodeRef.current?.focus(), 50);
  };

  // Keep focus on the active scan field
  useEffect(() => {
    if (view !== 'scan') return;
    if (mode === 'return') {
      returnCodeRef.current?.focus();
    } else {
      if (borrower) borrowCodeRef.current?.focus();
      else borrowerRef.current?.focus();
    }
  }, [view, mode, borrower]);

  // --- Derived summary metrics ------------------------------------------
  const today = todayStr();
  const onLoanCount = rentals.filter((r) => r.status === '대여중').length;
  const overdueCount = rentals.filter((r) => r.status === '연체중').length;
  const returnedCount = rentals.filter((r) => r.status === '반납완료').length;

  const pushLog = (entry: Omit<ScanLogEntry, 'id' | 'time'>) => {
    setScanLog((prev) => [
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev,
    ].slice(0, 30));
  };

  const flashFeedback = (type: 'ok' | 'error', msg: string) => {
    setFeedback({ type, msg });
    window.setTimeout(() => setFeedback(null), 2600);
  };

  // --- Borrow handler ----------------------------------------------------
  const handleBorrowScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = borrowCode.trim();

    if (!borrower) {
      flashFeedback('error', '먼저 대여자(직원)를 확인해 주세요.');
      borrowerRef.current?.focus();
      return;
    }
    if (borrower.useYn !== '사용') {
      flashFeedback('error', `${borrower.name} 님은 현재 대여 자격이 정지된 상태입니다.`);
      return;
    }
    if (!code) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/rentals/borrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleCode: code, borrowerId: borrower.memberId, rentDays: borrowDays }),
      });
      const data = await res.json();

      if (data.success) {
        const s = samples.find((x) => x.code === code);
        const due = new Date();
        due.setDate(due.getDate() + (parseInt(borrowDays, 10) || 0));
        const dueStr = due.toISOString().substring(0, 10);
        flashFeedback('ok', `대여 완료 · ${s?.name || code}`);
        pushLog({
          kind: 'borrow',
          title: s?.name || '샘플',
          sub: `${borrower.name} · ${borrower.groupName}`,
          image: s?.imgFrontClean || s?.imgFront || s?.imgFlat,
          code,
          brand: s?.brand,
          locationNo: s?.locationNo,
          dueDate: dueStr,
          days: borrowDays,
        });
        setBorrowCode('');
        onRefreshData?.();
      } else {
        flashFeedback('error', data.message || '대여 처리에 실패했습니다.');
        pushLog({ kind: 'error', title: `${code} 대여 실패`, sub: data.message || '' });
        setBorrowCode('');
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '서버 통신 오류로 대여가 취소되었습니다.');
    } finally {
      setProcessing(false);
      borrowCodeRef.current?.focus();
    }
  };

  // --- Return handler ----------------------------------------------------
  const handleReturnScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = returnCode.trim();
    if (!code) return;

    const rental = rentals.find(
      (r) => r.sampleCode === code && (r.status === '대여중' || r.status === '연체중')
    );

    if (!rental) {
      flashFeedback('error', `대여중인 항목을 찾을 수 없습니다 · ${code}`);
      pushLog({ kind: 'error', title: `${code} 반납 실패`, sub: '대여중 상태가 아니거나 미등록 코드' });
      setReturnCode('');
      returnCodeRef.current?.focus();
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/rentals/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rentalId: rental.rentalId }),
      });
      const data = await res.json();

      if (data.success) {
        const s = samples.find((x) => x.code === code);
        flashFeedback('ok', `반납 완료 · ${rental.sampleName}`);
        pushLog({
          kind: 'return',
          title: rental.sampleName,
          sub: `${rental.borrowerName} · ${rental.borrowerGroup}`,
          image: s?.imgFrontClean || s?.imgFront || s?.imgFlat,
          code,
          brand: s?.brand || rental.sampleBrand,
          locationNo: s?.locationNo,
          dueDate: rental.dueDate,
        });
        setReturnCode('');
        onRefreshData?.();
      } else {
        flashFeedback('error', data.message || '반납 처리에 실패했습니다.');
        pushLog({ kind: 'error', title: `${code} 반납 실패`, sub: data.message || '' });
        setReturnCode('');
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '반납 처리 통신 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
      returnCodeRef.current?.focus();
    }
  };

  // --- AI overdue reminder ----------------------------------------------
  const handleSendAutomatedEmail = async (rental: Rental) => {
    setSendingId(rental.rentalId);
    try {
      const dueTime = new Date(rental.dueDate).getTime();
      const todayTime = new Date(today).getTime();
      const daysOverdue = Math.max(1, Math.ceil((todayTime - dueTime) / (1000 * 60 * 60 * 24)));
      const tone = rental.notifyCount > 0 ? 'warning' : 'gentle';

      const draftRes = await fetch('/api/agent/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrowerName: rental.borrowerName,
          borrowerGroup: rental.borrowerGroup,
          sampleName: rental.sampleName,
          sampleCode: rental.sampleCode,
          dueDate: rental.dueDate,
          daysOverdue,
          emailType: tone,
        }),
      });
      const draftData = await draftRes.json();

      const sendRes = await fetch('/api/agent/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.rentalId,
          subject: draftData.subject || '[반납 촉구 안내] 의류 샘플 반납 기한 경과 안내',
          content: draftData.content || `안녕하세요, ${rental.borrowerName}님.\n\n대여 중인 의류 샘플의 빠른 반납 부탁드립니다.`,
        }),
      });
      const sendData = await sendRes.json();
      if (sendData.success) {
        flashFeedback('ok', `${rental.borrowerName} 님께 독촉 메일을 발송했습니다.`);
        onRefreshData?.();
      } else {
        alert('발송 실패: ' + sendData.message);
      }
    } catch (err) {
      console.error(err);
      alert('자동 독촉 메일 전송 중 오류가 발생했습니다.');
    } finally {
      setSendingId(null);
    }
  };

  // --- Filtered status table --------------------------------------------
  const filteredRentals = rentals
    .filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        r.sampleCode.toLowerCase().includes(q) ||
        r.sampleName.toLowerCase().includes(q) ||
        r.borrowerName.toLowerCase().includes(q) ||
        r.borrowerGroup.toLowerCase().includes(q) ||
        r.borrowerId.toLowerCase().includes(q);
      const matchStatus = selectedStatus === '전체' || r.status === selectedStatus;
      return matchSearch && matchStatus;
    })
    .slice()
    .reverse();

  // --- 보기 모달용 대여자별 목록 -----------------------------------------
  const feeOf = (code: string) => {
    const s = samples.find((x) => x.code === code);
    return {
      rental: s?.rentalFee ?? 15000,
      o1: s?.overdueFee1 ?? 10000,
      o2: s?.overdueFee2 ?? 20000,
    };
  };
  const detailRows = detailView
    ? rentals.filter(
        (r) =>
          r.borrowerId === detailView.borrowerId &&
          (detailView.mode === 'active'
            ? r.status === '대여중' || r.status === '연체중'
            : r.status === '반납완료')
      )
    : [];

  return (
    <div className="space-y-6" id="rental-manager-root">

      {/* ============ 스캔 워크스페이스 (대여 / 반납) ============ */}
      {view === 'scan' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="rental-scan-workspace">

        {/* Left: 대여 / 반납 스캐너 (col-span-2) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="scanner-panel">

          {/* Mode toggle */}
          <div className="flex p-1.5 gap-1.5 bg-slate-50 border-b border-slate-100">
            <button
              onClick={() => setMode('borrow')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                mode === 'borrow' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'
              }`}
              id="btn-mode-borrow"
            >
              <ArrowUpRight className="w-4 h-4" />
              대여하기
            </button>
            <button
              onClick={() => setMode('return')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                mode === 'return' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-white'
              }`}
              id="btn-mode-return"
            >
              <ArrowDownLeft className="w-4 h-4" />
              반납하기
            </button>
          </div>

          <div className="p-6">
            {/* Inline feedback toast */}
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`mb-4 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    feedback.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}
                >
                  {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {feedback.msg}
                </motion.div>
              )}
            </AnimatePresence>

            {mode === 'borrow' ? (
              /* ===== 대여 폼 ===== */
              <div className="space-y-5">
                {/* Step 1. 직원 정보 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-indigo-600 text-white text-[10px] font-mono flex items-center justify-center">1</span>
                    대여자(직원) 정보
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      ref={borrowerRef}
                      type="text"
                      value={borrowerInput}
                      onChange={(e) => setBorrowerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (borrower) borrowCodeRef.current?.focus();
                        }
                      }}
                      placeholder="사번 / 이름 / 이메일 입력 (사원증 바코드 스캔 가능)"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                  </div>
                  {borrower ? (
                    <div className="rounded-xl border border-emerald-200 overflow-hidden bg-white">
                      <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 border-b border-emerald-100">
                        <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          대여자 확인됨
                        </span>
                        <button
                          type="button"
                          onClick={() => { setBorrowerInput(''); borrowerRef.current?.focus(); }}
                          className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
                          title="대여자 변경"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500">
                              <th className="py-2 px-3 whitespace-nowrap">이름</th>
                              <th className="py-2 px-3 whitespace-nowrap">이메일</th>
                              <th className="py-2 px-3 whitespace-nowrap">소속</th>
                              <th className="py-2 px-3 whitespace-nowrap">브랜드</th>
                              <th className="py-2 px-3 whitespace-nowrap text-center">연체여부</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">{borrower.name}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">{borrower.email}</td>
                              <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{borrower.affiliation || borrower.groupName}</td>
                              <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{borrower.brand || '-'}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {overdueCountOf(borrower.memberId) > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                                    <AlertCircle className="w-3 h-3" />
                                    연체 {overdueCountOf(borrower.memberId)}건
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : borrowerInput.trim() && filteredMembers.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-600">
                        직원 선택 ({filteredMembers.length}명)
                      </div>
                      <div className="overflow-x-auto max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-500 sticky top-0">
                              <th className="py-2 px-3 w-8"></th>
                              <th className="py-2 px-3 whitespace-nowrap">이름</th>
                              <th className="py-2 px-3 whitespace-nowrap">이메일</th>
                              <th className="py-2 px-3 whitespace-nowrap">소속</th>
                              <th className="py-2 px-3 whitespace-nowrap">브랜드</th>
                              <th className="py-2 px-3 whitespace-nowrap text-center">연체여부</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredMembers.map((m) => {
                              const overdue = overdueCountOf(m.memberId);
                              return (
                                <tr
                                  key={m.memberId}
                                  onClick={() => selectBorrower(m)}
                                  className="hover:bg-indigo-50/60 cursor-pointer transition-colors"
                                >
                                  <td className="py-2 px-3 text-center">
                                    <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                                  </td>
                                  <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">{m.name}</td>
                                  <td className="py-2 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">{m.email}</td>
                                  <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{m.affiliation || m.groupName}</td>
                                  <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{m.brand || '-'}</td>
                                  <td className="py-2 px-3 text-center whitespace-nowrap">
                                    {overdue > 0 ? (
                                      <span className="text-[10px] font-bold text-rose-600">연체 {overdue}건</span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : borrowerInput.trim() ? (
                    <p className="text-[11px] text-rose-500 font-bold pl-1">등록된 직원 정보를 찾을 수 없습니다.</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 pl-1">대여자를 먼저 확인한 뒤 상품 바코드를 스캔하세요.</p>
                  )}
                </div>

                {/* 대여 기간 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    대여 기간
                  </label>
                  <select
                    value={borrowDays}
                    onChange={(e) => setBorrowDays(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 bg-white rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="3">3일 (긴급 품목)</option>
                    <option value="7">7일 (일반 품목)</option>
                    <option value="14">14일 (장기 기획)</option>
                    <option value="30">30일 (출장 원거리)</option>
                  </select>
                </div>

                {/* Step 2. 바코드 스캔 */}
                <form onSubmit={handleBorrowScan} className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-indigo-600 text-white text-[10px] font-mono flex items-center justify-center">2</span>
                    상품 바코드 스캔
                  </label>
                  <div className={`relative rounded-xl border-2 border-dashed transition-colors ${borrower ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-slate-50'}`}>
                    <Barcode className={`absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 ${borrower ? 'text-indigo-500' : 'text-slate-300'}`} />
                    <input
                      ref={borrowCodeRef}
                      type="text"
                      value={borrowCode}
                      onChange={(e) => setBorrowCode(e.target.value)}
                      disabled={!borrower || processing}
                      placeholder={borrower ? '상품코드 입력 후 Enter (바코드 리더기 자동 입력)' : '먼저 대여자를 확인하세요'}
                      className="w-full pl-13 pr-4 py-4 bg-transparent text-base font-mono font-bold tracking-wider focus:outline-none disabled:cursor-not-allowed placeholder:font-sans placeholder:text-sm placeholder:font-medium placeholder:tracking-normal"
                    />
                    {processing && <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500 animate-spin" />}
                  </div>
                  <button
                    type="submit"
                    disabled={!borrower || !borrowCode.trim() || processing}
                    className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    대여 처리
                  </button>
                </form>
              </div>
            ) : (
              /* ===== 반납 폼 ===== */
              <div className="space-y-5">
                <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <ScanLine className="w-5 h-5 text-slate-700 shrink-0" />
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    반납할 상품의 <strong className="text-slate-700">바코드를 리더기로 스캔</strong>하면 자동으로 반납 처리됩니다. 직원 정보 입력은 필요 없습니다.
                  </p>
                </div>

                <form onSubmit={handleReturnScan} className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Barcode className="w-3.5 h-3.5 text-slate-400" />
                    반납 바코드 스캔
                  </label>
                  <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
                    <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-600" />
                    <input
                      ref={returnCodeRef}
                      type="text"
                      value={returnCode}
                      onChange={(e) => setReturnCode(e.target.value)}
                      disabled={processing}
                      placeholder="상품코드 입력 후 Enter (바코드 리더기 자동 입력)"
                      className="w-full pl-13 pr-4 py-4 bg-transparent text-base font-mono font-bold tracking-wider focus:outline-none disabled:cursor-not-allowed placeholder:font-sans placeholder:text-sm placeholder:font-medium placeholder:tracking-normal"
                    />
                    {processing && <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 animate-spin" />}
                  </div>
                  <button
                    type="submit"
                    disabled={!returnCode.trim() || processing}
                    className="w-full mt-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    반납 처리
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right: 실시간 스캔 로그 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden" id="scan-log-panel">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              실시간 처리 로그
            </h3>
            {scanLog.length > 0 && (
              <button
                onClick={() => setScanLog([])}
                className="text-[11px] text-slate-400 hover:text-rose-500 font-semibold flex items-center gap-1 cursor-pointer"
                title="로그 비우기"
              >
                <Trash2 className="w-3 h-3" />
                비우기
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[460px]">
            {scanLog.length === 0 ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
                <ScanLine className="w-8 h-8 text-slate-300" />
                <span className="text-xs font-medium">스캔 내역이 여기에 표시됩니다.</span>
              </div>
            ) : (
              scanLog.map((log) => {
                const color =
                  log.kind === 'borrow'
                    ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                    : log.kind === 'return'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                    : 'bg-rose-50 border-rose-100 text-rose-600';
                const Icon = log.kind === 'borrow' ? ArrowUpRight : log.kind === 'return' ? ArrowDownLeft : AlertCircle;
                const kindLabel = log.kind === 'borrow' ? '대여' : log.kind === 'return' ? '반납' : '실패';
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-white"
                  >
                    {log.image ? (
                      <img
                        src={log.image}
                        alt={log.title}
                        className="w-12 h-14 object-cover rounded-lg border border-slate-100 bg-slate-50 shrink-0"
                      />
                    ) : (
                      <div className={`p-1.5 rounded-lg border shrink-0 ${color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{log.title}</span>
                        <span className="text-[9.5px] text-slate-400 font-mono shrink-0">{log.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${color}`}>
                          <Icon className="w-2.5 h-2.5" />
                          {kindLabel}
                        </span>
                        {log.code && (
                          <span className="font-mono text-[9.5px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{log.code}</span>
                        )}
                        {log.brand && (
                          <span className="text-[9.5px] text-slate-600 font-semibold">{log.brand}</span>
                        )}
                        {log.locationNo && (
                          <span className="text-[9.5px] text-slate-400 font-mono">위치 {log.locationNo}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-1">{log.sub}</p>
                      {log.dueDate && (
                        <div
                          className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            log.kind === 'borrow' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {log.kind === 'borrow'
                            ? `${log.dueDate}까지 반납${log.days ? ` (${log.days}일)` : ''}`
                            : '반납 완료'}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
      )}

      {/* ============ 대여/반납 현황 테이블 ============ */}
      {view === 'status' && (
      <div className="space-y-4" id="rentals-status-root">
        {/* 필터 패널 (상품관리 탭과 동일한 디자인 언어) */}
        <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-3xs" id="rentals-filter-panel">
          {/* Row 1: 검색 */}
          <div className="flex gap-3 justify-between items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="검색어를 입력하세요 (상품코드, 상품명, 대여자, 부서)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100/70 border-0 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-violet-500 rounded-xl text-xs font-medium placeholder:text-slate-400 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 p-0.5 hover:bg-slate-200 rounded-full"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: 상태 필터 칩 + 카운터 */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2.5 border-t border-slate-100">
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => { setSearchQuery(''); setSelectedStatus('전체'); }}
                className="bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs font-bold py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>필터 초기화</span>
              </button>
              <button
                onClick={() => setSelectedStatus(selectedStatus === '대여중' ? '전체' : '대여중')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  selectedStatus === '대여중' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                대여중 {onLoanCount}
              </button>
              <button
                onClick={() => setSelectedStatus(selectedStatus === '연체중' ? '전체' : '연체중')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  selectedStatus === '연체중' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                연체중 {overdueCount}
              </button>
              <button
                onClick={() => setSelectedStatus(selectedStatus === '반납완료' ? '전체' : '반납완료')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  selectedStatus === '반납완료' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                반납완료 {returnedCount}
              </button>
            </div>

            <div className="flex items-center sm:self-center shrink-0 self-end">
              <span className="text-[11px] text-slate-400 font-extrabold font-mono uppercase tracking-wide">
                목록 {filteredRentals.length}
              </span>
            </div>
          </div>
        </div>

        {/* 테이블 카드 */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden" id="rentals-status-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans" id="rentals-status-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans text-left">
                <th className="py-3 px-4 text-left whitespace-nowrap">상품코드</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">상품 이미지</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">상품명</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">브랜드</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">대여자</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">대여일</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">반납예정</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">반납일</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">상태</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {filteredRentals.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center text-slate-400">
                    일치하는 대여/반납 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRentals.map((rental, index) => {
                  const isOverdue = rental.status === '연체중';
                  const isReturned = rental.status === '반납완료';
                  const s = samples.find((x) => x.code === rental.sampleCode);
                  const thumb = s?.imgFrontClean || s?.imgFront || s?.imgFlat;

                  return (
                    <tr
                      key={rental.rentalId}
                      className={`hover:bg-slate-50/50 transition-colors ${isOverdue ? 'bg-rose-50/30' : ''}`}
                      id={`rental-row-${index}`}
                    >
                      {/* 상품코드 */}
                      <td className="py-3.5 px-4 text-left font-mono font-bold text-indigo-650 text-[11px] whitespace-nowrap">
                        {rental.sampleCode}
                      </td>
                      {/* 상품 이미지 */}
                      <td className="py-3.5 px-4 text-left">
                        <div className="w-12 h-14 rounded-md bg-slate-50 overflow-hidden inline-flex items-center justify-center border-0 outline-none ring-0">
                          {thumb ? (
                            <img
                              src={thumb}
                              referrerPolicy="no-referrer"
                              alt={rental.sampleName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                      </td>
                      {/* 상품명 */}
                      <td className="py-3.5 px-4 text-left">
                        <div className="font-semibold text-slate-800 max-w-[190px] truncate" title={rental.sampleName}>
                          {rental.sampleName}
                        </div>
                      </td>
                      {/* 브랜드 */}
                      <td className="py-3.5 px-4 text-left font-semibold text-slate-700 whitespace-nowrap">{rental.sampleBrand}</td>
                      {/* 대여자: 이름 + 부서·사번 */}
                      <td className="py-3.5 px-4 text-left whitespace-nowrap">
                        <div className="font-bold text-slate-800">{rental.borrowerName}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {rental.borrowerGroup} · {rental.borrowerId}
                        </div>
                      </td>
                      {/* 대여일 */}
                      <td className="py-3.5 px-4 text-left font-mono text-slate-500 text-[11px] whitespace-nowrap">{rental.rentDate}</td>
                      {/* 반납예정 */}
                      <td className="py-3.5 px-4 text-left font-mono text-[11px] whitespace-nowrap">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}>{rental.dueDate}</span>
                      </td>
                      {/* 반납일 */}
                      <td className="py-3.5 px-4 text-left font-mono text-[11px] whitespace-nowrap">
                        {rental.returnDate ? (
                          <span className="text-emerald-600 font-bold">{rental.returnDate}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      {/* 상태 */}
                      <td className="py-3.5 px-4 text-left">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            isOverdue
                              ? 'bg-rose-100 text-rose-700'
                              : isReturned
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {rental.status}
                        </span>
                      </td>
                      {/* 보기 */}
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-start gap-1 whitespace-nowrap">
                          <button
                            onClick={() =>
                              setDetailView({ mode: 'returned', borrowerId: rental.borrowerId, borrowerName: rental.borrowerName })
                            }
                            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all p-1.5 rounded-lg cursor-pointer flex items-center gap-1 shrink-0"
                            title="이 대여자의 반납 목록 보기"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] font-bold">반납</span>
                          </button>
                          <button
                            onClick={() =>
                              setDetailView({ mode: 'active', borrowerId: rental.borrowerId, borrowerName: rental.borrowerName })
                            }
                            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all p-1.5 rounded-lg cursor-pointer flex items-center gap-1 shrink-0"
                            title="이 대여자의 대여중 목록 보기"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] font-bold">대여</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>
      )}

      {/* ============ 대여자별 보기 모달 (대여중 / 반납 목록) ============ */}
      {detailView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setDetailView(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold font-mono tracking-wider text-indigo-300 uppercase">
                  {detailView.mode === 'active' ? 'Active Rentals' : 'Returned List'}
                </h4>
                <div className="text-sm font-bold flex items-center gap-1.5">
                  {detailView.mode === 'active' ? (
                    <ArrowUpRight className="w-4 h-4 text-indigo-300" />
                  ) : (
                    <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
                  )}
                  {detailView.borrowerName} 님 {detailView.mode === 'active' ? '대여중' : '반납'} 목록 ({detailRows.length})
                </div>
              </div>
              <button onClick={() => setDetailView(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider sticky top-0">
                    <th className="py-2.5 px-3 whitespace-nowrap">대여번호</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">상품</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">대여일</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">{detailView.mode === 'active' ? '반납예정일' : '반납일'}</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-right">대여비용</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-right">연체비용(1차)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-right">연체비용(2차)</th>
                    {detailView.mode === 'active' && <th className="py-2.5 px-3 whitespace-nowrap text-center">독촉</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {detailRows.length === 0 ? (
                    <tr>
                      <td colSpan={detailView.mode === 'active' ? 8 : 7} className="py-16 text-center text-slate-400">
                        {detailView.mode === 'active' ? '현재 대여중인 상품이 없습니다.' : '반납한 상품이 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    detailRows.map((r) => {
                      const fee = feeOf(r.sampleCode);
                      const rowOverdue = r.status === '연체중';
                      return (
                        <tr key={r.rentalId} className={rowOverdue ? 'bg-rose-50/30' : ''}>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">{r.rentalId}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800 max-w-[200px] truncate" title={r.sampleName}>{r.sampleName}</div>
                            <div className="font-mono text-[10px] text-indigo-650">{r.sampleCode}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">{r.rentDate}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                            {detailView.mode === 'active' ? (
                              <span className={rowOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}>{r.dueDate}</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">{r.returnDate || '-'}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 text-[11px] text-right whitespace-nowrap">{fee.rental.toLocaleString()}원</td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] text-right whitespace-nowrap">{fee.o1.toLocaleString()}원</td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] text-right whitespace-nowrap">{fee.o2.toLocaleString()}원</td>
                          {detailView.mode === 'active' && (
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {rowOverdue ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleSendAutomatedEmail(r)}
                                    disabled={sendingId === r.rentalId}
                                    className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white py-1 px-2 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                                    title="AI 자동 독촉 메일"
                                  >
                                    {sendingId === r.rentalId ? (
                                      <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                                    ) : (
                                      <Sparkles className="w-3 h-3 shrink-0" />
                                    )}
                                    AI 독촉
                                  </button>
                                  {r.notifyCount > 0 && (
                                    <button
                                      onClick={() => setSelectedRentalForHistory(r)}
                                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-1 px-1.5 rounded-full border border-indigo-200 cursor-pointer shrink-0"
                                      title="발송 이력"
                                    >
                                      <History className="w-3 h-3 shrink-0" />
                                      {r.notifyCount}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-[10px]">-</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-end shrink-0">
              <button onClick={() => setDetailView(null)} className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg text-xs hover:bg-slate-800 cursor-pointer">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 발송 이력 모달 ============ */}
      {selectedRentalForHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold font-mono tracking-wider text-indigo-300 uppercase">Alert Log Histories</h4>
                <div className="text-sm font-bold">
                  {selectedRentalForHistory.borrowerName} 님 발송 기록 ({selectedRentalForHistory.notifyCount}회)
                </div>
              </div>
              <button onClick={() => setSelectedRentalForHistory(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto font-sans text-xs">
              {selectedRentalForHistory.notifyHistory && selectedRentalForHistory.notifyHistory.length > 0 ? (
                selectedRentalForHistory.notifyHistory.map((item, id) => (
                  <div key={id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1.5 text-[10.5px]">
                      <span className="font-bold text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {item.sentAt}
                      </span>
                      <span className="text-violet-600 bg-violet-50 font-bold px-1.5 py-0.5 rounded">Simulated Email Out</span>
                    </div>
                    <div className="font-bold text-slate-800">{item.subject}</div>
                    <p className="text-slate-600 leading-relaxed bg-white border border-slate-100 p-2.5 rounded-lg whitespace-pre-wrap text-[11px]">
                      {item.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">발송된 이메일 이력이 없습니다.</div>
              )}
            </div>
            <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedRentalForHistory(null)}
                className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg text-xs hover:bg-slate-800"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

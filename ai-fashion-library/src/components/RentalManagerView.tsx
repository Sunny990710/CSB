import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, ArrowUpRight, ArrowDownLeft, X, Check, Sparkles,
  Clock, History, AlertCircle, RefreshCw, ScanLine, Barcode, CheckCircle2,
  Search, Calendar, Trash2, Package, FileText, Printer, Download, PenLine,
} from 'lucide-react';
import { Sample, Rental, RentalAgreement, Member, rentalStatusLabel, effectiveRentalStatus } from '../types';

interface RentalManagerViewProps {
  rentals: Rental[];
  rentalAgreements: RentalAgreement[];
  samples: Sample[];
  members: Member[];
  onSaveDB: (newRentals: Rental[], newSamples: Sample[]) => void;
  onRefreshData?: () => void;
  view: 'scan' | 'status';
}

interface BorrowCartItem {
  sampleCode: string;
  sampleName: string;
  brand: string;
  category: string;
  remark?: string;
}

const AGREEMENT_TERMS = [
  '대여 샘플은 지정된 목적(기획·촬영·검수 등) 외 사용을 금하며, 훼손·오염·분실 시 즉시 담당자에게 보고해야 합니다.',
  '샘플 훼손·분실 시 변상금 및 수리비가 청구될 수 있으며, 변상 기준은 내부 자산관리 규정을 따릅니다.',
  '반납 예정일을 초과할 경우 연체료가 부과되며, 4주 이상 연체 시 분실 처리 및 변상 절차가 진행될 수 있습니다.',
  '대여 중 샘플의 재대여·양도·외부 반출(촬영장 등)은 사전 승인 없이 불가합니다.',
  '본 동의서에 전자서명함으로써 위 사항을 확인하였으며, 관련 규정을 준수할 것에 동의합니다.',
];

const rentPeriodLabel = (days: number) => {
  if (days % 7 === 0 && days >= 7) return `${days / 7}주`;
  return `${days}일`;
};

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

const MS_DAY = 86400000;

const parseDateOnly = (dateStr: string) => {
  const d = new Date(dateStr.replace(' ', 'T'));
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

const daysUntilDueOf = (dueDate: string, refDate: string) => {
  if (!dueDate) return 0;
  return Math.floor((parseDateOnly(dueDate) - parseDateOnly(refDate)) / MS_DAY);
};

const overdueDaysOfRental = (r: Rental, refDate: string) => {
  if (!r.dueDate) return 0;
  const end = r.returnDate || refDate;
  const diff = Math.floor((parseDateOnly(end) - parseDateOnly(r.dueDate)) / MS_DAY);
  return diff > 0 ? diff : 0;
};

const formatDDay = (daysLeft: number) => {
  if (daysLeft <= 0) return 'D-00';
  if (daysLeft < 10) return `D-0${daysLeft}`;
  return `D-${daysLeft}`;
};

type OverdueStage = {
  label: string;
  emailType: 'gentle' | 'warning' | 'strict';
  badgeClass: string;
};

const getOverdueStage = (daysOverdue: number): OverdueStage | null => {
  if (daysOverdue <= 0) return null;
  if (daysOverdue <= 6) {
    return {
      label: '1주차 · 안내',
      emailType: 'gentle',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    };
  }
  if (daysOverdue <= 13) {
    return {
      label: '2주차 · 경고',
      emailType: 'warning',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
    };
  }
  if (daysOverdue <= 19) {
    return {
      label: '3주차 · 최종통보',
      emailType: 'warning',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    };
  }
  return {
    label: '4주차 · 분실/보상',
    emailType: 'strict',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  };
};

const renderDueSubLabel = (rental: Rental, today: string) => {
  if (rental.status === '반납완료') {
    const od = overdueDaysOfRental(rental, today);
    return <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">+{od}일 연체</span>;
  }
  const effective = effectiveRentalStatus(rental, today);
  if (effective === '연체중') {
    const od = overdueDaysOfRental(rental, today);
    return <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">+{od}일 연체</span>;
  }
  const left = daysUntilDueOf(rental.dueDate, today);
  return <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{formatDDay(left)}</span>;
};

export default function RentalManagerView({
  rentals,
  rentalAgreements,
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
  const [borrowCart, setBorrowCart] = useState<BorrowCartItem[]>([]);
  const [creatingAgreement, setCreatingAgreement] = useState(false);
  const [signingAgreementId, setSigningAgreementId] = useState<string | null>(null);
  const [viewAgreement, setViewAgreement] = useState<RentalAgreement | null>(null);
  const [agreeChecked, setAgreeChecked] = useState(false);
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
    setBorrowCart([]);
    window.setTimeout(() => borrowCodeRef.current?.focus(), 50);
  };

  const removeFromCart = (code: string) => {
    setBorrowCart((prev) => prev.filter((item) => item.sampleCode !== code));
  };

  const sortedAgreements = rentalAgreements
    .slice()
    .sort((a, b) => {
      if (a.signatureStatus !== b.signatureStatus) {
        return a.signatureStatus === 'pending' ? -1 : 1;
      }
      return b.rentDate.localeCompare(a.rentDate);
    });

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
  const onLoanCount = rentals.filter((r) => effectiveRentalStatus(r, today) === '대여중').length;
  const overdueCount = rentals.filter((r) => effectiveRentalStatus(r, today) === '연체중').length;
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

  // --- Add to borrow cart (scan) -----------------------------------------
  const handleBorrowScan = (e: React.FormEvent) => {
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

    const sample = samples.find((x) => x.code === code);
    if (!sample) {
      flashFeedback('error', `등록되지 않은 상품 코드입니다 · ${code}`);
      setBorrowCode('');
      borrowCodeRef.current?.focus();
      return;
    }
    if (sample.status !== '대여가능') {
      flashFeedback('error', `${sample.code}는 현재 대여 가능한 상태가 아닙니다. (${sample.status})`);
      setBorrowCode('');
      borrowCodeRef.current?.focus();
      return;
    }
    if (borrowCart.some((item) => item.sampleCode === code)) {
      flashFeedback('error', '이미 장바구니에 담긴 샘플입니다.');
      setBorrowCode('');
      borrowCodeRef.current?.focus();
      return;
    }

    setBorrowCart((prev) => [
      ...prev,
      {
        sampleCode: sample.code,
        sampleName: sample.name,
        brand: sample.brand,
        category: sample.category || sample.classification || '-',
        remark: sample.season || '',
      },
    ]);
    flashFeedback('ok', `장바구니 추가 · ${sample.name}`);
    setBorrowCode('');
    borrowCodeRef.current?.focus();
  };

  const handleCreateAgreement = async () => {
    if (!borrower) {
      flashFeedback('error', '대여자를 먼저 확인해 주세요.');
      return;
    }
    if (borrowCart.length === 0) {
      flashFeedback('error', '스캔한 샘플이 없습니다. 바코드를 스캔해 주세요.');
      return;
    }

    setCreatingAgreement(true);
    try {
      const res = await fetch('/api/rental-agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrowerId: borrower.memberId,
          rentDays: borrowDays,
          purpose: '샘플 대여',
          items: borrowCart.map((item) => ({ sampleCode: item.sampleCode, remark: item.remark })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        flashFeedback('ok', `동의서 ${data.agreement.agreementId} 작성 · 전자서명 후 대여 처리됩니다.`);
        setBorrowCart([]);
        setViewAgreement(data.agreement);
        setAgreeChecked(false);
        onRefreshData?.();
      } else {
        flashFeedback('error', data.message || '동의서 작성에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '동의서 작성 중 오류가 발생했습니다.');
    } finally {
      setCreatingAgreement(false);
    }
  };

  const handleSignAgreement = async (agreement: RentalAgreement) => {
    if (!agreeChecked) {
      flashFeedback('error', '동의 사항을 확인하고 체크박스에 동의해 주세요.');
      return;
    }

    setSigningAgreementId(agreement.agreementId);
    try {
      const res = await fetch(`/api/rental-agreements/${agreement.agreementId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        flashFeedback('ok', data.message || '전자서명 완료 · 대여 처리되었습니다.');
        for (const rental of data.rentals || []) {
          const s = samples.find((x) => x.code === rental.sampleCode);
          pushLog({
            kind: 'borrow',
            title: rental.sampleName || '샘플',
            sub: `${agreement.borrowerName} · ${agreement.borrowerAffiliation}`,
            image: s?.imgFrontClean || s?.imgFront || s?.imgFlat || s?.imgBackClean || s?.imgBack,
            code: rental.sampleCode,
            brand: s?.brand || rental.sampleBrand,
            locationNo: s?.locationNo,
            dueDate: rental.dueDate,
            days: String(agreement.rentDays),
          });
        }
        setViewAgreement(data.agreement);
        setAgreeChecked(false);
        onRefreshData?.();
      } else {
        flashFeedback('error', data.message || '전자서명 및 대여 처리에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '전자서명 처리 중 오류가 발생했습니다.');
    } finally {
      setSigningAgreementId(null);
    }
  };

  const openAgreementModal = (agreement: RentalAgreement) => {
    setViewAgreement(agreement);
    setAgreeChecked(agreement.signatureStatus === 'signed');
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
          image: s?.imgFrontClean || s?.imgFront || s?.imgFlat || s?.imgBackClean || s?.imgBack,
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
  const handleSendAutomatedEmail = async (rental: Rental, emailType?: 'gentle' | 'warning' | 'strict') => {
    const daysOverdue = overdueDaysOfRental(rental, today);
    const stage = getOverdueStage(daysOverdue);
    const tone = emailType || stage?.emailType || (rental.notifyCount > 0 ? 'warning' : 'gentle');
    const stageLabel = stage?.label || '반납 안내';

    if (!confirm(`${rental.borrowerName} 님에게 [${stageLabel}] 메일을 발송하시겠습니까?`)) return;

    setSendingId(rental.rentalId);
    try {
      const draftRes = await fetch('/api/agent/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrowerName: rental.borrowerName,
          borrowerGroup: rental.borrowerGroup,
          sampleName: rental.sampleName,
          sampleCode: rental.sampleCode,
          dueDate: rental.dueDate,
          daysOverdue: Math.max(1, daysOverdue),
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
      const matchStatus = selectedStatus === '전체' || effectiveRentalStatus(r, today) === selectedStatus;
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
  // 연체일 계산: 반납완료면 (반납일 - 반납예정일), 대여중/연체이면 (기준일 - 반납예정일), 음수면 0
  const overdueDaysOf = (r: Rental): number => overdueDaysOfRental(r, today);
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
      <>
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

                {/* Step 2. 바코드 스캔 → 장바구니 */}
                <form onSubmit={handleBorrowScan} className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-indigo-600 text-white text-[10px] font-mono flex items-center justify-center">2</span>
                    상품 바코드 스캔 (장바구니 담기)
                  </label>
                  <div className={`relative rounded-xl border-2 border-dashed transition-colors ${borrower ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-slate-50'}`}>
                    <Barcode className={`absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 ${borrower ? 'text-indigo-500' : 'text-slate-300'}`} />
                    <input
                      ref={borrowCodeRef}
                      type="text"
                      value={borrowCode}
                      onChange={(e) => setBorrowCode(e.target.value)}
                      disabled={!borrower}
                      placeholder={borrower ? '상품코드 입력 후 Enter (바코드 리더기 자동 입력)' : '먼저 대여자를 확인하세요'}
                      className="w-full pl-13 pr-4 py-4 bg-transparent text-base font-mono font-bold tracking-wider focus:outline-none disabled:cursor-not-allowed placeholder:font-sans placeholder:text-sm placeholder:font-medium placeholder:tracking-normal"
                    />
                  </div>
                  <p className="text-[10.5px] text-slate-400 pl-1">
                    스캔한 샘플은 장바구니에 담깁니다. 동의서 작성·전자서명 완료 후 대여 처리됩니다.
                  </p>
                </form>

                {/* Step 3. 장바구니 + 동의서 작성 */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-indigo-600 text-white text-[10px] font-mono flex items-center justify-center">3</span>
                    대여 리스트
                    {borrowCart.length > 0 && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {borrowCart.length} PCS
                      </span>
                    )}
                  </label>

                  {borrowCart.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center">
                      <Package className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                      <p className="text-[11px] text-slate-400 font-medium">스캔한 샘플이 여기에 표시됩니다.</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500">
                            <th className="py-2 px-3">아이템</th>
                            <th className="py-2 px-3">Sample NO.</th>
                            <th className="py-2 px-3">브랜드</th>
                            <th className="py-2 px-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {borrowCart.map((item) => (
                            <tr key={item.sampleCode}>
                              <td className="py-2 px-3 font-semibold text-slate-800">{item.category}</td>
                              <td className="py-2 px-3 font-mono text-indigo-600 text-[11px]">{item.sampleCode}</td>
                              <td className="py-2 px-3 text-blue-600 font-bold">{item.brand}</td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(item.sampleCode)}
                                  className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500 cursor-pointer"
                                  title="삭제"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCreateAgreement}
                    disabled={!borrower || borrowCart.length === 0 || creatingAgreement}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {creatingAgreement ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    대여 동의서 작성 ({borrowCart.length || 0}건)
                  </button>
                </div>
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
                        referrerPolicy="no-referrer"
                        className="w-12 h-14 object-cover rounded-lg border border-slate-100 bg-slate-50 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-14 rounded-lg border border-slate-100 bg-slate-50 shrink-0 flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-300" />
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

      {mode === 'borrow' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="rental-agreement-table">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-extrabold text-slate-800">대여 동의서</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              서명 완료 후 대여 처리 · 미서명 {sortedAgreements.filter((a) => a.signatureStatus === 'pending').length}건
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  <th className="py-3 px-4 whitespace-nowrap">동의서번호</th>
                  <th className="py-3 px-4 whitespace-nowrap">대여자</th>
                  <th className="py-3 px-4 whitespace-nowrap">브랜드</th>
                  <th className="py-3 px-4 whitespace-nowrap">대여일</th>
                  <th className="py-3 px-4 whitespace-nowrap">수량</th>
                  <th className="py-3 px-4 whitespace-nowrap text-center">서명</th>
                  <th className="py-3 px-4 whitespace-nowrap text-center">보기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedAgreements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-slate-400 font-medium">
                      작성된 대여 동의서가 없습니다. 샘플 스캔 후 동의서를 작성해 주세요.
                    </td>
                  </tr>
                ) : (
                  sortedAgreements.map((agreement) => (
                    <tr key={agreement.agreementId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">{agreement.agreementId}</td>
                      <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">{agreement.borrowerName}</td>
                      <td className="py-3 px-4 font-bold text-blue-600 whitespace-nowrap">{agreement.brand}</td>
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{agreement.rentDate}</td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">{agreement.quantity} PCS</td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {agreement.signatureStatus === 'signed' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            서명 완료
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                            <PenLine className="w-3 h-3" />
                            서명 대기
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openAgreementModal(agreement)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          보기
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
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
                연체 {overdueCount}
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
                <th className="py-3 px-4 text-left whitespace-nowrap">단계</th>
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
                  const effectiveStatus = effectiveRentalStatus(rental, today);
                  const isOverdue = effectiveStatus === '연체중';
                  const isReturned = effectiveStatus === '반납완료';
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
                        {renderDueSubLabel(rental, today)}
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
                          {rentalStatusLabel(effectiveStatus)}
                        </span>
                      </td>
                      {/* 단계 */}
                      <td className="py-3.5 px-4 text-left">
                        {isOverdue ? (() => {
                          const od = overdueDaysOf(rental);
                          const stage = getOverdueStage(od);
                          if (!stage) return <span className="text-slate-300 text-[10px]">-</span>;
                          return (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSendAutomatedEmail(rental, stage.emailType)}
                                disabled={sendingId === rental.rentalId}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${stage.badgeClass}`}
                                title={`${stage.label} 메일 발송`}
                              >
                                {sendingId === rental.rentalId ? (
                                  <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                                ) : (
                                  <Sparkles className="w-3 h-3 shrink-0" />
                                )}
                                {stage.label}
                              </button>
                              {rental.notifyCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedRentalForHistory(rental)}
                                  className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-0.5 px-1.5 rounded-full border border-indigo-200 cursor-pointer shrink-0"
                                  title="발송 이력"
                                >
                                  <History className="w-3 h-3 shrink-0" />
                                  {rental.notifyCount}
                                </button>
                              )}
                            </div>
                          );
                        })() : (
                          <span className="text-slate-300 text-[10px]">-</span>
                        )}
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
          <div className="bg-white rounded-xl max-w-5xl w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
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
                    <th className="py-2.5 px-3 whitespace-nowrap">상품명</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">상품코드</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">대여일</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">{detailView.mode === 'active' ? '반납예정일' : '반납일'}</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-right">대여비용</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-right">연체비용(1차)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-right">연체비용(2차)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-center">연체일</th>
                    {detailView.mode === 'active' && <th className="py-2.5 px-3 whitespace-nowrap text-center">단계</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {detailRows.length === 0 ? (
                    <tr>
                      <td colSpan={detailView.mode === 'active' ? 10 : 9} className="py-16 text-center text-slate-400">
                        {detailView.mode === 'active' ? '현재 대여중인 상품이 없습니다.' : '반납한 상품이 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    detailRows.map((r) => {
                      const fee = feeOf(r.sampleCode);
                      const rowOverdue = effectiveRentalStatus(r, today) === '연체중';
                      return (
                        <tr key={r.rentalId} className={rowOverdue ? 'bg-rose-50/30' : ''}>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">{r.rentalId}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800 max-w-[200px] truncate" title={r.sampleName}>{r.sampleName}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-600 whitespace-nowrap">{r.sampleCode}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">{r.rentDate}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                            {detailView.mode === 'active' ? (
                              <>
                                <span className={rowOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}>{r.dueDate}</span>
                                {renderDueSubLabel(r, today)}
                              </>
                            ) : (
                              <>
                                <span className="text-slate-500">{r.dueDate}</span>
                                {renderDueSubLabel(r, today)}
                              </>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 text-[11px] text-right whitespace-nowrap">{fee.rental.toLocaleString()}원</td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] text-right whitespace-nowrap">{fee.o1.toLocaleString()}원</td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] text-right whitespace-nowrap">{fee.o2.toLocaleString()}원</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-center whitespace-nowrap">
                            {(() => {
                              const od = overdueDaysOf(r);
                              return od > 0 ? <span className="text-rose-600 font-bold">{od}일</span> : <span className="text-slate-300">-</span>;
                            })()}
                          </td>
                          {detailView.mode === 'active' && (
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {rowOverdue ? (() => {
                                const od = overdueDaysOf(r);
                                const stage = getOverdueStage(od);
                                if (!stage) return <span className="text-slate-300 text-[10px]">-</span>;
                                return (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleSendAutomatedEmail(r, stage.emailType)}
                                      disabled={sendingId === r.rentalId}
                                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border transition-colors cursor-pointer disabled:opacity-50 shrink-0 ${stage.badgeClass}`}
                                      title={`${stage.label} 메일 발송`}
                                    >
                                      {sendingId === r.rentalId ? (
                                        <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                                      ) : (
                                        <Sparkles className="w-3 h-3 shrink-0" />
                                      )}
                                      {stage.label}
                                    </button>
                                    {r.notifyCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedRentalForHistory(r)}
                                        className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-1 px-1.5 rounded-full border border-indigo-200 cursor-pointer shrink-0"
                                        title="발송 이력"
                                      >
                                        <History className="w-3 h-3 shrink-0" />
                                        {r.notifyCount}
                                      </button>
                                    )}
                                  </div>
                                );
                              })() : (
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

      {/* ============ 샘플 대여 동의서 모달 ============ */}
      {viewAgreement && (() => {
        const agreement = rentalAgreements.find((a) => a.agreementId === viewAgreement.agreementId) || viewAgreement;
        const isPending = agreement.signatureStatus === 'pending';
        const isSigning = signingAgreementId === agreement.agreementId;

        return (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => { setViewAgreement(null); setAgreeChecked(false); }}
          >
            <div
              className="bg-white rounded-2xl max-w-3xl w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-4"
              onClick={(e) => e.stopPropagation()}
              id="rental-agreement-modal"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-base font-extrabold text-slate-800">샘플 대여 동의서</h4>
                </div>
                <button
                  type="button"
                  onClick={() => { setViewAgreement(null); setAgreeChecked(false); }}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100 text-[11px]">
                  {[
                    ['동의서번호', agreement.agreementId],
                    ['브랜드', agreement.brand],
                    ['대여 목적', agreement.purpose],
                    ['대여자', agreement.borrowerName],
                    ['이메일', agreement.borrowerEmail],
                    ['소속', agreement.borrowerAffiliation],
                    ['대여일', agreement.rentDate],
                    ['반납 예정일', `${agreement.dueDate} · ${rentPeriodLabel(agreement.rentDays)}`],
                    ['총 수량', `${agreement.quantity} PCS`],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <span className="text-[9.5px] font-bold text-slate-400 block mb-0.5">{label}</span>
                      <span className="font-bold text-slate-800 break-all">{value}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <h5 className="text-xs font-extrabold text-slate-700 mb-2">샘플 대여 리스트</h5>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500">
                          <th className="py-2 px-3 w-10">No</th>
                          <th className="py-2 px-3">아이템</th>
                          <th className="py-2 px-3">Sample NO.</th>
                          <th className="py-2 px-3">비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {agreement.items.map((item, idx) => (
                          <tr key={item.sampleCode}>
                            <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{item.category}</td>
                            <td className="py-2 px-3 font-mono text-indigo-600">{item.sampleCode}</td>
                            <td className="py-2 px-3 text-slate-500">{item.remark || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h5 className="text-xs font-extrabold text-slate-700 mb-2">동의 사항</h5>
                  <ol className="space-y-2 text-[11px] text-slate-600 leading-relaxed list-decimal list-inside bg-slate-50 rounded-xl p-4 border border-slate-100">
                    {AGREEMENT_TERMS.map((term, idx) => (
                      <li key={idx} className="pl-1">{term}</li>
                    ))}
                  </ol>
                </div>

                {isPending ? (
                  <div className="space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreeChecked}
                        onChange={(e) => setAgreeChecked(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] text-slate-700 font-medium leading-relaxed">
                        위 동의 사항을 모두 확인하였으며, 샘플 대여·반납 규정을 준수할 것에 동의합니다. (전자서명)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSignAgreement(agreement)}
                      disabled={!agreeChecked || isSigning}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                      전자서명 및 대여 처리
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl px-4 py-3 text-sm font-bold">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    전자서명 완료 · {agreement.signedBy} · {agreement.signedAt}
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3.5 py-2 rounded-lg cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  인쇄
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3.5 py-2 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF 다운로드
                </button>
                <button
                  type="button"
                  onClick={() => { setViewAgreement(null); setAgreeChecked(false); }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

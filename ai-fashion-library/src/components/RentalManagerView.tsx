import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Check, Clock, AlertCircle, RefreshCw, CheckCircle2,
  Search, Package, FileText, Printer, Download, PenLine, Trash2, ChevronDown,
} from 'lucide-react';
import { Sample, Rental, RentalAgreement, RentalAgreementItem, Member, Category, LossDamageReport, rentalStatusLabel, effectiveRentalStatus } from '../types';
import { DateRangeCalendar } from './DateRangeCalendar';
import LossDamageReportModal, { LossDamageReportSubmitPayload } from './LossDamageReportModal';
import RentalDocumentBox from './RentalDocumentBox';

interface RentalManagerViewProps {
  viewMode: 'status' | 'documents';
  rentals: Rental[];
  rentalAgreements: RentalAgreement[];
  lossDamageReports: LossDamageReport[];
  samples: Sample[];
  members: Member[];
  categories?: Category[];
  onSaveDB: (newRentals: Rental[], newSamples: Sample[]) => void;
  onRefreshData?: () => void | Promise<void>;
}

type StatusTab = 'pending' | 'available' | 'active' | 'overdue' | 'bupyeong' | 'lost';
type PendingSubTab = 'approval' | 'signature' | 'rejected';

type PendingRow = {
  rowKey: string;
  agreement: RentalAgreement;
  item: RentalAgreementItem;
};

const APPROVAL_STATUS_CHIPS: { id: PendingSubTab; label: string; active: string; idle: string }[] = [
  { id: 'signature', label: '대기', active: 'bg-amber-600 text-white', idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { id: 'approval', label: '승인', active: 'bg-violet-600 text-white', idle: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { id: 'rejected', label: '반려', active: 'bg-slate-600 text-white', idle: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
];

const RENTAL_STATUS_TAB_CHIPS: { id: Exclude<StatusTab, 'pending'>; label: string; active: string; idle: string }[] = [
  { id: 'available', label: '대여가능', active: 'bg-emerald-600 text-white', idle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { id: 'active', label: '대여 중', active: 'bg-blue-600 text-white', idle: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { id: 'overdue', label: '연체', active: 'bg-rose-600 text-white', idle: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
  { id: 'bupyeong', label: '부평보관', active: 'bg-amber-600 text-white', idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { id: 'lost', label: '분실/훼손', active: 'bg-slate-600 text-white', idle: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
];

const TABLE_HEAD =
  'bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans text-left';
const TABLE_BODY = 'divide-y divide-slate-100 text-xs text-slate-700 font-medium';

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

const renderDueSubLabel = (rental: Rental, today: string) => {
  const effective = effectiveRentalStatus(rental, today);
  if (effective === '연체중') {
    const od = overdueDaysOfRental(rental, today);
    return <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">+{od}일 연체</span>;
  }
  const left = daysUntilDueOf(rental.dueDate, today);
  return <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{formatDDay(left)}</span>;
};

const borrowerGroupLabel = (agreement: RentalAgreement, members: Member[]) => {
  const member = members.find((m) => m.memberId === agreement.borrowerId);
  return member?.groupName || agreement.borrowerAffiliation;
};

export default function RentalManagerView({
  viewMode,
  rentals,
  rentalAgreements,
  lossDamageReports,
  samples,
  members,
  categories = [],
  onRefreshData,
}: RentalManagerViewProps) {
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [pendingSubTab, setPendingSubTab] = useState<PendingSubTab>('approval');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('전체');
  const [selectedCountry, setSelectedCountry] = useState('전체');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedRegisterer, setSelectedRegisterer] = useState('전체');
  const [regDateFrom, setRegDateFrom] = useState('');
  const [regDateTo, setRegDateTo] = useState('');
  const [regDateOpen, setRegDateOpen] = useState(false);
  const regDateFilterRef = useRef<HTMLDivElement>(null);
  const regDatePopoverRef = useRef<HTMLDivElement>(null);
  const [regDatePopoverPos, setRegDatePopoverPos] = useState({ top: 0, left: 0 });
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [signingAgreementId, setSigningAgreementId] = useState<string | null>(null);
  const [approvingAgreementId, setApprovingAgreementId] = useState<string | null>(null);
  const [rejectingAgreementId, setRejectingAgreementId] = useState<string | null>(null);
  const [markingLostId, setMarkingLostId] = useState<string | null>(null);
  const [viewAgreement, setViewAgreement] = useState<RentalAgreement | null>(null);
  const [lossReportRental, setLossReportRental] = useState<Rental | null>(null);
  const [viewLossReport, setViewLossReport] = useState<LossDamageReport | null>(null);
  const [savingLossReportId, setSavingLossReportId] = useState<string | null>(null);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  const today = todayStr();

  const flashFeedback = (type: 'ok' | 'error', msg: string) => {
    setFeedback({ type, msg });
    window.setTimeout(() => setFeedback(null), 2600);
  };

  const isAgreementApproved = (agreement: RentalAgreement) => agreement.approvalStatus === 'approved';
  const isAgreementRejected = (agreement: RentalAgreement) => agreement.approvalStatus === 'rejected';
  const isPendingApproval = (agreement: RentalAgreement) =>
    !isAgreementApproved(agreement) && !isAgreementRejected(agreement);
  const isAwaitingApproval = (agreement: RentalAgreement) =>
    agreement.signatureStatus === 'signed' && isPendingApproval(agreement);
  const isAwaitingSignature = (agreement: RentalAgreement) =>
    agreement.signatureStatus === 'pending' && isPendingApproval(agreement);

  const matchSearch = (query: string, ...values: (string | undefined)[]) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return values.some((v) => (v || '').toLowerCase().includes(q));
  };

  const getRegDateKey = (dateStr?: string) => (dateStr || '').substring(0, 10);
  const regDateFilterLabel =
    !regDateFrom && !regDateTo
      ? '등록일: 전체'
      : regDateFrom && regDateTo && regDateFrom === regDateTo
        ? `등록일: ${regDateFrom}`
        : `등록일: ${regDateFrom || '…'} ~ ${regDateTo || '…'}`;

  const CATEGORY_ORDER = ['오리지널', '유형화샘플', 'EP샘플', '자사샘플', '중국샘플'];
  const sortByCategoryOrder = (arr: string[]) =>
    [...arr].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  const topLevelCategoryNames = sortByCategoryOrder(
    categories.filter((c) => c.useYn === '사용' && !c.parentId).map((c) => c.name)
  );
  const categoryFilterOptions =
    topLevelCategoryNames.length > 0
      ? topLevelCategoryNames
      : sortByCategoryOrder(['오리지널', '유형화샘플', 'EP샘플', '자사샘플', '중국샘플']);

  const sampleOf = (code: string) => samples.find((s) => s.code === code);

  const sampleCountryOf = (s: Sample | undefined) =>
    s && (s.country === 'CN' || s.category === '중국샘플') ? '중국' : '한국';

  const sampleCategoryOf = (s: Sample | undefined, itemCategory?: string) => {
    const cat = s?.category || itemCategory || '';
    return cat === '중국샘플' ? '유형화샘플' : cat;
  };

  const matchesDetailFilters = (
    sampleCode: string,
    opts?: { brand?: string; itemCategory?: string; dateFallback?: string }
  ) => {
    const s = sampleOf(sampleCode);
    const brand = s?.brand || opts?.brand || '';
    const sampleDate = getRegDateKey(s?.regDate || opts?.dateFallback);
    const category = sampleCategoryOf(s, opts?.itemCategory);

    if (selectedBrand !== '전체' && brand !== selectedBrand) return false;
    if (selectedCountry !== '전체' && sampleCountryOf(s) !== selectedCountry) return false;
    if (selectedCategory !== '전체' && category !== selectedCategory) return false;
    if (selectedRegisterer !== '전체' && (s?.registerer || '') !== selectedRegisterer) return false;
    if (regDateFrom && (!sampleDate || sampleDate < regDateFrom)) return false;
    if (regDateTo && (!sampleDate || sampleDate > regDateTo)) return false;
    return true;
  };

  const relatedSamples = useMemo(() => samples, [samples]);

  const uniqueBrands = useMemo(
    () => ['전체', ...Array.from(new Set(relatedSamples.map((s) => s.brand).filter(Boolean))).sort()],
    [relatedSamples]
  );
  const uniqueRegisterers = useMemo(
    () => ['전체', ...Array.from(new Set(relatedSamples.map((s) => s.registerer).filter(Boolean))).sort()],
    [relatedSamples]
  );

  const filterAgreementsBySearch = (agreements: RentalAgreement[]) =>
    agreements
      .filter((agreement) => {
        const first = agreement.items[0];
        return matchSearch(
          searchQuery,
          agreement.agreementId,
          agreement.borrowerName,
          agreement.brand,
          first?.sampleName,
          first?.sampleCode
        );
      })
      .sort((a, b) => (b.createdAt || b.rentDate).localeCompare(a.createdAt || a.rentDate));

  const baseAwaitingApprovalAgreements = filterAgreementsBySearch(rentalAgreements.filter(isAwaitingApproval));
  const baseAwaitingSignatureAgreements = filterAgreementsBySearch(rentalAgreements.filter(isAwaitingSignature));
  const baseRejectedAgreements = filterAgreementsBySearch(rentalAgreements.filter(isAgreementRejected));

  const baseActiveRentals = rentals
    .filter((r) => effectiveRentalStatus(r, today) === '대여중')
    .filter((r) =>
      matchSearch(searchQuery, r.rentalId, r.sampleCode, r.sampleName, r.borrowerName, r.sampleBrand, r.borrowerGroup)
    )
    .sort((a, b) => b.rentDate.localeCompare(a.rentDate));

  const baseOverdueRentals = rentals
    .filter((r) => effectiveRentalStatus(r, today) === '연체중')
    .filter((r) =>
      matchSearch(searchQuery, r.rentalId, r.sampleCode, r.sampleName, r.borrowerName, r.sampleBrand, r.borrowerGroup)
    )
    .sort((a, b) => overdueDaysOfRental(b, today) - overdueDaysOfRental(a, today));

  const lastRentalOfSample = (code: string) =>
    rentals
      .filter((r) => r.sampleCode === code)
      .sort((a, b) => (b.returnDate || b.rentDate).localeCompare(a.returnDate || a.rentDate))[0];

  const buildBaseSamples = (status: Sample['status']) =>
    samples
      .filter((s) => s.status === status)
      .filter((s) => matchSearch(searchQuery, s.code, s.name, s.brand, s.registerer, s.category))
      .sort((a, b) => getRegDateKey(b.regDate).localeCompare(getRegDateKey(a.regDate)));

  const baseAvailableSamples = buildBaseSamples('대여가능');
  const baseBupyeongSamples = buildBaseSamples('부평보관');
  const baseLostSamples = samples
    .filter((s) => s.status === '분실')
    .filter((s) => {
      const last = lastRentalOfSample(s.code);
      return matchSearch(
        searchQuery,
        s.code,
        s.name,
        s.brand,
        s.registerer,
        last?.borrowerName,
        last?.borrowerGroup,
        last?.rentalId
      );
    })
    .sort((a, b) => {
      const ra = lastRentalOfSample(a.code);
      const rb = lastRentalOfSample(b.code);
      return (rb?.returnDate || rb?.rentDate || '').localeCompare(ra?.returnDate || ra?.rentDate || '');
    });

  const buildPendingRows = (agreements: RentalAgreement[]): PendingRow[] =>
    agreements.flatMap((agreement) =>
      agreement.items
        .filter((item) =>
          matchesDetailFilters(item.sampleCode, {
            brand: item.brand,
            itemCategory: item.category,
            dateFallback: agreement.createdAt || agreement.rentDate,
          })
        )
        .map((item) => ({
          rowKey: `${agreement.agreementId}-${item.sampleCode}`,
          agreement,
          item,
        }))
    );

  const approvalPendingRows = buildPendingRows(baseAwaitingApprovalAgreements);
  const signaturePendingRows = buildPendingRows(baseAwaitingSignatureAgreements);
  const rejectedPendingRows = buildPendingRows(baseRejectedAgreements);

  const pendingSubTabCounts = {
    approval: approvalPendingRows.length,
    signature: signaturePendingRows.length,
    rejected: rejectedPendingRows.length,
  };

  const selectPendingSubTab = (sub: PendingSubTab) => {
    setStatusTab('pending');
    setPendingSubTab(sub);
    setSelectedRowKeys(new Set());
    setCurrentPage(1);
  };

  const selectRentalStatusTab = (tab: Exclude<StatusTab, 'pending'>) => {
    setStatusTab(tab);
    setSelectedRowKeys(new Set());
    setCurrentPage(1);
  };

  const pendingRows =
    pendingSubTab === 'approval'
      ? approvalPendingRows
      : pendingSubTab === 'signature'
        ? signaturePendingRows
        : rejectedPendingRows;

  const tabCounts = {
    available: baseAvailableSamples.length,
    active: baseActiveRentals.length,
    overdue: baseOverdueRentals.length,
    bupyeong: baseBupyeongSamples.length,
    lost: baseLostSamples.length,
  };

  const activeRentals = baseActiveRentals.filter((r) =>
    matchesDetailFilters(r.sampleCode, { brand: r.sampleBrand, dateFallback: r.rentDate })
  );

  const overdueRentals = baseOverdueRentals.filter((r) =>
    matchesDetailFilters(r.sampleCode, { brand: r.sampleBrand, dateFallback: r.rentDate })
  );

  const availableSamples = baseAvailableSamples.filter((s) =>
    matchesDetailFilters(s.code, { brand: s.brand, dateFallback: s.regDate })
  );

  const bupyeongSamples = baseBupyeongSamples.filter((s) =>
    matchesDetailFilters(s.code, { brand: s.brand, dateFallback: s.regDate })
  );

  const lostSamples = baseLostSamples.filter((s) =>
    matchesDetailFilters(s.code, { brand: s.brand, dateFallback: s.regDate })
  );

  const currentListCount =
    statusTab === 'pending'
      ? pendingRows.length
      : statusTab === 'available'
        ? availableSamples.length
        : statusTab === 'active'
          ? activeRentals.length
          : statusTab === 'overdue'
            ? overdueRentals.length
            : statusTab === 'bupyeong'
              ? bupyeongSamples.length
              : lostSamples.length;

  const totalPages = Math.max(1, Math.ceil(currentListCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedPendingRows = pendingRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedActiveRentals = activeRentals.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedOverdueRentals = overdueRentals.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedAvailableSamples = availableSamples.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedBupyeongSamples = bupyeongSamples.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedLostSamples = lostSamples.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBrand, selectedCountry, selectedCategory, selectedRegisterer, regDateFrom, regDateTo, statusTab, pendingSubTab, pageSize]);

  useEffect(() => {
    if (!regDateOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (regDateFilterRef.current?.contains(t) || regDatePopoverRef.current?.contains(t)) return;
      setRegDateOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [regDateOpen]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedBrand('전체');
    setSelectedCountry('전체');
    setSelectedCategory('전체');
    setSelectedRegisterer('전체');
    setRegDateFrom('');
    setRegDateTo('');
    setRegDateOpen(false);
    setSelectedRowKeys(new Set());
    setCurrentPage(1);
  };

  const handleExcelDownload = () => {
    const esc = (v: unknown) => {
      const str = v == null ? '' : String(v);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    let headers: string[] = [];
    let rows: string[][] = [];

    if (statusTab === 'pending') {
      if (pendingSubTab === 'rejected') {
        headers = ['상품코드', '상품명', '브랜드', '대여자', '신청일', '대여기간', '서명', '반려일', '반려자'];
        rows = pendingRows.map(({ agreement, item }) => [
          item.sampleCode,
          item.sampleName,
          item.brand || agreement.brand,
          agreement.borrowerName,
          agreement.createdAt || agreement.rentDate,
          rentPeriodLabel(agreement.rentDays),
          agreement.signatureStatus === 'signed' ? '서명완료' : '서명대기',
          agreement.rejectedAt || '-',
          agreement.rejectedBy || '-',
        ]);
      } else {
        headers = ['상품코드', '상품명', '브랜드', '대여자', '신청일', '대여기간', '서명', '처리상태'];
        rows = pendingRows.map(({ agreement, item }) => [
          item.sampleCode,
          item.sampleName,
          item.brand || agreement.brand,
          agreement.borrowerName,
          agreement.createdAt || agreement.rentDate,
          rentPeriodLabel(agreement.rentDays),
          agreement.signatureStatus === 'signed' ? '서명완료' : '서명대기',
          pendingSubTab === 'approval' ? '승인 대기' : '서명 대기',
        ]);
      }
    } else if (statusTab === 'active') {
      headers = ['대여번호', '상품코드', '상품명', '브랜드', '대여자', '대여일', '반납예정', '상태'];
      rows = activeRentals.map((r) => [
        r.rentalId,
        r.sampleCode,
        r.sampleName,
        r.sampleBrand,
        r.borrowerName,
        r.rentDate,
        r.dueDate,
        rentalStatusLabel(effectiveRentalStatus(r, today)),
      ]);
    } else if (statusTab === 'available' || statusTab === 'bupyeong') {
      const list = statusTab === 'available' ? availableSamples : bupyeongSamples;
      const statusLabel = statusTab === 'available' ? '대여가능' : '부평보관';
      headers = ['상품코드', '상품명', '브랜드', '카테고리', '등록일', '등록자', '상태'];
      rows = list.map((s) => [
        s.code,
        s.name,
        s.brand,
        s.category,
        getRegDateKey(s.regDate),
        s.registerer,
        statusLabel,
      ]);
    } else if (statusTab === 'lost') {
      headers = ['상품코드', '상품명', '브랜드', '대여자', '대여일', '처리일', '상태'];
      rows = lostSamples.map((s) => {
        const last = lastRentalOfSample(s.code);
        return [
          s.code,
          s.name,
          s.brand,
          last?.borrowerName || '-',
          last?.rentDate || '-',
          last?.returnDate || '-',
          '분실',
        ];
      });
    } else {
      headers = ['대여번호', '상품코드', '상품명', '브랜드', '대여자', '대여일', '반납예정', '연체일'];
      rows = overdueRentals.map((r) => [
        r.rentalId,
        r.sampleCode,
        r.sampleName,
        r.sampleBrand,
        r.borrowerName,
        r.rentDate,
        r.dueDate,
        `${overdueDaysOfRental(r, today)}일`,
      ]);
    }

    if (rows.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const csv = [headers.map(esc).join(','), ...rows.map((row) => row.map(esc).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      statusTab === 'pending'
        ? `대여반납_${statusTab}_${pendingSubTab}_${today}.csv`
        : `대여반납_${statusTab}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentRowKeys =
    statusTab === 'pending'
      ? pendingRows.map((r) => r.rowKey)
      : statusTab === 'available'
        ? availableSamples.map((s) => s.code)
        : statusTab === 'active'
          ? activeRentals.map((r) => r.rentalId)
          : statusTab === 'overdue'
            ? overdueRentals.map((r) => r.rentalId)
            : statusTab === 'bupyeong'
              ? bupyeongSamples.map((s) => s.code)
              : lostSamples.map((s) => s.code);

  const allCurrentSelected = currentRowKeys.length > 0 && currentRowKeys.every((k) => selectedRowKeys.has(k));

  const toggleSelectAll = () => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (allCurrentSelected) {
        currentRowKeys.forEach((k) => next.delete(k));
      } else {
        currentRowKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const toggleSelectRow = (key: string) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sampleThumb = (code: string) => {
    const s = sampleOf(code);
    return s?.imgFrontClean || s?.imgFront || s?.imgFlat || s?.imgBackClean || s?.imgBack;
  };

  const renderSampleImage = (code: string, alt: string) => {
    const thumb = sampleThumb(code);
    return (
      <div className="w-16 h-20 rounded-md bg-slate-50 overflow-hidden inline-flex items-center justify-center border-0">
        {thumb ? (
          <img src={thumb} referrerPolicy="no-referrer" alt={alt} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-5 h-5 text-slate-300" />
        )}
      </div>
    );
  };

  const findAgreement = (rental: Rental) =>
    rental.agreementId ? rentalAgreements.find((a) => a.agreementId === rental.agreementId) : undefined;

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
        flashFeedback('ok', data.message || '전자서명이 완료되었습니다.');
        setViewAgreement(data.agreement);
        setAgreeChecked(false);
        onRefreshData?.();
      } else {
        flashFeedback('error', data.message || '전자서명에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '전자서명 처리 중 오류가 발생했습니다.');
    } finally {
      setSigningAgreementId(null);
    }
  };

  const handleApproveAgreement = async (agreement: RentalAgreement) => {
    if (agreement.signatureStatus !== 'signed') {
      setViewAgreement(agreement);
      flashFeedback('error', '전자서명 완료 후 승인할 수 있습니다.');
      return;
    }
    if (!confirm(`${agreement.borrowerName} 님 대여 신청(${agreement.agreementId})을 승인하시겠습니까?`)) return;

    setApprovingAgreementId(agreement.agreementId);
    try {
      const res = await fetch(`/api/rental-agreements/${agreement.agreementId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: '관리자' }),
      });
      const data = await res.json();
      if (data.success) {
        flashFeedback('ok', data.message || '대여 승인이 완료되었습니다.');
        if (viewAgreement?.agreementId === agreement.agreementId) {
          setViewAgreement(data.agreement);
        }
        onRefreshData?.();
      } else {
        flashFeedback('error', data.message || '대여 승인에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '대여 승인 처리 중 오류가 발생했습니다.');
    } finally {
      setApprovingAgreementId(null);
    }
  };

  const handleRejectAgreement = async (agreement: RentalAgreement) => {
    if (!confirm(`${agreement.borrowerName} 님 대여 신청(${agreement.agreementId})을 반려하시겠습니까?`)) return;

    setRejectingAgreementId(agreement.agreementId);
    try {
      const res = await fetch(`/api/rental-agreements/${agreement.agreementId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectedBy: '관리자' }),
      });
      const data = await res.json();
      if (data.success) {
        flashFeedback('ok', data.message || '대여 신청이 반려되었습니다.');
        if (viewAgreement?.agreementId === agreement.agreementId) {
          setViewAgreement(null);
        }
        setPendingSubTab('rejected');
        setSelectedRowKeys(new Set());
        setCurrentPage(1);
        onRefreshData?.();
      } else {
        flashFeedback('error', data.message || '반려 처리에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '반려 처리 중 오류가 발생했습니다.');
    } finally {
      setRejectingAgreementId(null);
    }
  };

  const findLossReport = (sampleCode: string) =>
    lossDamageReports
      .filter((r) => r.sampleCode === sampleCode)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];

  const handleMarkLostDamage = (rental: Rental) => {
    setLossReportRental(rental);
  };

  const updateLossDamageReport = async (reportId: string, payload: LossDamageReportSubmitPayload) => {
    setSavingLossReportId(reportId);
    try {
      const res = await fetch(`/api/loss-damage-reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        flashFeedback('ok', data.message || '사유서가 저장되었습니다.');
        if (data.report) setViewLossReport(data.report);
        await onRefreshData?.();
      } else {
        flashFeedback('error', data.message || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '사유서 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingLossReportId(null);
    }
  };

  const submitLossDamageReport = async (payload: LossDamageReportSubmitPayload) => {
    if (!lossReportRental) return;

    setMarkingLostId(lossReportRental.rentalId);
    try {
      const res = await fetch(`/api/rentals/${lossReportRental.rentalId}/mark-lost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        flashFeedback('ok', data.message || '분실/훼손 처리 및 사유서가 등록되었습니다.');
        setLossReportRental(null);
        setStatusTab('lost');
        setSelectedRowKeys(new Set());
        setCurrentPage(1);
        await onRefreshData?.();
      } else {
        flashFeedback('error', data.message || '처리에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '분실/훼손 처리 중 오류가 발생했습니다.');
    } finally {
      setMarkingLostId(null);
    }
  };

  const openAgreementModal = (agreement: RentalAgreement) => {
    setViewAgreement(agreement);
    setAgreeChecked(agreement.signatureStatus === 'signed');
  };

  const renderAgreementCell = (rental: Rental) => {
    const agreement = findAgreement(rental);
    if (!agreement) {
      return <span className="text-slate-300 text-[11px]">-</span>;
    }
    if (agreement.signatureStatus === 'pending') {
      return (
        <button
          type="button"
          onClick={() => openAgreementModal(agreement)}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-800 cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          서명대기
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => openAgreementModal(agreement)}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-indigo-600 cursor-pointer"
      >
        <FileText className="w-3.5 h-3.5" />
        보기
      </button>
    );
  };

  const renderPendingActions = (agreement: RentalAgreement) => {
    if (pendingSubTab === 'signature') {
      return (
        <span className="text-[11px] font-bold text-amber-700 whitespace-nowrap">대여자 서명 대기</span>
      );
    }
    if (pendingSubTab === 'rejected') {
      return <span className="text-slate-300 text-[11px]">—</span>;
    }

    const isApproving = approvingAgreementId === agreement.agreementId;
    const isRejecting = rejectingAgreementId === agreement.agreementId;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => handleApproveAgreement(agreement)}
          disabled={isApproving || isRejecting}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold disabled:opacity-50 cursor-pointer"
        >
          {isApproving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          승인
        </button>
        <button
          type="button"
          onClick={() => handleRejectAgreement(agreement)}
          disabled={isApproving || isRejecting}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-extrabold disabled:opacity-50 cursor-pointer"
        >
          {isRejecting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
          반려
        </button>
      </div>
    );
  };

  const pendingEmptyMessage =
    pendingSubTab === 'approval'
      ? '승인 대기 중인 대여 신청이 없습니다.'
      : pendingSubTab === 'signature'
        ? '서명 대기 중인 대여 신청이 없습니다.'
        : '반려된 대여 신청이 없습니다.';

  const pendingTableColSpan = pendingSubTab === 'rejected' ? 14 : 13;

  const renderPendingAgreementCell = (agreement: RentalAgreement) => (
    <button
      type="button"
      onClick={() => openAgreementModal(agreement)}
      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg cursor-pointer"
    >
      <FileText className="w-3.5 h-3.5" />
      보기
    </button>
  );

  const inventoryStatusBadgeClass = (status: Sample['status']) => {
    if (status === '대여가능') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (status === '부평보관') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const renderInventorySampleTable = (
    tabId: 'available' | 'bupyeong',
    list: Sample[],
    pagedList: Sample[],
    emptyMessage: string,
    statusLabel: Sample['status']
  ) => (
    <div className="overflow-x-auto" id={`rental-${tabId}-table-wrap`}>
      <table className="w-full text-left border-collapse" id={`rental-${tabId}-table`}>
        <thead>
          <tr className={TABLE_HEAD}>
            <th className="py-3 px-3 text-center w-10">
              <input
                type="checkbox"
                checked={allCurrentSelected}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                title="전체 선택"
              />
            </th>
            <th className="py-3 pl-2.5 pr-1 w-8 whitespace-nowrap">번호</th>
            <th className="py-3 px-2.5 whitespace-nowrap">상품코드</th>
            <th className="py-3 px-2.5 whitespace-nowrap">상품 이미지</th>
            <th className="py-3 px-2.5 whitespace-nowrap">상품명</th>
            <th className="py-3 px-2.5 whitespace-nowrap">카테고리</th>
            <th className="py-3 px-2.5 whitespace-nowrap">브랜드</th>
            <th className="py-3 px-2.5 whitespace-nowrap">등록일</th>
            <th className="py-3 px-2.5 whitespace-nowrap">등록자</th>
            <th className="py-3 px-2.5 whitespace-nowrap">상태</th>
          </tr>
        </thead>
        <tbody className={TABLE_BODY}>
          {list.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-20 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            pagedList.map((sample, index) => {
              const rowNo = (safePage - 1) * pageSize + index + 1;
              return (
                <tr
                  key={sample.code}
                  className={`hover:bg-slate-50/70 transition-colors ${selectedRowKeys.has(sample.code) ? 'bg-violet-50/40' : ''}`}
                >
                  <td className="py-3.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRowKeys.has(sample.code)}
                      onChange={() => toggleSelectRow(sample.code)}
                      className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                    />
                  </td>
                  <td className="py-3.5 pl-2.5 pr-1 font-mono text-slate-400 text-[11px]">{rowNo}</td>
                  <td className="py-3.5 px-2.5 font-mono font-bold text-indigo-650 text-[11px] whitespace-nowrap">{sample.code}</td>
                  <td className="py-3.5 px-2.5">{renderSampleImage(sample.code, sample.name)}</td>
                  <td className="py-3.5 px-2.5">
                    <div className="font-semibold text-slate-800 max-w-[190px] truncate" title={sample.name}>
                      {sample.name}
                    </div>
                  </td>
                  <td className="py-3.5 px-2.5">
                    <span className="text-xs text-slate-600 bg-slate-100 py-0.5 px-2 rounded-md font-medium">
                      {sample.category || '-'}
                    </span>
                  </td>
                  <td className="py-3.5 px-2.5 font-semibold text-slate-700 whitespace-nowrap">{sample.brand}</td>
                  <td className="py-3.5 px-2.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">{getRegDateKey(sample.regDate)}</td>
                  <td className="py-3.5 px-2.5 text-slate-700 whitespace-nowrap">{sample.registerer || '-'}</td>
                  <td className="py-3.5 px-2.5">
                    <span className={`text-[11px] font-bold py-1 px-2.5 rounded-full border ${inventoryStatusBadgeClass(statusLabel)}`}>
                      {statusLabel}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4" id="rental-manager-root">
      {feedback && (
        <div
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}
        >
          {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.msg}
        </div>
      )}

      {viewMode === 'status' && (
      <>
      <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-3xs" id="rentals-filter-panel">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="검색 (상품코드, 상품명, 대여자, 대여번호)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100/70 border-0 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-violet-500 rounded-xl text-xs font-medium placeholder:text-slate-400 transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 p-0.5 hover:bg-slate-200 rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        <div className="pt-2.5 space-y-2.5">
          <div className="flex flex-col lg:flex-row lg:justify-between items-stretch lg:items-center gap-x-3 gap-y-2.5" id="rental-filter-chips-row">
            <div className="flex flex-nowrap gap-x-2 items-center overflow-x-auto min-w-0 shrink">
              <button
                type="button"
                onClick={resetAllFilters}
                className="bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs font-bold py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>필터 초기화</span>
              </button>

              <div className="relative shrink-0" ref={regDateFilterRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (regDateOpen) {
                      setRegDateOpen(false);
                      return;
                    }
                    if (regDateFilterRef.current) {
                      const rect = regDateFilterRef.current.getBoundingClientRect();
                      const popoverWidth = 560;
                      let left = rect.left;
                      if (left + popoverWidth > window.innerWidth - 16) {
                        left = Math.max(16, window.innerWidth - popoverWidth - 16);
                      }
                      setRegDatePopoverPos({ top: rect.bottom + 4, left });
                    }
                    setRegDateOpen(true);
                  }}
                  className={`bg-white hover:bg-slate-50 border pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none transition-colors cursor-pointer whitespace-nowrap ${
                    regDateOpen ? 'border-violet-500' : 'border-slate-200 focus:border-violet-500'
                  }`}
                >
                  {regDateFilterLabel}
                </button>
                <ChevronDown className={`absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none transition-transform ${regDateOpen ? 'rotate-180' : ''}`} />
              </div>

              {regDateOpen &&
                createPortal(
                  <div ref={regDatePopoverRef} className="fixed z-[9999]" style={{ top: regDatePopoverPos.top, left: regDatePopoverPos.left }}>
                    <DateRangeCalendar
                      initialFrom={regDateFrom}
                      initialTo={regDateTo}
                      onConfirm={(from, to) => {
                        setRegDateFrom(from);
                        setRegDateTo(to);
                        setRegDateOpen(false);
                      }}
                      onCancel={() => setRegDateOpen(false)}
                    />
                  </div>,
                  document.body
                )}

              <div className="relative shrink-0">
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                >
                  {uniqueBrands.map((b) => (
                    <option key={b} value={b}>
                      {b === '전체' ? '브랜드: 전체' : b}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative shrink-0">
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                >
                  <option value="전체">국가: 전체</option>
                  <option value="한국">한국</option>
                  <option value="중국">중국</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative shrink-0">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                >
                  <option value="전체">카테고리: 전체</option>
                  {categoryFilterOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative shrink-0">
                <select
                  value={selectedRegisterer}
                  onChange={(e) => setSelectedRegisterer(e.target.value)}
                  className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                >
                  {uniqueRegisterers.map((r) => (
                    <option key={r} value={r}>
                      {r === '전체' ? '등록자: 전체' : r}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 lg:self-center shrink-0 self-end justify-end w-full lg:w-auto">
              <span className="text-[11px] text-slate-400 font-extrabold font-mono uppercase tracking-wide whitespace-nowrap">
                목록 {currentListCount.toLocaleString()}건
              </span>
              <button
                type="button"
                onClick={handleExcelDownload}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shadow-3xs"
              >
                <Download className="w-3.5 h-3.5" />
                엑셀 다운로드
              </button>
              <div className="relative">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3 pr-7 py-1.5 text-[11px] font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}개씩
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center pt-0.5" id="rental-status-chips">
            <div className="flex items-center gap-1.5 shrink-0" id="rental-approval-status-chips">
              <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">승인 여부</span>
              {APPROVAL_STATUS_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => selectPendingSubTab(chip.id)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    statusTab === 'pending' && pendingSubTab === chip.id ? chip.active : chip.idle
                  }`}
                  id={`rental-status-tab-pending-${chip.id}`}
                >
                  {chip.label} {pendingSubTabCounts[chip.id]}
                </button>
              ))}
            </div>

            <div className="hidden sm:block w-px h-5 bg-slate-200 mx-1 shrink-0" aria-hidden="true" />

            {RENTAL_STATUS_TAB_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => selectRentalStatusTab(chip.id)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusTab === chip.id ? chip.active : chip.idle
                }`}
                id={`rental-status-tab-${chip.id}`}
              >
                {chip.label} {tabCounts[chip.id]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden" id="rentals-status-root">
        {/* 승인 대기 */}
        {statusTab === 'pending' && (
          <div className="overflow-x-auto" id="rental-pending-table-wrap">
            <table className="w-full text-left border-collapse" id="rental-pending-table">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="py-3 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                      title="전체 선택"
                    />
                  </th>
                  <th className="py-3 pl-2.5 pr-1 w-8 whitespace-nowrap">번호</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품코드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품 이미지</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품명</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">카테고리</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">브랜드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여자</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">신청일</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여기간</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">서명</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">동의서</th>
                  {pendingSubTab === 'rejected' ? (
                    <>
                      <th className="py-3 px-2.5 whitespace-nowrap">반려일</th>
                      <th className="py-3 px-2.5 whitespace-nowrap">반려자</th>
                    </>
                  ) : (
                    <th className="py-3 px-2.5 whitespace-nowrap">
                      {pendingSubTab === 'signature' ? '상태' : '동작'}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {pendingRows.length === 0 ? (
                  <tr>
                    <td colSpan={pendingTableColSpan} className="py-20 text-center text-slate-400">
                      {pendingEmptyMessage}
                    </td>
                  </tr>
                ) : (
                  pagedPendingRows.map((row, index) => {
                    const { agreement, item, rowKey } = row;
                    const group = borrowerGroupLabel(agreement, members);
                    const sample = sampleOf(item.sampleCode);
                    const rowNo = (safePage - 1) * pageSize + index + 1;
                    return (
                      <tr
                        key={rowKey}
                        className={`hover:bg-slate-50/70 transition-colors ${selectedRowKeys.has(rowKey) ? 'bg-violet-50/40' : ''}`}
                        id={`pending-row-${rowKey}`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRowKeys.has(rowKey)}
                            onChange={() => toggleSelectRow(rowKey)}
                            className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                          />
                        </td>
                        <td className="py-3.5 pl-2.5 pr-1 font-mono text-slate-400 text-[11px]">{rowNo}</td>
                        <td className="py-3.5 px-2.5 font-mono font-bold text-indigo-650 text-[11px] whitespace-nowrap">{item.sampleCode}</td>
                        <td className="py-3.5 px-2.5">{renderSampleImage(item.sampleCode, item.sampleName)}</td>
                        <td className="py-3.5 px-2.5">
                          <div className="font-semibold text-slate-800 max-w-[190px] truncate" title={item.sampleName}>
                            {item.sampleName}
                          </div>
                        </td>
                        <td className="py-3.5 px-2.5">
                          <span className="text-xs text-slate-600 bg-slate-100 py-0.5 px-2 rounded-md font-medium">
                            {item.category || sample?.category || '-'}
                          </span>
                        </td>
                        <td className="py-3.5 px-2.5 font-semibold text-slate-700 whitespace-nowrap">{item.brand || agreement.brand}</td>
                        <td className="py-3.5 px-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-800">{agreement.borrowerName}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">{group}</div>
                        </td>
                        <td className="py-3.5 px-2.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                          {agreement.createdAt || agreement.rentDate}
                        </td>
                        <td className="py-3.5 px-2.5 font-bold text-slate-700 whitespace-nowrap">
                          {rentPeriodLabel(agreement.rentDays)}
                        </td>
                        <td className="py-3.5 px-2.5">
                          {agreement.signatureStatus === 'signed' ? (
                            <span className="text-[11px] font-bold py-1 px-2.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">
                              서명완료
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold py-1 px-2.5 rounded-full border bg-amber-50 text-amber-700 border-amber-100">
                              서명대기
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-2.5">{renderPendingAgreementCell(agreement)}</td>
                        {pendingSubTab === 'rejected' ? (
                          <>
                            <td className="py-3.5 px-2.5 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                              {agreement.rejectedAt || '-'}
                            </td>
                            <td className="py-3.5 px-2.5 font-semibold text-slate-700 whitespace-nowrap">
                              {agreement.rejectedBy || '-'}
                            </td>
                          </>
                        ) : (
                          <td className="py-3.5 px-2.5">{renderPendingActions(agreement)}</td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 대여 중 */}
        {statusTab === 'active' && (
          <div className="overflow-x-auto" id="rental-active-table-wrap">
            <table className="w-full text-left border-collapse" id="rental-active-table">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="py-3 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                      title="전체 선택"
                    />
                  </th>
                  <th className="py-3 pl-2.5 pr-1 w-8 whitespace-nowrap">번호</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여번호</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품코드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품 이미지</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품명</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">브랜드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여자</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여일</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">반납예정</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상태</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">동의서</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {activeRentals.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-20 text-center text-slate-400">
                      대여 중인 샘플이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pagedActiveRentals.map((rental, index) => {
                    const rowNo = (safePage - 1) * pageSize + index + 1;
                    return (
                    <tr
                      key={rental.rentalId}
                      className={`hover:bg-slate-50/70 transition-colors ${selectedRowKeys.has(rental.rentalId) ? 'bg-violet-50/40' : ''}`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRowKeys.has(rental.rentalId)}
                          onChange={() => toggleSelectRow(rental.rentalId)}
                          className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                        />
                      </td>
                      <td className="py-3.5 pl-2.5 pr-1 font-mono text-slate-400 text-[11px]">{rowNo}</td>
                      <td className="py-3.5 px-2.5 font-mono text-slate-500 text-[11px] whitespace-nowrap">{rental.rentalId}</td>
                      <td className="py-3.5 px-2.5 font-mono font-bold text-indigo-650 text-[11px] whitespace-nowrap">{rental.sampleCode}</td>
                      <td className="py-3.5 px-2.5">{renderSampleImage(rental.sampleCode, rental.sampleName)}</td>
                      <td className="py-3.5 px-2.5">
                        <div className="font-semibold text-slate-800 max-w-[190px] truncate" title={rental.sampleName}>
                          {rental.sampleName}
                        </div>
                      </td>
                      <td className="py-3.5 px-2.5 font-semibold text-slate-700 whitespace-nowrap">{rental.sampleBrand}</td>
                      <td className="py-3.5 px-2.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{rental.borrowerName}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{rental.borrowerGroup}</div>
                      </td>
                      <td className="py-3.5 px-2.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">{rental.rentDate}</td>
                      <td className="py-3.5 px-2.5 font-mono text-[11px] whitespace-nowrap">
                        <span className="text-slate-600">{rental.dueDate}</span>
                        {renderDueSubLabel(rental, today)}
                      </td>
                      <td className="py-3.5 px-2.5">
                        <span className="text-[11px] font-bold py-1 px-2.5 rounded-full border bg-blue-50 text-blue-700 border-blue-100">
                          {rentalStatusLabel(effectiveRentalStatus(rental, today))}
                        </span>
                      </td>
                      <td className="py-3.5 px-2.5">{renderAgreementCell(rental)}</td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 대여가능 */}
        {statusTab === 'available' &&
          renderInventorySampleTable(
            'available',
            availableSamples,
            pagedAvailableSamples,
            '대여 가능한 샘플이 없습니다.',
            '대여가능'
          )}

        {/* 부평보관 */}
        {statusTab === 'bupyeong' &&
          renderInventorySampleTable(
            'bupyeong',
            bupyeongSamples,
            pagedBupyeongSamples,
            '부평 보관 중인 샘플이 없습니다.',
            '부평보관'
          )}

        {/* 분실/훼손 */}
        {statusTab === 'lost' && (
          <div className="overflow-x-auto" id="rental-lost-table-wrap">
            <table className="w-full text-left border-collapse" id="rental-lost-table">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="py-3 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                      title="전체 선택"
                    />
                  </th>
                  <th className="py-3 pl-2.5 pr-1 w-8 whitespace-nowrap">번호</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품코드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품 이미지</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품명</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">브랜드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여자</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여일</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">처리일</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상태</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">사유서</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">동의서</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {lostSamples.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-20 text-center text-slate-400">
                      분실/훼손 처리된 샘플이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pagedLostSamples.map((sample, index) => {
                    const last = lastRentalOfSample(sample.code);
                    const lossReport = findLossReport(sample.code);
                    const rowNo = (safePage - 1) * pageSize + index + 1;
                    return (
                      <tr
                        key={sample.code}
                        className={`hover:bg-slate-50/70 transition-colors ${selectedRowKeys.has(sample.code) ? 'bg-violet-50/40' : ''}`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRowKeys.has(sample.code)}
                            onChange={() => toggleSelectRow(sample.code)}
                            className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                          />
                        </td>
                        <td className="py-3.5 pl-2.5 pr-1 font-mono text-slate-400 text-[11px]">{rowNo}</td>
                        <td className="py-3.5 px-2.5 font-mono font-bold text-indigo-650 text-[11px] whitespace-nowrap">{sample.code}</td>
                        <td className="py-3.5 px-2.5">{renderSampleImage(sample.code, sample.name)}</td>
                        <td className="py-3.5 px-2.5">
                          <div className="font-semibold text-slate-800 max-w-[190px] truncate" title={sample.name}>
                            {sample.name}
                          </div>
                        </td>
                        <td className="py-3.5 px-2.5 font-semibold text-slate-700 whitespace-nowrap">{sample.brand}</td>
                        <td className="py-3.5 px-2.5 whitespace-nowrap">
                          {last ? (
                            <>
                              <div className="font-bold text-slate-800">{last.borrowerName}</div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5">{last.borrowerGroup}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">{last?.rentDate || '-'}</td>
                        <td className="py-3.5 px-2.5 font-mono text-slate-500 text-[11px] whitespace-nowrap">{last?.returnDate || '-'}</td>
                        <td className="py-3.5 px-2.5">
                          <span className="text-[11px] font-bold py-1 px-2.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200">
                            분실
                          </span>
                        </td>
                        <td className="py-3.5 px-2.5">
                          {lossReport ? (
                            <button
                              type="button"
                              onClick={() => setViewLossReport(lossReport)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded-lg cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              보기
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2.5">
                          {last ? renderAgreementCell(last) : <span className="text-slate-300 text-[11px]">-</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 연체 */}
        {statusTab === 'overdue' && (
          <div className="overflow-x-auto" id="rental-overdue-table-wrap">
            <table className="w-full text-left border-collapse" id="rental-overdue-table">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="py-3 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                      title="전체 선택"
                    />
                  </th>
                  <th className="py-3 pl-2.5 pr-1 w-8 whitespace-nowrap">번호</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여번호</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품코드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품 이미지</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품명</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">브랜드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여자</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여일</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">반납예정</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상태</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">동의서</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">동작</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {overdueRentals.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-20 text-center text-slate-400">
                      연체 중인 샘플이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pagedOverdueRentals.map((rental, index) => {
                    const rowNo = (safePage - 1) * pageSize + index + 1;
                    return (
                      <tr
                        key={rental.rentalId}
                        className={`hover:bg-rose-50/20 transition-colors ${selectedRowKeys.has(rental.rentalId) ? 'bg-violet-50/40' : ''}`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRowKeys.has(rental.rentalId)}
                            onChange={() => toggleSelectRow(rental.rentalId)}
                            className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                          />
                        </td>
                        <td className="py-3.5 pl-2.5 pr-1 font-mono text-slate-400 text-[11px]">{rowNo}</td>
                        <td className="py-3.5 px-2.5 font-mono text-slate-500 text-[11px] whitespace-nowrap">{rental.rentalId}</td>
                        <td className="py-3.5 px-2.5 font-mono font-bold text-indigo-650 text-[11px] whitespace-nowrap">{rental.sampleCode}</td>
                        <td className="py-3.5 px-2.5">{renderSampleImage(rental.sampleCode, rental.sampleName)}</td>
                        <td className="py-3.5 px-2.5">
                          <div className="font-semibold text-slate-800 max-w-[190px] truncate" title={rental.sampleName}>
                            {rental.sampleName}
                          </div>
                        </td>
                        <td className="py-3.5 px-2.5 font-semibold text-slate-700 whitespace-nowrap">{rental.sampleBrand}</td>
                        <td className="py-3.5 px-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-800">{rental.borrowerName}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">{rental.borrowerGroup}</div>
                        </td>
                        <td className="py-3.5 px-2.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">{rental.rentDate}</td>
                        <td className="py-3.5 px-2.5 font-mono text-[11px] whitespace-nowrap">
                          <span className="text-rose-600 font-bold">{rental.dueDate}</span>
                          {renderDueSubLabel(rental, today)}
                        </td>
                        <td className="py-3.5 px-2.5">
                          <span className="text-[11px] font-bold py-1 px-2.5 rounded-full border bg-rose-50 text-rose-700 border-rose-100">
                            연체
                          </span>
                        </td>
                        <td className="py-3.5 px-2.5">{renderAgreementCell(rental)}</td>
                        <td className="py-3.5 px-2.5">
                          <button
                            type="button"
                            onClick={() => handleMarkLostDamage(rental)}
                            disabled={markingLostId === rental.rentalId}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          >
                            {markingLostId === rental.rentalId ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            분실/훼손 처리
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {viewMode === 'documents' && (
        <RentalDocumentBox
          rentalAgreements={rentalAgreements}
          lossDamageReports={lossDamageReports}
          samples={samples}
          categories={categories}
          onViewAgreement={openAgreementModal}
          onViewLossReport={(report) => setViewLossReport(report)}
        />
      )}

      {/* 샘플 대여 동의서 모달 */}
      {viewAgreement && (() => {
        const agreement = rentalAgreements.find((a) => a.agreementId === viewAgreement.agreementId) || viewAgreement;
        const isPendingSign = agreement.signatureStatus === 'pending';
        const isSigning = signingAgreementId === agreement.agreementId;
        const awaitingApproval = isAwaitingApproval(agreement);
        const approved = isAgreementApproved(agreement);

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
                            <td className="py-2 px-3 text-slate-500">{item.remark || item.sampleName || '-'}</td>
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

                {isPendingSign ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-amber-700">대여자 전자서명 대기 중</p>
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleSignAgreement(agreement)}
                        disabled={!agreeChecked || isSigning}
                        className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isSigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                        전자서명
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl px-4 py-3 text-sm font-bold">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      전자서명 완료 · {agreement.signedBy} · {agreement.signedAt}
                    </div>
                    {awaitingApproval && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl px-4 py-3 text-[11px] font-bold">
                        <Clock className="w-4 h-4 shrink-0" />
                        승인 대기 탭에서 「승인」을 진행해 주세요.
                      </div>
                    )}
                    {approved && (
                      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-xl px-4 py-3 text-sm font-bold">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        대여 승인 완료 · {agreement.approvedBy} · {agreement.approvedAt}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-end gap-2 shrink-0">
                {awaitingApproval && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApproveAgreement(agreement)}
                      disabled={approvingAgreementId === agreement.agreementId}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      {approvingAgreementId === agreement.agreementId ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectAgreement(agreement)}
                      disabled={rejectingAgreementId === agreement.agreementId}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      반려
                    </button>
                  </>
                )}
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

      {lossReportRental && (
        <LossDamageReportModal
          mode="create"
          rental={lossReportRental}
          sample={sampleOf(lossReportRental.sampleCode)}
          onClose={() => setLossReportRental(null)}
          onSubmit={submitLossDamageReport}
          submitting={markingLostId === lossReportRental.rentalId}
        />
      )}

      {viewLossReport && (
        <LossDamageReportModal
          mode="view"
          report={viewLossReport}
          sample={sampleOf(viewLossReport.sampleCode)}
          onClose={() => setViewLossReport(null)}
          onUpdate={updateLossDamageReport}
          saving={savingLossReportId === viewLossReport.reportId}
        />
      )}
    </div>
  );
}

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Check, Clock, AlertCircle, RefreshCw, CheckCircle2,
  Search, Package, FileText, Printer, Download, PenLine, Trash2, ChevronDown, Sparkles,
} from 'lucide-react';
import { Sample, Rental, RentalAgreement, RentalAgreementItem, Member, Category, LossDamageReport, rentalStatusLabel, effectiveRentalStatus } from '../types';
import { DateRangeCalendar } from './DateRangeCalendar';
import LossDamageReportModal, { LossDamageReportSubmitPayload } from './LossDamageReportModal';
import { categoryFilterOptionsForCountries } from '../utils/sampleCategoryFilters';
import BrandFilterDropdown from './BrandFilterDropdown';
import FilterDropdown from './FilterDropdown';
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

type StatusTab = 'all' | 'available' | 'active' | 'overdue' | 'bupyeong' | 'lost';
type PendingSubTab = 'waiting' | 'approved' | 'rejected';

type PendingRow = {
  rowKey: string;
  agreement: RentalAgreement;
  item: RentalAgreementItem;
};

type AllStatusRow = {
  rowKey: string;
  sampleCode: string;
  sampleName: string;
  category: string;
  brand: string;
  borrowerName?: string;
  borrowerGroup?: string;
  primaryDate: string;
  secondaryDate?: string;
  statusLabel: string;
  statusBadgeClass: string;
  rental?: Rental;
};

const RENTAL_STATUS_TAB_CHIPS: { id: Exclude<StatusTab, 'all'>; label: string; active: string; idle: string }[] = [
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

const DEFAULT_RENT_DAYS = 28;

const rentPeriodLabel = (days?: number) => {
  const d = days && days > 0 ? days : DEFAULT_RENT_DAYS;
  if (d % 7 === 0 && d >= 7) return `${d / 7}주`;
  return `${d}일`;
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

const getOverdueWeek = (daysOverdue: number): 1 | 2 | 3 | 4 => {
  if (daysOverdue <= 6) return 1;
  if (daysOverdue <= 13) return 2;
  if (daysOverdue <= 19) return 3;
  return 4;
};

const emailTypeForOverdueWeek = (week: 1 | 2 | 3 | 4): 'gentle' | 'warning' | 'strict' => {
  if (week <= 2) return 'gentle';
  if (week === 3) return 'warning';
  return 'strict';
};

const formatDDay = (daysLeft: number) => {
  if (daysLeft <= 0) return 'D-00';
  if (daysLeft < 10) return `D-0${daysLeft}`;
  return `D-${daysLeft}`;
};

const formatOverdueDDay = (daysOverdue: number) => `D+${daysOverdue}`;

const renderDueSubLabel = (rental: Rental, today: string) => {
  const effective = effectiveRentalStatus(rental, today);
  if (effective === '연체중') {
    const od = overdueDaysOfRental(rental, today);
    return <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">{formatOverdueDDay(od)}</span>;
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
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [pendingSubTab, setPendingSubTab] = useState<PendingSubTab>('waiting');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBorrowers, setSelectedBorrowers] = useState<string[]>([]);
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
  const [bulkApproving, setBulkApproving] = useState(false);
  const [rejectingAgreementId, setRejectingAgreementId] = useState<string | null>(null);
  const [deletingAgreementId, setDeletingAgreementId] = useState<string | null>(null);
  const [markingLostId, setMarkingLostId] = useState<string | null>(null);
  const [sendingEmailRentalId, setSendingEmailRentalId] = useState<string | null>(null);
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
  const isAwaitingAdminDecision = (agreement: RentalAgreement) =>
    agreement.signatureStatus === 'signed' && isPendingApproval(agreement);

  const matchSearch = (query: string, ...values: (string | undefined)[]) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return values.some((v) => (v || '').toLowerCase().includes(q));
  };

  const getRegDateKey = (dateStr?: string) => (dateStr || '').substring(0, 10);
  const regDateFilterLabel =
    !regDateFrom && !regDateTo
      ? '일자: 전체'
      : regDateFrom && regDateTo && regDateFrom === regDateTo
        ? `일자: ${regDateFrom}`
        : `일자: ${regDateFrom || '…'} ~ ${regDateTo || '…'}`;

  const sampleOf = (code: string) => samples.find((s) => s.code === code);

  const sampleCountryOf = (s: Sample | undefined) =>
    s && (s.country === 'CN' || s.category === '중국샘플') ? '중국' : '한국';

  const sampleCategoryOf = (s: Sample | undefined, itemCategory?: string) => {
    const cat = s?.category || itemCategory || '';
    return cat === '중국샘플' ? '유형화샘플' : cat;
  };

  const matchesDetailFilters = (
    sampleCode: string,
    opts?: { brand?: string; itemCategory?: string; dateFallback?: string; borrowerName?: string }
  ) => {
    const s = sampleOf(sampleCode);
    const brand = s?.brand || opts?.brand || '';
    const sampleDate = getRegDateKey(s?.regDate || opts?.dateFallback);
    const category = sampleCategoryOf(s, opts?.itemCategory);

    if (selectedBrands.length > 0 && !selectedBrands.includes(brand)) return false;
    if (selectedCountries.length > 0 && !selectedCountries.includes(sampleCountryOf(s))) return false;
    if (selectedCategories.length > 0 && !selectedCategories.includes(category)) return false;
    if (selectedBorrowers.length > 0 && !selectedBorrowers.includes(opts?.borrowerName || '')) return false;
    if (regDateFrom && (!sampleDate || sampleDate < regDateFrom)) return false;
    if (regDateTo && (!sampleDate || sampleDate > regDateTo)) return false;
    return true;
  };

  const relatedSamples = useMemo(() => samples, [samples]);

  const getAgreementItemProductName = (item: RentalAgreementItem) => {
    const sample = samples.find((s) => s.code === item.sampleCode);
    return sample?.name || item.sampleName || '-';
  };

  const brandOptions = useMemo(
    () => Array.from(new Set(relatedSamples.map((s) => s.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')),
    [relatedSamples]
  );
  const borrowerOptions = useMemo(
    () => Array.from(new Set(rentals.map((r) => r.borrowerName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')),
    [rentals]
  );

  const categoryOptions = useMemo(
    () => categoryFilterOptionsForCountries(selectedCountries),
    [selectedCountries]
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

  const baseWaitingAgreements = filterAgreementsBySearch(rentalAgreements.filter(isPendingApproval));
  const baseApprovedAgreements = filterAgreementsBySearch(rentalAgreements.filter(isAgreementApproved));
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
            borrowerName: agreement.borrowerName,
          })
        )
        .map((item) => ({
          rowKey: `${agreement.agreementId}-${item.sampleCode}`,
          agreement,
          item,
        }))
    );

  const waitingPendingRows = buildPendingRows(baseWaitingAgreements);
  const approvedPendingRows = buildPendingRows(baseApprovedAgreements);
  const rejectedPendingRows = buildPendingRows(baseRejectedAgreements);

  const selectRentalStatusTab = (tab: Exclude<StatusTab, 'all'>) => {
    setStatusTab(tab);
    setSelectedRowKeys(new Set());
    setCurrentPage(1);
  };

  const selectAllRentalStatus = () => {
    setStatusTab('all');
    setSelectedRowKeys(new Set());
    setCurrentPage(1);
  };

  const pendingRows =
    pendingSubTab === 'waiting'
      ? waitingPendingRows
      : pendingSubTab === 'approved'
        ? approvedPendingRows
        : rejectedPendingRows;

  const selectedApprovableCount = useMemo(() => {
    const agreementIds = new Set<string>();
    pendingRows.forEach(({ rowKey, agreement }) => {
      if (selectedRowKeys.has(rowKey) && isAwaitingAdminDecision(agreement)) {
        agreementIds.add(agreement.agreementId);
      }
    });
    return agreementIds.size;
  }, [pendingRows, selectedRowKeys]);

  const tabCounts = {
    available: baseAvailableSamples.length,
    active: baseActiveRentals.length,
    overdue: baseOverdueRentals.length,
    bupyeong: baseBupyeongSamples.length,
    lost: baseLostSamples.length,
  };

  const allRentalStatusCount =
    tabCounts.available + tabCounts.active + tabCounts.overdue + tabCounts.bupyeong + tabCounts.lost;

  const activeRentals = baseActiveRentals.filter((r) =>
    matchesDetailFilters(r.sampleCode, { brand: r.sampleBrand, dateFallback: r.rentDate, borrowerName: r.borrowerName })
  );

  const overdueRentals = baseOverdueRentals.filter((r) =>
    matchesDetailFilters(r.sampleCode, { brand: r.sampleBrand, dateFallback: r.rentDate, borrowerName: r.borrowerName })
  );

  const availableSamples = baseAvailableSamples.filter((s) =>
    matchesDetailFilters(s.code, { brand: s.brand, dateFallback: s.regDate })
  );

  const bupyeongSamples = baseBupyeongSamples.filter((s) =>
    matchesDetailFilters(s.code, { brand: s.brand, dateFallback: s.regDate })
  );

  const lostSamples = baseLostSamples.filter((s) => {
    const last = lastRentalOfSample(s.code);
    return matchesDetailFilters(s.code, {
      brand: s.brand,
      dateFallback: last?.rentDate || s.regDate,
      borrowerName: last?.borrowerName,
    });
  });

  const allStatusRows = useMemo((): AllStatusRow[] => {
    const rows: AllStatusRow[] = [];

    availableSamples.forEach((s) => {
      rows.push({
        rowKey: `available:${s.code}`,
        sampleCode: s.code,
        sampleName: s.name,
        category: s.category || '-',
        brand: s.brand,
        primaryDate: getRegDateKey(s.regDate) || '-',
        statusLabel: '대여가능',
        statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      });
    });

    activeRentals.forEach((r) => {
      const sample = sampleOf(r.sampleCode);
      rows.push({
        rowKey: `active:${r.rentalId}`,
        sampleCode: r.sampleCode,
        sampleName: r.sampleName,
        category: sample?.category || '-',
        brand: r.sampleBrand,
        borrowerName: r.borrowerName,
        borrowerGroup: r.borrowerGroup,
        primaryDate: r.rentDate,
        secondaryDate: r.dueDate,
        statusLabel: rentalStatusLabel(effectiveRentalStatus(r, today)),
        statusBadgeClass: 'bg-blue-50 text-blue-700 border-blue-100',
        rental: r,
      });
    });

    overdueRentals.forEach((r) => {
      const sample = sampleOf(r.sampleCode);
      rows.push({
        rowKey: `overdue:${r.rentalId}`,
        sampleCode: r.sampleCode,
        sampleName: r.sampleName,
        category: sample?.category || '-',
        brand: r.sampleBrand,
        borrowerName: r.borrowerName,
        borrowerGroup: r.borrowerGroup,
        primaryDate: r.rentDate,
        secondaryDate: r.dueDate,
        statusLabel: '연체',
        statusBadgeClass: 'bg-rose-50 text-rose-700 border-rose-100',
        rental: r,
      });
    });

    bupyeongSamples.forEach((s) => {
      rows.push({
        rowKey: `bupyeong:${s.code}`,
        sampleCode: s.code,
        sampleName: s.name,
        category: s.category || '-',
        brand: s.brand,
        primaryDate: getRegDateKey(s.regDate) || '-',
        statusLabel: '부평보관',
        statusBadgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
      });
    });

    lostSamples.forEach((s) => {
      const last = lastRentalOfSample(s.code);
      rows.push({
        rowKey: `lost:${s.code}`,
        sampleCode: s.code,
        sampleName: s.name,
        category: s.category || '-',
        brand: s.brand,
        borrowerName: last?.borrowerName,
        borrowerGroup: last?.borrowerGroup,
        primaryDate: last?.rentDate || getRegDateKey(s.regDate) || '-',
        secondaryDate: last?.returnDate || undefined,
        statusLabel: '분실',
        statusBadgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        rental: last,
      });
    });

    return rows;
  }, [availableSamples, activeRentals, overdueRentals, bupyeongSamples, lostSamples, today]);

  const currentListCount =
    statusTab === 'all'
      ? allStatusRows.length
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
  const pagedAllStatusRows = allStatusRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedPendingRows = pendingRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedActiveRentals = activeRentals.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedOverdueRentals = overdueRentals.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedAvailableSamples = availableSamples.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedBupyeongSamples = bupyeongSamples.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedLostSamples = lostSamples.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBrands, selectedCountries, selectedCategories, selectedBorrowers, regDateFrom, regDateTo, statusTab, pendingSubTab, pageSize]);

  useEffect(() => {
    setSelectedCategories([]);
  }, [selectedCountries]);

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
    setSelectedBrands([]);
    setSelectedCountries([]);
    setSelectedCategories([]);
    setSelectedBorrowers([]);
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

    if (statusTab === 'all') {
      headers = ['상품코드', '상품명', '카테고리', '브랜드', '대여자', '일자', '반납예정', '상태'];
      rows = allStatusRows.map((row) => [
        row.sampleCode,
        row.sampleName,
        row.category,
        row.brand,
        row.borrowerName || '-',
        row.primaryDate,
        row.secondaryDate || '-',
        row.statusLabel,
      ]);
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
        formatOverdueDDay(overdueDaysOfRental(r, today)),
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
    a.download = statusTab === 'all' ? `대여반납_전체_${today}.csv` : `대여반납_${statusTab}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentRowKeys =
    statusTab === 'all'
      ? allStatusRows.map((r) => r.rowKey)
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

  const findAgreement = (rental: Rental): RentalAgreement | undefined => {
    if (rental.agreementId) {
      const byId = rentalAgreements.find((a) => a.agreementId === rental.agreementId);
      if (byId) return byId;
    }

    const matched = rentalAgreements.find(
      (a) =>
        a.approvalStatus === 'approved' &&
        a.borrowerId === rental.borrowerId &&
        a.items.some((item) => item.sampleCode === rental.sampleCode) &&
        a.rentDate === rental.rentDate
    );
    if (matched) return matched;

    const sample = sampleOf(rental.sampleCode);
    const member = members.find((m) => m.memberId === rental.borrowerId);
    const rentDays =
      rental.dueDate && rental.rentDate
        ? Math.max(1, Math.floor((parseDateOnly(rental.dueDate) - parseDateOnly(rental.rentDate)) / MS_DAY))
        : DEFAULT_RENT_DAYS;

    return {
      agreementId: rental.agreementId || `A-${rental.rentalId}`,
      borrowerId: rental.borrowerId,
      borrowerName: rental.borrowerName,
      borrowerEmail: rental.borrowerEmail,
      borrowerAffiliation: member?.affiliation || rental.borrowerGroup,
      brand: rental.sampleBrand,
      purpose: '샘플 대여',
      rentDate: rental.rentDate,
      dueDate: rental.dueDate,
      rentDays,
      quantity: 1,
      items: [
        {
          sampleCode: rental.sampleCode,
          sampleName: rental.sampleName,
          category: sample?.category || '오리지널',
          brand: rental.sampleBrand,
        },
      ],
      signatureStatus: 'signed',
      signedAt: rental.rentDate,
      signedBy: rental.borrowerName,
      approvalStatus: 'approved',
      approvedAt: rental.rentDate,
      approvedBy: '관리자',
      createdAt: rental.rentDate,
    };
  };

  const sendOverdueNotification = async (rental: Rental): Promise<boolean> => {
    const daysOverdue = Math.max(1, overdueDaysOfRental(rental, today));
    const week = getOverdueWeek(daysOverdue);
    const tone = emailTypeForOverdueWeek(week);

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
        subject: draftData.subject || `[반납 촉구 안내] 대여하신 의류 샘플 반납 기한 경과 안내`,
        content:
          draftData.content ||
          `안녕하세요, ${rental.borrowerName}님.\n\n대여 중인 의류 샘플의 빠른 반납 부탁드립니다.`,
      }),
    });
    const sendData = await sendRes.json();

    if (!sendData.success) {
      flashFeedback('error', sendData.message || '메일 발송에 실패했습니다.');
      return false;
    }
    return true;
  };

  const handleSendOverdueEmail = async (rental: Rental) => {
    const label = rental.notifyCount ? '재발송' : '발송';
    if (!confirm(`${rental.borrowerName} 님에게 반납 요청 메일을 ${label}하시겠습니까?`)) return;

    setSendingEmailRentalId(rental.rentalId);
    try {
      const ok = await sendOverdueNotification(rental);
      if (ok) {
        flashFeedback('ok', `${rental.borrowerName} 님에게 반납 요청 메일이 발송되었습니다.`);
        await onRefreshData?.();
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '반납 요청 메일 전송 중 오류가 발생했습니다.');
    } finally {
      setSendingEmailRentalId(null);
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
        setPendingSubTab('approved');
        setSelectedRowKeys(new Set());
        setCurrentPage(1);
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

  const handleBulkApprove = async () => {
    const agreementMap = new Map<string, RentalAgreement>();
    pendingRows.forEach(({ rowKey, agreement }) => {
      if (selectedRowKeys.has(rowKey) && isAwaitingAdminDecision(agreement)) {
        agreementMap.set(agreement.agreementId, agreement);
      }
    });
    const targets = [...agreementMap.values()];
    if (targets.length === 0) {
      flashFeedback('error', '승인할 항목을 선택해 주세요. (서명 완료된 건만 승인 가능)');
      return;
    }
    if (!confirm(`선택한 ${targets.length}건의 대여 신청을 일괄 승인하시겠습니까?`)) return;

    setBulkApproving(true);
    let ok = 0;
    const errors: string[] = [];
    for (const agreement of targets) {
      try {
        const res = await fetch(`/api/rental-agreements/${agreement.agreementId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvedBy: '관리자' }),
        });
        const data = await res.json();
        if (data.success) ok += 1;
        else errors.push(data.message || `${agreement.agreementId} 승인 실패`);
      } catch (err) {
        console.error(err);
        errors.push(`${agreement.agreementId} 처리 중 오류`);
      }
    }
    setBulkApproving(false);

    if (ok > 0) {
      flashFeedback(
        'ok',
        errors.length > 0
          ? `${ok}건 승인 완료 · ${errors.length}건 실패`
          : `${ok}건 일괄 승인이 완료되었습니다.`,
      );
      setPendingSubTab('approved');
      setSelectedRowKeys(new Set());
      setCurrentPage(1);
      onRefreshData?.();
    } else {
      flashFeedback('error', errors[0] || '일괄 승인에 실패했습니다.');
    }
  };

  const handleRejectAgreement = async (agreement: RentalAgreement) => {
    const reasonInput = window.prompt(`${agreement.borrowerName} 님 대여 신청(${agreement.agreementId}) 반려 사유를 입력해 주세요.`);
    if (reasonInput === null) return;
    const rejectedReason = reasonInput.trim();
    if (!rejectedReason) {
      flashFeedback('error', '반려 사유를 입력해 주세요.');
      return;
    }
    if (!confirm(`입력한 사유로 반려하시겠습니까?\n\n${rejectedReason}`)) return;

    setRejectingAgreementId(agreement.agreementId);
    try {
      const res = await fetch(`/api/rental-agreements/${agreement.agreementId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectedBy: '관리자', rejectedReason }),
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

  const handleDeleteRejectedAgreement = async (agreement: RentalAgreement) => {
    if (!confirm(`${agreement.borrowerName} 님 반려 신청(${agreement.agreementId})을 삭제하시겠습니까?`)) return;

    setDeletingAgreementId(agreement.agreementId);
    try {
      const res = await fetch(`/api/rental-agreements/${agreement.agreementId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        flashFeedback('ok', data.message || '반려 신청이 삭제되었습니다.');
        setSelectedRowKeys(new Set());
        onRefreshData?.();
      } else {
        flashFeedback('error', data.message || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      flashFeedback('error', '삭제 처리 중 오류가 발생했습니다.');
    } finally {
      setDeletingAgreementId(null);
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
    return (
      <button
        type="button"
        onClick={() => openAgreementModal(agreement!)}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-indigo-600 cursor-pointer"
      >
        <FileText className="w-3.5 h-3.5" />
        보기
      </button>
    );
  };

  const renderOverdueActions = (rental: Rental) => {
    const isSending = sendingEmailRentalId === rental.rentalId;
    const hasNotified = (rental.notifyCount || 0) > 0;

    return (
      <button
        type="button"
        onClick={() => void handleSendOverdueEmail(rental)}
        disabled={isSending}
        className={`py-1.5 px-3 rounded-lg shadow-sm font-bold text-[11px] flex items-center gap-1 transition-colors active:scale-[0.98] cursor-pointer whitespace-nowrap disabled:opacity-50 ${
          hasNotified
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
            : 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100'
        }`}
        id={hasNotified ? `rental-overdue-resend-${rental.rentalId}` : `rental-overdue-send-${rental.rentalId}`}
      >
        {isSending ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            전송 중...
          </>
        ) : hasNotified ? (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            메일 재발송
          </>
        ) : (
          <>
            <AlertCircle className="w-3.5 h-3.5" />
            메일 발송
          </>
        )}
      </button>
    );
  };

  const renderPendingActions = (agreement: RentalAgreement) => {
    if (pendingSubTab === 'approved') {
      return (
        <span className="text-[11px] font-bold text-violet-700 whitespace-nowrap">승인 완료</span>
      );
    }
    if (pendingSubTab === 'rejected') {
      const isDeleting = deletingAgreementId === agreement.agreementId;
      return (
        <button
          type="button"
          onClick={() => handleDeleteRejectedAgreement(agreement)}
          disabled={isDeleting}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-extrabold disabled:opacity-50 cursor-pointer"
        >
          {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          삭제
        </button>
      );
    }

    if (agreement.signatureStatus !== 'signed') {
      return (
        <span className="text-[11px] font-bold text-amber-700 whitespace-nowrap">대여자 서명 대기</span>
      );
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
    pendingSubTab === 'waiting'
      ? '승인·반려 대기 중인 대여 신청이 없습니다.'
      : pendingSubTab === 'approved'
        ? '승인 완료된 대여 신청이 없습니다.'
        : '반려된 대여 신청이 없습니다.';

  const pendingTableColSpan = pendingSubTab === 'approved' ? 14 : 13;

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

  const renderPagination = () => {
    if (currentListCount === 0) return null;
    return (
      <div
        className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1"
        id="rental-status-pagination"
      >
        <span className="text-[11px] text-slate-400 font-medium font-mono">
          {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, currentListCount)} / 총 {currentListCount}개
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={safePage === 1}
            className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            « 처음
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            이전
          </button>
          <span className="px-2 text-xs font-bold text-slate-700 font-mono">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            다음
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage === totalPages}
            className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            끝 »
          </button>
        </div>
      </div>
    );
  };

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

              <BrandFilterDropdown
                value={selectedBrands}
                brands={brandOptions}
                onChange={setSelectedBrands}
              />

              <FilterDropdown
                label="국가"
                value={selectedCountries}
                options={['한국', '중국']}
                onChange={setSelectedCountries}
                popoverWidth={200}
              />

              <FilterDropdown
                label="카테고리"
                value={selectedCategories}
                options={categoryOptions}
                onChange={setSelectedCategories}
                popoverWidth={240}
              />

              <FilterDropdown
                label="대여자"
                value={selectedBorrowers}
                options={borrowerOptions}
                onChange={setSelectedBorrowers}
                popoverWidth={240}
              />
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

          <div className="flex flex-wrap gap-2 items-center pt-0.5 min-h-[38px]" id="rental-status-chips">
            <div className="flex items-center gap-1.5 shrink-0" id="rental-rental-status-chips">
              <button
                type="button"
                onClick={selectAllRentalStatus}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  statusTab === 'all'
                    ? 'bg-black text-white'
                    : 'bg-black/85 text-white hover:bg-black'
                }`}
                id="rental-status-tab-all"
              >
                전체 {allRentalStatusCount}
              </button>
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

      <div className="space-y-4" id="rental-status-list-wrap">
      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden" id="rentals-status-root">
        {/* 전체 — 모든 상태 통합 목록 */}
        {statusTab === 'all' && (
          <div className="overflow-x-auto" id="rental-all-table-wrap">
            <table className="w-full text-left border-collapse" id="rental-all-table">
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
                  <th className="py-3 px-2.5 whitespace-nowrap">일자</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">반납예정</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상태</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">동의서</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {allStatusRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-20 text-center text-slate-400">
                      표시할 샘플이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pagedAllStatusRows.map((row, index) => {
                    const rowNo = (safePage - 1) * pageSize + index + 1;
                    return (
                      <tr
                        key={row.rowKey}
                        className={`hover:bg-slate-50/70 transition-colors ${selectedRowKeys.has(row.rowKey) ? 'bg-violet-50/40' : ''}`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRowKeys.has(row.rowKey)}
                            onChange={() => toggleSelectRow(row.rowKey)}
                            className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                          />
                        </td>
                        <td className="py-3.5 pl-2.5 pr-1 font-mono text-slate-400 text-[11px]">{rowNo}</td>
                        <td className="py-3.5 px-2.5 font-mono font-bold text-indigo-650 text-[11px] whitespace-nowrap">{row.sampleCode}</td>
                        <td className="py-3.5 px-2.5">{renderSampleImage(row.sampleCode, row.sampleName)}</td>
                        <td className="py-3.5 px-2.5">
                          <div className="font-semibold text-slate-800 max-w-[190px] truncate" title={row.sampleName}>
                            {row.sampleName}
                          </div>
                        </td>
                        <td className="py-3.5 px-2.5">
                          <span className="text-xs text-slate-600 bg-slate-100 py-0.5 px-2 rounded-md font-medium">
                            {row.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-2.5 font-semibold text-slate-700 whitespace-nowrap">{row.brand}</td>
                        <td className="py-3.5 px-2.5 whitespace-nowrap">
                          {row.borrowerName ? (
                            <>
                              <div className="font-bold text-slate-800">{row.borrowerName}</div>
                              {row.borrowerGroup && (
                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{row.borrowerGroup}</div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">{row.primaryDate}</td>
                        <td className="py-3.5 px-2.5 font-mono text-[11px] whitespace-nowrap">
                          {row.secondaryDate ? (
                            <>
                              <span className={row.statusLabel === '연체' ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                                {row.secondaryDate}
                              </span>
                              {row.rental && renderDueSubLabel(row.rental, today)}
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2.5">
                          <span className={`text-[11px] font-bold py-1 px-2.5 rounded-full border ${row.statusBadgeClass}`}>
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-2.5">
                          {row.rental ? renderAgreementCell(row.rental) : <span className="text-slate-300 text-[11px]">-</span>}
                        </td>
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
                        <td className="py-3.5 px-2.5">{renderOverdueActions(rental)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {renderPagination()}
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
        const awaitingApproval = isAwaitingAdminDecision(agreement);
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
                          <th className="py-2 px-3">상품명</th>
                          <th className="py-2 px-3">비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {agreement.items.map((item, idx) => (
                          <tr key={item.sampleCode}>
                            <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{item.category}</td>
                            <td className="py-2 px-3 font-mono text-indigo-600">{item.sampleCode}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{getAgreementItemProductName(item)}</td>
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

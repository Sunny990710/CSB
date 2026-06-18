import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import { FileText, Search, X, CheckCircle2, Download, ChevronDown } from 'lucide-react';
import { Sample, Category, RentalAgreement, RentalAgreementItem, LossDamageReport } from '../types';
import { DateRangeCalendar } from './DateRangeCalendar';

type DocTab = 'agreements' | 'loss-reports' | 'compensation';

const DOC_TAB_CHIPS: { id: DocTab; label: string; active: string; idle: string }[] = [
  { id: 'agreements', label: '대여 동의서', active: 'bg-violet-600 text-white', idle: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { id: 'loss-reports', label: '훼손·분실 사유서', active: 'bg-rose-600 text-white', idle: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
  { id: 'compensation', label: '변상금 기준', active: 'bg-amber-600 text-white', idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
];

const COMPENSATION_ROWS: { item: string; ep: number; original: number; ownKr: number; ownCn: number }[] = [
  { item: '아우터', ep: 200, original: 100, ownKr: 30, ownCn: 50 },
  { item: '스웨터', ep: 100, original: 50, ownKr: 20, ownCn: 30 },
  { item: '셔츠', ep: 50, original: 30, ownKr: 10, ownCn: 20 },
  { item: '티셔츠', ep: 50, original: 30, ownKr: 10, ownCn: 20 },
  { item: '바지', ep: 50, original: 30, ownKr: 10, ownCn: 20 },
  { item: '소품', ep: 30, original: 10, ownKr: 10, ownCn: 20 },
];

const TABLE_HEAD =
  'bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans text-left';
const TABLE_BODY = 'divide-y divide-slate-100 text-xs text-slate-700 font-medium';

const CATEGORY_ORDER = ['오리지널', '유형화샘플', 'EP샘플', '자사샘플', '중국샘플'];

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

const sanitizeFileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_');

const resolveAgreementItemProductName = (item: RentalAgreementItem, samples: Sample[]) => {
  const sample = samples.find((s) => s.code === item.sampleCode);
  return sample?.name || item.sampleName || '-';
};

const resolveLossReportProductName = (report: LossDamageReport, samples: Sample[]) => {
  const sample = samples.find((s) => s.code === report.sampleCode);
  return sample?.name || report.sampleName || '-';
};

const buildAgreementText = (agreement: RentalAgreement, samples: Sample[]) => {
  const lines = [
    '샘플 대여 동의서',
    '='.repeat(40),
    '',
    `동의서번호: ${agreement.agreementId}`,
    `브랜드: ${agreement.brand}`,
    `대여 목적: ${agreement.purpose}`,
    `대여자: ${agreement.borrowerName}`,
    `이메일: ${agreement.borrowerEmail}`,
    `소속: ${agreement.borrowerAffiliation}`,
    `대여일: ${agreement.rentDate}`,
    `반납 예정일: ${agreement.dueDate} · ${rentPeriodLabel(agreement.rentDays)}`,
    `총 수량: ${agreement.quantity} PCS`,
    '',
    '[샘플 대여 리스트]',
    'No\t아이템\tSample NO.\t상품명\t비고',
    ...agreement.items.map(
      (item, idx) =>
        `${idx + 1}\t${item.category}\t${item.sampleCode}\t${resolveAgreementItemProductName(item, samples)}\t${item.remark || '-'}`,
    ),
    '',
    '[동의 사항]',
    ...AGREEMENT_TERMS.map((term, idx) => `${idx + 1}. ${term}`),
    '',
    agreement.signatureStatus === 'signed'
      ? `전자서명 완료 · ${agreement.signedBy || agreement.borrowerName} · ${agreement.signedAt || '-'}`
      : '전자서명 대기',
  ];
  return lines.join('\n');
};

const buildLossReportText = (report: LossDamageReport, samples: Sample[]) => {
  const formatSlashDate = (dateStr?: string) => (dateStr || '').replace(/-/g, '/');
  const productName = resolveLossReportProductName(report, samples);
  const lines = [
    '패션아카이브 샘플 훼손 / 분실 사유서',
    '='.repeat(40),
    '',
    `사유서번호: ${report.reportId}`,
    `대여번호: ${report.rentalId}`,
    `구분: ${report.reportType}`,
    '',
    `법인명(업체명): ${report.companyName}`,
    `브랜드: ${report.brand}`,
    `부서: ${report.department}`,
    `사번: ${report.employeeId}`,
    `이름: ${report.employeeName}`,
    `샘플명: ${productName}`,
    `샘플코드: ${report.sampleCode}`,
    `대여일자: ${formatSlashDate(report.rentalDate)}`,
    `처리일: ${formatSlashDate(report.processedDate)}`,
    '',
    '[훼손/분실 사유]',
    report.reason || '-',
    '',
    `변상 동의: ${report.compensationAgreed ? '동의함' : '미동의'}`,
    '',
    '[결재]',
    `샘플 대여자: ${report.employeeName}`,
    `1차 평가자(실장/브랜드장): ${report.primaryEvaluator || '—'}`,
    `패션아카이브: ${report.fashionArchiveReviewer || '—'}`,
    `패션연구소: ${report.fashionInstituteReviewer || '—'}`,
    '',
    `서명: ${report.signedBy} · ${report.signedAt}`,
  ];
  return lines.join('\n');
};

interface RentalDocumentBoxProps {
  rentalAgreements: RentalAgreement[];
  lossDamageReports: LossDamageReport[];
  samples: Sample[];
  categories?: Category[];
  onViewAgreement: (agreement: RentalAgreement) => void;
  onViewLossReport: (report: LossDamageReport) => void;
}

export default function RentalDocumentBox({
  rentalAgreements,
  lossDamageReports,
  samples,
  categories = [],
  onViewAgreement,
  onViewLossReport,
}: RentalDocumentBoxProps) {
  const [docTab, setDocTab] = useState<DocTab>('agreements');
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().substring(0, 10);

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

  const relatedSamples = useMemo(() => {
    const codes = new Set<string>();
    rentalAgreements.forEach((a) => a.items.forEach((i) => codes.add(i.sampleCode)));
    lossDamageReports.forEach((r) => codes.add(r.sampleCode));
    return samples.filter((s) => codes.has(s.code));
  }, [rentalAgreements, lossDamageReports, samples]);

  const uniqueBrands = useMemo(
    () => ['전체', ...Array.from(new Set(relatedSamples.map((s) => s.brand).filter(Boolean))).sort()],
    [relatedSamples]
  );
  const uniqueRegisterers = useMemo(
    () => ['전체', ...Array.from(new Set(relatedSamples.map((s) => s.registerer).filter(Boolean))).sort()],
    [relatedSamples]
  );

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

  const baseAgreements = useMemo(
    () =>
      rentalAgreements
        .filter((a) => {
          const first = a.items[0];
          return matchSearch(
            searchQuery,
            a.agreementId,
            a.borrowerName,
            a.brand,
            a.borrowerAffiliation,
            first?.sampleCode,
            first?.sampleName
          );
        })
        .filter((a) => {
          const first = a.items[0];
          if (first) {
            return matchesDetailFilters(first.sampleCode, {
              brand: a.brand,
              itemCategory: first.category,
              dateFallback: a.rentDate || a.createdAt,
            });
          }
          if (selectedBrand !== '전체' && a.brand !== selectedBrand) return false;
          const docDate = getRegDateKey(a.rentDate || a.createdAt);
          if (regDateFrom && docDate < regDateFrom) return false;
          if (regDateTo && docDate > regDateTo) return false;
          return selectedCountry === '전체' && selectedCategory === '전체' && selectedRegisterer === '전체';
        })
        .sort((a, b) => (b.createdAt || b.rentDate).localeCompare(a.createdAt || a.rentDate)),
    [
      rentalAgreements,
      searchQuery,
      selectedBrand,
      selectedCountry,
      selectedCategory,
      selectedRegisterer,
      regDateFrom,
      regDateTo,
      samples,
    ]
  );

  const baseLossReports = useMemo(
    () =>
      lossDamageReports
        .filter((r) =>
          matchSearch(
            searchQuery,
            r.reportId,
            r.sampleCode,
            r.sampleName,
            resolveLossReportProductName(r, samples),
            r.employeeName,
            r.brand,
            r.department,
            r.rentalId
          )
        )
        .filter((r) =>
          matchesDetailFilters(r.sampleCode, {
            brand: r.brand,
            dateFallback: r.processedDate || r.createdAt,
          })
        )
        .sort((a, b) => (b.createdAt || b.processedDate).localeCompare(a.createdAt || a.processedDate)),
    [
      lossDamageReports,
      searchQuery,
      selectedBrand,
      selectedCountry,
      selectedCategory,
      selectedRegisterer,
      regDateFrom,
      regDateTo,
      samples,
    ]
  );

  const docCounts = {
    agreements: rentalAgreements.length,
    'loss-reports': lossDamageReports.length,
  };

  const currentListCount =
    docTab === 'agreements' ? baseAgreements.length : docTab === 'loss-reports' ? baseLossReports.length : 0;

  const totalPages = Math.max(1, Math.ceil(currentListCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedAgreements = baseAgreements.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedLossReports = baseLossReports.slice((safePage - 1) * pageSize, safePage * pageSize);

  const currentRowKeys =
    docTab === 'agreements'
      ? baseAgreements.map((a) => a.agreementId)
      : docTab === 'loss-reports'
        ? baseLossReports.map((r) => r.reportId)
        : [];

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

  useEffect(() => {
    setCurrentPage(1);
    setSelectedRowKeys(new Set());
  }, [searchQuery, selectedBrand, selectedCountry, selectedCategory, selectedRegisterer, regDateFrom, regDateTo, docTab, pageSize]);

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
    setCurrentPage(1);
    setSelectedRowKeys(new Set());
  };

  const handleBulkDownload = async () => {
    if (docTab === 'compensation') return;

    const list = docTab === 'agreements' ? baseAgreements : baseLossReports;
    if (list.length === 0) {
      alert('다운로드할 문서가 없습니다.');
      return;
    }

    const zip = new JSZip();
    const folderName = docTab === 'agreements' ? '대여동의서' : '훼손분실사유서';
    const folder = zip.folder(folderName);

    if (docTab === 'agreements') {
      baseAgreements.forEach((agreement) => {
        const fileName = sanitizeFileName(`동의서_${agreement.agreementId}_${agreement.borrowerName}.txt`);
        folder?.file(fileName, buildAgreementText(agreement, samples));
      });
    } else {
      baseLossReports.forEach((report) => {
        const fileName = sanitizeFileName(`사유서_${report.reportId}_${report.sampleCode}.txt`);
        folder?.file(fileName, buildLossReportText(report, samples));
      });
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `문서함_${folderName}_${today}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" id="rental-document-box">
      <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-3xs" id="rental-doc-filter-panel">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="문서 검색 (동의서번호, 대여자, 브랜드, 샘플코드)"
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
          <div className="flex flex-col lg:flex-row lg:justify-between items-stretch lg:items-center gap-x-3 gap-y-2.5" id="rental-doc-filter-chips-row">
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
              {docTab !== 'compensation' && (
                <button
                  type="button"
                  onClick={() => void handleBulkDownload()}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shadow-3xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  일괄 다운로드
                </button>
              )}
              {docTab !== 'compensation' && (
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
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center pt-2.5 border-t border-slate-100 min-h-[38px]" id="rental-doc-subtabs-row">
            {DOC_TAB_CHIPS.map((tab) => {
              const count =
                tab.id === 'agreements'
                  ? docCounts.agreements
                  : tab.id === 'loss-reports'
                    ? docCounts['loss-reports']
                    : null;
              const isActive = docTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setDocTab(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    isActive ? tab.active : tab.idle
                  }`}
                  id={`rental-doc-tab-${tab.id}`}
                >
                  {tab.label}
                  {count != null ? ` ${count}` : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden" id="rental-doc-content">
        {docTab === 'agreements' && (
          <div className="overflow-x-auto" id="rental-doc-agreements-wrap">
            <table className="w-full text-left border-collapse" id="rental-doc-agreements-table">
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
                  <th className="py-3 px-2.5 whitespace-nowrap">동의서번호</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여자</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">브랜드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">샘플코드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품명</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여일</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">수량</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">서명</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">동의서</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {baseAgreements.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-20 text-center text-slate-400">
                      등록된 대여 동의서가 없습니다.
                    </td>
                  </tr>
                ) : (
                  pagedAgreements.map((agreement, index) => {
                    const rowNo = (safePage - 1) * pageSize + index + 1;
                    const firstItem = agreement.items[0];
                    const sampleCodeDisplay =
                      agreement.items.length === 0
                        ? '-'
                        : agreement.items.length === 1
                          ? firstItem.sampleCode
                          : `${firstItem.sampleCode} 외 ${agreement.items.length - 1}건`;
                    const productNameDisplay =
                      agreement.items.length === 0
                        ? '-'
                        : agreement.items
                            .map((item) => resolveAgreementItemProductName(item, samples))
                            .join(', ');
                    return (
                    <tr
                      key={agreement.agreementId}
                      className={`hover:bg-slate-50/70 transition-colors ${selectedRowKeys.has(agreement.agreementId) ? 'bg-violet-50/40' : ''}`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRowKeys.has(agreement.agreementId)}
                          onChange={() => toggleSelectRow(agreement.agreementId)}
                          className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                        />
                      </td>
                      <td className="py-3.5 pl-2.5 pr-1 font-mono text-slate-400 text-[11px]">{rowNo}</td>
                      <td className="py-3.5 px-2.5 font-mono font-bold text-slate-700 text-[11px] whitespace-nowrap">
                        {agreement.agreementId}
                      </td>
                      <td className="py-3.5 px-2.5 font-bold text-slate-800 whitespace-nowrap">{agreement.borrowerName}</td>
                      <td className="py-3.5 px-2.5 font-bold text-indigo-650 whitespace-nowrap">{agreement.brand}</td>
                      <td className="py-3.5 px-2.5 font-mono font-bold text-indigo-650 text-[11px] whitespace-nowrap" title={sampleCodeDisplay}>
                        {sampleCodeDisplay}
                      </td>
                      <td className="py-3.5 px-2.5">
                        <div className="font-semibold text-slate-800 max-w-[200px] truncate" title={productNameDisplay}>
                          {productNameDisplay}
                        </div>
                      </td>
                      <td className="py-3.5 px-2.5 font-mono text-slate-500 text-[11px] whitespace-nowrap">{agreement.rentDate}</td>
                      <td className="py-3.5 px-2.5 font-mono text-slate-600 whitespace-nowrap">{agreement.quantity} PCS</td>
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
                      <td className="py-3.5 px-2.5">
                        <button
                          type="button"
                          onClick={() => onViewAgreement(agreement)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          보기
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

        {docTab === 'loss-reports' && (
          <div className="overflow-x-auto" id="rental-doc-loss-wrap">
            <table className="w-full text-left border-collapse" id="rental-doc-loss-table">
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
                  <th className="py-3 px-2.5 whitespace-nowrap">사유서번호</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">대여자</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">부서</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">샘플코드</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">상품명</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">구분</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">처리일</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">사유서</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {baseLossReports.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-20 text-center text-slate-400">
                      등록된 훼손·분실 사유서가 없습니다.
                    </td>
                  </tr>
                ) : (
                  pagedLossReports.map((report, index) => {
                    const rowNo = (safePage - 1) * pageSize + index + 1;
                    const productName = resolveLossReportProductName(report, samples);
                    return (
                    <tr
                      key={report.reportId}
                      className={`hover:bg-slate-50/70 transition-colors ${selectedRowKeys.has(report.reportId) ? 'bg-violet-50/40' : ''}`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRowKeys.has(report.reportId)}
                          onChange={() => toggleSelectRow(report.reportId)}
                          className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                        />
                      </td>
                      <td className="py-3.5 pl-2.5 pr-1 font-mono text-slate-400 text-[11px]">{rowNo}</td>
                      <td className="py-3.5 px-2.5 font-mono font-bold text-slate-700 text-[11px] whitespace-nowrap">
                        {report.reportId}
                      </td>
                      <td className="py-3.5 px-2.5 font-bold text-slate-800 whitespace-nowrap">{report.employeeName}</td>
                      <td className="py-3.5 px-2.5 text-slate-700 whitespace-nowrap">{report.department}</td>
                      <td className="py-3.5 px-2.5 font-mono font-bold text-indigo-650 text-[11px] whitespace-nowrap">
                        {report.sampleCode}
                      </td>
                      <td className="py-3.5 px-2.5">
                        <div className="font-semibold text-slate-800 max-w-[200px] truncate" title={productName}>
                          {productName}
                        </div>
                      </td>
                      <td className="py-3.5 px-2.5">
                        <span className="text-[11px] font-bold py-1 px-2.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200">
                          {report.reportType}
                        </span>
                      </td>
                      <td className="py-3.5 px-2.5 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {report.processedDate}
                      </td>
                      <td className="py-3.5 px-2.5">
                        <button
                          type="button"
                          onClick={() => onViewLossReport(report)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          보기
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

        {docTab === 'compensation' && (
          <div className="p-5 space-y-4" id="rental-doc-compensation-wrap">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800">변상금 기준표</h4>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                (단위: 만원 · 훼손·분실 사유 자동 산출 기준 데이터)
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                    <th className="py-2.5 px-3 border-r border-slate-200">아이템</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">EP 샘플<br /><span className="font-medium text-slate-400">(골드/실버라벨)</span></th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">오리지널 샘플</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">자사 샘플<br /><span className="font-medium text-slate-400">(한국)</span></th>
                    <th className="py-2.5 px-3 text-center">자사 샘플<br /><span className="font-medium text-slate-400">(중국)</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {COMPENSATION_ROWS.map((row) => (
                    <tr key={row.item} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-100">{row.item}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 border-r border-slate-100">{row.ep}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 border-r border-slate-100">{row.original}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 border-r border-slate-100">{row.ownKr}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700">{row.ownCn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
              ※ 훼손·분실 변상금 동일. 변상금은 이랜드복지재단 기부 처리됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

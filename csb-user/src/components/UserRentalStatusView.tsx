import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Package, AlertTriangle, Clock, CheckCircle2, Image as ImageIcon, RefreshCw } from 'lucide-react';
import PageHeader from './PageHeader';
import SearchFilterBar from './SearchFilterBar';
import { RentalStatusBadge } from './StatusChipBar';
import { Rental, Sample, effectiveRentalStatus, todayDateStr } from '@/types';
import { DUE_SOON_DAYS } from '../utils/constants';
import {
  DEFAULT_FILTERS,
  filterRentalsBySampleFilters,
  statusCounts,
  uniqueValues,
} from '../utils/filters';

interface UserRentalStatusViewProps {
  rentals: Rental[];
  samples: Sample[];
  borrowerId: string;
}

type SummaryFilter = 'active' | 'overdue' | 'dueSoon' | 'returned';

const TABLE_MIN_W = 'min-w-[1180px]';
const TABLE_HEAD =
  'bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans text-left';

function daysUntilDue(rental: Rental): number {
  if (!rental.dueDate) return 999;
  const today = todayDateStr();
  const due = new Date(rental.dueDate);
  const ref = new Date(today);
  due.setHours(0, 0, 0, 0);
  ref.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - ref.getTime()) / 86400000);
}

function sortByDueDate(items: Rental[]): Rental[] {
  return [...items].sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));
}

function sortByReturnDate(items: Rental[]): Rental[] {
  return [...items].sort((a, b) => {
    const aDate = a.returnDate || a.dueDate || '';
    const bDate = b.returnDate || b.dueDate || '';
    return aDate > bDate ? -1 : 1;
  });
}

const SECTION_TITLES: Record<SummaryFilter, string> = {
  active: '대여 중',
  overdue: '연체',
  dueSoon: '반납 임박',
  returned: '반납 완료',
};

function dropdownOptions(values: string[]) {
  return values.filter((v) => v !== '전체');
}

export default function UserRentalStatusView({ rentals, samples, borrowerId }: UserRentalStatusViewProps) {
  const [selectedFilter, setSelectedFilter] = useState<SummaryFilter>('active');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [imageFlips, setImageFlips] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const sampleByCode = useMemo(() => {
    const map = new Map<string, Sample>();
    samples.forEach((s) => map.set(s.code, s));
    return map;
  }, [samples]);

  useEffect(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setSelectedIds(new Set());
    setCurrentPage(1);
  }, [selectedFilter]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [filters, pageSize]);

  const mine = useMemo(
    () => rentals.filter((r) => r.borrowerId === borrowerId),
    [rentals, borrowerId]
  );

  const active = useMemo(
    () => mine.filter((r) => effectiveRentalStatus(r) === '대여중'),
    [mine]
  );
  const overdue = useMemo(
    () => mine.filter((r) => effectiveRentalStatus(r) === '연체중'),
    [mine]
  );
  const dueSoon = useMemo(
    () =>
      active.filter((r) => {
        const d = daysUntilDue(r);
        return d >= 0 && d <= DUE_SOON_DAYS;
      }),
    [active]
  );
  const returned = useMemo(() => mine.filter((r) => r.status === '반납완료'), [mine]);

  const dueSoonLabel =
    dueSoon.length > 0 ? `반납 임박 (D-${daysUntilDue(dueSoon[0])})` : '반납 임박';

  const cards: {
    id: SummaryFilter;
    label: string;
    count: number;
    suffix: string;
    icon: typeof Package;
    iconBg: string;
    iconColor: string;
    items: Rental[];
  }[] = [
    {
      id: 'active',
      label: '대여 중',
      count: active.length,
      suffix: '건',
      icon: Package,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      items: sortByDueDate(active),
    },
    {
      id: 'overdue',
      label: '연체',
      count: overdue.length,
      suffix: '건',
      icon: AlertTriangle,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      items: sortByDueDate(overdue),
    },
    {
      id: 'dueSoon',
      label: dueSoonLabel,
      count: dueSoon.length,
      suffix: '건',
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      items: sortByDueDate(dueSoon),
    },
    {
      id: 'returned',
      label: '반납 완료',
      count: returned.length,
      suffix: '건',
      icon: CheckCircle2,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      items: sortByReturnDate(returned),
    },
  ];

  const selectedCard = cards.find((c) => c.id === selectedFilter) ?? cards[0];

  const tabSamples = useMemo(
    () =>
      selectedCard.items
        .map((r) => sampleByCode.get(r.sampleCode))
        .filter((s): s is Sample => !!s),
    [selectedCard.items, sampleByCode]
  );

  const displayedItems = useMemo(
    () => filterRentalsBySampleFilters(selectedCard.items, sampleByCode, filters),
    [selectedCard.items, sampleByCode, filters]
  );

  const totalPages = Math.max(1, Math.ceil(displayedItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedItems = displayedItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasItems = selectedCard.items.length > 0;
  const allSelected =
    pagedItems.length > 0 && pagedItems.every((r) => selectedIds.has(r.rentalId));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedItems.map((r) => r.rentalId)));
    }
  };

  const toggleSelect = (rentalId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rentalId)) next.delete(rentalId);
      else next.add(rentalId);
      return next;
    });
  };

  const dateColumnLabel = selectedFilter === 'returned' ? '반납일' : '반납예정';

  return (
    <div className="space-y-6">
      <PageHeader
        title="대여 현황"
        description="내 대여 신청 내역과 확정된 대여 건을 확인합니다."
      />

      <div>
        <h2 className="text-sm font-black text-slate-700 flex items-center gap-2 mb-4">
          <LayoutGrid className="w-4 h-4 text-slate-400" />
          내 대여 요약
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            const isSelected = selectedFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedFilter(c.id)}
                className={`bg-white border rounded-2xl p-4 flex items-center gap-4 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-violet-400 ring-2 ring-violet-100 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg}`}>
                  <Icon className={`w-5 h-5 ${c.iconColor}`} />
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">
                    {c.count}
                    <span className="text-sm font-bold text-slate-500 ml-0.5">{c.suffix}</span>
                  </p>
                  <p className="text-xs font-bold text-slate-500">{c.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-black text-slate-800 px-1">{SECTION_TITLES[selectedFilter]} 목록</h3>

        <SearchFilterBar
          filters={filters}
          onChange={setFilters}
          brands={dropdownOptions(uniqueValues(tabSamples, 'brand'))}
          categories={dropdownOptions(uniqueValues(tabSamples, 'category'))}
          genders={dropdownOptions(uniqueValues(tabSamples, 'gender'))}
          registerers={dropdownOptions(uniqueValues(tabSamples, 'registerer'))}
          resultCount={displayedItems.length}
          statusCounts={statusCounts(tabSamples)}
          viewMode="list"
          onViewModeChange={() => {}}
          showStatusChips={false}
          showViewModeToggle={false}
          showCategoryNavigation={false}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          searchPlaceholder="검색 (상품코드, 상품명, 브랜드, 카테고리, 등록자)"
          countLabel="대여 수"
        />

        {!hasItems ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center text-sm text-slate-400">
            {SECTION_TITLES[selectedFilter]} 항목이 없습니다.
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center text-sm text-slate-400">
            검색·필터 조건에 맞는 항목이 없습니다.
          </div>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className={`w-full table-fixed text-left border-collapse ${TABLE_MIN_W}`}>
                  <colgroup>
                    <col className="w-[40px]" />
                    <col className="w-[44px]" />
                    <col className="w-[118px]" />
                    <col className="w-[76px]" />
                    <col className="w-[220px]" />
                    <col className="w-[104px]" />
                    <col className="w-[96px]" />
                    <col className="w-[88px]" />
                    <col className="w-[72px]" />
                    <col className="w-[120px]" />
                    <col className="w-[120px]" />
                    <col className="w-[88px]" />
                  </colgroup>
                  <thead>
                    <tr className={TABLE_HEAD}>
                      <th className="py-3 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 text-violet-600 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                          title="현재 페이지 전체 선택"
                        />
                      </th>
                      <th className="py-3 pl-2.5 pr-1 text-left whitespace-nowrap">번호</th>
                      <th className="py-3 pl-1 pr-2.5 text-left whitespace-nowrap">상품코드</th>
                      <th className="py-3 px-2.5 text-left whitespace-nowrap">상품 이미지</th>
                      <th className="py-3 px-2.5 text-left whitespace-nowrap">상품명</th>
                      <th className="py-3 px-2.5 text-left whitespace-nowrap">카테고리</th>
                      <th className="py-3 px-2.5 text-left whitespace-nowrap">브랜드</th>
                      <th className="py-3 px-2.5 text-left whitespace-nowrap">특화 브랜드</th>
                      <th className="py-3 px-2.5 text-left whitespace-nowrap">위치번호</th>
                      <th className="py-3 px-2.5 text-left whitespace-nowrap">대여일</th>
                      <th className="py-3 px-2.5 text-left whitespace-nowrap">{dateColumnLabel}</th>
                      <th className="py-3 px-2.5 text-left whitespace-nowrap">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                    {pagedItems.map((rental, index) => {
                      const sample = sampleByCode.get(rental.sampleCode);
                      const showBack = !!imageFlips[rental.rentalId];
                      const currentImg = showBack
                        ? sample?.imgBack
                        : sample?.imgFront || sample?.imgFrontClean || sample?.imgFlat;
                      const isSelected = selectedIds.has(rental.rentalId);
                      const dueOrReturn =
                        selectedFilter === 'returned'
                          ? rental.returnDate || '-'
                          : rental.dueDate || '-';
                      const rowNo = (safePage - 1) * pageSize + index + 1;

                      return (
                        <tr
                          key={rental.rentalId}
                          className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-violet-50/40' : ''}`}
                        >
                          <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(rental.rentalId)}
                              className="w-3.5 h-3.5 text-violet-600 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                            />
                          </td>
                          <td className="py-3.5 pl-2.5 pr-1 text-left font-mono text-slate-400 text-[11px]">
                            {rowNo}
                          </td>
                          <td
                            className="py-3.5 pl-1 pr-2.5 text-left font-mono text-slate-600 text-[11px] truncate max-w-0"
                            title={rental.sampleCode}
                          >
                            {rental.sampleCode}
                          </td>
                          <td className="py-3.5 px-2.5 text-left">
                            <div
                              className="relative w-16 h-20 rounded-md bg-slate-50 overflow-hidden inline-flex items-center justify-center border border-slate-100 cursor-pointer"
                              onClick={() =>
                                setImageFlips((prev) => ({ ...prev, [rental.rentalId]: !prev[rental.rentalId] }))
                              }
                              title="클릭하면 앞/뒤 전환"
                            >
                              {currentImg ? (
                                <img
                                  src={currentImg}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-slate-300" />
                              )}
                              {(sample?.imgFront || sample?.imgBack) && (
                                <span className="absolute top-1 left-1 p-0.5 bg-slate-900/60 rounded">
                                  <RefreshCw className="w-3 h-3 text-white" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-2.5 text-left max-w-0" title={rental.sampleName}>
                            <div className="font-semibold text-slate-800 truncate">{rental.sampleName || '-'}</div>
                          </td>
                          <td className="py-3.5 px-2.5 text-left max-w-0 overflow-hidden">
                            <span
                              className="inline-block max-w-full text-xs text-slate-600 bg-slate-100 py-0.5 px-2 rounded-md font-medium whitespace-nowrap truncate"
                              title={sample?.category}
                            >
                              {sample?.category || '-'}
                            </span>
                          </td>
                          <td className="py-3.5 px-2.5 text-left font-semibold text-slate-700 whitespace-nowrap">
                            {sample?.brand || rental.sampleBrand || '-'}
                          </td>
                          <td
                            className="py-3.5 px-2.5 text-left font-semibold text-slate-700 truncate max-w-0"
                            title={sample?.specialBrand || undefined}
                          >
                            {sample?.specialBrand || '-'}
                          </td>
                          <td className="py-3.5 px-2.5 font-mono text-slate-600 text-[11px] text-left">
                            {sample?.locationNo || '-'}
                          </td>
                          <td className="py-3.5 px-2.5 text-left font-mono text-slate-500 text-[11px] whitespace-nowrap">
                            {rental.rentDate || '-'}
                          </td>
                          <td className="py-3.5 px-2.5 text-left font-mono text-slate-500 text-[11px] whitespace-nowrap">
                            {dueOrReturn}
                          </td>
                          <td className="py-3.5 px-2.5 text-left">
                            <RentalStatusBadge status={effectiveRentalStatus(rental)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
              <span className="text-[11px] text-slate-400 font-medium font-mono">
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, displayedItems.length)} / 총{' '}
                {displayedItems.length}건
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
                <span className="px-3 text-xs font-bold text-slate-600">
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
                  마지막 »
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

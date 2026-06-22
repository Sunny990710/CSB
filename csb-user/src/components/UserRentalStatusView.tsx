import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Package, AlertTriangle, Clock, CheckCircle2, Search, X } from 'lucide-react';
import PageHeader from './PageHeader';
import { RentalStatusBadge } from './StatusChipBar';
import { Rental, effectiveRentalStatus, rentalStatusLabel, todayDateStr } from '@/types';
import { DUE_SOON_DAYS } from '../utils/constants';

interface UserRentalStatusViewProps {
  rentals: Rental[];
  borrowerId: string;
}

type SummaryFilter = 'active' | 'overdue' | 'dueSoon' | 'returned';

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

function matchesRentalSearch(rental: Rental, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    rental.sampleCode,
    rental.sampleName,
    rental.sampleBrand,
    rental.rentDate,
    rental.dueDate,
    rental.returnDate,
    rentalStatusLabel(effectiveRentalStatus(rental)),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export default function UserRentalStatusView({ rentals, borrowerId }: UserRentalStatusViewProps) {
  const [selectedFilter, setSelectedFilter] = useState<SummaryFilter>('active');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery('');
  }, [selectedFilter]);

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
  const displayedItems = useMemo(
    () => selectedCard.items.filter((r) => matchesRentalSearch(r, query)),
    [selectedCard.items, query]
  );
  const hasItems = selectedCard.items.length > 0;

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

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <h3 className="text-sm font-black text-slate-800 shrink-0">{SECTION_TITLES[selectedFilter]} 목록</h3>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="샘플코드, 상품명 검색"
              className="w-full pl-9 pr-8 py-2 bg-slate-100/70 border-0 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-violet-500 rounded-xl text-xs font-medium placeholder:text-slate-400 transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-2 p-0.5 hover:bg-slate-200 rounded-full cursor-pointer"
                aria-label="검색어 지우기"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
        </div>
        {!hasItems ? (
          <p className="py-12 text-center text-sm text-slate-400">
            {SECTION_TITLES[selectedFilter]} 항목이 없습니다.
          </p>
        ) : displayedItems.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-4 text-left whitespace-nowrap">샘플코드</th>
                <th className="py-3 px-4 text-left">상품명</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">대여일</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">반납예정</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">상태</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((r) => (
                <tr key={r.rentalId} className="border-t border-slate-100">
                  <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">{r.sampleCode}</td>
                  <td className="py-3 px-4 font-bold">{r.sampleName}</td>
                  <td className="py-3 px-4">{r.rentDate}</td>
                  <td className="py-3 px-4">{r.dueDate}</td>
                  <td className="py-3 px-4">
                    <RentalStatusBadge status={effectiveRentalStatus(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

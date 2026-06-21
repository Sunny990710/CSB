import React, { useMemo } from 'react';
import { LayoutGrid, Package, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import PageHeader from './PageHeader';
import { Rental, effectiveRentalStatus, rentalStatusLabel, todayDateStr } from '@/types';
import { DUE_SOON_DAYS } from '../utils/constants';

interface UserRentalStatusViewProps {
  rentals: Rental[];
  borrowerId: string;
}

function daysUntilDue(rental: Rental): number {
  if (!rental.dueDate) return 999;
  const today = todayDateStr();
  const due = new Date(rental.dueDate);
  const ref = new Date(today);
  due.setHours(0, 0, 0, 0);
  ref.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - ref.getTime()) / 86400000);
}

export default function UserRentalStatusView({ rentals, borrowerId }: UserRentalStatusViewProps) {
  const mine = useMemo(
    () => rentals.filter((r) => r.borrowerId === borrowerId),
    [rentals, borrowerId]
  );

  const active = mine.filter((r) => effectiveRentalStatus(r) === '대여중');
  const overdue = mine.filter((r) => effectiveRentalStatus(r) === '연체중');
  const dueSoon = active.filter((r) => {
    const d = daysUntilDue(r);
    return d >= 0 && d <= DUE_SOON_DAYS;
  });
  const returned = mine.filter((r) => r.status === '반납완료');

  const cards = [
    {
      label: '대여 중',
      count: active.length,
      suffix: '건',
      icon: Package,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: '연체',
      count: overdue.length,
      suffix: '건',
      icon: AlertTriangle,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
    {
      label: dueSoon.length > 0 ? `반납 임박 (D-${daysUntilDue(dueSoon[0])})` : '반납 임박',
      count: dueSoon.length,
      suffix: '건',
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: '반납 완료',
      count: returned.length,
      suffix: '건',
      icon: CheckCircle2,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
  ];

  const recentActive = [...active, ...overdue].sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));

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
            return (
              <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
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
              </div>
            );
          })}
        </div>
      </div>

      {recentActive.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-800">진행 중인 대여</h3>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-4 text-left">샘플코드</th>
                <th className="py-3 px-4 text-left">상품명</th>
                <th className="py-3 px-4 text-left">대여일</th>
                <th className="py-3 px-4 text-left">반납예정</th>
                <th className="py-3 px-4 text-left">상태</th>
              </tr>
            </thead>
            <tbody>
              {recentActive.map((r) => (
                <tr key={r.rentalId} className="border-t border-slate-100">
                  <td className="py-3 px-4 font-mono text-indigo-600">{r.sampleCode}</td>
                  <td className="py-3 px-4 font-bold">{r.sampleName}</td>
                  <td className="py-3 px-4">{r.rentDate}</td>
                  <td className="py-3 px-4">{r.dueDate}</td>
                  <td className="py-3 px-4 font-bold">{rentalStatusLabel(effectiveRentalStatus(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

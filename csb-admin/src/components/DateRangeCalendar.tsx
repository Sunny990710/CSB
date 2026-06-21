import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date | null {
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function buildMonthGrid(viewYear: number, viewMonth: number) {
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { date: Date; inMonth: boolean; key: string }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const date = new Date(viewYear, viewMonth - 1, day);
    cells.push({ date, inMonth: false, key: toDateKey(date) });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewYear, viewMonth, day);
    cells.push({ date, inMonth: true, key: toDateKey(date) });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const date = new Date(viewYear, viewMonth + 1, nextDay++);
    cells.push({ date, inMonth: false, key: toDateKey(date) });
  }
  return cells;
}

type MonthCalendarProps = {
  year: number;
  month: number;
  draftFrom: string;
  draftTo: string;
  hoverKey: string | null;
  onDayClick: (key: string) => void;
  onDayHover: (key: string | null) => void;
  showPrev?: boolean;
  showNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
};

function getRangeBounds(from: string, to: string, hoverKey: string | null) {
  const end = to || hoverKey;
  if (!from || !end) return null;
  return from <= end ? [from, end] as const : [end, from] as const;
}

function MonthCalendar({
  year,
  month,
  draftFrom,
  draftTo,
  hoverKey,
  onDayClick,
  onDayHover,
  showPrev,
  showNext,
  onPrev,
  onNext,
}: MonthCalendarProps) {
  const cells = buildMonthGrid(year, month);

  return (
    <div className="w-[252px]">
      <div className="flex items-center justify-between mb-3 px-1">
        {showPrev ? (
          <button
            type="button"
            onClick={onPrev}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-500 cursor-pointer"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        ) : (
          <span className="w-6" />
        )}
        <span className="text-sm font-bold text-slate-800 tabular-nums">
          {year} {month + 1}
        </span>
        {showNext ? (
          <button
            type="button"
            onClick={onNext}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-500 cursor-pointer"
            aria-label="다음 달"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <span className="w-6" />
        )}
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((label, idx) => (
          <div
            key={label}
            className={`text-center text-[11px] font-bold py-1 ${
              idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-slate-700'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ date, inMonth, key }) => {
          const dow = date.getDay();
          const bounds = getRangeBounds(draftFrom, draftTo, hoverKey);
          const inRange = bounds ? key >= bounds[0] && key <= bounds[1] : false;
          const isStart = bounds ? key === bounds[0] : false;
          const isEnd = bounds ? key === bounds[1] : false;
          const isSingle = isStart && isEnd;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onDayClick(key)}
              onMouseEnter={() => onDayHover(key)}
              onMouseLeave={() => onDayHover(null)}
              className={`relative h-8 w-full text-[12px] font-semibold cursor-pointer transition-colors ${
                !inMonth ? 'text-slate-300' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-800'
              }`}
            >
              <span
                className={`absolute inset-0.5 flex items-center justify-center rounded-md ${
                  inRange ? 'bg-slate-100' : ''
                } ${isStart || isEnd || isSingle ? 'bg-slate-200 font-bold' : ''}`}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DateRangeCalendarProps = {
  initialFrom: string;
  initialTo: string;
  onConfirm: (from: string, to: string) => void;
  onCancel: () => void;
};

export function DateRangeCalendar({ initialFrom, initialTo, onConfirm, onCancel }: DateRangeCalendarProps) {
  const [draftFrom, setDraftFrom] = useState(initialFrom);
  const [draftTo, setDraftTo] = useState(initialTo);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [baseMonth, setBaseMonth] = useState(() => {
    const seed = parseDateKey(initialFrom) || parseDateKey(initialTo) || new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });

  const leftYear = baseMonth.getFullYear();
  const leftMonth = baseMonth.getMonth();
  const rightDate = new Date(leftYear, leftMonth + 1, 1);
  const rightYear = rightDate.getFullYear();
  const rightMonth = rightDate.getMonth();

  const shiftMonth = (delta: number) => {
    setBaseMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const handleDayClick = (key: string) => {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(key);
      setDraftTo('');
      return;
    }
    if (key < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(key);
    } else {
      setDraftTo(key);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-4">
      <div className="flex gap-6">
        <MonthCalendar
          year={leftYear}
          month={leftMonth}
          draftFrom={draftFrom}
          draftTo={draftTo}
          hoverKey={hoverKey}
          onDayClick={handleDayClick}
          onDayHover={setHoverKey}
          showPrev
          onPrev={() => shiftMonth(-1)}
        />
        <MonthCalendar
          year={rightYear}
          month={rightMonth}
          draftFrom={draftFrom}
          draftTo={draftTo}
          hoverKey={hoverKey}
          onDayClick={handleDayClick}
          onDayHover={setHoverKey}
          showNext
          onNext={() => shiftMonth(1)}
        />
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => onConfirm(draftFrom, draftTo)}
          className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-sm font-bold text-white transition-colors cursor-pointer"
        >
          확인
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { CheckCircle2, ChevronRight, Archive } from 'lucide-react';
import { RentalAgreement } from '@/types';

interface RentalCompleteViewProps {
  agreement: RentalAgreement;
  onGoHome: () => void;
  onGoLocker: () => void;
}

export default function RentalCompleteView({ agreement, onGoHome, onGoLocker }: RentalCompleteViewProps) {
  const rows: { label: string; value: React.ReactNode; valueClass?: string }[] = [
    { label: '동의서번호', value: agreement.agreementId, valueClass: 'text-slate-900' },
    { label: '대여 품목', value: `${agreement.quantity}건`, valueClass: 'text-slate-900' },
    {
      label: '대여 기간',
      value: `${agreement.rentDays}일 · ~${agreement.dueDate}`,
      valueClass: 'text-slate-900',
    },
    {
      label: '상태',
      value: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
          대여 완료
        </span>
      ),
      valueClass: '',
    },
  ];

  return (
    <div className="max-w-lg mx-auto py-16 text-center space-y-8">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
      </div>

      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">대여가 완료되었습니다</h1>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
          전자서명과 동시에 대여가 완료되었습니다.
          <br />
          반납 예정일까지 사용 후 반납해 주세요.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden text-left text-sm">
        {rows.map((row, idx) => (
          <div
            key={row.label}
            className={`flex justify-between items-center px-6 py-3.5 ${idx < rows.length - 1 ? 'border-b border-slate-100' : ''}`}
          >
            <span className="text-slate-500 font-medium">{row.label}</span>
            <span className={`font-bold ${row.valueClass}`}>{row.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-2 px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
        >
          홈으로
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onGoLocker}
          className="inline-flex items-center gap-2 px-8 py-3 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
        >
          <Archive className="w-4 h-4 text-violet-600" />
          내 보관함 이동
        </button>
      </div>
    </div>
  );
}

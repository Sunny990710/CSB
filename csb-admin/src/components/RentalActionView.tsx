import React, { useMemo, useState } from 'react';
import { ShoppingCart, RotateCcw, ScanLine, X, Trash2 } from 'lucide-react';
import { Member, Rental, RentalAgreement, Sample, effectiveRentalStatus } from '../types';
import RentalCompleteView from './RentalCompleteView';
import MemberSearchCombobox from './MemberSearchCombobox';

const RENTAL_DAYS = 28;

type RentalMode = 'borrow' | 'return';

interface BorrowItem {
  sampleCode: string;
  sampleName: string;
  brand: string;
  category: string;
}

interface RentalActionViewProps {
  samples: Sample[];
  rentals: Rental[];
  members: Member[];
  onRefreshData?: () => void | Promise<void>;
  onNavigateStatus: () => void;
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().substring(0, 10);
}

export default function RentalActionView({
  samples,
  rentals,
  members,
  onRefreshData,
  onNavigateStatus,
}: RentalActionViewProps) {
  const activeMembers = useMemo(
    () => members.filter((m) => m.useYn === '사용'),
    [members]
  );

  const [mode, setMode] = useState<RentalMode>('borrow');
  const [borrowerId, setBorrowerId] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [borrowItems, setBorrowItems] = useState<BorrowItem[]>([]);
  const [returnRentals, setReturnRentals] = useState<Rental[]>([]);
  const [purpose, setPurpose] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completedAgreement, setCompletedAgreement] = useState<RentalAgreement | null>(null);

  const selectedBorrower = activeMembers.find((m) => m.memberId === borrowerId) || null;

  const activeRentals = useMemo(
    () => rentals.filter((r) => effectiveRentalStatus(r) !== '반납완료'),
    [rentals]
  );

  const borrowerActiveRentals = useMemo(() => {
    if (!selectedBorrower) return [];
    return activeRentals.filter((r) => r.borrowerId === selectedBorrower.memberId);
  }, [activeRentals, selectedBorrower]);

  const handleScanBorrow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrower) {
      alert('대여자를 먼저 선택해 주세요.');
      return;
    }
    const code = scanInput.trim().toUpperCase();
    if (!code) return;

    const sample = samples.find((s) => s.code.toUpperCase() === code);
    if (!sample) {
      alert('해당 샘플 코드를 찾을 수 없습니다.');
      setScanInput('');
      return;
    }
    if (sample.status !== '대여가능') {
      alert('대여가능 상태인 샘플만 목록에 추가됩니다.');
      setScanInput('');
      return;
    }
    if (borrowItems.some((i) => i.sampleCode === sample.code)) {
      alert('이미 목록에 추가된 샘플입니다.');
      setScanInput('');
      return;
    }

    setBorrowItems((prev) => [
      ...prev,
      {
        sampleCode: sample.code,
        sampleName: sample.name,
        brand: sample.brand,
        category: sample.category,
      },
    ]);
    setScanInput('');
  };

  const handleScanReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanInput.trim().toUpperCase();
    if (!code) return;

    const rental = activeRentals.find((r) => r.sampleCode.toUpperCase() === code);
    if (!rental) {
      alert('대여 중인 샘플을 찾을 수 없습니다.');
      setScanInput('');
      return;
    }
    if (returnRentals.some((r) => r.rentalId === rental.rentalId)) {
      alert('이미 반납 목록에 추가되었습니다.');
      setScanInput('');
      return;
    }

    setReturnRentals((prev) => [...prev, rental]);
    setScanInput('');
  };

  const resetBorrowForm = () => {
    setBorrowItems([]);
    setPurpose('');
    setTermsAgreed(false);
  };

  const handleSubmitBorrow = async () => {
    if (!selectedBorrower) {
      alert('대여자를 선택해 주세요.');
      return;
    }
    if (borrowItems.length === 0) {
      alert('대여할 샘플을 추가해 주세요.');
      return;
    }
    if (!purpose.trim()) {
      alert('대여 목적을 입력해 주세요.');
      return;
    }
    if (!termsAgreed) {
      alert('약관 동의 및 전자서명에 체크해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const createRes = await fetch('/api/rental-agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrowerId: selectedBorrower.memberId,
          rentDays: RENTAL_DAYS,
          purpose: purpose.trim(),
          items: borrowItems.map((i) => ({ sampleCode: i.sampleCode })),
        }),
      });
      const createData = await createRes.json();
      if (!createData.success) {
        alert(createData.message || '대여 신청 작성에 실패했습니다.');
        return;
      }

      const completeRes = await fetch(`/api/rental-agreements/${createData.agreement.agreementId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedBy: selectedBorrower.name }),
      });
      const completeData = await completeRes.json();
      if (!completeData.success) {
        alert(completeData.message || '전자서명 및 대여 처리에 실패했습니다.');
        return;
      }

      setCompletedAgreement(completeData.agreement);
      resetBorrowForm();
      await onRefreshData?.();
    } catch (err) {
      console.error(err);
      alert('대여 처리 중 통신 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReturn = async () => {
    if (returnRentals.length === 0) {
      alert('반납할 샘플을 스캔해 주세요.');
      return;
    }

    setSubmitting(true);
    let ok = 0;
    let fail = 0;
    for (const rental of returnRentals) {
      try {
        const res = await fetch('/api/rentals/return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rentalId: rental.rentalId }),
        });
        const data = await res.json();
        if (data.success) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
    }
    setSubmitting(false);
    setReturnRentals([]);
    await onRefreshData?.();
    alert(fail === 0 ? `${ok}건 반납이 완료되었습니다.` : `완료 ${ok}건 · 실패 ${fail}건`);
  };

  if (completedAgreement) {
    return (
      <RentalCompleteView
        agreement={completedAgreement}
        onContinue={() => setCompletedAgreement(null)}
        onViewStatus={() => {
          setCompletedAgreement(null);
          onNavigateStatus();
        }}
      />
    );
  }

  const dueDate = addDaysISO(RENTAL_DAYS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">대여/반납하기</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          바코드를 스캔해 대여·반납을 처리합니다. 대여 시 임직원을 선택한 뒤 샘플을 스캔하세요.
        </p>
      </div>

      <div className="inline-flex p-1 bg-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setMode('borrow');
            setScanInput('');
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors ${
            mode === 'borrow' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          대여하기
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('return');
            setScanInput('');
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors ${
            mode === 'return' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          반납하기
        </button>
      </div>

      {mode === 'borrow' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <label className="text-xs font-bold text-slate-500 block mb-2">대여자 (임직원)</label>
          <MemberSearchCombobox
            members={activeMembers}
            value={borrowerId}
            onChange={setBorrowerId}
          />
        </div>
      )}

      <form
        onSubmit={mode === 'borrow' ? handleScanBorrow : handleScanReturn}
        className={`rounded-2xl border-2 p-5 space-y-3 ${
          mode === 'borrow' ? 'border-violet-100 bg-violet-50/30' : 'border-rose-100 bg-rose-50/30'
        }`}
      >
        <p className="text-sm font-black text-slate-800 flex items-center gap-2">
          <ScanLine className="w-4 h-4" />
          바코드 스캔 · {mode === 'borrow' ? '대여' : '반납'}
        </p>
        <input
          value={scanInput}
          onChange={(e) => setScanInput(e.target.value)}
          placeholder={
            mode === 'borrow'
              ? '바코드를 스캔하거나 샘플코드를 입력 후 Enter'
              : '반납할 샘플 바코드 스캔 후 Enter'
          }
          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          autoFocus
        />
        <p className="text-[11px] text-slate-500">
          {mode === 'borrow'
            ? '대여가능 상태인 샘플만 목록에 추가됩니다.'
            : selectedBorrower
              ? `선택한 대여자의 대여 중 샘플 ${borrowerActiveRentals.length}건 · 전체 대여 중 ${activeRentals.length}건 검색`
              : `대여 중인 샘플 ${activeRentals.length}건 중 바코드와 일치하는 건을 반납합니다.`}
        </p>
      </form>

      {mode === 'borrow' ? (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800">대여 품목 {borrowItems.length}건</h3>
              {borrowItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBorrowItems([])}
                  className="text-xs font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  비우기
                </button>
              )}
            </div>
            {borrowItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">대여할 샘플을 스캔하세요.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-4 text-left w-10">No.</th>
                    <th className="py-2.5 px-4 text-left">샘플코드</th>
                    <th className="py-2.5 px-4 text-left">상품명</th>
                    <th className="py-2.5 px-4 text-left">브랜드</th>
                    <th className="py-2.5 px-4 text-left">카테고리</th>
                    <th className="py-2.5 px-4 text-left">대여자</th>
                    <th className="py-2.5 px-4 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {borrowItems.map((item, idx) => (
                    <tr key={item.sampleCode} className="border-t border-slate-100">
                      <td className="py-2.5 px-4">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-mono text-indigo-600">{item.sampleCode}</td>
                      <td className="py-2.5 px-4 font-bold">{item.sampleName}</td>
                      <td className="py-2.5 px-4">{item.brand}</td>
                      <td className="py-2.5 px-4">{item.category}</td>
                      <td className="py-2.5 px-4">{selectedBorrower?.name || '-'}</td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => setBorrowItems((prev) => prev.filter((i) => i.sampleCode !== item.sampleCode))}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {borrowItems.length > 0 && selectedBorrower && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-800">신청 정보</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">신청자</p>
                  <p className="font-bold text-slate-900">
                    {selectedBorrower.name} · {selectedBorrower.affiliation || selectedBorrower.groupName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">대여 목적</p>
                  <input
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="예: 신상 촬영 레퍼런스"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">대여 기간</p>
                  <p className="font-bold text-slate-900">4주 (28일 고정)</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">반납 예정일</p>
                  <p className="font-bold text-slate-900">{dueDate}</p>
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span>
                  {selectedBorrower.name} 님 명의로 샘플 대여 약관에 동의·전자서명합니다. 기한 내 미반납 시 연체
                  안내가 발송됩니다.
                </span>
              </label>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitBorrow()}
                className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-black rounded-xl transition-colors cursor-pointer"
              >
                {submitting ? '처리 중…' : `전자서명 후 대여 처리 (${borrowItems.length}건)`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-800">반납 품목 {returnRentals.length}건</h3>
            {returnRentals.length > 0 && (
              <button
                type="button"
                onClick={() => setReturnRentals([])}
                className="text-xs font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                비우기
              </button>
            )}
          </div>
          {returnRentals.length === 0 ? (
            <div className="py-16 text-center">
              <ScanLine className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">반납할 샘플의 바코드를 스캔하세요.</p>
            </div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-4 text-left">샘플코드</th>
                    <th className="py-2.5 px-4 text-left">상품명</th>
                    <th className="py-2.5 px-4 text-left">대여자</th>
                    <th className="py-2.5 px-4 text-left">반납예정</th>
                    <th className="py-2.5 px-4 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {returnRentals.map((r) => (
                    <tr key={r.rentalId} className="border-t border-slate-100">
                      <td className="py-2.5 px-4 font-mono text-indigo-600">{r.sampleCode}</td>
                      <td className="py-2.5 px-4 font-bold">{r.sampleName}</td>
                      <td className="py-2.5 px-4">{r.borrowerName}</td>
                      <td className="py-2.5 px-4">{r.dueDate}</td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => setReturnRentals((prev) => prev.filter((x) => x.rentalId !== r.rentalId))}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-5 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmitReturn()}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-black rounded-xl cursor-pointer"
                >
                  {submitting ? '처리 중…' : `반납 처리 (${returnRentals.length}건)`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

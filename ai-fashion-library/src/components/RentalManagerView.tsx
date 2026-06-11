import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, User, AlertTriangle, ArrowUpRight, ArrowDownLeft, X, Check, 
  Send, Sparkles, Mail, Eye, Clock, History, AlertCircle, RefreshCw, FileText
} from 'lucide-react';
import { Sample, Rental, Member } from '../types';

interface RentalManagerViewProps {
  rentals: Rental[];
  samples: Sample[];
  members: Member[];
  onSaveDB: (newRentals: Rental[], newSamples: Sample[]) => void;
}

export default function RentalManagerView({
  rentals,
  samples,
  members,
  onSaveDB,
}: RentalManagerViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('전체');
  
  // Modals / AI Drawer States
  const [isBorrowOpen, setIsBorrowOpen] = useState(false);
  const [selectedRentalForHistory, setSelectedRentalForHistory] = useState<Rental | null>(null);

  // AI Automated Notification Sending ID
  const [sendingId, setSendingId] = useState<string | null>(null);

  // New Borrow action states
  const [borrowCode, setBorrowCode] = useState('');
  const [borrowerId, setBorrowerId] = useState('');
  const [borrowDays, setBorrowDays] = useState('7');
  const [borrowError, setBorrowError] = useState('');

  // Filtering rentals
  const filteredRentals = rentals.filter((r) => {
    const matchSearch =
      r.sampleCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sampleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.borrowerGroup.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchStatus = selectedStatus === '전체' || r.status === selectedStatus;
    
    return matchSearch && matchStatus;
  });

  // Available samples list for quick selection
  const availableSamples = samples.filter((s) => s.status === '대여가능' && s.useYn === '사용');

  // Member search trigger
  const selectedMemberObj = members.find(m => m.memberId === borrowerId);

  // One-click Automated Direct Email dispatcher (simplifies manual drafts)
  const handleSendAutomatedEmail = (rental: Rental) => {
    setSendingId(rental.rentalId);

    // Calculate days difference
    const dueTime = new Date(rental.dueDate).getTime();
    const todayTime = new Date('2026-06-09').getTime();
    const daysOverdue = Math.max(1, Math.ceil((todayTime - dueTime) / (1000 * 60 * 60 * 24)));
    const tone = rental.status === '연체중' ? 'warning' : 'gentle';

    fetch('/api/agent/draft-email', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        borrowerName: rental.borrowerName,
        borrowerGroup: rental.borrowerGroup,
        sampleName: rental.sampleName,
        sampleCode: rental.sampleCode,
        dueDate: rental.dueDate,
        daysOverdue,
        emailType: tone
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("초안 생성 실패");
      return res.json();
    })
    .then(draftData => {
      return fetch('/api/agent/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.rentalId,
          subject: draftData.subject,
          content: draftData.content
        })
      });
    })
    .then(res => {
      if (!res.ok) throw new Error("메일 발송 연계 실패");
      return res.json();
    })
    .then(data => {
      setSendingId(null);
      if (data.success) {
        window.location.reload();
      } else {
        alert('발송 실패: ' + data.message);
      }
    })
    .catch(err => {
      console.error(err);
      setSendingId(null);
      alert('자동 독촉 메일링 전송 중 에러가 발생했습니다.');
    });
  };

  // Submit rent Borrow transaction
  const handleBorrowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBorrowError('');

    if (!borrowCode) {
      setBorrowError('대여할 의류 샘플 상품코드를 지정해 주십시오.');
      return;
    }
    if (!borrowerId) {
      setBorrowError('사원사번 정보를 기재해 주십시오.');
      return;
    }

    const matchedSample = samples.find(s => s.code === borrowCode);
    const matchedMember = members.find(m => m.memberId === borrowerId);

    if (!matchedSample) {
      setBorrowError('존재하지 않는 상품코드 자산군 번호입니다.');
      return;
    }
    if (matchedSample.status !== '대여가능') {
      setBorrowError('선택하신 해당 옷 자산군은 현재 가용상태가 아닙니다.');
      return;
    }
    if (!matchedMember) {
      setBorrowError('기재한 사번의 임직원 데이터를 권한자 목록에서 찾을 수 없습니다.');
      return;
    }
    if (matchedMember.useYn !== '사용') {
      setBorrowError('해당 사원은 현재 샘플 대여 자격 보임이 일시 정지 상태입니다.');
      return;
    }

    // Call Borrow API
    fetch('/api/rentals/borrow', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sampleCode: borrowCode,
        borrowerId: borrowerId,
        rentDays: borrowDays
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert(data.message);
        setIsBorrowOpen(false);
        window.location.reload();
      } else {
        setBorrowError(data.message);
      }
    })
    .catch(err => {
      console.error(err);
      setBorrowError('서버 통신 중 에러가 발생하여 대여 신청이 취소되었습니다.');
    });
  };

  // Execute Return Action
  const handleReturnAction = (rentalId: string) => {
    if (!window.confirm('디자인실 보관 이관 전실에 입고되었음을 확인하고 반납 처리를 마칩니까?')) return;

    fetch('/api/rentals/return', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalId })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert(data.message);
        window.location.reload();
      } else {
        alert('반납 완료 처리에 실패했습니다: ' + data.message);
      }
    })
    .catch(err => {
      console.error(err);
      alert('반납 처리 통신 실패');
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" id="rental-manager-root">
      
      {/* 2-Columns wide Left Panel: Loans lists and triggers */}
      <div className="xl:col-span-2 space-y-4" id="rentals-control-panel-left">
        {/* Loan Control tools */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-center" id="rental-tools">
          <div className="flex flex-1 flex-wrap gap-2.5 items-center w-full">
            <div className="relative flex-1 min-w-[200px]">
              <Calendar className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="도너명, 사번, 대여샘플 등 통합검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs p-2 focus:outline-none"
            >
              <option value="전체">대여상태: 전체</option>
              <option value="대여중">대여중</option>
              <option value="연체중">연체중</option>
              <option value="반납완료">반납완료 (종결)</option>
            </select>
          </div>

          <button
            onClick={() => {
              setBorrowError('');
              setBorrowCode(availableSamples[0]?.code || '');
              setBorrowerId('');
              setIsBorrowOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs py-2 px-5 rounded-lg flex items-center justify-center gap-1.5 shrink-0 shadow-sm transition-all"
            id="btn-open-borrow-modal"
          >
            <ArrowUpRight className="w-4 h-4" />
            신규 의류 반출(대여) 신설
          </button>
        </div>

        {/* Rentals main list board */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden" id="rentals-grid-card">
          <div className="p-4 border-b border-slate-50">
            <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono">Apparel Rental Registries</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans" id="rentals-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">의류 샘플 정보</th>
                  <th className="py-2.5 px-4">대여자 목록</th>
                  <th className="py-2.5 px-3">대여일자</th>
                  <th className="py-2.5 px-3">반납예정일</th>
                  <th className="py-2.5 px-3">실제반납일</th>
                  <th className="py-2.5 px-3 text-center">독촉이력</th>
                  <th className="py-2.5 px-4 text-center">동작 및 에이전트</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-600 font-medium">
                {filteredRentals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-400">
                      일치하는 의류 반출 내역정보가 전무합니다.
                    </td>
                  </tr>
                ) : (
                  filteredRentals.map((rental, index) => {
                    const isOverdue = rental.status === '연체중';
                    const isReturned = rental.status === '반납완료';
                    const isRenting = rental.status === '대여중';

                    return (
                      <tr 
                        key={rental.rentalId} 
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isOverdue ? 'bg-rose-500/[0.01]' : ''
                        }`}
                        id={`rental-row-${index}`}
                      >
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-indigo-900 bg-indigo-50 py-0.25 px-1.5 rounded text-[10.5px]">
                              {rental.sampleCode}
                            </span>
                            <div className="font-bold text-slate-800 tracking-tight max-w-[150px] truncate" title={rental.sampleName}>
                              {rental.sampleName}
                            </div>
                            <span className="text-[10px] text-slate-400 block font-semibold">{rental.sampleBrand}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="space-y-0.5 font-sans">
                            <div className="font-bold text-slate-800">{rental.borrowerName}</div>
                            <div className="text-[10px] text-slate-400 font-semibold">{rental.borrowerGroup} ({rental.borrowerId})</div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">{rental.rentDate}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <span className={`${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                            {rental.dueDate}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {rental.returnDate ? (
                            <span className="text-emerald-600 font-bold">{rental.returnDate}</span>
                          ) : (
                            <span className="text-rose-500">반납 대기</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center">
                          {rental.notifyCount > 0 ? (
                            <button
                              onClick={() => setSelectedRentalForHistory(rental)}
                              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-1 px-2 rounded-full border border-indigo-200 transition-colors cursor-pointer"
                              title="전송 이력 조회"
                            >
                              <History className="w-3 h-3" />
                              {rental.notifyCount}회
                            </button>
                          ) : (
                            <span className="text-slate-350 text-[10px] font-mono font-semibold">-</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1.5" id={`rental-actions-${rental.rentalId}`}>
                            {isRenting && (
                              <>
                                <button
                                  onClick={() => handleReturnAction(rental.rentalId)}
                                  className="bg-slate-900 border border-slate-850 hover:bg-slate-850 active:scale-95 transition-all text-white py-1 px-2.5 rounded-lg font-bold text-[10.5px] cursor-pointer"
                                >
                                  반납
                                </button>
                                <button
                                  onClick={() => handleSendAutomatedEmail(rental)}
                                  disabled={sendingId === rental.rentalId}
                                  className="bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-all font-bold py-1 px-2.5 rounded-lg text-[10.5px] flex items-center gap-0.5 cursor-pointer disabled:opacity-50 font-sans"
                                  title="자동 알림 메일 전송"
                                >
                                  {sendingId === rental.rentalId ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    'AI'
                                  )}
                                </button>
                              </>
                            )}

                            {isOverdue && (
                              <>
                                <button
                                  onClick={() => handleReturnAction(rental.rentalId)}
                                  className="bg-slate-900 border border-slate-850 hover:bg-slate-850 active:scale-95 transition-all text-white py-1 px-3 rounded-lg font-bold text-[10.5px] whitespace-nowrap"
                                >
                                  반납입고
                                </button>
                                <button
                                  onClick={() => handleSendAutomatedEmail(rental)}
                                  disabled={sendingId === rental.rentalId}
                                  className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white py-1.5 px-3 rounded-lg font-bold text-[10.5px] flex items-center gap-2 shadow-sm whitespace-nowrap border border-rose-500 animate-pulse cursor-pointer disabled:opacity-50"
                                  id="btn-alert-agent"
                                >
                                  {sendingId === rental.rentalId ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      전송 중...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5" />
                                      AI 독촉
                                    </>
                                  )}
                                </button>
                              </>
                            )}

                            {isReturned && (
                              <span className="text-[10.5px] text-emerald-600 font-bold py-1 px-2 bg-emerald-50 rounded-lg">
                                종결 완료
                              </span>
                            )}
                          </div>
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

      {/* 1-Column Right Panel: Sample Helper Virtual Agent Workspace */}
      <div className="space-y-4" id="rentals-control-panel-right">
        <div className="bg-linear-to-b from-indigo-900 to-slate-900 text-white p-5 rounded-2xl border border-indigo-950 shadow-sm relative overflow-hidden" id="workspace-agent-box">
          
          {/* Agent Head details */}
          <div className="flex gap-3.5 items-start">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/15 shadow-sm text-indigo-300 relative shrink-0">
              <Sparkles className="w-6 h-6 text-indigo-300 animate-bounce" />
              <span className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900 animate-pulse" />
            </div>
            
            <div className="space-y-1 z-10">
              <span className="text-[9.5px] font-bold font-mono tracking-widest text-indigo-200 uppercase bg-indigo-500/30 px-2 py-0.5 rounded-full">
                Mailing AI Agent
              </span>
              <h3 className="text-sm font-bold tracking-tight">의류 샘플 회수 메일링 에이전트</h3>
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans font-medium">
                반납 촉구 상황판이 감지되면 연체 등급별로 정밀화된 이메일 독촉장을 실시간으로 자동 기재해 줍니다.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 my-4" />

          {/* ACTIVE DRAFT WORKSPACE PANEL */}
          <div className="py-10 text-center text-indigo-200/80 space-y-4 flex flex-col items-center justify-center animate-fade-in" id="agent-active-desc">
            <Mail className="w-10 h-10 text-indigo-400 mb-1" />
            <h4 className="text-sm font-extrabold text-white">원클릭 자동 메일링 활성화 상태</h4>
            <p className="text-[11.5px] font-sans px-2 leading-relaxed text-indigo-200">
              더 이상 번거로운 초안 작성이나 단계별 이메일 작성 절차가 필요 없습니다. <br/><br/>
              대여 목록에서 각 미반납 또는 연체 항목 우측의 <strong className="text-white">"AI"</strong> 또는 <b className="text-rose-400">"AI 독촉"</b> 버튼을 누르면, 
              스마트 에이전트가 대상자의 연체 빈도와 기간에 즉시 반응하는 최적화된 독촉 메시지를 자동으로 생성하여 대상자의 메일함으로 바로 전송합니다.
            </p>
          </div>
        </div>
      </div>

      {/* NEW BORROW ( 반출 등록 ) MODAL */}
      {isBorrowOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <ArrowUpRight className="w-5 h-5 text-indigo-650" />
                의류 샘플 신규 반출 보임 승인
              </h4>
              <button onClick={() => setIsBorrowOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBorrowSubmit} className="space-y-4 text-xs font-sans">
              
              {borrowError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{borrowError}</span>
                </div>
              )}

              {/* Choose Avaialbe sample cloth */}
              <div className="space-y-1">
                <label className="font-bold text-slate-605 block">대상 의류 샘플 선택 <span className="text-rose-500">*</span></label>
                <select
                  value={borrowCode}
                  onChange={(e) => setBorrowCode(e.target.value)}
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg focus:outline-none"
                  required
                >
                  <option value="">-- 반출 가용한 샘플 선택 --</option>
                  {availableSamples.map((s) => (
                    <option key={s.id} value={s.code}>
                      [{s.code}] {s.name} ({s.brand} - {s.category})
                    </option>
                  ))}
                </select>
                {availableSamples.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-bold">등록된 사용성 가용자산이 없습니다. 대장을 먼저 채워주세요.</p>
                )}
              </div>

              {/* Borrower 사번 입력 */}
              <div className="space-y-1">
                <label className="font-bold text-slate-605 block">대여자 사번 번호 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="예: 20240112 (사번 입력 시 자동 조회)"
                  value={borrowerId}
                  onChange={(e) => setBorrowerId(e.target.value)}
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-605"
                />
                
                {/* ID lookup visual hint overlay */}
                {selectedMemberObj ? (
                  <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 font-bold flex items-center gap-1.5 mt-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>팀원 확인 완료: <strong>{selectedMemberObj.name}</strong> ({selectedMemberObj.groupName})</span>
                  </div>
                ) : (
                  borrowerId ? (
                    <p className="text-[10px] text-rose-500 font-bold">권한 목록에 검색되는 사번 임직원이 없습니다.</p>
                  ) : null
                )}
              </div>

              {/* Rent periods */}
              <div className="space-y-1">
                <label className="font-bold text-slate-605 block">대여 기간 설정</label>
                <select
                  value={borrowDays}
                  onChange={(e) => setBorrowDays(e.target.value)}
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg focus:outline-none font-bold"
                >
                  <option value="3">3 일 반환 (긴급 품목)</option>
                  <option value="7">7 일 대여 (일반 품목)</option>
                  <option value="14">14 일 대여 (장기 기획)</option>
                  <option value="30">30 일 대여 (출장 원거리)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => setIsBorrowOpen(false)}
                  className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 border border-slate-800 text-white font-bold px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                  id="btn-confirm-borrow"
                >
                  반출 신청 접수
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILED NOTIFICATION MAILS LOG HISTORY DIALOG */}
      {selectedRentalForHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold font-mono tracking-wider text-indigo-305 uppercase">
                  Alert Log Histories
                </h4>
                <div className="text-sm font-bold">{selectedRentalForHistory.borrowerName} 님 자동 발송 기록 ({selectedRentalForHistory.notifyCount}회)</div>
              </div>
              <button 
                onClick={() => setSelectedRentalForHistory(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
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
                      <span className="text-violet-600 bg-violet-50 font-bold px-1.5 py-0.25 rounded">
                        Simulated Email Out
                      </span>
                    </div>
                    <div className="font-bold text-slate-800">{item.subject}</div>
                    <p className="text-slate-600 leading-relaxed bg-white border border-slate-100 p-2.5 rounded-lg whitespace-pre-wrap font-sans text-[11px]">
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
    </div>
  );
}

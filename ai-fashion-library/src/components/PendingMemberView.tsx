import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Search, CheckCircle2, XCircle, ChevronDown, RotateCcw } from 'lucide-react';
import { Member } from '../types';
import { DateRangeCalendar } from './DateRangeCalendar';

interface PendingMemberViewProps {
  members: Member[];
  onSave: (newMembers: Member[]) => void;
}

const nowStr = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

export default function PendingMemberView({ members, onSave }: PendingMemberViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [dateOpen, setDateOpen] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const [datePopoverPos, setDatePopoverPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!dateOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dateFilterRef.current?.contains(target) || datePopoverRef.current?.contains(target)) return;
      setDateOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dateOpen]);

  useEffect(() => {
    if (!dateOpen) return;
    const updatePos = () => {
      if (!dateFilterRef.current) return;
      const rect = dateFilterRef.current.getBoundingClientRect();
      const popoverWidth = 560;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }
      setDatePopoverPos({ top: rect.bottom + 4, left });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [dateOpen]);

  const dateFilterLabel =
    !fromDate && !toDate
      ? '신청일: 전체'
      : fromDate && toDate && fromDate === toDate
        ? `신청일: ${fromDate}`
        : `신청일: ${fromDate || '…'} ~ ${toDate || '…'}`;

  const pending = members.filter((m) => m.status === 'pending');

  const filtered = pending.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      m.memberId.toLowerCase().includes(q) ||
      (m.loginId || '').toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.affiliation || '').toLowerCase().includes(q) ||
      (m.brand || '').toLowerCase().includes(q);
    const day = (m.appliedDate || '').substring(0, 10);
    const matchFrom = !fromDate || (!!day && day >= fromDate);
    const matchTo = !toDate || (!!day && day <= toDate);
    return matchQ && matchFrom && matchTo;
  });

  const resetFilters = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setDateOpen(false);
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((m) => m.memberId)));
    }
  };

  const approve = (ids: string[]) => {
    if (ids.length === 0) return;
    onSave(
      members.map((m) =>
        ids.includes(m.memberId)
          ? { ...m, status: 'approved', useYn: '사용', approvalDate: nowStr() }
          : m
      )
    );
    setSelected(new Set());
  };

  const reject = (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`선택한 ${ids.length}명의 가입 신청을 반려(삭제)하시겠습니까?`)) return;
    onSave(members.filter((m) => !ids.includes(m.memberId)));
    setSelected(new Set());
  };

  const selectedIds = Array.from(selected).filter((id) => filtered.some((m) => m.memberId === id));
  const allChecked = filtered.length > 0 && selectedIds.length === filtered.length;

  return (
    <div className="space-y-6" id="pending-member-container">
      {/* Search & filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="아이디, 이름, 이메일, 소속, 브랜드로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => approve(selectedIds)}
              disabled={selectedIds.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>선택 승인</span>
            </button>
            <button
              onClick={() => reject(selectedIds)}
              disabled={selectedIds.length === 0}
              className="bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>선택 반려</span>
            </button>
          </div>
        </div>

        {/* Filter chips row */}
        <div className="flex flex-col lg:flex-row lg:justify-between items-stretch lg:items-center gap-x-3 gap-y-2.5 pt-2.5 border-t border-slate-100">
          <div className="flex flex-nowrap gap-x-2 items-center overflow-x-auto min-w-0 shrink">
            <button
              onClick={resetFilters}
              className="bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs font-bold py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-white" />
              <span>필터 초기화</span>
            </button>

            {/* 신청일 dropdown chip */}
            <div className="relative shrink-0" ref={dateFilterRef}>
              <button
                type="button"
                onClick={() => {
                  if (dateOpen) {
                    setDateOpen(false);
                    return;
                  }
                  if (dateFilterRef.current) {
                    const rect = dateFilterRef.current.getBoundingClientRect();
                    const popoverWidth = 560;
                    let left = rect.left;
                    if (left + popoverWidth > window.innerWidth - 16) {
                      left = Math.max(16, window.innerWidth - popoverWidth - 16);
                    }
                    setDatePopoverPos({ top: rect.bottom + 4, left });
                  }
                  setDateOpen(true);
                }}
                className={`bg-white hover:bg-slate-50 border pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none transition-colors cursor-pointer whitespace-nowrap ${
                  dateOpen ? 'border-violet-500' : 'border-slate-200 focus:border-violet-500'
                }`}
              >
                {dateFilterLabel}
              </button>
              <ChevronDown className={`absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none transition-transform ${dateOpen ? 'rotate-180' : ''}`} />
            </div>

            {dateOpen && createPortal(
              <div ref={datePopoverRef} className="fixed z-[9999]" style={{ top: datePopoverPos.top, left: datePopoverPos.left }}>
                <DateRangeCalendar
                  initialFrom={fromDate}
                  initialTo={toDate}
                  onConfirm={(from, to) => {
                    setFromDate(from);
                    setToDate(to);
                    setDateOpen(false);
                  }}
                  onCancel={() => setDateOpen(false)}
                />
              </div>,
              document.body
            )}
          </div>

          <span className="text-[11px] text-slate-400 font-extrabold font-mono uppercase tracking-wide whitespace-nowrap shrink-0 self-end lg:self-center">
            {selectedIds.length > 0 && <span className="text-slate-500 normal-case mr-3">{selectedIds.length}명 선택됨</span>}
            미승인 신청: {filtered.length.toLocaleString()}건
          </span>
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                <th className="py-3 px-4 w-10">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="cursor-pointer accent-violet-600" />
                </th>
                <th className="py-3 px-4">신청일</th>
                <th className="py-3 px-4">아이디</th>
                <th className="py-3 px-4">이름</th>
                <th className="py-3 px-4">소속</th>
                <th className="py-3 px-4">이메일</th>
                <th className="py-3 px-4">브랜드</th>
                <th className="py-3 px-4 text-center">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    조회 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((member) => (
                  <tr key={member.memberId} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selected.has(member.memberId)}
                        onChange={() => toggleOne(member.memberId)}
                        className="cursor-pointer accent-violet-600"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">{member.appliedDate || '-'}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{member.loginId || (member.email || '').split('@')[0]}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{member.name}</td>
                    <td className="py-3 px-4 text-slate-500">{member.affiliation || member.groupName || '-'}</td>
                    <td className="py-3 px-4 text-slate-500">{member.email || '-'}</td>
                    <td className="py-3 px-4 text-slate-500">{member.brand || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center items-center gap-1.5">
                        <button
                          onClick={() => approve([member.memberId])}
                          className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg cursor-pointer"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => reject([member.memberId])}
                          className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg cursor-pointer"
                        >
                          반려
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

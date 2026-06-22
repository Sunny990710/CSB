import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { Member } from '../types';

interface MemberSearchComboboxProps {
  members: Member[];
  value: string;
  onChange: (memberId: string) => void;
  placeholder?: string;
  className?: string;
}

function memberLabel(m: Member) {
  const group = m.affiliation || m.groupName || '-';
  return `${m.name} · ${group} (${m.memberId})`;
}

function matchesQuery(m: Member, q: string) {
  const haystack = [
    m.memberId,
    m.loginId,
    m.name,
    m.email,
    m.affiliation,
    m.groupName,
    m.brand,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export default function MemberSearchCombobox({
  members,
  value,
  onChange,
  placeholder = '이름, 사번, 소속으로 검색...',
  className = '',
}: MemberSearchComboboxProps) {
  const selected = members.find((m) => m.memberId === value) || null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? members.filter((m) => matchesQuery(m, q)) : members;
    return list.slice(0, 50);
  }, [members, query]);

  const openSearch = () => {
    setOpen(true);
    setQuery('');
  };

  return (
    <div className={`relative max-w-md ${className}`} ref={boxRef}>
      {selected && !open ? (
        <div className="w-full flex items-center bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-violet-500/20">
          <button
            type="button"
            onClick={openSearch}
            className="flex-1 min-w-0 text-left px-3 py-2.5 text-sm text-slate-800 truncate cursor-pointer"
            title="다시 검색"
          >
            {memberLabel(selected)}
          </button>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            className="p-2.5 text-slate-400 hover:text-rose-500 shrink-0 cursor-pointer"
            title="선택 해제"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={openSearch}
            className="p-2.5 text-slate-400 shrink-0 cursor-pointer border-l border-slate-100"
            title="목록 열기"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            autoFocus={open}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-400"
          />
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-xs text-slate-400 text-center">검색 결과가 없습니다.</div>
          ) : (
            results.map((m) => (
              <button
                key={m.memberId}
                type="button"
                onClick={() => {
                  onChange(m.memberId);
                  setOpen(false);
                  setQuery('');
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 cursor-pointer transition-colors ${
                  m.memberId === value ? 'bg-violet-50 text-violet-700' : 'text-slate-800'
                }`}
              >
                <span className="font-bold">{m.name}</span>
                <span className="text-slate-500 text-xs ml-1.5">
                  · {m.affiliation || m.groupName || '-'} · {m.memberId}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

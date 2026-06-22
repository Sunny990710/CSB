import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { formatMultiFilterLabel, toggleMultiFilterValue } from '../utils/filterMultiSelect';

interface FilterDropdownProps {
  label: string;
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
  popoverWidth?: number;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 6l3 3 5-5" />
    </svg>
  );
}

export default function FilterDropdown({ label, value, options, onChange, popoverWidth = 220 }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const isActive = value.length > 0;
  const triggerLabel = formatMultiFilterLabel(label, value);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const openPopover = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }
      setPopoverPos({ top: rect.bottom + 4, left });
    }
    setOpen(true);
  };

  const toggle = (option: string) => {
    onChange(toggleMultiFilterValue(value, option));
  };

  const clearAll = () => onChange([]);

  return (
    <>
      <div className="relative shrink-0" ref={triggerRef}>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPopover())}
          className={`bg-white hover:bg-slate-50 border pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none transition-colors cursor-pointer whitespace-nowrap ${
            open || isActive ? 'border-violet-500' : 'border-slate-200 focus:border-violet-500'
          }`}
        >
          {triggerLabel}
        </button>
        <ChevronDown
          className={`absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[9999] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
            style={{ top: popoverPos.top, left: popoverPos.left, width: popoverWidth }}
          >
            <button
              type="button"
              onClick={clearAll}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors border-b border-slate-100 ${
                value.length === 0 ? 'bg-violet-50' : 'hover:bg-slate-50'
              }`}
            >
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  value.length === 0 ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'
                }`}
              >
                {value.length === 0 && <CheckIcon />}
              </span>
              <span className={`text-xs font-bold flex-1 ${value.length === 0 ? 'text-violet-700' : 'text-slate-800'}`}>
                {label}: 전체
              </span>
            </button>

            <ul className="max-h-64 overflow-y-auto py-1">
              {options.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-slate-400">선택 가능한 항목이 없습니다.</li>
              ) : (
                options.map((option) => {
                  const selected = value.includes(option);
                  return (
                    <li key={option}>
                      <button
                        type="button"
                        onClick={() => toggle(option)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors ${
                          selected ? 'bg-violet-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            selected ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {selected && <CheckIcon />}
                        </span>
                        <span className={`text-xs font-bold truncate flex-1 ${selected ? 'text-violet-700' : 'text-slate-800'}`}>
                          {option}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}

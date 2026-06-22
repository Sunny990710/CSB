import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { COLOR_PALETTE_ROWS, getColorHex } from '../utils/colorPalette';
import { formatMultiFilterLabel, toggleMultiFilterValue } from '../utils/filterMultiSelect';

interface ColorFilterDropdownProps {
  value: string[];
  onChange: (color: string[]) => void;
}

function ColorSwatchCircle({ hex, border, size = 'md' }: { hex: string; border?: boolean; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <span
      className={`${dim} rounded-full shrink-0 ${border ? 'border border-slate-300' : ''}`}
      style={{ backgroundColor: hex }}
    />
  );
}

export default function ColorFilterDropdown({ value, onChange }: ColorFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const firstSelectedHex = value.length === 1 ? getColorHex(value[0]) : undefined;
  const label = formatMultiFilterLabel('컬러', value);

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
      const popoverWidth = 320;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }
      setPopoverPos({ top: rect.bottom + 4, left });
    }
    setOpen(true);
  };

  const toggleColor = (color: string) => {
    onChange(toggleMultiFilterValue(value, color));
  };

  const clearAll = () => onChange([]);

  return (
    <>
      <div className="relative shrink-0" ref={triggerRef}>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPopover())}
          className={`bg-white hover:bg-slate-50 border pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
            open || value.length > 0 ? 'border-violet-500' : 'border-slate-200 focus:border-violet-500'
          }`}
        >
          {firstSelectedHex && (
            <ColorSwatchCircle hex={firstSelectedHex} border={value[0] === '화이트'} size="sm" />
          )}
          {label}
        </button>
        <ChevronDown
          className={`absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[9999] w-[320px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
            style={{ top: popoverPos.top, left: popoverPos.left }}
          >
            <button
              type="button"
              onClick={clearAll}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b border-slate-100 hover:bg-slate-50 cursor-pointer text-left ${
                value.length === 0 ? 'bg-violet-50 text-violet-700' : 'text-slate-700'
              }`}
            >
              컬러: 전체
            </button>

            <div className="max-h-72 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {COLOR_PALETTE_ROWS.map((row, rowIdx) =>
                  row.map((swatch) => (
                    <ColorRowItem
                      key={`${rowIdx}-${swatch.name}`}
                      swatch={swatch}
                      selected={value.includes(swatch.name)}
                      onSelect={() => toggleColor(swatch.name)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function ColorRowItem({
  swatch,
  selected,
  onSelect,
}: {
  swatch: { name: string; hex: string; border?: boolean };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${
        selected ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-slate-50'
      }`}
    >
      <ColorSwatchCircle hex={swatch.hex} border={swatch.border} />
      <span className={`text-xs font-bold truncate ${selected ? 'text-violet-700' : 'text-slate-800'}`}>{swatch.name}</span>
    </button>
  );
}

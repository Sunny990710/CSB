import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Star } from 'lucide-react';
import { EXAMPLE_BRANDS, getBrandFavorites, mergeBrandOptions, toggleBrandFavorite } from '../utils/brandFavorites';
import { formatMultiFilterLabel, toggleMultiFilterValue } from '../utils/filterMultiSelect';

interface BrandFilterDropdownProps {
  value: string[];
  brands: string[];
  onChange: (brand: string[]) => void;
}

export default function BrandFilterDropdown({ value, brands, onChange }: BrandFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => getBrandFavorites());
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const allBrands = useMemo(() => {
    const merged = mergeBrandOptions(brands);
    const set = new Set([...EXAMPLE_BRANDS, ...merged]);
    return Array.from(set);
  }, [brands]);

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? allBrands.filter((b) => b.toLowerCase().includes(q)) : allBrands;
    const favSet = new Set(favorites);
    return [...list].sort((a, b) => {
      const af = favSet.has(a);
      const bf = favSet.has(b);
      if (af && !bf) return -1;
      if (!af && bf) return 1;
      return a.localeCompare(b, 'ko');
    });
  }, [allBrands, favorites, search]);

  const label = formatMultiFilterLabel('브랜드', value);

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
      const popoverWidth = 280;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }
      setPopoverPos({ top: rect.bottom + 4, left });
    }
    setSearch('');
    setOpen(true);
  };

  const handleToggleFavorite = (e: React.MouseEvent, brand: string) => {
    e.stopPropagation();
    setFavorites(toggleBrandFavorite(brand));
  };

  return (
    <>
      <div className="relative shrink-0" ref={triggerRef}>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPopover())}
          className={`bg-white hover:bg-slate-50 border pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none transition-colors cursor-pointer whitespace-nowrap ${
            open || value.length > 0 ? 'border-violet-500' : 'border-slate-200 focus:border-violet-500'
          }`}
        >
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
            className="fixed z-[9999] w-[280px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
            style={{ top: popoverPos.top, left: popoverPos.left }}
          >
            <div className="relative px-3 pt-3 pb-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="브랜드를 검색하세요."
                className="w-full pr-9 pb-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 border-0 border-b-2 border-slate-900 focus:outline-none bg-transparent"
                autoFocus
              />
              <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <ul className="max-h-64 overflow-y-auto py-1">
              <li>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-left ${
                    value.length === 0 ? 'bg-violet-50' : ''
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      value.length === 0 ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {value.length === 0 && (
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-xs font-bold flex-1 ${value.length === 0 ? 'text-violet-700' : 'text-slate-800'}`}>
                    브랜드: 전체
                  </span>
                </button>
              </li>

              {filteredBrands.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-slate-400">검색 결과가 없습니다.</li>
              ) : (
                filteredBrands.map((brand) => {
                  const isSelected = value.includes(brand);
                  const isFavorite = favorites.includes(brand);
                  return (
                    <li key={brand} className="flex items-center hover:bg-slate-50 transition-colors group">
                      <button
                        type="button"
                        onClick={() => onChange(toggleMultiFilterValue(value, brand))}
                        className={`flex-1 flex items-center gap-3 px-4 py-2.5 cursor-pointer text-left min-w-0 ${
                          isSelected ? 'bg-violet-50' : ''
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && (
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </span>
                        <span className="text-xs font-bold text-slate-800 flex-1 truncate">{brand}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(e, brand)}
                        className="p-2 mr-2 rounded-md hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                        aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                      >
                        <Star
                          className={`w-4 h-4 ${isFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-300 group-hover:text-slate-400'}`}
                        />
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

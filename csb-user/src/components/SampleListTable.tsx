import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Image as ImageIcon, Plus, Check, RefreshCw } from 'lucide-react';
import { Sample, sampleStatusLabel } from '@/types';
import { canAddSampleToLocker } from '../utils/lockerHelpers';

const TABLE_MIN_W = 'min-w-[1276px]';
const TABLE_HEAD =
  'bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans text-left';

function statusBadgeClass(status: Sample['status']) {
  switch (status) {
    case '대여가능':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case '대여중':
      return 'bg-blue-50 text-blue-700 border-blue-100';
    case '연체중':
      return 'bg-rose-50 text-rose-700 border-rose-100';
    case '부평보관':
      return 'bg-amber-50 text-amber-700 border-amber-100';
    case '분실':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

interface SampleListTableProps {
  samples: Sample[];
  lockerCodes: string[];
  onOpenDetail: (sample: Sample) => void;
  onToggleLocker: (code: string) => void;
  emptyMessage?: string;
  pageSize?: number;
}

export default function SampleListTable({
  samples,
  lockerCodes,
  onOpenDetail,
  onToggleLocker,
  emptyMessage = '검색 필터와 일치하는 샘플이 없습니다.',
  pageSize = 20,
}: SampleListTableProps) {
  const [sortDir, setSortDir] = useState<'desc' | 'asc' | null>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [imageFlips, setImageFlips] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setCurrentPage(1);
  }, [samples]);

  const sorted = useMemo(() => {
    const list = [...samples];
    if (!sortDir) return list;
    list.sort((a, b) => {
      const av = a.regDate || '';
      const bv = b.regDate || '';
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [samples, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const allInLocker =
    paged.length > 0 && paged.every((s) => lockerCodes.includes(s.code));

  const toggleSortByDate = () => {
    setSortDir((d) => (d === 'desc' ? 'asc' : d === 'asc' ? null : 'desc'));
    setCurrentPage(1);
  };

  const toggleSelectAll = () => {
    if (allInLocker) {
      for (const s of paged) {
        if (lockerCodes.includes(s.code)) onToggleLocker(s.code);
      }
    } else {
      for (const s of paged) {
        if (!lockerCodes.includes(s.code) && canAddSampleToLocker(s.status)) onToggleLocker(s.code);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full table-fixed text-left border-collapse ${TABLE_MIN_W}`}>
            <colgroup>
              <col className="w-[40px]" />
              <col className="w-[44px]" />
              <col className="w-[118px]" />
              <col className="w-[76px]" />
              <col className="w-[220px]" />
              <col className="w-[104px]" />
              <col className="w-[96px]" />
              <col className="w-[88px]" />
              <col className="w-[72px]" />
              <col className="w-[168px]" />
              <col className="w-[80px]" />
              <col className="w-[80px]" />
              <col className="w-[88px]" />
            </colgroup>
            <thead>
              <tr className={TABLE_HEAD}>
                <th className="py-3 px-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allInLocker && paged.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 text-violet-600 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle"
                    title="현재 페이지 전체 보관함 담기"
                  />
                </th>
                <th className="py-3 pl-2.5 pr-1 text-left whitespace-nowrap">번호</th>
                <th className="py-3 pl-1 pr-2.5 text-left whitespace-nowrap">상품코드</th>
                <th className="py-3 px-2.5 text-left whitespace-nowrap">상품 이미지</th>
                <th className="py-3 px-2.5 text-left whitespace-nowrap">상품명</th>
                <th className="py-3 px-2.5 text-left whitespace-nowrap">카테고리</th>
                <th className="py-3 px-2.5 text-left whitespace-nowrap">브랜드</th>
                <th className="py-3 px-2.5 text-left whitespace-nowrap">특화 브랜드</th>
                <th className="py-3 px-2.5 text-left whitespace-nowrap">위치번호</th>
                <th className="py-3 px-2.5 text-left whitespace-nowrap">
                  <button
                    type="button"
                    onClick={toggleSortByDate}
                    className="inline-flex items-center gap-1 hover:text-slate-700 cursor-pointer"
                    title="등록일 정렬"
                  >
                    등록일
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''} ${sortDir ? 'text-violet-600' : 'text-slate-400'}`}
                    />
                  </button>
                </th>
                <th className="py-3 px-2.5 text-left whitespace-nowrap">등록자</th>
                <th className="py-3 px-2.5 text-left whitespace-nowrap">상태</th>
                <th className="py-3 px-2.5 text-left whitespace-nowrap">동작</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-20 text-center text-slate-400">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paged.map((sample, index) => {
                  const rowNo = (safePage - 1) * pageSize + index + 1;
                  const inLocker = lockerCodes.includes(sample.code);
                  const showBack = !!imageFlips[sample.id];
                  const currentImg = showBack ? sample.imgBack : sample.imgFront || sample.imgFrontClean || sample.imgFlat;
                  const canAdd = canAddSampleToLocker(sample.status) || inLocker;

                  return (
                    <tr
                      key={sample.code}
                      className={`hover:bg-slate-50/70 transition-colors ${inLocker ? 'bg-violet-50/40' : ''}`}
                    >
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={inLocker}
                          disabled={!canAdd}
                          onChange={() => onToggleLocker(sample.code)}
                          className="w-3.5 h-3.5 text-violet-600 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer align-middle disabled:opacity-40"
                        />
                      </td>
                      <td className="py-3.5 pl-2.5 pr-1 text-left font-mono text-slate-400 text-[11px]">{rowNo}</td>
                      <td
                        className="py-3.5 pl-1 pr-2.5 text-left font-mono text-slate-600 text-[11px] cursor-pointer truncate max-w-0 hover:text-slate-800"
                        onClick={() => onOpenDetail(sample)}
                        title={sample.code}
                      >
                        {sample.code}
                      </td>
                      <td className="py-3.5 px-2.5 text-left">
                        <div
                          className="relative w-16 h-20 rounded-md bg-slate-50 overflow-hidden inline-flex items-center justify-center cursor-pointer border border-slate-100"
                          onClick={() => setImageFlips((prev) => ({ ...prev, [sample.id]: !prev[sample.id] }))}
                          title="클릭하면 앞/뒤 전환"
                        >
                          {currentImg ? (
                            <img src={currentImg} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-300" />
                          )}
                          {(sample.imgFront || sample.imgBack) && (
                            <span className="absolute top-1 left-1 p-0.5 bg-slate-900/60 rounded">
                              <RefreshCw className="w-3 h-3 text-white" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="py-3.5 px-2.5 text-left cursor-pointer group/row max-w-0"
                        onClick={() => onOpenDetail(sample)}
                        title={sample.name}
                      >
                        <div className="font-semibold text-slate-800 group-hover/row:text-indigo-600 transition-colors truncate">
                          {sample.name || '-'}
                        </div>
                      </td>
                      <td className="py-3.5 px-2.5 text-left max-w-0 overflow-hidden">
                        <span
                          className="inline-block max-w-full text-xs text-slate-600 bg-slate-100 py-0.5 px-2 rounded-md font-medium whitespace-nowrap truncate"
                          title={sample.category}
                        >
                          {sample.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-2.5 text-left font-semibold text-slate-700 whitespace-nowrap">{sample.brand}</td>
                      <td className="py-3.5 px-2.5 text-left font-semibold text-slate-700 truncate max-w-0" title={sample.specialBrand || undefined}>
                        {sample.specialBrand || '-'}
                      </td>
                      <td className="py-3.5 px-2.5 font-mono text-slate-600 text-[11px] text-left">{sample.locationNo || '-'}</td>
                      <td className="py-3.5 px-2.5 text-left font-mono text-slate-400 text-[11px] max-w-0 overflow-hidden">
                        <span className="block truncate" title={sample.regDate}>
                          {sample.regDate}
                        </span>
                      </td>
                      <td className="py-3.5 px-2.5 text-left text-slate-600 text-[11px] max-w-0 overflow-hidden">
                        <span className="block truncate" title={sample.registerer || undefined}>
                          {sample.registerer || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-2.5 text-left">
                        <span
                          className={`inline-flex items-center justify-center min-w-[4.25rem] text-[11px] font-bold py-1 px-2.5 rounded-full border whitespace-nowrap ${statusBadgeClass(sample.status)}`}
                        >
                          {sampleStatusLabel(sample.status)}
                        </span>
                      </td>
                      <td className="py-3.5 px-2.5 text-left">
                        <button
                          type="button"
                          disabled={!canAdd}
                          onClick={() => onToggleLocker(sample.code)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            inLocker
                              ? 'bg-slate-100 text-slate-500 border border-slate-200'
                              : 'bg-violet-600 text-white hover:bg-violet-700'
                          }`}
                        >
                          {inLocker ? (
                            <>
                              <Check className="w-3 h-3" /> 담음
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" /> 담기
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sorted.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <span className="text-[11px] text-slate-400 font-medium font-mono">
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} / 총 {sorted.length}개
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              « 처음
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              이전
            </button>
            <span className="px-3 text-xs font-bold text-slate-600">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              다음
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              마지막 »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

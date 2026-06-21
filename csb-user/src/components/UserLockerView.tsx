import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Sample, sampleStatusLabel } from '@/types';
import { DEFAULT_FILTERS, filterSamples, statusCounts, uniqueValues } from '../utils/filters';
import SearchFilterBar from './SearchFilterBar';
import SampleImage from './SampleImage';
import PageHeader from './PageHeader';

interface UserLockerViewProps {
  samples: Sample[];
  lockerCodes: string[];
  onRemove: (code: string) => void;
  onRent: (code: string) => void;
  onNavigateRental: () => void;
}

const statusColor = (status: Sample['status']) => {
  if (status === '대여가능') return 'text-emerald-600';
  if (status === '대여중') return 'text-indigo-600';
  if (status === '연체중') return 'text-rose-600';
  return 'text-slate-600';
};

export default function UserLockerView({
  samples,
  lockerCodes,
  onRemove,
  onRent,
  onNavigateRental,
}: UserLockerViewProps) {
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const lockerSamples = useMemo(
    () => samples.filter((s) => lockerCodes.includes(s.code)),
    [samples, lockerCodes]
  );
  const filtered = useMemo(() => filterSamples(lockerSamples, filters), [lockerSamples, filters]);
  const counts = useMemo(() => statusCounts(lockerSamples), [lockerSamples]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="내 보관함"
        description="담아둔 샘플을 모아두고, 대여/반납 화면으로 보낼 수 있습니다."
      />

      <SearchFilterBar
        filters={filters}
        onChange={setFilters}
        brands={uniqueValues(lockerSamples, 'brand')}
        categories={uniqueValues(lockerSamples, 'category')}
        countries={uniqueValues(lockerSamples, 'country')}
        genders={uniqueValues(lockerSamples, 'gender')}
        seasons={uniqueValues(lockerSamples, 'season')}
        resultCount={filtered.length}
        statusCounts={counts}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchPlaceholder="보관함 검색 (상품코드, 상품명, 브랜드, 색상, 소재)"
        countLabel="보관 수"
      />

      {filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl">
          <p className="text-sm text-slate-400">보관함이 비어 있습니다.</p>
          <p className="text-xs text-slate-400 mt-1">홈에서 샘플을 담아 보세요.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-4 text-left w-12">번호</th>
                <th className="py-3 px-4 text-left">상품코드</th>
                <th className="py-3 px-4 text-left w-16">이미지</th>
                <th className="py-3 px-4 text-left">상품명</th>
                <th className="py-3 px-4 text-left">카테고리</th>
                <th className="py-3 px-4 text-left">브랜드</th>
                <th className="py-3 px-4 text-left">위치번호</th>
                <th className="py-3 px-4 text-left">상태</th>
                <th className="py-3 px-4 text-right">동작</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sample, idx) => {
                const canRent = sample.status === '대여가능';
                return (
                  <tr key={sample.code} className="border-t border-slate-100">
                    <td className="py-3 px-4 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono text-indigo-600">{sample.code}</td>
                    <td className="py-3 px-4">
                      <SampleImage sample={sample} className="w-10 h-10 rounded-lg border border-slate-100" />
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 max-w-[200px] truncate">{sample.name}</td>
                    <td className="py-3 px-4">{sample.category}</td>
                    <td className="py-3 px-4">{sample.brand}</td>
                    <td className="py-3 px-4 text-slate-400">{sample.locationNo || '-'}</td>
                    <td className={`py-3 px-4 font-bold ${statusColor(sample.status)}`}>
                      {sampleStatusLabel(sample.status)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={!canRent}
                          onClick={() => {
                            onRent(sample.code);
                            onNavigateRental();
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-600 text-white disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed"
                        >
                          대여
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(sample.code)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 cursor-pointer"
                          aria-label="보관함에서 제거"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

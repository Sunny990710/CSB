import React, { useMemo, useState } from 'react';
import { Archive } from 'lucide-react';
import { Sample } from '@/types';
import { DEFAULT_FILTERS, filterSamples, statusCounts, uniqueValues } from '../utils/filters';
import SearchFilterBar from './SearchFilterBar';
import SampleCard from './SampleCard';
import SampleDetailModal from './SampleDetailModal';
import SampleListTable from './SampleListTable';
import PageHeader from './PageHeader';

interface UserHomeViewProps {
  samples: Sample[];
  lockerCodes: string[];
  userName: string;
  onToggleLocker: (code: string) => void;
  onNavigateLocker: () => void;
}

export default function UserHomeView({
  samples,
  lockerCodes,
  userName,
  onToggleLocker,
  onNavigateLocker,
}: UserHomeViewProps) {
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [detailSample, setDetailSample] = useState<Sample | null>(null);

  const published = useMemo(() => samples.filter((s) => s.useYn === '사용'), [samples]);
  const filtered = useMemo(() => filterSamples(published, filters), [published, filters]);
  const counts = useMemo(() => statusCounts(published), [published]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`안녕하세요, ${userName} 님`}
        description="마음에 드는 샘플을 내 보관함에 담아두세요."
      />

      <SearchFilterBar
        filters={filters}
        onChange={setFilters}
        brands={uniqueValues(published, 'brand')}
        categories={uniqueValues(published, 'category')}
        countries={uniqueValues(published, 'country')}
        genders={uniqueValues(published, 'gender')}
        seasons={uniqueValues(published, 'season')}
        resultCount={filtered.length}
        statusCounts={counts}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        headerAction={
          <button
            type="button"
            onClick={onNavigateLocker}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs h-9.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer"
          >
            <Archive className="w-4 h-4" />
            <span>내 보관함 ({lockerCodes.length})</span>
          </button>
        }
      />

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200/60">
          조건에 맞는 샘플이 없습니다.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((sample) => (
            <SampleCard
              key={sample.code}
              sample={sample}
              inLocker={lockerCodes.includes(sample.code)}
              onOpen={() => setDetailSample(sample)}
              onToggleLocker={() => onToggleLocker(sample.code)}
            />
          ))}
        </div>
      ) : (
        <SampleListTable
          samples={filtered}
          lockerCodes={lockerCodes}
          onOpenDetail={setDetailSample}
          onToggleLocker={onToggleLocker}
        />
      )}

      {detailSample && (
        <SampleDetailModal
          sample={detailSample}
          allSamples={published}
          inLocker={lockerCodes.includes(detailSample.code)}
          onClose={() => setDetailSample(null)}
          onToggleLocker={() => onToggleLocker(detailSample.code)}
        />
      )}
    </div>
  );
}

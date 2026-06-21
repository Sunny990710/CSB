import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Check, Plus, Shirt, Tag, Camera } from 'lucide-react';
import { Sample, AiTagCategory } from '@/types';
import { StatusBadge } from './StatusChipBar';

const AI_TAG_CATEGORIES: { key: AiTagCategory; label: string }[] = [
  { key: 'fit', label: '핏' },
  { key: 'design', label: '디자인' },
  { key: 'material', label: '소재' },
  { key: 'color', label: '색상' },
  { key: 'style', label: '스타일' },
  { key: 'season', label: '활용 시즌' },
];

function formatFee(sample: Sample): string {
  const n = Number(sample.rentalFee ?? sample.price ?? 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

function formatCountry(country?: string): string {
  if (!country) return '-';
  if (country === 'KR' || country === '한국') return '한국 (KR)';
  if (country === 'CN' || country === '중국') return '중국 (CN)';
  if (country === 'JP' || country === '일본') return '일본 (JP)';
  return country;
}

function matchGender(gender: string | undefined, label: '여성' | '남성' | '공용'): boolean {
  const g = (gender || '').trim();
  if (!g) return label === '공용';
  if (label === '여성') return g === 'F' || /여|female|woman/i.test(g);
  if (label === '남성') return g === 'M' || /남|male|man/i.test(g);
  return g === 'U' || /공용|유니|unisex/i.test(g) || (!/여|남|female|male|woman|man|^f$|^m$/i.test(g));
}

function ReadOnlyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <span className="text-[11px] font-bold text-slate-700">{label}</span>
      <div
        className={`w-full px-3 py-1.5 border border-slate-300 bg-slate-50 rounded-lg text-xs text-slate-800 ${
          mono ? 'font-mono font-bold' : 'font-bold'
        }`}
      >
        {value || '-'}
      </div>
    </div>
  );
}

interface SampleDetailModalProps {
  sample: Sample;
  allSamples: Sample[];
  inLocker: boolean;
  onClose: () => void;
  onToggleLocker: () => void;
}

export default function SampleDetailModal({
  sample,
  allSamples,
  inLocker,
  onClose,
  onToggleLocker,
}: SampleDetailModalProps) {
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const similar = useMemo(() => {
    const tags = new Set(
      Object.values(sample.aiTags || {})
        .flat()
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.toLowerCase())
    );
    return allSamples
      .filter((s) => s.code !== sample.code && s.useYn === '사용')
      .map((s) => {
        let score = 0;
        if (s.category === sample.category) score += 2;
        if (s.brand === sample.brand) score += 2;
        for (const t of Object.values(s.aiTags || {}).flat()) {
          if (typeof t === 'string' && tags.has(t.toLowerCase())) score += 1;
        }
        return { s, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ s }) => s);
  }, [allSamples, sample]);

  const previewSrc =
    previewSide === 'front'
      ? sample.imgFrontClean || sample.imgFront || sample.imgFlat
      : sample.imgBackClean || sample.imgBack;

  const hasRawImg = previewSide === 'front' ? sample.imgFront || sample.imgFlat : sample.imgBack;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sample-detail-title"
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200/90 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <h4 id="sample-detail-title" className="text-sm font-extrabold text-slate-800">
              의류 샘플 상세 정보
            </h4>
            <StatusBadge status={sample.status} />
            <span className="text-[11px] font-mono font-bold text-indigo-600">{sample.code}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 font-sans text-xs">
          {/* 상품 정보 카드 */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white flex flex-col gap-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6">
              {/* 이미지 영역 */}
              <div className="w-full md:w-56 flex flex-col items-center shrink-0">
                <div className="relative w-48 h-60 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center shadow-sm">
                  <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-md text-white font-extrabold text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wide shadow-sm z-20">
                    {previewSide === 'front' ? '전면' : '후면'}
                  </div>
                  {!hasRawImg ? (
                    <div className="flex flex-col items-center gap-2 p-4 text-center text-slate-400">
                      <Camera className="w-8 h-8 text-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        {previewSide === 'front' ? 'NO FRONT IMAGE' : 'NO REAR IMAGE'}
                      </span>
                    </div>
                  ) : previewSrc ? (
                    <img src={previewSrc} alt={sample.name} className="w-full h-full object-cover" />
                  ) : (
                    <Shirt className="w-10 h-10 text-slate-200" strokeWidth={1.2} />
                  )}
                </div>
                <div className="flex gap-2 mt-3 w-48 justify-between">
                  {([
                    { side: 'front' as const, label: '전면' },
                    { side: 'back' as const, label: '후면' },
                  ]).map((item) => {
                    const isActive = previewSide === item.side;
                    return (
                      <button
                        key={item.side}
                        type="button"
                        onClick={() => setPreviewSide(item.side)}
                        className={`text-[10px] font-extrabold py-1.5 flex-1 text-center rounded-lg border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 기본 속성 */}
              <div className="flex-1 space-y-4">
                <ReadOnlyField label="상품명" value={sample.name} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ReadOnlyField label="카테고리" value={sample.category} />
                  <ReadOnlyField label="컨디션" value={sample.condition || '아주 좋음'} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ReadOnlyField label="브랜드" value={sample.brand} />
                  <ReadOnlyField label="특화 브랜드" value={sample.specialBrand || '-'} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ReadOnlyField label="원산지" value={formatCountry(sample.country)} />
                  <div className="flex flex-col gap-1 w-full">
                    <span className="text-[11px] font-bold text-slate-700">상품군</span>
                    <div className="flex gap-2">
                      {(['여성', '남성', '공용'] as const).map((g) => {
                        const isSelected = matchGender(sample.gender, g);
                        return (
                          <span
                            key={g}
                            className={`px-4 py-1.5 rounded-full border text-xs font-bold flex-1 text-center ${
                              isSelected
                                ? 'bg-blue-50 border-blue-400 text-blue-600 font-extrabold shadow-sm'
                                : 'bg-white border-slate-200 text-slate-400'
                            }`}
                          >
                            {g}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {sample.description && (
                  <div className="flex flex-col gap-1 w-full">
                    <span className="text-[11px] font-bold text-slate-700">상품 설명</span>
                    <p className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed">
                      {sample.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* AI 생성 태그 */}
            <div className="pt-5 border-t border-slate-200/70">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                  AI 생성 태그
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                {AI_TAG_CATEGORIES.map(({ key, label }) => {
                  const tags = (sample.aiTags || {})[key] || [];
                  return (
                    <div key={key} className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0 w-[60px] text-[11px] font-bold text-slate-500">{label}</span>
                      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 min-h-[30px]">
                        {tags.length > 0 ? (
                          tags.map((tag, index) => (
                            <span
                              key={`${key}-${tag}-${index}`}
                              className="inline-flex shrink-0 items-center gap-1 bg-white text-slate-700 text-[11px] font-bold py-1 px-2.5 rounded-full border border-slate-200 shadow-sm whitespace-nowrap"
                            >
                              <Tag className="w-3 h-3 text-violet-400" />
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-300 font-medium">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 기타 정보 */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 space-y-4 shadow-sm">
            <span className="text-xs font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-indigo-600 rounded-sm" />
              기타 정보
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ReadOnlyField label="상품코드" value={sample.code} mono />
              <ReadOnlyField label="위치번호" value={sample.locationNo || '-'} mono />
              <ReadOnlyField label="대여 상태" value={sample.status} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-200/60">
              <ReadOnlyField label="대여료 (원)" value={formatFee(sample)} mono />
              <ReadOnlyField
                label="1차연체 금액 (원)"
                value={sample.overdueFee1 != null ? String(sample.overdueFee1) : '-'}
                mono
              />
              <ReadOnlyField
                label="2차연체 금액 (원)"
                value={sample.overdueFee2 != null ? String(sample.overdueFee2) : '-'}
                mono
              />
              <ReadOnlyField
                label="대여기간 (일)"
                value={sample.rentalPeriod != null ? String(sample.rentalPeriod) : '-'}
                mono
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ReadOnlyField label="시즌" value={sample.season || '-'} />
              <ReadOnlyField label="소재" value={sample.material || '-'} />
              <ReadOnlyField label="사이즈" value={sample.size || '-'} />
              <ReadOnlyField label="색상" value={sample.color || '-'} />
            </div>
          </div>

          {/* 비슷한 샘플 */}
          {similar.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                비슷한 샘플
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {similar.map((s) => {
                  const img = s.imgFrontClean || s.imgFront || s.imgFlat;
                  return (
                    <div key={s.code} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <div className="relative w-full aspect-[4/5] bg-slate-50 flex items-center justify-center">
                        {img ? (
                          <img src={img} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <Shirt className="w-8 h-8 text-slate-200" strokeWidth={1.2} />
                        )}
                      </div>
                      <div className="p-2.5 space-y-1">
                        <StatusBadge status={s.status} />
                        <p className="text-[10px] font-mono font-bold text-indigo-600">{s.code}</p>
                        <p className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-snug">{s.name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-white border-t border-slate-100 p-4 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer shadow-sm"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onToggleLocker}
            disabled={sample.status !== '대여가능' && !inLocker}
            className={`inline-flex items-center justify-center gap-2 font-bold px-5 py-2 rounded-lg text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm ${
              inLocker
                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}
          >
            {inLocker ? (
              <>
                <Check className="w-3.5 h-3.5" /> 보관함에 담음
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" /> 보관함에 담기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

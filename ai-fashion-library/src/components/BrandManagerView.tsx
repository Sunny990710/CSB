import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Edit2, Trash2, Search, X, ChevronDown, RotateCcw } from 'lucide-react';
import { Brand } from '../types';

interface BrandManagerViewProps {
  brands: Brand[];
  onSave: (newBrands: Brand[]) => void;
}

const BRAND_CATEGORIES = ['한국', '중국'];

const blankBrand = (): Partial<Brand> => ({
  name: '',
  nameEn: '',
  code: '',
  category: '한국',
  description: '',
  useYn: 'Y',
});

export default function BrandManagerView({ brands, onSave }: BrandManagerViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('전체');
  const [filterUseYn, setFilterUseYn] = useState('전체');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newBrand, setNewBrand] = useState<Partial<Brand>>(blankBrand());
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterCategory('전체');
    setFilterUseYn('전체');
  };

  const filtered = brands.filter((b) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      b.name.toLowerCase().includes(q) ||
      (b.nameEn || '').toLowerCase().includes(q) ||
      (b.code || '').toLowerCase().includes(q) ||
      (b.category || '').toLowerCase().includes(q);
    const matchCategory = filterCategory === '전체' || (b.category || '한국') === filterCategory;
    const matchUseYn = filterUseYn === '전체' || b.useYn === filterUseYn;
    return matchQ && matchCategory && matchUseYn;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand.name) {
      alert('브랜드명은 필수 항목입니다.');
      return;
    }
    const payload: Brand = {
      id: 'B-' + Date.now(),
      name: newBrand.name,
      nameEn: newBrand.nameEn || '',
      code: newBrand.code || '',
      category: newBrand.category || '한국',
      description: newBrand.description || '',
      useYn: (newBrand.useYn as 'Y' | 'N') || 'Y',
    };
    onSave([payload, ...brands]);
    setIsFormOpen(false);
    setNewBrand(blankBrand());
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand) return;
    onSave(brands.map((b) => (b.id === editingBrand.id ? editingBrand : b)));
    setEditingBrand(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('해당 브랜드를 목록에서 삭제하시겠습니까?')) {
      onSave(brands.filter((b) => b.id !== id));
    }
  };

  return (
    <div className="space-y-6" id="brand-manager-container">
      {/* Control bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="브랜드명, 영문명, 코드, 카테고리로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-5 rounded-lg flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            브랜드 등록
          </button>
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

            <div className="relative shrink-0">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
              >
                <option value="전체">카테고리: 전체</option>
                {BRAND_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative shrink-0">
              <select
                value={filterUseYn}
                onChange={(e) => setFilterUseYn(e.target.value)}
                className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
              >
                <option value="전체">사용여부: 전체</option>
                <option value="Y">Y (사용)</option>
                <option value="N">N (미사용)</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <span className="text-[11px] text-slate-400 font-extrabold font-mono uppercase tracking-wide whitespace-nowrap shrink-0 self-end lg:self-center">
            브랜드 수: {filtered.length.toLocaleString()}개
          </span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                <th className="py-3 px-4">브랜드명</th>
                <th className="py-3 px-4">브랜드 영문명</th>
                <th className="py-3 px-4">브랜드 코드</th>
                <th className="py-3 px-4">카테고리</th>
                <th className="py-3 px-4 text-center">사용여부</th>
                <th className="py-3 px-4 text-center">동작</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    등록된 브랜드가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((brand) => (
                  <tr key={brand.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">{brand.name}</td>
                    <td className="py-3 px-4 text-slate-500">{brand.nameEn || '-'}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{brand.code || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                        {brand.category || '한국'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full border ${
                        brand.useYn === 'Y'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {brand.useYn}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center items-center gap-1.5">
                        <button
                          onClick={() => setEditingBrand(brand)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(brand.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Add modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800 text-sm">브랜드 등록</h4>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">브랜드명 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="예: 더데이걸"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={newBrand.name}
                  onChange={(e) => setNewBrand((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">브랜드 영문명</label>
                <input
                  type="text"
                  placeholder="예: THE DAY GIRL"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={newBrand.nameEn}
                  onChange={(e) => setNewBrand((prev) => ({ ...prev, nameEn: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">브랜드 코드</label>
                <input
                  type="text"
                  placeholder="예: TG"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={newBrand.code}
                  onChange={(e) => setNewBrand((prev) => ({ ...prev, code: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">카테고리</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={newBrand.category}
                  onChange={(e) => setNewBrand((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {BRAND_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">사용여부</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={newBrand.useYn}
                  onChange={(e) => setNewBrand((prev) => ({ ...prev, useYn: e.target.value as 'Y' | 'N' }))}
                >
                  <option value="Y">Y (사용)</option>
                  <option value="N">N (미사용)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">설명</label>
                <input
                  type="text"
                  placeholder="브랜드 설명"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={newBrand.description}
                  onChange={(e) => setNewBrand((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="col-span-2 flex gap-3 pt-3 mt-1 border-t border-slate-100 justify-end">
                <button type="button" onClick={() => setIsFormOpen(false)} className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg cursor-pointer">
                  취소
                </button>
                <button type="submit" className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingBrand && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800 text-sm">브랜드 정보 수정</h4>
              <button onClick={() => setEditingBrand(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">브랜드명 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={editingBrand.name}
                  onChange={(e) => setEditingBrand((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">브랜드 영문명</label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={editingBrand.nameEn || ''}
                  onChange={(e) => setEditingBrand((prev) => (prev ? { ...prev, nameEn: e.target.value } : null))}
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">브랜드 코드</label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={editingBrand.code || ''}
                  onChange={(e) => setEditingBrand((prev) => (prev ? { ...prev, code: e.target.value } : null))}
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">카테고리</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={editingBrand.category || '한국'}
                  onChange={(e) => setEditingBrand((prev) => (prev ? { ...prev, category: e.target.value } : null))}
                >
                  {BRAND_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">사용여부</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={editingBrand.useYn}
                  onChange={(e) => setEditingBrand((prev) => (prev ? { ...prev, useYn: e.target.value as 'Y' | 'N' } : null))}
                >
                  <option value="Y">Y (사용)</option>
                  <option value="N">N (미사용)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">설명</label>
                <input
                  type="text"
                  placeholder="브랜드 설명"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={editingBrand.description || ''}
                  onChange={(e) => setEditingBrand((prev) => (prev ? { ...prev, description: e.target.value } : null))}
                />
              </div>
              <div className="col-span-2 flex gap-3 pt-3 mt-1 border-t border-slate-100 justify-end">
                <button type="button" onClick={() => setEditingBrand(null)} className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg cursor-pointer">
                  취소
                </button>
                <button type="submit" className="bg-indigo-600 text-white font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
                  수정 갱신
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

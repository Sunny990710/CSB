import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, Trash2, Check, Tags, Package, RotateCcw, Save, AlertCircle,
  ChevronRight, ChevronDown, FolderTree, List, CornerDownRight, X,
} from 'lucide-react';
import { Category, Sample } from '../types';

interface CategoryManagerViewProps {
  categories: Category[];
  samples: Sample[];
  onSave: (newCategories: Category[], newSamples?: Sample[]) => void;
}

const ROOT = '';
const norm = (p?: string | null) => p || ROOT;

interface FormState {
  id: string | null; // null = 신규
  code: string;
  name: string;
  useYn: '사용' | '미사용';
  parentId: string;
}

const blankForm = (parentId: string = ROOT): FormState => ({
  id: null, code: '', name: '', useYn: '사용', parentId,
});

export default function CategoryManagerView({ categories, samples, onSave }: CategoryManagerViewProps) {
  const [tab, setTab] = useState<'tree' | 'summary'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [error, setError] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);

  const isEditing = form.id !== null;

  // --- Lookups ----------------------------------------------------------
  const byId = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const childrenOf = (parentId: string) =>
    categories.filter((c) => norm(c.parentId) === parentId);

  // Direct sample count per category name
  const directCount = (name: string) => samples.filter((s) => s.category === name).length;

  // Rollup count (self + all descendants) per category id
  const rollupCount = useMemo(() => {
    const map = new Map<string, number>();
    const compute = (cat: Category): number => {
      if (map.has(cat.id)) return map.get(cat.id)!;
      let total = directCount(cat.name);
      childrenOf(cat.id).forEach((child) => {
        total += compute(child);
      });
      map.set(cat.id, total);
      return total;
    };
    categories.forEach(compute);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, samples]);

  // Descendant ids of a node (excludes itself)
  const descendantIds = (id: string): string[] => {
    const out: string[] = [];
    const walk = (pid: string) => {
      childrenOf(pid).forEach((c) => {
        out.push(c.id);
        walk(c.id);
      });
    };
    walk(id);
    return out;
  };

  // Path (breadcrumb) for a node id
  const pathOf = (id: string | null): Category[] => {
    const out: Category[] = [];
    let cur = id ? byId.get(id) : undefined;
    while (cur) {
      out.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return out;
  };

  // --- Search: matching ids + their ancestors ---------------------------
  const matchIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const set = new Set<string>();
    categories.forEach((c) => {
      if (c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) {
        set.add(c.id);
        let p = c.parentId ? byId.get(c.parentId) : undefined;
        while (p) {
          set.add(p.id);
          p = p.parentId ? byId.get(p.parentId) : undefined;
        }
      }
    });
    return set;
  }, [searchQuery, categories, byId]);

  // --- Actions ----------------------------------------------------------
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(categories.map((c) => c.id)));
  const collapseAll = () => setExpanded(new Set());

  // Expand the node and every ancestor so it becomes visible in the tree
  const expandAncestors = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      let cur: Category | undefined = byId.get(id);
      while (cur) {
        next.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      return next;
    });
  };

  // Scroll the newly added/changed node into view and briefly highlight it
  useEffect(() => {
    if (!flashId) return;
    const el = document.getElementById(`cat-node-${flashId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setFlashId(null), 1600);
    return () => clearTimeout(t);
  }, [flashId]);

  const startNewRoot = () => {
    setSelectedId(null);
    setForm(blankForm(ROOT));
    setError('');
  };

  const startNewChild = (parentId: string) => {
    setSelectedId(null);
    setForm(blankForm(parentId));
    setError('');
    setExpanded((prev) => new Set(prev).add(parentId));
  };

  const selectCategory = (cat: Category) => {
    setSelectedId(cat.id);
    setForm({ id: cat.id, code: cat.code, name: cat.name, useYn: cat.useYn, parentId: norm(cat.parentId) });
    setError('');
    // 하위가 있으면 클릭 시 자연스럽게 펼쳐 보여준다
    if (childrenOf(cat.id).length > 0) {
      setExpanded((prev) => new Set(prev).add(cat.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    if (!code) return setError('카테고리 코드를 입력해 주세요.');
    if (!name) return setError('카테고리명을 입력해 주세요.');

    if (isEditing) {
      const original = byId.get(form.id as string);
      if (!original) return;
      if (categories.some((c) => c.id !== form.id && c.code.toUpperCase() === code))
        return setError('이미 사용 중인 카테고리 코드입니다.');
      // Prevent moving under itself or its descendants
      const blocked = new Set([form.id as string, ...descendantIds(form.id as string)]);
      if (form.parentId && blocked.has(form.parentId))
        return setError('자기 자신 또는 하위 카테고리를 상위로 지정할 수 없습니다.');

      const updated = categories.map((c) =>
        c.id === form.id ? { ...c, code, name, useYn: form.useYn, parentId: form.parentId || null } : c
      );
      let updatedSamples: Sample[] | undefined;
      if (original.name !== name) {
        updatedSamples = samples.map((s) => (s.category === original.name ? { ...s, category: name } : s));
      }
      onSave(updated, updatedSamples);
      if (form.parentId) expandAncestors(form.parentId);
      setFlashId(form.id);
    } else {
      if (categories.some((c) => c.code.toUpperCase() === code))
        return setError('이미 사용 중인 카테고리 코드입니다.');
      const newCat: Category = { id: code, code, name, useYn: form.useYn, parentId: form.parentId || null };
      onSave([...categories, newCat]);
      // 상위를 펼쳐 새 하위 노드가 바로 보이도록 하고, 선택 상태로 전환
      if (form.parentId) expandAncestors(form.parentId);
      setSelectedId(newCat.id);
      setForm({ id: newCat.id, code, name, useYn: form.useYn, parentId: form.parentId });
      setFlashId(newCat.id);
    }
  };

  const handleDelete = () => {
    if (!isEditing) return;
    const target = byId.get(form.id as string);
    if (!target) return;
    const descs = descendantIds(target.id);
    const selfCount = directCount(target.name);
    if (descs.length > 0) {
      if (!window.confirm(`'${target.name}' 및 하위 카테고리 ${descs.length}개가 함께 삭제됩니다. 계속할까요?\n(상품의 분류 값 자체는 변경되지 않습니다.)`))
        return;
    } else if (selfCount > 0) {
      if (!window.confirm(`이 카테고리를 사용하는 상품이 ${selfCount}개 있습니다. 삭제해도 상품 분류 값은 유지됩니다. 계속할까요?`))
        return;
    } else if (!window.confirm(`'${target.name}' 카테고리를 삭제하시겠습니까?`)) {
      return;
    }
    const removeIds = new Set([target.id, ...descs]);
    onSave(categories.filter((c) => !removeIds.has(c.id)));
    startNewRoot();
  };

  // Parent options for the form (exclude self + descendants)
  const parentOptions = useMemo(() => {
    const blocked = new Set<string>();
    if (isEditing && form.id) {
      blocked.add(form.id);
      descendantIds(form.id).forEach((id) => blocked.add(id));
    }
    return categories
      .filter((c) => !blocked.has(c.id))
      .map((c) => ({ id: c.id, label: pathOf(c.id).map((p) => p.name).join(' > ') }))
      .sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, form.id, isEditing]);

  // --- Tree rendering ---------------------------------------------------
  const renderNodes = (parentId: string, depth: number): React.ReactNode => {
    const nodes = childrenOf(parentId).filter((c) => !matchIds || matchIds.has(c.id));
    return nodes.map((cat) => {
      const kids = childrenOf(cat.id);
      const hasKids = kids.length > 0;
      const isOpen = matchIds ? true : expanded.has(cat.id);
      const active = selectedId === cat.id;
      const count = rollupCount.get(cat.id) ?? 0;
      const disabled = cat.useYn === '미사용';
      return (
        <div key={cat.id}>
          <div
            id={`cat-node-${cat.id}`}
            className={`group flex items-center gap-1 rounded-lg pr-2 transition-colors cursor-pointer ${
              flashId === cat.id
                ? 'bg-emerald-100 ring-2 ring-emerald-400'
                : active ? 'bg-indigo-50' : 'hover:bg-slate-50'
            }`}
            style={{ paddingLeft: `${depth * 18 + 4}px` }}
            onClick={() => selectCategory(cat)}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (hasKids) toggleExpand(cat.id); }}
              className={`p-1 rounded shrink-0 ${hasKids ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60' : 'text-transparent cursor-default'}`}
              tabIndex={-1}
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            <div className="flex items-center gap-2 min-w-0 flex-1 py-1.5">
              <span className={`font-bold text-sm truncate ${disabled ? 'text-rose-400 line-through' : active ? 'text-indigo-800' : 'text-slate-700'}`}>
                {cat.name}
              </span>
              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{cat.code}</span>
            </div>

            <span className="text-[11px] font-mono text-slate-500 shrink-0 flex items-center gap-1">
              <Package className="w-3 h-3 text-slate-300" />
              {count}
            </span>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); startNewChild(cat.id); }}
              className="p-1 rounded text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="하위 카테고리 추가"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {hasKids && isOpen && renderNodes(cat.id, depth + 1)}
        </div>
      );
    });
  };

  const rootNodes = childrenOf(ROOT);
  const breadcrumb = isEditing ? pathOf(form.id) : form.parentId ? pathOf(form.parentId) : [];

  return (
    <div className="space-y-6" id="category-manager-root">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTab('tree')}
          className={`py-3.5 px-6 font-semibold text-xs flex items-center gap-2 border-b-2 font-sans relative transition-all ${
            tab === 'tree' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>트리 관리</span>
        </button>
        <button
          onClick={() => setTab('summary')}
          className={`py-3.5 px-6 font-semibold text-xs flex items-center gap-2 border-b-2 font-sans relative transition-all ${
            tab === 'summary' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <List className="w-4 h-4" />
          <span>보유현황 요약</span>
        </button>
      </div>

      {tab === 'tree' ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: tree */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="카테고리명 또는 코드 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={expandAll} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">전체 펼침</button>
                <button onClick={collapseAll} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">접기</button>
                <button onClick={startNewRoot} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />최상위
                </button>
              </div>
            </div>

            <div className="p-2 overflow-y-auto max-h-[560px] min-h-[300px]">
              {rootNodes.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs">등록된 카테고리가 없습니다.</div>
              ) : matchIds && matchIds.size === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs">검색 결과가 없습니다.</div>
              ) : (
                renderNodes(ROOT, 0)
              )}
            </div>
          </div>

          {/* Right: editor */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-fit">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Tags className="w-4 h-4 text-indigo-500" />
                {isEditing ? '카테고리 수정' : '새 카테고리'}
              </h3>
              {isEditing && (
                <button onClick={startNewRoot} className="text-[11px] text-slate-400 hover:text-slate-700 font-semibold flex items-center gap-1 cursor-pointer">
                  <RotateCcw className="w-3 h-3" />초기화
                </button>
              )}
            </div>

            {breadcrumb.length > 0 && (
              <div className="px-5 pt-3 flex items-center gap-1 flex-wrap text-[11px] text-slate-400 font-medium">
                {breadcrumb.map((b, i) => (
                  <span key={b.id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3" />}
                    <span className={i === breadcrumb.length - 1 && isEditing ? 'text-slate-700 font-bold' : ''}>{b.name}</span>
                  </span>
                ))}
                {!isEditing && (
                  <span className="flex items-center gap-1 text-indigo-500">
                    <ChevronRight className="w-3 h-3" /><CornerDownRight className="w-3 h-3" /> 새 하위
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">상위 카테고리</label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
                  className="w-full p-2.5 border border-slate-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="">— 최상위 —</option>
                  {parentOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <label className="text-xs font-bold text-slate-600">코드 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                    placeholder="J2"
                    className="w-full p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-slate-600">카테고리명 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="자켓"
                    className="w-full p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">사용여부</label>
                <div className="flex gap-2">
                  {(['사용', '미사용'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, useYn: v }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        form.useYn === v
                          ? v === '사용' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-700 text-white border-slate-700'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {form.useYn === v && <Check className="w-3.5 h-3.5" />}{v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                {isEditing && (
                  <>
                    <button type="button" onClick={handleDelete} className="px-3 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />삭제
                    </button>
                    <button type="button" onClick={() => startNewChild(form.id as string)} className="px-3 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />하위추가
                    </button>
                  </>
                )}
                <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer">
                  {isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {isEditing ? '수정 저장' : '카테고리 추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* ===== 보유현황 요약 ===== */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white text-xs font-bold">
                  <th className="py-3 px-5 text-left w-44">카테고리</th>
                  <th className="py-3 px-5 text-left">보유현황</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rootNodes.length === 0 ? (
                  <tr><td colSpan={2} className="py-16 text-center text-slate-400 text-xs">등록된 카테고리가 없습니다.</td></tr>
                ) : (
                  rootNodes.map((root) => {
                    const kids = childrenOf(root.id);
                    const total = rollupCount.get(root.id) ?? 0;
                    return (
                      <tr key={root.id} className="hover:bg-slate-50/60">
                        <td className="py-3.5 px-5 align-top">
                          <button
                            onClick={() => { setTab('tree'); selectCategory(root); }}
                            className="font-bold text-slate-800 hover:text-indigo-600 text-sm cursor-pointer text-left"
                          >
                            {root.name}
                          </button>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">합계 {total.toLocaleString()}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          {kids.length === 0 ? (
                            <span className="text-xs text-slate-500 font-semibold">{root.name} {directCount(root.name).toLocaleString()}</span>
                          ) : (
                            <div className="flex flex-wrap gap-x-3 gap-y-1.5 items-center text-xs">
                              {kids.map((k, i) => (
                                <span key={k.id} className="flex items-center gap-1">
                                  {i > 0 && <span className="text-slate-200">|</span>}
                                  <button
                                    onClick={() => { setTab('tree'); selectCategory(k); }}
                                    className={`font-bold hover:text-indigo-600 cursor-pointer ${k.useYn === '미사용' ? 'text-rose-300 line-through' : 'text-slate-700'}`}
                                  >
                                    {k.name}
                                  </button>
                                  <span className="text-slate-400 font-mono text-[11px]">{(rollupCount.get(k.id) ?? 0).toLocaleString()}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

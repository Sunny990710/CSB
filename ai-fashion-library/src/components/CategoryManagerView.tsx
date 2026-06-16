import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, Trash2, Check, Tags, Package, Save, AlertCircle,
  ChevronRight, Minus, CornerDownRight, X, GripVertical, CornerLeftUp, Pencil,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [error, setError] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Drag & drop (트리 내 카테고리 이동)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);

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

  // 선택(펼친)된 카테고리 자신과 그 상위(조상) id 집합 — 볼드체로 강조
  const ancestorIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId) return set;
    let cur = byId.get(selectedId);
    while (cur) {
      set.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return set;
  }, [selectedId, byId]);

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
      // 이미 열려 있으면: 자신과 하위 모두 접기
      if (prev.has(id)) {
        const next = new Set(prev);
        next.delete(id);
        descendantIds(id).forEach((d) => next.delete(d));
        return next;
      }
      // 새로 열 때: 해당 노드의 경로(조상+자신)만 펼치고 나머지는 접는다 (아코디언)
      const open = new Set<string>();
      let cur: Category | undefined = byId.get(id);
      while (cur) {
        open.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      return open;
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

  const resetForm = () => {
    setSelectedId(null);
    setForm(blankForm(ROOT));
    setError('');
  };

  const closeModal = () => {
    setModalOpen(false);
    setError('');
  };

  const startNewRoot = () => {
    setSelectedId(null);
    setForm(blankForm(ROOT));
    setError('');
    setModalOpen(true);
  };

  const startNewChild = (parentId: string) => {
    setSelectedId(null);
    setForm(blankForm(parentId));
    setError('');
    setExpanded((prev) => new Set(prev).add(parentId));
    setModalOpen(true);
  };

  const selectCategory = (cat: Category) => {
    setSelectedId(cat.id);
    setForm({ id: cat.id, code: cat.code, name: cat.name, useYn: cat.useYn, parentId: norm(cat.parentId) });
    setError('');
    setModalOpen(true);
  };

  // 트리에서 노드 선택 + 펼침/접힘 토글 (편집 모달 없이)
  const handleRowClick = (cat: Category) => {
    setSelectedId(cat.id);
    if (childrenOf(cat.id).length > 0) toggleExpand(cat.id);
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
      setSelectedId(form.id);
      setFlashId(form.id);
      closeModal();
    } else {
      if (categories.some((c) => c.code.toUpperCase() === code))
        return setError('이미 사용 중인 카테고리 코드입니다.');
      const newCat: Category = { id: code, code, name, useYn: form.useYn, parentId: form.parentId || null };
      onSave([...categories, newCat]);
      // 상위를 펼쳐 새 노드가 바로 보이도록 하고, 잠깐 강조
      if (form.parentId) expandAncestors(form.parentId);
      setSelectedId(newCat.id);
      setFlashId(newCat.id);
      closeModal();
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
    resetForm();
    closeModal();
  };

  // 드롭 대상이 유효한지(자기 자신/하위로는 이동 불가)
  const canDropOn = (dragId: string | null, targetId: string): boolean => {
    if (!dragId || dragId === targetId) return false;
    const blocked = new Set([dragId, ...descendantIds(dragId)]);
    return !blocked.has(targetId);
  };

  // 카테고리를 새 상위(targetParentId, ''=최상위)로 이동
  const moveCategory = (dragId: string, targetParentId: string) => {
    const dragged = byId.get(dragId);
    if (!dragged) return;
    if (targetParentId && !canDropOn(dragId, targetParentId)) return;
    if (norm(dragged.parentId) === targetParentId) return; // 변동 없음
    const updated = categories.map((c) =>
      c.id === dragId ? { ...c, parentId: targetParentId || null } : c
    );
    onSave(updated);
    if (targetParentId) expandAncestors(targetParentId);
    setSelectedId(dragId);
    setForm((p) => (p.id === dragId ? { ...p, parentId: targetParentId } : p));
    setFlashId(dragId);
  };

  const clearDrag = () => {
    setDraggingId(null);
    setDragOverId(null);
    setDragOverRoot(false);
  };

  // 상위 카테고리 선택 시 제외할 id (자기 자신 + 하위)
  const blockedParentIds = useMemo(() => {
    const blocked = new Set<string>();
    if (isEditing && form.id) {
      blocked.add(form.id);
      descendantIds(form.id).forEach((id) => blocked.add(id));
    }
    return blocked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, form.id, isEditing]);

  // 단계별(캐스케이딩) 상위 카테고리 선택 — 각 단계의 선택지/현재값 계산
  const parentLevels = useMemo(() => {
    const path = form.parentId ? pathOf(form.parentId) : [];
    const levels: { options: Category[]; value: string }[] = [];
    levels.push({ options: childrenOf(ROOT), value: path[0]?.id ?? '' });
    for (let i = 0; i < path.length; i++) {
      const kids = childrenOf(path[i].id);
      if (kids.length > 0) {
        levels.push({ options: kids, value: path[i + 1]?.id ?? '' });
      }
    }
    return levels;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.parentId, categories]);

  // 특정 단계에서 값이 바뀌면 그 노드를 상위로 지정(빈 값이면 이전 단계 노드/최상위로)
  const handleParentLevelChange = (levelIdx: number, value: string) => {
    if (value) {
      setForm((p) => ({ ...p, parentId: value }));
      return;
    }
    if (levelIdx === 0) {
      setForm((p) => ({ ...p, parentId: '' }));
      return;
    }
    const path = form.parentId ? pathOf(form.parentId) : [];
    const prev = path[levelIdx - 1];
    setForm((p) => ({ ...p, parentId: prev ? prev.id : '' }));
  };

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
      const isDragTarget = dragOverId === cat.id && canDropOn(draggingId, cat.id);
      const isDragging = draggingId === cat.id;
      return (
        <div key={cat.id}>
          <div
            id={`cat-node-${cat.id}`}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = 'move';
              try { e.dataTransfer.setData('text/plain', cat.id); } catch { /* noop */ }
              // 드래그 시작 직후 DOM이 바뀌면(상단 드롭존 삽입 등) 브라우저가 드래그를
              // 취소할 수 있으므로 상태 변경을 다음 프레임으로 미룬다.
              const id = cat.id;
              requestAnimationFrame(() => setDraggingId(id));
            }}
            onDragEnd={clearDrag}
            onDragEnter={(e) => {
              if (!canDropOn(draggingId, cat.id)) return;
              e.preventDefault();
              e.stopPropagation();
              if (dragOverId !== cat.id) setDragOverId(cat.id);
            }}
            onDragOver={(e) => {
              if (!canDropOn(draggingId, cat.id)) return;
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverId !== cat.id) setDragOverId(cat.id);
            }}
            onDragLeave={() => setDragOverId((prev) => (prev === cat.id ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggingId) moveCategory(draggingId, cat.id);
              clearDrag();
            }}
            className={`group flex items-center gap-1 rounded-lg pr-2 transition-colors cursor-pointer select-none ${
              isDragging ? 'opacity-40' : ''
            } ${
              isDragTarget
                ? 'bg-indigo-50 ring-2 ring-indigo-400'
                : flashId === cat.id
                  ? 'bg-emerald-100 ring-2 ring-emerald-400'
                  : active ? 'bg-indigo-50' : 'hover:bg-slate-50'
            }`}
            style={{ paddingLeft: `${depth * 18 + 4}px` }}
            onClick={() => handleRowClick(cat)}
          >
            <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 shrink-0 cursor-grab active:cursor-grabbing" />

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelectedId(cat.id); if (hasKids) toggleExpand(cat.id); }}
              className={`shrink-0 w-4 h-4 flex items-center justify-center rounded-[3px] border transition-colors ${
                hasKids
                  ? 'border-slate-300 text-slate-500 hover:bg-slate-100 hover:border-slate-400 cursor-pointer'
                  : 'border-transparent text-transparent cursor-default'
              }`}
              tabIndex={-1}
              title={hasKids ? (isOpen ? '접기' : '펼치기') : undefined}
            >
              {hasKids && (isOpen ? <Minus className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />)}
            </button>

            <div className="flex items-center gap-2 min-w-0 flex-1 py-1.5">
              <span className={`text-sm truncate ${depth === 0 || ancestorIds.has(cat.id) ? 'font-bold' : 'font-normal'} ${disabled ? 'text-rose-400 line-through' : active ? 'text-indigo-800' : 'text-slate-700'}`}>
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
              onClick={(e) => { e.stopPropagation(); selectCategory(cat); }}
              className="p-1 rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
              title="카테고리 편집"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); startNewChild(cat.id); }}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[11px] font-semibold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
              title="하위 카테고리 추가"
            >
              <Plus className="w-3.5 h-3.5" /> 하위
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
      <div>
          {/* 트리 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
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

            <div className="px-3 py-1.5 border-b border-slate-50 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
              <GripVertical className="w-3 h-3" />
              항목을 끌어다 다른 카테고리 위에 놓으면 하위로 이동합니다.
            </div>

            <div className="p-2 overflow-y-auto max-h-[560px] min-h-[300px]">
              {draggingId && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOverRoot(true); }}
                  onDragLeave={() => setDragOverRoot(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingId) moveCategory(draggingId, ROOT);
                    clearDrag();
                  }}
                  className={`mb-2 border-2 border-dashed rounded-lg py-2 flex items-center justify-center gap-1.5 text-[11px] font-bold transition-colors ${
                    dragOverRoot ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-400'
                  }`}
                >
                  <CornerLeftUp className="w-3.5 h-3.5" />
                  최상위로 이동 (여기에 놓기)
                </div>
              )}

              {rootNodes.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs">등록된 카테고리가 없습니다.</div>
              ) : matchIds && matchIds.size === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs">검색 결과가 없습니다.</div>
              ) : (
                renderNodes(ROOT, 0)
              )}
            </div>
          </div>
        </div>

      {/* ===== 카테고리 추가/수정 모달 ===== */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-100 px-5 py-4">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Tags className="w-4 h-4 text-indigo-500" />
                {isEditing ? '카테고리 수정' : '새 카테고리'}
              </h4>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
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
                <div className="space-y-2">
                  {parentLevels.map((lvl, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="shrink-0 text-[10px] font-bold text-slate-400 w-9">{idx + 1}단계</span>
                      <select
                        value={lvl.value}
                        onChange={(e) => handleParentLevelChange(idx, e.target.value)}
                        className="flex-1 p-2.5 border border-slate-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      >
                        <option value="">{idx === 0 ? '— 최상위 —' : '— 선택 안 함 —'}</option>
                        {lvl.options
                          .filter((o) => !blockedParentIds.has(o.id))
                          .map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  선택한 위치: {form.parentId ? pathOf(form.parentId).map((p) => p.name).join(' > ') : '최상위'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <label className="text-xs font-bold text-slate-600">코드 <span className="text-rose-500">*</span></label>
                  <input
                    autoFocus={!isEditing}
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
      )}
    </div>
  );
}

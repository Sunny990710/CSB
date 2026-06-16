import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Search, Plus, Trash2, Edit2, X, ChevronRight, ChevronDown, RotateCcw,
  Folder, FolderPlus, FolderOpen, FileText, FileImage, FileArchive, File, Link2, ExternalLink, Library, Upload,
  LayoutGrid, List as ListIcon, ArrowDownUp,
} from 'lucide-react';
import { ContentNode } from '../types';
import { DateRangeCalendar } from './DateRangeCalendar';

interface ContentRepositoryViewProps {
  contents: ContentNode[];
  onSave: (newContents: ContentNode[]) => void;
}

const ROOT = '';
const ROOT_LABEL_ID = '__root__'; // 최상위 표시 이름을 저장하는 특수 노드
const DEFAULT_ROOT_LABEL = '전체 (최상위)';
const norm = (p?: string | null) => p || ROOT;
const ITEM_TYPES = ['도서', '연구자료', '문서', '링크', '기타'];

const nowStr = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

// 자료의 확장자/유형으로 표시할 아이콘과 색상 결정
const iconForItem = (item: ContentNode): { Icon: typeof File; color: string } => {
  const basis = item.fileName || item.name;
  const ext = (basis.split('.').pop() || '').toLowerCase();
  const hasExt = basis.includes('.');
  if ((item.fileType || '').startsWith('image/')) return { Icon: FileImage, color: 'text-violet-500' };
  if (!item.fileData && (item.itemType === '링크' || (!hasExt && item.url))) return { Icon: Link2, color: 'text-sky-500' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { Icon: FileArchive, color: 'text-amber-500' };
  if (['psd', 'ai', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tif'].includes(ext)) return { Icon: FileImage, color: 'text-violet-500' };
  if (['doc', 'docx', 'pdf', 'txt', 'hwp', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'].includes(ext)) return { Icon: FileText, color: 'text-blue-500' };
  return { Icon: File, color: 'text-slate-400' };
};

interface ItemForm {
  id: string | null;
  name: string;
  itemType: string;
  author: string;
  url: string;
  fileData: string;
  fileName: string;
  fileType: string;
  description: string;
  folderId: string; // 자료가 속한 폴더 ('' = 최상위)
}

const blankItemForm = (folderId: string = ''): ItemForm => ({
  id: null, name: '', itemType: '도서', author: '', url: '', fileData: '', fileName: '', fileType: '', description: '', folderId,
});

const MAX_FILE_MB = 15;

export default function ContentRepositoryView({ contents, onSave }: ContentRepositoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string>(ROOT);

  // 보기 모드 / 필터
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc'); // 등록일 정렬
  const [filterType, setFilterType] = useState('전체');
  const [regFrom, setRegFrom] = useState('');
  const [regTo, setRegTo] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const [datePopoverPos, setDatePopoverPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!dateOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dateFilterRef.current?.contains(target) || datePopoverRef.current?.contains(target)) return;
      setDateOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dateOpen]);

  useEffect(() => {
    if (!dateOpen) return;
    const updatePos = () => {
      if (!dateFilterRef.current) return;
      const rect = dateFilterRef.current.getBoundingClientRect();
      const popoverWidth = 560;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) left = Math.max(16, window.innerWidth - popoverWidth - 16);
      setDatePopoverPos({ top: rect.bottom + 4, left });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [dateOpen]);

  const dateFilterLabel =
    !regFrom && !regTo
      ? '등록일: 전체'
      : regFrom && regTo && regFrom === regTo
        ? `등록일: ${regFrom}`
        : `등록일: ${regFrom || '…'} ~ ${regTo || '…'}`;

  const resetFilters = () => {
    setSearchQuery('');
    setFilterType('전체');
    setRegFrom('');
    setRegTo('');
    setDateOpen(false);
  };

  // 폴더 추가/이름변경 모달
  const [folderModal, setFolderModal] = useState<{ id: string | null; parentId: string; name: string } | null>(null);
  // 자료 추가/수정 모달
  const [itemModal, setItemModal] = useState<ItemForm | null>(null);

  const folders = useMemo(() => contents.filter((c) => c.type === 'folder' && c.id !== ROOT_LABEL_ID), [contents]);
  const items = useMemo(() => contents.filter((c) => c.type === 'item'), [contents]);

  const rootLabel = contents.find((c) => c.id === ROOT_LABEL_ID)?.name || DEFAULT_ROOT_LABEL;

  const foldersOf = (parentId: string) => folders.filter((f) => norm(f.parentId) === parentId);
  const itemsOf = (parentId: string) => items.filter((i) => norm(i.parentId) === parentId);

  const byId = useMemo(() => {
    const m = new Map<string, ContentNode>();
    contents.forEach((c) => m.set(c.id, c));
    return m;
  }, [contents]);

  const pathOf = (id: string): ContentNode[] => {
    const out: ContentNode[] = [];
    let cur: ContentNode | undefined = byId.get(id);
    while (cur) {
      out.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return out;
  };

  // 폴더 위치 선택 옵션 (전체 경로 라벨)
  const folderPathLabel = (id: string) => pathOf(id).map((f) => f.name).join(' > ');
  const folderOptions = useMemo(
    () =>
      folders
        .map((f) => ({ id: f.id, label: folderPathLabel(f.id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folders]
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 선택된 폴더의 자료 (검색/유형/등록일 필터 적용)
  const visibleItems = itemsOf(selectedFolderId).filter((i) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      !q ||
      i.name.toLowerCase().includes(q) ||
      (i.author || '').toLowerCase().includes(q) ||
      (i.itemType || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q);
    const matchType = filterType === '전체' || (i.itemType || '') === filterType;
    const day = (i.createdAt || '').substring(0, 10);
    const matchFrom = !regFrom || (!!day && day >= regFrom);
    const matchTo = !regTo || (!!day && day <= regTo);
    return matchQ && matchType && matchFrom && matchTo;
  });

  // 등록일 정렬 (desc = 최신순)
  const sortedItems = [...visibleItems].sort((a, b) => {
    const da = a.createdAt || '';
    const db = b.createdAt || '';
    return sortDir === 'desc' ? db.localeCompare(da) : da.localeCompare(db);
  });

  // --- 폴더 CRUD ---
  const submitFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderModal) return;
    const name = folderModal.name.trim();
    if (!name) return;
    if (folderModal.id) {
      const exists = contents.some((c) => c.id === folderModal.id);
      if (exists) {
        onSave(contents.map((c) => (c.id === folderModal.id ? { ...c, name } : c)));
      } else {
        // 최상위 라벨 등 고정 id 노드를 최초로 생성
        onSave([
          ...contents,
          { id: folderModal.id, name, type: 'folder', parentId: folderModal.parentId || null, createdAt: nowStr() },
        ]);
      }
    } else {
      const newFolder: ContentNode = {
        id: 'F-' + Date.now(),
        name,
        type: 'folder',
        parentId: folderModal.parentId || null,
        createdAt: nowStr(),
      };
      onSave([...contents, newFolder]);
      if (folderModal.parentId) setExpanded((prev) => new Set(prev).add(folderModal.parentId));
    }
    setFolderModal(null);
  };

  const deleteFolder = (id: string) => {
    // 하위 폴더/자료 전부 수집
    const removeIds = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      contents.forEach((c) => {
        if (c.parentId && removeIds.has(c.parentId) && !removeIds.has(c.id)) {
          removeIds.add(c.id);
          changed = true;
        }
      });
    }
    const folderCnt = [...removeIds].filter((rid) => byId.get(rid)?.type === 'folder').length;
    const itemCnt = removeIds.size - folderCnt;
    if (!window.confirm(`'${byId.get(id)?.name}' 폴더와 하위 폴더 ${folderCnt - 1}개, 자료 ${itemCnt}개가 삭제됩니다. 계속할까요?`)) return;
    onSave(contents.filter((c) => !removeIds.has(c.id)));
    if (removeIds.has(selectedFolderId)) setSelectedFolderId(ROOT);
  };

  // 파일 업로드 → base64 data URL 로 읽어 폼에 저장
  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`파일이 너무 큽니다. ${MAX_FILE_MB}MB 이하 파일만 업로드할 수 있습니다.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setItemModal((p) =>
        p
          ? {
              ...p,
              fileData: dataUrl,
              fileName: file.name,
              fileType: file.type,
              name: p.name.trim() ? p.name : file.name,
            }
          : p
      );
    };
    reader.readAsDataURL(file);
  };

  // --- 자료 CRUD ---
  const submitItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemModal) return;
    const name = itemModal.name.trim();
    if (!name) return;
    if (itemModal.id) {
      onSave(
        contents.map((c) =>
          c.id === itemModal.id
            ? { ...c, name, parentId: itemModal.folderId || null, itemType: itemModal.itemType, author: itemModal.author, url: itemModal.url, fileData: itemModal.fileData || undefined, fileName: itemModal.fileName || undefined, fileType: itemModal.fileType || undefined, description: itemModal.description }
            : c
        )
      );
    } else {
      const newItem: ContentNode = {
        id: 'I-' + Date.now(),
        name,
        type: 'item',
        parentId: itemModal.folderId || null,
        itemType: itemModal.itemType,
        author: itemModal.author,
        url: itemModal.url,
        fileData: itemModal.fileData || undefined,
        fileName: itemModal.fileName || undefined,
        fileType: itemModal.fileType || undefined,
        description: itemModal.description,
        createdAt: nowStr(),
      };
      onSave([...contents, newItem]);
    }
    setItemModal(null);
  };

  const deleteItem = (id: string) => {
    if (!window.confirm('해당 자료를 삭제하시겠습니까?')) return;
    onSave(contents.filter((c) => c.id !== id));
  };

  // --- 폴더 트리 렌더 ---
  const renderFolders = (parentId: string, depth: number): React.ReactNode => {
    return foldersOf(parentId).map((folder) => {
      const kids = foldersOf(folder.id);
      const hasKids = kids.length > 0;
      const isOpen = expanded.has(folder.id);
      const active = selectedFolderId === folder.id;
      const count = itemsOf(folder.id).length;
      return (
        <div key={folder.id}>
          <div
            className={`group flex items-center gap-1 rounded-lg pr-2 transition-colors cursor-pointer ${
              active ? 'bg-indigo-50' : 'hover:bg-slate-50'
            }`}
            style={{ paddingLeft: `${depth * 16 + 4}px` }}
            onClick={() => { setSelectedFolderId(folder.id); if (hasKids) setExpanded((prev) => new Set(prev).add(folder.id)); }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (hasKids) toggleExpand(folder.id); }}
              className={`p-1 rounded shrink-0 ${hasKids ? 'text-slate-400 hover:text-slate-700' : 'text-transparent cursor-default'}`}
              tabIndex={-1}
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {active ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" /> : <Folder className="w-4 h-4 text-amber-400 shrink-0" />}

            <span className={`flex-1 min-w-0 truncate py-1.5 text-sm font-bold ${active ? 'text-indigo-800' : 'text-slate-700'}`}>
              {folder.name}
            </span>
            <span className="text-[10px] font-mono text-slate-400 shrink-0">{count}</span>

            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" onClick={(e) => { e.stopPropagation(); setFolderModal({ id: null, parentId: folder.id, name: '' }); }} className="p-1 rounded text-slate-300 hover:text-indigo-600 hover:bg-indigo-50" title="하위 폴더 추가">
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFolderModal({ id: folder.id, parentId: norm(folder.parentId), name: folder.name }); }} className="p-1 rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50" title="이름 변경">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }} className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50" title="삭제">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {hasKids && isOpen && renderFolders(folder.id, depth + 1)}
        </div>
      );
    });
  };

  const breadcrumb = selectedFolderId ? pathOf(selectedFolderId) : [];

  return (
    <div className="space-y-6" id="content-repository-root">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: folder tree */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[640px]">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Library className="w-4 h-4 text-indigo-500" />
              콘텐츠 저장소
            </h3>
            <button
              onClick={() => setFolderModal({ id: null, parentId: ROOT, name: '' })}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />폴더 추가
            </button>
          </div>

          <div className="p-2 overflow-y-auto flex-1">
            {/* 전체(루트) */}
            <div
              className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer mb-1 ${selectedFolderId === ROOT ? 'bg-indigo-50 text-indigo-800' : 'hover:bg-slate-50 text-slate-700'}`}
              onClick={() => setSelectedFolderId(ROOT)}
            >
              <Library className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-bold flex-1 min-w-0 truncate">{rootLabel}</span>
              <span className="text-[10px] font-mono text-slate-400 shrink-0">{itemsOf(ROOT).length}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFolderModal({ id: ROOT_LABEL_ID, parentId: ROOT, name: rootLabel }); }}
                className="p-1 rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                title="최상위 이름 변경"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {foldersOf(ROOT).length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">폴더가 없습니다. ‘폴더 추가’로 시작하세요.</div>
            ) : (
              renderFolders(ROOT, 0)
            )}
          </div>
        </div>

        {/* Right: items in selected folder */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[640px]">
          <div className="p-3 space-y-2.5">
            <div className="flex items-center gap-1 flex-wrap text-[11px] text-slate-400 font-medium min-h-[18px]">
              <span className={breadcrumb.length === 0 ? 'text-slate-700 font-bold' : ''}>전체</span>
              {breadcrumb.map((b) => (
                <span key={b.id} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-slate-700 font-bold">{b.name}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="자료명, 저자, 유형, 설명 검색..."
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

              {/* 보기 모드 토글 */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  title="카드형"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  title="표형"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setItemModal(blankItemForm(selectedFolderId))}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />자료 추가
              </button>
            </div>

            {/* 필터 칩 */}
            <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100">
              <button
                onClick={resetFilters}
                className="bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs font-bold py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-white" />
                <span>필터 초기화</span>
              </button>

              <div className="relative shrink-0">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                >
                  <option value="전체">유형: 전체</option>
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative shrink-0" ref={dateFilterRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (dateOpen) { setDateOpen(false); return; }
                    if (dateFilterRef.current) {
                      const rect = dateFilterRef.current.getBoundingClientRect();
                      const popoverWidth = 560;
                      let left = rect.left;
                      if (left + popoverWidth > window.innerWidth - 16) left = Math.max(16, window.innerWidth - popoverWidth - 16);
                      setDatePopoverPos({ top: rect.bottom + 4, left });
                    }
                    setDateOpen(true);
                  }}
                  className={`bg-white hover:bg-slate-50 border pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none transition-colors cursor-pointer whitespace-nowrap ${dateOpen ? 'border-violet-500' : 'border-slate-200'}`}
                >
                  {dateFilterLabel}
                </button>
                <ChevronDown className={`absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none transition-transform ${dateOpen ? 'rotate-180' : ''}`} />
              </div>

              {dateOpen && createPortal(
                <div ref={datePopoverRef} className="fixed z-[9999]" style={{ top: datePopoverPos.top, left: datePopoverPos.left }}>
                  <DateRangeCalendar
                    initialFrom={regFrom}
                    initialTo={regTo}
                    onConfirm={(from, to) => { setRegFrom(from); setRegTo(to); setDateOpen(false); }}
                    onCancel={() => setDateOpen(false)}
                  />
                </div>,
                document.body
              )}

              <span className="text-[11px] text-slate-400 font-extrabold font-mono uppercase tracking-wide whitespace-nowrap ml-auto">
                자료 {visibleItems.length.toLocaleString()}건
              </span>
            </div>
          </div>

          {/* 정렬 (필터와 분리) */}
          <div className="px-3 pb-2 flex items-center justify-end">
            <button
              onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="등록일 정렬"
            >
              <ArrowDownUp className="w-3.5 h-3.5 text-slate-400" />
              등록일 {sortDir === 'desc' ? '최신순' : '오래된순'}
            </button>
          </div>

          <div className="px-3 pb-3 overflow-y-auto flex-1">
            {visibleItems.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                {searchQuery ? '검색 결과가 없습니다.' : '이 폴더에 등록된 자료가 없습니다.'}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))' }}>
                {sortedItems.map((item) => {
                  const { Icon, color } = iconForItem(item);
                  const openTarget = item.fileData || item.url;
                  const toForm = (): ItemForm => ({ id: item.id, name: item.name, itemType: item.itemType || '도서', author: item.author || '', url: item.url || '', fileData: item.fileData || '', fileName: item.fileName || '', fileType: item.fileType || '', description: item.description || '', folderId: norm(item.parentId) });
                  const openItem = () => {
                    if (openTarget) window.open(openTarget, '_blank', 'noopener,noreferrer');
                    else setItemModal(toForm());
                  };
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onDoubleClick={openItem}
                      className="group relative flex flex-col items-center text-center px-1.5 py-2.5 rounded-lg hover:bg-indigo-50/60 border border-transparent hover:border-indigo-100 cursor-pointer transition-colors"
                      title={`${item.name}${item.description ? '\n' + item.description : ''}`}
                    >
                      {/* Hover actions */}
                      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-md shadow-sm">
                        {openTarget && (
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(openTarget, '_blank', 'noopener,noreferrer'); }}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                            title="열기"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setItemModal(toForm()); }}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                          title="수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <Icon className={`w-11 h-11 ${color}`} strokeWidth={1.5} />
                      <span className="mt-1.5 text-[11px] font-medium text-slate-700 leading-tight break-all line-clamp-2 w-full">
                        {item.name}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">자료명</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">유형</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">저자/출처</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">등록일</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {sortedItems.map((item) => {
                    const { Icon, color } = iconForItem(item);
                    const openTarget = item.fileData || item.url;
                    const toForm = (): ItemForm => ({ id: item.id, name: item.name, itemType: item.itemType || '도서', author: item.author || '', url: item.url || '', fileData: item.fileData || '', fileName: item.fileName || '', fileType: item.fileType || '', description: item.description || '', folderId: norm(item.parentId) });
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 ${color}`} strokeWidth={1.6} />
                            <span className="font-bold text-slate-800 truncate" title={item.name}>{item.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {item.itemType && <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{item.itemType}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{item.author || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">{(item.createdAt || '').substring(0, 10) || '-'}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1">
                            {openTarget && (
                              <button onClick={() => window.open(openTarget, '_blank', 'noopener,noreferrer')} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer" title="열기">
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => setItemModal(toForm())} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer" title="수정">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteItem(item.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer" title="삭제">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 폴더 모달 */}
      {folderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800 text-sm">{folderModal.id ? '폴더 이름 변경' : '새 폴더'}</h4>
              <button onClick={() => setFolderModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={submitFolder} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">폴더명 <span className="text-rose-500">*</span></label>
                <input
                  autoFocus
                  type="text"
                  value={folderModal.name}
                  onChange={(e) => setFolderModal((p) => (p ? { ...p, name: e.target.value } : p))}
                  placeholder="예: A. 글로벌 마켓 트렌드"
                  className="w-full p-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setFolderModal(null)} className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer">취소</button>
                <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer">{folderModal.id ? '저장' : '생성'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 자료 모달 */}
      {itemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800 text-sm">{itemModal.id ? '자료 수정' : '자료 추가'}</h4>
              <button onClick={() => setItemModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={submitItem} className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
              <div className="space-y-1 col-span-2">
                <label className="font-bold text-slate-600 block">자료명 <span className="text-rose-500">*</span></label>
                <input
                  autoFocus
                  type="text"
                  value={itemModal.name}
                  onChange={(e) => setItemModal((p) => (p ? { ...p, name: e.target.value } : p))}
                  placeholder="예: 2026 S/S 글로벌 컬러 트렌드 리포트"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="font-bold text-slate-600 block">폴더 위치</label>
                <select
                  value={itemModal.folderId}
                  onChange={(e) => setItemModal((p) => (p ? { ...p, folderId: e.target.value } : p))}
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                >
                  <option value="">{rootLabel}</option>
                  {folderOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 font-medium pt-0.5">
                  현재 경로: {itemModal.folderId ? folderPathLabel(itemModal.folderId) : rootLabel}
                </p>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">유형</label>
                <select
                  value={itemModal.itemType}
                  onChange={(e) => setItemModal((p) => (p ? { ...p, itemType: e.target.value } : p))}
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                >
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">저자/출처</label>
                <input
                  type="text"
                  value={itemModal.author}
                  onChange={(e) => setItemModal((p) => (p ? { ...p, author: e.target.value } : p))}
                  placeholder="예: WGSN"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="font-bold text-slate-600 block">파일 업로드 <span className="font-medium text-slate-400">(PDF / 이미지 등 · 최대 {MAX_FILE_MB}MB)</span></label>
                {itemModal.fileData ? (
                  <div className="flex items-center gap-2 p-2 border border-slate-200 bg-slate-50 rounded-lg">
                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="flex-1 min-w-0 truncate font-semibold text-slate-700">{itemModal.fileName || '업로드된 파일'}</span>
                    <button
                      type="button"
                      onClick={() => setItemModal((p) => (p ? { ...p, fileData: '', fileName: '', fileType: '' } : p))}
                      className="text-slate-400 hover:text-rose-600 shrink-0 cursor-pointer"
                      title="파일 제거"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-2.5 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-lg cursor-pointer text-slate-500 font-bold transition-colors">
                    <Upload className="w-4 h-4" />
                    파일 선택
                    <input
                      type="file"
                      accept=".pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp,.zip"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>

              <div className="space-y-1 col-span-2">
                <label className="font-bold text-slate-600 block">링크(URL) <span className="font-medium text-slate-400">(파일 대신 외부 링크)</span></label>
                <input
                  type="text"
                  value={itemModal.url}
                  onChange={(e) => setItemModal((p) => (p ? { ...p, url: e.target.value } : p))}
                  placeholder="https://..."
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="font-bold text-slate-600 block">설명</label>
                <textarea
                  rows={2}
                  value={itemModal.description}
                  onChange={(e) => setItemModal((p) => (p ? { ...p, description: e.target.value } : p))}
                  placeholder="자료에 대한 간단한 설명"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none resize-none"
                />
              </div>
              <div className="col-span-2 flex gap-2 justify-end pt-3 mt-1 border-t border-slate-100">
                <button type="button" onClick={() => setItemModal(null)} className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg cursor-pointer">취소</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg cursor-pointer">{itemModal.id ? '수정 저장' : '추가'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

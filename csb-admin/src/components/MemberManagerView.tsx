import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Edit2, Trash2, Search, X, ChevronDown, RotateCcw } from 'lucide-react';
import { Member } from '../types';

interface MemberManagerViewProps {
  members: Member[];
  onSave: (newMembers: Member[]) => void;
}

const MEMBER_ROLES = ['시스템관리자', '사이트관리자', '중국사이트관리자', '일반사용자'];
const MEMBER_AFFILIATIONS = ['이랜드이노플', '1사업부', '2사업부', '온라인BU'];
const MEMBER_CATEGORIES = ['한국', '중국'];

const blankMember = (): Partial<Member> => ({
  memberId: '',
  loginId: '',
  name: '',
  email: '',
  phone: '',
  groupName: '',
  affiliation: MEMBER_AFFILIATIONS[0],
  brand: '',
  role: '일반사용자',
  category: '한국',
  useYn: '사용',
});

export default function MemberManagerView({ members, onSave }: MemberManagerViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAffiliation, setFilterAffiliation] = useState('전체');
  const [filterRole, setFilterRole] = useState('전체');
  const [filterCategory, setFilterCategory] = useState('전체');
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newMember, setNewMember] = useState<Partial<Member>>(blankMember());

  const uniqueAffiliations = ['전체', ...Array.from(new Set(members.map((m) => m.affiliation || m.groupName).filter(Boolean)))];

  const resetFilters = () => {
    setFilterAffiliation('전체');
    setFilterRole('전체');
    setFilterCategory('전체');
    setSearchQuery('');
  };

  const filteredMembers = members.filter((m) => {
    if (m.status === 'pending') return false; // 미승인 사용자는 별도 탭에서 관리
    const q = searchQuery.toLowerCase();
    const matchQ =
      m.memberId.toLowerCase().includes(q) ||
      (m.loginId || '').toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.affiliation || '').toLowerCase().includes(q) ||
      (m.brand || '').toLowerCase().includes(q) ||
      (m.role || '').toLowerCase().includes(q);
    const matchAffiliation = filterAffiliation === '전체' || (m.affiliation || m.groupName) === filterAffiliation;
    const matchRole = filterRole === '전체' || (m.role || '일반사용자') === filterRole;
    const matchCategory = filterCategory === '전체' || (m.category || '한국') === filterCategory;
    return matchQ && matchAffiliation && matchRole && matchCategory;
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.memberId || !newMember.name) {
      alert('사번과 이름은 필수 항목입니다.');
      return;
    }
    if (members.some((m) => m.memberId === newMember.memberId)) {
      alert('이미 등록된 사번입니다.');
      return;
    }

    const email = newMember.email || `${newMember.memberId}@brandcompany.com`;
    const affiliation = newMember.affiliation || MEMBER_AFFILIATIONS[0];
    const payload: Member = {
      memberId: newMember.memberId,
      loginId: newMember.loginId || email.split('@')[0],
      name: newMember.name,
      email,
      phone: newMember.phone || '010-0000-0000',
      groupName: affiliation,
      affiliation,
      brand: newMember.brand || '',
      approvalDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      role: newMember.role || '일반사용자',
      category: newMember.category || '한국',
      useYn: '사용',
    };

    onSave([payload, ...members]);
    setIsMemberFormOpen(false);
    setNewMember(blankMember());
  };

  const handleUpdateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    const synced: Member = {
      ...editingMember,
      loginId: (editingMember.email || '').split('@')[0],
      groupName: editingMember.affiliation || editingMember.groupName,
    };
    onSave(members.map((m) => (m.memberId === editingMember.memberId ? synced : m)));
    setEditingMember(null);
  };

  const handleDeleteMember = (memberId: string) => {
    if (window.confirm('해당 회원을 목록에서 정말 삭제하시겠습니까?')) {
      onSave(members.filter((m) => m.memberId !== memberId));
    }
  };

  return (
    <div className="space-y-6" id="member-manager-container">
      {/* Control tool bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="사번, 아이디, 이름, 이메일, 소속, 브랜드로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => setIsMemberFormOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-5 rounded-lg flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            사용자 등록
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
                value={filterAffiliation}
                onChange={(e) => setFilterAffiliation(e.target.value)}
                className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
              >
                <option value="전체">소속: 전체</option>
                {uniqueAffiliations.filter((a) => a !== '전체').map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative shrink-0">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
              >
                <option value="전체">권한: 전체</option>
                {MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative shrink-0">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
              >
                <option value="전체">카테고리: 전체</option>
                {MEMBER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <span className="text-[11px] text-slate-400 font-extrabold font-mono uppercase tracking-wide whitespace-nowrap shrink-0 self-end lg:self-center">
            회원 수: {filteredMembers.length.toLocaleString()}명
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
                <th className="py-3 px-4">사번 (Employee ID)</th>
                <th className="py-3 px-4">아이디</th>
                <th className="py-3 px-4">사원명</th>
                <th className="py-3 px-4">소속</th>
                <th className="py-3 px-4">이메일 주소</th>
                <th className="py-3 px-4 text-center">권한</th>
                <th className="py-3 px-4 text-center">동작</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium font-sans">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    일치하는 회원 정보가 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.memberId} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-900 text-[11px]">{member.memberId}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{member.loginId || (member.email || '').split('@')[0]}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{member.name}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                        {member.affiliation || member.groupName}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{member.email}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full border ${
                        member.role && member.role !== '일반사용자'
                          ? 'bg-violet-50 text-violet-700 border-violet-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {member.role || '일반사용자'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center items-center gap-1.5">
                        <button
                          onClick={() => setEditingMember(member)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.memberId)}
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

      {/* MEMBER Add Modal */}
      {isMemberFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800 text-sm">사용자 등록</h4>
              <button onClick={() => setIsMemberFormOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">사번 코드 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="예: 20260101"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={newMember.memberId}
                  onChange={(e) => setNewMember((prev) => ({ ...prev, memberId: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400 block">아이디 (메일 앞부분 자동)</label>
                <input
                  type="text"
                  disabled
                  placeholder="메일 입력 시 자동"
                  className="w-full p-2 border border-slate-200 bg-slate-100 rounded-lg text-slate-400"
                  value={(newMember.email || '').split('@')[0]}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">성명 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="인사 대장 일치명"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={newMember.name}
                  onChange={(e) => setNewMember((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">메일 주소</label>
                <input
                  type="email"
                  placeholder="name@brandcompany.com"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg"
                  value={newMember.email}
                  onChange={(e) => setNewMember((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">소속</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={newMember.affiliation}
                  onChange={(e) => setNewMember((prev) => ({ ...prev, affiliation: e.target.value }))}
                >
                  {MEMBER_AFFILIATIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">브랜드</label>
                <input
                  type="text"
                  placeholder="예: 패션연구소"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg"
                  value={newMember.brand}
                  onChange={(e) => setNewMember((prev) => ({ ...prev, brand: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">카테고리</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={newMember.category}
                  onChange={(e) => setNewMember((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {MEMBER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">권한</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={newMember.role}
                  onChange={(e) => setNewMember((prev) => ({ ...prev, role: e.target.value }))}
                >
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 flex gap-3 pt-3 mt-1 border-t border-slate-100 justify-end">
                <button type="button" onClick={() => setIsMemberFormOpen(false)} className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg cursor-pointer">
                  취소
                </button>
                <button type="submit" className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                  작성 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEMBER Edit Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-850 text-sm">회원 정보 수정</h4>
              <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateMember} className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-bold text-slate-400 block">사번 코드 (변경불가)</label>
                <input
                  type="text"
                  disabled
                  className="w-full p-2 border border-slate-200 bg-slate-100 rounded-lg text-slate-400 font-bold"
                  value={editingMember.memberId}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400 block">아이디 (메일 앞부분 자동)</label>
                <input
                  type="text"
                  disabled
                  className="w-full p-2 border border-slate-200 bg-slate-100 rounded-lg text-slate-400"
                  value={(editingMember.email || '').split('@')[0]}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">성명</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg"
                  value={editingMember.name}
                  onChange={(e) => setEditingMember((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">메일 주소</label>
                <input
                  type="email"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg"
                  value={editingMember.email}
                  onChange={(e) => setEditingMember((prev) => (prev ? { ...prev, email: e.target.value } : null))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">소속</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={editingMember.affiliation || MEMBER_AFFILIATIONS[0]}
                  onChange={(e) => setEditingMember((prev) => (prev ? { ...prev, affiliation: e.target.value } : null))}
                >
                  {MEMBER_AFFILIATIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">브랜드</label>
                <input
                  type="text"
                  placeholder="예: 패션연구소"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg"
                  value={editingMember.brand || ''}
                  onChange={(e) => setEditingMember((prev) => (prev ? { ...prev, brand: e.target.value } : null))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400 block">승인일</label>
                <input
                  type="text"
                  disabled
                  className="w-full p-2 border border-slate-200 bg-slate-100 rounded-lg text-slate-400"
                  value={editingMember.approvalDate || '미기록'}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">권한</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={editingMember.role || '일반사용자'}
                  onChange={(e) => setEditingMember((prev) => (prev ? { ...prev, role: e.target.value } : null))}
                >
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="font-bold text-slate-600 block">카테고리</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={editingMember.category || '한국'}
                  onChange={(e) => setEditingMember((prev) => (prev ? { ...prev, category: e.target.value } : null))}
                >
                  {MEMBER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 flex gap-3 pt-3 mt-1 border-t border-slate-100 justify-end">
                <button type="button" onClick={() => setEditingMember(null)} className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg cursor-pointer">
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

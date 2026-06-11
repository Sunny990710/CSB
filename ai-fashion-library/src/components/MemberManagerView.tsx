import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit2, Trash2, Search, Users, ShieldAlert, X, ChevronRight, Check } from 'lucide-react';
import { Member, Group } from '../types';

interface MemberManagerViewProps {
  members: Member[];
  groups: Group[];
  onSaveDB: (newMembers: Member[], newGroups: Group[]) => void;
}

export default function MemberManagerView({ members, groups, onSaveDB }: MemberManagerViewProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'groups'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Single Member form/modal states
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newMember, setNewMember] = useState<Partial<Member>>({
    memberId: '',
    name: '',
    email: '',
    phone: '',
    groupName: '',
    useYn: '사용'
  });

  // Single Group form/modal states
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [newGroup, setNewGroup] = useState<Partial<Group>>({
    id: '',
    name: '',
    description: '',
    useYn: '사용'
  });

  // Filter lists
  const filteredMembers = members.filter((m) => {
    return (
      m.memberId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.groupName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredGroups = groups.filter((g) => {
    return (
      g.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Add Member
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.memberId || !newMember.name) {
      alert('사번과 이름은 필수 항목입니다.');
      return;
    }
    const dup = members.some((m) => m.memberId === newMember.memberId);
    if (dup) {
      alert('이미 등록된 사번입니다.');
      return;
    }

    const payload: Member = {
      memberId: newMember.memberId,
      name: newMember.name,
      email: newMember.email || `${newMember.memberId}@brandcompany.com`,
      phone: newMember.phone || '010-0000-0000',
      groupName: newMember.groupName || (groups[0]?.name || '디자인1팀'),
      useYn: '사용'
    };

    onSaveDB([payload, ...members], groups);
    setIsMemberFormOpen(false);
    setNewMember({ memberId: '', name: '', email: '', phone: '', groupName: '', useYn: '사용' });
  };

  const handleUpdateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    const updated = members.map((m) => m.memberId === editingMember.memberId ? editingMember : m);
    onSaveDB(updated, groups);
    setEditingMember(null);
  };

  const handleDeleteMember = (memberId: string) => {
    if (window.confirm('해당 팀원을 대여 권한 목록에서 정말 해제하시겠습니까?')) {
      const updated = members.filter((m) => m.memberId !== memberId);
      onSaveDB(updated, groups);
    }
  };

  // Add Group
  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroup.id || !newGroup.name) {
      alert('그룹 ID와 그룹명은 필수 항목입니다.');
      return;
    }
    const dup = groups.some((g) => g.id === newGroup.id);
    if (dup) {
      alert('이미 존재하는 그룹 ID 코드입니다.');
      return;
    }

    const payload: Group = {
      id: newGroup.id.toUpperCase(),
      name: newGroup.name,
      description: newGroup.description || '',
      useYn: '사용'
    };

    onSaveDB(members, [payload, ...groups]);
    setIsGroupFormOpen(false);
    setNewGroup({ id: '', name: '', description: '', useYn: '사용' });
  };

  const handleUpdateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    const updated = groups.map((g) => g.id === editingGroup.id ? editingGroup : g);
    onSaveDB(members, updated);
    setEditingGroup(null);
  };

  const handleDeleteGroup = (id: string) => {
    if (window.confirm('해당 그룹/부서를 자산 관리에서 해제하시겠습니까? 소속 임직원의 정보가 누락될 수 있으니 사전에 연대를 해제하여 주시기 바랍니다.')) {
      const updated = groups.filter((g) => g.id !== id);
      onSaveDB(members, updated);
    }
  };

  return (
    <div className="space-y-6" id="member-manager-container">
      {/* Upper subtabs */}
      <div className="flex border-b border-slate-200" id="member-management-tabs">
        <button
          onClick={() => { setActiveTab('members'); setSearchQuery(''); }}
          className={`py-3 px-6 font-semibold text-xs flex items-center gap-2 border-b-2 font-sans relative transition-colors ${
            activeTab === 'members' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-members"
        >
          <Users className="w-4 h-4" />
          <span>임직원 관리 ({members.length}명)</span>
        </button>
        <button
          onClick={() => { setActiveTab('groups'); setSearchQuery(''); }}
          className={`py-3 px-6 font-semibold text-xs flex items-center gap-2 border-b-2 font-sans relative transition-colors ${
            activeTab === 'groups' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-groups"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>그룹 및 하위 개발팀 부서 ({groups.length}개)</span>
        </button>
      </div>

      {/* Control tool bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col sm:flex-row gap-3 justify-between items-center" id="member-management-controlbar">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'members' ? "사번, 사원명, 등록 이메일, 팀명으로 검색..." : "그룹별 고유코드, 부서명, 업무 설명 검색..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-505"
          />
        </div>

        <button
          onClick={() => activeTab === 'members' ? setIsMemberFormOpen(true) : setIsGroupFormOpen(true)}
          className="bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs py-2 px-5 rounded-lg flex items-center gap-1.5 shrink-0 shadow-sm"
          id="btn-add-member-or-group"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'members' ? '대여 권한 임직원 등록' : '개발 연계 부서 신설'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'members' ? (
          <motion.div
            key="members-grid-box"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" id="members-list-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                    <th className="py-3 px-4">사번 (Employee ID)</th>
                    <th className="py-3 px-4">사원명</th>
                    <th className="py-3 px-4">소속 부서 / 그룹</th>
                    <th className="py-3 px-4">이메일 주소</th>
                    <th className="py-3 px-4">연락처</th>
                    <th className="py-3 px-4 text-center">사용여부</th>
                    <th className="py-3 px-4 text-center">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium font-sans">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400">
                        일치하는 임직원 정보가 존재하지 않습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => (
                      <tr key={member.memberId} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-900 text-[11px]">{member.memberId}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{member.name}</td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                            {member.groupName}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">{member.email}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{member.phone}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full border ${
                            member.useYn === '사용' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-slate-100 text-slate-505 border-slate-200'
                          }`}>
                            {member.useYn}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center items-center gap-1.5">
                            <button
                              onClick={() => setEditingMember(member)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="수정"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMember(member.memberId)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
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
        ) : (
          <motion.div
            key="groups-grid-box"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredGroups.length === 0 ? (
              <div className="col-span-full bg-white py-16 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                설치된 개발 연대 부서가 없습니다.
              </div>
            ) : (
              filteredGroups.map((group) => {
                const groupCount = members.filter(m => m.groupName === group.name).length;
                return (
                  <div
                    key={group.id}
                    className="bg-white p-5 rounded-xl border border-slate-100 shadow-2xs hover:shadow-sm hover:border-slate-200 transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-mono font-bold px-1.5 py-0.5 rounded">
                          {group.id}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          group.useYn === '사용' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {group.useYn}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 tracking-tight">{group.name}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-sans min-h-[32px]">
                        {group.description || '업무 설정이나 개발 브랜치가 명시되지 않았습니다.'}
                      </p>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                      <span className="text-xs text-slate-500 font-sans">
                        소속 사원: <strong className="text-slate-800 font-mono">{groupCount}</strong> 명
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setEditingGroup(group)}
                          className="p-1.5 text-slate-400 hover:text-blue-650 hover:bg-slate-50 rounded"
                          title="수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MEMBER Form Modal */}
      {isMemberFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800 text-sm">임직원 신규 보임 등록</h4>
              <button onClick={() => setIsMemberFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3.5 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">사번 코드 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="예: 20260101"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={newMember.memberId}
                  onChange={(e) => setNewMember(prev => ({ ...prev, memberId: e.target.value }))}
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
                  onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">메일 주소</label>
                <input
                  type="email"
                  placeholder="name@brandcompany.com"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg"
                  value={newMember.email}
                  onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">소속 부서 / 그룹</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg"
                  value={newMember.groupName}
                  onChange={(e) => setNewMember(prev => ({ ...prev, groupName: e.target.value }))}
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">전화번호</label>
                <input
                  type="text"
                  placeholder="010-0000-0000"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg"
                  value={newMember.phone}
                  onChange={(e) => setNewMember(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => setIsMemberFormOpen(false)}
                  className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  작성 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEMBER EDIT MODAL */}
      {editingMember && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-850 text-sm">팀원 기재 정보 수정</h4>
              <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateMember} className="space-y-3.5 text-xs font-sans">
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
                <label className="font-bold text-slate-620 block">성명</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg"
                  value={editingMember.name}
                  onChange={(e) => setEditingMember(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-620 block">메일 주소</label>
                <input
                  type="email"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg"
                  value={editingMember.email}
                  onChange={(e) => setEditingMember(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-620 block">소속 부서 / 그룹</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold text-slate-800"
                  value={editingMember.groupName}
                  onChange={(e) => setEditingMember(prev => prev ? ({ ...prev, groupName: e.target.value }) : null)}
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-620 block">사용 상태 권한</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold"
                  value={editingMember.useYn}
                  onChange={(e) => setEditingMember(prev => prev ? ({ ...prev, useYn: e.target.value as any }) : null)}
                >
                  <option value="사용">대여가능 (사용)</option>
                  <option value="미사용">대여 금지 (정지)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-105 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="bg-indigo-650 text-white font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-2xs"
                >
                  수정 갱신
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GROUP Add Modal */}
      {isGroupFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800 text-sm">개발 부서/팀 개설</h4>
              <button onClick={() => setIsGroupFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddGroup} className="space-y-3.5 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-bold text-slate-605 block">부서 코드 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="예: G10"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={newGroup.id}
                  onChange={(e) => setNewGroup(prev => ({ ...prev, id: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-605 block">부서/그룹명 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="예: 기획3팀"
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-605 block">그룹 상세 설명</label>
                <textarea
                  placeholder="부서 성격 및 자산 공동 관리 책임 범주 기입"
                  rows={3}
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg leading-relaxed"
                  value={newGroup.description}
                  onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => setIsGroupFormOpen(false)}
                  className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors animate-pulse"
                >
                  기재 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GROUP EDIT MODAL */}
      {editingGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-100 shadow-2xl p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-850 text-sm">부서 기재 정보 수정</h4>
              <button onClick={() => setEditingGroup(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateGroup} className="space-y-3.5 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-bold text-slate-400 block">부서 코드 (변경불가)</label>
                <input
                  type="text"
                  disabled
                  className="w-full p-2 border border-slate-200 bg-slate-100 rounded-lg text-slate-400 font-bold"
                  value={editingGroup.id}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-605 block">부서/그룹명</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg font-bold"
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-605 block">업무 및 특성 기입</label>
                <textarea
                  className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg leading-relaxed"
                  rows={3}
                  value={editingGroup.description}
                  onChange={(e) => setEditingGroup(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-605 block">기록지 표기 정지 상태자 수용유무</label>
                <select
                  className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold"
                  value={editingGroup.useYn}
                  onChange={(e) => setEditingGroup(prev => prev ? ({ ...prev, useYn: e.target.value as any }) : null)}
                >
                  <option value="사용">정상 가동 (사용)</option>
                  <option value="미사용">부서 해체 (정지)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="bg-slate-100 text-slate-500 font-bold px-4 py-2 rounded-lg cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
                >
                  수정 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

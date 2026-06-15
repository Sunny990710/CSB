import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, ChevronDown, RotateCcw } from 'lucide-react';
import { Member } from '../types';

interface RolePermissionViewProps {
  members: Member[];
  onSave: (newMembers: Member[]) => void;
}

const MEMBER_ROLES = ['시스템관리자', '사이트관리자', '중국사이트관리자', '일반사용자'];
const ADMIN_ROLES = ['시스템관리자', '사이트관리자', '중국사이트관리자'];
const MEMBER_CATEGORIES = ['한국', '중국'];

export default function RolePermissionView({ members, onSave }: RolePermissionViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('전체');
  const [filterAffiliation, setFilterAffiliation] = useState('전체');
  const [filterCategory, setFilterCategory] = useState('전체');

  const roleOf = (m: Member) => m.role || '일반사용자';

  // 관리자(권한 보유자)만 노출
  const admins = members.filter((m) => ADMIN_ROLES.includes(roleOf(m)));

  const uniqueAffiliations = ['전체', ...Array.from(new Set(admins.map((m) => m.affiliation || m.groupName).filter(Boolean)))];

  const filtered = admins.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      m.memberId.toLowerCase().includes(q) ||
      (m.loginId || '').toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q);
    const matchRole = roleFilter === '전체' || roleOf(m) === roleFilter;
    const matchAffiliation = filterAffiliation === '전체' || (m.affiliation || m.groupName) === filterAffiliation;
    const matchCategory = filterCategory === '전체' || (m.category || '') === filterCategory;
    return matchQ && matchRole && matchAffiliation && matchCategory;
  });

  const resetFilters = () => {
    setSearchQuery('');
    setRoleFilter('전체');
    setFilterAffiliation('전체');
    setFilterCategory('전체');
  };

  const changeRole = (memberId: string, role: string) => {
    onSave(members.map((m) => (m.memberId === memberId ? { ...m, role } : m)));
  };

  return (
    <div className="space-y-6" id="role-permission-container">
      {/* Search & filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="사번, 아이디, 이름으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
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
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
              >
                <option value="전체">권한: 전체</option>
                {ADMIN_ROLES.map((r) => (
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
            관리자 수: {filtered.length.toLocaleString()}명
          </span>
        </div>
      </div>

      {/* Table */}
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
                <th className="py-3 px-4">권한 설정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    표시할 관리자가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((member) => (
                  <tr key={member.memberId} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-900 text-[11px]">{member.memberId}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{member.loginId || (member.email || '').split('@')[0]}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{member.name}</td>
                    <td className="py-3 px-4 text-slate-500">{member.affiliation || member.groupName}</td>
                    <td className="py-3 px-4">
                      <select
                        value={roleOf(member)}
                        onChange={(e) => changeRole(member.memberId, e.target.value)}
                        className="p-1.5 border border-slate-200 bg-white text-slate-700 rounded-lg text-[11px] font-bold focus:outline-none cursor-pointer"
                      >
                        {MEMBER_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

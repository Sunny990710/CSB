import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, CheckCircle2, X } from 'lucide-react';
import { Member } from '../types';
import FilterDropdown from './FilterDropdown';

interface RolePermissionViewProps {
  members: Member[];
  onSave: (newMembers: Member[]) => void;
}

const MEMBER_ROLES = ['시스템관리자', '사이트관리자', '중국사이트관리자', '일반사용자'];
const ADMIN_ROLES = ['시스템관리자', '사이트관리자', '중국사이트관리자'];
const MEMBER_COUNTRIES = ['한국', '중국'];

export default function RolePermissionView({ members, onSave }: RolePermissionViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedAffiliations, setSelectedAffiliations] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  const roleOf = (m: Member) => m.role || '일반사용자';

  // 관리자(권한 보유자)만 노출
  const admins = members.filter((m) => ADMIN_ROLES.includes(roleOf(m)));

  const affiliationOptions = useMemo(
    () =>
      Array.from(new Set(admins.map((m) => m.affiliation || m.groupName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'ko')
      ),
    [admins]
  );

  const filtered = admins.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      m.memberId.toLowerCase().includes(q) ||
      (m.loginId || '').toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q);
    const matchRole = selectedRoles.length === 0 || selectedRoles.includes(roleOf(m));
    const matchAffiliation =
      selectedAffiliations.length === 0 ||
      selectedAffiliations.includes(m.affiliation || m.groupName || '');
    const matchCountry = selectedCountries.length === 0 || selectedCountries.includes(m.category || '');
    return matchQ && matchRole && matchAffiliation && matchCountry;
  });

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedRoles([]);
    setSelectedAffiliations([]);
    setSelectedCountries([]);
  };

  const changeRole = (memberId: string, role: string) => {
    onSave(members.map((m) => (m.memberId === memberId ? { ...m, role } : m)));
  };

  return (
    <div className="space-y-6" id="role-permission-container">
      {/* Search & filters */}
      <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="사번, 아이디, 이름으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100/70 border-0 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-violet-500 rounded-xl text-xs font-medium placeholder:text-slate-400 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 p-0.5 hover:bg-slate-200 rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:justify-between items-stretch lg:items-center gap-x-3 gap-y-2.5 pt-2.5 border-t border-slate-100">
          <div className="flex flex-nowrap gap-x-2 items-center overflow-x-auto min-w-0 shrink">
            <button
              type="button"
              onClick={resetFilters}
              className="bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs font-bold py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              <span>필터 초기화</span>
            </button>

            <FilterDropdown
              label="소속"
              value={selectedAffiliations}
              options={affiliationOptions}
              onChange={setSelectedAffiliations}
              popoverWidth={240}
            />

            <FilterDropdown
              label="권한"
              value={selectedRoles}
              options={ADMIN_ROLES}
              onChange={setSelectedRoles}
              popoverWidth={240}
            />

            <FilterDropdown
              label="국가"
              value={selectedCountries}
              options={MEMBER_COUNTRIES}
              onChange={setSelectedCountries}
              popoverWidth={200}
            />
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

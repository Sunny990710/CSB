import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Member } from '@/types';

interface UserLoginViewProps {
  members: Member[];
  onLogin: (member: Member) => void;
}

export default function UserLoginView({ members, onLogin }: UserLoginViewProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const activeMembers = members.filter((m) => m.useYn === '사용');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('이메일을 입력해 주세요.');
      return;
    }
    const member = activeMembers.find((m) => m.email.toLowerCase() === trimmed);
    if (!member) {
      setError('등록되지 않은 이메일입니다. 관리자에게 문의하세요.');
      return;
    }
    onLogin(member);
  };

  return (
    <div className="min-h-screen bg-[#0c0a1e] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="mb-8">
          <h1 className="text-lg font-black text-slate-900">CSB 샘플 대여</h1>
          <p className="text-xs text-slate-500 mt-1">임직원 전용 · 샘플 검색 · 대여 · 반납</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="user-login-email" className="block text-xs font-bold text-slate-600 mb-1.5">
              이메일
            </label>
            <input
              id="user-login-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="등록된 이메일을 입력하세요"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              autoComplete="email"
              autoFocus
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            로그인
          </button>
        </form>

        {activeMembers.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 mb-2">등록된 계정</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {activeMembers.map((m) => (
                <button
                  key={m.memberId}
                  type="button"
                  onClick={() => {
                    setEmail(m.email);
                    setError('');
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                >
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-slate-400 ml-1.5">{m.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

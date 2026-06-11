import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Columns3, Package, Users, BarChart3, Receipt, Settings, Bell, 
  HelpCircle, LogOut, CheckCircle, RefreshCw, AlertTriangle, ChevronDown, ChevronLeft,
  LayoutGrid, Folder, Activity, Trash2, ShieldCheck, Sparkles, Database,
  Upload, ShoppingCart, RotateCcw
} from 'lucide-react';
import { Sample, Rental, Member, Group } from './types';
import DashboardView from './components/DashboardView';
import SampleManagerView from './components/SampleManagerView';
import MemberManagerView from './components/MemberManagerView';
import RentalManagerView from './components/RentalManagerView';
import LoginView from './components/LoginView';

const AUTH_STORAGE_KEY = 'csb_auth_member_id';

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'samples' | 'rentals' | 'statistics' | 'members'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Master states loaded from full db endpoint
  const [samples, setSamples] = useState<Sample[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorWord, setErrorWord] = useState('');
  const [currentUser, setCurrentUser] = useState<Member | null>(null);

  // Fetch full state on mount
  const handleFetchAllData = () => {
    setLoading(true);
    fetch('/api/db')
      .then((res) => {
        if (!res.ok) throw new Error('서버 데이터를 전송받지 못했습니다.');
        return res.json();
      })
      .then((data) => {
        setSamples(data.samples || []);
        setRentals(data.rentals || []);
        setMembers(data.members || []);
        setGroups(data.groups || []);
        setErrorWord('');
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch DB error:", err);
        setErrorWord('네트워크 지연 혹은 로컬 서버 데이터 미확보 상태입니다. 잠시 후 재시도하십시오.');
        setLoading(false);
      });
  };

  useEffect(() => {
    handleFetchAllData();
  }, []);

  useEffect(() => {
    if (members.length === 0) return;
    const savedId = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!savedId) return;
    const saved = members.find((m) => m.memberId === savedId && m.useYn === '사용');
    if (saved) setCurrentUser(saved);
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  }, [members]);

  const handleLogin = (member: Member) => {
    setCurrentUser(member);
    localStorage.setItem(AUTH_STORAGE_KEY, member.memberId);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // Generic Save / Update back to the server.ts JSON db
  const handleSaveDB = (newSamples: Sample[], newMembers?: Member[], newGroups?: Group[], newRentals?: Rental[]) => {
    // Optimistic UI update
    const updatedSamples = newSamples;
    const updatedMembers = newMembers || members;
    const updatedGroups = newGroups || groups;
    const updatedRentals = newRentals || rentals;

    setSamples(updatedSamples);
    setMembers(updatedMembers);
    setGroups(updatedGroups);
    setRentals(updatedRentals);

    fetch('/api/db/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        samples: updatedSamples,
        members: updatedMembers,
        groups: updatedGroups,
        rentals: updatedRentals
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (!resData.success) {
          alert('데이터 변경 반영 실패: ' + resData.message);
          handleFetchAllData(); // rollback
        }
      })
      .catch((error) => {
        console.error("Save DB Error:", error);
        alert('데이터 보존 통신 장애 발생. 변경 사항이 유실되었을 수 있어 전체 새로고침합니다.');
        handleFetchAllData(); // rollback
      });
  };

  if (!loading && !errorWord && !currentUser) {
    return <LoginView members={members} onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen max-h-screen bg-[#f8fafc] flex flex-col font-sans antialiased text-slate-800 overflow-hidden" id="applet-viewport">
      
      {/* Shared Workarea Panel Layout */}
      <div className="flex flex-1 overflow-hidden" id="workspace-middle-layout">
        
        {/* Left Side App Navigation Navigation panel (Styled carefully as Screenshot 1 "이미지허브") */}
        <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-60'} bg-[#0c0a1e] p-4 hidden md:flex flex-col justify-between shrink-0 border-r border-indigo-950/30 overflow-x-hidden overflow-y-auto transition-[width] duration-300 ease-in-out`} id="sidebar-navigator">
          <div className="space-y-4">
            
            {/* CSB styled Title Header */}
            <div
              className={`pb-3.5 border-b border-[#ffffff]/10 my-1 px-1.5 flex ${
                isSidebarCollapsed ? 'flex-col items-center gap-2' : 'items-center justify-between'
              }`}
              id="sidebar-logo-header"
            >
              <div className={`flex items-center gap-2 min-w-0 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <span
                  className={`text-[14px] font-black tracking-wide text-white font-sans whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out ${
                    isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[4rem] opacity-100'
                  }`}
                >
                  CSB
                </span>
              </div>
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title={isSidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
              >
                <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Navigation links (Styled carefully as Screenshot 1 menu items) */}
            <nav className="space-y-1" id="nav-group">
              {[
                { id: 'dashboard', label: '홈', icon: LayoutGrid },
                { id: 'upload', label: '업로드', icon: Upload },
                { id: 'samples', label: '상품관리', icon: Package },
                { id: 'rentals', label: '대여관리', icon: Activity },
                { id: 'statistics', label: '통계', icon: BarChart3 },
                { id: 'members', label: '설정', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full text-left py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center border-l-[3px] group cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center px-0' : 'px-3.5'
                    } ${
                      isActive 
                        ? 'bg-violet-500/15 text-violet-300 border-violet-500' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
                    }`}
                    id={`sidebar-btn-${item.id}`}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <div className={`flex items-center min-w-0 ${isSidebarCollapsed ? '' : 'gap-3'}`}>
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      <span
                        className={`tracking-wide whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out ${
                          isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[8rem] opacity-100'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Customer Support & Logout Links (Modeled perfectly as requested) */}
          <div className="mt-auto space-y-4 pt-4 border-t border-white/5" id="copyright-box">
            <div className="space-y-2.5 px-1">
              {/* 고객지원 Link */}
              <button 
                onClick={() => alert('고객지원 센터로 연결합니다 (1:1 문의 운영중)')}
                className={`w-full flex items-center min-w-0 text-xs text-slate-400 hover:text-white transition-colors py-1.5 focus:outline-none cursor-pointer ${
                  isSidebarCollapsed ? 'justify-center' : 'gap-2.5'
                }`}
                id="btn-sidebar-help"
                title={isSidebarCollapsed ? "고객지원" : undefined}
              >
                <HelpCircle className="w-4 h-4 shrink-0 text-slate-400" />
                <span
                  className={`font-semibold whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out ${
                    isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[5rem] opacity-100'
                  }`}
                >
                  고객지원
                </span>
              </button>

              {/* 로그아웃 Link */}
              <button 
                onClick={() => {
                  if (confirm('로그아웃 하시겠습니까?')) {
                    handleLogout();
                  }
                }}
                className={`w-full flex items-center min-w-0 text-xs text-slate-300 hover:text-white transition-colors py-1.5 focus:outline-none cursor-pointer ${
                  isSidebarCollapsed ? 'justify-center' : 'gap-2.5'
                }`}
                id="btn-sidebar-logout"
                title={isSidebarCollapsed ? "로그아웃" : undefined}
              >
                <LogOut className="w-4 h-4 shrink-0 text-slate-400" />
                <span
                  className={`font-semibold whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out ${
                    isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[5rem] opacity-100'
                  }`}
                >
                  로그아웃
                </span>
              </button>
            </div>

            {/* Muted Terms and Privacy */}
            <div
              className={`text-[10px] text-slate-500 font-medium tracking-tight font-sans px-1 pb-1 flex items-center justify-between whitespace-nowrap overflow-hidden transition-[opacity,max-height] duration-300 ease-in-out ${
                isSidebarCollapsed ? 'max-h-0 opacity-0' : 'max-h-6 opacity-100'
              }`}
            >
              <span>이용약관</span>
              <span>·</span>
              <span>개인정보처리방침</span>
            </div>
          </div>
        </aside>

        {/* Dynamic Mobile Select tab header bar */}
        <div className="md:hidden bg-white border-b border-slate-200 p-2 flex shrink-0" id="mobile-nav-header">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="dashboard">🏠 홈 (대시보드)</option>
            <option value="upload">⬆️ 업로드 (일괄 의류 매칭)</option>
            <option value="samples">📂 상품관리 (샘플 대장)</option>
            <option value="rentals">📋 대여관리 (대여 현황 및 알림)</option>
            <option value="statistics">📊 통계 (자산 분석 현황)</option>
            <option value="members">⚙️ 설정 (권한 관리)</option>
          </select>
        </div>

        {/* Main core content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Main Top Header supporting modern searches & user statuses */}
          <header className="bg-white border-b border-[#e2e8f0]/80 h-14 px-6 shrink-0 flex items-center justify-end" id="workspace-main-header">
            {currentUser && (
              <div className="flex items-center gap-3 text-xs" id="header-user-badge">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-violet-600 text-white font-mono flex items-center justify-center font-extrabold text-[10px]">
                    {getInitials(currentUser.name)}
                  </div>
                  <div className="text-[11px] font-medium hidden sm:block">
                    <span className="font-extrabold text-slate-800">{currentUser.name}</span>
                    <span className="text-slate-500"> 님 ({currentUser.groupName})</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('로그아웃 하시겠습니까?')) {
                      handleLogout();
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="로그아웃"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="font-semibold hidden sm:inline">로그아웃</span>
                </button>
              </div>
            )}
          </header>

          {/* Central main render dynamic route portal */}
          <main className="flex-1 overflow-y-auto p-6 bg-slate-50/50" id="workspace-core-view-portal">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2.5 text-slate-500 py-32 font-sans text-xs" id="loader-hud">
                <RefreshCw className="w-7 h-7 text-indigo-650 animate-spin" />
                <span className="font-bold tracking-tight text-slate-500">디자인 자산 DB 정보 동기화 중...</span>
              </div>
            ) : errorWord ? (
              <div className="p-5 bg-rose-50 border border-rose-105 rounded-xl text-xs text-rose-850 flex items-center gap-2" id="error-hud">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <span>{errorWord}</span>
              </div>
            ) : (
              <div className="max-w-7xl mx-auto" id="route-contents">
                {activeTab === 'dashboard' && (
                  <div id="dashboard-subview-frame">
                    <DashboardView
                      samples={samples}
                      rentals={rentals}
                      members={members}
                      onNavigateToSamples={() => setActiveTab('samples')}
                      onNavigateToRentals={() => setActiveTab('rentals')}
                      onRefreshData={handleFetchAllData}
                    />
                  </div>
                )}

                {activeTab === 'statistics' && (
                  <div id="statistics-subview-frame">
                    <DashboardView
                      samples={samples}
                      rentals={rentals}
                      members={members}
                      onNavigateToSamples={() => setActiveTab('samples')}
                      onNavigateToRentals={() => setActiveTab('rentals')}
                      showOnlyCharts={true}
                      onRefreshData={handleFetchAllData}
                    />
                  </div>
                )}

                {activeTab === 'upload' && (
                  <div id="upload-subview-frame">
                    <SampleManagerView
                      samples={samples}
                      onSaveDB={(newSamples) => handleSaveDB(newSamples)}
                      forceTab="bulk-images"
                      rentals={rentals}
                    />
                  </div>
                )}

                {activeTab === 'samples' && (
                  <div id="samples-subview-frame">
                    <SampleManagerView
                      samples={samples}
                      onSaveDB={(newSamples) => handleSaveDB(newSamples)}
                      forceTab="list"
                      rentals={rentals}
                    />
                  </div>
                )}

                {activeTab === 'rentals' && (
                  <div id="rentals-subview-frame">
                    <RentalManagerView
                      rentals={rentals}
                      samples={samples}
                      members={members}
                      onSaveDB={(newRentals, newSamples) => handleSaveDB(newSamples, members, groups, newRentals)}
                    />
                  </div>
                )}

                {activeTab === 'members' && (
                  <div id="members-subview-frame">
                    <MemberManagerView
                      members={members}
                      groups={groups}
                      onSaveDB={(newMembers, newGroups) => handleSaveDB(samples, newMembers, newGroups)}
                    />
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

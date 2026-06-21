import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Columns3, Package, Users, BarChart3, Receipt, Settings, Bell, 
  HelpCircle, LogOut, CheckCircle, RefreshCw, AlertTriangle, ChevronDown, ChevronLeft,
  LayoutGrid, Folder, Activity, Trash2, Sparkles, Database,
  Upload, ShoppingCart, RotateCcw, ArrowUpRight, Tags, Tag, User, Clock, UserCheck, Library, History, FileText,
} from 'lucide-react';
import { Sample, Rental, RentalAgreement, Member, Group, Category, Brand, ContentNode, LossDamageReport, effectiveRentalStatus } from './types';
import DashboardView from './components/DashboardView';
import SampleManagerView from './components/SampleManagerView';
import MemberManagerView from './components/MemberManagerView';
import PendingMemberView from './components/PendingMemberView';
import BrandManagerView from './components/BrandManagerView';
import RentalManagerView from './components/RentalManagerView';
import CategoryManagerView from './components/CategoryManagerView';
import ContentRepositoryView from './components/ContentRepositoryView';
import LoginView from './components/LoginView';
import logoUrl from './assets/logo.png';

const AUTH_STORAGE_KEY = 'csb_auth_member_id';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'samples' | 'rental_status' | 'rental_documents' | 'contents' | 'categories' | 'settings_pending' | 'settings_users' | 'settings_brands'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  
  // Master states loaded from full db endpoint
  const [samples, setSamples] = useState<Sample[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [rentalAgreements, setRentalAgreements] = useState<RentalAgreement[]>([]);
  const [lossDamageReports, setLossDamageReports] = useState<LossDamageReport[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [contents, setContents] = useState<ContentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorWord, setErrorWord] = useState('');
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [sampleStatusFilter, setSampleStatusFilter] = useState('전체');

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
        setRentalAgreements(data.rentalAgreements || []);
        setLossDamageReports(data.lossDamageReports || []);
        setMembers(data.members || []);
        setGroups(data.groups || []);
        setCategories(data.categories || []);
        setBrands(data.brands || []);
        setContents(data.contents || []);
        setErrorWord('');
        setLoading(false);
        return fetch('/api/rentals/sync-overdue', { method: 'POST' });
      })
      .then((res) => (res?.ok ? res.json() : null))
      .then((sync) => {
        if (sync?.changed) handleSilentRefresh();
      })
      .catch((err) => {
        console.error("Fetch DB error:", err);
        setErrorWord('네트워크 지연 혹은 로컬 서버 데이터 미확보 상태입니다. 잠시 후 재시도하십시오.');
        setLoading(false);
      });
  };

  // 대여/반납 등 인라인 작업 후 — 로딩 화면 없이 데이터만 갱신 (실시간 로그 유지)
  const handleSilentRefresh = (): Promise<void> => {
    return fetch('/api/db')
      .then((res) => {
        if (!res.ok) throw new Error('서버 데이터를 전송받지 못했습니다.');
        return res.json();
      })
      .then((data) => {
        setSamples(data.samples || []);
        setRentals(data.rentals || []);
        setRentalAgreements(data.rentalAgreements || []);
        setLossDamageReports(data.lossDamageReports || []);
        setMembers(data.members || []);
        setGroups(data.groups || []);
        setCategories(data.categories || []);
        setBrands(data.brands || []);
        setContents(data.contents || []);
      })
      .catch((err) => console.error('Silent refresh error:', err));
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
  const handleSaveDB = (newSamples: Sample[], newMembers?: Member[], newGroups?: Group[], newRentals?: Rental[], newCategories?: Category[], newBrands?: Brand[], newContents?: ContentNode[], newRentalAgreements?: RentalAgreement[]) => {
    // Optimistic UI update
    const updatedSamples = newSamples;
    const updatedMembers = newMembers || members;
    const updatedGroups = newGroups || groups;
    const updatedRentals = newRentals || rentals;
    const updatedCategories = newCategories || categories;
    const updatedBrands = newBrands || brands;
    const updatedContents = newContents || contents;
    const updatedRentalAgreements = newRentalAgreements || rentalAgreements;

    setSamples(updatedSamples);
    setMembers(updatedMembers);
    setGroups(updatedGroups);
    setRentals(updatedRentals);
    setCategories(updatedCategories);
    setBrands(updatedBrands);
    setContents(updatedContents);
    setRentalAgreements(updatedRentalAgreements);

    fetch('/api/db/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        samples: updatedSamples,
        members: updatedMembers,
        groups: updatedGroups,
        rentals: updatedRentals,
        rentalAgreements: updatedRentalAgreements,
        lossDamageReports,
        categories: updatedCategories,
        brands: updatedBrands,
        contents: updatedContents
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

  // 알림: 연체 중이거나 반납 예정일이 임박한(3일 이내) 대여 건 집계
  const DUE_SOON_DAYS = 3;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdueRentals = rentals.filter((r) => effectiveRentalStatus(r) === '연체중');
  const dueSoonRentals = rentals.filter((r) => {
    if (effectiveRentalStatus(r) !== '대여중') return false;
    if (!r.dueDate) return false;
    const due = new Date(r.dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - startOfToday.getTime()) / 86400000);
    return diffDays >= 0 && diffDays <= DUE_SOON_DAYS;
  });
  const notifCount = overdueRentals.length + dueSoonRentals.length;

  return (
    <div className="h-screen max-h-screen bg-[#f8fafc] flex flex-col font-sans antialiased text-slate-800 overflow-hidden" id="applet-viewport">
      
      {/* Shared Workarea Panel Layout */}
      <div className="flex flex-1 overflow-hidden" id="workspace-middle-layout">
        
        {/* Left Side App Navigation Navigation panel (Styled carefully as Screenshot 1 "이미지허브") */}
        <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-60'} bg-[#0c0a1e] p-4 hidden md:flex flex-col justify-between shrink-0 border-r border-indigo-950/30 overflow-x-hidden overflow-y-auto transition-[width] duration-300 ease-in-out`} id="sidebar-navigator">
          <div className="space-y-6">
            
            {/* CSB styled Title Header */}
            <div
              className={`pb-4 border-b border-[#ffffff]/10 mt-1 mb-2 px-1.5 flex ${
                isSidebarCollapsed ? 'flex-col items-center gap-2' : 'items-center justify-between'
              }`}
              id="sidebar-logo-header"
            >
              <div className={`flex items-center min-w-0 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                <img
                  src={logoUrl}
                  alt="CSB"
                  className={`h-6 w-auto object-contain shrink-0 transition-[opacity,max-width] duration-300 ease-in-out ${
                    isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[7rem] opacity-100'
                  }`}
                />
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
                { id: 'categories', label: '카테고리 관리', icon: Tags },
                {
                  id: 'rentals',
                  label: '대여관리',
                  icon: Activity,
                  defaultChild: 'rental_status',
                  children: [
                    { id: 'rental_status', label: '대여/반납 현황', icon: History },
                    { id: 'rental_documents', label: '문서함', icon: FileText },
                  ],
                },
                { id: 'contents', label: '콘텐츠 저장소', icon: Library },
                {
                  id: 'settings',
                  label: '설정',
                  icon: Settings,
                  defaultChild: 'settings_pending',
                  children: [
                    { id: 'settings_pending', label: '가입 승인', icon: UserCheck },
                    { id: 'settings_users', label: '권한 관리', icon: Users },
                    { id: 'settings_brands', label: '브랜드 관리', icon: Tag },
                  ],
                },
              ].map((item) => {
                const Icon = item.icon;

                // --- Expandable group (대여관리, 설정) ---
                if ('children' in item && item.children) {
                  const groupActive = item.children.some((c) => c.id === activeTab);
                  const showChildren = !isSidebarCollapsed && ((openMenus[item.id] ?? false) || groupActive);
                  return (
                    <div key={item.id}>
                      <button
                        onClick={() => {
                          if (isSidebarCollapsed) {
                            setActiveTab((item.defaultChild || item.children[0].id) as any);
                          } else {
                            setOpenMenus((prev) => ({ ...prev, [item.id]: !(prev[item.id] ?? false) }));
                          }
                        }}
                        className={`w-full text-left py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center border-l-[3px] border-transparent group cursor-pointer text-slate-400 hover:text-white hover:bg-white/5 ${
                          isSidebarCollapsed ? 'justify-center px-0' : 'px-3.5 justify-between'
                        }`}
                        id={`sidebar-btn-${item.id}`}
                        title={isSidebarCollapsed ? item.label : undefined}
                      >
                        <div className={`flex items-center min-w-0 ${isSidebarCollapsed ? '' : 'gap-3'}`}>
                          <Icon className="w-4 h-4 shrink-0 transition-colors text-slate-500 group-hover:text-slate-300" />
                          <span
                            className={`tracking-wide whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out ${
                              isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[8rem] opacity-100'
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>
                        {!isSidebarCollapsed && (
                          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${showChildren ? 'rotate-180' : ''}`} />
                        )}
                      </button>

                      {showChildren && (
                        <div className="mt-1 space-y-1">
                          {item.children.map((child) => {
                            const CIcon = child.icon;
                            const cActive = activeTab === child.id;
                            return (
                              <button
                                key={child.id}
                                onClick={() => setActiveTab(child.id as any)}
                                className={`w-full text-left py-2 pl-10 pr-3.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2.5 border-l-[3px] cursor-pointer ${
                                  cActive
                                    ? 'bg-violet-500/15 text-violet-300 border-violet-500'
                                    : 'text-slate-500 hover:text-white hover:bg-white/5 border-transparent'
                                }`}
                                id={`sidebar-btn-${child.id}`}
                              >
                                <CIcon className={`w-3.5 h-3.5 shrink-0 ${cActive ? 'text-violet-400' : 'text-slate-500'}`} />
                                <span className="tracking-wide whitespace-nowrap">{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // --- Regular flat item ---
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
            <option value="categories">🗂️ 카테고리 관리</option>
            <option value="rental_status">📋 대여/반납 현황</option>
            <option value="rental_documents">📁 문서함</option>
            <option value="contents">📚 콘텐츠 저장소</option>
            <optgroup label="⚙️ 설정">
              <option value="settings_pending">🕓 가입 승인</option>
              <option value="settings_users">👤 권한 관리</option>
              <option value="settings_brands">🏷️ 브랜드 관리</option>
            </optgroup>
          </select>
        </div>

        {/* Main core content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Main Top Header supporting modern searches & user statuses */}
          <header className="bg-white border-b border-[#e2e8f0]/80 h-14 px-6 shrink-0 flex items-center justify-end gap-1.5" id="workspace-main-header">
            {currentUser && (
              <>
                <div className="relative">
                  <button
                    onClick={() => setNotifMenuOpen((o) => !o)}
                    className="relative p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="알림"
                  >
                    <Bell className="w-4.5 h-4.5" />
                    {notifCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center leading-none ring-2 ring-white">
                        {notifCount > 99 ? '99+' : notifCount}
                      </span>
                    )}
                  </button>

                  {notifMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotifMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden" id="header-notif-dropdown">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-800">반납 알림</span>
                          <span className="text-[10px] font-bold text-slate-400">{notifCount}건</span>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifCount === 0 ? (
                            <div className="px-4 py-8 text-center text-[11px] text-slate-400 font-semibold">
                              연체이거나 반납이 임박한 상품이 없습니다.
                            </div>
                          ) : (
                            <>
                              {overdueRentals.map((r) => (
                                <button
                                  key={r.rentalId}
                                  onClick={() => {
                                    setNotifMenuOpen(false);
                                    setActiveTab('rental_status');
                                  }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start gap-2.5 border-b border-slate-50 cursor-pointer"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-bold text-slate-800 truncate">{r.sampleName}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{r.borrowerName} · {r.sampleCode}</div>
                                    <div className="text-[10px] font-bold text-rose-500 mt-0.5">연체 · 반납예정 {r.dueDate}</div>
                                  </div>
                                </button>
                              ))}
                              {dueSoonRentals.map((r) => (
                                <button
                                  key={r.rentalId}
                                  onClick={() => {
                                    setNotifMenuOpen(false);
                                    setActiveTab('rental_status');
                                  }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start gap-2.5 border-b border-slate-50 cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-bold text-slate-800 truncate">{r.sampleName}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{r.borrowerName} · {r.sampleCode}</div>
                                    <div className="text-[10px] font-bold text-amber-600 mt-0.5">반납임박 · 반납예정 {r.dueDate}</div>
                                  </div>
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="relative ml-1">
                  <button
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="flex items-center gap-2 py-1.5 pl-1.5 pr-2.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                    id="header-user-menu-btn"
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 hidden sm:block">{currentUser.name}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50" id="header-user-dropdown">
                        <div className="px-3.5 py-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-1 pl-5.5">{currentUser.groupName}</div>
                          <div className="text-[10px] text-slate-400 truncate pl-5.5">{currentUser.email}</div>
                        </div>
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            if (confirm('로그아웃 하시겠습니까?')) handleLogout();
                          }}
                          className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5 text-slate-400" />
                          로그아웃
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
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
                      onNavigateToRentals={() => setActiveTab('rental_status')}
                      onRefreshData={handleFetchAllData}
                    />
                  </div>
                )}

                {activeTab === 'upload' && (
                  <div id="upload-subview-frame">
                    <SampleManagerView
                      key="upload-bulk-images"
                      samples={samples}
                      onSaveDB={(newSamples) => handleSaveDB(newSamples)}
                      forceTab="bulk-images"
                      rentals={rentals}
                      categories={categories}
                    />
                  </div>
                )}

                {activeTab === 'samples' && (
                  <div id="samples-subview-frame">
                    <SampleManagerView
                      key="samples-list"
                      samples={samples}
                      onSaveDB={(newSamples) => handleSaveDB(newSamples)}
                      forceTab="list"
                      rentals={rentals}
                      categories={categories}
                      statusFilter={sampleStatusFilter}
                    />
                  </div>
                )}

                {['rental_status', 'rental_documents'].includes(activeTab) && (
                  <div className="flex border-b border-slate-200 mb-6 overflow-x-auto" id="rental-subtabs">
                    {[
                      { id: 'rental_status', label: '대여/반납 현황', icon: History },
                      { id: 'rental_documents', label: '문서함', icon: FileText },
                    ].map((tab) => {
                      const TabIcon = tab.icon;
                      const isActive = activeTab === tab.id;
                      const pendingCount =
                        tab.id === 'rental_status'
                          ? rentalAgreements
                              .filter(
                                (a) =>
                                  a.signatureStatus === 'signed' &&
                                  a.approvalStatus !== 'approved' &&
                                  a.approvalStatus !== 'rejected'
                              )
                              .reduce((sum, a) => sum + a.items.length, 0)
                          : 0;
                      const docCount =
                        tab.id === 'rental_documents'
                          ? rentalAgreements.length + lossDamageReports.length
                          : 0;
                      const badgeCount = tab.id === 'rental_status' ? pendingCount : docCount;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`py-3.5 px-6 font-semibold text-xs flex items-center gap-2 border-b-2 font-sans whitespace-nowrap transition-all cursor-pointer ${
                            isActive
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                          id={`rental-tab-btn-${tab.id}`}
                        >
                          <TabIcon className="w-4 h-4" />
                          <span>{tab.label}</span>
                          {badgeCount > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                              {badgeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {['rental_status', 'rental_documents'].includes(activeTab) && (
                  <>
                    <div
                      id="rentals-subview-frame"
                      className={activeTab === 'rental_status' ? '' : 'hidden'}
                      aria-hidden={activeTab !== 'rental_status'}
                    >
                      <RentalManagerView
                        viewMode="status"
                        rentals={rentals}
                        rentalAgreements={rentalAgreements}
                        lossDamageReports={lossDamageReports}
                        samples={samples}
                        members={members}
                        categories={categories}
                        onSaveDB={(newRentals, newSamples) => handleSaveDB(newSamples, members, groups, newRentals)}
                        onRefreshData={handleSilentRefresh}
                      />
                    </div>
                    <div
                      id="rentals-documents-subview-frame"
                      className={activeTab === 'rental_documents' ? '' : 'hidden'}
                      aria-hidden={activeTab !== 'rental_documents'}
                    >
                      <RentalManagerView
                        viewMode="documents"
                        rentals={rentals}
                        rentalAgreements={rentalAgreements}
                        lossDamageReports={lossDamageReports}
                        samples={samples}
                        members={members}
                        categories={categories}
                        onSaveDB={(newRentals, newSamples) => handleSaveDB(newSamples, members, groups, newRentals)}
                        onRefreshData={handleSilentRefresh}
                      />
                    </div>
                  </>
                )}

                {activeTab === 'contents' && (
                  <div id="contents-subview-frame">
                    <ContentRepositoryView
                      contents={contents}
                      onSave={(newContents) => handleSaveDB(samples, members, groups, rentals, categories, brands, newContents)}
                    />
                  </div>
                )}

                {['settings_pending', 'settings_users', 'settings_brands'].includes(activeTab) && (
                  <div className="flex border-b border-slate-200 mb-6 overflow-x-auto" id="settings-subtabs">
                    {[
                      { id: 'settings_pending', label: '가입 승인', icon: UserCheck },
                      { id: 'settings_users', label: '권한 관리', icon: Users },
                      { id: 'settings_brands', label: '브랜드 관리', icon: Tag },
                    ].map((tab) => {
                      const TabIcon = tab.icon;
                      const isActive = activeTab === tab.id;
                      const pendingCount = tab.id === 'settings_pending' ? members.filter((m) => m.status === 'pending').length : 0;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`py-3.5 px-6 font-semibold text-xs flex items-center gap-2 border-b-2 font-sans whitespace-nowrap transition-all cursor-pointer ${
                            isActive
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                          id={`settings-tab-btn-${tab.id}`}
                        >
                          <TabIcon className="w-4 h-4" />
                          <span>{tab.label}</span>
                          {pendingCount > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                              {pendingCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'settings_pending' && (
                  <div id="settings-pending-subview-frame">
                    <PendingMemberView
                      members={members}
                      onSave={(newMembers) => handleSaveDB(samples, newMembers)}
                    />
                  </div>
                )}

                {activeTab === 'settings_users' && (
                  <div id="settings-users-subview-frame">
                    <MemberManagerView
                      members={members}
                      onSave={(newMembers) => handleSaveDB(samples, newMembers)}
                    />
                  </div>
                )}

                {activeTab === 'settings_brands' && (
                  <div id="settings-brands-subview-frame">
                    <BrandManagerView
                      brands={brands}
                      onSave={(newBrands) => handleSaveDB(samples, members, groups, rentals, categories, newBrands)}
                    />
                  </div>
                )}

                {activeTab === 'categories' && (
                  <div id="categories-subview-frame">
                    <CategoryManagerView
                      categories={categories}
                      samples={samples}
                      onSave={(newCategories, newSamples) =>
                        handleSaveDB(newSamples || samples, members, groups, rentals, newCategories)
                      }
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

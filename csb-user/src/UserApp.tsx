import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid,
  ShoppingCart,
  ClipboardList,
  Archive,
  HelpCircle,
  LogOut,
  AlertTriangle,
  ChevronLeft,
  ChevronDown,
  User,
  Bell,
  Clock,
} from 'lucide-react';
import { Member, Rental, Sample, effectiveRentalStatus } from '@/types';
import logoUrl from '@/assets/logo.png';
import UserLoginView from './components/UserLoginView';
import UserHomeView from './components/UserHomeView';
import UserLockerView from './components/UserLockerView';
import UserRentalView from './components/UserRentalView';
import UserRentalStatusView from './components/UserRentalStatusView';
import { USER_AUTH_KEY, UserTab, DUE_SOON_DAYS } from './utils/constants';
import { getLockerCodes, toggleLockerCode, removeLockerCode, saveLockerCodes } from './utils/locker';
import { PREVIEW_MEMBERS, PREVIEW_RENTALS, PREVIEW_SAMPLES } from './utils/mockPreviewData';

export default function UserApp() {
  const [activeTab, setActiveTab] = useState<UserTab>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [lockerCodes, setLockerCodes] = useState<string[]>([]);
  const [pendingRentCodes, setPendingRentCodes] = useState<string[]>([]);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch('/api/db');
      if (!res.ok) throw new Error('API unavailable');
      const data = await res.json();
      setSamples(data.samples || []);
      setRentals(data.rentals || []);
      setMembers(data.members || []);
      setPreviewMode(false);
      await fetch('/api/rentals/sync-overdue', { method: 'POST' });
    } catch {
      if (!options?.silent) {
        setSamples(PREVIEW_SAMPLES);
        setRentals(PREVIEW_RENTALS as Rental[]);
        setMembers(PREVIEW_MEMBERS as Member[]);
        setPreviewMode(true);
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (members.length === 0) return;
    const savedId = localStorage.getItem(USER_AUTH_KEY);
    if (!savedId) return;
    const saved = members.find((m) => m.memberId === savedId && m.useYn === '사용');
    if (saved) setCurrentUser(saved);
    else localStorage.removeItem(USER_AUTH_KEY);
  }, [members]);

  useEffect(() => {
    if (currentUser) setLockerCodes(getLockerCodes(currentUser.memberId));
  }, [currentUser]);

  const handleLogin = (member: Member) => {
    setCurrentUser(member);
    localStorage.setItem(USER_AUTH_KEY, member.memberId);
    setLockerCodes(getLockerCodes(member.memberId));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(USER_AUTH_KEY);
  };

  const handleToggleLocker = (code: string) => {
    if (!currentUser) return;
    setLockerCodes(toggleLockerCode(currentUser.memberId, code));
  };

  const handleRemoveLocker = (code: string) => {
    if (!currentUser) return;
    setLockerCodes(removeLockerCode(currentUser.memberId, code));
  };

  const handleRemoveFromLocker = (codes: string[]) => {
    if (!currentUser) return;
    let next = getLockerCodes(currentUser.memberId);
    for (const code of codes) {
      next = next.filter((c) => c !== code);
    }
    saveLockerCodes(currentUser.memberId, next);
    setLockerCodes(next);
  };

  const myRentals = useMemo(() => {
    if (!currentUser) return [];
    return rentals.filter((r) => r.borrowerId === currentUser.memberId);
  }, [rentals, currentUser]);

  const myActiveRentals = useMemo(
    () => myRentals.filter((r) => effectiveRentalStatus(r) !== '반납완료'),
    [myRentals]
  );

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const overdueRentals = useMemo(
    () => myRentals.filter((r) => effectiveRentalStatus(r) === '연체중'),
    [myRentals]
  );

  const dueSoonRentals = useMemo(
    () =>
      myRentals.filter((r) => {
        if (effectiveRentalStatus(r) !== '대여중' || !r.dueDate) return false;
        const due = new Date(r.dueDate);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.round((due.getTime() - startOfToday.getTime()) / 86400000);
        return diffDays >= 0 && diffDays <= DUE_SOON_DAYS;
      }),
    [myRentals, startOfToday]
  );

  const notifCount = overdueRentals.length + dueSoonRentals.length;

  const navItems: { id: UserTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'home', label: '홈', icon: LayoutGrid },
    { id: 'rental', label: '대여/반납하기', icon: ShoppingCart, badge: myActiveRentals.length || undefined },
    { id: 'rental_status', label: '대여 현황', icon: ClipboardList },
    { id: 'locker', label: '내 보관함', icon: Archive, badge: lockerCodes.length || undefined },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-sm text-slate-500">
        불러오는 중…
      </div>
    );
  }

  if (!currentUser) {
    return <UserLoginView members={members} onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen max-h-screen bg-[#f8fafc] flex flex-col font-sans antialiased text-slate-800 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — admin 과 동일 패턴 */}
        <aside
          className={`${
            isSidebarCollapsed ? 'w-16' : 'w-60'
          } bg-[#0c0a1e] p-4 hidden md:flex flex-col justify-between shrink-0 border-r border-indigo-950/30 overflow-x-hidden overflow-y-auto transition-[width] duration-300 ease-in-out`}
        >
          <div className="space-y-6">
            <div
              className={`pb-4 border-b border-[#ffffff]/10 mt-1 mb-2 px-1.5 flex ${
                isSidebarCollapsed ? 'flex-col items-center gap-2' : 'items-center justify-between'
              }`}
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
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title={isSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
              >
                <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <nav className="space-y-1">
              {navItems.map(({ id, label, icon: Icon, badge }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    title={isSidebarCollapsed ? label : undefined}
                    className={`w-full text-left py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center border-l-[3px] group cursor-pointer relative ${
                      isSidebarCollapsed ? 'justify-center px-0' : 'px-3.5'
                    } ${
                      isActive
                        ? 'bg-violet-500/15 text-violet-300 border-violet-500'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
                    }`}
                  >
                    <div className={`flex items-center min-w-0 ${isSidebarCollapsed ? '' : 'gap-3'}`}>
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      <span
                        className={`tracking-wide whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out ${
                          isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[8rem] opacity-100'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                    {badge != null && badge > 0 && (
                      <span
                        className={`min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-black ${
                          isSidebarCollapsed ? 'absolute -top-0.5 -right-0.5' : 'ml-auto'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto space-y-4 pt-4 border-t border-white/5">
            <div className="space-y-2.5 px-1">
              <button
                type="button"
                onClick={() => alert('고객지원 센터로 연결합니다 (1:1 문의 운영중)')}
                className={`w-full flex items-center min-w-0 text-xs text-slate-400 hover:text-white transition-colors py-1.5 cursor-pointer ${
                  isSidebarCollapsed ? 'justify-center' : 'gap-2.5'
                }`}
                title={isSidebarCollapsed ? '고객지원' : undefined}
              >
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span
                  className={`font-semibold whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-in-out ${
                    isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[5rem] opacity-100'
                  }`}
                >
                  고객지원
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('로그아웃 하시겠습니까?')) handleLogout();
                }}
                className={`w-full flex items-center min-w-0 text-xs text-slate-300 hover:text-white transition-colors py-1.5 cursor-pointer ${
                  isSidebarCollapsed ? 'justify-center' : 'gap-2.5'
                }`}
                title={isSidebarCollapsed ? '로그아웃' : undefined}
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
            <div
              className={`text-[10px] text-slate-500 font-medium tracking-tight px-1 pb-1 flex items-center justify-between whitespace-nowrap overflow-hidden transition-[opacity,max-height] duration-300 ease-in-out ${
                isSidebarCollapsed ? 'max-h-0 opacity-0' : 'max-h-6 opacity-100'
              }`}
            >
              <span>이용약관</span>
              <span>·</span>
              <span>개인정보처리방침</span>
            </div>
          </div>
        </aside>

        {/* Mobile nav */}
        <div className="md:hidden bg-white border-b border-slate-200 p-2 flex shrink-0 w-full absolute top-0 left-0 right-0 z-20">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as UserTab)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="home">홈</option>
            <option value="rental">대여/반납하기</option>
            <option value="rental_status">대여 현황</option>
            <option value="locker">내 보관함</option>
          </select>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden md:pt-0 pt-12">
          {/* Top header — admin 과 동일 */}
          <header className="bg-white border-b border-[#e2e8f0]/80 h-14 px-6 shrink-0 flex items-center justify-end gap-1.5">
            <div className="relative">
              <button
                type="button"
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
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800">내 반납 알림</span>
                      <span className="text-[10px] font-bold text-slate-400">{notifCount}건</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifCount === 0 ? (
                        <div className="px-4 py-8 text-center text-[11px] text-slate-400 font-semibold">
                          연체이거나 반납이 임박한 샘플이 없습니다.
                        </div>
                      ) : (
                        <>
                          {overdueRentals.map((r) => (
                            <button
                              key={r.rentalId}
                              type="button"
                              onClick={() => {
                                setNotifMenuOpen(false);
                                setActiveTab('rental_status');
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start gap-2.5 border-b border-slate-50 cursor-pointer"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-bold text-slate-800 truncate">{r.sampleName}</div>
                                <div className="text-[10px] text-slate-400 truncate">{r.sampleCode}</div>
                                <div className="text-[10px] font-bold text-rose-500 mt-0.5">연체 · 반납예정 {r.dueDate}</div>
                              </div>
                            </button>
                          ))}
                          {dueSoonRentals.map((r) => (
                            <button
                              key={r.rentalId}
                              type="button"
                              onClick={() => {
                                setNotifMenuOpen(false);
                                setActiveTab('rental_status');
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-start gap-2.5 border-b border-slate-50 cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-bold text-slate-800 truncate">{r.sampleName}</div>
                                <div className="text-[10px] text-slate-400 truncate">{r.sampleCode}</div>
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
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 py-1.5 pl-1.5 pr-2.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
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
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                    <div className="px-3.5 py-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-1 pl-5.5">{currentUser.groupName}</div>
                      <div className="text-[10px] text-slate-400 truncate pl-5.5">{currentUser.email}</div>
                    </div>
                    <button
                      type="button"
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
          </header>

          <main className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            {previewMode && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-start gap-2 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>미리보기 모드</strong> — 서버 API에 연결되지 않아 샘플 데이터로 표시 중입니다.
                </p>
              </div>
            )}

            <div className="max-w-7xl mx-auto">
              {activeTab === 'home' && (
                <UserHomeView
                  samples={samples}
                  lockerCodes={lockerCodes}
                  userName={currentUser.name}
                  onToggleLocker={handleToggleLocker}
                  onNavigateLocker={() => setActiveTab('locker')}
                />
              )}
              {activeTab === 'rental' && (
                <UserRentalView
                  samples={samples}
                  rentals={rentals}
                  currentUser={currentUser}
                  initialBorrowCodes={pendingRentCodes}
                  previewMode={previewMode}
                  onRefresh={() => void loadData({ silent: true })}
                  onClearInitialBorrowCodes={() => setPendingRentCodes([])}
                  onNavigateHome={() => setActiveTab('home')}
                  onNavigateLocker={() => setActiveTab('locker')}
                  onRemoveFromLocker={handleRemoveFromLocker}
                />
              )}
              {activeTab === 'rental_status' && (
                <UserRentalStatusView rentals={rentals} borrowerId={currentUser.memberId} />
              )}
              {activeTab === 'locker' && (
                <UserLockerView
                  samples={samples}
                  lockerCodes={lockerCodes}
                  onRemove={handleRemoveLocker}
                  onRent={(code) => {
                    setPendingRentCodes([code]);
                    setActiveTab('rental');
                  }}
                  onNavigateRental={() => setActiveTab('rental')}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

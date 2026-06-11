import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Package, RefreshCw, AlertTriangle, Building, ThumbsDown, Calendar, 
  Search, ArrowRight, UserCheck, Send, Mail, Sparkles, History, 
  User, Clock, MessageSquare, AlertCircle, Phone, ArrowUpRight, Check, CheckCircle2
} from 'lucide-react';
import { Sample, Rental, Member } from '../types';

interface DashboardViewProps {
  samples: Sample[];
  rentals: Rental[];
  members: Member[];
  onNavigateToRentals: () => void;
  onNavigateToSamples: () => void;
  showOnlyCharts?: boolean;
  onRefreshData?: () => void;
}

export default function DashboardView({
  samples,
  rentals,
  members,
  onNavigateToRentals,
  onNavigateToSamples,
  showOnlyCharts = false,
  onRefreshData,
}: DashboardViewProps) {
  // Compute critical summaries
  const totalSamples = samples.length;
  const availableCount = samples.filter((s) => s.status === '대여가능').length;
  const onLoanCount = samples.filter((s) => s.status === '대여중').length;
  const overdueCount = rentals.filter((r) => r.status === '연체중').length;
  const lostCount = samples.filter((s) => s.status === '분실').length;
  const bupyeongCount = samples.filter((s) => s.status === '부평보관').length;

  // Overdue lists for alert panel
  const activeOverdues = rentals.filter((r) => r.status === '연체중');

  // Local states for AI notification panel
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSendAutomatedEmail = async (rental: Rental) => {
    if (!confirm(`${rental.borrowerName} 님에게 즉시 자동 독촉 메일을 발송하시겠습니까?`)) return;
    
    setSendingId(rental.rentalId);
    try {
      const dueTime = new Date(rental.dueDate).getTime();
      const todayTime = new Date('2026-06-09').getTime();
      const daysOverdue = Math.max(1, Math.ceil((todayTime - dueTime) / (1000 * 60 * 60 * 24)));
      const tone = rental.notifyCount > 0 ? 'warning' : 'gentle';

      const draftRes = await fetch('/api/agent/draft-email', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrowerName: rental.borrowerName,
          borrowerGroup: rental.borrowerGroup,
          sampleName: rental.sampleName,
          sampleCode: rental.sampleCode,
          dueDate: rental.dueDate,
          daysOverdue,
          emailType: tone
        })
      });
      const draftData = await draftRes.json();
      
      const sendRes = await fetch('/api/agent/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.rentalId,
          subject: draftData.subject || `[반납 촉구 안내] 대여하신 의류 샘플 반납 기한 경과 안내`,
          content: draftData.content || `안녕하세요, ${rental.borrowerName}님.\n\n대여 중인 의류 샘플의 빠른 반납 부탁드립니다.`
        })
      });
      const sendData = await sendRes.json();
      
      if (sendData.success) {
        alert(`${rental.borrowerName} 님에게 자동 독촉 메일이 성공적으로 전송되었습니다.`);
        if (onRefreshData) {
          onRefreshData();
        } else {
          window.location.reload();
        }
      } else {
        alert('발송 실패: ' + sendData.message);
      }
    } catch (err) {
      console.error(err);
      alert('자동 독촉 메일 전송 중 통신 오류가 발생했습니다.');
    } finally {
      setSendingId(null);
    }
  };

  // Compute stats for charts
  // Category counts
  const categories = samples.reduce((acc: { [key: string]: number }, cur) => {
    acc[cur.category] = (acc[cur.category] || 0) + 1;
    return acc;
  }, {});

  const categoryData = Object.entries(categories).map(([name, count]) => ({
    name,
    count,
  }));

  // Brand distribution
  const brands = samples.reduce((acc: { [key: string]: number }, cur) => {
    acc[cur.brand] = (acc[cur.brand] || 0) + 1;
    return acc;
  }, {});

  const brandData = Object.entries(brands).map(([name, count]) => ({
    name,
    count,
  }));

  // Rental Trend by week (simulated grouping based on date)
  const daysInPast = [6, 5, 4, 3, 2, 1, 0].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.toISOString().substring(5, 10); // MM-DD
  });

  const dailyRentals = daysInPast.map((day) => {
    // Count rentals made on this day or matching
    const count = rentals.filter((r) => r.rentDate.substring(5, 10) === day).length;
    return { day, count };
  });

  const filteredOverdues = activeOverdues.filter((overdue) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      overdue.sampleCode.toLowerCase().includes(query) ||
      overdue.sampleName.toLowerCase().includes(query) ||
      overdue.borrowerName.toLowerCase().includes(query) ||
      overdue.borrowerGroup.toLowerCase().includes(query)
    );
  });

  const handleReturnAction = (rentalId: string) => {
    if (!confirm('해당 샘플을 즉시 반납 완료 처리하시겠습니까?')) return;
    fetch('/api/rentals/return', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalId })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert(data.message);
        if (onRefreshData) {
          onRefreshData();
        } else {
          window.location.reload();
        }
      } else {
        alert('반납 완료 처리에 실패했습니다: ' + data.message);
      }
    })
    .catch(err => {
      console.error(err);
      alert('반납 처리 통신 실패');
    });
  };

  if (showOnlyCharts) {
    return (
      <div className="space-y-6" id="dashboard-container">
        {/* Statistics Title Block */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden" id="stats-hero">
          <div className="absolute right-0 top-0 w-1/3 h-full bg-linear-to-l from-indigo-500/10 to-transparent pointer-events-none" />
          <div className="space-y-2 z-10">
            <span className="text-xs bg-indigo-500/20 text-indigo-300 font-mono py-1 px-2.5 rounded-full uppercase tracking-wider font-semibold">Asset Analytics</span>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-100">의류 자산 및 대여 운용 통계 리포트</h1>
            <p className="text-xs text-slate-400">카테고리별 샘플 비중, 누적 가동률 및 브랜드 모델별 취급 점유율 실시간 분석 통계입니다.</p>
          </div>
          <div className="flex items-center gap-3 mt-4 md:mt-0 font-mono text-[10px] text-slate-400 bg-slate-850 py-1.5 px-3 rounded-lg border border-slate-800" id="current-time-hud">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>METRIC SYNC: LIVE</span>
          </div>
        </div>

        {/* Main Stats Charts & Visualizers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts-row">
          {/* Category Visualization - Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4" id="chart-categories-card">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-800">카테고리별 샘플 비중</h3>
              <span className="text-xs text-indigo-600 font-medium">유형별 요약</span>
            </div>
            <div className="space-y-3 pt-2">
              {categoryData.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-400">등록된 의류 상품이 없습니다.</div>
              ) : (
                categoryData.map((cat, i) => {
                  const percent = Math.round((cat.count / totalSamples) * 100) || 0;
                  const barColors = [
                    'bg-indigo-500',
                    'bg-indigo-400',
                    'bg-indigo-300',
                    'bg-indigo-200',
                    'bg-indigo-100'
                  ];
                  return (
                    <div key={cat.name} className="space-y-1" id={`category-item-${i}`}>
                      <div className="flex justify-between text-xs font-medium text-slate-700">
                        <span>{cat.name}</span>
                        <span>{cat.count}개 ({percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={`h-full rounded-full ${barColors[i % barColors.length]}`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Brand & Overdue visual donut chart simulation explicitly in beautiful SVG */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4" id="chart-status-donut-card">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-800">샘플 대여율 & 회수현황</h3>
              <span className="text-xs text-emerald-600 font-medium font-mono">Real-Time</span>
            </div>
            
            <div className="flex flex-col items-center justify-center py-2 relative" id="svg-donut-wrapper">
              <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="12"
                  strokeDasharray={`${(availableCount / (totalSamples || 1)) * 251.2} 251.2`}
                  strokeDashoffset="0"
                  className="transition-all duration-1000 ease-out"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#3b82f6"
                  strokeWidth="12"
                  strokeDasharray={`${(onLoanCount / (totalSamples || 1)) * 251.2} 251.2`}
                  strokeDashoffset={`-${(availableCount / (totalSamples || 1)) * 251.2}`}
                  className="transition-all duration-1000 ease-out"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#f43f5e"
                  strokeWidth="12"
                  strokeDasharray={`${(overdueCount / (totalSamples || 1)) * 251.2} 251.2`}
                  strokeDashoffset={`-${((availableCount + onLoanCount) / (totalSamples || 1)) * 251.2}`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center top-7">
                <span className="text-3xl font-extrabold text-slate-800 tracking-tight">
                  {totalSamples ? Math.round(((onLoanCount + overdueCount) / totalSamples) * 100) : 0}%
                </span>
                <span className="text-[10px] text-slate-400 font-medium">실시간 가동률</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <div className="text-[10px] font-semibold text-emerald-700">대여가능</div>
                <div className="text-sm font-bold text-slate-800">{availableCount}개</div>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <div className="text-[10px] font-semibold text-blue-700">대여중</div>
                <div className="text-sm font-bold text-slate-800">{onLoanCount}개</div>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg border border-rose-100">
                <div className="text-[10px] font-semibold text-rose-700">연체중</div>
                <div className="text-sm font-bold text-rose-800">{overdueCount}개</div>
              </div>
            </div>
          </div>

          {/* Brand & Project status timeline */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4" id="chart-brands-card">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-800">브랜드 모델별 관리건수</h3>
              <span className="text-xs text-slate-400 font-mono">Brand Shares</span>
            </div>
            <div className="space-y-3.5 pt-1.5">
              {brandData.map((bd, index) => {
                const brandPct = Math.min(100, Math.round((bd.count / totalSamples) * 100));
                return (
                  <div key={bd.name} className="flex justify-between items-center" id={`brand-item-${index}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-slate-900 rounded-full" />
                      <span className="text-xs font-semibold text-slate-800">{bd.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-medium text-slate-500">{bd.count}개</span>
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-800 rounded-full"
                          style={{ width: `${brandPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Upper Welcomer Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden" id="dashboard-hero">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-linear-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="space-y-2 z-10">
          <span className="text-xs bg-indigo-500/20 text-indigo-300 font-mono py-1 px-2.5 rounded-full uppercase tracking-wider font-semibold">Workspace Live</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">디자인 의류 샘플 통합 워크스페이스</h1>
          <p className="text-sm text-slate-400">
            실시간 대여 현황 및 자동 연체 이메일 독촉 에이전트를 한 곳에서 관리하는 패션 자산 플랫폼입니다.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0 font-mono text-xs text-slate-400 bg-slate-850 py-2 px-4 rounded-xl border border-slate-800" id="current-time-hud">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>SERVER LOCALTIME: 2026-06-09</span>
        </div>
      </div>

      {/* Numerical Quick KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4" id="kpi-grid">
        {[
          { id: 'kpi-all', label: '전체 샘플', val: totalSamples, icon: Package, color: 'text-slate-600 bg-slate-100', link: 'samples' },
          { id: 'kpi-avail', label: '대여 가능', val: availableCount, icon: UserCheck, color: 'text-emerald-600 bg-emerald-50', link: 'samples' },
          { id: 'kpi-loan', label: '대여중', val: onLoanCount, icon: RefreshCw, color: 'text-blue-600 bg-blue-50', link: 'rentals' },
          { id: 'kpi-overdue', label: '연체자 수', val: overdueCount, icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border border-rose-100', highlight: true, link: 'rentals' },
          { id: 'kpi-bupyeong', label: '부평보관', val: bupyeongCount, icon: Building, color: 'text-amber-600 bg-amber-50', link: 'samples' },
          { id: 'kpi-lost', label: '분실 상태', val: lostCount, icon: ThumbsDown, color: 'text-slate-500 bg-slate-150', link: 'samples' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex flex-col justify-between h-28 cursor-pointer hover:shadow-md transition-all ${
                kpi.highlight ? 'ring-2 ring-rose-500/15' : ''
              }`}
              onClick={kpi.link === 'samples' ? onNavigateToSamples : onNavigateToRentals}
              id={kpi.id}
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
                <div className={`p-2 rounded-lg ${kpi.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-slate-800">{kpi.val}</span>
                <span className="text-xs text-slate-400">개</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Overdue Workspace & Notification Center Centerpiece */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="dashboard-main-workspace-row">
        
        {/* Left Side: Overdue list control board (lg:col-span-2) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between overflow-hidden lg:h-[600px]" id="dashboard-overdue-list-panel">
          
          {/* Header Area */}
          <div className="p-5 border-b border-rose-100/60 bg-gradient-to-r from-rose-50/20 to-transparent flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  실시간 미반납·연체 자산 모니터링 제어센터
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                    {activeOverdues.length}명 대기중
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">실시간 연체 일수 판정 및 AI 다차원 독촉 이메일 템플릿 직송 시스템</p>
              </div>
            </div>

            {/* Quick search input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="연체자명, 부서, 상품코드 검색..."
                className="w-full pl-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500/30 font-sans"
              />
            </div>
          </div>

          {/* List Overdue container */}
          <div className="p-5 space-y-4 flex-1 overflow-y-auto" id="dashboard-overdues-scroll-area font-sans">
            {filteredOverdues.length === 0 ? (
              <div className="py-24 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <div className="p-4 bg-slate-50 rounded-full text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-bounce" />
                </div>
                <span className="font-bold text-slate-600 block mt-2 font-sans">반납 대기 또는 연체 자산이 존재하지 않습니다.</span>
                <span className="text-[11px] font-sans">안심 정보: 워크스페이스 내 모든 샘플이 정상 운용 중입니다.</span>
              </div>
            ) : (
              filteredOverdues.map((overdue, index) => {
                const dueDt = new Date(overdue.dueDate);
                const today = new Date('2026-06-09'); // system date standard
                const diffTime = Math.abs(today.getTime() - dueDt.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const hasNotifiedBefore = overdue.notifyCount > 0;
                
                // Find matching sample to get details & image
                const sample = samples.find(s => s.code === overdue.sampleCode);

                return (
                  <div
                    key={overdue.rentalId}
                    className="p-4 rounded-xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-2xs"
                    id={`overdue-card-${index}`}
                  >
                    {/* Left side: Thumbnail image & essential details (satisfies image requirement) */}
                    <div className="flex items-center gap-4 flex-1 w-full min-w-0">
                      
                      {/* Interactive Visual Garment Card */}
                      <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center relative shadow-xs">
                        {sample?.imgFront ? (
                          <img
                            src={sample.imgFront}
                            alt={overdue.sampleName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 text-slate-400">
                            <Package className="w-6 h-6 text-indigo-400" />
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 bg-slate-900/70 text-[7px] text-white px-1 py-0.2 rounded font-mono font-bold scale-90">
                          {sample?.category || '의류'}
                        </span>
                      </div>

                      {/* Main Garment Metadata (Clean layout, removed redundant dates) */}
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 py-0.5 px-2 rounded font-mono uppercase tracking-tight">
                            {overdue.sampleCode}
                          </span>
                        </div>
                        <h4 className="text-[12.5px] font-extrabold text-slate-800 line-clamp-1 tracking-tight" title={overdue.sampleName}>
                          {overdue.sampleName}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-sans">
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <strong className="text-slate-700">{overdue.borrowerName}</strong>
                            <span className="text-slate-400">({overdue.borrowerGroup})</span>
                          </div>
                          <span className="text-slate-300">•</span>
                          <span className="text-rose-600 font-extrabold flex items-center gap-0.5 bg-rose-50 px-2 py-0.5 rounded text-[11px]">
                            <AlertTriangle className="w-3 h-3 block" />
                            {diffDays}일차 연체!
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Notification Stats + Triggers */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0 border-t border-slate-50 md:border-0 pt-3 md:pt-0">
                      
                      {/* Notice Dispatch Status Indicators */}
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasNotifiedBefore ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 py-0.5 px-2 rounded-full font-mono">
                              <History className="w-2.5 h-2.5 animate-pulse text-indigo-500" />
                              {overdue.notifyCount}차 발송완료
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200/60 py-0.5 px-2 rounded-full font-mono">
                              독촉 이력 없음
                            </span>
                          )}
                        </div>
                        {hasNotifiedBefore && (
                          <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                            최종: {overdue.lastNotifyDate?.substring(5, 16) || '-'}
                          </span>
                        )}
                      </div>

                      {/* Control Operations Block */}
                      <div className="flex items-center gap-1.5" id={`dashboard-overdue-controls-${overdue.rentalId}`}>
                        
                        {/* Send Automated Notification Button */}
                        <button
                          onClick={() => handleSendAutomatedEmail(overdue)}
                          disabled={sendingId === overdue.rentalId}
                          className={`py-1.5 px-3 rounded-lg shadow-sm font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                            hasNotifiedBefore
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse'
                              : 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100'
                          } disabled:opacity-50`}
                          id={hasNotifiedBefore ? `btn-overdue-action-resend-${index}` : `btn-overdue-action-first-${index}`}
                        >
                          {sendingId === overdue.rentalId ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              전송 중...
                            </>
                          ) : hasNotifiedBefore ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              추가독촉
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3.5 h-3.5" />
                              독촉초안
                            </>
                          )}
                        </button>

                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Active Diagnostics Dashboard (lg:col-span-1) */}
        <div id="dashboard-active-desk-panel" className="lg:h-[0px] flex-none lg:h-[600px] flex flex-col">
          
          {/* Overdue Asset Risk Diagnostics & Intelligence Dashboard */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full justify-between overflow-hidden animate-fade-in" id="homespace-diagnostics-panel">
            <div className="flex justify-between items-center border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-rose-500 block shrink-0 animate-pulse" />
                <h3 className="text-sm font-extrabold text-slate-800">연체 자산 리스크 진단 현황판</h3>
              </div>
              <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-extrabold font-mono uppercase">
                Risk Analytics
              </span>
            </div>

            {/* Statistical KPI Grid inside sidebar */}
            <div className="grid grid-cols-2 gap-3" id="diagnostics-mini-facts">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-0.5">
                <span className="text-[9.5px] font-bold text-slate-400 block font-sans">연체 자산 정체 총액</span>
                <p className="text-sm font-extrabold text-slate-800 font-mono">
                  {activeOverdues.reduce((sum, r) => {
                    const s = samples.find(item => item.code === r.sampleCode);
                    return sum + (s?.price || 0);
                  }, 0).toLocaleString()}원
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-0.5">
                <span className="text-[9.5px] font-bold text-slate-400 block font-sans">최대 연체 기한</span>
                <p className="text-sm font-extrabold text-rose-600 font-mono">
                  {activeOverdues.reduce((max, r) => {
                    const dueDt = new Date(r.dueDate);
                    const today = new Date('2026-06-09');
                    const dDiff = Math.ceil(Math.abs(today.getTime() - dueDt.getTime()) / (1000 * 60 * 60 * 24));
                    return dDiff > max ? dDiff : max;
                  }, 0)}일째 경과
                </p>
              </div>
            </div>

            {/* Bottleneck department indicator list */}
            <div className="space-y-2.5 pt-1">
              <h4 className="text-[11px] font-extrabold text-slate-700 flex items-center justify-between">
                <span>부서별 샘플 정체 비중</span>
                <span className="text-[9.5px] text-slate-400 font-medium">연체 기안 점유율</span>
              </h4>
              
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1" id="dept-bottleneck-bars">
                {Object.entries(
                  activeOverdues.reduce((acc: { [key: string]: number }, r) => {
                    acc[r.borrowerGroup] = (acc[r.borrowerGroup] || 0) + 1;
                    return acc;
                  }, {})
                ).sort((a,b) => b[1] - a[1]).map(([dept, count], idx) => {
                  const percent = Math.round((count / activeOverdues.length) * 100);
                  return (
                    <div key={dept} className="space-y-1">
                      <div className="flex justify-between items-center text-[10.5px]">
                        <span className="font-extrabold text-slate-700">{dept}</span>
                        <span className="font-mono text-slate-500 font-bold">{count}건 ({percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            idx === 0 ? 'bg-rose-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* compliance scoreboard and actions warnings */}
            <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-150/50 text-xs text-slate-600 space-y-1.5 leading-relaxed font-sans" id="diagnostics-compliance-rules">
              <h4 className="font-extrabold text-slate-800 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 block shrink-0" />
                스마트 자산 보호 경보:
              </h4>
              <ul className="text-[11px] text-slate-500 pl-4 list-disc space-y-1 font-medium">
                <li>
                  현재 대여 수명 연체중 20만 원 이상의 <b className="text-slate-700">고가 바잉 의류 샘플</b>이 집중 정체 구역에 속해 있습니다.
                </li>
                <li>
                  장기 연체 누적 비중이 높은 부서 기안자에 대해 좌측 표의 <b className="text-indigo-700">"추가독촉"</b> 또는 <b className="text-rose-600">"독촉초안"</b> 버튼을 클릭하여 즉각적인 자동 독촉 메일을 발송해 보세요.
                </li>
              </ul>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

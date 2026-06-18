import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Package, RefreshCw, AlertTriangle, ThumbsDown, Calendar, 
  Search, ArrowRight, UserCheck, Send, Mail, Sparkles, History, 
  User, Clock, MessageSquare, AlertCircle, Phone, ArrowUpRight, Check, CheckCircle2,
  TrendingUp, TrendingDown, Minus, Flame,
  ChevronRight, ChevronDown, X,
} from 'lucide-react';
import { Sample, Rental, Member, rentalStatusLabel, effectiveRentalStatus, sampleStatusLabel, SampleStatus } from '../types';

interface DashboardViewProps {
  samples: Sample[];
  rentals: Rental[];
  members?: Member[];
  onNavigateToRentals: () => void;
  onNavigateToSamples: () => void;
  showOnlyCharts?: boolean;
  onRefreshData?: () => void;
}

type ManagerTask = 'overdue' | 'due-soon';
type OverdueWeekFilter = 1 | 2 | 3 | 4;
type EscalationRole = 'director' | 'cdo' | 'brandHead';

interface NotifyRecipient {
  key: string;
  roleLabel: string;
  name: string;
  email: string;
}

const OVERDUE_WEEK_RULES: Record<OverdueWeekFilter, { summary: string; ccRoles: EscalationRole[] }> = {
  1: { summary: '경고 메일 (실장님 포함)', ccRoles: ['director'] },
  2: { summary: '경고 메일 (실장, CDO님 포함)', ccRoles: ['director', 'cdo'] },
  3: { summary: '경고 메일 (실장, CDO, 브랜드장님 포함)', ccRoles: ['director', 'cdo', 'brandHead'] },
  4: { summary: '경고 메일 (실장, CDO, 브랜드장님 포함)', ccRoles: ['director', 'cdo', 'brandHead'] },
};

const RECIPIENT_ROLE_ORDER = ['대여자', '실장', 'CDO', '브랜드장'];

function emailTypeForWeek(week: OverdueWeekFilter): 'gentle' | 'warning' | 'strict' {
  if (week === 1) return 'gentle';
  if (week === 4) return 'strict';
  return 'warning';
}

function resolveDirector(members: Member[], groupName: string): NotifyRecipient {
  const found = members.find(
    (m) => m.useYn === '사용' && m.groupName === groupName && m.role && /실장|팀장|부장/.test(m.role)
  );
  if (found) {
    return { key: `director-${found.memberId}`, roleLabel: '실장', name: found.name, email: found.email };
  }
  return { key: `director-${groupName}`, roleLabel: '실장', name: `${groupName} 실장`, email: '' };
}

function resolveCdo(members: Member[]): NotifyRecipient {
  const found = members.find((m) => m.useYn === '사용' && m.groupName === 'CDO실');
  if (found) {
    return { key: `cdo-${found.memberId}`, roleLabel: 'CDO', name: found.name, email: found.email };
  }
  return { key: 'cdo-default', roleLabel: 'CDO', name: 'CDO님', email: '' };
}

function resolveBrandHead(members: Member[], rental: Rental): NotifyRecipient {
  const brand = rental.sampleBrand || rental.borrowerGroup;
  const found = members.find(
    (m) =>
      m.useYn === '사용' &&
      ((m.brand && rental.sampleBrand && m.brand === rental.sampleBrand) || m.groupName === rental.borrowerGroup) &&
      m.role &&
      /브랜드|장/.test(m.role)
  );
  if (found) {
    return { key: `brand-${found.memberId}`, roleLabel: '브랜드장', name: found.name, email: found.email };
  }
  return { key: `brand-${brand}`, roleLabel: '브랜드장', name: `${brand} 브랜드장`, email: '' };
}

function recipientsForRental(rental: Rental, week: OverdueWeekFilter, members: Member[]): NotifyRecipient[] {
  const list: NotifyRecipient[] = [
    {
      key: `borrower-${rental.rentalId}`,
      roleLabel: '대여자',
      name: rental.borrowerName,
      email: rental.borrowerEmail || '',
    },
  ];
  const { ccRoles } = OVERDUE_WEEK_RULES[week];
  if (ccRoles.includes('director')) list.push(resolveDirector(members, rental.borrowerGroup));
  if (ccRoles.includes('cdo')) list.push(resolveCdo(members));
  if (ccRoles.includes('brandHead')) list.push(resolveBrandHead(members, rental));
  return list;
}

function aggregateNotifyRecipients(rentals: Rental[], week: OverdueWeekFilter, members: Member[]): NotifyRecipient[] {
  const map = new Map<string, NotifyRecipient>();
  rentals.forEach((rental) => {
    recipientsForRental(rental, week, members).forEach((recipient) => {
      if (!map.has(recipient.key)) map.set(recipient.key, recipient);
    });
  });
  return [...map.values()].sort(
    (a, b) =>
      RECIPIENT_ROLE_ORDER.indexOf(a.roleLabel) - RECIPIENT_ROLE_ORDER.indexOf(b.roleLabel) ||
      a.name.localeCompare(b.name, 'ko')
  );
}

function getOverdueWeek(daysOverdue: number): OverdueWeekFilter {
  if (daysOverdue <= 6) return 1;
  if (daysOverdue <= 13) return 2;
  if (daysOverdue <= 19) return 3;
  return 4;
}

// 앱 기준일 (연체·주간 집계 공통)
const TODAY = new Date('2026-06-09');
TODAY.setHours(0, 0, 0, 0);
const MS_DAY = 86400000;

function parseDay(s: string) {
  const d = new Date(s.substring(0, 10));
  d.setHours(0, 0, 0, 0);
  return d;
}

function inRange(dateStr: string | null | undefined, start: Date, end: Date) {
  if (!dateStr) return false;
  const d = parseDay(dateStr);
  return d >= start && d < end;
}

function weekBounds(ref: Date) {
  const start = new Date(ref);
  start.setDate(ref.getDate() - ((ref.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const prevStart = new Date(start);
  prevStart.setDate(start.getDate() - 7);
  return { thisStart: start, thisEnd: end, prevStart, prevEnd: start };
}

type PopularSamplePeriod = 'week' | '1month' | '3months';

const POPULAR_SAMPLE_PERIOD_OPTIONS: { id: PopularSamplePeriod; label: string }[] = [
  { id: 'week', label: '이번 주' },
  { id: '1month', label: '1개월' },
  { id: '3months', label: '3개월' },
];

function popularPeriodBounds(period: PopularSamplePeriod, ref: Date) {
  const end = new Date(ref);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);

  if (period === 'week') {
    const { thisStart } = weekBounds(ref);
    return { start: thisStart, end };
  }

  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (period === '1month' ? 30 : 90));
  return { start, end };
}

function sampleStatusBadgeClass(status: SampleStatus) {
  switch (status) {
    case '대여가능':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case '대여중':
      return 'bg-blue-50 text-blue-700 border-blue-100';
    case '연체중':
      return 'bg-rose-50 text-rose-700 border-rose-100';
    case '부평보관':
      return 'bg-amber-50 text-amber-700 border-amber-100';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function formatDueCountdownLabel(dueDate: string, ref: Date) {
  const days = Math.ceil((parseDay(dueDate).getTime() - ref.getTime()) / MS_DAY);
  if (days > 0) return `(D-${days})`;
  if (days < 0) return `(D+${Math.abs(days)})`;
  return '(D-day)';
}

function buildRentalTrendSeries(periodRentals: Rental[], period: PopularSamplePeriod, start: Date, end: Date) {
  const bucketCount = period === 'week' ? 7 : period === '1month' ? 4 : 12;
  const spanMs = Math.max(end.getTime() - start.getTime(), MS_DAY);
  const bucketMs = spanMs / bucketCount;
  const counts = Array.from({ length: bucketCount }, () => 0);

  periodRentals.forEach((r) => {
    const t = parseDay(r.rentDate).getTime();
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - start.getTime()) / bucketMs)));
    counts[idx] += 1;
  });

  let cumulative = 0;
  return counts.map((c) => {
    cumulative += c;
    return cumulative;
  });
}

function getPopularSampleInsights(
  code: string,
  allRentals: Rental[],
  period: PopularSamplePeriod,
  ref: Date,
) {
  const { start, end } = popularPeriodBounds(period, ref);
  const periodRentals = allRentals
    .filter((r) => r.sampleCode === code && inRange(r.rentDate, start, end))
    .sort((a, b) => a.rentDate.localeCompare(b.rentDate));

  const deptMap = new Map<string, number>();
  periodRentals.forEach((r) => {
    const dept = r.borrowerGroup || '미지정';
    deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
  });

  const activeRental = allRentals
    .filter((r) => r.sampleCode === code && r.status !== '반납완료')
    .sort((a, b) => b.rentDate.localeCompare(a.rentDate))[0];

  return {
    total: periodRentals.length,
    trendPoints: buildRentalTrendSeries(periodRentals, period, start, end),
    deptBreakdown: [...deptMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
    activeRental,
  };
}

function PopularSampleSparkline({ points, total }: { points: number[]; total: number }) {
  const width = 120;
  const height = 36;
  const max = Math.max(...points, 1);
  const polyline = points
    .map((value, index) => {
      const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - (value / max) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="relative rounded-md bg-slate-50 border border-slate-100 px-2 pt-2 pb-1 min-h-[44px]">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-9" aria-hidden="true">
        <polyline fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
      </svg>
      <span className="absolute right-2 bottom-1 text-[10px] font-extrabold text-violet-600">{total}회</span>
    </div>
  );
}

function WoWBadge({ delta, lowerIsBetter = false }: { delta: number; lowerIsBetter?: boolean }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
        <Minus className="w-3 h-3" /> 전주 대비 0
      </span>
    );
  }
  const up = delta > 0;
  const good = lowerIsBetter ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${good ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon className="w-3 h-3" />
      {up ? '+' : ''}{delta} 전주
    </span>
  );
}

export default function DashboardView({
  samples,
  rentals,
  members = [],
  onNavigateToRentals,
  onNavigateToSamples,
  showOnlyCharts = false,
  onRefreshData,
}: DashboardViewProps) {
  // Compute critical summaries
  const totalSamples = samples.length;
  const availableCount = samples.filter((s) => s.status === '대여가능').length;
  const onLoanCount = samples.filter((s) => s.status === '대여중').length;
  const todayStr = TODAY.toISOString().substring(0, 10);
  const overdueCount = rentals.filter((r) => effectiveRentalStatus(r, todayStr) === '연체중').length;
  const lostCount = samples.filter((s) => s.status === '분실').length;
  const bupyeongCount = samples.filter((s) => s.status === '부평보관').length;

  // Overdue lists for alert panel
  const activeOverdues = rentals.filter((r) => effectiveRentalStatus(r, todayStr) === '연체중');

  const [popularSamplePeriod, setPopularSamplePeriod] = useState<PopularSamplePeriod>('week');
  const [expandedPopularCode, setExpandedPopularCode] = useState<string | null>(null);

  const popularSamplesTop5 = useMemo(() => {
    const { start, end } = popularPeriodBounds(popularSamplePeriod, TODAY);
    const periodRentals = rentals.filter((r) => inRange(r.rentDate, start, end));

    const rentalCounts = new Map<string, number>();
    const deptCountsBySample = new Map<string, Map<string, number>>();

    periodRentals.forEach((r) => {
      rentalCounts.set(r.sampleCode, (rentalCounts.get(r.sampleCode) || 0) + 1);
      const dept = r.borrowerGroup || '미지정';
      if (!deptCountsBySample.has(r.sampleCode)) deptCountsBySample.set(r.sampleCode, new Map());
      const deptMap = deptCountsBySample.get(r.sampleCode)!;
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });

    const topDeptOf = (code: string) => {
      const deptMap = deptCountsBySample.get(code);
      if (!deptMap || deptMap.size === 0) return '-';
      return [...deptMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };

    return [...rentalCounts.entries()]
      .map(([code, count]) => {
        const sample = samples.find((s) => s.code === code);
        const rental = periodRentals.find((r) => r.sampleCode === code);
        return {
          code,
          name: sample?.name || rental?.sampleName || code,
          department: topDeptOf(code),
          count,
          sample,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [rentals, samples, popularSamplePeriod]);

  // 기준일(시스템 표준일) 대비 연체 일수
  const overdueDaysOf = (r: Rental) => {
    const dueTime = new Date(r.dueDate).getTime();
    return Math.ceil(Math.abs(TODAY.getTime() - dueTime) / MS_DAY);
  };

  // Local states for AI notification panel
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('전체');
  const [overdueWeekFilter, setOverdueWeekFilter] = useState<OverdueWeekFilter>(1);
  const [managerTask, setManagerTask] = useState<ManagerTask>('overdue');
  const [bulkSending, setBulkSending] = useState(false);
  const overdueScrollRef = useRef<HTMLDivElement>(null);

  const selectOverdueWeek = (week: OverdueWeekFilter) => {
    const scrollTop = overdueScrollRef.current?.scrollTop ?? 0;
    setOverdueWeekFilter(week);
    requestAnimationFrame(() => {
      if (overdueScrollRef.current) overdueScrollRef.current.scrollTop = scrollTop;
    });
  };

  const overdueDeptOptions = useMemo(
    () => [...new Set(activeOverdues.map((r) => r.borrowerGroup).filter(Boolean))].sort(),
    [activeOverdues]
  );

  const hasListFilters =
    !!searchQuery.trim() ||
    filterDept !== '전체';

  const overdueWeekCounts = useMemo(() => {
    const counts: Record<OverdueWeekFilter, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    activeOverdues.forEach((r) => {
      counts[getOverdueWeek(overdueDaysOf(r))] += 1;
    });
    return counts;
  }, [activeOverdues]);

  const dueSoonRentals = useMemo(() => {
    const { thisEnd } = weekBounds(TODAY);
    return rentals.filter((r) => {
      if (r.status === '반납완료') return false;
      if (!r.dueDate) return false;
      const due = parseDay(r.dueDate);
      // 기준일 기준 이번 주 내 반납 예정 (아직 반납일 전·당일)
      return due >= TODAY && due < thisEnd;
    });
  }, [rentals]);

  const daysUntilDue = (r: Rental) => {
    const due = parseDay(r.dueDate);
    return Math.ceil((due.getTime() - TODAY.getTime()) / MS_DAY);
  };

  const formatDueCountdown = (dueDate: string) => {
    const due = parseDay(dueDate);
    const daysLeft = Math.ceil((due.getTime() - TODAY.getTime()) / MS_DAY);
    if (daysLeft <= 0) return 'D-00';
    if (daysLeft < 10) return `D-0${daysLeft}`;
    return `D-${daysLeft}`;
  };

  const managerActions = useMemo(
    () =>
      [
        {
          id: 'overdue' as const,
          count: activeOverdues.length,
          title: `연체 ${activeOverdues.length}건 — 반납 알림 발송 필요`,
          sub: '에이전트가 단계별 메일 자동 발송',
          icon: AlertTriangle,
          cardClass: 'bg-rose-100/70 hover:bg-rose-100 border border-rose-100/80',
          activeClass: 'bg-rose-100 border border-rose-200',
          iconClass: 'text-rose-600',
        },
        {
          id: 'due-soon' as const,
          count: dueSoonRentals.length,
          title: `반납 예정 ${dueSoonRentals.length}건 (이번 주)`,
          sub: '반납일 임박 — 사전 안내 권장',
          icon: Clock,
          cardClass: 'bg-amber-50 hover:bg-amber-100/80',
          activeClass: 'bg-amber-100',
          iconClass: 'text-amber-600',
        },
      ],
    [activeOverdues.length, dueSoonRentals.length]
  );

  const taskMeta = {
    overdue: {
      title: '연체 알림 발송',
      desc: '연체 주차별로 확인하고 반납 알림 메일을 발송하세요.',
      badge: `${overdueWeekCounts[overdueWeekFilter]}건`,
      badgeClass: 'bg-rose-100 text-rose-700',
      headerClass: 'border-rose-100/60 bg-gradient-to-r from-rose-50/20 to-transparent',
      pulseClass: 'bg-rose-600',
      pingClass: 'bg-rose-400',
    },
    'due-soon': {
      title: '반납 예정 사전 안내',
      desc: '이번 주 반납 예정 건에 사전 안내 메일을 보내세요.',
      badge: `${dueSoonRentals.length}건`,
      badgeClass: 'bg-amber-100 text-amber-800',
      headerClass: 'border-slate-100/60 bg-white',
      pulseClass: 'bg-amber-500',
      pingClass: 'bg-amber-400',
    },
  } as const;

  const activeTaskMeta = taskMeta[managerTask];

  const matchSearch = (query: string, ...values: (string | undefined)[]) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return values.some((v) => (v || '').toLowerCase().includes(q));
  };

  const weekStats = useMemo(() => {
    const { thisStart, thisEnd, prevStart, prevEnd } = weekBounds(TODAY);
    const tomorrow = new Date(TODAY.getTime() + MS_DAY);

    const thisWeekRent = rentals.filter((r) => inRange(r.rentDate, thisStart, tomorrow)).length;
    const lastWeekRent = rentals.filter((r) => inRange(r.rentDate, prevStart, prevEnd)).length;
    const thisWeekReturn = rentals.filter((r) => inRange(r.returnDate, thisStart, tomorrow)).length;
    const lastWeekReturn = rentals.filter((r) => inRange(r.returnDate, prevStart, prevEnd)).length;
    const thisWeekNewOverdue = rentals.filter(
      (r) => effectiveRentalStatus(r, todayStr) === '연체중' && inRange(r.dueDate, thisStart, tomorrow)
    ).length;
    const lastWeekNewOverdue = rentals.filter(
      (r) => effectiveRentalStatus(r, todayStr) === '연체중' && inRange(r.dueDate, prevStart, prevEnd)
    ).length;
    const thisWeekReg = samples.filter((s) => inRange(s.regDate, thisStart, tomorrow)).length;
    const lastWeekReg = samples.filter((s) => inRange(s.regDate, prevStart, prevEnd)).length;

    const avgOverdue =
      activeOverdues.length > 0
        ? activeOverdues.reduce((sum, r) => sum + overdueDaysOf(r), 0) / activeOverdues.length
        : 0;

    return {
      thisWeekRent,
      lastWeekRent,
      thisWeekReturn,
      lastWeekReturn,
      thisWeekNewOverdue,
      lastWeekNewOverdue,
      thisWeekReg,
      lastWeekReg,
      avgOverdue,
    };
  }, [rentals, samples, activeOverdues]);

  const handleSendAutomatedEmail = async (rental: Rental) => {
    if (!confirm(`${rental.borrowerName} 님에게 반납 요청 메일을 발송하시겠습니까?`)) return;
    setSendingId(rental.rentalId);
    try {
      const ok = await sendOverdueNotification(rental, getOverdueWeek(overdueDaysOf(rental)));
      if (ok) {
        alert(`${rental.borrowerName} 님에게 반납 요청 메일이 성공적으로 전송되었습니다.`);
        if (onRefreshData) onRefreshData();
        else window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert('반납 요청 메일 전송 중 통신 오류가 발생했습니다.');
    } finally {
      setSendingId(null);
    }
  };

  const sendOverdueNotification = async (rental: Rental, week: OverdueWeekFilter): Promise<boolean> => {
    const daysOverdue = Math.max(1, overdueDaysOf(rental));
    const tone = emailTypeForWeek(week);

    const draftRes = await fetch('/api/agent/draft-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        borrowerName: rental.borrowerName,
        borrowerGroup: rental.borrowerGroup,
        sampleName: rental.sampleName,
        sampleCode: rental.sampleCode,
        dueDate: rental.dueDate,
        daysOverdue,
        emailType: tone,
      }),
    });
    const draftData = await draftRes.json();

    const sendRes = await fetch('/api/agent/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rentalId: rental.rentalId,
        subject: draftData.subject || `[반납 촉구 안내] 대여하신 의류 샘플 반납 기한 경과 안내`,
        content: draftData.content || `안녕하세요, ${rental.borrowerName}님.\n\n대여 중인 의류 샘플의 빠른 반납 부탁드립니다.`,
      }),
    });
    const sendData = await sendRes.json();

    if (!sendData.success) {
      alert(`발송 실패 (${rental.borrowerName}): ${sendData.message}`);
      return false;
    }
    return true;
  };

  const handleBulkSendOverdueEmails = async () => {
    if (filteredOverdues.length === 0) return;

    const rule = OVERDUE_WEEK_RULES[overdueWeekFilter];
    if (
      !confirm(
        `${filteredOverdues.length}건 연체 알림을 일괄 발송합니다.\n\n` +
          `· ${overdueWeekFilter}주차 · ${rule.summary}\n` +
          `· 발송 예정 ${overdueNotifyRecipients.length}명`
      )
    ) {
      return;
    }

    setBulkSending(true);
    let success = 0;
    let fail = 0;

    for (const rental of filteredOverdues) {
      setSendingId(rental.rentalId);
      try {
        const ok = await sendOverdueNotification(rental, overdueWeekFilter);
        if (ok) success += 1;
        else fail += 1;
      } catch (err) {
        console.error(err);
        fail += 1;
      }
    }

    setSendingId(null);
    setBulkSending(false);

    if (fail === 0) {
      alert(`${success}건 연체 알림 메일을 일괄 발송했습니다.`);
    } else {
      alert(`발송 완료 ${success}건 · 실패 ${fail}건`);
    }

    if (onRefreshData) onRefreshData();
    else window.location.reload();
  };

  const sendPreNoticeNotification = async (rental: Rental): Promise<boolean> => {
    const daysLeft = Math.max(0, daysUntilDue(rental));
    const draftRes = await fetch('/api/agent/draft-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        borrowerName: rental.borrowerName,
        borrowerGroup: rental.borrowerGroup,
        sampleName: rental.sampleName,
        sampleCode: rental.sampleCode,
        dueDate: rental.dueDate,
        daysOverdue: 0,
        emailType: 'gentle',
        daysUntilDue: daysLeft,
      }),
    });
    const draftData = await draftRes.json();

    const sendRes = await fetch('/api/agent/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rentalId: rental.rentalId,
        subject: draftData.subject || `[반납 안내] 대여하신 의류 샘플 반납 예정일 안내`,
        content: draftData.content || `안녕하세요, ${rental.borrowerName}님.\n\n대여 중인 의류 샘플의 반납 예정일을 안내드립니다.`,
      }),
    });
    const sendData = await sendRes.json();

    if (!sendData.success) {
      alert(`발송 실패 (${rental.borrowerName}): ${sendData.message}`);
      return false;
    }
    return true;
  };

  const handleSendPreNoticeEmail = async (rental: Rental) => {
    if (!confirm(`${rental.borrowerName} 님에게 반납 예정 사전 안내 메일을 발송하시겠습니까?`)) return;

    setSendingId(rental.rentalId);
    try {
      const ok = await sendPreNoticeNotification(rental);
      if (ok) {
        alert(`${rental.borrowerName} 님에게 사전 안내 메일이 전송되었습니다.`);
        if (onRefreshData) onRefreshData();
        else window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert('사전 안내 메일 전송 중 통신 오류가 발생했습니다.');
    } finally {
      setSendingId(null);
    }
  };

  const handleBulkSendPreNoticeEmails = async () => {
    if (filteredDueSoon.length === 0) return;

    const recipientCount = preNoticeNotifyRecipients.length;
    if (
      !confirm(
        `${filteredDueSoon.length}건 반납 예정 사전 안내를 일괄 발송합니다.\n\n` +
          `· 이번 주 반납 예정 건\n` +
          `· 발송 예정 ${recipientCount}명`
      )
    ) {
      return;
    }

    setBulkSending(true);
    let success = 0;
    let fail = 0;

    for (const rental of filteredDueSoon) {
      setSendingId(rental.rentalId);
      try {
        const ok = await sendPreNoticeNotification(rental);
        if (ok) success += 1;
        else fail += 1;
      } catch (err) {
        console.error(err);
        fail += 1;
      }
    }

    setSendingId(null);
    setBulkSending(false);

    if (fail === 0) {
      alert(`${success}건 사전 안내 메일을 일괄 발송했습니다.`);
    } else {
      alert(`발송 완료 ${success}건 · 실패 ${fail}건`);
    }

    if (onRefreshData) onRefreshData();
    else window.location.reload();
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

  const filteredOverdues = activeOverdues
    .filter((overdue) => {
      if (getOverdueWeek(overdueDaysOf(overdue)) !== overdueWeekFilter) return false;
      if (filterDept !== '전체' && overdue.borrowerGroup !== filterDept) return false;
      return matchSearch(
        searchQuery,
        overdue.sampleBrand,
        overdue.borrowerGroup,
        overdue.sampleCode,
        overdue.borrowerName,
        overdue.sampleName
      );
    })
    .sort((a, b) => overdueDaysOf(b) - overdueDaysOf(a));

  const overdueNotifyRecipients = useMemo(
    () => aggregateNotifyRecipients(filteredOverdues, overdueWeekFilter, members),
    [filteredOverdues, overdueWeekFilter, members]
  );

  const filteredDueSoon = dueSoonRentals
    .filter((rental) => {
      if (filterDept !== '전체' && rental.borrowerGroup !== filterDept) return false;
      return matchSearch(
        searchQuery,
        rental.sampleBrand,
        rental.borrowerGroup,
        rental.sampleCode,
        rental.borrowerName,
        rental.sampleName
      );
    })
    .sort((a, b) => daysUntilDue(a) - daysUntilDue(b));

  const preNoticeNotifyRecipients = useMemo(() => {
    const names = new Set(filteredDueSoon.map((rental) => rental.borrowerName));
    return Array.from(names);
  }, [filteredDueSoon]);

  const taskListCount =
    managerTask === 'overdue'
      ? filteredOverdues.length
      : hasListFilters
        ? filteredDueSoon.length
        : dueSoonRentals.length;

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
                <div className="text-[10px] font-semibold text-rose-700">연체</div>
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
      {/* Numerical Quick KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4" id="kpi-grid">
        {([
          {
            id: 'kpi-all', label: '전체 샘플', val: totalSamples, unit: '개',
            icon: Package, color: 'text-slate-600 bg-slate-100', link: 'samples' as const,
            wow: weekStats.thisWeekReg - weekStats.lastWeekReg,
            sub: weekStats.thisWeekReg > 0 ? `이번 주 신규 ${weekStats.thisWeekReg}건` : undefined,
          },
          {
            id: 'kpi-avail', label: '대여 가능', val: availableCount, unit: '개',
            icon: UserCheck, color: 'text-emerald-600 bg-emerald-50', link: 'samples' as const,
            sub: totalSamples > 0 ? `가용률 ${Math.round((availableCount / totalSamples) * 100)}%` : undefined,
          },
          {
            id: 'kpi-loan', label: '대여중', val: onLoanCount, unit: '개',
            icon: RefreshCw, color: 'text-blue-600 bg-blue-50', link: 'rentals' as const,
            wow: weekStats.thisWeekRent - weekStats.lastWeekRent,
            sub: `이번 주 대여 ${weekStats.thisWeekRent}건`,
          },
          {
            id: 'kpi-overdue', label: '연체', val: overdueCount, unit: '건',
            icon: AlertTriangle, color: 'text-rose-600 bg-rose-50', link: 'rentals' as const,
            highlight: true, lowerIsBetter: true,
            wow: weekStats.thisWeekNewOverdue - weekStats.lastWeekNewOverdue,
            sub: `평균 ${weekStats.avgOverdue.toFixed(1)}일 · 목표 0건`,
          },
          {
            id: 'kpi-lost', label: '분실', val: lostCount, unit: '건',
            icon: ThumbsDown, color: 'text-slate-500 bg-slate-100', link: 'samples' as const,
            sub: lostCount > 0 ? '분실 처리 샘플' : '분실 0건',
          },
          {
            id: 'kpi-bupyeong', label: '부평 보관', val: bupyeongCount, unit: '건',
            icon: Package, color: 'text-amber-600 bg-amber-50', link: 'samples' as const,
            sub: bupyeongCount > 0 ? '부평 창고 보관 중' : '보관 0건',
          },
        ]).map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.id}
              className={`p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex flex-col justify-between min-h-[7.5rem] cursor-pointer hover:shadow-md transition-all ${
                kpi.highlight ? 'ring-2 ring-rose-500/15' : ''
              }`}
              onClick={kpi.link === 'samples' ? onNavigateToSamples : onNavigateToRentals}
              id={kpi.id}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-slate-500 block">{kpi.label}</span>
                  {kpi.sub && (
                    <span className="text-[10px] text-slate-400 font-medium truncate block mt-0.5">{kpi.sub}</span>
                  )}
                </div>
                <div className={`p-2 rounded-lg shrink-0 ${kpi.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight text-slate-800">{kpi.val}</span>
                  <span className="text-xs text-slate-400">{kpi.unit}</span>
                </div>
                {kpi.wow !== undefined && (
                  <WoWBadge delta={kpi.wow} lowerIsBetter={kpi.lowerIsBetter} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Overdue Workspace & Notification Center Centerpiece */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-main-workspace-row">
        
        {/* Left Side: Overdue list control board (lg:col-span-2) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between overflow-hidden lg:h-[600px]" id="dashboard-overdue-list-panel">
          
          {/* Header Area */}
          <div className={`p-5 border-b space-y-3 ${activeTaskMeta.headerClass}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-2.5 w-2.5 relative shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeTaskMeta.pingClass}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeTaskMeta.pulseClass}`}></span>
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
                    {activeTaskMeta.title}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${activeTaskMeta.badgeClass}`}>
                      {activeTaskMeta.badge}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">{activeTaskMeta.desc}</p>
                </div>
              </div>

              <span className="shrink-0 self-center text-[11px] text-slate-400 font-extrabold font-mono uppercase tracking-wide whitespace-nowrap">
                상품 수: {taskListCount.toLocaleString()}개
              </span>
            </div>

            {/* Filters & Sort */}
            <div className="flex items-center gap-x-2 gap-y-2 flex-nowrap min-w-0">
              <span className="text-[10px] font-bold text-slate-400 shrink-0">부서</span>
              <div className="relative shrink-0">
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="appearance-none h-7 bg-white border border-slate-200 pl-2.5 pr-7 rounded-lg text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500/30 cursor-pointer"
                >
                  <option value="전체">전체</option>
                  {overdueDeptOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {managerTask === 'overdue' && (
                <>
                  <span className="mx-0.5 h-3.5 w-px bg-slate-200 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">연체 기준</span>
                  {([1, 2, 3, 4] as const).map((week) => (
                    <button
                      key={week}
                      type="button"
                      onClick={() => selectOverdueWeek(week)}
                      className={`h-7 px-2.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                        overdueWeekFilter === week
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {week}주
                    </button>
                  ))}
                </>
              )}

              <div className="flex-1 min-w-2" aria-hidden="true" />

              <div className="relative h-7 w-[17rem] shrink-0 flex items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="업체명, 부서, 상품코드, 대여자명 검색..."
                  className={`box-border h-7 w-full pl-8 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-rose-500/30 font-sans placeholder:text-slate-400 ${searchQuery ? 'pr-8' : 'pr-3'}`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {managerTask === 'overdue' && (
              <div className="rounded-lg border border-rose-100/80 bg-white/70 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-slate-700">
                      연체 {overdueWeekFilter}주 · {OVERDUE_WEEK_RULES[overdueWeekFilter].summary}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {filteredOverdues.length}건 · 발송 예정 <span className="font-bold text-rose-600">{overdueNotifyRecipients.length}명</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBulkSendOverdueEmails}
                    disabled={bulkSending || filteredOverdues.length === 0}
                    className="shrink-0 h-8 px-3 rounded-lg bg-rose-600 text-white text-[11px] font-extrabold flex items-center gap-1.5 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {bulkSending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        발송 중...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        일괄 발송
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {managerTask === 'due-soon' && (
              <div className="rounded-lg border border-slate-100/80 bg-white px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-slate-700">
                      이번 주 반납 예정 · 사전 안내 메일
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {filteredDueSoon.length}건 · 발송 예정 <span className="font-bold text-amber-600">{preNoticeNotifyRecipients.length}명</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBulkSendPreNoticeEmails}
                    disabled={bulkSending || filteredDueSoon.length === 0}
                    className="shrink-0 h-8 px-3 rounded-lg bg-amber-600 text-white text-[11px] font-extrabold flex items-center gap-1.5 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {bulkSending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        발송 중...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        일괄 발송
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Task list container */}
          <div ref={overdueScrollRef} className="p-5 space-y-4 flex-1 overflow-y-auto" id="dashboard-overdues-scroll-area font-sans">
            {managerTask === 'overdue' && filteredOverdues.length === 0 && (
              <div className="py-24 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <div className="p-4 bg-slate-50 rounded-full text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-bounce" />
                </div>
                <span className="font-bold text-slate-600 block mt-2 font-sans">{overdueWeekFilter}주차 연체 건이 없습니다.</span>
                <span className="text-[11px] font-sans">다른 주차를 선택해 보세요.</span>
              </div>
            )}

            {managerTask === 'due-soon' && filteredDueSoon.length === 0 && (
              <div className="py-24 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <div className="p-4 bg-slate-50 rounded-full text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-bounce" />
                </div>
                <span className="font-bold text-slate-600 block mt-2 font-sans">이번 주 반납 예정 건이 없습니다.</span>
                <span className="text-[11px] font-sans">사전 안내가 필요한 대여 건이 없습니다.</span>
              </div>
            )}

            {managerTask === 'overdue' && filteredOverdues.map((overdue) => {
                const diffDays = overdueDaysOf(overdue);
                const hasNotifiedBefore = overdue.notifyCount > 0;
                
                // Find matching sample to get details & image
                const sample = samples.find(s => s.code === overdue.sampleCode);

                return (
                  <div
                    key={overdue.rentalId}
                    className="p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border-slate-200/80 hover:border-slate-300"
                    id={`overdue-card-${overdue.rentalId}`}
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
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0 border-t border-slate-50 md:border-0 pt-3 md:pt-0">

                      {/* Control Operations Block */}
                      <div className="flex items-center gap-1.5" id={`dashboard-overdue-controls-${overdue.rentalId}`}>
                        
                        {/* Send Automated Notification Button */}
                        <button
                          onClick={() => handleSendAutomatedEmail(overdue)}
                          disabled={sendingId === overdue.rentalId}
                          className={`py-1.5 px-3 rounded-lg shadow-sm font-bold text-[11px] flex items-center gap-1 transition-colors active:scale-[0.98] cursor-pointer ${
                            hasNotifiedBefore
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              : 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100'
                          } disabled:opacity-50`}
                          id={hasNotifiedBefore ? `btn-overdue-action-resend-${overdue.rentalId}` : `btn-overdue-action-first-${overdue.rentalId}`}
                        >
                          {sendingId === overdue.rentalId ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              전송 중...
                            </>
                          ) : hasNotifiedBefore ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              메일 재발송
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3.5 h-3.5" />
                              메일 발송
                            </>
                          )}
                        </button>

                        {/* 발송 횟수 아이콘 표시 */}
                        {hasNotifiedBefore && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-150 py-1 px-2 rounded-full font-mono"
                            title={`반납 요청 메일 ${overdue.notifyCount}회 발송${overdue.lastNotifyDate ? ` · 최종 ${overdue.lastNotifyDate.substring(5, 16)}` : ''}`}
                          >
                            <History className="w-3 h-3 text-indigo-500" />
                            {overdue.notifyCount}
                          </span>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })}

            {managerTask === 'due-soon' && filteredDueSoon.map((rental) => {
              const sample = samples.find((s) => s.code === rental.sampleCode);
              const countdown = formatDueCountdown(rental.dueDate);

              return (
                <div
                  key={rental.rentalId}
                  className="p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border-slate-200/80 hover:border-slate-300"
                  id={`due-soon-card-${rental.rentalId}`}
                >
                  <div className="flex items-center gap-4 flex-1 w-full min-w-0">
                    <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center relative shadow-xs">
                      {sample?.imgFront ? (
                        <img src={sample.imgFront} alt={rental.sampleName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-slate-100 text-slate-400">
                          <Package className="w-6 h-6 text-amber-500" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 py-0.5 px-2 rounded font-mono uppercase tracking-tight">
                          {rental.sampleCode}
                        </span>
                      </div>
                      <h4 className="text-[12.5px] font-extrabold text-slate-800 line-clamp-1 tracking-tight" title={rental.sampleName}>
                        {rental.sampleName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-sans">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <strong className="text-slate-700">{rental.borrowerName}</strong>
                          <span className="text-slate-400">({rental.borrowerGroup})</span>
                        </div>
                        <span className="text-slate-300">•</span>
                        <span className="text-amber-700 font-extrabold flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                          <Clock className="w-3 h-3 block" />
                          반납예정 {countdown}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0 border-t border-slate-50 md:border-0 pt-3 md:pt-0">
                    <button
                      onClick={() => handleSendPreNoticeEmail(rental)}
                      disabled={bulkSending || sendingId === rental.rentalId}
                      className="py-1.5 px-3 rounded-lg shadow-sm font-bold text-[11px] flex items-center gap-1 transition-colors active:scale-[0.98] cursor-pointer bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                    >
                      {sendingId === rental.rentalId ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          전송 중...
                        </>
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          사전 안내 발송
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* Right Side: Active Diagnostics Dashboard (lg:col-span-1) */}
        <div id="dashboard-active-desk-panel" className="lg:h-[0px] flex-none lg:h-[600px] flex flex-col">
          
          {/* Overdue Asset Risk Diagnostics & Intelligence Dashboard */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden gap-3" id="homespace-diagnostics-panel">
            <div className="flex justify-between items-center pb-1 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-indigo-500 block shrink-0" />
                <h3 className="text-sm font-extrabold text-slate-800">관리자 업무</h3>
              </div>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-extrabold font-mono uppercase">
                Manager Actions
              </span>
            </div>

            <div className="space-y-2.5 shrink-0" id="manager-action-cards">
              {managerActions.map((action) => {
                const Icon = action.icon;
                const isActive = managerTask === action.id;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => {
                      setManagerTask(action.id);
                      if (overdueScrollRef.current) overdueScrollRef.current.scrollTop = 0;
                    }}
                    className={`w-full text-left p-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-3 ${
                      isActive ? action.activeClass : action.cardClass
                    }`}
                    id={`manager-action-${action.id}`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 bg-white/80 ${action.iconClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-extrabold leading-snug text-slate-800">{action.title}</p>
                      <p className="text-[10px] font-medium mt-0.5 text-slate-500">{action.sub}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-600' : 'text-slate-300'}`} />
                  </button>
                );
              })}
            </div>

            <div className="shrink-0 mt-4 flex-1 min-h-0 flex flex-col" id="popular-samples-panel">
              <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Flame className="w-4.5 h-4.5 text-violet-600 block shrink-0" />
                  <h3 className="text-sm font-extrabold text-slate-800 whitespace-nowrap">인기 샘플 TOP 5</h3>
                </div>
                <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-xl shrink-0" id="popular-sample-period-tabs">
                  {POPULAR_SAMPLE_PERIOD_OPTIONS.map((option) => {
                    const isActive = popularSamplePeriod === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setPopularSamplePeriod(option.id);
                          setExpandedPopularCode(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                          isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                        id={`popular-sample-period-${option.id}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 flex-1 min-h-0 overflow-y-auto" id="popular-samples-list">
                {popularSamplesTop5.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-6 font-medium">
                    선택 기간에 대여 이력이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {popularSamplesTop5.map((item, idx) => {
                      const rank = idx + 1;
                      const isTopThree = rank <= 3;
                      const isExpanded = expandedPopularCode === item.code;
                      const insights = getPopularSampleInsights(item.code, rentals, popularSamplePeriod, TODAY);
                      const sample = item.sample;
                      const isOnLoan = sample?.status === '대여중' || sample?.status === '연체중';
                      const maxDeptCount = insights.deptBreakdown[0]?.[1] || 1;
                      return (
                        <div
                          key={item.code}
                          className={`rounded-xl border transition-colors ${
                            isExpanded ? 'border-slate-200 bg-slate-50/80' : 'border-transparent hover:border-slate-100 hover:bg-slate-50/60'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPopularCode((prev) => (prev === item.code ? null : item.code))
                            }
                            className="w-full flex items-center gap-3 min-w-0 px-2 py-2 text-left cursor-pointer"
                            id={`popular-sample-row-${item.code}`}
                          >
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
                                isTopThree
                                  ? 'bg-violet-600 text-white'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              {rank}
                            </span>
                            <span className="text-[12px] font-bold text-slate-800 truncate flex-1 min-w-0" title={item.name}>
                              {item.name}
                            </span>
                            <span className="text-[11px] font-bold shrink-0 whitespace-nowrap">
                              <span className="text-violet-600">{item.department}</span>
                              <span className="text-slate-800 ml-1">{item.count}회</span>
                            </span>
                            <ChevronDown
                              className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${
                                isExpanded ? 'rotate-180 text-violet-600' : ''
                              }`}
                            />
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 pt-2 border-t border-slate-100 space-y-2.5" id={`popular-sample-detail-${item.code}`}>
                              <div className="rounded-lg border border-slate-100 bg-white p-2.5">
                                <div className={`grid gap-2 ${isOnLoan && insights.activeRental ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                  <div>
                                    <span className="text-[8px] font-bold text-slate-400 block mb-1">대여 상태</span>
                                    {sample?.status ? (
                                      <span className={`inline-flex text-[10px] font-bold py-1 px-2.5 rounded-full border ${sampleStatusBadgeClass(sample.status)}`}>
                                        {sampleStatusLabel(sample.status)}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400">-</span>
                                    )}
                                  </div>
                                  {isOnLoan && insights.activeRental && (
                                    <div className="min-w-0">
                                      <span className="text-[8px] font-bold text-slate-400 block mb-1">현재 대여자</span>
                                      <p className="text-[10px] font-extrabold text-slate-800 truncate">{insights.activeRental.borrowerName}</p>
                                      <p className="text-[9px] text-slate-500 font-mono truncate">
                                        ~{insights.activeRental.dueDate} {formatDueCountdownLabel(insights.activeRental.dueDate, TODAY)}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-100 bg-white p-2.5">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[8px] font-bold text-slate-400 block mb-1">최근 대여 추이</span>
                                    <PopularSampleSparkline points={insights.trendPoints} total={insights.total} />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[8px] font-bold text-slate-400 block mb-1.5">대여 부서 분포</span>
                                    {insights.deptBreakdown.length === 0 ? (
                                      <p className="text-[9px] text-slate-400 py-3">부서 데이터 없음</p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {insights.deptBreakdown.map(([dept, count]) => (
                                          <div key={dept} className="flex items-center gap-1.5 min-w-0">
                                            <span className="w-[52px] shrink-0 text-[8px] font-semibold text-slate-500 truncate" title={dept}>
                                              {dept}
                                            </span>
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-0">
                                              <div
                                                className="h-full bg-violet-400 rounded-full"
                                                style={{ width: `${Math.max(8, (count / maxDeptCount) * 100)}%` }}
                                              />
                                            </div>
                                            <span className="w-3 shrink-0 text-[8px] font-bold text-slate-600 text-right">{count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

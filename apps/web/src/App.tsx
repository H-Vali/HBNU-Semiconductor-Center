import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircuitBoard,
  Cpu,
  Download,
  Factory,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  Microscope,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  UserRound,
  Wrench
} from 'lucide-react';
import { equipment as fallbackEquipment, events, monthlyUsage, type EquipmentGroup, type EquipmentItem } from './data';

type PageKey = 'home' | 'facility' | 'equipment' | 'training' | 'reservations' | 'mypage' | 'admin' | 'login';
type Role = 'USER' | 'ADMIN';
type UsagePeriod = '24H' | '1W' | '1M';
type EquipmentRuntimeStatus = 'active' | 'maintenance' | 'idle';
type ReservationStatus = 'pending' | 'approved' | 'maintenance' | 'external';
type ReservationForm = {
  equipmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  reservationType?: 'use' | 'maintenance';
  userType?: 'internal' | 'external';
};
type ApiEquipmentItem = Partial<EquipmentItem> & { imageUrl?: string; usageConditions?: string };
type ReservationEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  status?: ReservationStatus;
  equipmentId?: string;
  createdBy?: string;
};

const apiUrl = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL) ?? 'http://localhost:4000';

const menu: Array<{ label: string; page: PageKey; icon: typeof Factory }> = [
  { label: '센터소개', page: 'facility', icon: Factory },
  { label: '시설안내', page: 'facility', icon: LayoutDashboard },
  { label: '장비현황', page: 'equipment', icon: Wrench },
  { label: '장비예약현황', page: 'reservations', icon: CalendarDays },
  { label: '교육신청', page: 'training', icon: GraduationCap },
  { label: '마이페이지', page: 'mypage', icon: UserRound }
];

const adminMenu: Array<{ label: string; page: PageKey; icon: typeof ShieldCheck }> = [
  { label: '관리자', page: 'admin', icon: ShieldCheck }
];

const quickLinks: Array<{ label: string; page: PageKey; icon: typeof CalendarDays }> = [
  { label: '장비 사용 예약', page: 'reservations', icon: CalendarDays },
  { label: '장비사용자 교육신청', page: 'training', icon: GraduationCap },
  { label: '장비 배치현황', page: 'equipment', icon: Microscope }
];
const categoryMeta: Record<EquipmentGroup, { title: string; subtitle: string; image: string; bullets: string[] }> = {
  process: {
    title: '공정',
    subtitle: '박막, 노광, 식각, 열처리 장비',
    image: 'https://images.unsplash.com/photo-1562408590-e32931084e23?auto=format&fit=crop&w=1200&q=85',
    bullets: ['Lithography / Coating', 'Deposition / Etching', 'Thermal Process', 'Packaging Support']
  },
  metrology: {
    title: '측정 및 분석',
    subtitle: '미세구조, 전기적 특성, 광학 분석 장비',
    image: 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=1200&q=85',
    bullets: ['Electron Microscopy', 'Surface Analysis', 'Electrical Measurement', 'Optical Spectroscopy']
  }
};

const reservationTimes = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, '0');
  const minute = index % 2 === 0 ? '00' : '30';
  return `${hour}:${minute}`;
});

function getSeoulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatReservationTime(value?: string) {
  if (!value) return '';
  const [, time = ''] = value.split('T');
  return time.slice(0, 5);
}

function toReservationDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function reservationOverlaps(startA: string, endA = startA, startB: string, endB = startB) {
  return new Date(startA).getTime() < new Date(endB).getTime() && new Date(startB).getTime() < new Date(endA).getTime();
}

function getEventEquipmentId(event: ReservationEvent, equipmentItems: EquipmentItem[]) {
  return event.equipmentId ?? equipmentItems.find((item) => event.title.includes(item.name))?.id ?? '';
}

function isEventForEquipment(event: ReservationEvent, equipment: EquipmentItem | undefined, equipmentItems: EquipmentItem[]) {
  if (!equipment) return true;
  return getEventEquipmentId(event, equipmentItems) === equipment.id || event.title.includes(equipment.name);
}

function isReservationActive(event: ReservationEvent, now = new Date()) {
  if (!event.end) return false;
  const currentTime = now.getTime();
  return new Date(event.start).getTime() <= currentTime && currentTime < new Date(event.end).getTime();
}

function isMaintenanceReservation(event: ReservationEvent) {
  return event.status === 'maintenance';
}

function isExternalReservation(event: ReservationEvent) {
  return event.status === 'external';
}

function normalizeReservationStatus(status: unknown): ReservationStatus {
  return status === 'maintenance' || status === 'external' || status === 'approved' || status === 'pending' ? status : 'approved';
}

function getRealtimeCategoryLabel(item: EquipmentItem) {
  if (/etch|rie/i.test(item.name)) return 'ETCHING';
  if (/aligner|mask|lithography|coater/i.test(item.name)) return 'LITHOGRAPHY';
  if (item.group === 'metrology') return 'METROLOGY';
  return 'PROCESS';
}

function getRuntimeStatusLabel(status: EquipmentRuntimeStatus) {
  if (status === 'active') return '가동중';
  if (status === 'maintenance') return '점검중';
  return '대기';
}

function toLocalReservationDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:00`;
}

function getReservationDurationHours(event: ReservationEvent) {
  if (!event.end) return 0;
  const duration = new Date(event.end).getTime() - new Date(event.start).getTime();
  return Math.max(duration / (1000 * 60 * 60), 0);
}

function buildUsageTrend(period: UsagePeriod, equipmentItems: EquipmentItem[], calendarEvents: ReservationEvent[]) {
  if (period === '1M') {
    return monthlyUsage.map((entry) => ({
      label: entry.month,
      hours: entry.hours,
      delta: entry.delta
    }));
  }

  const now = new Date();
  const totalEquipmentHours = equipmentItems.reduce((sum, item) => sum + item.usageHours, 0);

  if (period === '1W') {
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - index));
      const dateKey = getSeoulDateKey(day);
      const reservationHours = calendarEvents
        .filter((event) => getSeoulDateKey(new Date(event.start)) === dateKey)
        .reduce((sum, event) => sum + getReservationDurationHours(event), 0);
      const baseline = totalEquipmentHours / Math.max(equipmentItems.length, 1) * (0.42 + index * 0.018);

      return {
        label: new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(day),
        hours: Math.round(baseline + reservationHours * 12),
        delta: index === 6 ? 3 : 0
      };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const startHour = index * 4;
    const endHour = startHour + 4;
    const reservationHours = calendarEvents
      .filter((event) => {
        const eventDate = new Date(event.start);
        const eventHour = eventDate.getHours();
        return getSeoulDateKey(eventDate) === getSeoulDateKey(now) && eventHour >= startHour && eventHour < endHour;
      })
      .reduce((sum, event) => sum + getReservationDurationHours(event), 0);
    const baseline = totalEquipmentHours / Math.max(equipmentItems.length, 1) * (0.24 + index * 0.028);

    return {
      label: `${String(startHour).padStart(2, '0')}-${String(endHour).padStart(2, '0')}`,
      hours: Math.round(baseline + reservationHours * 10),
      delta: index === 5 ? 3 : 0
    };
  });
}

function createRealtimeTestReservations(equipmentItems: EquipmentItem[]): ReservationEvent[] {
  const testEquipmentItems = [equipmentItems[0], equipmentItems[1], equipmentItems[4], equipmentItems[13]].filter(Boolean);
  if (testEquipmentItems.length === 0) return [];
  const now = new Date();

  return testEquipmentItems.map((testEquipment, index) => {
    const start = new Date(now.getTime() - (30 + index * 10) * 60 * 1000);
    const end = new Date(now.getTime() + (90 + index * 15) * 60 * 1000);

    return {
      id: `preview-live-test-reservation-${index + 1}`,
      title: `${testEquipment.name} TEST 예약`,
      start: toLocalReservationDateTime(start),
      end: toLocalReservationDateTime(end),
      status: 'approved',
      equipmentId: testEquipment.id,
      createdBy: 'USER'
    };
  });
}

function getSeoulClockParts() {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour === '24' ? '00' : values.hour,
    minute: values.minute,
    second: values.second,
    weekday: values.weekday
  };
}

function normalizeEquipment(item: ApiEquipmentItem, index: number): EquipmentItem {
  const name = item.name ?? `Equipment ${index + 1}`;
  const inferredGroup: EquipmentGroup =
    item.group ??
    (item.category?.includes('공정') || ['Spin', 'Sputter', 'PECVD', 'RIE', 'Furnace', 'Aligner', 'Coater'].some((keyword) => name.includes(keyword))
      ? 'process'
      : 'metrology');

  return {
    id: item.id ?? `eq-${index + 1}`,
    name,
    category: inferredGroup === 'process' ? '공정장비' : '측정 및 분석장비',
    group: inferredGroup,
    groupName: inferredGroup === 'process' ? '공정' : '측정 및 분석',
    location: item.location ?? `공정동 ${Math.floor(index / 6) + 1}층`,
    image: item.image ?? item.imageUrl ?? fallbackEquipment[index % fallbackEquipment.length].image,
    features: item.features ?? ['예약 캘린더', '교육 인증', '사용 로그'],
    condition: item.condition ?? item.usageConditions ?? '교육 이수 후 사용 가능',
    utilization: item.utilization ?? fallbackEquipment[index % fallbackEquipment.length].utilization,
    usageHours: item.usageHours ?? fallbackEquipment[index % fallbackEquipment.length].usageHours
  };
}

function useEquipmentData() {
  const [items, setItems] = useState<EquipmentItem[]>(fallbackEquipment);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiUrl}/equipment`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('equipment api unavailable');
        return response.json();
      })
      .then((data: ApiEquipmentItem[]) => {
        setItems(data.map(normalizeEquipment));
        setSource('api');
      })
      .catch(() => {
        setItems(fallbackEquipment);
        setSource('fallback');
      });

    return () => controller.abort();
  }, []);

  return { items, setItems, source };
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  const headers = Object.keys(rows[0] ?? {});
  const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(','))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SectionTitle({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: string | ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div>
        {eyebrow && <p className="text-sm font-bold uppercase text-cyan-300">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-extrabold text-white">{title}</h2>
      </div>
      {typeof action === 'string' ? (
        <button className="rounded-md bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 hover:text-slate-950">
          {action}
        </button>
      ) : action}
    </div>
  );
}

function LoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-wafer">
        <div className="loading-wafer-grid" />
      </div>
      <p>페이지 이동 중</p>
    </div>
  );
}

function InstitutionHeader({ onNavigate, sessionRole }: { onNavigate: (page: PageKey) => void; sessionRole: Role | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-5 px-5 py-3 2xl:px-8">
        <button className="flex items-center gap-3 text-left" onClick={() => onNavigate('home')}>
          <div className="brand-mark">
            <CircuitBoard size={26} />
          </div>
          <div>
            <p className="text-xs font-bold text-cyan-300">HBNU SEMICONDUCTOR CENTER</p>
            <h1 className="text-lg font-extrabold text-white sm:text-xl">반도체 장비 공동활용 플랫폼</h1>
          </div>
        </button>
        <PartnerLogoStrip />
        <div className="hidden items-center gap-2 md:flex">
          <button className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300 hover:text-cyan-200">ENG</button>
          <button className="rounded-md bg-white px-4 py-2 text-sm font-extrabold text-slate-950 hover:bg-cyan-200" onClick={() => onNavigate('login')}>
            {sessionRole ? `${sessionRole} 접속중` : '로그인'}
          </button>
        </div>
      </div>
    </header>
  );
}

function PartnerLogoStrip() {
  const baseUrl = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.BASE_URL) ?? '/';
  const assetBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const partners = [
    { id: 'hanbat', name: '국립한밭대학교', src: `${assetBase}partners/hanbat-national-university.svg` },
    { id: 'daejeon', name: '대전광역시', src: `${assetBase}partners/daejeon-metropolitan-city.svg` },
    { id: 'djtp', name: '대전테크노파크', src: `${assetBase}partners/daejeon-technopark.svg` }
  ];

  return (
    <div className="partner-logo-strip" aria-label="협업 기관">
      <div className="partner-logo-list">
        {partners.map((partner) => (
          <div key={partner.name} className={`partner-logo-card partner-logo-card-${partner.id}`}>
            <img src={partner.src} alt={`${partner.name} 로고`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function useVisitorStats() {
  const [visitorStats, setVisitorStats] = useState({ today: 184, total: 12840 });

  useEffect(() => {
    const todayKey = getSeoulDateKey();
    const storageKey = 'hbnu-preview-visitor-stats';
    const sessionKey = `hbnu-preview-visitor-session-${todayKey}`;
    const baseToday = 184;
    const baseTotal = 12840;

    try {
      const stored = localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      let next = {
        date: todayKey,
        todayExtra: 0,
        totalExtra: Number(parsed?.totalExtra ?? 0)
      };

      if (parsed?.date === todayKey) {
        next = {
          date: todayKey,
          todayExtra: Number(parsed.todayExtra ?? 0),
          totalExtra: Number(parsed.totalExtra ?? 0)
        };
      }

      if (!sessionStorage.getItem(sessionKey)) {
        next = {
          ...next,
          todayExtra: next.todayExtra + 1,
          totalExtra: next.totalExtra + 1
        };
        sessionStorage.setItem(sessionKey, '1');
        localStorage.setItem(storageKey, JSON.stringify(next));
      }

      setVisitorStats({
        today: baseToday + next.todayExtra,
        total: baseTotal + next.totalExtra
      });
    } catch {
      setVisitorStats({ today: baseToday, total: baseTotal });
    }
  }, []);

  return visitorStats;
}

function SidebarNavigation({ activePage, onNavigate }: { activePage: PageKey; onNavigate: (page: PageKey) => void }) {
  const visitorStats = useVisitorStats();

  return (
    <div className="sidebar-stack">
      <aside className="app-sidebar" aria-label="주요 메뉴">
        <div className="sidebar-section-label">Navigation</div>
        <nav className="sidebar-nav">
          {menu.map((item) => {
            const Icon = item.icon;
            const selected = activePage === item.page;
            return (
              <button
                key={`${item.page}-${item.label}`}
                className={`sidebar-nav-item ${selected ? 'is-active' : ''}`}
                onClick={() => onNavigate(item.page)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-admin-block">
          <div className="sidebar-section-label">Admin</div>
          <nav className="sidebar-nav sidebar-nav-admin">
            {adminMenu.map((item) => {
              const Icon = item.icon;
              const selected = activePage === item.page;
              return (
                <button
                  key={`${item.page}-${item.label}`}
                  className={`sidebar-nav-item sidebar-nav-item-admin ${selected ? 'is-active' : ''}`}
                  onClick={() => onNavigate(item.page)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="visitor-counter-card" aria-label="방문자 통계">
        <div className="visitor-counter-head">
          <Gauge size={18} />
          <span>Visitor</span>
        </div>
        <div className="visitor-counter-row">
          <span>일 방문자</span>
          <strong>{visitorStats.today.toLocaleString('ko-KR')}</strong>
        </div>
        <div className="visitor-counter-row">
          <span>토탈 방문자</span>
          <strong>{visitorStats.total.toLocaleString('ko-KR')}</strong>
        </div>
      </div>
    </div>
  );
}

function Hero({ onNavigate, equipmentItems }: { onNavigate: (page: PageKey) => void; equipmentItems: EquipmentItem[] }) {
  const processStatusCards = [
    { label: 'Lithography', value: '12', unit: 'lots', tone: 'lithography' },
    { label: 'Deposition', value: '18', unit: 'runs', tone: 'deposition' },
    { label: 'Etching', value: '9', unit: 'recipes', tone: 'etching' },
    { label: 'Metrology', value: '41', unit: 'samples', tone: 'metrology' }
  ];

  return (
    <section className="hero-panel relative overflow-hidden">
      <div className="hero-intro">
        <div className="hero-intro-copy">
          <p className="hero-breadcrumb">N-FACILITY · FAB OPERATION · EQUIPMENT RESERVATION</p>
          <h2 className="hero-title">
              <span>국립한밭대학교 창의융합교육센터</span>
              <span>인프라 <em>통합 관리</em> 시스템</span>
          </h2>
          <p className="hero-copy">
            장비 소개, 교육 인증, 예약 승인, 사용률 분석을 통합해 연구자와 관리자가 같은 데이터를 보고 움직이는 운영 플랫폼입니다.
          </p>
        </div>
        <div className="hero-action-group">
          {quickLinks.map((link, index) => {
            const Icon = link.icon;
            return (
              <button
                key={link.label}
                aria-label={link.label}
                className={`hero-action-button ${index === 0 ? 'is-primary' : 'is-secondary'}`}
                onClick={() => onNavigate(link.page)}
                type="button"
              >
                <Icon size={16} aria-hidden="true" />
                {link.label}
              </button>
            );
          })}
        </div>
        <div className="hero-user-summary" aria-label="사용자 예약 요약">
          <div className="hero-user-summary-head">
            <h3><strong>USER NAME</strong> 님 환영합니다.</h3>
            <span>Prof. 백근우 Lab</span>
          </div>
          <div className="hero-reservation-list">
            <div className="hero-reservation-row">
              <time>14:00</time>
              <strong>FE-SEM</strong>
              <span>이용 예약</span>
            </div>
            <div className="hero-reservation-row">
              <time>16:30</time>
              <strong>XRD</strong>
              <span>이용 예약</span>
            </div>
          </div>
          <div className="hero-user-summary-foot">
            <span>오늘 이용 예약 2건</span>
            <button type="button" aria-label="내 예약 전체 보기">전체 보기</button>
          </div>
        </div>
      </div>
      <div className="hero-metrics-panel">
        <div>
          <p className="hero-section-label">금주 공정 현황</p>
          <div className="hero-process-grid">
            {processStatusCards.map((item) => (
              <div key={item.label} className={`process-status-card is-${item.tone}`}>
                <p>{item.label}</p>
                <strong>{item.value}<span>{item.unit}</span></strong>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="hero-section-label">운영 지표</p>
          <StatGrid equipmentItems={equipmentItems} />
        </div>
      </div>
    </section>
  );
}

function StatGrid({ equipmentItems }: { equipmentItems: EquipmentItem[] }) {
  const totalHours = monthlyUsage[monthlyUsage.length - 1].hours;
  const monthlyDelta = monthlyUsage[monthlyUsage.length - 1].delta;
  const averageUtilization = Math.round(equipmentItems.reduce((sum, item) => sum + item.utilization, 0) / equipmentItems.length);

  const statCards = [
    { label: '운영 장비', value: `${equipmentItems.length}`, unit: '종', detail: '공정·측정·분석', icon: Wrench, type: 'text' as const },
    { label: '월간 가동시간', value: `${totalHours.toLocaleString()}`, unit: 'h', detail: `전월 대비 ${monthlyDelta > 0 ? '+' : ''}${monthlyDelta}%`, icon: Gauge, type: 'trend' as const },
    { label: '교육 인증', value: '312', unit: '명', detail: '최근 30일 신규 27명', icon: CheckCircle2, type: 'text' as const },
    { label: 'FAB 가동률', value: `${averageUtilization}`, unit: '%', detail: 'Cleanroom active', icon: Cpu, type: 'gauge' as const }
  ];

  return (
    <div className="stat-grid">
      {statCards.map((card) => {
        const Icon = card.icon;
        const TrendIcon = monthlyDelta >= 0 ? TrendingUp : TrendingDown;

        return (
          <div key={card.label} className="stat-card">
            <div className="stat-card-heading">
              <Icon size={16} aria-hidden="true" />
              <span>{card.label}</span>
            </div>
            <p className="stat-card-value">{card.value}<span>{card.unit}</span></p>
            {card.type === 'trend' && (
              <p className="stat-card-detail is-trend">
                <TrendIcon size={13} aria-hidden="true" />
                {card.detail}
              </p>
            )}
            {card.type === 'text' && <p className="stat-card-detail">{card.detail}</p>}
            {card.type === 'gauge' && (
              <div className="stat-progress" aria-label={`FAB 가동률 ${averageUtilization}%`}>
                <span style={{ width: `${averageUtilization}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RealtimeEquipmentStatus({
  equipmentItems,
  calendarEvents
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
}) {
  const [clock, setClock] = useState(getSeoulClockParts);
  const statusItems = equipmentItems.map((item) => {
    const maintenanceEvent = calendarEvents.find((event) => isMaintenanceReservation(event) && isEventForEquipment(event, item, equipmentItems) && isReservationActive(event));
    const activeEvent = calendarEvents.find((event) => !isMaintenanceReservation(event) && isEventForEquipment(event, item, equipmentItems) && isReservationActive(event));
    const status: EquipmentRuntimeStatus = maintenanceEvent ? 'maintenance' : activeEvent ? 'active' : 'idle';
    return {
      item,
      activeEvent: maintenanceEvent ?? activeEvent,
      status
    };
  });
  const activeCount = statusItems.filter((entry) => entry.status === 'active').length;
  const maintenanceCount = statusItems.filter((entry) => entry.status === 'maintenance').length;
  const idleCount = Math.max(statusItems.length - activeCount - maintenanceCount, 0);
  const sliderItems = statusItems.length > 0 ? [...statusItems, ...statusItems] : [];

  useEffect(() => {
    const timer = window.setInterval(() => setClock(getSeoulClockParts()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="chart-card realtime-equipment-card rounded-lg border border-white/10 bg-[#101114] p-5">
      <div className="realtime-equipment-header mb-4">
        <div>
          <p className="text-sm font-bold text-teal-300">실시간 모니터링</p>
          <h3 className="mt-1 text-2xl font-extrabold text-white">장비 구동 현황</h3>
        </div>
        <div className="realtime-digital-clock" aria-label="서울 기준 실시간 시계">
          <span>{clock.year}</span>
          <em>/</em>
          <span>{clock.month}</span>
          <em>/</em>
          <span>{clock.day}</span>
          <em>/</em>
          <span>{clock.weekday}</span>
          <i aria-hidden="true" />
          <strong>{clock.hour}</strong>
          <em>:</em>
          <strong>{clock.minute}</strong>
          <em>:</em>
          <strong>{clock.second}</strong>
        </div>
        <div className="realtime-status-summary">
          <span className="runtime-summary-pill is-active">가동중 {activeCount}</span>
          <span className="runtime-summary-pill is-maintenance">점검 {maintenanceCount}</span>
          <span className="runtime-summary-pill is-idle">대기 {idleCount}</span>
        </div>
      </div>
      <div className="realtime-equipment-viewport" aria-label="장비 구동 현황">
        <div className="realtime-equipment-track">
          {sliderItems.map(({ item, activeEvent, status }, index) => (
            <article key={`${item.id}-${index}`} className={`realtime-equipment-item is-${status}`}>
              <div className="realtime-equipment-item-top">
                <p>{getRealtimeCategoryLabel(item)}</p>
                <span className={`runtime-status-badge is-${status}`}>{getRuntimeStatusLabel(status)}</span>
              </div>
              <h4>{item.name}</h4>
              <span>
                {status === 'active'
                  ? `${formatReservationTime(activeEvent?.start)} - ${formatReservationTime(activeEvent?.end)} ${activeEvent && isExternalReservation(activeEvent) ? '외부 사용' : '종료'}`
                  : status === 'maintenance'
                    ? `${formatReservationTime(activeEvent?.start)} - ${formatReservationTime(activeEvent?.end)} 점검`
                    : '현재 예약 없음'}
              </span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthlyUsageChart({
  equipmentItems,
  calendarEvents
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
}) {
  const [period, setPeriod] = useState<UsagePeriod>('1M');
  const chartData = useMemo(() => buildUsageTrend(period, equipmentItems, calendarEvents), [period, equipmentItems, calendarEvents]);
  const maxEntry = chartData.reduce((max, entry) => entry.hours > max.hours ? entry : max, chartData[0]);
  const averageValue = Math.round(chartData.reduce((sum, entry) => sum + entry.hours, 0) / Math.max(chartData.length, 1));
  const latestDelta = chartData[chartData.length - 1]?.delta ?? 0;
  const periodOptions: UsagePeriod[] = ['24H', '1W', '1M'];

  return (
    <div className="chart-card usage-trend-card rounded-lg border border-white/10 bg-[#101114] p-5">
      <div className="usage-trend-header">
        <div>
          <p className="text-sm font-bold uppercase text-teal-300">사용 분석</p>
          <h3 className="mt-1 text-2xl font-extrabold text-white">장비 사용시간 추이</h3>
        </div>
        <div className="usage-period-toggle" aria-label="사용시간 기간 선택">
          {periodOptions.map((option) => (
            <button
              key={option}
              className={period === option ? 'is-active' : ''}
              onClick={() => setPeriod(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="usage-trend-summary">
        <span>평균 <strong>{averageValue.toLocaleString()}h</strong></span>
        <span>최고 <strong>{maxEntry?.hours.toLocaleString()}h</strong>{period === '1M' ? ` (${maxEntry?.label})` : ''}</span>
        <span className={latestDelta >= 0 ? 'is-up' : 'is-down'}>
          {latestDelta >= 0 ? '전월 대비' : '전기간 대비'} {latestDelta > 0 ? '+' : ''}{latestDelta}%
        </span>
      </div>
      <div className="h-[24rem] 2xl:h-[30rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 28, right: 18, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="usage-bar-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d6b0" stopOpacity={0.92} />
                <stop offset="100%" stopColor="#25496e" stopOpacity={0.92} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
            <XAxis dataKey="label" stroke="#8b96a8" tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,.12)' }} />
            <YAxis
              stroke="#8b96a8"
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,.12)' }}
              tickFormatter={(value) => `${value}h`}
              ticks={[0, 250, 500, 750, 1000]}
              domain={[0, 1000]}
              width={58}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,.04)' }}
              contentStyle={{ background: '#050607', border: '1px solid rgba(255,255,255,.12)', borderRadius: '8px', color: '#fff' }}
              labelStyle={{ color: '#aeb6c2' }}
              formatter={(value) => [`${Number(value).toLocaleString()}h`, '장비 사용시간']}
            />
            <ReferenceLine
              y={averageValue}
              stroke="#f5b942"
              strokeDasharray="5 5"
              strokeOpacity={0.78}
              label={{ value: `평균 ${averageValue}h`, position: 'insideTopRight', fill: '#f5b942', fontSize: 12 }}
            />
            <Bar className="usage-bar-series" dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={44}>
              {chartData.map((entry) => (
                <Cell key={entry.label} fill={entry.label === maxEntry?.label ? '#34d6b0' : 'url(#usage-bar-fill)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <div className="flex gap-3">
          <span>Range: 0-1000h</span>
          <span>High: {maxEntry?.hours.toLocaleString()}h</span>
        </div>
        <span className="inline-flex items-center gap-2 text-white"><span className="h-3 w-3 rounded-sm bg-teal-300" /> 장비 사용시간</span>
      </div>
    </div>
  );
}

function EquipmentGateway({
  equipmentItems,
  onOpen,
  action = '장비 추가'
}: {
  equipmentItems: EquipmentItem[];
  onOpen: (group: EquipmentGroup) => void;
  action?: string | ReactNode;
}) {
  const grouped = {
    process: equipmentItems.filter((item) => item.group === 'process'),
    metrology: equipmentItems.filter((item) => item.group === 'metrology')
  };

  return (
    <section className="mt-5" id="장비목록요약">
      <SectionTitle title="장비 목록" eyebrow="Equipment Inventory" action={action} />
      <div className="grid gap-5 lg:grid-cols-2">
        {(Object.keys(categoryMeta) as EquipmentGroup[]).map((group) => {
          const meta = categoryMeta[group];
          return (
            <button key={group} className="facility-tab compact overflow-hidden rounded-lg border border-white/10 bg-surface/85 text-left hover:border-cyan-300/70" onClick={() => onOpen(group)}>
              <div className="relative h-56 overflow-hidden">
                <img className="h-full w-full object-cover" src={meta.image} alt={meta.title} />
                <div className="absolute inset-x-0 bottom-0 bg-blue-950/80 px-6 py-4">
                  <h3 className="text-2xl font-extrabold text-white">{meta.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-cyan-100">{meta.subtitle}</p>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-4 h-0.5 w-8 bg-blue-500" />
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-400">등록 장비</p>
                    <p className="mt-1 text-3xl font-extrabold text-white">{grouped[group].length}종</p>
                  </div>
                  <span className="rounded-md bg-white/10 px-3 py-1 text-sm font-bold text-cyan-200">보기</span>
                </div>
                <ul className="grid gap-2 text-sm text-slate-300">
                  {meta.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2"><span className="text-slate-500">•</span>{bullet}</li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Dashboard({
  equipmentItems,
  calendarEvents,
  onNavigate,
  onOpenEquipment
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  onNavigate: (page: PageKey) => void;
  onOpenEquipment: (group: EquipmentGroup) => void;
}) {
  return (
    <section className="mt-5 grid gap-5">
      <Hero onNavigate={onNavigate} equipmentItems={equipmentItems} />
      <RealtimeEquipmentStatus equipmentItems={equipmentItems} calendarEvents={calendarEvents} />
      <MonthlyUsageChart equipmentItems={equipmentItems} calendarEvents={calendarEvents} />
      <EquipmentGateway equipmentItems={equipmentItems} onOpen={onOpenEquipment} />
    </section>
  );
}

function EquipmentPage({
  equipmentItems,
  source,
  initialGroup,
  sessionRole,
  onAddEquipment,
  onDeleteEquipment
}: {
  equipmentItems: EquipmentItem[];
  source: 'api' | 'fallback';
  initialGroup: EquipmentGroup;
  sessionRole: Role | null;
  onAddEquipment: (item: EquipmentItem) => void;
  onDeleteEquipment: (equipmentId: string) => void;
}) {
  const [activeGroup, setActiveGroup] = useState<EquipmentGroup>(initialGroup);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planImage, setPlanImage] = useState<string | null>(null);
  const isAdmin = sessionRole === 'ADMIN';

  useEffect(() => setActiveGroup(initialGroup), [initialGroup]);

  const grouped = useMemo(() => ({
    process: equipmentItems.filter((item) => item.group === 'process'),
    metrology: equipmentItems.filter((item) => item.group === 'metrology')
  }), [equipmentItems]);
  const activeItems = grouped[activeGroup];

  return (
    <section id="장비현황" className="grid gap-5">
      <SectionTitle
        title="장비현황"
        eyebrow="Equipment Inventory"
        action={
          isAdmin ? (
            <button
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 hover:text-slate-950"
              onClick={() => setShowUploadModal(true)}
              title="실습실 도면 이미지 업로드"
            >
              <Plus size={17} /> 도면 업로드
            </button>
          ) : null
        }
      />
      <CleanroomPlanSection image={planImage} />
      <EquipmentGateway
        equipmentItems={equipmentItems}
        onOpen={setActiveGroup}
        action={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
            <button className="rounded-md bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 hover:text-slate-950" onClick={() => setShowAddModal(true)}>
              장비 추가
            </button>
            <button className="inline-flex items-center gap-2 rounded-md border border-red-300/30 px-5 py-2.5 text-sm font-bold text-red-100 hover:bg-red-500 hover:text-white" onClick={() => setShowDeleteModal(true)}>
              <Trash2 size={16} /> 장비 삭제
            </button>
            </div>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(Object.keys(categoryMeta) as EquipmentGroup[]).map((group) => (
            <button key={group} className={`rounded-md px-4 py-2 text-sm font-bold ${activeGroup === group ? 'bg-blue-700 text-white' : 'bg-white/5 text-slate-300 hover:bg-blue-700 hover:text-white'}`} onClick={() => setActiveGroup(group)}>
              {categoryMeta[group].title}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-400">데이터 소스: {source === 'api' ? 'API 연동' : '로컬 샘플 fallback'}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {activeItems.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-lg border border-white/10 bg-surface/85">
            <img className="h-40 w-full object-cover" src={item.image} alt={item.name} />
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-cyan-300">{item.category}</p>
                  <h3 className="mt-1 text-xl font-bold text-white">{item.name}</h3>
                </div>
                <span className="rounded-md bg-blue-500/20 px-2 py-1 text-xs font-bold text-blue-200">{item.location}</span>
              </div>
              <p className="mb-4 text-sm text-slate-300">{item.condition}</p>
              <div className="flex flex-wrap gap-2">
                {item.features.map((feature) => <span key={feature} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">{feature}</span>)}
              </div>
            </div>
          </article>
        ))}
      </div>
      {showUploadModal && <PlanUploadModal onClose={() => setShowUploadModal(false)} onUpload={(image) => { setPlanImage(image); setShowUploadModal(false); }} />}
      {showAddModal && <EquipmentAddModal onClose={() => setShowAddModal(false)} onAdd={(item) => { onAddEquipment(item); setActiveGroup(item.group); setShowAddModal(false); }} />}
      {showDeleteModal && <EquipmentDeleteModal equipmentItems={equipmentItems} onClose={() => setShowDeleteModal(false)} onDelete={(equipmentId) => { onDeleteEquipment(equipmentId); setShowDeleteModal(false); }} />}
    </section>
  );
}

function CleanroomPlanSection({ image }: { image: string | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-surface/85 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase text-cyan-300">Cleanroom Floor Plan</p>
          <h3 className="mt-1 text-2xl font-extrabold text-white">실습실 도면 3D 배치 공간</h3>
        </div>
      </div>
      <div className="cleanroom-plan-space">
        {image ? (
          <img className="cleanroom-plan-image" src={image} alt="업로드된 실습실 도면" />
        ) : (
          <div className="cleanroom-3d-draft" aria-label="클린룸 3D 도면 가안">
            <div className="cleanroom-room room-process">
              <strong>Process Zone</strong>
              <span>Lithography / Deposition / Etching</span>
            </div>
            <div className="cleanroom-room room-metrology">
              <strong>Metrology Zone</strong>
              <span>SEM / XRD / Probe Station</span>
            </div>
            <div className="cleanroom-room room-utility">
              <strong>Utility Core</strong>
              <span>Gas / Power / Exhaust</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanUploadModal({ onClose, onUpload }: { onClose: () => void; onUpload: (image: string) => void }) {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  function loadFile(file?: File) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(String(reader.result));
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    loadFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    loadFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="reservation-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-2xl font-extrabold text-white">실습실 도면 업로드</h3>
          <button type="button" className="rounded-md border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300 hover:text-cyan-200" onClick={onClose}>
            닫기
          </button>
        </div>
        <label className="upload-drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
          <UploadCloud size={34} />
          <strong>이미지 파일을 선택하거나 이곳에 드래그하세요.</strong>
          <span>{fileName || 'PNG, JPG, WEBP 파일 지원'}</span>
          <input type="file" accept="image/*" onChange={handleInput} />
        </label>
        {preview && <img className="upload-preview" src={preview} alt="업로드 미리보기" />}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-md border border-white/15 px-5 py-3 font-bold text-slate-200 hover:border-cyan-300" onClick={onClose}>취소</button>
          <button type="button" className="rounded-md bg-cyan-300 px-5 py-3 font-extrabold text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!preview} onClick={() => preview && onUpload(preview)}>
            업로드 적용
          </button>
        </div>
      </div>
    </div>
  );
}

function EquipmentAddModal({ onClose, onAdd }: { onClose: () => void; onAdd: (item: EquipmentItem) => void }) {
  const [form, setForm] = useState({ name: '', group: 'process' as EquipmentGroup, location: '공정동 1층', condition: '교육 이수 후 사용 가능' });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    onAdd({
      id: `eq-${Date.now()}`,
      name: form.name.trim(),
      category: form.group === 'process' ? '공정장비' : '측정 및 분석장비',
      group: form.group,
      groupName: form.group === 'process' ? '공정' : '측정 및 분석',
      location: form.location,
      image: form.group === 'process' ? categoryMeta.process.image : categoryMeta.metrology.image,
      features: ['예약 캘린더', '교육 인증', '사용 로그'],
      condition: form.condition,
      utilization: 0,
      usageHours: 0
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="reservation-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-2xl font-extrabold text-white">장비 추가</h3>
          <button type="button" className="rounded-md border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300 hover:text-cyan-200" onClick={onClose}>
            닫기
          </button>
        </div>
        <label className="reservation-label">장비명<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
        <label className="reservation-label">대분류<select value={form.group} onChange={(event) => setForm((current) => ({ ...current, group: event.target.value as EquipmentGroup }))}><option value="process">공정</option><option value="metrology">측정 및 분석</option></select></label>
        <label className="reservation-label">위치<input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} /></label>
        <label className="reservation-label">사용 조건<input value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))} /></label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-md border border-white/15 px-5 py-3 font-bold text-slate-200 hover:border-cyan-300" onClick={onClose}>취소</button>
          <button type="submit" className="rounded-md bg-cyan-300 px-5 py-3 font-extrabold text-slate-950 hover:bg-white">장비 등록</button>
        </div>
      </form>
    </div>
  );
}

function EquipmentDeleteModal({ equipmentItems, onClose, onDelete }: { equipmentItems: EquipmentItem[]; onClose: () => void; onDelete: (equipmentId: string) => void }) {
  const [equipmentId, setEquipmentId] = useState(equipmentItems[0]?.id ?? '');

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="reservation-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-2xl font-extrabold text-white">장비 삭제</h3>
          <button type="button" className="rounded-md border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300 hover:text-cyan-200" onClick={onClose}>
            닫기
          </button>
        </div>
        <p className="mb-4 text-sm leading-6 text-slate-300">삭제된 장비는 화면과 대시보드 그래프에서 제외됩니다. 누적 사용량 CSV 산출을 위한 원본 데이터는 관리자 통계에 남겨두는 구조입니다.</p>
        <label className="reservation-label">삭제할 장비<select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}>{equipmentItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-md border border-white/15 px-5 py-3 font-bold text-slate-200 hover:border-cyan-300" onClick={onClose}>취소</button>
          <button type="button" className="rounded-md bg-red-500 px-5 py-3 font-extrabold text-white hover:bg-red-400" onClick={() => equipmentId && onDelete(equipmentId)}>삭제 확정</button>
        </div>
      </div>
    </div>
  );
}

function SeoulClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return (
    <div className="seoul-clock" aria-label="서울 기준 현재 시각">
      <div>
        <span>SEOUL TIME</span>
        <strong>{values.year}.{values.month}.{values.day}</strong>
      </div>
      <time dateTime={now.toISOString()}>
        {values.hour}<em>:</em>{values.minute}<em>:</em>{values.second}
      </time>
    </div>
  );
}

function ReservationPage({
  equipmentItems,
  calendarEvents,
  sessionRole,
  onAddReservation,
  onDeleteReservation
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  sessionRole: Role | null;
  onAddReservation: (event: ReservationEvent) => void;
  onDeleteReservation: (reservationId: string) => void;
}) {
  const allEquipmentId = 'all-equipment';
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(allEquipmentId);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [reservationDate, setReservationDate] = useState(getSeoulDateKey());
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | EquipmentGroup>('all');
  const selectedEquipment = selectedEquipmentId === allEquipmentId ? undefined : equipmentItems.find((item) => item.id === selectedEquipmentId);
  const todayKey = getSeoulDateKey();
  const isAllLive = calendarEvents.some((event) => isReservationActive(event));
  const filteredEquipmentItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return equipmentItems.filter((item) => {
      const matchesSearch = !normalizedSearch || [item.name, item.category, item.location].some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesGroup = groupFilter === 'all' || item.group === groupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [equipmentItems, groupFilter, searchTerm]);

  function confirmReservation(form: ReservationForm) {
    const equipment = equipmentItems.find((item) => item.id === form.equipmentId);
    if (!equipment) return;

    const purpose = form.purpose.trim() ? ` - ${form.purpose.trim()}` : '';
    onAddReservation({
      id: `reservation-${Date.now()}`,
      title: `${equipment.name} 예약${purpose}`,
      start: toReservationDateTime(form.date, form.startTime),
      end: toReservationDateTime(form.date, form.endTime),
      status: sessionRole === 'ADMIN' ? 'approved' : 'pending',
      equipmentId: equipment.id,
      createdBy: sessionRole === 'ADMIN' ? 'ADMIN' : 'USER'
    });
    setSelectedEquipmentId(equipment.id);
    setShowReservationModal(false);
  }
  function openReservation(date = getSeoulDateKey()) {
    setReservationDate(date);
    setShowReservationModal(true);
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[22rem_1fr]" id="예약현황">
      <div className="rounded-lg border border-white/10 bg-surface/85 p-4">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal size={20} className="text-cyan-300" />
          <h2 className="text-lg font-bold text-white">장비 검색/필터</h2>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={17} />
          <input
            className="w-full rounded-md border border-white/10 bg-slate-950 px-9 py-2 text-sm outline-none focus:border-cyan-300"
            placeholder="장비명 검색"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <select
          className="mb-4 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300"
          value={groupFilter}
          onChange={(event) => setGroupFilter(event.target.value as 'all' | EquipmentGroup)}
        >
          <option value="all">전체 카테고리</option>
          <option value="process">공정장비</option>
          <option value="metrology">계측 및 분석장비</option>
        </select>
        <div className="reservation-equipment-list grid max-h-[34rem] gap-2 overflow-y-auto overflow-x-hidden pr-1">
          <button
            className={`reservation-equipment-button is-all-filter ${selectedEquipmentId === allEquipmentId ? 'is-selected' : ''} ${isAllLive ? 'is-live' : ''}`}
            onClick={() => setSelectedEquipmentId(allEquipmentId)}
          >
            <span className="reservation-equipment-name">
              {isAllLive && <span className="live-equipment-dot" aria-label="사용중" />}
              <span className="all-equipment-badge">ALL</span>
              <span className="min-w-0 truncate">전체 예약현황</span>
            </span>
            <span className="equipment-type-chip is-all">전체</span>
          </button>
          {filteredEquipmentItems.map((item, index) => {
            const isSelected = item.id === selectedEquipmentId || (!selectedEquipmentId && index === 0);
            const isProcess = item.group === 'process';
            const GroupIcon = isProcess ? Cpu : Microscope;
            const isLive = calendarEvents.some((event) => isEventForEquipment(event, item, equipmentItems) && isReservationActive(event));
            return (
              <button
                key={item.id}
                className={`reservation-equipment-button ${isSelected ? 'is-selected' : ''} ${isLive ? 'is-live' : ''}`}
                onClick={() => setSelectedEquipmentId(item.id)}
              >
                <span className="reservation-equipment-name">
                  {isLive && <span className="live-equipment-dot" aria-label="사용중" />}
                  <span className="min-w-0 truncate">{item.name}</span>
                </span>
                <span className={`equipment-type-chip ${isProcess ? 'is-process' : 'is-metrology'}`}>
                  <GroupIcon size={14} />
                  {isProcess ? '공정' : '계측 및 분석'}
                </span>
              </button>
            );
          })}
          {filteredEquipmentItems.length === 0 && (
            <p className="rounded-md border border-white/10 bg-white/5 px-3 py-4 text-center text-sm font-bold text-slate-400">검색 결과가 없습니다.</p>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-surface/85 p-5">
        <SectionTitle
          title={selectedEquipment ? `${selectedEquipment.name} \uC7A5\uBE44\uBCC4 \uC608\uC57D \uCE98\uB9B0\uB354` : '\uC804\uCCB4 \uC7A5\uBE44 \uC608\uC57D\uD604\uD669 \uCE98\uB9B0\uB354'}
          eyebrow="Equipment Calendar"
          action={
            <div className="flex gap-2">
              <button className="rounded-md bg-slate-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                내 예약 보기
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 hover:text-slate-950"
                onClick={() => openReservation()}
              >
                <Plus size={16} /> 장비예약
              </button>
            </div>
          }
        />
        <SeoulClock />
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={todayKey}
          timeZone="Asia/Seoul"
          selectable
          height="auto"
          dayCellClassNames={(arg) => (getSeoulDateKey(arg.date) === todayKey ? ['seoul-today'] : [])}
          dateClick={(arg) => openReservation(arg.dateStr)}
          eventClassNames={(arg) => [
            arg.event.extendedProps.status === 'maintenance' ? 'is-maintenance-event' : '',
            arg.event.extendedProps.status === 'external' ? 'is-external-event' : '',
            arg.event.start && arg.event.end && arg.event.start.getTime() <= Date.now() && Date.now() < arg.event.end.getTime() ? 'is-live-event' : ''
          ].filter(Boolean)}
          events={calendarEvents.filter((event) => isEventForEquipment(event, selectedEquipment, equipmentItems))}
        />
      </div>
      {showReservationModal && (
        <ReservationModalV2
          equipmentItems={equipmentItems}
          calendarEvents={calendarEvents}
          selectedEquipmentId={selectedEquipment?.id ?? equipmentItems[0]?.id ?? ''}
          initialDate={reservationDate}
          onClose={() => setShowReservationModal(false)}
          onConfirm={confirmReservation}
          onDeleteReservation={sessionRole === 'ADMIN' ? onDeleteReservation : undefined}
          allowMaintenanceReservation={sessionRole === 'ADMIN'}
          titleSuffix={sessionRole === 'ADMIN' ? '(ADMIN)' : ''}
        />
      )}
    </section>
  );
}

function ReservationModal({
  equipmentItems,
  selectedEquipmentId,
  initialDate,
  onClose,
  onConfirm
}: {
  equipmentItems: EquipmentItem[];
  selectedEquipmentId: string;
  initialDate: string;
  onClose: () => void;
  onConfirm: (form: ReservationForm) => void;
}) {
  const [form, setForm] = useState({
    equipmentId: selectedEquipmentId || equipmentItems[0]?.id || '',
    date: initialDate,
    startTime: '09:00',
    endTime: '10:00',
    purpose: ''
  });
  const endTimes = reservationTimes.filter((time) => time > form.startTime);

  function submit(event: FormEvent) {
    event.preventDefault();
    onConfirm(form);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="reservation-modal reservation-confirm-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-2xl font-extrabold text-white">장비 예약</h3>
          <button type="button" className="rounded-md border border-red-300/35 px-4 py-2 text-sm font-bold text-red-100 hover:border-red-300 hover:bg-red-500/20 hover:text-white" onClick={onClose}>
            닫기
          </button>
        </div>
        <label className="reservation-label">
          장비
          <select value={form.equipmentId} onChange={(event) => setForm((current) => ({ ...current, equipmentId: event.target.value }))}>
            {equipmentItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="reservation-label">
          예약일
          <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="reservation-label">
            시작 시간
            <select
              value={form.startTime}
              onChange={(event) => {
                const nextStart = event.target.value;
                setForm((current) => ({
                  ...current,
                  startTime: nextStart,
                  endTime: reservationTimes.find((time) => time > nextStart) ?? current.endTime
                }));
              }}
            >
              {reservationTimes.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </label>
          <label className="reservation-label">
            종료 시간
            <select value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}>
              {endTimes.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="reservation-label">
          예약 목적
          <input value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} placeholder="예: 박막 증착 공정" />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-md border border-red-300/35 px-5 py-3 font-bold text-red-100 hover:border-red-300 hover:bg-red-500/20 hover:text-white" onClick={onClose}>취소</button>
          <button type="submit" className="rounded-md bg-cyan-300 px-5 py-3 font-extrabold text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.24)] hover:bg-white">예약 확정</button>
        </div>
      </form>
    </div>
  );
}

function ReservationModalV2({
  equipmentItems,
  calendarEvents,
  selectedEquipmentId,
  initialDate,
  onClose,
  onConfirm,
  onDeleteReservation,
  allowMaintenanceReservation = false,
  titleSuffix = ''
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  selectedEquipmentId: string;
  initialDate: string;
  onClose: () => void;
  onConfirm: (form: ReservationForm) => void;
  onDeleteReservation?: (reservationId: string) => void;
  allowMaintenanceReservation?: boolean;
  titleSuffix?: string;
}) {
  const [form, setForm] = useState({
    equipmentId: selectedEquipmentId || equipmentItems[0]?.id || '',
    date: initialDate,
    startTime: '09:00',
    endTime: '10:00',
    purpose: '',
    reservationType: 'use' as 'use' | 'maintenance',
    userType: 'internal' as 'internal' | 'external'
  });

  const sameEquipmentReservations = calendarEvents.filter((event) => {
    const eventEquipmentId = getEventEquipmentId(event, equipmentItems);
    return event.start.slice(0, 10) === form.date && eventEquipmentId === form.equipmentId;
  });
  const availableStartTimes = reservationTimes.filter((time, index) => {
    const nextTime = reservationTimes[index + 1];
    if (!nextTime) return false;
    const slotStart = toReservationDateTime(form.date, time);
    const slotEnd = toReservationDateTime(form.date, nextTime);
    return !sameEquipmentReservations.some((event) => reservationOverlaps(slotStart, slotEnd, event.start, event.end));
  });
  const endTimes = reservationTimes.filter((time) => {
    if (time <= form.startTime) return false;
    const requestedStart = toReservationDateTime(form.date, form.startTime);
    const requestedEnd = toReservationDateTime(form.date, time);
    return !sameEquipmentReservations.some((event) => reservationOverlaps(requestedStart, requestedEnd, event.start, event.end));
  });
  const reservationsForDate = calendarEvents
    .filter((event) => event.start.slice(0, 10) === form.date && getEventEquipmentId(event, equipmentItems) === form.equipmentId)
    .sort((first, second) => first.start.localeCompare(second.start));
  const canSubmit = availableStartTimes.includes(form.startTime) && endTimes.includes(form.endTime);

  function updateStartTime(nextStart: string) {
    setForm((current) => {
      const nextEnd = reservationTimes.find((time) => time > nextStart && !sameEquipmentReservations.some((event) => reservationOverlaps(toReservationDateTime(current.date, nextStart), toReservationDateTime(current.date, time), event.start, event.end)));
      return { ...current, startTime: nextStart, endTime: nextEnd ?? current.endTime };
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onConfirm(form);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="reservation-modal reservation-confirm-modal reservation-modal-wide" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-2xl font-extrabold text-white">장비 예약 {titleSuffix}</h3>
          <button type="button" className="reservation-danger-button px-4 py-2 text-sm" onClick={onClose}>닫기</button>
        </div>
        <div className="reservation-modal-grid">
          <aside className="reservation-day-panel">
            <p className="text-xs font-extrabold uppercase text-cyan-300">Daily Schedule</p>
            <h4>{form.date} 예약현황</h4>
            <div className="reservation-day-list">
              {reservationsForDate.length > 0 ? (
                reservationsForDate.map((event) => (
                  <div key={event.id} className={`reservation-day-item ${isReservationActive(event) ? 'is-live' : ''} ${isMaintenanceReservation(event) ? 'is-maintenance' : ''} ${isExternalReservation(event) ? 'is-external' : ''}`}>
                    <span>{formatReservationTime(event.start)}{event.end ? ` - ${formatReservationTime(event.end)}` : ''}</span>
                    <strong>{event.title}</strong>
                    {isReservationActive(event) && <em>{isMaintenanceReservation(event) ? '점검중' : isExternalReservation(event) ? '외부 사용중' : '사용중'}</em>}
                    {onDeleteReservation && (
                      <button type="button" className="reservation-mini-danger" onClick={() => onDeleteReservation(event.id)}>삭제</button>
                    )}
                  </div>
                ))
              ) : (
                <p className="reservation-empty-state">선택한 날짜에 등록된 예약이 없습니다.</p>
              )}
            </div>
          </aside>
          <div className="reservation-form-fields">
            <label className="reservation-label">
              장비
              <select value={form.equipmentId} onChange={(event) => setForm((current) => ({ ...current, equipmentId: event.target.value }))}>
                {equipmentItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            {allowMaintenanceReservation && (
              <div className="reservation-admin-status-grid">
                <label className="reservation-label">
                  장비 점검
                  <select value={form.reservationType} onChange={(event) => setForm((current) => ({ ...current, reservationType: event.target.value as 'use' | 'maintenance' }))}>
                    <option value="use">일반 사용</option>
                    <option value="maintenance">장비 점검</option>
                  </select>
                </label>
                <label className="reservation-label">
                  외부 기업
                  <select value={form.userType} onChange={(event) => setForm((current) => ({ ...current, userType: event.target.value as 'internal' | 'external' }))}>
                    <option value="internal">내부 사용자</option>
                    <option value="external">외부 기업</option>
                  </select>
                </label>
              </div>
            )}
            <label className="reservation-label">
              예약일
              <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="reservation-label">
                시작 시간
                <select value={form.startTime} onChange={(event) => updateStartTime(event.target.value)}>
                  {reservationTimes.map((time, index) => (
                    <option key={time} value={time} disabled={index === reservationTimes.length - 1 || !availableStartTimes.includes(time)}>{time}</option>
                  ))}
                </select>
              </label>
              <label className="reservation-label">
                종료 시간
                <select value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}>
                  {reservationTimes.filter((time) => time > form.startTime).map((time) => (
                    <option key={time} value={time} disabled={!endTimes.includes(time)}>{time}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="reservation-label">
              예약 목적
              <input value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} placeholder="예: 박막 증착 공정" />
            </label>
            {!canSubmit && <p className="reservation-warning">이미 예약된 시간입니다. 다른 시간을 선택해주세요.</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="reservation-danger-button px-5 py-3" onClick={onClose}>취소</button>
          <button type="submit" className="reservation-confirm-button px-5 py-3" disabled={!canSubmit}>예약확정</button>
        </div>
      </form>
    </div>
  );
}
function TrainingPage({ equipmentItems }: { equipmentItems: EquipmentItem[] }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
      <div className="rounded-lg border border-white/10 bg-surface/85 p-5">
        <SectionTitle title="장비 사용 교육" eyebrow="Training" action="교육 신청" />
        <select className="mb-4 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-3 outline-none focus:border-cyan-300">
          {equipmentItems.map((item) => <option key={item.id}>{item.name} 교육 신청</option>)}
        </select>
        <div className="grid gap-3">
          {['PDF 교육자료', '안전 교육 영상', '교육완료 인증서'].map((title) => (
            <div key={title} className="flex items-center justify-between rounded-md bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <BookOpen className="text-cyan-300" size={20} />
                <span className="font-semibold text-white">{title}</span>
              </div>
              <button className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 hover:text-slate-950">열기</button>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-surface/85 p-5">
        <SectionTitle title="교육 완료 인증" eyebrow="Certification" />
        <div className="grid gap-3 text-sm text-slate-300">
          <p className="rounded-md bg-white/5 p-4">교육 이수 후 장비별 예약 권한이 자동 부여됩니다.</p>
          <p className="rounded-md bg-white/5 p-4">관리자는 교육 일정, 자료, 인증서를 이 화면에서 관리할 수 있습니다.</p>
        </div>
      </div>
    </section>
  );
}

function AdminPage({
  equipmentItems,
  calendarEvents,
  onAddReservation,
  onDeleteReservation
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  onAddReservation: (event: ReservationEvent) => void;
  onDeleteReservation: (reservationId: string) => void;
}) {
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedAdminDate, setSelectedAdminDate] = useState(getSeoulDateKey());
  const adminCalendarRef = useRef<FullCalendar | null>(null);
  const todayKey = getSeoulDateKey();
  const selectedDayReservations = useMemo(() => (
    calendarEvents
      .filter((event) => event.start.slice(0, 10) === selectedAdminDate)
      .sort((first, second) => first.start.localeCompare(second.start))
  ), [calendarEvents, selectedAdminDate]);
  const selectedDateLabel = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(new Date(`${selectedAdminDate}T00:00:00`));
  const equipmentRows = equipmentItems.map((item) => ({
    장비명: item.name,
    대분류: item.groupName,
    카테고리: item.category,
    위치: item.location,
    사용시간: item.usageHours,
    사용률: `${item.utilization}%`
  }));
  const monthlyRows = monthlyUsage.map((item) => ({
    월: item.month,
    총장비사용시간: item.hours,
    전월대비: `${item.delta > 0 ? '+' : ''}${item.delta}%`
  }));

  function confirmAdminReservation(form: ReservationForm) {
    const equipment = equipmentItems.find((item) => item.id === form.equipmentId);
    if (!equipment) return;
    const purpose = form.purpose.trim() ? ` - ${form.purpose.trim()}` : '';
    const isMaintenance = form.reservationType === 'maintenance';
    const isExternal = !isMaintenance && form.userType === 'external';
    const reservationStatus: ReservationStatus = isMaintenance ? 'maintenance' : isExternal ? 'external' : 'approved';
    onAddReservation({
      id: `admin-reservation-${Date.now()}`,
      title: `${equipment.name} ${isMaintenance ? '장비 점검' : isExternal ? '외부 기업 예약' : '관리자 예약'}${purpose}`,
      start: toReservationDateTime(form.date, form.startTime),
      end: toReservationDateTime(form.date, form.endTime),
      status: reservationStatus,
      equipmentId: equipment.id,
      createdBy: 'ADMIN'
    });
    setSelectedAdminDate(form.date);
    setShowReservationModal(false);
  }

  function moveAdminCalendarToToday() {
    setSelectedAdminDate(todayKey);
    adminCalendarRef.current?.getApi().today();
  }

  return (
    <section className="grid gap-5">
      <div className="admin-reservation-manager">
        <div className="admin-reservation-calendar">
          <div className="admin-reservation-panel-head">
            <div>
              <p>Reservation Calendar</p>
              <h3>예약관리 캘린더</h3>
              <span>월별 일정을 확인하고 날짜를 선택하세요.</span>
            </div>
          </div>
          <FullCalendar
            ref={adminCalendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={selectedAdminDate}
            timeZone="Asia/Seoul"
            selectable
            height="100%"
            contentHeight="auto"
            dayMaxEvents={2}
            dayMaxEventRows={2}
            moreLinkClick="popover"
            headerToolbar={{ left: 'title', center: '', right: 'adminToday prev,next' }}
            customButtons={{
              adminToday: {
                text: '오늘',
                click: moveAdminCalendarToToday
              }
            }}
            dayCellClassNames={(arg) => {
              const dateKey = getSeoulDateKey(arg.date);
              return [
                dateKey === todayKey ? 'seoul-today' : '',
                dateKey === selectedAdminDate ? 'admin-selected-day' : ''
              ].filter(Boolean);
            }}
            dateClick={(arg) => setSelectedAdminDate(arg.dateStr)}
            eventClassNames={(arg) => [
              arg.event.extendedProps.status === 'maintenance' ? 'is-maintenance-event' : '',
              arg.event.extendedProps.status === 'external' ? 'is-external-event' : '',
              arg.event.start && arg.event.end && arg.event.start.getTime() <= Date.now() && Date.now() < arg.event.end.getTime() ? 'is-live-event' : ''
            ].filter(Boolean)}
            events={calendarEvents}
          />
        </div>
        <aside className="admin-reservation-detail">
          <div className="admin-reservation-panel-head">
            <div>
              <p>Daily Reservations</p>
              <h3>{selectedDateLabel}</h3>
              <span>선택일 예약 {selectedDayReservations.length}건</span>
            </div>
            <button type="button" aria-label="선택한 날짜에 예약 추가" onClick={() => setShowReservationModal(true)}>
              <Plus size={16} /> 예약 추가
            </button>
          </div>
          <div className="admin-reservation-list">
            {selectedDayReservations.length > 0 ? (
              selectedDayReservations.map((event) => {
                const equipment = equipmentItems.find((item) => getEventEquipmentId(event, equipmentItems) === item.id);
                return (
                  <div key={event.id} className={`admin-reservation-row ${isReservationActive(event) ? 'is-live' : ''} ${isMaintenanceReservation(event) ? 'is-maintenance' : ''} ${isExternalReservation(event) ? 'is-external' : ''}`}>
                    <div>
                      <strong>{equipment?.name ?? event.title}</strong>
                      <span>{formatReservationTime(event.start)}{event.end ? ` - ${formatReservationTime(event.end)}` : ''}</span>
                      <em>{event.title}</em>
                    </div>
                    <button className="reservation-mini-danger" onClick={() => onDeleteReservation(event.id)}>예약 삭제</button>
                  </div>
                );
              })
            ) : (
              <p className="reservation-empty-state">선택한 날짜에 등록된 예약이 없습니다.</p>
            )}
          </div>
        </aside>
      </div>
      <SectionTitle title="관리자 대시보드" eyebrow="Admin CMS" action="홈페이지 편집" />
      <div className="rounded-lg border border-white/10 bg-surface/85 p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase text-cyan-300">Reservation Control</p>
            <h3 className="text-xl font-extrabold text-white">예약 관리</h3>
            <p className="mt-1 text-sm text-slate-400">관리자는 예약을 추가하거나 삭제할 수 있습니다.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-cyan-500 hover:text-slate-950" onClick={() => setShowReservationModal(true)}>
            <Plus size={16} /> 예약 추가
          </button>
        </div>
        <div className="admin-reservation-list">
          {calendarEvents.map((event) => (
            <div key={event.id} className={`admin-reservation-row ${isReservationActive(event) ? 'is-live' : ''} ${isMaintenanceReservation(event) ? 'is-maintenance' : ''} ${isExternalReservation(event) ? 'is-external' : ''}`}>
              <div>
                <strong>{event.title}</strong>
                <span>{event.start.slice(0, 10)} · {formatReservationTime(event.start)}{event.end ? ` - ${formatReservationTime(event.end)}` : ''}</span>
              </div>
              <button className="reservation-mini-danger" onClick={() => onDeleteReservation(event.id)}>예약 삭제</button>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-surface/85 p-6">
        <div className="mb-5 flex items-center gap-3">
          <Download className="text-cyan-300" size={22} />
          <div>
            <h3 className="text-xl font-extrabold text-white">통계 엑셀 내보내기</h3>
            <p className="mt-1 text-sm text-slate-400">관리자 권한 사용자는 장비 사용 데이터를 Excel에서 열 수 있는 CSV 파일로 내려받을 수 있습니다.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-md bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-cyan-500 hover:text-slate-950" onClick={() => downloadCsv('equipment-usage.csv', equipmentRows)}>
            장비별 사용량 엑셀 다운로드
          </button>
          <button className="rounded-md bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-cyan-500 hover:text-slate-950" onClick={() => downloadCsv('monthly-equipment-hours.csv', monthlyRows)}>
            월별 총 장비 사용시간 엑셀 다운로드
          </button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {['사용자관리', '장비관리', '예약승인/거부', '교육관리', '홈페이지편집', '대시보드 데이터', '권한관리', '공지사항', '운영 로그'].map((title) => (
          <button key={title} className="rounded-lg border border-white/10 bg-surface/85 p-6 text-left text-lg font-extrabold text-white hover:border-cyan-300 hover:bg-blue-500/20">
            {title}
            <p className="mt-2 text-sm font-medium text-slate-400">상세 관리 화면으로 이동</p>
          </button>
        ))}
      </div>
      {showReservationModal && (
        <ReservationModalV2
          equipmentItems={equipmentItems}
          calendarEvents={calendarEvents}
          selectedEquipmentId={equipmentItems[0]?.id ?? ''}
          initialDate={selectedAdminDate}
          onClose={() => setShowReservationModal(false)}
          onConfirm={confirmAdminReservation}
          onDeleteReservation={onDeleteReservation}
          allowMaintenanceReservation
          titleSuffix="(ADMIN)"
        />
      )}
    </section>
  );
}

function LoginPage({ onAuthenticated }: { onAuthenticated: (role: Role) => void }) {
  const [message, setMessage] = useState('Google 또는 Kakao OAuth로 로그인하세요.');

  async function handleLogin(provider: 'Google' | 'Kakao', role: Role = 'USER') {
    setMessage(`${provider} 인증을 확인하는 중입니다.`);

    try {
      const response = await fetch(`${apiUrl}/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (!response.ok) throw new Error('auth unavailable');
      const data = await response.json();
      localStorage.setItem('hbnu-session-token', data.token);
      localStorage.setItem('hbnu-session-user', JSON.stringify(data.user));
      onAuthenticated(data.user.role);
      setMessage(`${provider} 인증이 완료되었습니다.`);
    } catch {
      localStorage.setItem('hbnu-session-token', `preview-${provider.toLowerCase()}-${role}`);
      localStorage.setItem('hbnu-session-user', JSON.stringify({ name: role === 'ADMIN' ? '관리자' : '연구원', role }));
      onAuthenticated(role);
      setMessage(`${provider} 프리뷰 인증이 완료되었습니다. API 연결 시 실제 OAuth 콜백으로 교체됩니다.`);
    }
  }

  return (
    <section className="grid min-h-[34rem] gap-5 lg:grid-cols-[1fr_0.8fr]">
      <div className="rounded-lg border border-white/10 bg-surface/85 p-8">
        <div className="mb-8 flex items-center gap-4">
          <div className="rounded-md bg-cyan-300/10 p-3 text-cyan-300">
            <LockKeyhole size={26} />
          </div>
          <div>
            <p className="text-sm font-bold uppercase text-cyan-300">OAuth Login</p>
            <h2 className="mt-1 text-3xl font-extrabold text-white">로그인 / 회원가입</h2>
          </div>
        </div>
        <p className="mb-6 max-w-2xl text-slate-300">Google, Kakao OAuth 인증을 통해 예약, 교육, 마이페이지, 관리자 기능에 접근합니다.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="flex items-center justify-center gap-2 rounded-md bg-white px-5 py-4 text-base font-extrabold text-slate-950 hover:bg-cyan-100" onClick={() => handleLogin('Google')}>
            <LogIn size={20} /> Google로 계속
          </button>
          <button className="flex items-center justify-center gap-2 rounded-md bg-[#FEE500] px-5 py-4 text-base font-extrabold text-slate-950 hover:brightness-110" onClick={() => handleLogin('Kakao')}>
            <LogIn size={20} /> Kakao로 계속
          </button>
        </div>
        <button className="mt-4 rounded-md border border-cyan-300/40 px-5 py-3 text-sm font-bold text-cyan-200 hover:bg-cyan-300 hover:text-slate-950" onClick={() => handleLogin('Google', 'ADMIN')}>
          관리자 프리뷰 로그인
        </button>
        <p className="mt-5 rounded-md bg-white/5 p-4 text-sm text-slate-300">{message}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-slate-950/80 p-8">
        <h3 className="text-2xl font-extrabold text-white">인증 흐름</h3>
        <div className="mt-6 grid gap-4 text-sm text-slate-300">
          <p className="rounded-md bg-white/5 p-4">1. OAuth 제공자 선택</p>
          <p className="rounded-md bg-white/5 p-4">2. 백엔드 콜백에서 JWT 세션 발급</p>
          <p className="rounded-md bg-white/5 p-4">3. RBAC 권한에 따라 예약, 교육, 관리자 기능 접근</p>
        </div>
      </div>
    </section>
  );
}

function MyPage({
  equipmentItems,
  calendarEvents,
  onCancelReservation
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  onCancelReservation: (reservationId: string) => void;
}) {
  const myReservations = calendarEvents
    .filter((event) => event.createdBy !== 'ADMIN')
    .sort((first, second) => first.start.localeCompare(second.start));

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_0.65fr]">
      <div className="rounded-lg border border-white/10 bg-surface/85 p-6">
        <SectionTitle title="내 예약현황" eyebrow="My Reservations" />
        <div className="mypage-reservation-list">
          {myReservations.length > 0 ? (
            myReservations.map((event) => {
              const equipmentName = equipmentItems.find((item) => item.id === getEventEquipmentId(event, equipmentItems))?.name ?? event.title.split(' 예약')[0];
              return (
                <div key={event.id} className={`mypage-reservation-card ${isReservationActive(event) ? 'is-live' : ''}`}>
                  <div>
                    <p>{event.start.slice(0, 10)} · {formatReservationTime(event.start)}{event.end ? ` - ${formatReservationTime(event.end)}` : ''}</p>
                    <h3>{equipmentName}</h3>
                    <span>{event.status === 'approved' ? '승인 완료' : '승인 대기'}</span>
                  </div>
                  <button onClick={() => onCancelReservation(event.id)}>예약 취소</button>
                </div>
              );
            })
          ) : (
            <p className="reservation-empty-state">현재 등록된 예약이 없습니다.</p>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-surface/85 p-6">
        <SectionTitle title="인증정보" eyebrow="Profile" />
        <div className="grid gap-3 text-sm text-slate-300">
          <p className="rounded-md bg-white/5 p-4">교육 이수 상태와 장비별 예약 권한을 이 영역에서 표시할 예정입니다.</p>
          <p className="rounded-md bg-white/5 p-4">예약 취소 기능은 현재 프리뷰 데이터 기준으로 즉시 반영됩니다.</p>
        </div>
      </div>
    </section>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-surface/85 p-8">
      <SectionTitle title={title} eyebrow="Coming Next" />
      <p className="text-slate-300">이 메뉴는 다음 단계에서 상세 화면을 확장할 예정입니다.</p>
    </section>
  );
}

export function App() {
  const { items: equipmentItems, setItems: setEquipmentItems, source } = useEquipmentData();
  const [activePage, setActivePage] = useState<PageKey>('home');
  const [loading, setLoading] = useState(false);
  const [initialGroup, setInitialGroup] = useState<EquipmentGroup>('process');
  const [deletedEquipmentIds, setDeletedEquipmentIds] = useState<string[]>([]);
  const [sessionRole, setSessionRole] = useState<Role | null>(() => {
    const stored = localStorage.getItem('hbnu-session-user');
    if (!stored) return null;
    try {
      return JSON.parse(stored).role ?? null;
    } catch {
      return null;
    }
  });
  const [reservationEvents, setReservationEvents] = useState<ReservationEvent[]>(() => {
    const previewTestReservations = createRealtimeTestReservations(fallbackEquipment);
    const baseEvents = events.map((event) => ({
      ...event,
      status: normalizeReservationStatus(event.status),
      equipmentId: fallbackEquipment.find((item) => event.title.includes(item.name))?.id ?? '',
      createdBy: 'USER'
    }));
    return [...previewTestReservations, ...baseEvents];
  });

  function navigate(page: PageKey) {
    setLoading(true);
    window.setTimeout(() => {
      setActivePage(page);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 520);
  }

  function openEquipment(group: EquipmentGroup) {
    setInitialGroup(group);
    navigate('equipment');
  }

  function addEquipment(item: EquipmentItem) {
    setEquipmentItems((current) => [...current, item]);
  }

  function deleteEquipment(equipmentId: string) {
    setDeletedEquipmentIds((current) => current.includes(equipmentId) ? current : [...current, equipmentId]);
  }

  function addReservation(event: ReservationEvent) {
    setReservationEvents((current) => [...current, event]);
  }

  function deleteReservation(reservationId: string) {
    setReservationEvents((current) => current.filter((event) => event.id !== reservationId));
  }

  const activeEquipmentItems = equipmentItems.filter((item) => !deletedEquipmentIds.includes(item.id));

  return (
    <div className="min-h-screen">
      <LoadingOverlay visible={loading} />
      <InstitutionHeader onNavigate={navigate} sessionRole={sessionRole} />
      <div className="app-shell mx-auto max-w-[1800px] px-4 py-5 lg:px-6 2xl:px-8">
        <SidebarNavigation activePage={activePage} onNavigate={navigate} />
        <main className="app-main">
          {activePage === 'home' && (
            <>
              <Dashboard equipmentItems={activeEquipmentItems} calendarEvents={reservationEvents} onNavigate={navigate} onOpenEquipment={openEquipment} />
            </>
          )}
          {activePage === 'equipment' && (
            <EquipmentPage
              equipmentItems={activeEquipmentItems}
              source={source}
              initialGroup={initialGroup}
              sessionRole={sessionRole}
              onAddEquipment={addEquipment}
              onDeleteEquipment={deleteEquipment}
            />
          )}
          {activePage === 'reservations' && (
            <ReservationPage
              equipmentItems={activeEquipmentItems}
              calendarEvents={reservationEvents}
              sessionRole={sessionRole}
              onAddReservation={addReservation}
              onDeleteReservation={deleteReservation}
            />
          )}
          {activePage === 'training' && <TrainingPage equipmentItems={activeEquipmentItems} />}
          {activePage === 'admin' && (
            <AdminPage
              equipmentItems={equipmentItems}
              calendarEvents={reservationEvents}
              onAddReservation={addReservation}
              onDeleteReservation={deleteReservation}
            />
          )}
          {activePage === 'login' && <LoginPage onAuthenticated={(role) => setSessionRole(role)} />}
          {activePage === 'facility' && <PlaceholderPage title="시설안내" />}
          {activePage === 'mypage' && (
            <MyPage
              equipmentItems={activeEquipmentItems}
              calendarEvents={reservationEvents}
              onCancelReservation={deleteReservation}
            />
          )}
        </main>
      </div>
    </div>
  );
}


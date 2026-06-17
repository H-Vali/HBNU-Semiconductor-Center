import { useEffect, useMemo, useState } from 'react';
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
  ClipboardCheck,
  Cpu,
  Factory,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  Microscope,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  UserRound,
  Wrench
} from 'lucide-react';
import { equipment as fallbackEquipment, events, monthlyUsage, type EquipmentGroup, type EquipmentItem } from './data';

type ApiEquipmentItem = Partial<EquipmentItem> & {
  imageUrl?: string;
  usageConditions?: string;
};

const apiUrl = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL) ?? 'http://localhost:4000';

const menu = [
  { label: '센터소개', icon: Factory },
  { label: '시설안내', icon: LayoutDashboard },
  { label: '장비현황', icon: Wrench },
  { label: '교육신청', icon: GraduationCap },
  { label: '예약현황', icon: CalendarDays },
  { label: '마이페이지', icon: UserRound },
  { label: '관리자', icon: ShieldCheck, admin: true }
];

const quickLinks = [
  { label: '입소신청', icon: ClipboardCheck },
  { label: '공정접수 및 장비예약', icon: CalendarDays },
  { label: '장비사용자 교육신청', icon: GraduationCap },
  { label: '장비 배치현황', icon: Microscope }
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

  return { items, source };
}

function SectionTitle({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: string }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div>
        {eyebrow && <p className="text-sm font-bold uppercase text-cyan-300">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-extrabold text-white">{title}</h2>
      </div>
      {action && (
        <button className="rounded-md bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 hover:text-slate-950">
          {action}
        </button>
      )}
    </div>
  );
}

function InstitutionHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-5 px-5 py-3 2xl:px-8">
        <div className="flex items-center gap-3">
          <div className="brand-mark">
            <CircuitBoard size={26} />
          </div>
          <div>
            <p className="text-xs font-bold text-cyan-300">HBNU SEMICONDUCTOR CENTER</p>
            <h1 className="text-lg font-extrabold text-white sm:text-xl">반도체 장비 공동활용 플랫폼</h1>
          </div>
        </div>
        <nav className="hidden items-center gap-1 xl:flex">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={`#${item.label}`}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-bold text-slate-300 hover:bg-blue-700 hover:text-white"
              >
                <Icon size={18} />
                {item.label}
                {item.admin && <span className="rounded bg-cyan-300/15 px-1.5 py-0.5 text-[10px] text-cyan-200">ADMIN</span>}
              </a>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <button className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300 hover:text-cyan-200">
            ENG
          </button>
          <button className="rounded-md bg-white px-4 py-2 text-sm font-extrabold text-slate-950 hover:bg-cyan-200">
            로그인
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero-panel overflow-hidden rounded-lg border border-white/10 bg-slate-950">
      <div className="grid min-h-[24rem] gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] xl:min-h-[30rem] xl:p-8">
        <div className="flex flex-col justify-between gap-8">
          <div>
            <p className="mb-4 text-base font-extrabold text-cyan-300">N-FACILITY / FAB OPERATION / EQUIPMENT RESERVATION</p>
            <h2 className="max-w-4xl text-4xl font-extrabold leading-tight text-white lg:text-5xl 2xl:text-6xl">
              반도체 공정 장비를 한 화면에서 예약하고 운영합니다
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              장비 소개, 교육 인증, 예약 승인, 사용률 분석을 통합해 연구자와 관리자가 같은 데이터를 보고 움직이는 운영 플랫폼입니다.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button key={link.label} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-4 text-left text-base font-bold text-white hover:border-cyan-300 hover:bg-cyan-300/10">
                  <Icon className="text-cyan-300" size={23} />
                  {link.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative min-h-[18rem]">
          <div className="wafer-visual">
            <div className="wafer-core" />
            <div className="wafer-grid" />
            <div className="wafer-label">
              <span>Cleanroom</span>
              <strong>ISO 5</strong>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Lithography', value: '12 lots', tone: 'text-sky-300' },
              { label: 'Deposition', value: '18 runs', tone: 'text-emerald-300' },
              { label: 'Etching', value: '9 recipes', tone: 'text-violet-300' },
              { label: 'Metrology', value: '41 samples', tone: 'text-amber-300' }
            ].map((item) => (
              <div key={item.label} className="rounded-md border border-white/10 bg-slate-950/80 p-4 backdrop-blur">
                <p className={`text-sm font-bold uppercase ${item.tone}`}>{item.label}</p>
                <p className="mt-1 text-3xl font-extrabold text-white">{item.value}</p>
              </div>
            ))}
          </div>
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
    { label: '운영 장비', value: `${equipmentItems.length}종`, detail: '공정, 측정 및 분석', icon: Wrench, trend: 'neutral' as const },
    { label: '월간 장비 총 가동 시간', value: `${totalHours.toLocaleString()}h`, detail: `전월 대비 ${monthlyDelta > 0 ? '+' : ''}${monthlyDelta}%`, icon: Gauge, trend: monthlyDelta >= 0 ? 'up' as const : 'down' as const },
    { label: '교육 인증', value: '312명', detail: '최근 30일 27명', icon: CheckCircle2, trend: 'neutral' as const },
    { label: 'FAB 가동률', value: `${averageUtilization}%`, detail: 'Cleanroom active', icon: Cpu, trend: 'neutral' as const }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {statCards.map((card) => {
        const Icon = card.icon;
        const trendColor = card.trend === 'up' ? 'text-emerald-300' : card.trend === 'down' ? 'text-rose-300' : 'text-slate-400';
        const TrendIcon = card.trend === 'down' ? TrendingDown : TrendingUp;

        return (
          <div key={card.label} className="stat-card rounded-lg border border-white/10 bg-surface/85 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="stat-icon rounded-md bg-cyan-300/10 p-3 text-cyan-300">
                <Icon size={25} />
              </div>
              <span className="active-indicator" aria-label="Active equipment status" />
            </div>
            <p className="text-base font-semibold text-slate-300">{card.label}</p>
            <p className="mt-2 text-4xl font-extrabold text-white">{card.value}</p>
            <p className={`mt-2 flex items-center gap-1.5 text-base font-semibold ${trendColor}`}>
              {card.trend !== 'neutral' && <TrendIcon size={17} />}
              {card.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function EquipmentUsageChart({ equipmentItems }: { equipmentItems: EquipmentItem[] }) {
  const data = equipmentItems.map((item) => ({
    label: item.name.replace('Semiconductor ', ''),
    value: item.usageHours,
    group: item.group
  }));
  const maxValue = Math.max(...data.map((entry) => entry.value));
  const minValue = Math.min(...data.map((entry) => entry.value));

  return (
    <div className="chart-card rounded-lg border border-white/10 bg-[#101114] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase text-blue-300">Realtime Analytics</p>
          <h3 className="mt-1 text-2xl font-extrabold text-white">장비별 사용량</h3>
        </div>
        <div className="flex gap-2 text-sm font-bold text-slate-300">
          <span className="rounded-full bg-white/10 px-3 py-1">24H</span>
          <span className="rounded-full px-3 py-1">1W</span>
          <span className="rounded-full px-3 py-1">1M</span>
        </div>
      </div>
      <div className="h-[20rem] xl:h-[24rem] 2xl:h-[28rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 22, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
            <XAxis dataKey="label" stroke="#a8adb8" tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis stroke="#a8adb8" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}h`} width={54} />
            <Tooltip
              contentStyle={{ background: '#050607', border: '1px solid rgba(255,255,255,.12)', borderRadius: '8px', color: '#fff' }}
              labelStyle={{ color: '#aeb6c2' }}
              formatter={(value) => [`${value}h`, '사용시간']}
            />
            <Bar dataKey="value" radius={[8, 8, 2, 2]}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.group === 'process' ? '#22d3ee' : '#a78bfa'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <div className="flex gap-3">
          <span>Low: {minValue}h</span>
          <span>High: {maxValue}h</span>
        </div>
        <div className="flex gap-3">
          <span className="inline-flex items-center gap-2 text-white"><span className="h-3 w-3 rounded-sm bg-cyan-300" /> 공정</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-violet-400" /> 측정 및 분석</span>
        </div>
      </div>
    </div>
  );
}

function MonthlyUsageChart() {
  const maxValue = Math.max(...monthlyUsage.map((entry) => entry.hours));
  const minValue = Math.min(...monthlyUsage.map((entry) => entry.hours));

  return (
    <div className="chart-card rounded-lg border border-white/10 bg-[#101114] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase text-blue-300">Realtime Analytics</p>
          <h3 className="mt-1 text-2xl font-extrabold text-white">월별 총 사용시간</h3>
        </div>
        <div className="flex gap-2 text-sm font-bold text-slate-300">
          <span className="rounded-full bg-white/10 px-3 py-1">24H</span>
          <span className="rounded-full px-3 py-1">1W</span>
          <span className="rounded-full px-3 py-1">1M</span>
        </div>
      </div>
      <div className="h-[20rem] xl:h-[24rem] 2xl:h-[28rem]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyUsage} margin={{ top: 22, right: 22, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="monthly-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="55%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#d46ab8" />
              </linearGradient>
              <linearGradient id="monthly-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.24} />
                <stop offset="65%" stopColor="#8b5cf6" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
            <XAxis dataKey="month" stroke="#a8adb8" tickLine={false} axisLine={false} />
            <YAxis stroke="#a8adb8" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}h`} width={54} />
            <Tooltip
              contentStyle={{ background: '#050607', border: '1px solid rgba(255,255,255,.12)', borderRadius: '8px', color: '#fff' }}
              labelStyle={{ color: '#aeb6c2' }}
              formatter={(value) => [`${value}h`, '총 가동 시간']}
            />
            <Area type="monotone" dataKey="hours" stroke="url(#monthly-stroke)" strokeWidth={3} fill="url(#monthly-area)" dot={false} activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#111', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <div className="flex gap-3">
          <span>Low: {minValue}h</span>
          <span>High: {maxValue}h</span>
        </div>
        <span className="inline-flex items-center gap-2 text-white"><span className="h-3 w-3 rounded-sm bg-violet-400" /> 총 가동 시간</span>
      </div>
    </div>
  );
}

function Dashboard({ equipmentItems }: { equipmentItems: EquipmentItem[] }) {
  return (
    <section className="dashboard-grid mt-5">
      <div className="stat-area">
        <StatGrid equipmentItems={equipmentItems} />
      </div>
      <div className="usage-chart">
        <EquipmentUsageChart equipmentItems={equipmentItems} />
      </div>
      <div className="monthly-chart">
        <MonthlyUsageChart />
      </div>
      <div className="calendar-area rounded-lg border border-white/10 bg-surface/85 p-5">
        <SectionTitle title="장비 예약 현황 캘린더" eyebrow="Reservation Calendar" action="예약 등록" />
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate="2026-06-17"
          height="auto"
          events={events}
          eventClick={(info: { event: { title: string; start: Date | null } }) => alert(`${info.event.title}\n${info.event.start?.toLocaleString()}`)}
        />
      </div>
      <aside className="side-area grid content-start gap-5">
        <LoginPanel />
        <UtilizationPanel equipmentItems={equipmentItems} />
      </aside>
    </section>
  );
}

function LoginPanel() {
  return (
    <div className="rounded-lg border border-white/10 bg-surface/85 p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-md bg-blue-500/15 p-2 text-cyan-300">
          <LockKeyhole size={22} />
        </div>
        <div>
          <p className="text-sm text-slate-400">OAuth 인증</p>
          <h3 className="text-lg font-bold text-white">연구자 로그인</h3>
        </div>
      </div>
      <div className="grid gap-2">
        <button className="flex items-center justify-center gap-2 rounded-md bg-white px-4 py-3 font-bold text-slate-900 hover:bg-cyan-100">
          <LogIn size={18} /> Google
        </button>
        <button className="flex items-center justify-center gap-2 rounded-md bg-[#FEE500] px-4 py-3 font-bold text-slate-950 hover:brightness-110">
          <LogIn size={18} /> Kakao
        </button>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">교육 인증 및 예약 권한은 JWT 세션과 RBAC 권한으로 관리됩니다.</p>
    </div>
  );
}

function UtilizationPanel({ equipmentItems }: { equipmentItems: EquipmentItem[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-surface/85 p-5">
      <SectionTitle title="장비 사용률" eyebrow="Utilization" />
      <div className="grid gap-4">
        {equipmentItems.slice(0, 8).map((item) => (
          <div key={item.id}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-300">{item.name}</span>
              <span className="font-bold text-cyan-300">{item.utilization}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-blue-600" style={{ width: `${item.utilization}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EquipmentCatalog({ equipmentItems, source }: { equipmentItems: EquipmentItem[]; source: 'api' | 'fallback' }) {
  const [activeGroup, setActiveGroup] = useState<EquipmentGroup>('process');
  const grouped = useMemo(
    () => ({
      process: equipmentItems.filter((item) => item.group === 'process'),
      metrology: equipmentItems.filter((item) => item.group === 'metrology')
    }),
    [equipmentItems]
  );
  const activeItems = grouped[activeGroup];

  return (
    <section className="mt-5" id="장비현황">
      <SectionTitle title="장비 목록" eyebrow="Equipment Inventory" action="장비 추가" />
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        {(Object.keys(categoryMeta) as EquipmentGroup[]).map((group) => {
          const meta = categoryMeta[group];
          const isActive = activeGroup === group;

          return (
            <button
              key={group}
              className={`facility-tab overflow-hidden rounded-lg border text-left ${isActive ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/10 bg-surface/85 hover:border-cyan-300/70'}`}
              onClick={() => setActiveGroup(group)}
            >
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
                  <span className="rounded-md bg-white/10 px-3 py-1 text-sm font-bold text-cyan-200">{isActive ? '선택됨' : '보기'}</span>
                </div>
                <ul className="grid gap-2 text-sm text-slate-300">
                  {meta.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="text-slate-500">•</span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-bold text-white">
          {categoryMeta[activeGroup].title} 장비 리스트 <span className="text-cyan-300">{activeItems.length}</span>
        </p>
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
                {item.features.map((feature) => (
                  <span key={feature} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">{feature}</span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReservationWorkspace({ equipmentItems }: { equipmentItems: EquipmentItem[] }) {
  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[22rem_1fr]" id="예약현황">
      <div className="rounded-lg border border-white/10 bg-surface/85 p-4">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal size={20} className="text-cyan-300" />
          <h2 className="text-lg font-bold text-white">장비 검색/필터</h2>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={17} />
          <input className="w-full rounded-md border border-white/10 bg-slate-950 px-9 py-2 text-sm outline-none focus:border-cyan-300" placeholder="장비명 검색" />
        </div>
        <select className="mb-4 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300">
          <option>전체 카테고리</option>
          <option>공정장비</option>
          <option>측정 및 분석장비</option>
        </select>
        <div className="grid max-h-[34rem] gap-2 overflow-auto pr-1">
          {equipmentItems.map((item, index) => (
            <button key={item.id} className={`rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-blue-600 ${index === 0 ? 'bg-blue-700 text-white' : 'bg-white/5 text-slate-300'}`}>
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-surface/85 p-5">
        <SectionTitle title="FE-SEM 장비별 예약 캘린더" eyebrow="Equipment Calendar" action="내 예약 보기" />
        <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" initialDate="2026-06-17" selectable height="auto" events={events} />
      </div>
    </section>
  );
}

function EducationAndAdmin({ equipmentItems }: { equipmentItems: EquipmentItem[] }) {
  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-2">
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
        <SectionTitle title="관리자 대시보드" eyebrow="Admin CMS" action="CMS 편집" />
        <div className="grid gap-3 sm:grid-cols-2">
          {['사용자관리', '장비관리', '예약승인/거부', '교육관리', '홈페이지편집', '대시보드 데이터'].map((title) => (
            <button key={title} className="rounded-md border border-white/10 bg-white/5 p-4 text-left font-bold text-white hover:border-cyan-300 hover:bg-blue-500/20">
              {title}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function App() {
  const { items: equipmentItems, source } = useEquipmentData();

  return (
    <div className="min-h-screen">
      <InstitutionHeader />
      <main className="mx-auto max-w-[1800px] px-4 py-5 lg:px-6 2xl:px-8">
        <Hero />
        <Dashboard equipmentItems={equipmentItems} />
        <EquipmentCatalog equipmentItems={equipmentItems} source={source} />
        <ReservationWorkspace equipmentItems={equipmentItems} />
        <EducationAndAdmin equipmentItems={equipmentItems} />
      </main>
    </div>
  );
}

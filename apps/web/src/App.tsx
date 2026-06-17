import { useEffect, useMemo, useState, type FormEvent } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircuitBoard,
  Clock,
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
  UserRound,
  Wrench
} from 'lucide-react';
import { equipment as fallbackEquipment, events as defaultEvents, monthlyUsage, type CalendarEvent, type EquipmentGroup, type EquipmentItem } from './data';

type PageKey = 'home' | 'facility' | 'equipment' | 'training' | 'reservations' | 'mypage' | 'admin' | 'login';
type Role = 'USER' | 'ADMIN';
type EquipmentSubTab = 'status' | 'list';
type GroupFilter = EquipmentGroup | 'all';

type ApiEquipmentItem = Partial<EquipmentItem> & { imageUrl?: string; usageConditions?: string };

const apiUrl = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL) ?? 'http://localhost:4000';

const menu: Array<{ label: string; page: PageKey; icon: typeof Factory; admin?: boolean }> = [
  { label: '시설소개', page: 'facility', icon: Factory },
  { label: '장비현황', page: 'equipment', icon: Wrench },
  { label: '장비예약현황', page: 'reservations', icon: CalendarDays },
  { label: '장비사용교육', page: 'training', icon: GraduationCap },
  { label: '마이페이지', page: 'mypage', icon: UserRound },
  { label: '관리자', page: 'admin', icon: ShieldCheck, admin: true }
];

const quickLinks: Array<{ label: string; page: PageKey; icon: typeof CalendarDays }> = [
  { label: '공정접수 및 장비예약', page: 'reservations', icon: CalendarDays },
  { label: '장비사용자 교육신청', page: 'training', icon: GraduationCap },
  { label: '장비 배치현황', page: 'equipment', icon: Microscope }
];

const categoryMeta: Record<EquipmentGroup, { title: string; subtitle: string; image: string; bullets: string[] }> = {
  process: {
    title: '공정',
    subtitle: '박막, 노광, 식각, 열처리 장비',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85',
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
    groupName: inferredGroup === 'process' ? '공정' : '측정·분석',
    location: item.location ?? `실습실 ${Math.floor(index / 6) + 1}`,
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

function SectionTitle({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        {eyebrow && <p className="text-sm font-bold uppercase text-cyan-300">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-extrabold text-white">{title}</h2>
      </div>
      {action}
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

function InstitutionHeader({ activePage, onNavigate, sessionRole }: { activePage: PageKey; onNavigate: (page: PageKey) => void; sessionRole: Role | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-5 px-5 py-3 2xl:px-8">
        <button className="flex items-center gap-3 text-left" onClick={() => onNavigate('home')}>
          <div className="brand-mark">
            <CircuitBoard size={26} />
          </div>
          <div>
            <p className="text-xs font-bold text-cyan-300">HBNU SEMICONDUCTOR CENTER</p>
            <h1 className="text-lg font-extrabold text-white sm:text-xl">인프라 통합 관리 Web</h1>
          </div>
        </button>
        <nav className="hidden items-center gap-1 xl:flex">
          {menu.map((item) => {
            const Icon = item.icon;
            const selected = activePage === item.page;
            return (
              <button
                key={`${item.page}-${item.label}`}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-base font-bold ${selected ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-blue-700 hover:text-white'}`}
                onClick={() => onNavigate(item.page)}
              >
                <Icon size={18} />
                {item.label}
                {item.admin && <span className="rounded bg-cyan-300/15 px-1.5 py-0.5 text-[10px] text-cyan-200">ADMIN</span>}
              </button>
            );
          })}
        </nav>
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

function Hero({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  return (
    <section className="hero-panel overflow-hidden rounded-lg border border-white/10 bg-slate-950">
      <div className="grid min-h-[24rem] gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] xl:min-h-[30rem] xl:p-8">
        <div className="flex flex-col justify-between gap-8">
          <div>
            <p className="mb-4 text-base font-extrabold text-cyan-300">N-FACILITY / FAB OPERATION / EQUIPMENT RESERVATION</p>
            <h2 className="max-w-5xl text-4xl font-extrabold leading-tight text-white lg:text-5xl 2xl:text-6xl">
              국립한밭대학교 창의융합교육센터 인프라 통합 관리 Web
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              장비 소개, 교육 인증, 예약 승인, 사용률 분석을 통합해 연구자와 관리자가 같은 데이터를 보고 움직이는 운영 플랫폼입니다.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.label}
                  className="quick-link flex min-h-24 items-center gap-4 rounded-md border border-white/10 bg-white/5 px-5 py-5 text-left text-lg font-bold text-white hover:border-cyan-300 hover:bg-cyan-300/10"
                  onClick={() => onNavigate(link.page)}
                >
                  <Icon className="text-cyan-300" size={26} />
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
              <div key={item.label} className="rounded-md border border-white/10 bg-slate-950/80 p-4">
                <p className={`text-sm font-extrabold uppercase ${item.tone}`}>{item.label}</p>
                <p className="mt-2 text-3xl font-extrabold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Dashboard({ equipmentItems, calendarEvents, onNavigate }: { equipmentItems: EquipmentItem[]; calendarEvents: CalendarEvent[]; onNavigate: (page: PageKey) => void }) {
  const totals = useMemo(() => {
    const usage = equipmentItems.reduce((sum, item) => sum + item.usageHours, 0);
    const certified = Math.round(equipmentItems.length * 13);
    return { usage, certified, process: equipmentItems.filter((item) => item.group === 'process').length, metrology: equipmentItems.filter((item) => item.group === 'metrology').length };
  }, [equipmentItems]);

  return (
    <div className="space-y-6">
      <Hero onNavigate={onNavigate} />
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          { label: '운영 장비', value: `${equipmentItems.length}종`, detail: `공정 ${totals.process} / 측정 ${totals.metrology}`, icon: Wrench },
          { label: '월간 장비 총 가동 시간', value: `${totals.usage.toLocaleString()}h`, detail: '전월 대비 +18%', icon: Gauge, delta: 18 },
          { label: '교육 인증', value: `${totals.certified}명`, detail: '최근 30일 27명', icon: CheckCircle2 },
          { label: 'FAB 가동률', value: '86%', detail: 'Cleanroom active', icon: Cpu }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="stat-card rounded-lg border border-white/10 bg-slate-800/80 p-6">
              <div className="flex items-start justify-between">
                <div className="stat-icon grid h-11 w-11 place-items-center rounded-md bg-slate-950/60 text-cyan-200">
                  <Icon size={23} />
                </div>
                <span className="active-indicator" />
              </div>
              <p className="mt-6 text-base font-bold text-sky-200">{item.label}</p>
              <p className="mt-2 text-4xl font-black text-white">{item.value}</p>
              <p className={`mt-2 flex items-center gap-1 text-base ${item.delta && item.delta < 0 ? 'text-red-300' : item.delta ? 'text-emerald-300' : 'text-slate-300'}`}>
                {item.delta ? item.delta > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} /> : null}
                {item.detail}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <UsageBarChart equipmentItems={equipmentItems} />
        <div className="rounded-lg border border-white/10 bg-slate-900/75 p-5">
          <SectionTitle title="월간 장비 총 가동 시간" eyebrow="Monthly Runtime" />
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyUsage} margin={{ left: 0, right: 16, top: 16, bottom: 4 }}>
                <defs>
                  <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                <XAxis dataKey="month" stroke="#9fb3c8" tickLine={false} axisLine={false} />
                <YAxis stroke="#9fb3c8" tickFormatter={(value) => `${value}h`} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="hours" stroke="#d946ef" strokeWidth={3} fill="url(#usageGradient)" activeDot={{ r: 6, fill: '#f97316' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-slate-900/75 p-5">
        <SectionTitle title="장비 예약 현황" eyebrow="Equipment Calendar" action={<button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-400 hover:text-slate-950" onClick={() => onNavigate('reservations')}>전체 보기</button>} />
        <CalendarView events={calendarEvents} height={470} />
      </div>
    </div>
  );
}

function UsageBarChart({ equipmentItems }: { equipmentItems: EquipmentItem[] }) {
  const chartData = equipmentItems.map((item) => ({ name: item.name.replace('Semiconductor ', ''), hours: item.usageHours, group: item.group }));

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/75 p-5">
      <SectionTitle title="장비별 사용량" eyebrow="Realtime Analytics" />
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 0, right: 12, top: 18, bottom: 44 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
            <XAxis dataKey="name" stroke="#9fb3c8" tickLine={false} axisLine={false} angle={-18} textAnchor="end" interval={0} height={68} />
            <YAxis stroke="#9fb3c8" tickFormatter={(value) => `${value}h`} tickLine={false} axisLine={false} />
            <Tooltip cursor={false} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }} />
            <Bar className="usage-bar-series" dataKey="hours" radius={[8, 8, 2, 2]}>
              {chartData.map((item) => (
                <Cell key={item.name} fill={item.group === 'process' ? '#38bdf8' : '#a78bfa'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CalendarView({ events, height }: { events: CalendarEvent[]; height: number }) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      initialDate="2026-06-17"
      height={height}
      events={events.map((event) => ({
        ...event,
        classNames: [`reservation-${event.status}`]
      }))}
      headerToolbar={{ left: 'title', center: '', right: 'today prev,next' }}
      dayMaxEventRows={3}
    />
  );
}

function EquipmentPage({
  equipmentItems,
  setEquipmentItems,
  source,
  sessionRole
}: {
  equipmentItems: EquipmentItem[];
  setEquipmentItems: React.Dispatch<React.SetStateAction<EquipmentItem[]>>;
  source: 'api' | 'fallback';
  sessionRole: Role | null;
}) {
  const [equipmentTab, setEquipmentTab] = useState<EquipmentSubTab>('status');
  const [activeGroup, setActiveGroup] = useState<EquipmentGroup>('process');
  const [showAddModal, setShowAddModal] = useState(false);
  const isAdmin = sessionRole === 'ADMIN';
  const filtered = equipmentItems.filter((item) => item.group === activeGroup);

  const addEquipment = (item: Omit<EquipmentItem, 'id' | 'category' | 'groupName' | 'features' | 'utilization' | 'usageHours' | 'image'>) => {
    const image = item.group === 'process' ? categoryMeta.process.image : categoryMeta.metrology.image;
    setEquipmentItems((prev) => [
      ...prev,
      {
        ...item,
        id: `eq-${Date.now()}`,
        category: item.group === 'process' ? '공정장비' : '측정 및 분석장비',
        groupName: item.group === 'process' ? '공정' : '측정·분석',
        image,
        features: ['예약 캘린더', '교육 인증', '사용 로그'],
        utilization: 0,
        usageHours: 0
      }
    ]);
    setShowAddModal(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'status', label: '장비현황' },
          { key: 'list', label: '장비목록' }
        ].map((tab) => (
          <button key={tab.key} className={`rounded-md px-5 py-2.5 text-sm font-extrabold ${equipmentTab === tab.key ? 'bg-cyan-300 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-blue-700 hover:text-white'}`} onClick={() => setEquipmentTab(tab.key as EquipmentSubTab)}>
            {tab.label}
          </button>
        ))}
      </div>

      {equipmentTab === 'status' ? (
        <div className="rounded-lg border border-white/10 bg-slate-900/75 p-5">
          <SectionTitle title="장비현황" eyebrow="3D Lab Floor Status" />
          <LabFloorPlan equipmentItems={equipmentItems} />
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-slate-900/75 p-5">
          <SectionTitle
            title="장비목록"
            eyebrow="Equipment Inventory"
            action={
              isAdmin ? (
                <button className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-300 hover:text-slate-950" onClick={() => setShowAddModal(true)}>
                  <Plus size={16} /> 장비추가
                </button>
              ) : null
            }
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {(Object.keys(categoryMeta) as EquipmentGroup[]).map((group) => {
              const meta = categoryMeta[group];
              const count = equipmentItems.filter((item) => item.group === group).length;
              return (
                <button key={group} className={`category-gateway text-left ${activeGroup === group ? 'selected' : ''}`} onClick={() => setActiveGroup(group)}>
                  <img src={meta.image} alt="" />
                  <div className="category-overlay">
                    <p className="text-xl font-extrabold text-white">{meta.title}</p>
                    <p className="mt-1 text-sm font-bold text-sky-100">{meta.subtitle}</p>
                    <p className="mt-5 text-sm text-slate-300">등록 장비</p>
                    <strong className="text-3xl text-white">{count}종</strong>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end text-xs text-slate-400">데이터 소스: {source === 'api' ? 'API 연동' : '로컬 fallback'}</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filtered.map((item) => (
              <article key={item.id} className="equipment-card overflow-hidden rounded-lg border border-white/10 bg-slate-800">
                <img className="h-36 w-full object-cover" src={item.image} alt="" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`rounded px-2 py-1 text-[11px] font-extrabold ${item.group === 'process' ? 'bg-sky-400/15 text-sky-200' : 'bg-violet-400/15 text-violet-200'}`}>{item.groupName}</span>
                      <h3 className="mt-3 text-lg font-extrabold text-white">{item.name}</h3>
                    </div>
                    {isAdmin && (
                      <button className="rounded-md border border-red-300/30 p-2 text-red-200 hover:bg-red-500 hover:text-white" title="장비 삭제" onClick={() => setEquipmentItems((prev) => prev.filter((target) => target.id !== item.id))}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{item.condition}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="rounded border border-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-cyan-300 hover:text-cyan-200">예약 캘린더</button>
                    <button className="rounded border border-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-cyan-300 hover:text-cyan-200">교육 인증</button>
                    <button className="rounded border border-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-cyan-300 hover:text-cyan-200">사용 로그</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {showAddModal && <EquipmentAddModal onClose={() => setShowAddModal(false)} onSubmit={addEquipment} />}
    </div>
  );
}

function LabFloorPlan({ equipmentItems }: { equipmentItems: EquipmentItem[] }) {
  const rooms = [
    { name: 'Cleanroom A', type: '공정', group: 'process' as EquipmentGroup, count: equipmentItems.filter((item) => item.group === 'process').slice(0, 6).length, detail: '노광 / 박막 / 식각' },
    { name: 'Cleanroom B', type: '공정', group: 'process' as EquipmentGroup, count: equipmentItems.filter((item) => item.group === 'process').slice(6).length, detail: '열처리 / 패키징' },
    { name: 'Analysis Room', type: '측정·분석', group: 'metrology' as EquipmentGroup, count: equipmentItems.filter((item) => item.group === 'metrology').length, detail: 'SEM / XRD / Probe' },
    { name: 'Education Lab', type: '교육', group: 'process' as EquipmentGroup, count: 4, detail: '사용자 인증 실습' },
    { name: 'Utility Core', type: '운영', group: 'metrology' as EquipmentGroup, count: 6, detail: '가스 / 전원 / 배기' }
  ];

  return (
    <div className="lab-perspective">
      <div className="lab-floor-grid">
        {rooms.map((room, index) => (
          <div key={room.name} className={`lab-room lab-room-${index + 1} ${room.group}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase text-cyan-200">{room.type}</p>
                <h3 className="mt-1 text-xl font-black text-white">{room.name}</h3>
              </div>
              <span className="rounded bg-slate-950/60 px-2 py-1 text-xs font-bold text-white">{room.count} units</span>
            </div>
            <p className="mt-4 text-sm text-slate-300">{room.detail}</p>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {Array.from({ length: Math.min(room.count, 8) }, (_, dot) => (
                <span key={dot} className="h-4 rounded-sm bg-cyan-300/70 shadow-[0_0_14px_rgba(34,211,238,0.35)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EquipmentAddModal({
  onClose,
  onSubmit
}: {
  onClose: () => void;
  onSubmit: (item: Omit<EquipmentItem, 'id' | 'category' | 'groupName' | 'features' | 'utilization' | 'usageHours' | 'image'>) => void;
}) {
  const [form, setForm] = useState({ name: '', group: 'process' as EquipmentGroup, location: '실습실 1', condition: '교육 이수 후 사용 가능' });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
  };

  return (
    <Modal title="장비 추가" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <label className="form-label">
          장비명
          <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="예: Probe Station" required />
        </label>
        <label className="form-label">
          대분류
          <select value={form.group} onChange={(event) => setForm((prev) => ({ ...prev, group: event.target.value as EquipmentGroup }))}>
            <option value="process">공정</option>
            <option value="metrology">측정·분석</option>
          </select>
        </label>
        <label className="form-label">
          위치
          <input value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
        </label>
        <label className="form-label">
          사용 조건
          <input value={form.condition} onChange={(event) => setForm((prev) => ({ ...prev, condition: event.target.value }))} />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border border-white/15 px-4 py-2 font-bold text-slate-200 hover:border-cyan-300" onClick={onClose}>취소</button>
          <button className="rounded-md bg-cyan-300 px-4 py-2 font-extrabold text-slate-950 hover:bg-white">등록</button>
        </div>
      </form>
    </Modal>
  );
}

function ReservationPage({
  equipmentItems,
  calendarEvents,
  setCalendarEvents
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: CalendarEvent[];
  setCalendarEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
}) {
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(equipmentItems[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [showReservationModal, setShowReservationModal] = useState(false);

  const filtered = equipmentItems.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase());
    const matchesGroup = groupFilter === 'all' || item.group === groupFilter;
    return matchesQuery && matchesGroup;
  });
  const selected = equipmentItems.find((item) => item.id === selectedEquipmentId) ?? equipmentItems[0];

  const addReservation = (form: { equipmentId: string; date: string; startTime: string; endTime: string; purpose: string }) => {
    const item = equipmentItems.find((target) => target.id === form.equipmentId);
    if (!item) return;
    const purpose = form.purpose.trim() ? ` - ${form.purpose.trim()}` : '';
    setCalendarEvents((prev) => [
      ...prev,
      {
        id: `reservation-${Date.now()}`,
        title: `${item.name} 예약${purpose}`,
        start: `${form.date}T${form.startTime}:00`,
        end: `${form.date}T${form.endTime}:00`,
        status: 'pending'
      }
    ]);
    setSelectedEquipmentId(item.id);
    setShowReservationModal(false);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[20rem_1fr]">
      <aside className="rounded-lg border border-white/10 bg-slate-900/80 p-4">
        <div className="mb-4 flex items-center gap-2 text-lg font-extrabold text-white">
          <SlidersHorizontal size={20} /> 장비 검색/필터
        </div>
        <label className="relative block">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input className="w-full rounded-md border border-white/10 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-300" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="장비명 검색" />
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { key: 'all', label: '전체' },
            { key: 'process', label: '공정' },
            { key: 'metrology', label: '측정·분석' }
          ].map((item) => (
            <button key={item.key} className={`filter-chip ${groupFilter === item.key ? 'selected' : ''}`} onClick={() => setGroupFilter(item.key as GroupFilter)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4 max-h-[38rem] space-y-2 overflow-auto pr-1">
          {filtered.map((item) => (
            <button key={item.id} className={`equipment-filter-item ${item.group} ${selectedEquipmentId === item.id ? 'selected' : ''}`} onClick={() => setSelectedEquipmentId(item.id)}>
              <span>{item.name}</span>
              <small>{item.groupName}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-lg border border-white/10 bg-slate-900/80 p-5">
        <SectionTitle
          title={`${selected?.name ?? '장비'} 장비별 예약 캘린더`}
          eyebrow="Equipment Calendar"
          action={
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">내 예약 보기</button>
              <button className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-300 hover:text-slate-950" onClick={() => setShowReservationModal(true)}>
                <Plus size={16} /> 장비예약
              </button>
            </div>
          }
        />
        <CalendarView events={calendarEvents.filter((event) => !selected || event.title.includes(selected.name))} height={720} />
      </section>

      {showReservationModal && <ReservationModal equipmentItems={equipmentItems} selectedEquipmentId={selectedEquipmentId} onClose={() => setShowReservationModal(false)} onSubmit={addReservation} />}
    </div>
  );
}

function ReservationModal({
  equipmentItems,
  selectedEquipmentId,
  onClose,
  onSubmit
}: {
  equipmentItems: EquipmentItem[];
  selectedEquipmentId: string;
  onClose: () => void;
  onSubmit: (form: { equipmentId: string; date: string; startTime: string; endTime: string; purpose: string }) => void;
}) {
  const [form, setForm] = useState({ equipmentId: selectedEquipmentId || equipmentItems[0]?.id || '', date: '2026-06-17', startTime: '09:00', endTime: '10:00', purpose: '' });
  const endTimes = reservationTimes.filter((time) => time > form.startTime);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <Modal title="장비 예약" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <label className="form-label">
          장비
          <select value={form.equipmentId} onChange={(event) => setForm((prev) => ({ ...prev, equipmentId: event.target.value }))}>
            {equipmentItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="form-label">
          예약일
          <input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="form-label">
            시작 시간
            <select value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value, endTime: reservationTimes.find((time) => time > event.target.value) ?? prev.endTime }))}>
              {reservationTimes.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </label>
          <label className="form-label">
            종료 시간
            <select value={form.endTime} onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}>
              {endTimes.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="form-label">
          예약 목적
          <input value={form.purpose} onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))} placeholder="예: 박막 증착 공정" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border border-white/15 px-4 py-2 font-bold text-slate-200 hover:border-cyan-300" onClick={onClose}>취소</button>
          <button className="rounded-md bg-cyan-300 px-4 py-2 font-extrabold text-slate-950 hover:bg-white">예약등록</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-xl font-black text-white">{title}</h3>
          <button className="rounded-md border border-white/10 px-3 py-1.5 text-sm font-bold text-slate-200 hover:border-cyan-300 hover:text-cyan-200" onClick={onClose}>닫기</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (role: Role) => void }) {
  const login = (role: Role) => {
    localStorage.setItem('hbnu-session-role', role);
    onLogin(role);
  };

  return (
    <div className="mx-auto max-w-5xl rounded-lg border border-white/10 bg-slate-900/80 p-6">
      <SectionTitle title="로그인" eyebrow="OAuth Access" />
      <div className="grid gap-4 md:grid-cols-3">
        <button className="auth-card" onClick={() => login('USER')}>
          <LogIn className="text-cyan-300" size={30} />
          <strong>Google OAuth</strong>
          <span>기관 계정으로 예약/교육 메뉴에 접근합니다.</span>
        </button>
        <button className="auth-card kakao" onClick={() => login('USER')}>
          <LogIn className="text-yellow-300" size={30} />
          <strong>Kakao OAuth</strong>
          <span>카카오 인증 흐름을 연결할 자리입니다.</span>
        </button>
        <button className="auth-card admin" onClick={() => login('ADMIN')}>
          <LockKeyhole className="text-emerald-300" size={30} />
          <strong>Admin Preview</strong>
          <span>관리자 버튼과 CMS 기능을 확인합니다.</span>
        </button>
      </div>
    </div>
  );
}

function AdminPage({ equipmentItems }: { equipmentItems: EquipmentItem[] }) {
  const equipmentRows = equipmentItems.map((item) => ({ 장비명: item.name, 대분류: item.groupName, 위치: item.location, 사용시간: item.usageHours, 가동률: `${item.utilization}%` }));
  const monthlyRows = monthlyUsage.map((item) => ({ 월: item.month, 총가동시간: item.hours, 전월대비: `${item.delta}%` }));

  return (
    <div className="space-y-5">
      <SectionTitle title="관리자 대시보드" eyebrow="Admin CMS" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { label: '사용자관리', icon: UserRound },
          { label: '장비관리', icon: Wrench },
          { label: '예약승인/거부', icon: CalendarDays },
          { label: '교육관리', icon: GraduationCap },
          { label: '홈페이지편집', icon: LayoutDashboard },
          { label: '대시보드 데이터', icon: Gauge }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-800 p-5 text-left font-extrabold text-white hover:border-cyan-300 hover:bg-slate-700">
              <span>{item.label}</span>
              <Icon className="text-cyan-300" size={22} />
            </button>
          );
        })}
      </div>
      <div className="rounded-lg border border-white/10 bg-slate-900/80 p-5">
        <SectionTitle title="운영 데이터 내보내기" eyebrow="Excel Export" />
        <div className="flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-2 font-extrabold text-slate-950 hover:bg-white" onClick={() => downloadCsv('equipment-usage.csv', equipmentRows)}>
            <Download size={17} /> 장비별 사용량 CSV
          </button>
          <button className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 font-extrabold text-white hover:bg-cyan-300 hover:text-slate-950" onClick={() => downloadCsv('monthly-runtime.csv', monthlyRows)}>
            <Download size={17} /> 월별 총 장비 사용시간 CSV
          </button>
        </div>
      </div>
    </div>
  );
}

function SimplePage({ title, eyebrow, icon: Icon }: { title: string; eyebrow: string; icon: typeof Factory }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 p-6">
      <SectionTitle title={title} eyebrow={eyebrow} />
      <div className="grid min-h-[22rem] place-items-center rounded-lg border border-dashed border-white/10 bg-slate-950/50 text-center">
        <div>
          <Icon className="mx-auto text-cyan-300" size={44} />
          <p className="mt-4 text-lg font-bold text-slate-200">세부 기능 화면을 순차적으로 연결할 예정입니다.</p>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const { items: equipmentItems, setItems: setEquipmentItems, source } = useEquipmentData();
  const [activePage, setActivePage] = useState<PageKey>('home');
  const [loading, setLoading] = useState(false);
  const [sessionRole, setSessionRole] = useState<Role | null>(() => (localStorage.getItem('hbnu-session-role') as Role | null) ?? null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(defaultEvents);

  const navigate = (page: PageKey) => {
    setLoading(true);
    window.setTimeout(() => {
      setActivePage(page);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 420);
  };

  const page = {
    home: <Dashboard equipmentItems={equipmentItems} calendarEvents={calendarEvents} onNavigate={navigate} />,
    facility: <SimplePage title="시설소개" eyebrow="Facility" icon={Factory} />,
    equipment: <EquipmentPage equipmentItems={equipmentItems} setEquipmentItems={setEquipmentItems} source={source} sessionRole={sessionRole} />,
    training: <SimplePage title="장비사용교육" eyebrow="Training" icon={BookOpen} />,
    reservations: <ReservationPage equipmentItems={equipmentItems} calendarEvents={calendarEvents} setCalendarEvents={setCalendarEvents} />,
    mypage: <SimplePage title="마이페이지" eyebrow="My Page" icon={UserRound} />,
    admin: sessionRole === 'ADMIN' ? <AdminPage equipmentItems={equipmentItems} /> : <LoginPage onLogin={(role) => setSessionRole(role)} />,
    login: <LoginPage onLogin={(role) => { setSessionRole(role); navigate(role === 'ADMIN' ? 'admin' : 'mypage'); }} />
  }[activePage];

  return (
    <>
      <LoadingOverlay visible={loading} />
      <InstitutionHeader activePage={activePage} onNavigate={navigate} sessionRole={sessionRole} />
      <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-5 2xl:px-8">{page}</main>
    </>
  );
}

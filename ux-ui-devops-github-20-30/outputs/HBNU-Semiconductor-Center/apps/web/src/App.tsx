import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import {
  BookOpen, CalendarDays, CheckCircle2, ChevronRight, Gauge, GraduationCap, Home, LayoutDashboard,
  LockKeyhole, LogIn, Settings, ShieldCheck, SlidersHorizontal, UserRound, Wrench
} from 'lucide-react';
import { equipment, events, monthlyUsage } from './data';

const menu = [
  { label: '홈', icon: Home },
  { label: '시설소개', icon: LayoutDashboard },
  { label: '장비현황', icon: Wrench },
  { label: '장비사용교육', icon: GraduationCap },
  { label: '장비사용예약', icon: CalendarDays },
  { label: '마이페이지', icon: UserRound },
  { label: '관리자페이지', icon: ShieldCheck, admin: true }
];

const statCards = [
  { label: '운영 장비', value: '24종', tone: 'text-cyan-300', icon: Wrench },
  { label: '금월 사용시간', value: '1,284h', tone: 'text-emerald-300', icon: Gauge },
  { label: '승인 대기', value: '9건', tone: 'text-amber-300', icon: CalendarDays },
  { label: '교육 인증', value: '312명', tone: 'text-blue-300', icon: CheckCircle2 }
];

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {action && (
        <button className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          {action}
        </button>
      )}
    </div>
  );
}

function LoginPanel() {
  return (
    <div className="rounded-lg border border-white/10 bg-surface/80 p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-md bg-blue-500/20 p-2 text-cyan-300">
          <LockKeyhole size={20} />
        </div>
        <div>
          <p className="text-sm text-slate-400">OAuth 인증</p>
          <h3 className="font-bold text-white">로그인/회원가입</h3>
        </div>
      </div>
      <div className="grid gap-2">
        <button className="flex items-center justify-center gap-2 rounded-md bg-white px-4 py-3 font-bold text-slate-900 hover:bg-cyan-100">
          <LogIn size={18} /> Google로 계속
        </button>
        <button className="flex items-center justify-center gap-2 rounded-md bg-[#FEE500] px-4 py-3 font-bold text-slate-950 hover:brightness-110">
          <LogIn size={18} /> Kakao로 계속
        </button>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">
        예약과 교육 신청은 JWT 세션 확인 후 접근됩니다. 관리자 메뉴는 RBAC로 분리됩니다.
      </p>
    </div>
  );
}

function Dashboard() {
  const topEquipment = equipment.slice(0, 8);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
      <div className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-lg border border-white/10 bg-surface/80 p-4">
                <div className={`mb-5 inline-flex rounded-md bg-white/5 p-2 ${card.tone}`}>
                  <Icon size={20} />
                </div>
                <p className="text-sm text-slate-400">{card.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-white">{card.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-surface/80 p-5">
            <SectionTitle title="장비별 사용량" action="상세보기" />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topEquipment}>
                  <CartesianGrid stroke="rgba(148,163,184,.15)" vertical={false} />
                  <XAxis dataKey="name" hide />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)' }} />
                  <Bar dataKey="usageHours" radius={[6, 6, 0, 0]}>
                    {topEquipment.map((entry) => (
                      <Cell key={entry.id} fill={entry.utilization > 75 ? '#22d3ee' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-surface/80 p-5">
            <SectionTitle title="월별 총 사용시간" />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyUsage}>
                  <CartesianGrid stroke="rgba(148,163,184,.15)" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)' }} />
                  <Line type="monotone" dataKey="hours" stroke="#22d3ee" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-surface/80 p-5">
          <SectionTitle title="예약 현황 캘린더" action="예약 등록" />
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate="2026-06-17"
            height="auto"
            events={events}
            eventClick={(info: { event: { title: string; start: Date | null } }) => alert(`${info.event.title}\n${info.event.start?.toLocaleString()}`)}
          />
        </div>
      </div>

      <aside className="grid content-start gap-5">
        <LoginPanel />
        <div className="rounded-lg border border-white/10 bg-surface/80 p-5">
          <SectionTitle title="긴급 예약 알림" />
          <div className="grid gap-3">
            {events.slice(0, 2).map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-md bg-white/5 p-3">
                <div>
                  <p className="font-semibold text-white">{event.title}</p>
                  <p className="text-sm text-slate-400">{event.start.replace('T', ' ')}</p>
                </div>
                <ChevronRight className="text-cyan-300" size={18} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-surface/80 p-5">
          <SectionTitle title="장비 사용률 통계" />
          <div className="grid gap-4">
            {equipment.slice(0, 6).map((item) => (
              <div key={item.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-300">{item.name}</span>
                  <span className="font-bold text-cyan-300">{item.utilization}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-700">
                  <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-300" style={{ width: `${item.utilization}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function EquipmentCatalog() {
  return (
    <section className="mt-5">
      <SectionTitle title="장비 목록" action="장비 추가" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {equipment.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-lg border border-white/10 bg-surface/80">
            <img className="h-36 w-full object-cover" src={item.image} alt={item.name} />
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-cyan-300">{item.category}</p>
                  <h3 className="mt-1 text-lg font-bold text-white">{item.name}</h3>
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

function ReservationWorkspace() {
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[18rem_1fr]">
      <div className="rounded-lg border border-white/10 bg-surface/80 p-4">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-cyan-300" />
          <h2 className="font-bold text-white">장비 검색/필터</h2>
        </div>
        <input className="mb-3 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300" placeholder="장비명 검색" />
        <select className="mb-4 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300">
          <option>전체 카테고리</option>
          <option>분석장비</option>
          <option>공정장비</option>
          <option>패키징/지원</option>
        </select>
        <div className="grid max-h-[32rem] gap-2 overflow-auto pr-1">
          {equipment.map((item, index) => (
            <button key={item.id} className={`rounded-md px-3 py-2 text-left text-sm hover:bg-blue-500 ${index === 0 ? 'bg-navy text-white' : 'bg-white/5 text-slate-300'}`}>
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-surface/80 p-5">
        <SectionTitle title="FE-SEM 예약 캘린더" action="내역 보기" />
        <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" initialDate="2026-06-17" selectable height="auto" events={events} />
      </div>
    </section>
  );
}

function EducationAndAdmin() {
  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-2">
      <div className="rounded-lg border border-white/10 bg-surface/80 p-5">
        <SectionTitle title="장비 사용 교육" action="교육 신청" />
        <select className="mb-4 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-3 outline-none focus:border-cyan-300">
          {equipment.map((item) => <option key={item.id}>{item.name} 교육 신청</option>)}
        </select>
        <div className="grid gap-3">
          {['PDF 교육자료', '안전 교육 영상', '교육완료 인증서'].map((title) => (
            <div key={title} className="flex items-center justify-between rounded-md bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <BookOpen className="text-cyan-300" size={18} />
                <span className="font-semibold text-white">{title}</span>
              </div>
              <button className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">열기</button>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-surface/80 p-5">
        <SectionTitle title="관리자 대시보드" action="CMS 편집" />
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
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1480px] gap-5 px-4 py-4 lg:px-6">
        <nav className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 rounded-lg border border-white/10 bg-slate-950/80 p-4 backdrop-blur lg:block">
          <div className="mb-8">
            <p className="text-sm font-bold text-cyan-300">HBNU</p>
            <h1 className="mt-1 text-xl font-extrabold text-white">Semiconductor Center</h1>
          </div>
          <div className="grid gap-1">
            {menu.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.label} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-slate-300 hover:bg-blue-600 hover:text-white" href={`#${item.label}`}>
                  <Icon size={18} />
                  {item.label}
                  {item.admin && <span className="ml-auto rounded bg-cyan-400/20 px-2 py-0.5 text-[10px] text-cyan-200">ADMIN</span>}
                </a>
              );
            })}
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          <header className="mb-5 rounded-lg border border-white/10 bg-surface/80 p-5">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
              <div>
                <p className="mb-2 text-sm font-bold uppercase text-cyan-300">Facility, Education, Reservation</p>
                <h1 className="text-3xl font-extrabold text-white md:text-4xl">기관 장비 통합 운영 대시보드</h1>
                <p className="mt-3 max-w-3xl text-slate-300">
                  20~30종 반도체 장비 소개, 교육 인증, 예약 승인, 사용률 분석을 하나의 관리 화면에서 운영합니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-md bg-navy px-4 py-3 font-bold text-white hover:bg-blue-500">예약 등록</button>
                <button className="rounded-md border border-cyan-300/40 px-4 py-3 font-bold text-cyan-200 hover:bg-cyan-300 hover:text-slate-950">교육 신청</button>
              </div>
            </div>
          </header>

          <Dashboard />
          <EquipmentCatalog />
          <ReservationWorkspace />
          <EducationAndAdmin />
        </main>
      </div>
    </div>
  );
}

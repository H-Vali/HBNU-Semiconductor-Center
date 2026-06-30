import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react';
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
  AlertTriangle,
  ArrowRight,
  Ban,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cpu,
  Download,
  Factory,
  Gauge,
  GraduationCap,
  HelpCircle,
  KeyRound,
  LockKeyhole,
  LogIn,
  Mail,
  Megaphone,
  MessageSquare,
  Microscope,
  PackageCheck,
  Phone,
  Plus,
  School,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  UserRound,
  Wrench,
  X
} from 'lucide-react';
import { equipment as fallbackEquipment, events, monthlyUsage, type EquipmentGroup, type EquipmentItem } from './data';
import { STORAGE_KEYS } from './appStorage';
import { initialConsumablesData, initialManagedUsersData } from './mockData';
import { NoticeAdminPage, NoticePage, getNoticeCategoryTone, meetingNoticeItems, normalizeNoticeItems, noticeBoardMeta, noticeItems, operationNoticeItems, type NoticeAttachment, type NoticeBoardKey, type NoticeItem } from './pages/NoticePages';
import { FaqPage, QnaPage, faqItems as initialFaqItems, type FaqItem } from './pages/InquiryPages';
import { AuditLogPage } from './pages/AuditLogPage';
import { apiDelete, apiGet, apiGetBlob, apiPatch, apiPost, apiPut, getApiUrl } from './apiClient';
import { getReservationStatusLabel, normalizeReservationStatus, type ReservationStatus } from './utils/reservationStatus';

type PageKey = 'home' | 'notice' | 'operationNotice' | 'meetingNotice' | 'center' | 'facility' | 'equipment' | 'training' | 'trainingManagement' | 'faq' | 'qna' | 'reservations' | 'managerPermissions' | 'mypage' | 'admin' | 'users' | 'permissions' | 'consumables' | 'equipmentAdmin' | 'penalties' | 'noticeAdmin' | 'educationAdmin' | 'auditLogs' | 'login';
const pageKeys: PageKey[] = ['home', 'notice', 'operationNotice', 'meetingNotice', 'center', 'facility', 'equipment', 'training', 'trainingManagement', 'faq', 'qna', 'reservations', 'managerPermissions', 'mypage', 'admin', 'users', 'permissions', 'consumables', 'equipmentAdmin', 'penalties', 'noticeAdmin', 'educationAdmin', 'auditLogs', 'login'];
const validPageKeys = new Set<PageKey>(pageKeys);
type Role = 'USER' | 'MANAGER' | 'ADMIN';
type UsagePeriod = '24H' | '1W' | '1M';
type EquipmentRuntimeStatus = 'active' | 'maintenance' | 'idle';
type PenaltyType = '1주 사용정지' | '2주 사용정지' | '1개월 정지' | '영구정지';
type PenaltyCategory = '장비활용관련' | '안전관련' | '학생자치기구 관련' | '사고 유발';
type EquipmentStatus = 'available' | 'unavailable';
type ReservationForm = {
  equipmentId: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  purpose: string;
  reservationType?: 'use' | 'maintenance';
  userType?: 'internal' | 'external';
};
type ApiEquipmentItem = Partial<EquipmentItem> & { imageUrl?: string; usageConditions?: string; managerUserId?: string | null };
type FileAsset = {
  id: string;
  ownerType: 'notice' | 'equipment' | 'qna' | 'training' | 'user' | 'general';
  ownerId: string;
  purpose: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  storageKey: string;
  publicUrl?: string | null;
  createdAt: string;
};
type ReservationEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  status?: ReservationStatus;
  equipmentId?: string;
  userId?: string;
  createdBy?: string;
  purpose?: string;
  mine?: boolean;
};
type ApiReservationEvent = {
  id: string;
  title?: string;
  purpose?: string;
  startsAt: string;
  endsAt?: string;
  status?: ReservationStatus;
  equipmentId?: string;
  userId?: string;
  createdByRole?: string;
  mine?: boolean;
};
type DashboardMetrics = {
  monthlyUptimeHours: number;
  monthlyUptimeDeltaPercent: number;
  certifiedUsers: number;
  totalUsers: number;
};
type ApiTrainingPurpose = 'research' | 'class' | 'other';
type ApiTrainingRequestStatus = 'requested' | 'scheduled' | 'completed' | 'rejected';
type ApiTrainingRequest = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  applicantUserId: string;
  applicantName: string;
  applicantEmail: string;
  applicantDepartment: string;
  requestedAt: string;
  preferredDate: string;
  preferredStart: string;
  preferredEnd: string;
  preferredNote: string;
  purpose: ApiTrainingPurpose;
  message: string;
  status: ApiTrainingRequestStatus;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  scheduleChangeReason?: string;
  handledBy?: string;
  handledByName?: string;
  rejectedReason?: string;
  completedAt?: string;
};
type TrainingRequestInput = {
  equipmentId: string;
  preferredDate: string;
  preferredStart: string;
  preferredEnd: string;
  preferredNote: string;
  purpose: ApiTrainingPurpose;
  message: string;
};
type ConsumableItem = {
  id: string;
  category: string;
  name: string;
  unit: string;
  monthStart: number;
  current: number;
  minimum: number;
  note: string;
};
type ManagedUser = {
  id: string;
  index: number;
  name: string;
  roleLevel: RoleLevel;
  department: string;
  labProfessor: string;
  phone: string;
  email: string;
  memo: string;
  authProvider?: 'Google' | 'Kakao' | 'Manual';
  onboardingStatus?: 'profile_pending' | 'training_pending' | 'active';
};
type RoleLevel = '교원' | '대표' | '일반';
type PermissionRoleLevel = RoleLevel | '담당';
type MyPageRole = 'admin' | 'faculty' | 'representative' | 'manager' | 'general';
type EquipmentPermissionMap = Record<string, string[]>;
type EquipmentPermissionGrantMetaMap = Record<string, { grantedAt: string; grantedByRole?: 'MANAGER' | 'ADMIN'; sourceRequestId?: string }>;
type EquipmentPermissionHistoryRecord = {
  id: string;
  action: 'REVOKE';
  actorId: string;
  actorRole: 'ADMIN' | 'MANAGER' | 'SYSTEM';
  userId: string;
  equipmentId: string;
  reason: string;
  createdAt: string;
};
type EquipmentPermissionSnapshot = {
  permissions: EquipmentPermissionMap;
  grantMeta: EquipmentPermissionGrantMetaMap;
  history: EquipmentPermissionHistoryRecord[];
};
type PenaltyRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: PenaltyType;
  category: PenaltyCategory;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  revokedAt?: string;
};
type StoredSessionUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: Role;
};

type GoogleAuthProfile = {
  name?: string;
  email: string;
  authProvider?: 'Google';
};

type GoogleAuthResponse = {
  requiresRegistration?: boolean;
  registrationToken?: string;
  profile?: GoogleAuthProfile;
  user?: StoredSessionUser;
  managedUser?: ManagedUser;
  token?: string;
};

type RegistrationForm = {
  name: string;
  department: string;
  labProfessor: string;
  phone: string;
  email: string;
};

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleOAuthTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

type AccessRequirementNotice = {
  title: string;
  message: string;
  detail?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
};

type GoogleIdentityWindow = Window & typeof globalThis & {
  google?: {
    accounts: {
      id: {
        initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
        renderButton: (parent: HTMLElement, options: Record<string, string | number | boolean>) => void;
      };
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: GoogleOAuthTokenResponse) => void;
        }) => GoogleTokenClient;
      };
    };
  };
};

const defaultApiUrl = typeof window !== 'undefined' && (
  window.location.hostname.includes('github.io') ||
  window.location.hostname.includes('pages.dev')
)
  ? 'https://hbnu-semiconductor-center-api.onrender.com'
  : 'http://localhost:4000';
const apiUrl = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL) ?? defaultApiUrl;
const bundledGoogleClientId = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID) ?? '';

function useGoogleClientId() {
  const [resolvedGoogleClientId, setResolvedGoogleClientId] = useState(bundledGoogleClientId);

  useEffect(() => {
    if (resolvedGoogleClientId) return;
    let isMounted = true;
    void apiGet<{ googleClientId?: string }>('/auth/config').then((config) => {
      if (isMounted && config?.googleClientId) {
        setResolvedGoogleClientId(config.googleClientId);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [resolvedGoogleClientId]);

  return resolvedGoogleClientId;
}

function loadGoogleIdentityScript() {
  const googleWindow = window as GoogleIdentityWindow;
  if (googleWindow.google?.accounts.id) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Identity script failed')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity script failed'));
    document.head.appendChild(script);
  });
}

const menu: Array<{ label: string; page: PageKey; icon: typeof Factory }> = [
  { label: '공지사항', page: 'notice', icon: Megaphone },
  { label: '센터소개', page: 'center', icon: Factory },
  { label: '장비현황', page: 'equipment', icon: Wrench },
  { label: '장비사용예약', page: 'reservations', icon: CalendarDays },
  { label: '교육신청', page: 'training', icon: GraduationCap },
  { label: '마이페이지', page: 'mypage', icon: UserRound }
];

const adminMenu: Array<{ label: string; page: PageKey; icon: typeof ShieldCheck }> = [
  { label: '관리자', page: 'admin', icon: ShieldCheck }
];

const adminOnlyPages = new Set<PageKey>(['admin', 'users', 'permissions', 'consumables', 'equipmentAdmin', 'penalties', 'noticeAdmin', 'educationAdmin', 'auditLogs']);

const quickLinks: Array<{ label: string; page: PageKey; icon: typeof CalendarDays }> = [
  { label: '장비 사용 예약', page: 'reservations', icon: CalendarDays },
  { label: '장비사용자 교육신청', page: 'training', icon: GraduationCap },
  { label: '장비 배치현황', page: 'equipment', icon: Microscope }
];

const MY_PAGE_ROLE_ORDER: MyPageRole[] = ['admin', 'faculty', 'representative', 'manager', 'general'];
const MY_PAGE_ROLE_META: Record<MyPageRole, { label: string; tone: string; icon: typeof ShieldCheck }> = {
  admin: { label: '관리자', tone: 'purple', icon: ShieldCheck },
  faculty: { label: '교원', tone: 'red', icon: School },
  representative: { label: '대표', tone: 'amber', icon: Star },
  manager: { label: '담당', tone: 'blue', icon: KeyRound },
  general: { label: '일반', tone: 'gray', icon: UserRound }
};
const initialManagedUsers = initialManagedUsersData as ManagedUser[];
const initialConsumables = initialConsumablesData as ConsumableItem[];

const categoryMeta: Record<EquipmentGroup, { title: string; subtitle: string; image: string; bullets: string[] }> = {
  process: {
    title: '공정',
    subtitle: '증착, 노광, 식각, 습식 공정 장비',
    image: 'https://images.unsplash.com/photo-1562408590-e32931084e23?auto=format&fit=crop&w=1200&q=85',
    bullets: ['Deposition', 'Lithography / Coating', 'Etching', 'Wet Process']
  },
  metrology: {
    title: '검사·계측·패키징',
    subtitle: '소자 검사, 전기적 계측, 패키징 실습 장비',
    image: 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=1200&q=85',
    bullets: ['Device Inspection', 'Electrical Measurement', 'Signal Analysis', 'Packaging Support']
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

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function toFileAssetDownloadUrl(asset: FileAsset) {
  return getApiUrl(`/file-assets/${encodeURIComponent(asset.id)}/download`);
}

function isProtectedFileAssetUrl(src?: string) {
  return Boolean(src && src.includes('/file-assets/') && src.includes('/download'));
}

function AuthenticatedImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    if (!src || !isProtectedFileAssetUrl(src)) {
      setObjectUrl('');
      return;
    }

    let revoked = false;
    let currentObjectUrl = '';
    void apiGetBlob(src, localStorage.getItem(STORAGE_KEYS.sessionToken)).then((blob) => {
      if (!blob || revoked) return;
      currentObjectUrl = URL.createObjectURL(blob);
      setObjectUrl(currentObjectUrl);
    });

    return () => {
      revoked = true;
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, [src]);

  return <img className={className} src={objectUrl || (isProtectedFileAssetUrl(src) ? undefined : src)} alt={alt} />;
}

function getPageFromBrowserUrl(): PageKey {
  if (typeof window === 'undefined') return 'home';
  const page = new URLSearchParams(window.location.search).get('page');
  return validPageKeys.has(page as PageKey) ? page as PageKey : 'home';
}

function getPageUrl(page: PageKey) {
  const url = new URL(window.location.href);
  if (page === 'home') {
    url.searchParams.delete('page');
  } else {
    url.searchParams.set('page', page);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function formatReservationTime(value?: string) {
  if (!value) return '';
  const [, time = ''] = value.split('T');
  return time.slice(0, 5);
}

function formatReservationRange(start: string, end?: string) {
  const startDate = start.slice(0, 10);
  const endDate = end?.slice(0, 10);
  const startTime = formatReservationTime(start);
  const endTime = formatReservationTime(end);
  if (!end || !endTime) return `${startDate} ${startTime}`;
  return `${startDate} ${startTime} - ${endDate && endDate !== startDate ? `${endDate} ` : ''}${endTime}`;
}

function toReservationDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function toApiReservationDateTime(value?: string) {
  if (!value) return value;
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+09:00`;
}

function fromApiReservationDateTime(value?: string) {
  if (!value) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : toLocalReservationDateTime(date);
}

function getReservationEndDate(form: Pick<ReservationForm, 'date' | 'endDate'>) {
  return form.endDate || form.date;
}

function isReservationRangeValid(form: Pick<ReservationForm, 'date' | 'endDate' | 'startTime' | 'endTime'>) {
  return new Date(toReservationDateTime(form.date, form.startTime)).getTime() < new Date(toReservationDateTime(getReservationEndDate(form), form.endTime)).getTime();
}

function reservationOverlaps(startA: string, endA = startA, startB: string, endB = startB) {
  return new Date(startA).getTime() < new Date(endB).getTime() && new Date(startB).getTime() < new Date(endA).getTime();
}

function getEventEquipmentId(event: ReservationEvent, equipmentItems: EquipmentItem[]) {
  return event.equipmentId ?? equipmentItems.find((item) => event.title.includes(item.name))?.id ?? '';
}

function getReservationEquipmentName(event: ReservationEvent, equipmentItems: EquipmentItem[]) {
  const equipmentId = getEventEquipmentId(event, equipmentItems);
  const equipmentName = equipmentItems.find((item) => item.id === equipmentId)?.name;
  if (equipmentName) return equipmentName;
  return event.title === '예약' ? '예약 장비' : event.title.split(' 예약')[0];
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

function getRealtimeCategoryLabel(item: EquipmentItem) {
  if (/etch|rie/i.test(item.name)) return 'ETCHING';
  if (/aligner|mask|lithography|coater/i.test(item.name)) return 'LITHOGRAPHY';
  if (item.group === 'metrology') return 'INSPECTION';
  return 'PROCESS';
}

function getRuntimeStatusLabel(status: EquipmentRuntimeStatus) {
  if (status === 'active') return '가동중';
  if (status === 'maintenance') return '점검중';
  return '대기';
}

function isEquipmentAvailable(item: EquipmentItem | undefined) {
  return (item?.status ?? 'available') === 'available';
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

function normalizeApiReservation(event: ApiReservationEvent): ReservationEvent {
  return {
    id: event.id,
    title: event.title ?? '예약',
    start: fromApiReservationDateTime(event.startsAt) ?? event.startsAt,
    end: fromApiReservationDateTime(event.endsAt),
    status: normalizeReservationStatus(event.status),
    equipmentId: event.equipmentId,
    userId: event.userId,
    createdBy: event.createdByRole,
    purpose: event.purpose,
    mine: event.mine
  };
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
    (item.category?.includes('공정') || ['Spin', 'Sputter', 'Ebeam', 'Evaporator', 'Mask', 'Aligner', 'Coater', 'ALD', '식각', 'Wet Station'].some((keyword) => name.includes(keyword))
      ? 'process'
      : 'metrology');

  return {
    id: item.id ?? `eq-${index + 1}`,
    name,
    model: item.model ?? (inferredGroup === 'process' ? `HB-P-${String(index + 1).padStart(3, '0')}` : `HB-M-${String(index + 1).padStart(3, '0')}`),
    category: inferredGroup === 'process' ? '공정 장비' : '검사·계측·패키징 장비',
    group: inferredGroup,
    groupName: inferredGroup === 'process' ? '공정' : '검사·계측·패키징',
    location: item.location ?? `공정동 ${Math.floor(index / 6) + 1}층`,
    image: item.image ?? item.imageUrl ?? fallbackEquipment[index % fallbackEquipment.length].image,
    features: item.features ?? ['예약 캘린더', '교육 인증', '사용 로그'],
    condition: item.condition ?? item.usageConditions ?? '교육 이수 후 사용 가능',
    status: item.status ?? 'available',
    description: item.description ?? `${name} 장비 운영 및 교육 관리용 등록 정보입니다.`,
    managerId: item.managerId ?? item.managerUserId ?? undefined,
    vendorName: item.vendorName,
    vendorContactName: item.vendorContactName,
    vendorContactPosition: item.vendorContactPosition,
    vendorContactPhone: item.vendorContactPhone,
    utilization: item.utilization ?? fallbackEquipment[index % fallbackEquipment.length].utilization,
    usageHours: item.usageHours ?? fallbackEquipment[index % fallbackEquipment.length].usageHours
  };
}

function getEquipmentOverrides(): Record<string, Partial<EquipmentItem>> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.equipmentOverrides);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function applyEquipmentOverrides(items: EquipmentItem[]) {
  const overrides = getEquipmentOverrides();
  return items.map((item) => ({ ...item, ...(overrides[item.id] ?? {}) }));
}

function toApiEquipmentPayload(item: Partial<EquipmentItem>) {
  const payload: Partial<EquipmentItem> & { imageUrl?: string; usageConditions?: string; managerUserId?: string | null } = {
    ...item,
    imageUrl: item.image,
    usageConditions: item.condition
  };
  if (Object.prototype.hasOwnProperty.call(item, 'managerId')) {
    payload.managerUserId = item.managerId ?? null;
  }
  return payload;
}

function useEquipmentData() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiUrl}/equipment`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('equipment api unavailable');
        return response.json();
      })
      .then((data: ApiEquipmentItem[]) => {
        localStorage.removeItem(STORAGE_KEYS.equipmentOverrides);
        setItems(data.map(normalizeEquipment));
        setSource('api');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setItems(applyEquipmentOverrides(fallbackEquipment));
        setSource('fallback');
      });

    return () => controller.abort();
  }, []);

  return { items, setItems, source };
}

const defaultDashboardMetrics: DashboardMetrics = {
  monthlyUptimeHours: 0,
  monthlyUptimeDeltaPercent: 0,
  certifiedUsers: 0,
  totalUsers: 0
};

function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(defaultDashboardMetrics);

  useEffect(() => {
    let isMounted = true;
    void apiGet<DashboardMetrics>('/dashboard/metrics').then((items) => {
      if (isMounted && items) {
        setMetrics({
          monthlyUptimeHours: Number(items.monthlyUptimeHours) || 0,
          monthlyUptimeDeltaPercent: Number(items.monthlyUptimeDeltaPercent) || 0,
          certifiedUsers: Number(items.certifiedUsers) || 0,
          totalUsers: Number(items.totalUsers) || 0
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return metrics;
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

function getConsumableStatus(item: ConsumableItem) {
  if (item.current <= item.minimum) return { label: '발주 필요', tone: 'danger' };
  if (item.current <= item.minimum * 1.5) return { label: '주의', tone: 'warning' };
  return { label: '정상', tone: 'good' };
}

function cloneConsumables(items = initialConsumables) {
  return items.map((item) => ({ ...item }));
}

function formatSeoulDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value));
}

function formatPenaltyDateTime(value: string | null) {
  if (!value) return '영구 제한';
  return formatSeoulDateTime(value);
}

function getPenaltyEndsAt(type: PenaltyType, startsAt: string) {
  if (type === '영구정지') return null;
  const end = new Date(startsAt);
  if (type === '1개월 정지') {
    end.setMonth(end.getMonth() + 1);
  } else {
    const days = type === '1주 사용정지' ? 7 : 14;
    end.setDate(end.getDate() + days);
  }
  return end.toISOString();
}

function isPenaltyActive(record: PenaltyRecord, now = new Date()) {
  if (record.revokedAt) return false;
  if (!record.endsAt) return true;
  return now.getTime() < new Date(record.endsAt).getTime();
}

function getPenaltyStatus(record: PenaltyRecord) {
  if (record.revokedAt) return '해지됨';
  return isPenaltyActive(record) ? '적용중' : '자동만료';
}

function formatPenaltyRemaining(record: PenaltyRecord) {
  if (record.revokedAt) return '관리자 해지 완료';
  if (!record.endsAt) return '영구정지';
  const remaining = new Date(record.endsAt).getTime() - Date.now();
  if (remaining <= 0) return '자동만료';
  const totalMinutes = Math.ceil(remaining / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  return `${minutes}분 남음`;
}

function getStoredSessionUser(): StoredSessionUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.sessionUser);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function getManagedUserForSession(sessionUser: StoredSessionUser | null, users: ManagedUser[]) {
  if (!sessionUser) return null;
  const sessionEmail = sessionUser.email?.toLowerCase();
  return users.find((user) => (
    (sessionUser.id && user.id === sessionUser.id) ||
    (sessionEmail && user.email.toLowerCase() === sessionEmail) ||
    (sessionUser.name && user.name === sessionUser.name)
  )) ?? null;
}

function getActivePenaltyForSession(sessionUser: StoredSessionUser | null, users: ManagedUser[], penalties: PenaltyRecord[]) {
  if (!sessionUser) return null;
  const matchedUser = getManagedUserForSession(sessionUser, users);
  if (!matchedUser) return null;
  return penalties.find((record) => record.userId === matchedUser.id && isPenaltyActive(record)) ?? null;
}

function cloneManagedUsers(items = initialManagedUsers) {
  return items.map((item) => ({ ...item }));
}

function normalizeManagedUsers(items: ManagedUser[]) {
  return items.map((item, index) => ({ ...item, index: index + 1 }));
}

function mergeManagedUsers(current: ManagedUser[], incoming: ManagedUser[]) {
  const next = [...current];
  incoming.forEach((user) => {
    const existingIndex = next.findIndex((item) => (
      item.id === user.id || item.email.toLowerCase() === user.email.toLowerCase()
    ));
    if (existingIndex >= 0) {
      next[existingIndex] = { ...next[existingIndex], ...user };
    } else {
      next.push(user);
    }
  });
  return normalizeManagedUsers(next);
}

function getPreviewEquipmentPermissionIds() {
  return ['eq-1', 'eq-2', 'eq-5', 'eq-14', 'eq-16', 'eq-19'];
}

function getPermissionGrantKey(userId: string, equipmentId: string) {
  return `${userId}:${equipmentId}`;
}
function formatProfessorLab(professor: string) {
  const name = professor.replace(/교수님|교수|Prof\.|Lab/gi, '').trim() || '백근우';
  return `Prof. ${name} Lab`;
}

function getProfessorTone(professor: string) {
  const palette: Record<string, string> = {
    '김민회': '#B56CFF',
    '노진성': '#38BDF8',
    '이재현': '#34D399',
    '전승배': '#F59E0B',
    '최윤석': '#F43F5E',
    '하지환': '#14B8A6',
    '정우익': '#818CF8',
    '구치완': '#F97316',
    '백근우': '#22D3EE'
  };
  const key = Object.keys(palette).find((name) => professor.includes(name));
  return key ? palette[key] : '#5FD9C9';
}

const roleLevelOptions: RoleLevel[] = ['교원', '대표', '일반'];
type OnboardingStatus = NonNullable<ManagedUser['onboardingStatus']>;
const onboardingStatusOptions: OnboardingStatus[] = ['profile_pending', 'training_pending', 'active'];
const permissionRoleOptions: PermissionRoleLevel[] = ['교원', '담당', '대표', '일반'];
const penaltyTypeOptions: PenaltyType[] = ['1주 사용정지', '2주 사용정지', '1개월 정지', '영구정지'];
const penaltyCategoryOptions: PenaltyCategory[] = ['장비활용관련', '안전관련', '학생자치기구 관련', '사고 유발'];

function normalizeRoleLevel(value: string): RoleLevel {
  return roleLevelOptions.includes(value as RoleLevel) ? value as RoleLevel : '일반';
}

function getOnboardingStatusLabel(status: ManagedUser['onboardingStatus']) {
  if (status === 'active') return '활성';
  if (status === 'profile_pending') return '정보등록 대기';
  return '교육이수 대기';
}

function getRoleToneClass(roleLevel: PermissionRoleLevel) {
  if (roleLevel === '교원') return 'is-faculty';
  if (roleLevel === '담당') return 'is-manager';
  if (roleLevel === '대표') return 'is-lead';
  return 'is-member';
}

function getPermissionRoleLevels(user: ManagedUser, managerUserIds: Set<string>): PermissionRoleLevel[] {
  return managerUserIds.has(user.id) ? [user.roleLevel, '담당'] : [user.roleLevel];
}

function getMyPageRoles(user: ManagedUser | null, sessionRole: Role | null, managerUserIds: Set<string>): MyPageRole[] {
  const roles = new Set<MyPageRole>();
  if (sessionRole === 'ADMIN') roles.add('admin');
  if (user?.roleLevel === '교원') roles.add('faculty');
  if (user?.roleLevel === '대표') roles.add('representative');
  if (user && managerUserIds.has(user.id)) roles.add('manager');
  if (!user || user.roleLevel === '일반') roles.add('general');
  return Array.from(roles);
}

function getAuthProviderLabel(provider: ManagedUser['authProvider'] | undefined) {
  if (provider === 'Google') return 'google 연동';
  if (provider === 'Kakao') return 'kakao 연동';
  return 'manual 계정';
}

function formatMyPageReservationDate(start: string, end?: string) {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const date = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).format(startDate);
  const startTime = formatReservationTime(start);
  const endTime = endDate ? formatReservationTime(endDate.toISOString()) : '';
  return `${date} · ${startTime}${endTime ? ` - ${endTime}` : ''}`;
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.startsWith('02')) {
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function downloadUsersExcel(rows: ManagedUser[]) {
  const escapeCell = (value: string | number) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const headers = ['연번', '이름', 'ROLE', '소속 학과', '지도교수명', '연락처', '이메일', '메모', '인증'];
  const body = rows.map((user, index) => [
    index + 1,
    user.name,
    user.roleLevel,
    user.department,
    user.labProfessor,
    user.phone,
    user.email,
    user.memo,
    user.authProvider ?? 'Manual'
  ]);
  const tableRows = [headers, ...body]
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join('')}</tr>`)
    .join('');
  const html = `\uFEFF<html><head><meta charset="utf-8" /></head><body><table>${tableRows}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `hbnu-users-${getSeoulDateKey()}.xls`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseUsersUpload(text: string) {
  const readRowsFromHtml = () => {
    const documentHtml = new DOMParser().parseFromString(text, 'text/html');
    return Array.from(documentHtml.querySelectorAll('tr')).map((row) => (
      Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent?.trim() ?? '')
    )).filter((row) => row.length > 0);
  };
  const readRowsFromCsv = () => text
    .split(/\r?\n/)
    .map((line) => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"').trim()))
    .filter((row) => row.some(Boolean));
  const rows = text.includes('<table') || text.includes('<tr') ? readRowsFromHtml() : readRowsFromCsv();
  const [headers = [], ...body] = rows;
  const indexOf = (label: string) => headers.findIndex((header) => header === label);
  const indexes = {
    index: indexOf('연번'),
    name: indexOf('이름'),
    roleLevel: indexOf('ROLE'),
    department: indexOf('소속 학과'),
    labProfessor: indexOf('지도교수명'),
    phone: indexOf('연락처'),
    email: indexOf('이메일'),
    memo: indexOf('메모'),
    authProvider: indexOf('인증')
  };

  if (indexes.name < 0 || indexes.roleLevel < 0 || indexes.labProfessor < 0 || indexes.email < 0) {
    throw new Error('사용자 엑셀 업로드 서식을 인식할 수 없습니다.');
  }

  return body
    .filter((row) => row[indexes.name])
    .map((row, index): ManagedUser => {
      const authProvider = row[indexes.authProvider];
      return {
        id: `uploaded-user-${Date.now()}-${index}`,
        index: Number(row[indexes.index]) || index + 1,
        name: row[indexes.name] || '',
        roleLevel: normalizeRoleLevel(row[indexes.roleLevel]),
        department: row[indexes.department] || '',
        labProfessor: row[indexes.labProfessor] || '',
        phone: formatPhoneNumber(row[indexes.phone] || ''),
        email: row[indexes.email] || '',
        memo: row[indexes.memo] || '',
        authProvider: (['Google', 'Kakao', 'Manual'].includes(authProvider) ? authProvider : 'Manual') as ManagedUser['authProvider']
      };
    });
}

function downloadConsumablesExcel(month: string, rows: ConsumableItem[]) {
  const escapeCell = (value: string | number) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const headers = ['월', '분류', '품명', '단위/비고', '월초재고', '현재고', '사용량', '최소기준', '상태', '메모'];
  const body = rows.map((item) => {
    const used = Math.max(item.monthStart - item.current, 0);
    const status = getConsumableStatus(item).label;
    return [month, item.category, item.name, item.unit, item.monthStart, item.current, used, item.minimum, status, item.note];
  });
  const tableRows = [headers, ...body]
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join('')}</tr>`)
    .join('');
  const html = `\uFEFF<html><head><meta charset="utf-8" /></head><body><table>${tableRows}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `consumables-${month}.xls`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseConsumablesUpload(text: string) {
  const normalizeNumber = (value: string) => Number(String(value).replace(/,/g, '').trim()) || 0;
  const readRowsFromHtml = () => {
    const documentHtml = new DOMParser().parseFromString(text, 'text/html');
    return Array.from(documentHtml.querySelectorAll('tr')).map((row) => (
      Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent?.trim() ?? '')
    )).filter((row) => row.length > 0);
  };
  const readRowsFromCsv = () => text
    .split(/\r?\n/)
    .map((line) => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"').trim()))
    .filter((row) => row.some(Boolean));
  const rows = text.includes('<table') || text.includes('<tr') ? readRowsFromHtml() : readRowsFromCsv();
  const [headers = [], ...body] = rows;
  const indexOf = (label: string) => headers.findIndex((header) => header === label);
  const indexes = {
    month: indexOf('월'),
    category: indexOf('분류'),
    name: indexOf('품명'),
    unit: indexOf('단위/비고'),
    monthStart: indexOf('월초재고'),
    current: indexOf('현재고'),
    minimum: indexOf('최소기준'),
    note: indexOf('메모')
  };

  if (indexes.category < 0 || indexes.name < 0 || indexes.current < 0) {
    throw new Error('소모품 엑셀 업로드 서식을 인식할 수 없습니다.');
  }

  const importedMonth = body.find((row) => row[indexes.month])?.[indexes.month] ?? '';
  const items = body
    .filter((row) => row[indexes.name])
    .map((row, index) => ({
      id: `uploaded-supply-${Date.now()}-${index}`,
      category: row[indexes.category] || '미분류',
      name: row[indexes.name] || '품목명 없음',
      unit: row[indexes.unit] || '',
      monthStart: normalizeNumber(row[indexes.monthStart]),
      current: normalizeNumber(row[indexes.current]),
      minimum: normalizeNumber(row[indexes.minimum]),
      note: row[indexes.note] || ''
    }));

  return { month: importedMonth.match(/^\d{4}-\d{2}$/) ? importedMonth : '', items };
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

function HanbatLogoMark() {
  return (
    <svg className="hanbat-logo-mark" viewBox="0 0 44 44" aria-hidden="true">
      <path d="M37.2764 10.8181L26.4746 13.7129L32.79 37.2859L43.5917 34.3911L37.2764 10.8181Z" fill="#22d3ee" />
      <path d="M29.8935 26.4825L6.32422 32.7988L9.21854 43.6023L32.7878 37.2859L29.8935 26.4825Z" fill="#3b82f6" />
      <path d="M34.3779 0.00005L10.8086 6.31641L13.7029 17.1198L37.2722 10.8035L34.3779 0.00005Z" fill="#f5b942" />
      <path d="M10.8086 6.32454L0 9.2207L6.31629 32.7934L17.1249 29.8973L10.8086 6.32454Z" fill="#fb7185" />
    </svg>
  );
}

function InstitutionHeader({
  onNavigate,
  sessionRole,
  onPreviewPenaltyTest,
  onLogout
}: {
  onNavigate: (page: PageKey) => void;
  sessionRole: Role | null;
  onPreviewPenaltyTest: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-5 px-5 py-3 2xl:px-8">
        <button className="flex items-center gap-3 text-left" onClick={() => onNavigate('home')}>
          <div className="brand-mark">
            <HanbatLogoMark />
          </div>
          <div>
            <p className="text-xs font-bold text-cyan-300">HBNU SEMICONDUCTOR CENTER</p>
            <h1 className="text-lg font-extrabold text-white sm:text-xl">반도체 장비 공동활용 플랫폼</h1>
          </div>
        </button>
        <div className="hidden items-center gap-2 md:flex">
          <button type="button" className="rounded-md border border-red-300/40 px-3 py-2 text-sm font-extrabold text-red-100 hover:bg-red-500 hover:text-white" onClick={onPreviewPenaltyTest}>
            페널티 TEST
          </button>
          {sessionRole ? (
            <>
              <span className="rounded-md bg-white px-4 py-2 text-sm font-extrabold text-slate-950">
                {sessionRole === 'ADMIN' ? 'ADMIN 접속중' : 'USER 접속중'}
              </span>
              <button type="button" className="rounded-md border border-white/25 px-4 py-2 text-sm font-extrabold text-white hover:bg-white hover:text-slate-950" onClick={onLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <button type="button" className="rounded-md bg-white px-4 py-2 text-sm font-extrabold text-slate-950 hover:bg-cyan-200" onClick={() => onNavigate('login')}>
              로그인
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function OwnerInfoFooter() {
  return (
    <footer className="owner-info-footer" aria-label="소유기관 기본 정보">
      <div className="owner-info-brand">
        <School size={30} aria-hidden="true" />
        <strong>HBNU Semiconductor Center</strong>
      </div>
      <div className="owner-info-lines">
        <p>
          <span>기관명: 국립한밭대학교</span>
          <span>운영부서: 창의융합교육센터 / 반도체 장비 공동활용 플랫폼</span>
          <span>센터장: 홍길동</span>
        </p>
        <p>
          <span>주소: 대전광역시 유성구 동서대로 125, N-Facility FAB</span>
          <span>대표번호: 042-000-0000</span>
          <span>이메일: nfabric@hanbat.ac.kr</span>
        </p>
        <p>
          <span>개인정보보호책임자: 창의융합교육센터 행정팀</span>
          <span>장비예약/교육문의: equipment@hanbat.ac.kr</span>
          <span>Copyright 2026 Hanbat National University. All rights reserved.</span>
        </p>
      </div>
    </footer>
  );
}

function SidebarNavigation({
  activePage,
  onNavigate,
  isAdmin,
  canManageAssignedPermissions
}: {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  isAdmin: boolean;
  canManageAssignedPermissions: boolean;
}) {
  const noticePages: PageKey[] = ['notice', 'operationNotice', 'meetingNotice'];
  const inquiryPages: PageKey[] = ['faq', 'qna'];
  const reservationPages: PageKey[] = ['reservations', 'managerPermissions'];
  const trainingPages: PageKey[] = ['training', 'trainingManagement'];
  const [noticeOpen, setNoticeOpen] = useState(() => noticePages.includes(activePage));
  const [inquiryOpen, setInquiryOpen] = useState(() => inquiryPages.includes(activePage));
  const [reservationOpen, setReservationOpen] = useState(() => reservationPages.includes(activePage));
  const [trainingOpen, setTrainingOpen] = useState(() => trainingPages.includes(activePage));
  const noticeSelected = noticePages.includes(activePage);
  const inquirySelected = inquiryPages.includes(activePage);
  const reservationSelected = reservationPages.includes(activePage);
  const trainingSelected = trainingPages.includes(activePage);
  const noticeItem = menu.find((item) => item.page === 'notice');
  const centerItem = menu.find((item) => item.page === 'center');
  const equipmentItem = menu.find((item) => item.page === 'equipment');
  const reservationItem = menu.find((item) => item.page === 'reservations');
  const trainingItem = menu.find((item) => item.page === 'training');
  const mypageItem = menu.find((item) => item.page === 'mypage');

  function renderNavButton(item: (typeof menu)[number] | undefined, selected: boolean) {
    if (!item) return null;
    const Icon = item.icon;
    return (
      <button type="button" className={`sidebar-nav-item ${selected ? 'is-active' : ''}`} onClick={() => onNavigate(item.page)}>
        <Icon size={18} />
        <span>{item.label}</span>
      </button>
    );
  }

  function renderDropdown({
    item,
    open,
    selected,
    onToggle,
    children
  }: {
    item: (typeof menu)[number] | undefined;
    open: boolean;
    selected: boolean;
    onToggle: () => void;
    children: ReactNode;
  }) {
    if (!item) return null;
    const Icon = item.icon;
    return (
      <div className={`sidebar-dropdown ${open ? 'is-open' : ''}`}>
        <button
          type="button"
          className={`sidebar-nav-item sidebar-dropdown-trigger ${selected ? 'is-active' : ''}`}
          aria-expanded={open}
          onClick={onToggle}
        >
          <Icon size={18} />
          <span>{item.label}</span>
          <ChevronDown size={16} />
        </button>
        <div className="sidebar-subnav" aria-hidden={!open}>
          {children}
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (noticeSelected) setNoticeOpen(true);
  }, [noticeSelected]);

  useEffect(() => {
    if (inquirySelected) setInquiryOpen(true);
  }, [inquirySelected]);

  useEffect(() => {
    if (reservationSelected) setReservationOpen(true);
  }, [reservationSelected]);

  useEffect(() => {
    if (trainingSelected) setTrainingOpen(true);
  }, [trainingSelected]);

  return (
    <div className="sidebar-stack">
      <aside className="app-sidebar" aria-label="주요 메뉴">
        <div className="sidebar-section-label">Navigation</div>
        <nav className="sidebar-nav">
          {renderDropdown({
            item: noticeItem,
            open: noticeOpen,
            selected: noticeSelected,
            onToggle: () => setNoticeOpen((current) => !current),
            children: (
              <>
                <button
                  type="button"
                  className={`sidebar-subnav-item ${activePage === 'operationNotice' ? 'is-active' : ''}`}
                  onClick={() => onNavigate('operationNotice')}
                >
                  <Factory size={15} />
                  <span>운영공지</span>
                </button>
                <button
                  type="button"
                  className={`sidebar-subnav-item ${activePage === 'meetingNotice' ? 'is-active' : ''}`}
                  onClick={() => onNavigate('meetingNotice')}
                >
                  <MessageSquare size={15} />
                  <span>회의공지</span>
                </button>
              </>
            )
          })}
          {renderNavButton(centerItem, activePage === 'center')}
          {renderNavButton(equipmentItem, activePage === 'equipment')}
          {canManageAssignedPermissions
            ? renderDropdown({
                item: reservationItem,
                open: reservationOpen,
                selected: reservationSelected,
                onToggle: () => {
                  if (activePage !== 'reservations') {
                    setReservationOpen(true);
                    onNavigate('reservations');
                    return;
                  }
                  setReservationOpen((current) => !current);
                },
                children: (
                  <>
                    <button
                      type="button"
                      className={`sidebar-subnav-item ${activePage === 'reservations' ? 'is-active' : ''}`}
                      onClick={() => onNavigate('reservations')}
                    >
                      <CalendarDays size={15} />
                      <span>장비사용예약</span>
                    </button>
                    <button
                      type="button"
                      className={`sidebar-subnav-item ${activePage === 'managerPermissions' ? 'is-active' : ''}`}
                      onClick={() => onNavigate('managerPermissions')}
                    >
                      <LockKeyhole size={15} />
                      <span>사용권한부여(담당)</span>
                    </button>
                  </>
                )
              })
            : renderNavButton(reservationItem, activePage === 'reservations')}
          {canManageAssignedPermissions
            ? renderDropdown({
                item: trainingItem,
                open: trainingOpen,
                selected: trainingSelected,
                onToggle: () => {
                  if (activePage !== 'training') {
                    setTrainingOpen(true);
                    onNavigate('training');
                    return;
                  }
                  setTrainingOpen((current) => !current);
                },
                children: (
                  <>
                    <button
                      type="button"
                      className={`sidebar-subnav-item ${activePage === 'training' ? 'is-active' : ''}`}
                      onClick={() => onNavigate('training')}
                    >
                      <GraduationCap size={15} />
                      <span>교육신청</span>
                    </button>
                    <button
                      type="button"
                      className={`sidebar-subnav-item ${activePage === 'trainingManagement' ? 'is-active' : ''}`}
                      onClick={() => onNavigate('trainingManagement')}
                    >
                      <GraduationCap size={15} />
                      <span>교육신청관리(담당)</span>
                    </button>
                  </>
                )
              })
            : renderNavButton(trainingItem, activePage === 'training')}
          <div className={`sidebar-dropdown ${inquiryOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className={`sidebar-nav-item sidebar-dropdown-trigger ${inquirySelected ? 'is-active' : ''}`}
              onClick={() => setInquiryOpen((current) => !current)}
              aria-expanded={inquiryOpen}
            >
              <HelpCircle size={18} />
              <span>문의사항</span>
              <ChevronDown size={16} />
            </button>
            <div className="sidebar-subnav" aria-hidden={!inquiryOpen}>
              <button
                type="button"
                className={`sidebar-subnav-item ${activePage === 'faq' ? 'is-active' : ''}`}
                onClick={() => onNavigate('faq')}
              >
                <BookOpen size={15} />
                <span>자주 묻는 내용</span>
              </button>
              <button
                type="button"
                className={`sidebar-subnav-item ${activePage === 'qna' ? 'is-active' : ''}`}
                onClick={() => onNavigate('qna')}
              >
                <MessageSquare size={15} />
                <span>사용자 Q&amp;A</span>
              </button>
            </div>
          </div>
          {renderNavButton(mypageItem, activePage === 'mypage')}
        </nav>
        {isAdmin && (
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
        )}
      </aside>
    </div>
  );
}

function Hero({
  onNavigate,
  onReservationAction,
  equipmentItems,
  userName,
  userLab,
  userRole,
  grantedEquipmentItems,
  isAdmin,
  accountStatus,
  notices,
  dashboardReservations,
  dashboardMetrics
}: {
  onNavigate: (page: PageKey) => void;
  onReservationAction: () => void;
  equipmentItems: EquipmentItem[];
  userName: string;
  userLab: string;
  userRole: ManagedUser['roleLevel'];
  grantedEquipmentItems: EquipmentItem[];
  isAdmin: boolean;
  accountStatus: 'guest' | 'profileRequired' | 'ready';
  notices: NoticeItem[];
  dashboardReservations: ReservationEvent[];
  dashboardMetrics: DashboardMetrics;
}) {
  const [showAllPermissions, setShowAllPermissions] = useState(false);
  const collapsedPermissionItems = grantedEquipmentItems.slice(0, 3);
  const visiblePermissionItems = showAllPermissions ? grantedEquipmentItems : collapsedPermissionItems;
  const hiddenPermissionCount = Math.max(grantedEquipmentItems.length - collapsedPermissionItems.length, 0);
  const roleToneClass = getRoleToneClass(userRole);
  const needsAccountAction = accountStatus !== 'ready';
  const visibleDashboardReservations = dashboardReservations.slice(0, 2);
  const statusBadgeLabel = accountStatus === 'profileRequired'
    ? '회원정보 등록 필요'
    : formatProfessorLab(userLab);

  return (
    <section className={`hero-panel relative overflow-hidden ${accountStatus === 'guest' ? 'is-guest-session' : ''}`}>
      <div className="hero-intro">
        <div className="hero-logo-watermarks" aria-hidden="true">
          <span className="hero-logo-watermark is-primary"><HanbatLogoMark /></span>
          <span className="hero-logo-watermark is-secondary"><HanbatLogoMark /></span>
          <span className="hero-logo-watermark is-tertiary"><HanbatLogoMark /></span>
        </div>
        <div className="hero-intro-copy">
          <p className="hero-breadcrumb">N-FACILITY · FAB OPERATION · EQUIPMENT RESERVATION</p>
          <h2 className="hero-title">
              <span>국립한밭대학교 창의융합교육센터</span>
              <span>인프라 <em>통합 관리</em> 시스템</span>
          </h2>
          <p className="hero-copy">
            장비 소개·교육 인증·예약 관리·사용률 분석을 통합한 운영 플랫폼입니다.
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
        <div className={`hero-user-summary ${accountStatus === 'guest' ? 'is-guest' : accountStatus === 'profileRequired' ? 'is-profile-required' : ''}`} aria-label="사용자 예약 요약">
          <div className="hero-user-summary-head">
            {accountStatus === 'guest' ? (
              <h3 className="hero-guest-login-title">
                <AlertTriangle size={19} aria-hidden="true" />
                로그인이 필요합니다.
              </h3>
            ) : accountStatus === 'profileRequired' ? (
              <h3>회원정보 등록이 필요합니다.</h3>
            ) : (
              <h3><strong>{userName}</strong> 님 환영합니다.</h3>
            )}
            {accountStatus !== 'guest' && (
              <span style={{ borderColor: `${getProfessorTone(userLab)}66`, backgroundColor: `${getProfessorTone(userLab)}1f`, color: getProfessorTone(userLab) }}>
                {statusBadgeLabel}
              </span>
            )}
          </div>
          <div className="hero-user-permissions" aria-label="사용자 역할 및 장비 권한">
            {accountStatus === 'guest' ? (
              <>
                <span className="hero-role-badge is-guest">VISITOR</span>
                <span className="hero-permission-badge is-readonly">공지·장비현황 열람 가능</span>
                <span className="hero-permission-badge is-locked">예약·교육신청 제한</span>
              </>
            ) : accountStatus === 'profileRequired' ? (
              <span className="hero-permission-badge is-empty">회원정보 등록 후 교육신청을 이용할 수 있습니다.</span>
            ) : (
              <>
                <span className={`hero-role-badge ${roleToneClass}`}>{isAdmin ? 'ADMIN' : userRole}</span>
                {!isAdmin && visiblePermissionItems.length > 0 ? (
                  <>
                    {visiblePermissionItems.map((item) => (
                      <span key={item.id} className={`hero-permission-badge is-${item.group}`}>{item.name}</span>
                    ))}
                    {hiddenPermissionCount > 0 && (
                      <button
                        type="button"
                        className="hero-permission-badge is-more"
                        onClick={() => setShowAllPermissions((current) => !current)}
                        aria-expanded={showAllPermissions}
                        aria-label={showAllPermissions ? '장비 권한 목록 접기' : `숨겨진 장비 권한 ${hiddenPermissionCount}개 모두 보기`}
                      >
                        {showAllPermissions ? '접기' : `+${hiddenPermissionCount}`}
                      </button>
                    )}
                  </>
                ) : !isAdmin ? (
                  <span className="hero-permission-badge is-empty">부여된 장비 권한 없음</span>
                ) : null}
              </>
            )}
          </div>
          <div className="hero-reservation-list">
            {accountStatus === 'guest' ? (
              <div className="hero-reservation-row is-message is-guest-message">
                <strong>로그인 후 시스템 이용이 가능합니다.</strong>
                <button type="button" className="hero-reservation-action" onClick={onReservationAction}>
                  로그인 안내
                </button>
              </div>
            ) : needsAccountAction ? (
              <div className="hero-reservation-row is-message">
                <time>-</time>
                <strong>회원정보 등록 후 예약 현황을 확인할 수 있습니다.</strong>
                <button type="button" className="hero-reservation-action" onClick={onReservationAction}>
                  회원가입 필요
                </button>
              </div>
            ) : visibleDashboardReservations.length > 0 ? (
              <>
                {visibleDashboardReservations.map((event) => (
                  <div key={event.id} className="hero-reservation-row">
                    <time>{formatReservationTime(event.start)}</time>
                    <strong>{getReservationEquipmentName(event, equipmentItems)}</strong>
                    <button type="button" className="hero-reservation-action" onClick={onReservationAction}>전체 보기</button>
                  </div>
                ))}
              </>
            ) : (
              <div className="hero-reservation-row is-message">
                <time>-</time>
                <strong>오늘 예정된 예약이 없습니다.</strong>
                <button type="button" className="hero-reservation-action" onClick={onReservationAction}>
                  예약하기
                </button>
              </div>
            )}
          </div>
          {accountStatus !== 'guest' && (
            <div className="hero-user-summary-foot">
              <span>{needsAccountAction ? '로그인 후 예약 기능 이용 가능' : dashboardReservations.length > 0 ? `오늘 이용 예약 ${dashboardReservations.length}건` : '오늘 이용 예약 없음'}</span>
              <button type="button" aria-label="내 예약 전체 보기" onClick={onReservationAction}>
                {needsAccountAction ? '조건 확인' : dashboardReservations.length > 0 ? '전체 보기' : '예약하기'}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="hero-metrics-panel">
        <div>
          <p className="hero-section-label">운영 지표</p>
          <StatGrid equipmentItems={equipmentItems} metrics={dashboardMetrics} />
        </div>
        <DashboardNoticePanel notices={notices} onNavigate={onNavigate} />
      </div>
    </section>
  );
}

function DashboardNoticePanel({ notices, onNavigate }: { notices: NoticeItem[]; onNavigate: (page: PageKey) => void }) {
  const dashboardNotices = notices.slice(0, 4);

  return (
    <div className="dashboard-notice-panel">
      <div className="dashboard-notice-head">
        <div>
          <p className="hero-section-label">Notice</p>
          <h3 className="dashboard-notice-title">
            <span className="dashboard-notice-icon" aria-hidden="true">
              <Megaphone size={18} />
            </span>
            공지사항
          </h3>
        </div>
        <button type="button" onClick={() => onNavigate('notice')}>전체 보기</button>
      </div>
      <div className="dashboard-notice-list" aria-label="대시보드 공지사항">
        {dashboardNotices.map((notice) => (
          <button key={notice.id} type="button" className="dashboard-notice-row" onClick={() => onNavigate('notice')}>
            <span className={`dashboard-notice-category ${getNoticeCategoryTone(notice.category)}`}>{notice.category}</span>
            <strong>{notice.title}</strong>
            <time>{notice.date}</time>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatGrid({ equipmentItems, metrics }: { equipmentItems: EquipmentItem[]; metrics: DashboardMetrics }) {
  const totalHours = metrics.monthlyUptimeHours;
  const monthlyDelta = metrics.monthlyUptimeDeltaPercent;
  const averageUtilization = equipmentItems.length > 0
    ? Math.round(equipmentItems.reduce((sum, item) => sum + item.utilization, 0) / equipmentItems.length)
    : 0;
  const educationDetail = metrics.totalUsers > 0 ? `전체 ${metrics.totalUsers.toLocaleString()}명 기준` : '등록 사용자 없음';

  const statCards = [
    { label: '운영 장비', value: `${equipmentItems.length}`, unit: '종', detail: '공정·검사계측패키징', icon: Wrench, type: 'text' as const },
    { label: '월간 가동시간', value: `${Math.round(totalHours).toLocaleString()}`, unit: 'h', detail: `전월 대비 ${monthlyDelta > 0 ? '+' : ''}${monthlyDelta}%`, icon: Gauge, type: 'trend' as const },
    { label: '교육 인증', value: `${metrics.certifiedUsers.toLocaleString()}`, unit: '명', detail: educationDetail, icon: CheckCircle2, type: 'text' as const },
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
    const status: EquipmentRuntimeStatus = !isEquipmentAvailable(item) || maintenanceEvent ? 'maintenance' : activeEvent ? 'active' : 'idle';
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
                    ? activeEvent ? `${formatReservationTime(activeEvent.start)} - ${formatReservationTime(activeEvent.end)} 점검` : '장비 이용불가'
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

function AutoRotatingEquipmentStatus({
  equipmentItems,
  calendarEvents,
  autoRotate = true
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  autoRotate?: boolean;
}) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [rotationCycle, setRotationCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [clock, setClock] = useState(getSeoulClockParts);
  const rotationTimerRef = useRef<number | null>(null);
  const rotationStartedAtRef = useRef(0);
  const rotationRemainingRef = useRef(5000);
  const activeSlideIndexRef = useRef(activeSlideIndex);
  const rotationIntervalMs = 5000;
  const canAutoRotate = autoRotate && !reducedMotion;

  const statusItems = useMemo(() => equipmentItems.map((item) => {
    const maintenanceEvent = calendarEvents.find((event) => isMaintenanceReservation(event) && isEventForEquipment(event, item, equipmentItems) && isReservationActive(event));
    const activeEvent = calendarEvents.find((event) => !isMaintenanceReservation(event) && isEventForEquipment(event, item, equipmentItems) && isReservationActive(event));
    const status: EquipmentRuntimeStatus = !isEquipmentAvailable(item) || maintenanceEvent ? 'maintenance' : activeEvent ? 'active' : 'idle';
    return {
      item,
      activeEvent: maintenanceEvent ?? activeEvent,
      status
    };
  }), [calendarEvents, equipmentItems]);

  const activeCount = statusItems.filter((entry) => entry.status === 'active').length;
  const maintenanceCount = statusItems.filter((entry) => entry.status === 'maintenance').length;
  const idleCount = Math.max(statusItems.length - activeCount - maintenanceCount, 0);
  const equipmentSlides = useMemo(() => {
    const statusOrder: Record<EquipmentRuntimeStatus, number> = {
      active: 0,
      maintenance: 1,
      idle: 2
    };
    const sortedStatusItems = [...statusItems].sort((first, second) => statusOrder[first.status] - statusOrder[second.status]);
    const processItems = sortedStatusItems.filter((entry) => entry.item.group === 'process');
    const metrologyItems = sortedStatusItems.filter((entry) => entry.item.group === 'metrology');
    const metrologyPages = metrologyItems.length > 0
      ? [metrologyItems.slice(0, 8), metrologyItems.slice(8, 16)].filter((page) => page.length > 0)
      : [[]];
    return [
      {
        id: 'process',
        group: 'process' as EquipmentGroup,
        title: '공정',
        count: processItems.length,
        icon: equipmentCategoryCardMeta.process.icon,
        accent: `rgb(${equipmentCategoryCardMeta.process.accent})`,
        items: processItems.slice(0, 8)
      },
      ...metrologyPages.map((items, pageIndex) => ({
        id: `metrology-${pageIndex + 1}`,
        group: 'metrology' as EquipmentGroup,
        title: '검사·계측·패키징',
        count: metrologyItems.length,
        icon: equipmentCategoryCardMeta.metrology.icon,
        accent: `rgb(${equipmentCategoryCardMeta.metrology.accent})`,
        items
      }))
    ];
  }, [statusItems]);
  const activeSlide = equipmentSlides[activeSlideIndex] ?? equipmentSlides[0];
  const equipmentTabs = useMemo(() => {
    const tabGroups = new Set<EquipmentGroup>();
    return equipmentSlides.reduce<Array<(typeof equipmentSlides)[number] & { viewIndex: number }>>((tabs, slide, viewIndex) => {
      if (tabGroups.has(slide.group)) return tabs;
      tabGroups.add(slide.group);
      tabs.push({ ...slide, viewIndex });
      return tabs;
    }, []);
  }, [equipmentSlides]);
  const applyStatusView = useCallback((slideIndex: number) => {
    activeSlideIndexRef.current = slideIndex;
    setActiveSlideIndex(slideIndex);
  }, []);
  const clearRotationTimer = useCallback(() => {
    if (rotationTimerRef.current) {
      window.clearTimeout(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }
  }, []);
  const selectSlide = (index: number) => {
    clearRotationTimer();
    rotationRemainingRef.current = rotationIntervalMs;
    applyStatusView(index);
    setRotationCycle((cycle) => cycle + 1);
  };
  const pauseRotation = () => {
    if (rotationTimerRef.current) {
      const elapsedMs = Date.now() - rotationStartedAtRef.current;
      rotationRemainingRef.current = Math.max(rotationRemainingRef.current - elapsedMs, 160);
      clearRotationTimer();
    }
    setPaused(true);
  };
  const resumeRotation = () => {
    setPaused(false);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setClock(getSeoulClockParts()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    clearRotationTimer();
  }, [clearRotationTimer]);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotionPreference = () => setReducedMotion(motionQuery.matches);
    syncMotionPreference();
    motionQuery.addEventListener('change', syncMotionPreference);
    return () => motionQuery.removeEventListener('change', syncMotionPreference);
  }, []);

  useEffect(() => {
    clearRotationTimer();
    if (!canAutoRotate || paused || equipmentSlides.length <= 1) return undefined;
    rotationStartedAtRef.current = Date.now();
    rotationTimerRef.current = window.setTimeout(() => {
      const nextSlideIndex = (activeSlideIndexRef.current + 1) % equipmentSlides.length;
      rotationRemainingRef.current = rotationIntervalMs;
      applyStatusView(nextSlideIndex);
      setRotationCycle((cycle) => cycle + 1);
    }, rotationRemainingRef.current);
    return () => {
      clearRotationTimer();
    };
  }, [activeSlideIndex, applyStatusView, canAutoRotate, clearRotationTimer, equipmentSlides.length, paused]);

  return (
    <section
      className={`auto-equipment-status ${paused ? 'is-paused' : ''}`}
      aria-labelledby="auto-equipment-status-title"
      style={{
        '--auto-status-duration': `${rotationIntervalMs}ms`,
        '--auto-status-accent': activeSlide.accent
      } as CSSProperties}
      onMouseEnter={pauseRotation}
      onMouseLeave={resumeRotation}
    >
      <h2 className="sr-only" id="auto-equipment-status-title">통합 장비 현황</h2>
      <div className="auto-status-head">
        <div>
          <p className="auto-status-eyebrow">Equipment · Live Status</p>
          <h3>장비 현황</h3>
        </div>
        <div className="auto-status-meta">
          <span className="auto-status-pause">호버 중 · 자동전환 일시정지</span>
          <span className="auto-status-pill is-active">가동중 {activeCount}</span>
          <span className="auto-status-pill is-maintenance">점검 {maintenanceCount}</span>
          <span className="auto-status-pill is-idle">대기 {idleCount}</span>
          <time className="auto-status-time">{clock.month}.{clock.day} · {clock.hour}:{clock.minute}</time>
        </div>
      </div>
      <div className="auto-status-tabs" role="tablist" aria-label="장비 카테고리">
        {equipmentTabs.map((slide) => {
          const Icon = slide.icon;
          const isActive = activeSlide.group === slide.group;
          return (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${slide.title} ${slide.count}종`}
              className={`auto-status-tab ${isActive ? 'is-active' : ''}`}
              style={{ '--auto-status-tab-accent': slide.accent } as CSSProperties}
              onClick={() => selectSlide(slide.viewIndex)}
            >
              <span className="auto-status-tab-label">
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                {slide.title}
                <em>{slide.count}종</em>
              </span>
              <span className="auto-status-progress" aria-hidden="true">
                {isActive && <span key={`${slide.id}-${rotationCycle}`} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="auto-status-stage">
        {equipmentSlides.map((slide, slideIndex) => {
          const isActive = activeSlideIndex === slideIndex;
          return (
            <div
              key={`${slide.id}-${rotationCycle}`}
              className={`auto-status-grid ${isActive ? 'is-active' : ''}`}
              role="tabpanel"
              aria-hidden={!isActive}
              aria-label={`${slide.title} ${slide.count}종 장비 상태`}
              style={{ '--auto-status-accent': slide.accent } as CSSProperties}
            >
              {slide.items.map(({ item, activeEvent, status }) => {
                const accent = status === 'active' ? '#34d6b0' : status === 'maintenance' ? '#f5b942' : '#3a4456';
                const message = status === 'active'
                  ? `~${formatReservationTime(activeEvent?.end)} 종료`
                  : status === 'maintenance'
                    ? activeEvent ? `~${formatReservationTime(activeEvent.end)} 점검` : '점검 중'
                    : '예약 가능 →';
                return (
                  <article
                    key={item.id}
                    className={`auto-status-cell is-${status}`}
                    aria-label={`${item.name} ${getRuntimeStatusLabel(status)}`}
                  >
                    <span className="auto-status-bar" style={{ background: accent }} />
                    <span className="auto-status-copy">
                      <span className="auto-status-cell-top">
                        <span className="auto-status-category">{getRealtimeCategoryLabel(item)}</span>
                      </span>
                      <span className={`runtime-status-badge is-${status}`}>{getRuntimeStatusLabel(status)}</span>
                      <strong>{item.name}</strong>
                      <small>{message}</small>
                    </span>
                  </article>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EquipmentGateway({
  equipmentItems,
  onOpen,
  action = null
}: {
  equipmentItems: EquipmentItem[];
  onOpen: (group: EquipmentGroup) => void;
  action?: string | ReactNode | null;
}) {
  const grouped = {
    process: equipmentItems.filter((item) => item.group === 'process'),
    metrology: equipmentItems.filter((item) => item.group === 'metrology')
  };

  return (
    <section className="eq-inventory" id="장비목록요약" aria-labelledby="eq-inventory-title">
      <div className="eq-inventory-head">
        <div>
          <p className="eq-eyebrow">Equipment Inventory</p>
          <h2 id="eq-inventory-title" className="eq-title">장비 목록</h2>
        </div>
        {action}
      </div>
      <div className="eq-grid">
        {(Object.keys(categoryMeta) as EquipmentGroup[]).map((group) => {
          const meta = categoryMeta[group];
          const cardMeta = equipmentCategoryCardMeta[group];
          const Icon = cardMeta.icon;
          const count = grouped[group].length;
          const cardStyle = {
            '--accent': cardMeta.accent,
            '--head-bg': cardMeta.headBg
          } as CSSProperties;

          return (
            <a
              key={group}
              className="eq-card"
              style={cardStyle}
              href={cardMeta.href}
              aria-label={`${meta.title} 장비 현황 보기, 등록 ${count}종`}
              onClick={(event) => {
                event.preventDefault();
                onOpen(group);
              }}
            >
              <div className="eq-head">
                <div className="eq-head-left">
                  <span className="eq-icon" aria-hidden="true">
                    <Icon size={24} strokeWidth={1.7} />
                  </span>
                  <div>
                    <div className="eq-cat">{meta.title}</div>
                    <div className="eq-desc">{meta.subtitle}</div>
                  </div>
                </div>
                <div className="eq-count">
                  <div className="eq-count-label">등록 장비</div>
                  <div className="eq-count-num">{count}종</div>
                </div>
              </div>
              <div className="eq-body">
                <div className="eq-tags">
                  {meta.bullets.map((bullet) => (
                    <span key={bullet} className="eq-tag">{bullet}</span>
                  ))}
                </div>
                <div className="eq-cta">
                  장비 현황 보기
                  <svg className="eq-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function Dashboard({
  equipmentItems,
  calendarEvents,
  managedUsers,
  sessionUserName,
  sessionRole,
  sessionUser,
  currentUser,
  equipmentPermissions,
  notices,
  dashboardMetrics,
  onNavigate
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  managedUsers: ManagedUser[];
  sessionUserName: string;
  sessionRole: Role | null;
  sessionUser: StoredSessionUser | null;
  currentUser: ManagedUser | null;
  equipmentPermissions: EquipmentPermissionMap;
  notices: NoticeItem[];
  dashboardMetrics: DashboardMetrics;
  onNavigate: (page: PageKey) => void;
}) {
  const [accessNotice, setAccessNotice] = useState<AccessRequirementNotice | null>(null);
  const accountStatus = !sessionUser ? 'guest' : !currentUser ? 'profileRequired' : 'ready';
  const dashboardUser = currentUser ?? managedUsers.find((user) => user.name === sessionUserName) ?? managedUsers[0];
  const isPermissionPreviewMode = new URLSearchParams(window.location.search).get('permissionPreview') === 'multi';
  const grantedEquipmentIds = accountStatus !== 'ready'
    ? []
    : isPermissionPreviewMode
    ? getPreviewEquipmentPermissionIds()
    : dashboardUser ? equipmentPermissions[dashboardUser.id] ?? [] : [];
  const grantedEquipmentItems = equipmentItems.filter((item) => grantedEquipmentIds.includes(item.id));
  const todayKey = getSeoulDateKey();
  const sessionUserId = sessionUser?.id ?? currentUser?.id;
  const dashboardReservations = accountStatus === 'ready'
    ? calendarEvents
      .filter((event) => event.createdBy !== 'ADMIN')
      .filter((event) => event.status !== 'canceled' && event.status !== 'rejected')
      .filter((event) => event.mine || (Boolean(sessionUserId) && event.userId === sessionUserId))
      .filter((event) => getSeoulDateKey(new Date(event.start)) === todayKey)
      .sort((first, second) => first.start.localeCompare(second.start))
    : [];

  function showDashboardReservationRequirement() {
    if (!sessionUser) {
      setAccessNotice({
        title: '로그인이 필요합니다.',
        message: '장비 사용 예약과 예약 현황 확인은 Google 본인인증 후 이용할 수 있습니다.',
        detail: '로그인 후 회원정보를 등록하고 장비사용 교육을 이수하면 예약 권한이 활성화됩니다.',
        primaryLabel: '로그인하기',
        onPrimary: () => onNavigate('login')
      });
      return;
    }
    if (!currentUser) {
      setAccessNotice({
        title: '회원정보 등록이 필요합니다.',
        message: '예약 기능은 사용자관리와 연동된 회원정보 등록 후 이용할 수 있습니다.',
        detail: '이름, 소속학과, 지도교수명, 연락처, 이메일 등록을 완료해 주세요.',
        primaryLabel: '회원가입 진행',
        onPrimary: () => onNavigate('login')
      });
      return;
    }
    onNavigate('reservations');
  }

  return (
    <section className="mt-5 grid gap-5">
      <Hero
        onNavigate={onNavigate}
        onReservationAction={showDashboardReservationRequirement}
        equipmentItems={equipmentItems}
        userName={sessionUserName || 'USER NAME'}
        userLab={dashboardUser?.labProfessor ?? '백근우 교수님'}
        userRole={dashboardUser?.roleLevel ?? '일반'}
        grantedEquipmentItems={grantedEquipmentItems}
        isAdmin={sessionRole === 'ADMIN'}
        accountStatus={accountStatus}
        notices={notices}
        dashboardReservations={dashboardReservations}
        dashboardMetrics={dashboardMetrics}
      />
      <AutoRotatingEquipmentStatus
        equipmentItems={equipmentItems}
        calendarEvents={calendarEvents}
      />
      <MonthlyUsageChart equipmentItems={equipmentItems} calendarEvents={calendarEvents} />
      {accessNotice && (
        <AccessRequirementModal notice={accessNotice} onClose={() => setAccessNotice(null)} />
      )}
    </section>
  );
}

function EquipmentPage({
  equipmentItems,
  source,
  initialGroup
}: {
  equipmentItems: EquipmentItem[];
  source: 'api' | 'fallback';
  initialGroup: EquipmentGroup;
}) {
  const [activeGroup, setActiveGroup] = useState<EquipmentGroup>(initialGroup);

  useEffect(() => setActiveGroup(initialGroup), [initialGroup]);

  const grouped = useMemo(() => ({
    process: equipmentItems.filter((item) => item.group === 'process'),
    metrology: equipmentItems.filter((item) => item.group === 'metrology')
  }), [equipmentItems]);
  const activeItems = grouped[activeGroup];

  return (
    <section id="장비현황" className="grid gap-5">
      <EquipmentGateway
        equipmentItems={equipmentItems}
        onOpen={setActiveGroup}
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
            <AuthenticatedImage className="h-40 w-full object-cover" src={item.image} alt={item.name} />
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-cyan-300">{item.category}</p>
                  <h3 className="mt-1 text-xl font-bold text-white">{item.name}</h3>
                </div>
                <div className="grid justify-items-end gap-1">
                  <span className="rounded-md bg-blue-500/20 px-2 py-1 text-xs font-bold text-blue-200">{item.location}</span>
                  <span className={`equipment-admin-status is-${item.status ?? 'available'}`}>{isEquipmentAvailable(item) ? '이용가능' : '예약불가'}</span>
                </div>
              </div>
              <p className="mb-4 text-sm text-slate-300">{item.condition}</p>
              <div className="flex flex-wrap gap-2">
                {item.features.map((feature) => <span key={feature} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">{feature}</span>)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FacilityPage({ sessionRole }: { sessionRole: Role | null }) {
  const [planImage, setPlanImage] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const isAdmin = sessionRole === 'ADMIN';

  return (
    <section className="facility-page">
      <SectionTitle
        title="시설안내"
        eyebrow="Facility Layout"
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

      <div className="facility-lab-layout">
        <article className="facility-lab-card is-metrology">
          <div className="facility-lab-copy">
            <span>Lab 01</span>
            <h3>반도체 검사·계측·패키징 실습실</h3>
            <p>검사, 계측, 분석, 패키징 장비를 한 공간에서 확인할 수 있는 실습실 배치 초안입니다.</p>
          </div>
          <CleanroomPlanSection image={null} mode="metrology" />
        </article>

        <article className="facility-lab-card is-process">
          <div className="facility-lab-copy">
            <span>Lab 02</span>
            <h3>반도체 공정 실습실</h3>
            <p>노광, 증착, 식각, 열처리 장비를 중심으로 구성한 공정 실습실 배치 초안입니다.</p>
          </div>
          <CleanroomPlanSection image={planImage} mode="process" />
        </article>
      </div>

      {showUploadModal && <PlanUploadModal onClose={() => setShowUploadModal(false)} onUpload={(image) => { setPlanImage(image); setShowUploadModal(false); }} />}
    </section>
  );
}

function CleanroomPlanSection({ image, mode = 'combined' }: { image: string | null; mode?: 'combined' | 'process' | 'metrology' }) {
  return (
    <div className={`cleanroom-plan-card is-${mode}`}>
      <div className="cleanroom-plan-space">
        {image ? (
          <img className="cleanroom-plan-image" src={image} alt="업로드된 실습실 도면" />
        ) : (
          <div className={`cleanroom-3d-draft is-${mode}`} aria-label="클린룸 3D 도면 가안">
            <div className="cleanroom-room room-process">
              <strong>Process Zone</strong>
              <span>Lithography / Deposition / Etching</span>
            </div>
            <div className="cleanroom-room room-metrology">
              <strong>Inspection & Packaging Zone</strong>
              <span>mini SEM / LPKF / 반도체검사기</span>
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
  sessionUser,
  currentUser,
  permissions,
  permissionGrantMeta,
  onNavigate,
  onAddReservation,
  onDeleteReservation
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  sessionRole: Role | null;
  sessionUser: StoredSessionUser | null;
  currentUser: ManagedUser | null;
  permissions: EquipmentPermissionMap;
  permissionGrantMeta: EquipmentPermissionGrantMetaMap;
  onNavigate: (page: PageKey) => void;
  onAddReservation: (event: ReservationEvent) => Promise<boolean>;
  onDeleteReservation: (reservationId: string) => Promise<boolean>;
}) {
  const allEquipmentId = 'all-equipment';
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(allEquipmentId);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [accessNotice, setAccessNotice] = useState<AccessRequirementNotice | null>(null);
  const [reservationDate, setReservationDate] = useState(getSeoulDateKey());
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | EquipmentGroup>('all');
  const selectedEquipment = selectedEquipmentId === allEquipmentId ? undefined : equipmentItems.find((item) => item.id === selectedEquipmentId);
  const selectedEquipmentAvailable = selectedEquipmentId === allEquipmentId || isEquipmentAvailable(selectedEquipment);
  const firstAvailableEquipmentId = equipmentItems.find(isEquipmentAvailable)?.id ?? '';
  const currentUserPermissionIds = currentUser ? permissions[currentUser.id] ?? [] : [];
  const currentUserCanReserve = currentUser?.onboardingStatus === 'active';
  const isAssignedEquipmentManager = (equipmentId: string) => (
    sessionRole === 'MANAGER' &&
    Boolean(currentUser?.id) &&
    equipmentItems.some((item) => item.id === equipmentId && item.managerId === currentUser?.id)
  );
  const hasAdminGrantedEquipmentPermission = (equipmentId: string) => (
    Boolean(currentUser?.id) &&
    currentUserPermissionIds.includes(equipmentId) &&
    permissionGrantMeta[getPermissionGrantKey(currentUser!.id, equipmentId)]?.grantedByRole === 'ADMIN'
  );
  const reservableEquipmentItems = sessionRole === 'ADMIN'
    ? equipmentItems.filter(isEquipmentAvailable)
    : equipmentItems.filter((item) => (
        isEquipmentAvailable(item) &&
        (
          isAssignedEquipmentManager(item.id) ||
          hasAdminGrantedEquipmentPermission(item.id) ||
          (currentUserCanReserve && currentUserPermissionIds.includes(item.id))
        )
      ));
  const firstReservableEquipmentId = reservableEquipmentItems[0]?.id ?? firstAvailableEquipmentId;
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

  async function confirmReservation(form: ReservationForm) {
    const equipment = equipmentItems.find((item) => item.id === form.equipmentId);
    if (!equipment || !isEquipmentAvailable(equipment)) return;
    if (!canReserveEquipment(equipment.id)) {
      showReservationRequirement(equipment);
      return;
    }

    const reservationPurpose = form.purpose.trim();
    const purpose = reservationPurpose ? ` - ${reservationPurpose}` : '';
    const saved = await onAddReservation({
      id: `reservation-${Date.now()}`,
      title: `${equipment.name} 예약${purpose}`,
      start: toReservationDateTime(form.date, form.startTime),
      end: toReservationDateTime(getReservationEndDate(form), form.endTime),
      status: 'approved',
      equipmentId: equipment.id,
      userId: currentUser?.id ?? sessionUser?.id,
      createdBy: sessionRole === 'ADMIN' ? 'ADMIN' : 'USER',
      purpose: reservationPurpose || `${equipment.name} 예약`
    });
    if (saved) {
      setSelectedEquipmentId(equipment.id);
      setShowReservationModal(false);
    }
  }

  function canReserveEquipment(equipmentId: string) {
    if (sessionRole === 'ADMIN') return true;
    return Boolean(
      sessionUser &&
      currentUser &&
      (
        isAssignedEquipmentManager(equipmentId) ||
        hasAdminGrantedEquipmentPermission(equipmentId) ||
        (currentUserCanReserve && currentUserPermissionIds.includes(equipmentId))
      )
    );
  }

  function showReservationRequirement(equipment?: EquipmentItem) {
    if (!sessionUser) {
      setAccessNotice({
        title: '로그인이 필요합니다.',
        message: '장비 사용 예약은 Google 본인인증과 회원가입 후 이용할 수 있습니다.',
        detail: '로그인 후 회원정보를 등록하고 장비사용 교육을 이수해야 예약 권한이 활성화됩니다.',
        primaryLabel: '로그인하기',
        onPrimary: () => onNavigate('login')
      });
      return;
    }
    if (!currentUser) {
      setAccessNotice({
        title: '회원정보 등록이 필요합니다.',
        message: '장비 사용 예약은 사용자관리와 연동된 회원정보 등록 후 이용할 수 있습니다.',
        detail: 'Google 본인인증 후 이름, 소속학과, 지도교수명, 연락처, 이메일을 등록해 주세요.',
        primaryLabel: '회원가입 진행',
        onPrimary: () => onNavigate('login')
      });
      return;
    }
    setAccessNotice({
      title: '장비 사용 권한이 필요합니다.',
      message: `${equipment?.name ?? '선택한 장비'} 예약은 장비사용 교육 이수 후 담당자 또는 관리자가 권한을 부여해야 가능합니다.`,
      detail: '교육신청 페이지에서 해당 장비 교육을 요청하고, 이수 완료 후 예약을 진행해 주세요.',
      primaryLabel: '교육신청으로 이동',
      onPrimary: () => onNavigate('training')
    });
  }

  function openReservation(date = getSeoulDateKey()) {
    if (!selectedEquipmentAvailable) return;
    const targetEquipment = selectedEquipment ?? equipmentItems.find((item) => item.id === firstReservableEquipmentId);
    if (!targetEquipment || !canReserveEquipment(targetEquipment.id)) {
      showReservationRequirement(targetEquipment ?? selectedEquipment ?? equipmentItems.find((item) => item.id === firstAvailableEquipmentId));
      return;
    }
    setSelectedEquipmentId(targetEquipment.id);
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
          <option value="metrology">검사·계측·패키징 장비</option>
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
            const isUnavailable = !isEquipmentAvailable(item);
            return (
              <button
                key={item.id}
                className={`reservation-equipment-button ${isSelected ? 'is-selected' : ''} ${isLive ? 'is-live' : ''} ${isUnavailable ? 'is-unavailable' : ''}`}
                onClick={() => setSelectedEquipmentId(item.id)}
              >
                <span className="reservation-equipment-name">
                  {isLive && !isUnavailable && <span className="live-equipment-dot" aria-label="사용중" />}
                  {isUnavailable && <span className="maintenance-equipment-dot" aria-label="이용불가" />}
                  <span className="min-w-0 truncate">{item.name}</span>
                </span>
                <span className={`equipment-type-chip ${isUnavailable ? 'is-unavailable' : isProcess ? 'is-process' : 'is-metrology'}`}>
                  <GroupIcon size={14} />
                  {isUnavailable ? '예약불가' : isProcess ? '공정' : '검사·계측·패키징'}
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
              <button
                className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                onClick={() => openReservation()}
                disabled={!selectedEquipmentAvailable || !firstAvailableEquipmentId}
              >
                <Plus size={16} /> 장비예약
              </button>
            </div>
          }
        />
        {!selectedEquipmentAvailable && (
          <p className="reservation-warning mb-4">현재 선택한 장비는 이용불가 상태입니다. 장비관리에서 이용가능으로 전환 후 예약할 수 있습니다.</p>
        )}
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
          equipmentItems={sessionRole === 'ADMIN' ? equipmentItems : reservableEquipmentItems}
          calendarEvents={calendarEvents}
          selectedEquipmentId={selectedEquipmentAvailable ? selectedEquipment?.id ?? firstReservableEquipmentId : firstReservableEquipmentId}
          initialDate={reservationDate}
          onClose={() => setShowReservationModal(false)}
          onConfirm={confirmReservation}
          onDeleteReservation={sessionRole === 'ADMIN' ? onDeleteReservation : undefined}
          allowMaintenanceReservation={sessionRole === 'ADMIN'}
          titleSuffix={sessionRole === 'ADMIN' ? '(ADMIN)' : ''}
        />
      )}
      {accessNotice && (
        <AccessRequirementModal notice={accessNotice} onClose={() => setAccessNotice(null)} />
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
  const availableEquipmentItems = equipmentItems.filter(isEquipmentAvailable);
  const [form, setForm] = useState({
    equipmentId: isEquipmentAvailable(equipmentItems.find((item) => item.id === selectedEquipmentId)) ? selectedEquipmentId : availableEquipmentItems[0]?.id || '',
    date: initialDate,
    endDate: initialDate,
    startTime: '09:00',
    endTime: '10:00',
    purpose: ''
  });
  const endTimes = reservationTimes.filter((time) => form.endDate > form.date || time > form.startTime);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isEquipmentAvailable(equipmentItems.find((item) => item.id === form.equipmentId)) || !isReservationRangeValid(form)) return;
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="reservation-label">
            시작일
            <input type="date" value={form.date} onChange={(event) => {
              const nextDate = event.target.value;
              setForm((current) => ({ ...current, date: nextDate, endDate: current.endDate < nextDate ? nextDate : current.endDate }));
            }} />
          </label>
          <label className="reservation-label">
            종료일
            <input type="date" min={form.date} value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
          </label>
        </div>
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
          <button type="submit" className="rounded-md bg-cyan-300 px-5 py-3 font-extrabold text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.24)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!isEquipmentAvailable(equipmentItems.find((item) => item.id === form.equipmentId)) || !isReservationRangeValid(form)}>예약 확정</button>
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
  onConfirm: (form: ReservationForm) => void | Promise<void>;
  onDeleteReservation?: (reservationId: string) => void | Promise<boolean>;
  allowMaintenanceReservation?: boolean;
  titleSuffix?: string;
}) {
  const availableEquipmentItems = equipmentItems.filter(isEquipmentAvailable);
  const [form, setForm] = useState({
    equipmentId: isEquipmentAvailable(equipmentItems.find((item) => item.id === selectedEquipmentId)) ? selectedEquipmentId : availableEquipmentItems[0]?.id || '',
    date: initialDate,
    endDate: initialDate,
    startTime: '09:00',
    endTime: '10:00',
    purpose: '',
    reservationType: 'use' as 'use' | 'maintenance',
    userType: 'internal' as 'internal' | 'external'
  });
  const selectedModalEquipment = equipmentItems.find((item) => item.id === form.equipmentId);
  const selectedModalEquipmentAvailable = isEquipmentAvailable(selectedModalEquipment);
  const reservationStart = toReservationDateTime(form.date, form.startTime);
  const reservationEnd = toReservationDateTime(getReservationEndDate(form), form.endTime);
  const rangePanelStart = toReservationDateTime(form.date, '00:00');
  const rangePanelEnd = toReservationDateTime(getReservationEndDate(form), '23:59');
  const sameEquipmentReservations = calendarEvents.filter((event) => getEventEquipmentId(event, equipmentItems) === form.equipmentId);
  const rangeHasOverlap = sameEquipmentReservations.some((event) => reservationOverlaps(reservationStart, reservationEnd, event.start, event.end));
  const hasValidRange = isReservationRangeValid(form);
  const availableStartTimes = reservationTimes.filter((time, index) => {
    const nextTime = reservationTimes[index + 1];
    if (!nextTime) return getReservationEndDate(form) > form.date;
    const slotStart = toReservationDateTime(form.date, time);
    const slotEnd = toReservationDateTime(form.date, nextTime);
    return !sameEquipmentReservations.some((event) => reservationOverlaps(slotStart, slotEnd, event.start, event.end));
  });
  const endTimes = reservationTimes.filter((time) => {
    if (getReservationEndDate(form) === form.date && time <= form.startTime) return false;
    const requestedStart = toReservationDateTime(form.date, form.startTime);
    const requestedEnd = toReservationDateTime(getReservationEndDate(form), time);
    if (new Date(requestedStart).getTime() >= new Date(requestedEnd).getTime()) return false;
    return !sameEquipmentReservations.some((event) => reservationOverlaps(requestedStart, requestedEnd, event.start, event.end));
  });
  const reservationsForDate = calendarEvents
    .filter((event) => (
      getEventEquipmentId(event, equipmentItems) === form.equipmentId
      && reservationOverlaps(rangePanelStart, rangePanelEnd, event.start, event.end)
    ))
    .sort((first, second) => first.start.localeCompare(second.start));
  const canSubmit = selectedModalEquipmentAvailable && hasValidRange && !rangeHasOverlap && availableStartTimes.includes(form.startTime) && endTimes.includes(form.endTime);

  function updateStartTime(nextStart: string) {
    setForm((current) => {
      const nextEnd = reservationTimes.find((time) => {
        const requestedStart = toReservationDateTime(current.date, nextStart);
        const requestedEnd = toReservationDateTime(getReservationEndDate(current), time);
        return new Date(requestedStart).getTime() < new Date(requestedEnd).getTime()
          && !sameEquipmentReservations.some((event) => reservationOverlaps(requestedStart, requestedEnd, event.start, event.end));
      });
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
            <h4>{form.date === getReservationEndDate(form) ? `${form.date} 예약현황` : `${form.date} - ${getReservationEndDate(form)} 예약현황`}</h4>
            <div className="reservation-day-list">
              {reservationsForDate.length > 0 ? (
                reservationsForDate.map((event) => (
                  <div key={event.id} className={`reservation-day-item ${isReservationActive(event) ? 'is-live' : ''} ${isMaintenanceReservation(event) ? 'is-maintenance' : ''} ${isExternalReservation(event) ? 'is-external' : ''}`}>
                    <span>{formatReservationRange(event.start, event.end)}</span>
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
                  <option key={item.id} value={item.id} disabled={!isEquipmentAvailable(item)}>{item.name}{!isEquipmentAvailable(item) ? ' (예약불가)' : ''}</option>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="reservation-label">
                시작일
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    setForm((current) => ({
                      ...current,
                      date: nextDate,
                      endDate: current.endDate < nextDate ? nextDate : current.endDate
                    }));
                  }}
                />
              </label>
              <label className="reservation-label">
                종료일
                <input
                  type="date"
                  min={form.date}
                  value={form.endDate}
                  onChange={(event) => {
                    const nextEndDate = event.target.value;
                    setForm((current) => ({
                      ...current,
                      endDate: nextEndDate,
                      endTime: nextEndDate === current.date && current.endTime <= current.startTime
                        ? reservationTimes.find((time) => time > current.startTime) ?? current.endTime
                        : current.endTime
                    }));
                  }}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="reservation-label">
                시작 시간
                <select value={form.startTime} onChange={(event) => updateStartTime(event.target.value)}>
                  {reservationTimes.map((time, index) => (
                    <option key={time} value={time} disabled={!availableStartTimes.includes(time)}>{time}</option>
                  ))}
                </select>
              </label>
              <label className="reservation-label">
                종료 시간
                <select value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}>
                  {reservationTimes.filter((time) => getReservationEndDate(form) > form.date || time > form.startTime).map((time) => (
                    <option key={time} value={time} disabled={!endTimes.includes(time)}>{time}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="reservation-label">
              예약 목적
              <input value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} placeholder="예: 박막 증착 공정" />
            </label>
            {!selectedModalEquipmentAvailable && <p className="reservation-warning">이용불가 장비는 예약할 수 없습니다.</p>}
            {selectedModalEquipmentAvailable && !hasValidRange && <p className="reservation-warning">종료 일시는 시작 일시보다 뒤여야 합니다.</p>}
            {selectedModalEquipmentAvailable && hasValidRange && rangeHasOverlap && <p className="reservation-warning">선택한 기간에 이미 등록된 예약이 있습니다. 다른 기간을 선택해주세요.</p>}
            {selectedModalEquipmentAvailable && hasValidRange && !rangeHasOverlap && !canSubmit && <p className="reservation-warning">선택한 시간으로 예약할 수 없습니다. 다른 시간을 선택해주세요.</p>}
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
type TrainingApplicationStatus = 'pending' | 'scheduled' | 'completed';
type TrainingApplication = {
  id: string;
  equipmentName: string;
  status: TrainingApplicationStatus;
  requestedAt: string;
  managerName: string;
  scheduledAt?: string;
  note?: string;
};

const trainingStatusMeta: Record<TrainingApplicationStatus, { label: string; className: string }> = {
  pending: { label: '승인 대기', className: 'is-warning' },
  scheduled: { label: '일정 확정', className: 'is-info' },
  completed: { label: '이수 완료', className: 'is-success' }
};

type ManagerTrainingRequestStatus = 'requested' | 'scheduled' | 'completed' | 'rejected';
type ManagerTrainingDraft = {
  date: string;
  start: string;
  end: string;
  changeReason: string;
};
type ManagerTrainingPatch = Partial<{
  status: ManagerTrainingRequestStatus;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  scheduleChangeReason: string;
  handledBy: string;
  rejectedReason: string;
  completedAt: string;
}>;
type ManagerTrainingRequestView = {
  id: string;
  equipment: EquipmentItem;
  applicant: ManagedUser;
  requestedAt: string;
  preferredDate: string;
  preferredStart: string;
  preferredEnd: string;
  preferredNote: string;
  purpose: '연구' | '수업' | '기타';
  message: string;
  status: ManagerTrainingRequestStatus;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  scheduleChangeReason?: string;
  handledBy?: string;
  rejectedReason?: string;
  completedAt?: string;
};

const managerTrainingStatusMeta: Record<ManagerTrainingRequestStatus, { label: string; className: string }> = {
  requested: { label: '승인 대기', className: 'is-requested' },
  scheduled: { label: '일정 확정', className: 'is-scheduled' },
  completed: { label: '이수 완료', className: 'is-completed' },
  rejected: { label: '반려', className: 'is-rejected' }
};

const managerTrainingTabs: Array<{ status: ManagerTrainingRequestStatus; label: string }> = [
  { status: 'requested', label: '승인 대기' },
  { status: 'scheduled', label: '일정 확정' },
  { status: 'completed', label: '이수 완료' },
  { status: 'rejected', label: '반려' }
];

function apiPurposeToTrainingPurpose(purpose: ApiTrainingPurpose): ManagerTrainingRequestView['purpose'] {
  if (purpose === 'class') return '수업' as ManagerTrainingRequestView['purpose'];
  if (purpose === 'other') return '기타' as ManagerTrainingRequestView['purpose'];
  return '연구' as ManagerTrainingRequestView['purpose'];
}

function trainingPurposeToApi(purpose: ManagerTrainingRequestView['purpose']): ApiTrainingPurpose {
  const value = String(purpose);
  if (value.includes('수업')) return 'class';
  if (value.includes('기타')) return 'other';
  return 'research';
}

function trainingStatusToApplicationStatus(status: ApiTrainingRequestStatus): TrainingApplicationStatus {
  if (status === 'completed') return 'completed';
  if (status === 'scheduled') return 'scheduled';
  return 'pending';
}

function splitTrainingPreferredDate(value: string) {
  if (!value.includes('T')) {
    return { date: value, start: '', end: '' };
  }
  const [date, start = ''] = value.split('T');
  const [hour = '09', minute = '00'] = start.split(':');
  const endHour = String(Math.min(Number(hour) + 1, 23)).padStart(2, '0');
  return { date, start, end: `${endHour}:${minute}` };
}

function getDateInputOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatTrainingDateLabel(date: string, start?: string, end?: string) {
  const target = new Date(`${date}T${start || '09:00'}:00`);
  const dateLabel = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).format(target);
  return `${dateLabel} ${start ?? '--:--'}${end ? `-${end}` : ''}`;
}

function createManagerTrainingRequests(equipmentItems: EquipmentItem[], users: ManagedUser[]): ManagerTrainingRequestView[] {
  const purposeOptions: ManagerTrainingRequestView['purpose'][] = ['연구', '수업', '기타'];
  const notes = ['오전 중 희망', '공정 실습 전 장비 세팅 포함', '시료 측정 전 기본 운용 교육 요청', '소자 분석 실습 일정과 연동'];
  return equipmentItems.flatMap((equipment, equipmentIndex) => {
    const applicants = users.slice(0, Math.min(users.length, 5));
    return applicants.slice(0, 3).map((user, index) => {
      const requestedIndex = equipmentIndex * 3 + index;
      const preferredDate = getDateInputOffset(index + 1 + (equipmentIndex % 3));
      const preferredStart = index % 2 === 0 ? '09:00' : '14:00';
      const preferredEnd = index % 2 === 0 ? '10:00' : '15:00';
      const baseStatus: ManagerTrainingRequestStatus = requestedIndex % 7 === 0
        ? 'scheduled'
        : requestedIndex % 11 === 0
          ? 'completed'
          : 'requested';
      return {
        id: `manager-training-${equipment.id}-${user.id}`,
        equipment,
        applicant: user,
        requestedAt: new Date(Date.now() - (requestedIndex + 1) * 5_400_000).toISOString(),
        preferredDate,
        preferredStart,
        preferredEnd,
        preferredNote: notes[requestedIndex % notes.length],
        purpose: purposeOptions[requestedIndex % purposeOptions.length],
        message: `${equipment.name} 사용 전 안전수칙과 기본 운용 절차 교육을 요청합니다.`,
        status: baseStatus,
        scheduledDate: baseStatus === 'scheduled' || baseStatus === 'completed' ? preferredDate : undefined,
        scheduledStart: baseStatus === 'scheduled' || baseStatus === 'completed' ? preferredStart : undefined,
        scheduledEnd: baseStatus === 'scheduled' || baseStatus === 'completed' ? preferredEnd : undefined,
        handledBy: equipment.managerId,
        completedAt: baseStatus === 'completed' ? new Date().toISOString() : undefined
      };
    });
  });
}

function trainingRequestToApplication(request: ApiTrainingRequest, managerNameById: Map<string, string>): TrainingApplication {
  const status = trainingStatusToApplicationStatus(request.status);
  return {
    id: request.id,
    equipmentName: request.equipmentName,
    status,
    requestedAt: request.requestedAt.slice(0, 10),
    managerName: request.handledBy ? managerNameById.get(request.handledBy) ?? request.handledByName ?? '담당자 미지정' : request.handledByName ?? '담당자 미지정',
    scheduledAt: request.scheduledDate ? `${request.scheduledDate} ${request.scheduledStart ?? ''}`.trim() : undefined,
    note: status === 'completed'
      ? '예약 권한 부여됨'
      : request.status === 'rejected'
        ? request.rejectedReason ?? '반려됨'
        : status === 'scheduled'
          ? '교육 일정 확정'
          : '담당자 승인 대기'
  };
}

function trainingRequestToManagerView(
  request: ApiTrainingRequest,
  equipmentItems: EquipmentItem[],
  users: ManagedUser[]
): ManagerTrainingRequestView | null {
  const equipment = equipmentItems.find((item) => item.id === request.equipmentId);
  const applicant = users.find((user) => user.id === request.applicantUserId);
  if (!equipment || !applicant) return null;
  return {
    id: request.id,
    equipment,
    applicant,
    requestedAt: request.requestedAt,
    preferredDate: request.preferredDate,
    preferredStart: request.preferredStart,
    preferredEnd: request.preferredEnd,
    preferredNote: request.preferredNote,
    purpose: apiPurposeToTrainingPurpose(request.purpose),
    message: request.message,
    status: request.status,
    scheduledDate: request.scheduledDate,
    scheduledStart: request.scheduledStart,
    scheduledEnd: request.scheduledEnd,
    scheduleChangeReason: request.scheduleChangeReason,
    handledBy: request.handledBy,
    rejectedReason: request.rejectedReason,
    completedAt: request.completedAt
  };
}

function TrainingPage({
  equipmentItems,
  users,
  sessionUser,
  currentUser,
  permissions,
  trainingRequests,
  onNavigate,
  onCreateTrainingRequest
}: {
  equipmentItems: EquipmentItem[];
  users: ManagedUser[];
  sessionUser: StoredSessionUser | null;
  currentUser: ManagedUser | null;
  permissions: EquipmentPermissionMap;
  trainingRequests: ApiTrainingRequest[];
  onNavigate: (page: PageKey) => void;
  onCreateTrainingRequest: (input: TrainingRequestInput) => Promise<ApiTrainingRequest | null>;
}) {
  const currentUserPermissionIds = currentUser ? permissions[currentUser.id] ?? [] : [];
  const managerNameById = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);
  const requestableEquipment = useMemo(() => (
    equipmentItems.filter((item) => !currentUserPermissionIds.includes(item.id))
  ), [currentUserPermissionIds, equipmentItems]);
  const grantedEquipment = useMemo(() => (
    equipmentItems.filter((item) => currentUserPermissionIds.includes(item.id))
  ), [currentUserPermissionIds, equipmentItems]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [selectedEquipmentGroup, setSelectedEquipmentGroup] = useState<EquipmentGroup>('process');
  const [preferredDate, setPreferredDate] = useState('');
  const [purpose, setPurpose] = useState<'연구' | '수업' | '기타'>('연구');
  const [message, setMessage] = useState('');
  const [accessNotice, setAccessNotice] = useState<AccessRequirementNotice | null>(null);
  const [submittedTrainingRequest, setSubmittedTrainingRequest] = useState(false);
  const [applications, setApplications] = useState<TrainingApplication[]>(() => {
    const pendingEquipment = equipmentItems.find((item) => !currentUserPermissionIds.includes(item.id)) ?? equipmentItems[0];
    const scheduledEquipment = equipmentItems.find((item) => item.id !== pendingEquipment?.id && !currentUserPermissionIds.includes(item.id)) ?? equipmentItems[1];
    const completedEquipment = grantedEquipment[0] ?? equipmentItems.find((item) => item.id !== pendingEquipment?.id && item.id !== scheduledEquipment?.id) ?? equipmentItems[2];
    return [
      pendingEquipment && {
        id: 'training-preview-pending',
        equipmentName: pendingEquipment.name,
        status: 'pending' as const,
        requestedAt: '2026-06-25',
        managerName: pendingEquipment.managerId ? managerNameById.get(pendingEquipment.managerId) ?? '담당자 미지정' : '담당자 미지정',
        note: '담당자 승인 대기'
      },
      scheduledEquipment && {
        id: 'training-preview-scheduled',
        equipmentName: scheduledEquipment.name,
        status: 'scheduled' as const,
        requestedAt: '2026-06-24',
        managerName: scheduledEquipment.managerId ? managerNameById.get(scheduledEquipment.managerId) ?? '담당자 미지정' : '담당자 미지정',
        scheduledAt: '2026-07-02 14:00',
        note: '교육 일정 확정'
      },
      completedEquipment && {
        id: 'training-preview-completed',
        equipmentName: completedEquipment.name,
        status: 'completed' as const,
        requestedAt: '2026-06-18',
        managerName: completedEquipment.managerId ? managerNameById.get(completedEquipment.managerId) ?? '담당자 미지정' : '담당자 미지정',
        scheduledAt: '2026-06-21 10:00',
        note: '예약 권한 부여됨'
      }
    ].filter(Boolean) as TrainingApplication[];
  });
  const displayedApplications = trainingRequests.length > 0
    ? trainingRequests.map((request) => trainingRequestToApplication(request, managerNameById))
    : applications;

  const filteredEquipment = useMemo(() => (
    requestableEquipment.filter((item) => item.group === selectedEquipmentGroup)
  ), [requestableEquipment, selectedEquipmentGroup]);
  const selectedEquipment = requestableEquipment.find((item) => item.id === selectedEquipmentId) ?? null;
  const selectedManagerName = selectedEquipment?.managerId
    ? managerNameById.get(selectedEquipment.managerId) ?? '담당자 미지정'
    : '담당자 미지정';
  const canSubmitTrainingRequest = Boolean(selectedEquipment && preferredDate && message.trim());
  const activeStep = submittedTrainingRequest ? 3 : selectedEquipment ? 2 : 1;

  async function submitTrainingRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionUser) {
      setAccessNotice({
        title: '로그인이 필요합니다.',
        message: '교육신청은 Google 본인인증 후 이용할 수 있습니다.',
        detail: '먼저 Google 계정으로 본인인증을 진행한 뒤 센터 회원정보를 등록해 주세요.',
        primaryLabel: '로그인하기',
        onPrimary: () => onNavigate('login')
      });
      return;
    }
    if (!currentUser) {
      setAccessNotice({
        title: '회원정보 등록이 필요합니다.',
        message: '교육신청은 사용자관리와 연동된 회원정보 등록 후 이용할 수 있습니다.',
        detail: '이름, 소속학과, 지도교수명, 연락처, 이메일 등록을 완료해 주세요.',
        primaryLabel: '회원가입 진행',
        onPrimary: () => onNavigate('login')
      });
      return;
    }
    if (!selectedEquipment || !canSubmitTrainingRequest) return;
    const confirmed = window.confirm(`${selectedEquipment.name} 교육 신청을 담당자에게 전송하시겠습니까?`);
    if (!confirmed) return;
    const preferred = splitTrainingPreferredDate(preferredDate);
    const savedRequest = await onCreateTrainingRequest({
      equipmentId: selectedEquipment.id,
      preferredDate: preferred.date,
      preferredStart: preferred.start,
      preferredEnd: preferred.end,
      preferredNote: selectedManagerName,
      purpose: trainingPurposeToApi(purpose),
      message: message.trim()
    });
    if (!savedRequest) {
      window.alert('교육신청을 DB에 저장하지 못했습니다. 로그인 상태와 회원정보 등록 여부를 확인해 주세요.');
      return;
    }
    setPreferredDate('');
    setPurpose('연구');
    setMessage('');
    setSubmittedTrainingRequest(true);
    window.alert(`${selectedManagerName}에게 교육 신청 알림이 전송되었습니다.`);
  }

  const trainingSteps = ['장비 선택', '교육 신청', '담당자 승인·일정', '권한 부여'];

  return (
    <section className="training-request-page">
      <header className="training-request-header">
        <p>EQUIPMENT TRAINING REQUEST</p>
        <h2>장비 사용 교육신청</h2>
        <span>권한이 없는 장비는 담당자에게 교육을 요청해 이수하면 예약 권한이 자동 부여됩니다.</span>
      </header>

      <ol className="training-request-stepper" aria-label="교육신청 진행 단계">
        {trainingSteps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber <= activeStep;
          return (
            <li key={step} className={isActive ? 'is-active' : ''} aria-current={stepNumber === activeStep ? 'step' : undefined}>
              <span>{stepNumber}</span>
              <strong>{step}</strong>
            </li>
          );
        })}
      </ol>

      <div className="training-request-layout">
        <form className="training-request-form" onSubmit={submitTrainingRequest}>
          <section className="training-request-card">
            <div className="training-request-section-title">
              <span>01</span>
              <h3>교육받을 장비 선택</h3>
            </div>
            <div className="training-equipment-picker">
              <label htmlFor="training-equipment-group">장비 분류</label>
              <select
                id="training-equipment-group"
                value={selectedEquipmentGroup}
                onChange={(event) => {
                  setSelectedEquipmentGroup(event.target.value as EquipmentGroup);
                  setSelectedEquipmentId('');
                  setSubmittedTrainingRequest(false);
                }}
              >
                <option value="process">공정</option>
                <option value="metrology">검사·계측·패키징</option>
              </select>
              <label htmlFor="training-equipment-select">장비 목록</label>
              <select
                id="training-equipment-select"
                value={selectedEquipmentId}
                onChange={(event) => {
                  setSelectedEquipmentId(event.target.value);
                  setSubmittedTrainingRequest(false);
                }}
              >
                <option value="">장비를 선택하세요</option>
                {filteredEquipment.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.location}</option>
                ))}
              </select>
            </div>
            {selectedEquipment ? (
              <article className="training-selected-equipment">
                <div className="training-equipment-icon" aria-hidden="true">
                  {selectedEquipment.group === 'process' ? <Cpu size={18} /> : <Microscope size={18} />}
                </div>
                <div>
                  <strong>{selectedEquipment.name}</strong>
                  <span>{selectedEquipment.groupName} · 담당 {selectedManagerName} 교수님</span>
                </div>
                <em className="training-status-badge is-warning">권한 없음</em>
                <ChevronDown size={16} aria-hidden="true" />
              </article>
            ) : (
              <p className="training-request-help">장비 분류를 선택한 뒤 목록에서 교육받을 장비를 선택하세요.</p>
            )}
          </section>

          <section className={`training-request-card ${!selectedEquipment ? 'is-disabled' : ''}`}>
            <div className="training-request-section-title">
              <span>02</span>
              <h3>교육 요청 내용</h3>
            </div>
            <div className="training-request-field-grid">
              <label htmlFor="training-preferred-date">
                희망 일정
                <input
                  id="training-preferred-date"
                  type="datetime-local"
                  value={preferredDate}
                  onChange={(event) => setPreferredDate(event.target.value)}
                  disabled={!selectedEquipment}
                />
              </label>
              <label htmlFor="training-purpose">
                사용 목적
                <select
                  id="training-purpose"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value as '연구' | '수업' | '기타')}
                  disabled={!selectedEquipment}
                >
                  <option value="연구">연구</option>
                  <option value="수업">수업</option>
                  <option value="기타">기타</option>
                </select>
              </label>
            </div>
            <label className="training-message-field" htmlFor="training-message">
              요청 메시지
              <textarea
                id="training-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="실험 개요, 요청 사항 등을 적어 담당자에게 전달하세요."
                disabled={!selectedEquipment}
              />
            </label>
            <div className="training-request-actions">
              <p>
                {selectedEquipment
                  ? `신청 시 담당 ${selectedManagerName} 교수님에게 알림이 전송됩니다.`
                  : '장비를 먼저 선택하면 교육 요청 내용을 입력할 수 있습니다.'}
              </p>
              <button type="submit" disabled={!canSubmitTrainingRequest}>
                <Send size={15} aria-hidden="true" />
                교육 신청하기
              </button>
            </div>
          </section>
        </form>

        <aside className="training-request-side">
          <section className="training-request-card">
            <div className="training-request-panel-head">
              <h3>내 교육 신청 현황</h3>
              <button type="button">전체 →</button>
            </div>
            <div className="training-application-summary">
              {displayedApplications.length > 0 ? displayedApplications.map((application) => {
                const meta = trainingStatusMeta[application.status];
                return (
                  <article key={application.id} className="training-status-row">
                    <div>
                      <strong>{application.equipmentName}</strong>
                      <span>
                        {application.status === 'completed'
                          ? <a href="#reservations">예약 권한 부여됨 →</a>
                          : application.scheduledAt
                            ? `${application.scheduledAt} · ${application.managerName}`
                            : `${application.requestedAt} 신청 · ${application.managerName}`}
                      </span>
                    </div>
                    <em className={`training-status-badge ${meta.className}`}>
                      {application.status === 'completed' && <CheckCircle2 size={12} aria-hidden="true" />}
                      {meta.label}
                    </em>
                  </article>
                );
              }) : (
                <p className="training-empty-state">아직 교육 신청 내역이 없습니다.</p>
              )}
            </div>
          </section>

          <section className="training-request-card">
            <div className="training-request-panel-head">
              <h3>내 보유 권한</h3>
            </div>
            <div className="training-permission-list">
              {grantedEquipment.length > 0 ? grantedEquipment.map((item) => (
                <span key={item.id} className="training-permission-chip">{item.name}</span>
              )) : (
                <p className="training-empty-state">아직 보유한 장비 권한이 없습니다.</p>
              )}
            </div>
            <p className="training-permission-note">이수 완료 장비는 즉시 예약할 수 있습니다.</p>
          </section>
        </aside>
      </div>
      {accessNotice && (
        <AccessRequirementModal notice={accessNotice} onClose={() => setAccessNotice(null)} />
      )}
    </section>
  );
}

function TrainingManagementPage({
  users,
  equipmentItems,
  permissions,
  trainingRequests,
  currentUser,
  sessionRole,
  onScheduleTrainingRequest,
  onRejectTrainingRequest,
  onCompleteTrainingRequest
}: {
  users: ManagedUser[];
  equipmentItems: EquipmentItem[];
  permissions: EquipmentPermissionMap;
  trainingRequests: ApiTrainingRequest[];
  currentUser: ManagedUser | null;
  sessionRole: Role | null;
  onScheduleTrainingRequest: (requestId: string, input: { scheduledDate: string; scheduledStart: string; scheduledEnd: string; scheduleChangeReason: string }) => Promise<ApiTrainingRequest | null>;
  onRejectTrainingRequest: (requestId: string, rejectedReason: string) => Promise<ApiTrainingRequest | null>;
  onCompleteTrainingRequest: (requestId: string) => Promise<ApiTrainingRequest | null>;
}) {
  const manageableEquipment = useMemo(() => (
    sessionRole === 'ADMIN'
      ? equipmentItems
      : currentUser
        ? equipmentItems.filter((item) => item.managerId === currentUser.id)
        : []
  ), [currentUser, equipmentItems, sessionRole]);
  const [selectedStatus, setSelectedStatus] = useState<ManagerTrainingRequestStatus>('requested');
  const [expandedRequestId, setExpandedRequestId] = useState('');
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, ManagerTrainingDraft>>({});
  const requests = useMemo(() => (
    trainingRequests
      .map((request) => trainingRequestToManagerView(request, manageableEquipment, users))
      .filter(Boolean) as ManagerTrainingRequestView[]
  ), [manageableEquipment, trainingRequests, users]);
  const filteredRequests = requests.filter((request) => request.status === selectedStatus);
  const requestedCount = requests.filter((item) => item.status === 'requested').length;
  const scheduledCount = requests.filter((item) => item.status === 'scheduled').length;
  const completedCount = requests.filter((item) => item.status === 'completed').length;
  const weekScheduledCount = requests.filter((item) => item.status === 'scheduled' && item.scheduledDate && item.scheduledDate <= getDateInputOffset(7)).length;
  const upcomingRequests = requests
    .filter((item) => item.status === 'scheduled')
    .sort((a, b) => `${a.scheduledDate}T${a.scheduledStart}`.localeCompare(`${b.scheduledDate}T${b.scheduledStart}`))
    .slice(0, 5);
  const completionPending = requests
    .filter((item) => item.status === 'scheduled')
    .slice(0, 4);
  const managerName = sessionRole === 'ADMIN'
    ? '관리자'
    : currentUser?.name ?? '담당자';

  useEffect(() => {
    if (filteredRequests.length > 0 && !filteredRequests.some((item) => item.id === expandedRequestId)) {
      setExpandedRequestId(filteredRequests[0].id);
    }
    if (filteredRequests.length === 0 && expandedRequestId) {
      setExpandedRequestId('');
    }
  }, [expandedRequestId, filteredRequests]);

  function getScheduleDraft(request: ManagerTrainingRequestView): ManagerTrainingDraft {
    return scheduleDrafts[request.id] ?? {
      date: request.scheduledDate ?? request.preferredDate,
      start: request.scheduledStart ?? request.preferredStart,
      end: request.scheduledEnd ?? request.preferredEnd,
      changeReason: request.scheduleChangeReason ?? ''
    };
  }

  function updateScheduleDraft(requestId: string, patch: Partial<ManagerTrainingDraft>) {
    const request = requests.find((item) => item.id === requestId);
    if (!request) return;
    const current = getScheduleDraft(request);
    setScheduleDrafts((drafts) => ({ ...drafts, [requestId]: { ...current, ...patch } }));
  }

  async function scheduleRequest(request: ManagerTrainingRequestView) {
    const draft = getScheduleDraft(request);
    if (!draft.date || !draft.start || !draft.end || draft.end <= draft.start) {
      window.alert('교육 종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    const savedRequest = await onScheduleTrainingRequest(request.id, {
      scheduledDate: draft.date,
      scheduledStart: draft.start,
      scheduledEnd: draft.end,
      scheduleChangeReason: isScheduleChanged(request, draft) ? draft.changeReason : ''
    });
    if (!savedRequest) {
      window.alert('교육 일정을 DB에 저장하지 못했습니다. 담당 권한을 확인해 주세요.');
      return;
    }
    setSelectedStatus('scheduled');
    window.alert(`${request.applicant.name} 신청자의 교육 일정이 확정되었습니다.`);
  }

  async function rejectRequest(request: ManagerTrainingRequestView) {
    const reason = window.prompt('반려 사유를 입력해주세요.');
    if (reason === null) return;
    const savedRequest = await onRejectTrainingRequest(request.id, reason.trim() || '담당자 일정 조율 필요');
    if (!savedRequest) {
      window.alert('교육신청 반려 상태를 DB에 저장하지 못했습니다. 담당 권한을 확인해 주세요.');
      return;
    }
    setSelectedStatus('rejected');
  }

  async function completeRequest(request: ManagerTrainingRequestView) {
    if (request.status !== 'scheduled') return;
    const savedRequest = await onCompleteTrainingRequest(request.id);
    if (!savedRequest) {
      window.alert('교육 이수 처리를 DB에 저장하지 못했습니다. 담당 권한을 확인해 주세요.');
      return;
    }
    setSelectedStatus('completed');
    window.alert(`${request.applicant.name} 신청자에게 ${request.equipment.name} 예약 권한이 부여되었습니다.`);
  }

  function isScheduleChanged(request: ManagerTrainingRequestView, draft: ManagerTrainingDraft) {
    return draft.date !== request.preferredDate || draft.start !== request.preferredStart || draft.end !== request.preferredEnd;
  }

  if (manageableEquipment.length === 0) {
    return (
      <section className="training-management-page">
        <div className="manager-permission-empty">
          <LockKeyhole size={32} />
          <p>Training Management</p>
          <h2>교육신청을 관리할 담당 장비가 없습니다.</h2>
          <span>장비관리에서 담당자로 지정되면 이 메뉴에서 담당 장비 교육 신청을 확인할 수 있습니다.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="training-management-page">
      <div className="training-manager-hero">
        <div>
          <p>TRAINING REQUEST · MANAGER</p>
          <h2>교육 요청 관리</h2>
          <span>담당 장비의 교육 요청을 확인하고 실제 교육 시간을 확정한 뒤 이수 권한을 부여합니다.</span>
        </div>
        <div className="training-manager-identity">
          <strong>담당 {managerName}</strong>
          <span>담당 장비 {manageableEquipment.length}종</span>
        </div>
      </div>

      <div className="training-management-summary" aria-label="교육 요청 요약">
        <div>
          <strong>{requestedCount}</strong>
          <span>승인 대기</span>
        </div>
        <div>
          <strong>{scheduledCount}</strong>
          <span>일정 확정</span>
        </div>
        <div>
          <strong>{weekScheduledCount}</strong>
          <span>금주 교육 예정</span>
        </div>
        <div>
          <strong>{completedCount}</strong>
          <span>누적 이수자</span>
        </div>
      </div>

      <div className="training-management-layout">
        <div className="training-request-manager-board">
          <div className="training-manager-tabs" role="tablist" aria-label="교육 요청 상태">
            {managerTrainingTabs.map((tab) => {
              const count = requests.filter((request) => request.status === tab.status).length;
              return (
                <button
                  key={tab.status}
                  type="button"
                  className={selectedStatus === tab.status ? 'is-active' : ''}
                  onClick={() => setSelectedStatus(tab.status)}
                >
                  {tab.label}
                  <span>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="training-manager-request-list">
            {filteredRequests.length > 0 ? filteredRequests.map((request) => {
              const statusMeta = managerTrainingStatusMeta[request.status];
              const draft = getScheduleDraft(request);
              const scheduleChanged = isScheduleChanged(request, draft);
              const isExpanded = expandedRequestId === request.id;
              const hasPermission = permissions[request.applicant.id]?.includes(request.equipment.id);
              return (
                <article key={request.id} className={`training-manager-card ${isExpanded ? 'is-expanded' : ''}`}>
                  <div className="training-manager-card-head">
                    <div className="training-manager-equipment-mark" aria-hidden="true">
                      <GraduationCap size={20} />
                    </div>
                    <div>
                      <strong>{request.equipment.name}</strong>
                      <span>{request.applicant.name} · {request.applicant.department} · 신청 {formatSeoulDateTime(request.requestedAt)}</span>
                    </div>
                    <em className={`training-manager-status ${statusMeta.className}`}>{statusMeta.label}</em>
                  </div>

                  <div className="training-manager-contact-row" aria-label={`${request.applicant.name} 연락처`}>
                    {request.applicant.phone && (
                      <a href={`tel:${request.applicant.phone.replace(/\D/g, '')}`} aria-label={`${request.applicant.name}에게 전화`}>
                        <Phone size={15} /> {request.applicant.phone}
                      </a>
                    )}
                    {request.applicant.email && (
                      <a href={`mailto:${request.applicant.email}`} aria-label={`${request.applicant.name}에게 이메일`}>
                        <Mail size={15} /> {request.applicant.email}
                      </a>
                    )}
                  </div>

                  <div className="training-manager-card-body">
                    <div>
                      <span>사용 목적</span>
                      <strong>{request.purpose}</strong>
                    </div>
                    <div>
                      <span>희망 시간</span>
                      <strong>{formatTrainingDateLabel(request.preferredDate, request.preferredStart, request.preferredEnd)} · {request.preferredNote}</strong>
                    </div>
                    <p>{request.message}</p>
                  </div>

                  {request.status === 'requested' && !isExpanded && (
                    <div className="training-manager-compact-actions">
                      <span>연락 후 실제 교육 시간을 확정해주세요.</span>
                      <button type="button" onClick={() => setExpandedRequestId(request.id)}>
                        일정 잡고 승인
                      </button>
                    </div>
                  )}

                  {request.status === 'requested' && isExpanded && (
                    <div className="training-schedule-editor">
                      <div className="training-schedule-grid">
                        <label htmlFor={`${request.id}-date`}>
                          날짜
                          <input id={`${request.id}-date`} type="date" value={draft.date} onChange={(event) => updateScheduleDraft(request.id, { date: event.target.value })} />
                        </label>
                        <label htmlFor={`${request.id}-start`}>
                          시작
                          <input id={`${request.id}-start`} type="time" value={draft.start} onChange={(event) => updateScheduleDraft(request.id, { start: event.target.value })} />
                        </label>
                        <label htmlFor={`${request.id}-end`}>
                          종료
                          <input id={`${request.id}-end`} type="time" value={draft.end} onChange={(event) => updateScheduleDraft(request.id, { end: event.target.value })} />
                        </label>
                      </div>
                      {scheduleChanged && (
                        <div className="training-schedule-warning">
                          <AlertTriangle size={16} />
                          <span>희망 시간과 달라 {draft.start}으로 조정됩니다.</span>
                        </div>
                      )}
                      {scheduleChanged && (
                        <label className="training-change-reason" htmlFor={`${request.id}-reason`}>
                          변경 사유
                          <input
                            id={`${request.id}-reason`}
                            value={draft.changeReason}
                            onChange={(event) => updateScheduleDraft(request.id, { changeReason: event.target.value })}
                            placeholder="예: 장비 점검 후 교육 가능 시간으로 조정"
                          />
                        </label>
                      )}
                      <div className="training-manager-actions">
                        <button type="button" className="is-muted" onClick={() => rejectRequest(request)}>반려</button>
                        <a href={`mailto:${request.applicant.email}?subject=${encodeURIComponent(`${request.equipment.name} 교육 요청 문의`)}`}>
                          <MessageSquare size={15} /> 메시지
                        </a>
                        <button type="button" className="is-primary" onClick={() => scheduleRequest(request)}>
                          <CheckCircle2 size={15} /> 이 시간으로 승인
                        </button>
                      </div>
                    </div>
                  )}

                  {request.status !== 'requested' && (
                    <div className="training-manager-confirmed">
                      <Clock3 size={16} />
                      <div>
                        <span>확정 교육 시간</span>
                        <strong>{request.scheduledDate ? formatTrainingDateLabel(request.scheduledDate, request.scheduledStart, request.scheduledEnd) : '미확정'}</strong>
                        {request.scheduleChangeReason && <em>변경 사유: {request.scheduleChangeReason}</em>}
                        {request.rejectedReason && <em>반려 사유: {request.rejectedReason}</em>}
                        {request.status === 'completed' && <em>{hasPermission ? '예약 권한 부여 완료' : '이수 완료 처리됨'}</em>}
                      </div>
                    </div>
                  )}
                </article>
              );
            }) : (
              <p className="training-manager-empty">해당 상태의 교육 요청이 없습니다.</p>
            )}
          </div>
        </div>

        <aside className="training-manager-side">
          <section>
            <div className="manager-panel-head">
              <p>Upcoming</p>
              <h3>다가오는 교육 일정</h3>
            </div>
            <div className="training-side-list">
              {upcomingRequests.length > 0 ? upcomingRequests.map((request) => (
                <div key={request.id}>
                  <strong>{request.equipment.name}</strong>
                  <span>{formatTrainingDateLabel(request.scheduledDate ?? request.preferredDate, request.scheduledStart, request.scheduledEnd)} · {request.applicant.name}</span>
                  <em className="training-manager-status is-scheduled">일정 확정</em>
                </div>
              )) : (
                <p className="training-manager-empty">확정된 교육 일정이 없습니다.</p>
              )}
            </div>
          </section>

          <section>
            <div className="manager-panel-head">
              <p>Completion</p>
              <h3>이수 처리 대기</h3>
            </div>
            <div className="training-side-list">
              {completionPending.length > 0 ? completionPending.map((request) => (
                <div key={request.id} className="training-complete-row">
                  <div>
                    <strong>{request.applicant.name}</strong>
                    <span>{request.equipment.name} · {formatTrainingDateLabel(request.scheduledDate ?? request.preferredDate, request.scheduledStart, request.scheduledEnd)}</span>
                  </div>
                  <button type="button" onClick={() => completeRequest(request)}>이수 처리</button>
                </div>
              )) : (
                <p className="training-manager-empty">이수 처리할 교육이 없습니다.</p>
              )}
            </div>
          </section>

          <section>
            <div className="manager-panel-head">
              <p>Managed Equipment</p>
              <h3>내 담당 장비</h3>
            </div>
            <div className="training-managed-chip-list">
              {manageableEquipment.map((item) => (
                <span key={item.id}>{item.name}</span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function AdminEducationPermissionPanel({
  users,
  equipmentItems,
  permissions,
  permissionGrantMeta,
  onRevokePermission
}: {
  users: ManagedUser[];
  equipmentItems: EquipmentItem[];
  permissions: EquipmentPermissionMap;
  permissionGrantMeta: EquipmentPermissionGrantMetaMap;
  onRevokePermission: (userId: string, equipmentId: string, reason: string) => Promise<boolean>;
}) {
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(equipmentItems[0]?.id ?? '');
  const [pendingRevoke, setPendingRevoke] = useState<{ user: ManagedUser; equipment: EquipmentItem } | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const managerNameById = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);
  const selectedEquipment = equipmentItems.find((item) => item.id === selectedEquipmentId) ?? equipmentItems[0];

  useEffect(() => {
    if (!selectedEquipmentId && equipmentItems[0]) {
      setSelectedEquipmentId(equipmentItems[0].id);
    }
    if (selectedEquipmentId && !equipmentItems.some((item) => item.id === selectedEquipmentId)) {
      setSelectedEquipmentId(equipmentItems[0]?.id ?? '');
    }
  }, [equipmentItems, selectedEquipmentId]);

  const permissionRows = selectedEquipment
    ? users
        .filter((user) => permissions[user.id]?.includes(selectedEquipment.id))
        .map((user) => {
          const meta = permissionGrantMeta[getPermissionGrantKey(user.id, selectedEquipment.id)];
          const fallbackRole: 'MANAGER' | 'ADMIN' = selectedEquipment.managerId && selectedEquipment.managerId !== user.id ? 'MANAGER' : 'ADMIN';
          return {
            permissionId: getPermissionGrantKey(user.id, selectedEquipment.id),
            user,
            grantedAt: meta?.grantedAt,
            grantedByRole: meta?.grantedByRole ?? fallbackRole
          };
        })
    : [];
  const filteredPermissionRows = permissionRows.filter((row) => {
    const keyword = userSearch.trim().toLowerCase();
    if (!keyword) return true;
    return `${row.user.name} ${row.user.email} ${row.user.department}`.toLowerCase().includes(keyword);
  });
  const filteredEquipment = equipmentItems.filter((item) => {
    const keyword = equipmentSearch.trim().toLowerCase();
    if (!keyword) return true;
    return `${item.name} ${item.groupName} ${item.category}`.toLowerCase().includes(keyword);
  });
  const equipmentGroups: Array<{ key: EquipmentGroup; title: string }> = [
    { key: 'process', title: '공정' },
    { key: 'metrology', title: '검사·계측·패키징' }
  ];

  function getActivePermissionCount(equipmentId: string) {
    return users.filter((user) => permissions[user.id]?.includes(equipmentId)).length;
  }

  function requestRevoke(user: ManagedUser, equipment: EquipmentItem) {
    setPendingRevoke({ user, equipment });
    setRevokeReason('');
  }

  function cancelRevoke() {
    setPendingRevoke(null);
    setRevokeReason('');
  }

  async function confirmRevoke() {
    if (!pendingRevoke || !revokeReason.trim()) return;
    const saved = await onRevokePermission(pendingRevoke.user.id, pendingRevoke.equipment.id, revokeReason);
    if (saved) cancelRevoke();
  }

  if (!selectedEquipment) {
    return (
      <section className="admin-education-permission">
        <p className="admin-education-empty">등록된 장비가 없습니다.</p>
      </section>
    );
  }

  return (
    <section id="admin-education-permission" className="admin-education-permission" aria-labelledby="admin-education-title">
      <header className="admin-education-hero">
        <p>ADMIN · EDUCATION</p>
        <h2 id="admin-education-title">교육관리 · 장비 권한</h2>
        <span>장비별 권한 보유자를 조회하고 필요 시 권한을 회수합니다. 회수 내역은 이력에 기록됩니다.</span>
      </header>

      <div className="admin-education-layout">
        <aside className="admin-education-master" aria-label="장비별 권한 보유 인원">
          <label className="admin-education-search">
            장비 검색
            <input value={equipmentSearch} onChange={(event) => setEquipmentSearch(event.target.value)} placeholder="장비명 또는 분류 검색" />
          </label>
          <div className="admin-equipment-master-list">
            {equipmentGroups.map((group) => {
              const groupItems = filteredEquipment.filter((item) => item.group === group.key);
              if (groupItems.length === 0) return null;
              return (
                <div key={group.key} className="admin-equipment-master-group">
                  <h3>{group.title}</h3>
                  {groupItems.map((item) => {
                    const activeCount = getActivePermissionCount(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`admin-equipment-master-row ${selectedEquipment.id === item.id ? 'is-selected' : ''}`}
                        onClick={() => setSelectedEquipmentId(item.id)}
                      >
                        <span className={`admin-equipment-dot is-${item.group}`} aria-hidden="true" />
                        <strong>{item.name}</strong>
                        <em>{activeCount}</em>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="admin-education-detail">
          <div className="admin-education-detail-head">
            <div className="admin-education-equipment-title">
              <div className="admin-education-equipment-icon" aria-hidden="true">
                <GraduationCap size={20} />
              </div>
              <div>
                <h3>{selectedEquipment.name}</h3>
                <span>{selectedEquipment.groupName} · 담당 {selectedEquipment.managerId ? managerNameById.get(selectedEquipment.managerId) ?? '미지정' : '미지정'} · 권한 보유 {permissionRows.length}명</span>
              </div>
            </div>
            <label className="admin-education-search is-user">
              사용자 검색
              <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="이름, 이메일, 소속 검색" />
            </label>
          </div>

          <div className="admin-education-table-wrap">
            <table className="admin-education-table">
              <thead>
                <tr>
                  <th scope="col">사용자</th>
                  <th scope="col">소속</th>
                  <th scope="col">부여일</th>
                  <th scope="col">부여 경로</th>
                  <th scope="col">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissionRows.length > 0 ? filteredPermissionRows.map((row) => (
                  <tr key={row.permissionId}>
                    <td>
                      <div className="admin-education-user-cell">
                        <span>{row.user.name.slice(0, 1)}</span>
                        <div>
                          <strong>{row.user.name}</strong>
                          <em>{row.user.email}</em>
                        </div>
                      </div>
                    </td>
                    <td>{row.user.department}</td>
                    <td>{row.grantedAt ? formatSeoulDateTime(row.grantedAt) : '기존 부여 권한'}</td>
                    <td>
                      <span className={`admin-education-source is-${row.grantedByRole.toLowerCase()}`}>
                        {row.grantedByRole === 'MANAGER' ? '교육 이수' : '관리자 부여'}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="admin-education-revoke-button" onClick={() => requestRevoke(row.user, selectedEquipment)} aria-label={`${row.user.name} 권한 회수`}>
                        <Ban size={15} /> 회수
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5}>
                      <p className="admin-education-empty">권한 보유자가 없습니다.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="admin-education-footer">
            <span>총 {filteredPermissionRows.length}명 표시 · ACTIVE 권한 기준</span>
            <strong>회수 시 사용자는 즉시 예약이 차단되며, 재사용하려면 재교육이 필요합니다.</strong>
          </footer>

          {pendingRevoke && (
            <section className="admin-education-revoke-panel" role="dialog" aria-labelledby="admin-education-revoke-title">
              <div>
                <p>Permission Revoke</p>
                <h3 id="admin-education-revoke-title">{pendingRevoke.user.name}님의 {pendingRevoke.equipment.name} 권한을 회수합니다.</h3>
                <span>회수 즉시 예약 권한이 차단되며, 재사용하려면 재교육 또는 관리자 재부여가 필요합니다.</span>
              </div>
              <label htmlFor="admin-education-revoke-reason">
                회수 사유 <em>필수</em>
                <textarea
                  id="admin-education-revoke-reason"
                  value={revokeReason}
                  onChange={(event) => setRevokeReason(event.target.value)}
                  placeholder="예: 장비 안전수칙 미준수로 교육 권한 회수"
                />
              </label>
              <div className="admin-education-revoke-actions">
                <button type="button" className="is-cancel" onClick={cancelRevoke}>취소</button>
                <button type="button" className="is-danger" onClick={confirmRevoke} disabled={!revokeReason.trim()}>
                  <Ban size={15} /> 권한 회수
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

function AdminPage({
  equipmentItems,
  calendarEvents,
  onAddReservation,
  onDeleteReservation,
  onNavigate,
  consumablesUpdatedAt,
  usersUpdatedAt
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  onAddReservation: (event: ReservationEvent) => Promise<boolean>;
  onDeleteReservation: (reservationId: string) => Promise<boolean>;
  onNavigate: (page: PageKey) => void;
  consumablesUpdatedAt: string;
  usersUpdatedAt: string;
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

  async function confirmAdminReservation(form: ReservationForm) {
    const equipment = equipmentItems.find((item) => item.id === form.equipmentId);
    if (!equipment) return;
    const reservationPurpose = form.purpose.trim();
    const purpose = reservationPurpose ? ` - ${reservationPurpose}` : '';
    const isMaintenance = form.reservationType === 'maintenance';
    const isExternal = !isMaintenance && form.userType === 'external';
    const reservationStatus: ReservationStatus = isMaintenance ? 'maintenance' : isExternal ? 'external' : 'approved';
    const saved = await onAddReservation({
      id: `admin-reservation-${Date.now()}`,
      title: `${equipment.name} ${isMaintenance ? '장비 점검' : isExternal ? '외부 기업 예약' : '관리자 예약'}${purpose}`,
      start: toReservationDateTime(form.date, form.startTime),
      end: toReservationDateTime(getReservationEndDate(form), form.endTime),
      status: reservationStatus,
      equipmentId: equipment.id,
      createdBy: 'ADMIN',
      purpose: reservationPurpose || (isMaintenance ? '장비 점검' : isExternal ? '외부 기업 예약' : '관리자 예약')
    });
    if (saved) {
      setSelectedAdminDate(form.date);
      setShowReservationModal(false);
    }
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
                  <div key={event.id} className={`admin-reservation-row ${isReservationActive(event) ? 'is-live' : ''} ${isMaintenanceReservation(event) ? 'is-maintenance' : ''} ${isExternalReservation(event) ? 'is-external' : ''} ${event.status === 'rejected' ? 'is-rejected' : ''} ${event.status === 'canceled' ? 'is-canceled' : ''}`}>
                    <div>
                      <strong>{equipment?.name ?? event.title}</strong>
                      <span>{formatReservationTime(event.start)}{event.end ? ` - ${formatReservationTime(event.end)}` : ''}</span>
                      <em>{event.title} · {getReservationStatusLabel(event.status)}</em>
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
            <div key={event.id} className={`admin-reservation-row ${isReservationActive(event) ? 'is-live' : ''} ${isMaintenanceReservation(event) ? 'is-maintenance' : ''} ${isExternalReservation(event) ? 'is-external' : ''} ${event.status === 'rejected' ? 'is-rejected' : ''} ${event.status === 'canceled' ? 'is-canceled' : ''}`}>
              <div>
                <strong>{event.title}</strong>
                <em>{getReservationStatusLabel(event.status)}</em>
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
        {[
          { title: '사용자관리', page: 'users' as PageKey, icon: UserRound, updatedAt: usersUpdatedAt },
          { title: '장비관리', page: 'equipmentAdmin' as PageKey, icon: Wrench },
          { title: '공지사항', icon: Megaphone },
          { title: '권한관리', page: 'permissions' as PageKey, icon: LockKeyhole },
          { title: '소모품관리', page: 'consumables' as PageKey, icon: PackageCheck, updatedAt: consumablesUpdatedAt },
          { title: '페널티 관리', page: 'penalties' as PageKey, icon: Ban },
          { title: '교육관리', page: 'educationAdmin' as PageKey, icon: GraduationCap },
          { title: '감사 로그', page: 'auditLogs' as PageKey, icon: Clock3 }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              className="rounded-lg border border-white/10 bg-surface/85 p-6 text-left text-lg font-extrabold text-white hover:border-cyan-300 hover:bg-blue-500/20"
              onClick={() => item.title.includes('怨듭') || item.title.includes('공지') ? onNavigate('noticeAdmin') : item.page && onNavigate(item.page)}
            >
              <span className="inline-flex items-center gap-2">
                {Icon && <Icon size={20} className="text-cyan-300" />}
                {item.title}
              </span>
              <p className="mt-2 text-sm font-medium text-slate-400">상세 관리 화면으로 이동</p>
              {item.updatedAt && (
                <p className="mt-4 text-xs font-bold text-cyan-200">
                  최근 업데이트 {formatSeoulDateTime(item.updatedAt)}
                </p>
              )}
            </button>
          );
        })}
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

type LoginAuthState =
  | { kind: 'guest' }
  | { kind: 'needsRegistration' }
  | { kind: 'onboarding'; status: 'profile_pending' | 'training_pending' }
  | { kind: 'active' };

const loginSteps = [
  { title: 'Google 본인인증', description: 'Google 계정으로 본인 확인' },
  { title: '회원정보 등록', description: '이름, 소속학과, 지도교수명, 연락처, 이메일' },
  { title: '사용자관리 자동 연동', description: '센터 사용자 DB와 회원정보 매핑' },
  { title: '예약 권한 활성화', description: '장비사용 교육 이수 후 예약 가능' }
];

const loginStateMeta: Record<LoginAuthState['kind'], { label: string; tone: 'ready' | 'progress' | 'wait' | 'success' }> = {
  guest: { label: '본인인증을 진행해 주세요 · 등록 전', tone: 'ready' },
  needsRegistration: { label: '인증 완료 · 회원정보 등록 필요', tone: 'progress' },
  onboarding: { label: '회원정보 연동 완료 · 장비 교육 이수 대기', tone: 'wait' },
  active: { label: '예약 권한 활성화', tone: 'success' }
};

function deriveLoginStep(state: LoginAuthState) {
  if (state.kind === 'guest') return { current: 1, done: [] };
  if (state.kind === 'needsRegistration') return { current: 2, done: [1] };
  if (state.kind === 'onboarding') return { current: 4, done: [1, 2, 3] };
  return { current: 5, done: [1, 2, 3, 4] };
}

function LoginStepper({ state }: { state: LoginAuthState }) {
  const { current, done } = deriveLoginStep(state);
  return (
    <div className="login-stepper" aria-label="가입 흐름">
      <h3>가입 흐름</h3>
      <div className="login-step-list">
        {loginSteps.map((step, index) => {
          const stepNumber = index + 1;
          const isDone = done.includes(stepNumber);
          const isActive = stepNumber === current;
          const isLast = stepNumber === loginSteps.length;
          return (
            <div key={step.title} className={`login-step ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}>
              <div className="login-step-rail" aria-hidden="true">
                <span className="login-step-badge">
                  {isDone ? <CheckCircle2 size={16} /> : stepNumber}
                </span>
                {!isLast && <span className="login-step-line" />}
              </div>
              <div className="login-step-copy" aria-current={isActive ? 'step' : undefined}>
                <div>
                  <strong>{step.title}</strong>
                  {isActive && <em>현재 단계</em>}
                </div>
                <p>{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoginStatusChip({ state, message }: { state: LoginAuthState; message: string }) {
  const meta = loginStateMeta[state.kind];
  return (
    <div className={`login-status-chip is-${meta.tone}`} role="status" aria-live="polite">
      <strong>{meta.label}</strong>
      <span>{message}</span>
    </div>
  );
}

function LegacyLoginPage({
  onAuthenticated,
  onRegisterUser
}: {
  onAuthenticated: (role: Role) => void;
  onRegisterUser: (user: ManagedUser) => void;
}) {
  const [message, setMessage] = useState('Google 본인인증 후 센터 회원정보를 등록해 주세요.');
  const [pendingRegistration, setPendingRegistration] = useState<{ token: string; profile: GoogleAuthProfile } | null>(null);
  const [registrationForm, setRegistrationForm] = useState<RegistrationForm>({
    name: '',
    department: '',
    labProfessor: '',
    phone: '',
    email: ''
  });
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = useGoogleClientId();

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;
    let isMounted = true;
    void loadGoogleIdentityScript().then(() => {
      if (!isMounted || !googleButtonRef.current) return;
      const googleWindow = window as GoogleIdentityWindow;
      googleWindow.google?.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (response.credential) {
            void submitGoogleCredential(response.credential);
          } else {
            setMessage('Google 인증 응답을 받지 못했습니다.');
          }
        }
      });
      googleWindow.google?.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320
      });
    }).catch(() => {
      if (isMounted) setMessage('Google 인증 버튼을 불러오지 못했습니다.');
    });
    return () => {
      isMounted = false;
    };
  }, [googleClientId]);

  function completeLogin(data: GoogleAuthResponse) {
    if (!data.user || !data.token) return false;
    localStorage.setItem(STORAGE_KEYS.sessionToken, data.token);
    localStorage.setItem(STORAGE_KEYS.sessionUser, JSON.stringify(data.user));
    if (data.managedUser) onRegisterUser(data.managedUser);
    onAuthenticated(data.user.role ?? 'USER');
    setMessage('Google 인증 로그인이 완료되었습니다.');
    return true;
  }

  async function submitGoogleCredential(credential: string) {
    setMessage('Google 인증 정보를 확인하는 중입니다.');
    const response = await apiPost<GoogleAuthResponse>('/auth/google', { credential });
    if (!response) {
      setMessage('Google 인증 확인에 실패했습니다. Google Client ID와 Render 환경변수를 확인해 주세요.');
      return;
    }
    if (response.requiresRegistration && response.registrationToken && response.profile) {
      setPendingRegistration({ token: response.registrationToken, profile: response.profile });
      setRegistrationForm({
        name: response.profile.name ?? '',
        department: '',
        labProfessor: '',
        phone: '',
        email: response.profile.email
      });
      setMessage('본인인증이 완료되었습니다. 회원 정보를 등록해 주세요.');
      return;
    }
    completeLogin(response);
  }

  async function handleGoogleLogin() {
    if (!googleClientId) {
      setMessage('Google Client ID가 아직 설정되지 않았습니다. Google Cloud에서 발급 후 VITE_GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_ID를 등록하면 실제 인증이 활성화됩니다.');
      return;
    }
    setMessage('아래 Google 버튼을 눌러 본인인증을 진행해 주세요.');
  }

  async function handleRegistrationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingRegistration) return;
    const payload = {
      ...registrationForm,
      name: registrationForm.name.trim(),
      department: registrationForm.department.trim(),
      labProfessor: registrationForm.labProfessor.trim(),
      phone: formatPhoneNumber(registrationForm.phone),
      email: registrationForm.email.trim(),
      registrationToken: pendingRegistration.token
    };
    if (!payload.name || !payload.department || !payload.labProfessor || !payload.email) {
      setMessage('이름, 소속학과, 지도교수명, 이메일은 필수입니다.');
      return;
    }
    const response = await apiPost<GoogleAuthResponse>('/auth/register', payload);
    if (!response || !completeLogin(response)) {
      setMessage('회원 등록에 실패했습니다. 입력값과 인증 세션을 확인해 주세요.');
      return;
    }
    setPendingRegistration(null);
  }

  function updateRegistrationField<Key extends keyof RegistrationForm>(key: Key, value: RegistrationForm[Key]) {
    setRegistrationForm((current) => ({ ...current, [key]: value }));
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
        <p className="mb-6 max-w-2xl text-slate-300">Google 본인인증 후 센터 회원정보를 등록하면 사용자관리와 연동됩니다. 장비 사용은 교육 이수 후 활성화됩니다.</p>
        <div className="grid gap-3">
          {googleClientId ? (
            <div className="flex min-h-[3.5rem] items-center rounded-md bg-white px-5 py-2">
              <div ref={googleButtonRef} />
            </div>
          ) : (
            <button className="flex items-center justify-center gap-2 rounded-md bg-white px-5 py-4 text-base font-extrabold text-slate-950 hover:bg-cyan-100" onClick={handleGoogleLogin}>
              <LogIn size={20} /> Google Client ID 설정 필요
            </button>
          )}
        </div>
        <p className="mt-5 rounded-md bg-white/5 p-4 text-sm text-slate-300">{message}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-slate-950/80 p-8">
        <h3 className="text-2xl font-extrabold text-white">가입 흐름</h3>
        <div className="mt-6 grid gap-4 text-sm text-slate-300">
          <p className="rounded-md bg-white/5 p-4">1. Google 본인인증</p>
          <p className="rounded-md bg-white/5 p-4">2. 이름, 소속학과, 지도교수명, 연락처, 이메일 등록</p>
          <p className="rounded-md bg-white/5 p-4">3. 사용자관리 자동 연동</p>
          <p className="rounded-md bg-white/5 p-4">4. 장비사용 교육 이수 후 예약 권한 활성화</p>
        </div>
      </div>
      {pendingRegistration && (
        <div className="user-add-modal-backdrop" role="presentation">
          <form className="user-add-modal" onSubmit={handleRegistrationSubmit} aria-label="회원 등록">
            <div className="user-add-modal-head">
              <div>
                <p>Google verified</p>
                <h3>회원 정보 등록</h3>
              </div>
              <button type="button" onClick={() => setPendingRegistration(null)} aria-label="회원 등록 닫기">×</button>
            </div>
            <div className="user-add-modal-grid">
              <label>
                이름
                <input value={registrationForm.name} onChange={(event) => updateRegistrationField('name', event.target.value)} autoFocus />
              </label>
              <label>
                소속학과
                <input value={registrationForm.department} onChange={(event) => updateRegistrationField('department', event.target.value)} placeholder="예: 전자공학과" />
              </label>
              <label>
                지도교수명
                <input value={registrationForm.labProfessor} onChange={(event) => updateRegistrationField('labProfessor', event.target.value)} placeholder="예: 백근우 교수님" />
              </label>
              <label>
                연락처
                <input inputMode="numeric" value={registrationForm.phone} onChange={(event) => updateRegistrationField('phone', formatPhoneNumber(event.target.value))} placeholder="010-0000-0000" />
              </label>
              <label className="is-wide">
                이메일
                <input type="email" value={registrationForm.email} readOnly />
              </label>
            </div>
            <div className="user-add-modal-actions">
              <button type="button" className="is-cancel" onClick={() => setPendingRegistration(null)}>취소</button>
              <button type="submit" className="is-primary">가입</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function LoginPage({
  onAuthenticated,
  onRegisterUser
}: {
  onAuthenticated: (role: Role) => void;
  onRegisterUser: (user: ManagedUser) => void;
}) {
  const [message, setMessage] = useState('Google 본인인증 후 센터 회원정보를 등록하면 사용자관리와 자동 연동됩니다.');
  const [authState, setAuthState] = useState<LoginAuthState>({ kind: 'guest' });
  const [pendingRegistration, setPendingRegistration] = useState<{ token: string; profile: GoogleAuthProfile } | null>(null);
  const [registrationForm, setRegistrationForm] = useState<RegistrationForm>({
    name: '',
    department: '',
    labProfessor: '',
    phone: '',
    email: ''
  });
  const googleTokenClientRef = useRef<GoogleTokenClient | null>(null);
  const googleClientId = useGoogleClientId();

  useEffect(() => {
    if (!googleClientId) return;
    let isMounted = true;
    void loadGoogleIdentityScript().then(() => {
      if (!isMounted) return;
      const googleWindow = window as GoogleIdentityWindow;
      const tokenClient = googleWindow.google?.accounts.oauth2?.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        callback: (response) => {
          if (response.access_token) {
            void submitGoogleAccessToken(response.access_token);
          } else {
            setMessage(response.error_description || response.error || 'Google 인증 응답을 받지 못했습니다.');
          }
        }
      });
      googleTokenClientRef.current = tokenClient ?? null;
    }).catch(() => {
      if (isMounted) setMessage('Google 인증 버튼을 불러오지 못했습니다.');
    });
    return () => {
      isMounted = false;
    };
  }, [googleClientId]);

  function completeLogin(data: GoogleAuthResponse) {
    if (!data.user || !data.token) return false;
    localStorage.setItem(STORAGE_KEYS.sessionToken, data.token);
    localStorage.setItem(STORAGE_KEYS.sessionUser, JSON.stringify(data.user));
    if (data.managedUser) onRegisterUser(data.managedUser);
    onAuthenticated(data.user.role ?? 'USER');

    const onboardingStatus = data.managedUser?.onboardingStatus;
    if (onboardingStatus === 'active') {
      setAuthState({ kind: 'active' });
      setMessage('예약 권한이 활성화되었습니다.');
    } else {
      setAuthState({ kind: 'onboarding', status: onboardingStatus === 'profile_pending' ? 'profile_pending' : 'training_pending' });
      setMessage('회원정보가 연동되었습니다. 장비사용 교육 이수 후 예약 권한이 활성화됩니다.');
    }
    return true;
  }

  async function submitGoogleCredential(credential: string) {
    setMessage('Google 인증 정보를 확인하는 중입니다.');
    const response = await apiPost<GoogleAuthResponse>('/auth/google', { credential });
    if (!response) {
      setMessage('Google 인증 확인에 실패했습니다. Google Client ID와 Render 환경변수를 확인해 주세요.');
      return;
    }
    if (response.requiresRegistration && response.registrationToken && response.profile) {
      setAuthState({ kind: 'needsRegistration' });
      setPendingRegistration({ token: response.registrationToken, profile: response.profile });
      setRegistrationForm({
        name: response.profile.name ?? '',
        department: '',
        labProfessor: '',
        phone: '',
        email: response.profile.email
      });
      setMessage('본인인증이 완료되었습니다. 회원정보를 등록해 주세요.');
      return;
    }
    completeLogin(response);
  }

  async function submitGoogleAccessToken(accessToken: string) {
    setMessage('Google 인증 정보를 확인하는 중입니다.');
    const response = await apiPost<GoogleAuthResponse>('/auth/google/access-token', { accessToken });
    if (!response) {
      setMessage('Google 인증 확인에 실패했습니다. Google Client ID와 Render API 설정을 확인해 주세요.');
      return;
    }
    if (response.requiresRegistration && response.registrationToken && response.profile) {
      setAuthState({ kind: 'needsRegistration' });
      setPendingRegistration({ token: response.registrationToken, profile: response.profile });
      setRegistrationForm({
        name: response.profile.name ?? '',
        department: '',
        labProfessor: '',
        phone: '',
        email: response.profile.email
      });
      setMessage('본인인증이 완료되었습니다. 회원정보를 등록해 주세요.');
      return;
    }
    completeLogin(response);
  }

  function handleGoogleLogin() {
    if (!googleClientId) {
      setMessage('Google Client ID가 아직 설정되지 않았습니다. VITE_GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_ID 등록 후 실제 인증이 활성화됩니다.');
      return;
    }
    if (!googleTokenClientRef.current) {
      setMessage('Google 인증 모듈을 준비하는 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setMessage('Google 계정 선택 창을 여는 중입니다.');
    googleTokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
  }
  async function handleRegistrationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingRegistration) return;
    const payload = {
      ...registrationForm,
      name: registrationForm.name.trim(),
      department: registrationForm.department.trim(),
      labProfessor: registrationForm.labProfessor.trim(),
      phone: formatPhoneNumber(registrationForm.phone),
      email: registrationForm.email.trim(),
      registrationToken: pendingRegistration.token
    };
    if (!payload.name || !payload.department || !payload.labProfessor || !payload.email) {
      setMessage('이름, 소속학과, 지도교수명, 이메일은 필수입니다.');
      return;
    }
    const response = await apiPost<GoogleAuthResponse>('/auth/register', payload);
    if (!response || !completeLogin(response)) {
      setMessage('회원 등록에 실패했습니다. 입력값과 인증 세션을 확인해 주세요.');
      return;
    }
    setPendingRegistration(null);
  }

  function updateRegistrationField<Key extends keyof RegistrationForm>(key: Key, value: RegistrationForm[Key]) {
    setRegistrationForm((current) => ({ ...current, [key]: value }));
  }

  function closeRegistration() {
    setPendingRegistration(null);
    setMessage('회원정보 등록이 필요합니다. Google 인증을 다시 진행하거나 회원정보를 입력해 주세요.');
  }

  return (
    <section className="login-redesign-shell">
      <article className="login-auth-card">
        <div className="login-card-head">
          <div className="login-head-icon">
            <LockKeyhole size={20} aria-hidden="true" />
          </div>
          <div>
            <p>OAuth 로그인</p>
            <h2>로그인 / 회원가입</h2>
          </div>
        </div>

        <p className="login-auth-copy">
          Google 본인인증 후 센터 회원정보를 등록하면 사용자관리와 자동 연동됩니다.
        </p>

        {googleClientId ? (
          <div className="login-google-card" role="button" tabIndex={0} aria-label="Google 계정으로 로그인" onClick={handleGoogleLogin} onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') handleGoogleLogin();
          }}>
            <div className="login-google-visual" aria-hidden="true">
              <span className="login-google-mark">G</span>
              <span>
                <strong>Google 계정 사용</strong>
                <em>학교 이메일로 본인인증을 진행합니다</em>
              </span>
              <ArrowRight size={18} />
            </div>
          </div>
        ) : (
          <button type="button" className="login-google-card is-disabled" onClick={handleGoogleLogin}>
            <span className="login-google-mark">
              <LogIn size={17} />
            </span>
            <span>
              <strong>Google Client ID 설정 필요</strong>
              <em>환경변수 등록 후 실제 인증이 활성화됩니다</em>
            </span>
            <ArrowRight size={18} />
          </button>
        )}

        <LoginStatusChip state={authState} message={message} />

        <footer className="login-safe-footer">
          <div>
            <ShieldCheck size={14} aria-hidden="true" />
            <span>안전한 Google 본인인증</span>
          </div>
          <nav aria-label="로그인 관련 링크">
            <a href="#terms">이용약관</a>
            <a href="#privacy">개인정보처리방침</a>
            <a href="#contact">문의</a>
          </nav>
        </footer>
      </article>

      <article className="login-flow-card">
        <LoginStepper state={authState} />
      </article>

      {pendingRegistration && (
        <div className="user-add-modal-backdrop" role="presentation">
          <form className="user-add-modal" onSubmit={handleRegistrationSubmit} aria-label="회원정보 등록">
            <div className="user-add-modal-head">
              <div>
                <p>Google verified</p>
                <h3>회원정보 등록</h3>
              </div>
              <button type="button" onClick={closeRegistration} aria-label="회원정보 등록 닫기">×</button>
            </div>
            <div className="user-add-modal-grid">
              <label>
                이름
                <input value={registrationForm.name} onChange={(event) => updateRegistrationField('name', event.target.value)} autoFocus />
              </label>
              <label>
                소속학과
                <input value={registrationForm.department} onChange={(event) => updateRegistrationField('department', event.target.value)} placeholder="예: 전자공학과" />
              </label>
              <label>
                지도교수명
                <input value={registrationForm.labProfessor} onChange={(event) => updateRegistrationField('labProfessor', event.target.value)} placeholder="예: 홍길동 교수님" />
              </label>
              <label>
                연락처
                <input inputMode="numeric" value={registrationForm.phone} onChange={(event) => updateRegistrationField('phone', formatPhoneNumber(event.target.value))} placeholder="010-0000-0000" />
              </label>
              <label className="is-wide">
                이메일
                <input type="email" value={registrationForm.email} readOnly />
              </label>
            </div>
            <div className="user-add-modal-actions">
              <button type="button" className="is-cancel" onClick={closeRegistration}>취소</button>
              <button type="submit" className="is-primary">가입</button>
            </div>
          </form>
        </div>
      )}
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
  onCancelReservation: (reservationId: string) => Promise<boolean>;
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
              const equipmentName = getReservationEquipmentName(event, equipmentItems);
              return (
                <div key={event.id} className={`mypage-reservation-card ${isReservationActive(event) ? 'is-live' : ''}`}>
                  <div>
                    <p>{event.start.slice(0, 10)} · {formatReservationTime(event.start)}{event.end ? ` - ${formatReservationTime(event.end)}` : ''}</p>
                    <h3>{equipmentName}</h3>
                    <span>{getReservationStatusLabel(event.status)}</span>
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

function MyPageV2({
  equipmentItems,
  calendarEvents,
  managedUser,
  sessionUser,
  sessionRole,
  managerUserIds,
  permissions,
  permissionGrantMeta,
  penalties,
  onCancelReservation,
  onNavigate
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  managedUser: ManagedUser | null;
  sessionUser: StoredSessionUser | null;
  sessionRole: Role | null;
  managerUserIds: Set<string>;
  permissions: EquipmentPermissionMap;
  permissionGrantMeta: EquipmentPermissionGrantMetaMap;
  penalties: PenaltyRecord[];
  onCancelReservation: (reservationId: string) => Promise<boolean>;
  onNavigate: (page: PageKey) => void;
}) {
  const [reservationFilter, setReservationFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [cancelTarget, setCancelTarget] = useState<ReservationEvent | null>(null);
  const now = new Date();
  const profileName = managedUser?.name ?? sessionUser?.name ?? 'USER NAME';
  const profileDepartment = managedUser?.department ?? '소속 정보 미등록';
  const authProvider = getAuthProviderLabel(managedUser?.authProvider);
  const roles = getMyPageRoles(managedUser, sessionRole, managerUserIds);
  const isAdminSession = sessionRole === 'ADMIN';
  const sessionUserId = sessionUser?.id ?? managedUser?.id;
  const myReservations = calendarEvents
    .filter((event) => event.createdBy !== 'ADMIN')
    .filter((event) => isAdminSession || event.mine || (Boolean(sessionUserId) && event.userId === sessionUserId))
    .sort((first, second) => first.start.localeCompare(second.start));
  const upcomingReservations = myReservations
    .filter((event) => new Date(event.end ?? event.start) > now)
    .sort((first, second) => first.start.localeCompare(second.start));
  const pastReservations = myReservations
    .filter((event) => new Date(event.end ?? event.start) <= now)
    .sort((first, second) => second.start.localeCompare(first.start));
  const monthlyUsageHours = myReservations
    .filter((event) => {
      const start = new Date(event.start);
      return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth();
    })
    .reduce((sum, event) => sum + getReservationDurationHours(event), 0);
  const userPenaltyRecords = managedUser
    ? penalties.filter((record) => record.userId === managedUser.id)
    : [];
  const penaltyCount = userPenaltyRecords.length;
  const penaltyLimit = 3;
  const permissionIds = managedUser ? permissions[managedUser.id] ?? [] : [];
  const accessItems = equipmentItems
    .map((item) => {
      const isAssignedManager = Boolean(managedUser?.id) && item.managerId === managedUser?.id;
      const grantRole = managedUser?.id ? permissionGrantMeta[getPermissionGrantKey(managedUser.id, item.id)]?.grantedByRole : undefined;
      const hasPermission = permissionIds.includes(item.id);
      if (!isAssignedManager && !hasPermission) return null;
      return {
        equipmentName: item.name,
        label: isAssignedManager ? '담당자' : grantRole === 'ADMIN' ? '관리자 부여' : '이수'
      };
    })
    .filter(Boolean) as Array<{ equipmentName: string; label: string }>;
  const visibleGroups = [
    { key: 'upcoming', title: '다가오는 예약', items: upcomingReservations, empty: '예정된 예약이 없습니다.' },
    { key: 'past', title: '지난 예약', items: pastReservations, empty: '지난 예약 내역이 없습니다.' }
  ].filter((group) => reservationFilter === 'all' || reservationFilter === group.key);

  async function confirmCancelReservation() {
    if (!cancelTarget) return;
    const canceled = await onCancelReservation(cancelTarget.id);
    if (canceled) setCancelTarget(null);
  }

  function renderReservationRow(event: ReservationEvent, past = false) {
    const equipmentName = getReservationEquipmentName(event, equipmentItems);
    const canCancelReservation = isAdminSession || event.mine || (Boolean(sessionUserId) && event.userId === sessionUserId);
    const canCancel = !past && new Date(event.start) > now && canCancelReservation;
    const inProgress = !past && new Date(event.start) <= now;
    return (
      <div key={event.id} className={`mypage-reservation-row ${past ? 'is-past' : ''}`}>
        <div>
          <p>{formatMyPageReservationDate(event.start, event.end)}</p>
          <h3>{equipmentName}</h3>
        </div>
        {past ? (
          <button type="button" className="mypage-neutral-action" aria-label={`${equipmentName} 기록 보기`}>
            <BookOpen size={15} /> 기록
          </button>
        ) : (
          <button
            type="button"
            className="mypage-secondary-action"
            disabled={!canCancel}
            onClick={() => setCancelTarget(event)}
          >
            {inProgress ? '진행 중' : '취소'}
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="mypage-shell">
      <div className="mypage-profile-card">
        <div className="mypage-profile-head">
          <div className="mypage-profile-main">
            <div className="mypage-avatar">{profileName.slice(0, 1).toUpperCase()}</div>
            <div>
              <h2>{profileName}</h2>
              <p>{profileDepartment}</p>
            </div>
          </div>
          <span className="mypage-auth-badge">
            <LogIn size={15} /> {authProvider}
          </span>
        </div>
        <div className="mypage-role-grid" aria-label="보유 역할">
          {MY_PAGE_ROLE_ORDER.map((role) => {
            const meta = MY_PAGE_ROLE_META[role];
            const Icon = meta.icon;
            const owned = roles.includes(role);
            return (
              <span
                key={role}
                className={`mypage-role-chip is-${meta.tone} ${owned ? 'is-owned' : 'is-muted'}`}
                aria-disabled={!owned}
              >
                <Icon size={14} /> {meta.label}
              </span>
            );
          })}
        </div>
        <div className="mypage-summary-grid">
          <div>
            <span>이번 달 사용</span>
            <strong>{monthlyUsageHours.toFixed(1)}h</strong>
          </div>
          <div>
            <span>예정 예약</span>
            <strong>{upcomingReservations.length}</strong>
          </div>
          <div>
            <span>페널티</span>
            <strong>{penaltyLimit ? `${penaltyCount}/${penaltyLimit}회` : `${penaltyCount}회`}</strong>
          </div>
        </div>
      </div>

      <div className="mypage-reservation-panel">
        <div className="mypage-panel-head">
          <div>
            <p>My Reservations</p>
            <h2>내 예약현황</h2>
          </div>
          <div className="mypage-filter-tabs">
            {[
              ['all', '전체'],
              ['upcoming', '예정'],
              ['past', '지난']
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={reservationFilter === key ? 'is-active' : ''}
                onClick={() => setReservationFilter(key as 'all' | 'upcoming' | 'past')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {myReservations.length === 0 ? (
          <div className="mypage-empty-state">
            <p>예약 내역이 없습니다. 장비현황에서 예약을 시작해 보세요.</p>
            <button type="button" onClick={() => onNavigate('equipment')}>장비현황 바로가기</button>
          </div>
        ) : (
          <div className="mypage-reservation-groups">
            {visibleGroups.map((group) => (
              <div key={group.key} className="mypage-reservation-group">
                <h3>{group.title}</h3>
                {group.items.length > 0 ? (
                  group.items.map((event) => renderReservationRow(event, group.key === 'past'))
                ) : (
                  <p className="mypage-group-empty">{group.empty}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mypage-training-panel">
        <div className="mypage-panel-head">
          <div>
            <p>Training & Access</p>
            <h2>교육 및 예약 권한 현황</h2>
            <span>장비별 교육 이수 상태에 따라 예약 가능 여부가 결정됩니다.</span>
          </div>
        </div>
        <div className="mypage-training-grid">
          {accessItems.map((item) => (
            <div key={item.equipmentName} className="mypage-training-item">
              <strong>{item.equipmentName}</strong>
              <span className="mypage-training-badge is-complete">
                {item.label}
              </span>
            </div>
          ))}
        </div>
        {accessItems.length === 0 && (
          <div className="mypage-empty-state">
            <p>아직 장비 사용 교육 이수 권한이 없습니다. 교육신청 후 담당자 이수 처리가 완료되면 장비별 권한이 표시됩니다.</p>
            <button type="button" onClick={() => onNavigate('training')}>교육신청 바로가기</button>
          </div>
        )}
        <div className="mypage-penalty-row">
          <div>
            <ShieldCheck size={17} />
            <span>페널티 상태</span>
          </div>
          <span className={`mypage-penalty-badge ${penaltyCount === 0 ? 'is-good' : penaltyCount > penaltyLimit ? 'is-danger' : 'is-warning'}`}>
            {penaltyCount === 0 ? '정상' : '주의'} · {penaltyCount}회
          </span>
        </div>
      </div>

      {cancelTarget && (
        <div className="user-add-modal-backdrop" role="presentation">
          <section className="mypage-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="mypage-cancel-title">
            <div className="user-add-modal-head">
              <div>
                <p>Reservation Cancel</p>
                <h3 id="mypage-cancel-title">예약 취소 확인</h3>
              </div>
              <button type="button" onClick={() => setCancelTarget(null)} aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <p className="mypage-cancel-copy">선택한 예약을 취소합니다. 취소 후에는 장비예약관리에서 다시 예약해야 합니다.</p>
            <div className="user-add-modal-actions">
              <button type="button" className="is-cancel" onClick={() => setCancelTarget(null)}>닫기</button>
              <button type="button" className="is-primary" onClick={confirmCancelReservation}>취소 확정</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function PenaltyManagementPage({
  users,
  penalties,
  onAddPenalty,
  onRevokePenalty
}: {
  users: ManagedUser[];
  penalties: PenaltyRecord[];
  onAddPenalty: (userId: string, type: PenaltyType, category: PenaltyCategory, reason: string) => void;
  onRevokePenalty: (penaltyId: string) => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? '');
  const [type, setType] = useState<PenaltyType>('1주 사용정지');
  const [category, setCategory] = useState<PenaltyCategory>('장비활용관련');
  const [reason, setReason] = useState('');
  const activePenalties = penalties.filter((record) => isPenaltyActive(record));
  const permanentCount = activePenalties.filter((record) => record.type === '영구정지').length;
  const temporaryCount = activePenalties.length - permanentCount;

  function submitPenalty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId || !reason.trim()) return;
    onAddPenalty(selectedUserId, type, category, reason.trim());
    setReason('');
  }

  return (
    <section className="penalty-page">
      <div className="penalty-hero">
        <div>
          <p>Access Control</p>
          <h2>페널티 관리</h2>
          <span>시설 사용 규칙 위반, 안전 사고, 학생자치기구 관련 이슈에 따라 계정별 장비예약 접근을 제한합니다.</span>
        </div>
        <div className="penalty-summary-grid">
          <div>
            <strong>{activePenalties.length}</strong>
            <span>적용중</span>
          </div>
          <div>
            <strong>{temporaryCount}</strong>
            <span>기간 제한</span>
          </div>
          <div>
            <strong>{permanentCount}</strong>
            <span>영구정지</span>
          </div>
        </div>
      </div>

      <div className="penalty-layout">
        <form className="penalty-form-card" onSubmit={submitPenalty}>
          <div>
            <p>Issue Penalty</p>
            <h3>사용 제한 부여</h3>
          </div>
          <label>
            대상 사용자
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} · {user.department}</option>
              ))}
            </select>
          </label>
          <label>
            페널티 종류
            <select value={type} onChange={(event) => setType(event.target.value as PenaltyType)}>
              {penaltyTypeOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label>
            위반 분류
            <select value={category} onChange={(event) => setCategory(event.target.value as PenaltyCategory)}>
              {penaltyCategoryOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="is-wide">
            세부 사유
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="예: 장비 사용 후 정리 미흡, 안전수칙 미준수, 사고 유발 등" />
          </label>
          <button type="submit" disabled={!selectedUserId || !reason.trim()}>
            <Ban size={16} /> 페널티 부여
          </button>
        </form>

        <div className="penalty-table-card">
          <div className="penalty-table-head">
            <div>
              <p>Penalty Records</p>
              <h3>페널티 적용 현황</h3>
            </div>
            <span>만료 기간 도래 시 자동으로 비활성화됩니다.</span>
          </div>
          <div className="penalty-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>사용자</th>
                  <th>종류</th>
                  <th>분류</th>
                  <th>만료</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {penalties.length > 0 ? (
                  penalties.map((record) => {
                    const active = isPenaltyActive(record);
                    return (
                      <tr key={record.id}>
                        <td>
                          <strong>{record.userName}</strong>
                          <span>{record.userEmail}</span>
                        </td>
                        <td>{record.type}</td>
                        <td>{record.category}</td>
                        <td>
                          <strong>{formatPenaltyRemaining(record)}</strong>
                          <span>{formatPenaltyDateTime(record.endsAt)}</span>
                        </td>
                        <td><span className={`penalty-status-badge ${active ? 'is-active' : 'is-expired'}`}>{getPenaltyStatus(record)}</span></td>
                        <td>
                          <button type="button" disabled={!active} onClick={() => onRevokePenalty(record.id)}>해지</button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="penalty-empty">등록된 페널티가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function PenaltyNoticeModal({
  penalty,
  onClose
}: {
  penalty: PenaltyRecord;
  onClose: () => void;
}) {
  return (
    <div className="user-add-modal-backdrop">
      <div className="penalty-notice-modal">
        <div className="penalty-notice-icon"><AlertTriangle size={30} /></div>
        <p>Account Restricted</p>
        <h3>현재 계정에 사용 제한이 적용되어 있습니다.</h3>
        <div className="penalty-notice-grid">
          <span>페널티</span>
          <strong>{penalty.type}</strong>
          <span>위반 분류</span>
          <strong>{penalty.category}</strong>
          <span>남은 시간</span>
          <strong>{formatPenaltyRemaining(penalty)}</strong>
          <span>만료 시각</span>
          <strong>{formatPenaltyDateTime(penalty.endsAt)}</strong>
        </div>
        <div className="penalty-notice-reason">{penalty.reason}</div>
        <button type="button" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}

function PenaltyRestrictedPage({ penalty, onAcknowledge }: { penalty: PenaltyRecord; onAcknowledge: () => void }) {
  return (
    <section className="penalty-restricted-page">
      <div className="penalty-notice-icon"><Ban size={32} /></div>
      <p>Reservation Restricted</p>
      <h2>장비예약현황 이용이 일시적으로 제한되었습니다.</h2>
      <span>{penalty.type} · {formatPenaltyRemaining(penalty)}</span>
      <div className="penalty-notice-reason">{penalty.reason}</div>
      <button type="button" onClick={onAcknowledge}>페널티 상세 확인</button>
    </section>
  );
}

function AccessRequirementModal({
  notice,
  onClose
}: {
  notice: AccessRequirementNotice;
  onClose: () => void;
}) {
  return (
    <div className="user-add-modal-backdrop" role="presentation">
      <section className="access-requirement-modal" role="dialog" aria-modal="true" aria-labelledby="access-requirement-title">
        <div className="access-requirement-icon" aria-hidden="true">
          <LockKeyhole size={26} />
        </div>
        <div className="access-requirement-heading">
          <p>이용 조건 안내</p>
          <h3 id="access-requirement-title">{notice.title}</h3>
        </div>
        <p>{notice.message}</p>
        {notice.detail && <div className="access-requirement-detail">{notice.detail}</div>}
        <div className="user-add-modal-actions">
          <button type="button" className="is-cancel" onClick={onClose}>확인</button>
          {notice.primaryLabel && notice.onPrimary && (
            <button
              type="button"
              className="is-primary"
              onClick={() => {
                onClose();
                notice.onPrimary?.();
              }}
            >
              {notice.primaryLabel}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function UserAddModal({
  labs,
  departments,
  onClose,
  onConfirm
}: {
  labs: string[];
  departments: string[];
  onClose: () => void;
  onConfirm: (user: Omit<ManagedUser, 'id' | 'index'>) => void;
}) {
  const newDepartmentValue = '__new_department__';
  const [departmentMode, setDepartmentMode] = useState(departments[0] ? departments[0] : newDepartmentValue);
  const [form, setForm] = useState<Omit<ManagedUser, 'id' | 'index'>>({
    name: '',
    roleLevel: '일반',
    department: departments[0] ?? '',
    labProfessor: '',
    phone: '',
    email: '',
    memo: '',
    authProvider: 'Manual',
    onboardingStatus: 'training_pending'
  });
  const isNewDepartment = departmentMode === newDepartmentValue;

  function updateField<Key extends keyof typeof form>(key: Key, value: typeof form[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      window.alert('이름을 입력해주세요.');
      return;
    }
    if (!form.email.trim()) {
      window.alert('이메일을 입력해주세요.');
      return;
    }
    if (!form.department.trim()) {
      window.alert('소속 학과를 선택하거나 입력해주세요.');
      return;
    }
    if (!form.labProfessor.trim()) {
      window.alert('지도교수명을 입력해주세요.');
      return;
    }
    onConfirm({
      ...form,
      name: form.name.trim(),
      department: form.department.trim(),
      labProfessor: form.labProfessor.trim(),
      phone: formatPhoneNumber(form.phone),
      email: form.email.trim(),
      memo: form.memo.trim(),
      onboardingStatus: form.onboardingStatus
    });
  }

  return (
    <div className="user-add-modal-backdrop" role="presentation">
      <form className="user-add-modal" onSubmit={handleSubmit} aria-label="신규 사용자 추가">
        <div className="user-add-modal-head">
          <div>
            <p>User Directory</p>
            <h3>사용자 추가</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="사용자 추가 닫기">×</button>
        </div>
        <div className="user-add-modal-grid">
          <label>
            이름
            <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="이름" autoFocus />
          </label>
          <label>
            ROLE
            <select value={form.roleLevel} onChange={(event) => updateField('roleLevel', normalizeRoleLevel(event.target.value))}>
              {roleLevelOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label>
            소속 학과
            <select
              value={departmentMode}
              onChange={(event) => {
                const value = event.target.value;
                setDepartmentMode(value);
                updateField('department', value === newDepartmentValue ? '' : value);
              }}
            >
              <option value={newDepartmentValue}>신규 학과 추가</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            {isNewDepartment && (
              <input
                className="user-add-manual-field"
                value={form.department}
                onChange={(event) => updateField('department', event.target.value)}
                placeholder="신규 학과명 입력"
              />
            )}
          </label>
          <label>
            지도교수명
            <input value={form.labProfessor} onChange={(event) => updateField('labProfessor', event.target.value)} placeholder="예: 백근우 교수님" />
          </label>
          <label>
            연락처
            <input inputMode="numeric" value={form.phone} onChange={(event) => updateField('phone', formatPhoneNumber(event.target.value))} placeholder="010-0000-0000" />
          </label>
          <label>
            이메일
            <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="user@example.com" />
          </label>
          <label className="is-wide">
            메모
            <input value={form.memo} onChange={(event) => updateField('memo', event.target.value)} placeholder="관리자 메모" />
          </label>
          <label>
            회원상태
            <select value={form.onboardingStatus} onChange={(event) => updateField('onboardingStatus', event.target.value as OnboardingStatus)}>
              {onboardingStatusOptions.map((status) => <option key={status} value={status}>{getOnboardingStatusLabel(status)}</option>)}
            </select>
          </label>
        </div>
        <div className="user-add-modal-actions">
          <button type="button" className="is-cancel" onClick={onClose}>닫기</button>
          <button type="submit" className="is-primary">사용자 추가</button>
        </div>
      </form>
    </div>
  );
}

function UserEditModal({
  user,
  labs,
  departments,
  onClose,
  onConfirm,
  onRequestDelete
}: {
  user: ManagedUser;
  labs: string[];
  departments: string[];
  onClose: () => void;
  onConfirm: (patch: Partial<ManagedUser>) => void;
  onRequestDelete: (user: ManagedUser) => void;
}) {
  const newDepartmentValue = '__new_department__';
  const [departmentMode, setDepartmentMode] = useState(departments.includes(user.department) ? user.department : newDepartmentValue);
  const [form, setForm] = useState({
    name: user.name,
    roleLevel: user.roleLevel,
    department: user.department,
    labProfessor: user.labProfessor,
    phone: user.phone,
    email: user.email,
    memo: user.memo,
    onboardingStatus: user.onboardingStatus ?? 'training_pending'
  });
  const isNewDepartment = departmentMode === newDepartmentValue;

  function updateField<Key extends keyof typeof form>(key: Key, value: typeof form[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      window.alert('이름을 입력해주세요.');
      return;
    }
    if (!form.department.trim()) {
      window.alert('소속 학과를 선택하거나 입력해주세요.');
      return;
    }
    if (!form.labProfessor.trim()) {
      window.alert('지도교수명을 입력해주세요.');
      return;
    }

    onConfirm({
      name: form.name.trim(),
      roleLevel: form.roleLevel,
      department: form.department.trim(),
      labProfessor: form.labProfessor.trim(),
      phone: formatPhoneNumber(form.phone),
      email: form.email.trim(),
      memo: form.memo.trim(),
      onboardingStatus: form.onboardingStatus
    });
  }

  return (
    <div className="user-add-modal-backdrop" role="presentation">
      <form className="user-add-modal user-edit-modal" onSubmit={handleSubmit} aria-label={`${user.name} 사용자 정보 편집`}>
        <div className="user-add-modal-head">
          <div>
            <p>User Directory</p>
            <h3>{user.name} 정보 편집</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="사용자 편집 닫기">×</button>
        </div>
        <div className="user-add-modal-grid">
          <label>
            이름
            <input value={form.name} onChange={(event) => updateField('name', event.target.value)} autoFocus />
          </label>
          <label>
            ROLE
            <select value={form.roleLevel} onChange={(event) => updateField('roleLevel', normalizeRoleLevel(event.target.value))}>
              {roleLevelOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label>
            소속 학과
            <select
              value={departmentMode}
              onChange={(event) => {
                const value = event.target.value;
                setDepartmentMode(value);
                updateField('department', value === newDepartmentValue ? '' : value);
              }}
            >
              <option value={newDepartmentValue}>신규 학과 추가</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            {isNewDepartment && (
              <input className="user-add-manual-field" value={form.department} onChange={(event) => updateField('department', event.target.value)} placeholder="신규 학과명 입력" />
            )}
          </label>
          <label>
            지도교수명
            <input value={form.labProfessor} onChange={(event) => updateField('labProfessor', event.target.value)} placeholder="예: 백근우 교수님" />
          </label>
          <label>
            연락처
            <input inputMode="numeric" value={form.phone} onChange={(event) => updateField('phone', formatPhoneNumber(event.target.value))} placeholder="010-0000-0000" />
          </label>
          <label>
            이메일
            <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="user@example.com" />
          </label>
          <label className="is-wide">
            메모
            <input value={form.memo} onChange={(event) => updateField('memo', event.target.value)} placeholder="관리자 메모" />
          </label>
          <label>
            회원상태
            <select value={form.onboardingStatus} onChange={(event) => updateField('onboardingStatus', event.target.value as OnboardingStatus)}>
              {onboardingStatusOptions.map((status) => <option key={status} value={status}>{getOnboardingStatusLabel(status)}</option>)}
            </select>
          </label>
        </div>
        <div className="user-add-modal-actions">
          <button type="button" className="is-danger-secondary" onClick={() => onRequestDelete(user)}>사용자 삭제</button>
          <span className="user-modal-action-spacer" />
          <button type="button" className="is-cancel" onClick={onClose}>닫기</button>
          <button type="submit" className="is-primary">수정 저장</button>
        </div>
      </form>
    </div>
  );
}

function UserDeleteConfirmModal({
  user,
  onCancel,
  onConfirm
}: {
  user: ManagedUser;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmName, setConfirmName] = useState('');
  const canDelete = confirmName.trim() === user.name;

  return (
    <div className="user-add-modal-backdrop" role="presentation">
      <section className="user-delete-modal" role="dialog" aria-modal="true" aria-label={`${user.name} 사용자 삭제 확인`}>
        <div className="user-delete-modal-head">
          <p>User Directory</p>
          <h3>사용자 삭제 확인</h3>
        </div>
        <div className="user-delete-target">
          <strong>{user.name}</strong>
          <span>{user.department} · {formatProfessorLab(user.labProfessor)}</span>
          <em>{user.roleLevel}</em>
        </div>
        <p className="user-delete-warning">
          이 작업은 사용자 목록과 장비 권한 매핑에서 해당 사용자를 제거합니다. 삭제하려면 아래 입력칸에 사용자 이름을 그대로 입력해주세요.
        </p>
        <label className="user-delete-confirm-field">
          사용자 이름 확인
          <input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} placeholder={user.name} autoFocus />
        </label>
        <div className="user-add-modal-actions">
          <button type="button" className="is-cancel" onClick={onCancel}>삭제 취소</button>
          <button type="button" className="is-danger" disabled={!canDelete} onClick={onConfirm}>삭제 확정</button>
        </div>
      </section>
    </div>
  );
}

function UserManagementPage({
  users,
  saveFeedbackPhase,
  onUpdateUser,
  onAddUser,
  onDeleteUser,
  onImportUsers,
  onSave
}: {
  users: ManagedUser[];
  saveFeedbackPhase: 'idle' | 'feedback' | 'returning';
  onUpdateUser: (id: string, patch: Partial<ManagedUser>) => void;
  onAddUser: (user: Omit<ManagedUser, 'id' | 'index'>) => void;
  onDeleteUser: (id: string) => void;
  onImportUsers: (rows: ManagedUser[]) => void;
  onSave: () => void;
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<ManagedUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('전체');
  const [departmentFilter, setDepartmentFilter] = useState('전체');
  const [labFilter, setLabFilter] = useState('전체');
  const [authFilter, setAuthFilter] = useState('전체');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const departments = useMemo(() => ['전체', ...Array.from(new Set(users.map((user) => user.department).filter(Boolean)))], [users]);
  const labs = useMemo(() => ['전체', ...Array.from(new Set(users.map((user) => user.labProfessor).filter(Boolean)))], [users]);
  const authProviders = useMemo(() => ['전체', ...Array.from(new Set(users.map((user) => user.authProvider ?? 'Manual')))], [users]);
  const filteredUsers = useMemo(() => (
    users.filter((user) => {
      const keyword = searchTerm.trim().toLowerCase();
      const nameKeyword = nameFilter.trim().toLowerCase();
      const matchesSearch = !keyword || `${user.name} ${user.department} ${user.labProfessor} ${user.email} ${user.phone} ${user.memo}`.toLowerCase().includes(keyword);
      const matchesName = !nameKeyword || user.name.toLowerCase().includes(nameKeyword);
      const matchesRole = roleFilter === '전체' || user.roleLevel === roleFilter;
      const matchesDepartment = departmentFilter === '전체' || user.department === departmentFilter;
      const matchesLab = labFilter === '전체' || user.labProfessor === labFilter;
      const matchesAuth = authFilter === '전체' || (user.authProvider ?? 'Manual') === authFilter;
      return matchesSearch && matchesName && matchesRole && matchesDepartment && matchesLab && matchesAuth;
    })
  ), [authFilter, departmentFilter, labFilter, nameFilter, roleFilter, searchTerm, users]);
  const representativeCount = users.filter((user) => user.roleLevel === '대표').length;
  const facultyCount = users.filter((user) => user.roleLevel === '교원').length;
  const totalPages = Math.max(Math.ceil(filteredUsers.length / pageSize), 1);
  const pageStart = (currentPage - 1) * pageSize;
  const pageUsers = filteredUsers.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [authFilter, departmentFilter, labFilter, nameFilter, pageSize, roleFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  function handleUsersUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImportUsers(parseUsersUpload(String(reader.result ?? '')));
      } catch (error) {
        window.alert(error instanceof Error ? error.message : '사용자 엑셀 업로드에 실패했습니다.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  return (
    <section className="user-management-page">
      <div className="consumables-hero">
        <div>
          <p className="consumables-eyebrow">User Directory</p>
          <h2>사용자 관리</h2>
          <span>Google 인증 후 가입자가 입력한 정보를 기준으로 사용자 권한과 지도교수 정보를 관리합니다.</span>
        </div>
        <div className="consumables-actions">
          <button type="button" onClick={() => downloadUsersExcel(users)} aria-label="사용자 명단 엑셀 다운로드">
            <Download size={17} /> Excel 다운로드
          </button>
          <input ref={uploadInputRef} type="file" accept=".xls,.html,.csv,.txt" onChange={handleUsersUpload} aria-label="사용자 엑셀 업로드 파일 선택" hidden />
          <button type="button" onClick={() => uploadInputRef.current?.click()} aria-label="사용자 엑셀 업로드">
            <UploadCloud size={17} /> Excel 업로드
          </button>
        </div>
      </div>

      <div className="user-summary-grid">
        <div>
          <span>전체 사용자</span>
          <strong>{users.length}</strong>
          <em>registered</em>
        </div>
        <div>
          <span>교원 / 대표학생</span>
          <strong>{facultyCount} / {representativeCount}</strong>
          <em>faculty / representatives</em>
        </div>
        <div>
          <span>소속 Lab</span>
          <strong>{Math.max(labs.length - 1, 0)}</strong>
          <em>professor groups</em>
        </div>
        <div>
          <span>대표학생</span>
          <strong>{representativeCount}</strong>
          <em>lab representatives</em>
        </div>
        <div className="consumables-summary-action">
          <span>데이터 저장</span>
          <button
            type="button"
            className={`is-primary ${saveFeedbackPhase === 'feedback' ? 'is-save-feedback' : ''} ${saveFeedbackPhase === 'returning' ? 'is-save-returning' : ''}`}
            onClick={onSave}
            aria-label="사용자 데이터 저장"
          >
            <CheckCircle2 size={18} /> {saveFeedbackPhase === 'feedback' ? '저장완료!' : '저장'}
          </button>
        </div>
        <div className="consumables-summary-action">
          <span>사용자 추가</span>
          <button type="button" onClick={() => setShowAddUserModal(true)} aria-label="신규 사용자 추가">
            <Plus size={18} /> 사용자 추가
          </button>
        </div>
      </div>

      <div className="consumables-toolbar">
        <div className="consumables-search">
          <Search size={17} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="이름, 학과, 연구실, 이메일 검색" aria-label="사용자 검색" />
        </div>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="대표/일반 필터">
          <option value="전체">전체</option>
          {roleLevelOptions.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <select value={labFilter} onChange={(event) => setLabFilter(event.target.value)} aria-label="지도교수명 필터">
          {labs.map((lab) => (
            <option key={lab} value={lab}>{lab}</option>
          ))}
        </select>
        <label className="permission-page-size-control">
          <span>표시 인원</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="사용자관리 페이지당 표시 인원">
            <option value={20}>20명</option>
            <option value={30}>30명</option>
            <option value={50}>50명</option>
          </select>
        </label>
      </div>

      <div className="consumables-table-wrap">
        <table className="consumables-table users-table">
          <colgroup>
            <col className="user-col-index" />
            <col className="user-col-name" />
            <col className="user-col-role" />
            <col className="user-col-department" />
            <col className="user-col-lab" />
            <col className="user-col-phone" />
            <col className="user-col-email" />
            <col className="user-col-status" />
            <col className="user-col-auth" />
            <col className="user-col-memo" />
          </colgroup>
          <thead>
            <tr>
              <th>연번</th>
              <th>이름</th>
              <th>ROLE</th>
              <th>소속 학과</th>
              <th>지도교수명</th>
              <th>연락처</th>
              <th>이메일</th>
              <th>회원상태</th>
              <th>인증</th>
              <th>메모</th>
            </tr>
            <tr className="users-table-filter-row">
              <th />
              <th>
                <input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="이름 필터" aria-label="이름 컬럼 필터" />
              </th>
              <th>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="ROLE 컬럼 필터">
                  <option value="전체">전체</option>
                  {roleLevelOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </th>
              <th>
                <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="소속 학과 컬럼 필터">
                  {departments.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </th>
              <th>
                <select value={labFilter} onChange={(event) => setLabFilter(event.target.value)} aria-label="지도교수명 컬럼 필터">
                  {labs.map((lab) => (
                    <option key={lab} value={lab}>{lab}</option>
                  ))}
                </select>
              </th>
              <th />
              <th />
              <th />
              <th>
                <select value={authFilter} onChange={(event) => setAuthFilter(event.target.value)} aria-label="인증 컬럼 필터">
                  {authProviders.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((user, index) => {
              const labTone = getProfessorTone(user.labProfessor);
              const roleToneClass = getRoleToneClass(user.roleLevel);
              return (
                <tr key={user.id} className="user-table-row" onClick={() => setEditingUser(user)}>
                  <td>{pageStart + index + 1}</td>
                  <td><button type="button" className="user-row-name" onClick={() => setEditingUser(user)}>{user.name}</button></td>
                  <td>
                    <span className={`user-role-badge ${roleToneClass}`}>{user.roleLevel}</span>
                  </td>
                  <td><span className="user-readonly-cell">{user.department}</span></td>
                  <td>
                    <span className="user-lab-input user-readonly-lab">
                      <i style={{ backgroundColor: labTone, color: labTone }} />
                      <span style={{ borderColor: `${labTone}cc`, backgroundColor: `${labTone}18` }}>{formatProfessorLab(user.labProfessor)}</span>
                    </span>
                  </td>
                  <td><span className="user-readonly-cell">{user.phone || '-'}</span></td>
                  <td><span className="user-readonly-cell is-email">{user.email || '-'}</span></td>
                  <td><span className="user-readonly-cell">{getOnboardingStatusLabel(user.onboardingStatus)}</span></td>
                  <td>
                    <span className={`auth-provider-badge is-${(user.authProvider ?? 'Manual').toLowerCase()}`}>{user.authProvider ?? 'Manual'}</span>
                  </td>
                  <td><span className="user-readonly-cell is-memo">{user.memo || '-'}</span></td>
                </tr>
              );
            })}
            {pageUsers.length === 0 && (
              <tr>
                <td colSpan={10} className="permission-empty-row">조건에 맞는 사용자가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="permission-pagination" aria-label="사용자관리 페이지 이동">
        <span>{filteredUsers.length === 0 ? '0명' : `${pageStart + 1}-${Math.min(pageStart + pageSize, filteredUsers.length)}명`} / 총 {filteredUsers.length}명</span>
        <div>
          <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>처음</button>
          <button type="button" onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} disabled={currentPage === 1}>이전</button>
          <strong>{currentPage} / {totalPages}</strong>
          <button type="button" onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))} disabled={currentPage === totalPages}>다음</button>
          <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>마지막</button>
        </div>
      </div>
      {showAddUserModal && (
        <UserAddModal
          labs={labs.filter((lab) => lab !== '전체')}
          departments={departments.filter((department) => department !== '전체')}
          onClose={() => setShowAddUserModal(false)}
          onConfirm={(user) => {
            onAddUser(user);
            setShowAddUserModal(false);
          }}
        />
      )}
      {editingUser && (
        <UserEditModal
          key={editingUser.id}
          user={editingUser}
          labs={labs.filter((lab) => lab !== '전체')}
          departments={departments.filter((department) => department !== '전체')}
          onClose={() => setEditingUser(null)}
          onConfirm={(patch) => {
            onUpdateUser(editingUser.id, patch);
            setEditingUser(null);
          }}
          onRequestDelete={(user) => {
            setEditingUser(null);
            setDeleteTargetUser(user);
          }}
        />
      )}
      {deleteTargetUser && (
        <UserDeleteConfirmModal
          user={deleteTargetUser}
          onCancel={() => setDeleteTargetUser(null)}
          onConfirm={() => {
            onDeleteUser(deleteTargetUser.id);
            setDeleteTargetUser(null);
          }}
        />
      )}
    </section>
  );
}

function EquipmentAdminPage({
  equipmentItems,
  users,
  onAddEquipment,
  onDeleteEquipment,
  onUpdateEquipment,
  onUploadEquipmentImage
}: {
  equipmentItems: EquipmentItem[];
  users: ManagedUser[];
  onAddEquipment: (item: EquipmentItem) => Promise<boolean>;
  onDeleteEquipment: (equipmentId: string) => Promise<boolean>;
  onUpdateEquipment: (equipmentId: string, patch: Partial<EquipmentItem>) => Promise<boolean>;
  onUploadEquipmentImage: (equipmentId: string, file: File) => Promise<string | null>;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState<'전체' | EquipmentGroup>('전체');
  const [statusFilter, setStatusFilter] = useState<'전체' | EquipmentStatus>('전체');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteSelectionOpen, setDeleteSelectionOpen] = useState(false);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set());
  const filteredItems = useMemo(() => (
    equipmentItems.filter((item) => {
      const keyword = searchTerm.trim().toLowerCase();
      const matchesSearch = !keyword || `${item.name} ${item.model ?? ''} ${item.location} ${item.groupName}`.toLowerCase().includes(keyword);
      const matchesGroup = groupFilter === '전체' || item.group === groupFilter;
      const matchesStatus = statusFilter === '전체' || (item.status ?? 'available') === statusFilter;
      return matchesSearch && matchesGroup && matchesStatus;
    })
  ), [equipmentItems, groupFilter, searchTerm, statusFilter]);
  const managerCount = new Set(equipmentItems.map((item) => item.managerId).filter(Boolean)).size;
  const filteredIds = filteredItems.map((item) => item.id);
  const selectedItems = equipmentItems.filter((item) => selectedEquipmentIds.has(item.id));
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedEquipmentIds.has(id));

  useEffect(() => {
    setSelectedEquipmentIds((current) => new Set([...current].filter((id) => equipmentItems.some((item) => item.id === id))));
  }, [equipmentItems]);

  function toggleEquipmentSelection(equipmentId: string) {
    setSelectedEquipmentIds((current) => {
      const next = new Set(current);
      if (next.has(equipmentId)) {
        next.delete(equipmentId);
      } else {
        next.add(equipmentId);
      }
      return next;
    });
  }

  function toggleFilteredSelection() {
    setSelectedEquipmentIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function createEquipmentDraft(): EquipmentItem {
    return {
      id: `eq-${Date.now()}`,
      name: '',
      model: '',
      category: '공정 장비',
      group: 'process',
      groupName: '공정',
      location: 'N11동 107호',
      image: categoryMeta.process.image,
      features: ['예약 캘린더', '교육 인증', '사용 로그'],
      condition: '교육 이수 후 담당자 승인 시 사용 가능',
      status: 'available',
      description: '',
      utilization: 0,
      usageHours: 0
    };
  }

  return (
    <section className="equipment-admin-page">
      <div className="consumables-hero">
        <div>
          <p className="consumables-eyebrow">Equipment Management</p>
          <h2>장비관리</h2>
          <span>보유 장비의 기본 정보, 상태, 사진, 설명, 담당자를 관리합니다. 담당자 지정 시 권한관리 ROLE과 장비 권한이 자동 반영됩니다.</span>
        </div>
      </div>

      <div className="equipment-admin-summary">
        <div>
          <span>보유 장비</span>
          <strong>{equipmentItems.length}</strong>
        </div>
        <div>
          <span>이용가능</span>
          <strong>{equipmentItems.filter((item) => (item.status ?? 'available') === 'available').length}</strong>
        </div>
        <div>
          <span>이용불가</span>
          <strong>{equipmentItems.filter((item) => (item.status ?? 'available') === 'unavailable').length}</strong>
        </div>
        <div>
          <span>담당자 배정</span>
          <strong>{managerCount}</strong>
        </div>
      </div>

      <div className="equipment-admin-toolbar">
        <div className="consumables-search">
          <Search size={17} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="장비명, 모델명, 설치위치 검색" />
        </div>
        <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value as '전체' | EquipmentGroup)}>
          <option value="전체">전체 분류</option>
          <option value="process">공정</option>
          <option value="metrology">검사·계측·패키징</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as '전체' | EquipmentStatus)}>
          <option value="전체">전체 상태</option>
          <option value="available">이용가능</option>
          <option value="unavailable">이용불가</option>
        </select>
        <div className="equipment-admin-actions">
          <button type="button" className="equipment-admin-action is-add" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> 신규 장비 추가
          </button>
          <button
            type="button"
            className="equipment-admin-action is-delete"
            disabled={selectedEquipmentIds.size === 0}
            onClick={() => setDeleteSelectionOpen(true)}
          >
            <Trash2 size={16} /> 선택 삭제 {selectedEquipmentIds.size > 0 ? selectedEquipmentIds.size : ''}
          </button>
        </div>
      </div>

      <div className="equipment-admin-table-wrap">
        <table className="equipment-admin-table">
          <thead>
            <tr>
              <th className="equipment-admin-check-cell">
                <input
                  type="checkbox"
                  aria-label="필터된 장비 전체 선택"
                  checked={allFilteredSelected}
                  onChange={toggleFilteredSelection}
                />
              </th>
              <th>장비명</th>
              <th>모델명</th>
              <th>설치위치</th>
              <th>장비 분류</th>
              <th>장비상태</th>
              <th>담당자</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const manager = users.find((user) => user.id === item.managerId);
              return (
                <tr key={item.id} onClick={() => setSelectedEquipment(item)}>
                  <td className="equipment-admin-check-cell" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`${item.name} 선택`}
                      checked={selectedEquipmentIds.has(item.id)}
                      onChange={() => toggleEquipmentSelection(item.id)}
                    />
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                    <span>{item.description ?? item.condition}</span>
                  </td>
                  <td>{item.model ?? '-'}</td>
                  <td>{item.location}</td>
                  <td><span className={`equipment-admin-group is-${item.group}`}>{item.group === 'process' ? '공정' : '검사·계측·패키징'}</span></td>
                  <td><span className={`equipment-admin-status is-${item.status ?? 'available'}`}>{(item.status ?? 'available') === 'available' ? '이용가능' : '이용불가'}</span></td>
                  <td>{manager ? <span className="equipment-admin-manager">{manager.name}</span> : <span className="equipment-admin-empty">미배정</span>}</td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={7} className="equipment-admin-empty-row">조건에 맞는 장비가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedEquipment && (
        <EquipmentEditModal
          equipment={selectedEquipment}
          users={users}
          mode="edit"
          onUploadImage={onUploadEquipmentImage}
          onClose={() => setSelectedEquipment(null)}
          onSave={async (patch) => {
            const saved = await onUpdateEquipment(selectedEquipment.id, patch);
            if (saved) setSelectedEquipment(null);
          }}
        />
      )}
      {showCreateModal && (
        <EquipmentEditModal
          equipment={createEquipmentDraft()}
          users={users}
          mode="create"
          onUploadImage={onUploadEquipmentImage}
          onClose={() => setShowCreateModal(false)}
          onSave={async (patch) => {
            const group = patch.group ?? 'process';
            const saved = await onAddEquipment({
              ...createEquipmentDraft(),
              ...patch,
              id: String(patch.id ?? `eq-${Date.now()}`),
              name: String(patch.name ?? '').trim(),
              model: String(patch.model ?? '').trim(),
              location: String(patch.location ?? '').trim(),
              group,
              groupName: group === 'process' ? '공정' : '검사·계측·패키징',
              category: group === 'process' ? '공정 장비' : '검사·계측·패키징 장비',
              image: patch.image || (group === 'process' ? categoryMeta.process.image : categoryMeta.metrology.image),
              features: ['예약 캘린더', '교육 인증', '사용 로그'],
              condition: '교육 이수 후 담당자 승인 시 사용 가능',
              status: patch.status ?? 'available',
              utilization: 0,
              usageHours: 0
            });
            if (saved) setShowCreateModal(false);
          }}
        />
      )}
      {deleteSelectionOpen && (
        <EquipmentSelectionDeleteModal
          items={selectedItems}
          onCancel={() => setDeleteSelectionOpen(false)}
          onConfirm={async () => {
            const results = await Promise.all(selectedItems.map((item) => onDeleteEquipment(item.id)));
            const deletedIds = new Set(selectedItems.filter((_, index) => results[index]).map((item) => item.id));
            setSelectedEquipmentIds((current) => new Set([...current].filter((id) => !deletedIds.has(id))));
            if (results.every(Boolean)) setDeleteSelectionOpen(false);
          }}
        />
      )}
    </section>
  );
}

function EquipmentEditModal({
  equipment,
  users,
  mode = 'edit',
  onClose,
  onUploadImage,
  onSave
}: {
  equipment: EquipmentItem;
  users: ManagedUser[];
  mode?: 'create' | 'edit';
  onClose: () => void;
  onUploadImage?: (equipmentId: string, file: File) => Promise<string | null>;
  onSave: (patch: Partial<EquipmentItem>) => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    name: equipment.name,
    model: equipment.model ?? '',
    location: equipment.location,
    group: equipment.group,
    status: (equipment.status ?? 'available') as EquipmentStatus,
    image: equipment.image,
    description: equipment.description ?? '',
    managerId: equipment.managerId ?? '',
    vendorName: equipment.vendorName ?? '',
    vendorContactName: equipment.vendorContactName ?? '',
    vendorContactPosition: equipment.vendorContactPosition ?? '',
    vendorContactPhone: equipment.vendorContactPhone ?? ''
  });
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const managerCandidates = users.filter((user) => user.roleLevel === '교원' || user.roleLevel === '대표' || user.roleLevel === '일반');

  function updateField<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function loadImage(file?: File) {
    if (!file || !file.type.startsWith('image/')) return;
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = () => updateField('image', String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.model.trim() || !form.location.trim()) return;
    let image = form.image;
    if (selectedImageFile && onUploadImage) {
      const uploadedImage = await onUploadImage(equipment.id, selectedImageFile);
      if (!uploadedImage) {
        window.alert('장비 이미지 업로드에 실패했습니다. 파일 형식 또는 용량을 확인해 주세요.');
        return;
      }
      image = uploadedImage;
    }
    await onSave({
      ...(mode === 'create' ? { id: equipment.id } : {}),
      name: form.name.trim(),
      model: form.model.trim(),
      location: form.location.trim(),
      group: form.group,
      groupName: form.group === 'process' ? '공정' : '검사·계측·패키징',
      category: form.group === 'process' ? '공정 장비' : '검사·계측·패키징 장비',
      status: form.status,
      image,
      description: form.description.trim(),
      managerId: form.managerId || undefined,
      vendorName: form.vendorName.trim() || undefined,
      vendorContactName: form.vendorContactName.trim() || undefined,
      vendorContactPosition: form.vendorContactPosition.trim() || undefined,
      vendorContactPhone: form.vendorContactPhone.trim() || undefined
    });
  }

  return (
    <div className="user-add-modal-backdrop" role="presentation">
      <form className="equipment-edit-modal" onSubmit={submit}>
        <div className="user-add-modal-head">
          <div>
            <p>Equipment Editor</p>
            <h3>{mode === 'create' ? '신규 장비 등록' : `${equipment.name} 수정`}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={mode === 'create' ? '장비 등록 닫기' : '장비 수정 닫기'}>×</button>
        </div>
        <div className="equipment-edit-grid">
          <label>
            장비명 <em>필수</em>
            <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
          </label>
          <label>
            모델명 <em>필수</em>
            <input value={form.model} onChange={(event) => updateField('model', event.target.value)} required />
          </label>
          <label>
            설치위치 <em>필수</em>
            <select value={form.location} onChange={(event) => updateField('location', event.target.value)} required>
              <option value="N11동 107호">N11동 107호</option>
              <option value="N11동 113호">N11동 113호</option>
            </select>
          </label>
          <label>
            장비 분류 <em>필수</em>
            <select value={form.group} onChange={(event) => updateField('group', event.target.value as EquipmentGroup)}>
              <option value="process">공정</option>
              <option value="metrology">검사·계측·패키징</option>
            </select>
          </label>
          <label>
            장비상태
            <select value={form.status} onChange={(event) => updateField('status', event.target.value as EquipmentStatus)}>
              <option value="available">이용가능</option>
              <option value="unavailable">이용불가</option>
            </select>
          </label>
          <label>
            담당자
            <select value={form.managerId} onChange={(event) => updateField('managerId', event.target.value)}>
              <option value="">담당자 미배정</option>
              {managerCandidates.map((user) => (
                <option key={user.id} value={user.id}>{user.name} · {user.department}</option>
              ))}
            </select>
          </label>
          <label className="is-wide">
            장비 설명 <span>선택 사항</span>
            <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="장비 용도, 교육 조건, 주의사항 등을 입력하세요." />
          </label>
          <div className="equipment-optional-info is-wide">
            <div className="equipment-optional-head">
              <p>Maintenance Vendor</p>
              <h4>유지보수 업체 추가 정보</h4>
              <span>선택 사항 · 구매사 및 유지보수 담당자 정보를 기록합니다.</span>
            </div>
            <div className="equipment-edit-grid is-nested">
              <label>
                구매사 <span>선택 사항</span>
                <input value={form.vendorName} onChange={(event) => updateField('vendorName', event.target.value)} placeholder="예: HB Tech Solution" />
              </label>
              <label>
                담당자명 <span>선택 사항</span>
                <input value={form.vendorContactName} onChange={(event) => updateField('vendorContactName', event.target.value)} placeholder="예: 홍길동" />
              </label>
              <label>
                직급 <span>선택 사항</span>
                <input value={form.vendorContactPosition} onChange={(event) => updateField('vendorContactPosition', event.target.value)} placeholder="예: 책임연구원 / 매니저" />
              </label>
              <label>
                연락처 <span>선택 사항</span>
                <input
                  inputMode="numeric"
                  value={form.vendorContactPhone}
                  onChange={(event) => updateField('vendorContactPhone', formatPhoneNumber(event.target.value))}
                  placeholder="010-0000-0000"
                />
              </label>
            </div>
          </div>
          <label className="equipment-image-upload is-wide" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); loadImage(event.dataTransfer.files?.[0]); }}>
            <UploadCloud size={26} />
            <strong>장비 사진 업로드</strong>
            <span>선택 사항 · 권장 1200 × 675px · 파일 선택 또는 드래그 앤 드롭</span>
            <input type="file" accept="image/*" onChange={(event) => loadImage(event.target.files?.[0])} />
          </label>
          {form.image && <AuthenticatedImage className="equipment-edit-preview is-wide" src={form.image} alt={`${form.name} 미리보기`} />}
        </div>
        <div className="user-add-modal-actions">
          <button type="button" className="is-cancel" onClick={onClose}>취소</button>
          <button type="submit" className="is-primary">{mode === 'create' ? '장비 등록' : '저장'}</button>
        </div>
      </form>
    </div>
  );
}

function EquipmentSelectionDeleteModal({
  items,
  onCancel,
  onConfirm
}: {
  items: EquipmentItem[];
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <div className="user-add-modal-backdrop" role="presentation">
      <div className="equipment-delete-confirm-modal" role="dialog" aria-modal="true" aria-label="선택 장비 삭제 확인">
        <div className="user-add-modal-head">
          <div>
            <p>Delete Equipment</p>
            <h3>선택 장비 삭제</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="선택 장비 삭제 닫기">×</button>
        </div>
        <p className="equipment-delete-warning">
          선택한 {items.length}개 장비를 장비관리 목록에서 삭제합니다. 삭제된 장비는 현재 운영 목록과 예약 선택 목록에서 제외됩니다.
        </p>
        <div className="equipment-delete-list" aria-label="삭제 대상 장비 목록">
          {items.map((item) => (
            <div key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.model ?? '-'} · {item.location}</span>
            </div>
          ))}
        </div>
        <div className="user-add-modal-actions">
          <button type="button" className="is-cancel" onClick={onCancel}>취소</button>
          <button type="button" className="is-danger" onClick={onConfirm}>삭제 확정</button>
        </div>
      </div>
    </div>
  );
}

function ManagerPermissionGrantPage({
  users,
  equipmentItems,
  permissions,
  permissionGrantMeta,
  currentUser,
  sessionRole,
  onGrantPermission
}: {
  users: ManagedUser[];
  equipmentItems: EquipmentItem[];
  permissions: EquipmentPermissionMap;
  permissionGrantMeta: EquipmentPermissionGrantMetaMap;
  currentUser: ManagedUser | null;
  sessionRole: Role | null;
  onGrantPermission: (userId: string, equipmentId: string) => Promise<boolean>;
}) {
  const manageableEquipment = useMemo(() => (
    sessionRole === 'ADMIN'
      ? equipmentItems
      : currentUser
        ? equipmentItems.filter((item) => item.managerId === currentUser.id)
        : []
  ), [currentUser, equipmentItems, sessionRole]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(manageableEquipment[0]?.id ?? '');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pendingGrant, setPendingGrant] = useState<{ user: ManagedUser; equipment: EquipmentItem } | null>(null);
  const selectedEquipment = manageableEquipment.find((item) => item.id === selectedEquipmentId) ?? manageableEquipment[0];

  useEffect(() => {
    if (!selectedEquipmentId && manageableEquipment[0]) {
      setSelectedEquipmentId(manageableEquipment[0].id);
    }
    if (selectedEquipmentId && !manageableEquipment.some((item) => item.id === selectedEquipmentId)) {
      setSelectedEquipmentId(manageableEquipment[0]?.id ?? '');
    }
  }, [manageableEquipment, selectedEquipmentId]);

  const grantedUsers = selectedEquipment
    ? users.filter((user) => permissions[user.id]?.includes(selectedEquipment.id))
    : [];
  const grantableUsers = selectedEquipment
    ? users.filter((user) => !permissions[user.id]?.includes(selectedEquipment.id))
    : [];

  function requestGrantPermission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEquipment || !selectedUserId) return;
    const targetUser = users.find((user) => user.id === selectedUserId);
    if (!targetUser) return;
    setPendingGrant({ user: targetUser, equipment: selectedEquipment });
  }

  async function confirmGrantPermission() {
    if (!pendingGrant) return;
    const saved = await onGrantPermission(pendingGrant.user.id, pendingGrant.equipment.id);
    if (saved) {
      setSelectedUserId('');
      setPendingGrant(null);
    }
  }

  if (manageableEquipment.length === 0) {
    return (
      <section className="manager-permission-page">
        <div className="manager-permission-empty">
          <LockKeyhole size={32} />
          <p>Assigned Permission</p>
          <h2>사용권한을 부여할 담당 장비가 없습니다.</h2>
          <span>관리자가 장비관리에서 담당자로 배정하면 이 메뉴에서 해당 장비 권한을 부여할 수 있습니다.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="manager-permission-page">
      <div className="consumables-hero">
        <div>
          <p className="consumables-eyebrow">Assigned Permission</p>
          <h2>사용권한부여(담당)</h2>
          <span>담당 장비에 한하여 사용자에게 장비 사용 권한을 추가할 수 있습니다. 권한 삭제는 관리자 권한관리에서만 가능합니다.</span>
        </div>
      </div>

      <div className="manager-permission-layout">
        <aside className="manager-equipment-panel">
          <div className="manager-panel-head">
            <p>Managed Equipment</p>
            <h3>담당 장비</h3>
          </div>
          <div className="manager-equipment-list">
            {manageableEquipment.map((item) => {
              const grantedCount = users.filter((user) => permissions[user.id]?.includes(item.id)).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`manager-equipment-button ${selectedEquipment?.id === item.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedEquipmentId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span>{item.groupName} · {item.location}</span>
                  <em>{grantedCount}명 권한 보유</em>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="manager-grant-panel">
          <div className="manager-panel-head">
            <p>Grant Permission</p>
            <h3>{selectedEquipment?.name ?? '장비'} 사용권한</h3>
          </div>
          <form className="manager-grant-form" onSubmit={requestGrantPermission}>
            <label>
              권한 부여 대상
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                <option value="">사용자 선택</option>
                {grantableUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} · {user.department}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={!selectedUserId}>
              <Plus size={16} /> 권한 부여
            </button>
          </form>

          <div className="manager-granted-list">
            <div className="manager-panel-head is-compact">
              <p>Granted Users</p>
              <h3>권한 보유 사용자</h3>
            </div>
            {grantedUsers.length > 0 ? (
              grantedUsers.map((user) => {
                const grantedAt = selectedEquipment
                  ? permissionGrantMeta[getPermissionGrantKey(user.id, selectedEquipment.id)]?.grantedAt
                  : null;
                return (
                <div key={user.id} className="manager-granted-row">
                  <div>
                    <strong>{user.name}</strong>
                    <span className="manager-granted-date">권한 부여일시 {grantedAt ? formatSeoulDateTime(grantedAt) : '기존 부여 권한'}</span>
                    <span>{user.department} · {formatProfessorLab(user.labProfessor)}</span>
                  </div>
                  <span className="permission-grant-count is-granted">부여됨</span>
                </div>
                );
              })
            ) : (
              <p className="permission-empty-row">아직 권한이 부여된 사용자가 없습니다.</p>
            )}
          </div>
        </div>
      </div>
      {pendingGrant && (
        <div className="user-add-modal-backdrop" role="presentation">
          <section className="manager-grant-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="manager-grant-confirm-title">
            <div className="user-add-modal-head">
              <div>
                <p>Permission Confirm</p>
                <h3 id="manager-grant-confirm-title">사용권한 부여 확인</h3>
              </div>
              <button type="button" onClick={() => setPendingGrant(null)} aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <div className="manager-grant-confirm-body">
              <p>아래 사용자에게 담당 장비 사용권한을 부여합니다. 권한 삭제는 관리자 권한관리에서만 가능합니다.</p>
              <div className="manager-grant-confirm-grid">
                <div>
                  <span>사용자</span>
                  <strong>{pendingGrant.user.name}</strong>
                </div>
                <div>
                  <span>소속</span>
                  <strong>{pendingGrant.user.department}</strong>
                </div>
                <div>
                  <span>장비</span>
                  <strong>{pendingGrant.equipment.name}</strong>
                </div>
                <div>
                  <span>설치 위치</span>
                  <strong>{pendingGrant.equipment.location}</strong>
                </div>
              </div>
            </div>
            <div className="user-add-modal-actions">
              <button type="button" className="is-cancel" onClick={() => setPendingGrant(null)}>취소</button>
              <button type="button" className="is-primary" onClick={confirmGrantPermission}>권한 부여 확정</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function PermissionManagementPage({
  users,
  equipmentItems,
  permissions,
  managerUserIds,
  onSavePermissions
}: {
  users: ManagedUser[];
  equipmentItems: EquipmentItem[];
  permissions: EquipmentPermissionMap;
  managerUserIds: Set<string>;
  onSavePermissions: (userId: string, equipmentIds: string[]) => Promise<boolean>;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('전체');
  const [departmentFilter, setDepartmentFilter] = useState('전체');
  const [labFilter, setLabFilter] = useState('전체');
  const [permissionFilter, setPermissionFilter] = useState('전체');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const departments = useMemo(() => ['전체', ...Array.from(new Set(users.map((user) => user.department).filter(Boolean)))], [users]);
  const labs = useMemo(() => ['전체', ...Array.from(new Set(users.map((user) => user.labProfessor).filter(Boolean)))], [users]);
  const filteredUsers = useMemo(() => (
    users.filter((user) => {
      const effectiveRoles = getPermissionRoleLevels(user, managerUserIds);
      const keyword = searchTerm.trim().toLowerCase();
      const nameKeyword = nameFilter.trim().toLowerCase();
      const grantedCount = permissions[user.id]?.length ?? 0;
      const matchesSearch = !keyword || `${user.name} ${user.department} ${user.labProfessor} ${effectiveRoles.join(' ')} ${grantedCount}`.toLowerCase().includes(keyword);
      const matchesName = !nameKeyword || user.name.toLowerCase().includes(nameKeyword);
      const matchesRole = roleFilter === '전체' || effectiveRoles.includes(roleFilter as PermissionRoleLevel);
      const matchesDepartment = departmentFilter === '전체' || user.department === departmentFilter;
      const matchesLab = labFilter === '전체' || user.labProfessor === labFilter;
      const matchesPermission = permissionFilter === '전체'
        || (permissionFilter === '부여' && grantedCount > 0)
        || (permissionFilter === '미부여' && grantedCount === 0);
      return matchesSearch && matchesName && matchesRole && matchesDepartment && matchesLab && matchesPermission;
    })
  ), [departmentFilter, labFilter, managerUserIds, nameFilter, permissionFilter, permissions, roleFilter, searchTerm, users]);
  const grantedUsers = users.filter((user) => (permissions[user.id]?.length ?? 0) > 0).length;
  const totalGranted = users.reduce((sum, user) => sum + (permissions[user.id]?.length ?? 0), 0);
  const totalPages = Math.max(Math.ceil(filteredUsers.length / pageSize), 1);
  const pageStart = (currentPage - 1) * pageSize;
  const pageUsers = filteredUsers.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [departmentFilter, labFilter, nameFilter, pageSize, permissionFilter, roleFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <section className="permission-page">
      <div className="consumables-hero">
        <div>
          <p className="consumables-eyebrow">Equipment Permission</p>
          <h2>권한 관리</h2>
          <span>사용자관리 데이터를 기준으로 장비 예약 권한을 빠르게 조회하고 개별 부여합니다.</span>
        </div>
      </div>

      <div className="permission-summary-grid">
        <div>
          <span>관리 사용자</span>
          <strong>{users.length}</strong>
          <em>registered users</em>
        </div>
        <div>
          <span>권한 보유자</span>
          <strong>{grantedUsers}</strong>
          <em>users with grants</em>
        </div>
        <div>
          <span>총 부여 권한</span>
          <strong>{totalGranted}</strong>
          <em>equipment grants</em>
        </div>
        <div>
          <span>보유 장비</span>
          <strong>{equipmentItems.length}</strong>
          <em>equipment list</em>
        </div>
      </div>

      <div className="consumables-toolbar permission-toolbar">
        <div className="consumables-search">
          <Search size={17} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="이름, 학과, 연구실 검색"
            aria-label="권한 사용자 검색"
          />
        </div>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="권한 ROLE 필터">
          <option value="전체">전체 ROLE</option>
          {permissionRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <select value={labFilter} onChange={(event) => setLabFilter(event.target.value)} aria-label="권한 연구실 필터">
          {labs.map((lab) => (
            <option key={lab} value={lab}>{lab === '전체' ? '전체 연구실' : formatProfessorLab(lab)}</option>
          ))}
        </select>
        <label className="permission-page-size-control">
          <span>표시 인원</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="페이지당 표시 인원">
            <option value={20}>20명</option>
            <option value={30}>30명</option>
            <option value={50}>50명</option>
          </select>
        </label>
      </div>

      <div className="consumables-table-wrap permission-table-wrap">
        <table className="consumables-table users-table permission-table">
          <colgroup>
            <col className="user-col-index" />
            <col className="user-col-name" />
            <col className="user-col-role" />
            <col className="user-col-department" />
            <col className="user-col-lab" />
            <col className="permission-col-grants" />
            <col className="permission-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th>연번</th>
              <th>이름</th>
              <th>ROLE</th>
              <th>소속 학과</th>
              <th>지도교수명</th>
              <th>권한</th>
              <th>관리</th>
            </tr>
            <tr className="users-table-filter-row">
              <th />
              <th>
                <input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="이름 필터" aria-label="권한관리 이름 필터" />
              </th>
              <th>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="권한관리 ROLE 필터">
                  <option value="전체">전체</option>
                  {permissionRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </th>
              <th>
                <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="권한관리 학과 필터">
                  {departments.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </th>
              <th>
                <select value={labFilter} onChange={(event) => setLabFilter(event.target.value)} aria-label="권한관리 연구실 필터">
                  {labs.map((lab) => (
                    <option key={lab} value={lab}>{lab === '전체' ? '전체' : formatProfessorLab(lab)}</option>
                  ))}
                </select>
              </th>
              <th>
                <select value={permissionFilter} onChange={(event) => setPermissionFilter(event.target.value)} aria-label="권한 부여 상태 필터">
                  <option value="전체">전체</option>
                  <option value="부여">부여</option>
                  <option value="미부여">미부여</option>
                </select>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((user, index) => {
              const grantCount = permissions[user.id]?.length ?? 0;
              const labTone = getProfessorTone(user.labProfessor);
              const rowIndex = pageStart + index + 1;
              const effectiveRoles = getPermissionRoleLevels(user, managerUserIds);
              return (
                <tr key={user.id} className="permission-table-row" onClick={() => setSelectedUser(user)}>
                  <td>{rowIndex}</td>
                  <td><span className="permission-user-pill">{user.name}</span></td>
                  <td>
                    <span className="permission-role-stack">
                      {effectiveRoles.map((role) => (
                        <span key={role} className={`permission-role-badge ${getRoleToneClass(role)}`}>{role}</span>
                      ))}
                    </span>
                  </td>
                  <td><span className="permission-user-pill is-wide">{user.department}</span></td>
                  <td>
                    <span className="user-lab-input permission-lab-pill">
                      <i style={{ backgroundColor: labTone, color: labTone }} />
                      <span style={{ borderColor: `${labTone}88`, backgroundColor: `${labTone}22` }}>{formatProfessorLab(user.labProfessor)}</span>
                    </span>
                  </td>
                  <td><span className={`permission-grant-count ${grantCount > 0 ? 'is-granted' : 'is-empty'}`}>{grantCount} / {equipmentItems.length}</span></td>
                  <td>
                    <button type="button" className="permission-manage-button" onClick={(event) => { event.stopPropagation(); setSelectedUser(user); }}>
                      권한 관리
                    </button>
                  </td>
                </tr>
              );
            })}
            {pageUsers.length === 0 && (
              <tr>
                <td colSpan={7} className="permission-empty-row">조건에 맞는 사용자가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="permission-pagination" aria-label="권한관리 페이지 이동">
        <span>{filteredUsers.length === 0 ? '0명' : `${pageStart + 1}-${Math.min(pageStart + pageSize, filteredUsers.length)}명`} / 총 {filteredUsers.length}명</span>
        <div>
          <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>처음</button>
          <button type="button" onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} disabled={currentPage === 1}>이전</button>
          <strong>{currentPage} / {totalPages}</strong>
          <button type="button" onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))} disabled={currentPage === totalPages}>다음</button>
          <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>마지막</button>
        </div>
      </div>

      {selectedUser && (
        <PermissionModal
          user={selectedUser}
          equipmentItems={equipmentItems}
          effectiveRoles={getPermissionRoleLevels(selectedUser, managerUserIds)}
          grantedEquipmentIds={permissions[selectedUser.id] ?? []}
          onClose={() => setSelectedUser(null)}
          onSave={(equipmentIds) => onSavePermissions(selectedUser.id, equipmentIds)}
        />
      )}
    </section>
  );
}
function PermissionModal({
  user,
  equipmentItems,
  effectiveRoles,
  grantedEquipmentIds,
  onClose,
  onSave
}: {
  user: ManagedUser;
  equipmentItems: EquipmentItem[];
  effectiveRoles: PermissionRoleLevel[];
  grantedEquipmentIds: string[];
  onClose: () => void;
  onSave: (equipmentIds: string[]) => Promise<boolean>;
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(grantedEquipmentIds));
  const [saveFeedbackPhase, setSaveFeedbackPhase] = useState<'idle' | 'feedback' | 'returning'>('idle');
  const saveFeedbackTimers = useRef<number[]>([]);
  const processItems = equipmentItems.filter((item) => item.group === 'process');
  const metrologyItems = equipmentItems.filter((item) => item.group === 'metrology');

  function clearPermissionSaveFeedbackTimers() {
    saveFeedbackTimers.current.forEach((timer) => window.clearTimeout(timer));
    saveFeedbackTimers.current = [];
  }

  useEffect(() => () => clearPermissionSaveFeedbackTimers(), []);

  function toggleEquipment(equipmentId: string) {
    clearPermissionSaveFeedbackTimers();
    setSaveFeedbackPhase('idle');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(equipmentId)) {
        next.delete(equipmentId);
      } else {
        next.add(equipmentId);
      }
      return next;
    });
  }

  async function savePermissions() {
    clearPermissionSaveFeedbackTimers();
    setSaveFeedbackPhase('idle');
    const saved = await onSave(Array.from(selectedIds));
    if (!saved) return;
    window.requestAnimationFrame(() => setSaveFeedbackPhase('feedback'));
    saveFeedbackTimers.current = [
      window.setTimeout(() => setSaveFeedbackPhase('returning'), 2600),
      window.setTimeout(() => {
        setSaveFeedbackPhase('idle');
        saveFeedbackTimers.current = [];
      }, 3500)
    ];
  }

  function renderEquipmentGroup(title: string, items: EquipmentItem[]) {
    return (
      <div className="permission-equipment-group">
        <h4>{title}</h4>
        <div className="permission-equipment-list">
          {items.map((item) => {
            const checked = selectedIds.has(item.id);
            return (
              <label key={item.id} className={`permission-equipment-item ${checked ? 'is-granted' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleEquipment(item.id)} />
                <span>
                  <strong>{item.name}</strong>
                  <em>{item.groupName} · {item.location}</em>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="user-add-modal-backdrop" role="presentation">
      <section className="permission-modal" aria-label={`${user.name} 장비 권한 관리`}>
        <div className="user-add-modal-head">
          <div>
            <p>Equipment Permission</p>
            <h3>{user.name} 권한 부여</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="권한 관리 닫기">×</button>
        </div>
        <div className="permission-modal-user">
          <span className="permission-role-stack">
            {effectiveRoles.map((role) => (
              <span key={role} className={`permission-role-badge ${getRoleToneClass(role)}`}>{role}</span>
            ))}
          </span>
          <strong>{user.department}</strong>
          <em>{formatProfessorLab(user.labProfessor)}</em>
          <small>{selectedIds.size} / {equipmentItems.length} 장비 권한 선택</small>
        </div>
        <div className="permission-modal-toolbar">
          <button type="button" onClick={() => setSelectedIds(new Set(equipmentItems.map((item) => item.id)))}>전체 부여</button>
          <button type="button" onClick={() => setSelectedIds(new Set())}>전체 해제</button>
        </div>
        <div className="permission-modal-body">
          {renderEquipmentGroup('공정 장비', processItems)}
          {renderEquipmentGroup('검사·계측·패키징 장비', metrologyItems)}
        </div>
        <div className="user-add-modal-actions permission-modal-actions">
          <button type="button" className="is-cancel" onClick={onClose}>닫기</button>
          <button
            type="button"
            className={`is-primary permission-save-button ${saveFeedbackPhase === 'feedback' ? 'is-save-feedback' : ''} ${saveFeedbackPhase === 'returning' ? 'is-save-returning' : ''}`}
            onClick={savePermissions}
          >
            <CheckCircle2 size={18} /> {saveFeedbackPhase === 'feedback' ? '저장완료!' : '저장'}
          </button>
        </div>
      </section>
    </div>
  );
}
function ConsumablesPage({
  month,
  consumables,
  saveFeedbackPhase,
  onMonthChange,
  onUpdateConsumable,
  onAddConsumable,
  onDeleteConsumable,
  onImportConsumables,
  onSave
}: {
  month: string;
  consumables: ConsumableItem[];
  saveFeedbackPhase: 'idle' | 'feedback' | 'returning';
  onMonthChange: (month: string) => void;
  onUpdateConsumable: (id: string, patch: Partial<ConsumableItem>) => void;
  onAddConsumable: () => void;
  onDeleteConsumable: (id: string) => void;
  onImportConsumables: (month: string, rows: ConsumableItem[]) => void;
  onSave: () => void;
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const categories = useMemo(() => ['전체', ...Array.from(new Set(consumables.map((item) => item.category)))], [consumables]);
  const filteredItems = useMemo(() => (
    consumables.filter((item) => {
      const matchesCategory = categoryFilter === '전체' || item.category === categoryFilter;
      const status = getConsumableStatus(item);
      const matchesStatus = statusFilter === '전체' || status.label === statusFilter;
      const keyword = searchTerm.trim().toLowerCase();
      const matchesSearch = !keyword || `${item.category} ${item.name} ${item.note}`.toLowerCase().includes(keyword);
      return matchesCategory && matchesStatus && matchesSearch;
    })
  ), [categoryFilter, consumables, searchTerm, statusFilter]);
  const shortageCount = consumables.filter((item) => getConsumableStatus(item).tone === 'danger').length;
  const warningCount = consumables.filter((item) => getConsumableStatus(item).tone === 'warning').length;

  function updateNumber(id: string, key: 'monthStart' | 'current' | 'minimum', value: string) {
    onUpdateConsumable(id, { [key]: Number(value) || 0 });
  }

  function handleConsumablesUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = parseConsumablesUpload(String(reader.result ?? ''));
        onImportConsumables(result.month || month, result.items);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : '소모품 엑셀 업로드에 실패했습니다.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  return (
    <section className="consumables-page">
      <div className="consumables-hero">
        <div>
          <p className="consumables-eyebrow">Inventory Control</p>
          <h2>소모품 관리</h2>
          <span>첨부 엑셀의 월별 재고 흐름을 기준으로 품목을 편집하고 월 단위 파일로 저장합니다.</span>
        </div>
        <div className="consumables-actions">
          <button type="button" onClick={() => downloadConsumablesExcel(month, consumables)} aria-label="소모품 현황 엑셀 다운로드">
            <Download size={17} /> Excel 다운로드
          </button>
          <input ref={uploadInputRef} type="file" accept=".xls,.html,.csv,.txt" onChange={handleConsumablesUpload} aria-label="소모품 엑셀 업로드 파일 선택" hidden />
          <button type="button" onClick={() => uploadInputRef.current?.click()} aria-label="소모품 엑셀 업로드">
            <UploadCloud size={17} /> Excel 업로드
          </button>
        </div>
      </div>

      <div className="consumables-summary-grid">
        <div>
          <span>전체 품목</span>
          <strong>{consumables.length}</strong>
          <em>items</em>
        </div>
        <div>
          <span>발주 필요</span>
          <strong>{shortageCount}</strong>
          <em>minimum 이하</em>
        </div>
        <div>
          <span>주의 품목</span>
          <strong>{warningCount}</strong>
          <em>기준 150% 이하</em>
        </div>
        <div className="consumables-summary-action">
          <span>데이터 저장</span>
          <button
            type="button"
            className={`is-primary ${saveFeedbackPhase === 'feedback' ? 'is-save-feedback' : ''} ${saveFeedbackPhase === 'returning' ? 'is-save-returning' : ''}`}
            onClick={onSave}
            aria-label="소모품 데이터 저장"
          >
            <CheckCircle2 size={18} /> {saveFeedbackPhase === 'feedback' ? '저장완료!' : '저장'}
          </button>
        </div>
        <div className="consumables-summary-action">
          <span>품목 관리</span>
          <button type="button" onClick={onAddConsumable} aria-label="소모품 신규 품목 추가">
            <Plus size={18} /> 품목 추가
          </button>
        </div>
      </div>

      <div className="consumables-toolbar">
        <div className="consumables-search">
          <Search size={17} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="품명, 분류, 메모 검색" aria-label="소모품 검색" />
        </div>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="소모품 분류 필터">
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="소모품 상태 필터">
          {['전체', '정상', '주의', '발주 필요'].map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <label className="consumables-month-control" aria-label="소모품 관리 월">
          <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} aria-label="소모품 관리 월 선택" />
        </label>
      </div>

      <div className="consumables-table-wrap">
        <table className="consumables-table">
          <thead>
            <tr>
              <th>상태</th>
              <th>분류</th>
              <th>품명</th>
              <th>단위/비고</th>
              <th>월초</th>
              <th>현재</th>
              <th>사용량</th>
              <th>최소 기준</th>
              <th>메모</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const status = getConsumableStatus(item);
              const used = Math.max(item.monthStart - item.current, 0);
              return (
                <tr key={item.id}>
                  <td><span className={`consumable-status is-${status.tone}`}>{status.label}</span></td>
                  <td><input value={item.category} onChange={(event) => onUpdateConsumable(item.id, { category: event.target.value })} aria-label={`${item.name} 분류`} /></td>
                  <td><input value={item.name} onChange={(event) => onUpdateConsumable(item.id, { name: event.target.value })} aria-label={`${item.name} 품명`} /></td>
                  <td><input value={item.unit} onChange={(event) => onUpdateConsumable(item.id, { unit: event.target.value })} aria-label={`${item.name} 단위`} /></td>
                  <td><input type="number" value={item.monthStart} onChange={(event) => updateNumber(item.id, 'monthStart', event.target.value)} aria-label={`${item.name} 월초 재고`} /></td>
                  <td><input type="number" value={item.current} onChange={(event) => updateNumber(item.id, 'current', event.target.value)} aria-label={`${item.name} 현재 재고`} /></td>
                  <td><strong>{used}</strong></td>
                  <td><input type="number" value={item.minimum} onChange={(event) => updateNumber(item.id, 'minimum', event.target.value)} aria-label={`${item.name} 최소 기준`} /></td>
                  <td><input value={item.note} onChange={(event) => onUpdateConsumable(item.id, { note: event.target.value })} aria-label={`${item.name} 메모`} /></td>
                  <td>
                    <button
                      type="button"
                      className="consumable-delete-button"
                      onClick={() => onDeleteConsumable(item.id)}
                      aria-label={`${item.name} 삭제`}
                    >
                      <Trash2 size={16} />
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const equipmentCategoryCardMeta: Record<EquipmentGroup, {
  accent: string;
  headBg: string;
  href: string;
  icon: typeof Cpu;
}> = {
  process: {
    accent: '125,179,240',
    headBg: '#16263F',
    href: '/equipment?category=process',
    icon: Cpu
  },
  metrology: {
    accent: '82,224,176',
    headBg: '#10322C',
    href: '/equipment?category=metrology',
    icon: Microscope
  }
};

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
  const dashboardMetrics = useDashboardMetrics();
  const [activePage, setActivePage] = useState<PageKey>(() => getPageFromBrowserUrl());
  const [loading, setLoading] = useState(false);
  const [globalAccessNotice, setGlobalAccessNotice] = useState<AccessRequirementNotice | null>(null);
  const [initialGroup, setInitialGroup] = useState<EquipmentGroup>('process');
  const [deletedEquipmentIds, setDeletedEquipmentIds] = useState<string[]>([]);
  const [selectedConsumableMonth, setSelectedConsumableMonth] = useState('2026-06');
  const [monthlyConsumables, setMonthlyConsumables] = useState<Record<string, ConsumableItem[]>>({ '2026-06': [] });
  const [consumablesUpdatedAt, setConsumablesUpdatedAt] = useState(() => (
    new Date().toISOString()
  ));
  const [hasUnsavedConsumables, setHasUnsavedConsumables] = useState(false);
  const [saveFeedbackPhase, setSaveFeedbackPhase] = useState<'idle' | 'feedback' | 'returning'>('idle');
  const saveFeedbackTimers = useRef<number[]>([]);
  const [userSaveFeedbackPhase, setUserSaveFeedbackPhase] = useState<'idle' | 'feedback' | 'returning'>('idle');
  const userSaveFeedbackTimers = useRef<number[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [usersUpdatedAt, setUsersUpdatedAt] = useState(() => (
    localStorage.getItem(STORAGE_KEYS.usersUpdatedAt) ?? new Date().toISOString()
  ));
  const [managedOperationNotices, setManagedOperationNotices] = useState<NoticeItem[]>(() => normalizeNoticeItems(operationNoticeItems));
  const [managedMeetingNotices, setManagedMeetingNotices] = useState<NoticeItem[]>(() => normalizeNoticeItems(meetingNoticeItems));
  const [managedFaqItems, setManagedFaqItems] = useState<FaqItem[]>(initialFaqItems);
  const [equipmentPermissions, setEquipmentPermissions] = useState<EquipmentPermissionMap>({});
  const [equipmentPermissionGrantMeta, setEquipmentPermissionGrantMeta] = useState<EquipmentPermissionGrantMetaMap>({});
  const [, setEquipmentPermissionHistory] = useState<EquipmentPermissionHistoryRecord[]>([]);
  const [sessionRole, setSessionRole] = useState<Role | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.sessionUser);
    if (!stored) return null;
    try {
      return JSON.parse(stored).role ?? null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const currentPage = getPageFromBrowserUrl();
    window.history.replaceState({ page: currentPage }, '', getPageUrl(currentPage));

    function handlePopState() {
      setLoading(false);
      setActivePage(getPageFromBrowserUrl());
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
    if (!token) return;

    let isMounted = true;
    void apiGet<GoogleAuthResponse>('/auth/me', token).then((session) => {
      if (!isMounted) return;
      if (!session?.user || !session.token) {
        localStorage.removeItem(STORAGE_KEYS.sessionToken);
        localStorage.removeItem(STORAGE_KEYS.sessionUser);
        setSessionRole(null);
        setEquipmentPermissions({});
        setEquipmentPermissionGrantMeta({});
        setEquipmentPermissionHistory([]);
        setTrainingRequests([]);
        setPenaltyRecords([]);
        return;
      }

      localStorage.setItem(STORAGE_KEYS.sessionToken, session.token);
      localStorage.setItem(STORAGE_KEYS.sessionUser, JSON.stringify(session.user));
      if (session.managedUser) registerAuthenticatedUser(session.managedUser);
      setSessionRole(session.user.role ?? 'USER');
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const [reservationEvents, setReservationEvents] = useState<ReservationEvent[]>([]);
  const [trainingRequests, setTrainingRequests] = useState<ApiTrainingRequest[]>([]);
  const [penaltyRecords, setPenaltyRecords] = useState<PenaltyRecord[]>([]);
  const [showPenaltyNotice, setShowPenaltyNotice] = useState(false);
  const [showPreviewPenaltyDemo, setShowPreviewPenaltyDemo] = useState(false);
  const sessionUser = getStoredSessionUser();
  const sessionUserName = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.sessionUser);
      return stored ? JSON.parse(stored).name ?? 'USER NAME' : 'USER NAME';
    } catch {
      return 'USER NAME';
    }
  })();
  const activeSessionPenalty = useMemo(
    () => getActivePenaltyForSession(sessionUser, managedUsers, penaltyRecords),
    [sessionRole, managedUsers, penaltyRecords]
  );
  const previewPenaltyDemo = useMemo<PenaltyRecord>(() => {
    const startsAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    return {
      id: 'preview-penalty-demo',
      userId: 'preview-demo-user',
      userName: '프리뷰 사용자',
      userEmail: 'preview-user@hbnu.local',
      type: '1주 사용정지',
      category: '안전관련',
      reason: '프리뷰 테스트: 안전수칙 미준수로 장비 예약 기능이 1주간 제한된 예시입니다.',
      startsAt,
      endsAt: getPenaltyEndsAt('1주 사용정지', startsAt),
      createdAt: startsAt
    };
  }, []);

  useEffect(() => {
    if (sessionRole && sessionRole !== 'ADMIN' && activeSessionPenalty) {
      setShowPenaltyNotice(true);
    }
  }, [sessionRole, activeSessionPenalty?.id]);

  useEffect(() => {
    if (sessionRole !== 'ADMIN' && adminOnlyPages.has(activePage)) {
      window.history.replaceState({ page: 'home' }, '', getPageUrl('home'));
      setActivePage('home');
    }
  }, [activePage, sessionRole]);

  useEffect(() => {
    if (sessionRole || !['reservations', 'training', 'mypage'].includes(activePage)) return;
    const notice = activePage === 'reservations'
      ? {
        title: '로그인이 필요합니다.',
        message: '장비사용예약은 로그인한 사용자만 이용할 수 있습니다.',
        detail: '비로그인 방문자는 장비현황과 공지사항을 읽기 전용으로 확인할 수 있으며, 예약 신청은 Google 본인인증 후 가능합니다.'
      }
      : activePage === 'training'
        ? {
          title: '로그인이 필요합니다.',
          message: '교육신청은 로그인한 사용자만 신청할 수 있습니다.',
          detail: '비로그인 방문자는 교육신청 화면에 진입할 수 없으며, 로그인 후 회원정보 등록을 마치면 장비 담당자에게 교육을 요청할 수 있습니다.'
        }
        : {
          title: '로그인이 필요합니다.',
          message: '마이페이지는 로그인 후 이용할 수 있습니다.',
          detail: '비로그인 방문자는 공지사항, 센터소개, 장비현황, FAQ/Q&A 목록만 읽기 전용으로 확인할 수 있습니다.'
        };
    window.history.replaceState({ page: 'home' }, '', getPageUrl('home'));
    setActivePage('home');
    setGlobalAccessNotice({
      ...notice,
      primaryLabel: '로그인하기',
      onPrimary: () => navigate('login')
    });
  }, [activePage, sessionRole]);

  useEffect(() => {
    let isMounted = true;
    void apiGet<NoticeItem[]>('/notices?board=operation').then((items) => {
      if (isMounted && items) {
        const next = normalizeNoticeItems(items);
        setManagedOperationNotices(next);
      }
    });
    void apiGet<NoticeItem[]>('/notices?board=meeting').then((items) => {
      if (isMounted && items) {
        const next = normalizeNoticeItems(items);
        setManagedMeetingNotices(next);
      }
    });
    void apiGet<FaqItem[]>('/faqs').then((items) => {
      if (isMounted && items) {
        setManagedFaqItems(items);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (sessionRole !== 'ADMIN') return;
    let isMounted = true;
    void apiGet<ManagedUser[]>('/users', localStorage.getItem(STORAGE_KEYS.sessionToken)).then((items) => {
      if (!isMounted || !items?.length) return;
      const next = normalizeManagedUsers(items);
      setManagedUsers(next);
      localStorage.setItem(STORAGE_KEYS.managedUsers, JSON.stringify(next));
    });
    return () => {
      isMounted = false;
    };
  }, [sessionRole]);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
    setEquipmentPermissions({});
    setEquipmentPermissionGrantMeta({});
    setEquipmentPermissionHistory([]);
    localStorage.removeItem(STORAGE_KEYS.equipmentPermissions);
    localStorage.removeItem(STORAGE_KEYS.equipmentPermissionGrantMeta);
    localStorage.removeItem(STORAGE_KEYS.equipmentPermissionHistory);
    if (!token || !sessionRole) return;
    let isMounted = true;
    void apiGet<EquipmentPermissionSnapshot>('/equipment-permissions', token).then((snapshot) => {
      if (isMounted && snapshot) applyEquipmentPermissionSnapshot(snapshot);
    });
    return () => {
      isMounted = false;
    };
  }, [sessionRole]);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
    if (!token || !sessionRole) {
      setReservationEvents([]);
      return;
    }
    let isMounted = true;
    void apiGet<ApiReservationEvent[]>('/reservations', token).then((items) => {
      if (!isMounted || !items) return;
      setReservationEvents(items.map(normalizeApiReservation));
    });
    return () => {
      isMounted = false;
    };
  }, [sessionRole, equipmentItems]);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
    if (!token || !sessionRole) {
      setTrainingRequests([]);
      return;
    }
    let isMounted = true;
    void apiGet<ApiTrainingRequest[]>('/training-requests', token).then((items) => {
      if (isMounted && items) setTrainingRequests(items);
    });
    return () => {
      isMounted = false;
    };
  }, [sessionRole]);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
    if (!token || !sessionRole) {
      setPenaltyRecords([]);
      return;
    }
    let isMounted = true;
    void apiGet<PenaltyRecord[]>('/penalties', token).then((items) => {
      if (isMounted && items) setPenaltyRecords(items);
    });
    return () => {
      isMounted = false;
    };
  }, [sessionRole]);

  useEffect(() => {
    if (sessionRole !== 'ADMIN') return;
    let isMounted = true;
    const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
    void apiGet<ConsumableItem[]>(
      `/consumables?month=${encodeURIComponent(selectedConsumableMonth)}`,
      token
    ).then((items) => {
      if (!isMounted || !items) return;
      setMonthlyConsumables((current) => ({ ...current, [selectedConsumableMonth]: items }));
      setConsumablesUpdatedAt(new Date().toISOString());
      setHasUnsavedConsumables(false);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedConsumableMonth, sessionRole]);

  function navigate(page: PageKey) {
    if (adminOnlyPages.has(page) && sessionRole !== 'ADMIN') {
      window.history.replaceState({ page: 'home' }, '', getPageUrl('home'));
      setActivePage('home');
      return;
    }
    if (!sessionRole && page === 'reservations') {
      setGlobalAccessNotice({
        title: '로그인이 필요합니다.',
        message: '장비사용예약은 로그인한 사용자만 이용할 수 있습니다.',
        detail: '비로그인 방문자는 장비현황과 공지사항을 읽기 전용으로 확인할 수 있으며, 예약 신청은 Google 본인인증 후 가능합니다.',
        primaryLabel: '로그인하기',
        onPrimary: () => navigate('login')
      });
      return;
    }
    if (!sessionRole && page === 'training') {
      setGlobalAccessNotice({
        title: '로그인이 필요합니다.',
        message: '교육신청은 로그인한 사용자만 신청할 수 있습니다.',
        detail: '비로그인 방문자는 교육신청 화면에 진입할 수 없으며, 로그인 후 회원정보 등록을 마치면 장비 담당자에게 교육을 요청할 수 있습니다.',
        primaryLabel: '로그인하기',
        onPrimary: () => navigate('login')
      });
      return;
    }
    if (!sessionRole && page === 'mypage') {
      setGlobalAccessNotice({
        title: '로그인이 필요합니다.',
        message: '마이페이지는 로그인 후 이용할 수 있습니다.',
        detail: '비로그인 방문자는 공지사항, 센터소개, 장비현황, FAQ/Q&A 목록만 읽기 전용으로 확인할 수 있습니다.',
        primaryLabel: '로그인하기',
        onPrimary: () => navigate('login')
      });
      return;
    }
    if (page === 'reservations' && sessionRole !== 'ADMIN' && activeSessionPenalty) {
      setShowPenaltyNotice(true);
      return;
    }
    if (page === activePage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setLoading(true);
    window.setTimeout(() => {
      setActivePage(page);
      window.history.pushState({ page }, '', getPageUrl(page));
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 520);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEYS.sessionToken);
    localStorage.removeItem(STORAGE_KEYS.sessionUser);
    localStorage.removeItem(STORAGE_KEYS.equipmentPermissions);
    localStorage.removeItem(STORAGE_KEYS.equipmentPermissionGrantMeta);
    localStorage.removeItem(STORAGE_KEYS.equipmentPermissionHistory);
    setSessionRole(null);
    setEquipmentPermissions({});
    setEquipmentPermissionGrantMeta({});
    setEquipmentPermissionHistory([]);
    setTrainingRequests([]);
    setPenaltyRecords([]);
    navigate('login');
  }

  function openEquipment(group: EquipmentGroup) {
    setInitialGroup(group);
    navigate('equipment');
  }

  async function uploadFileAsset(input: {
    ownerType: FileAsset['ownerType'];
    ownerId: string;
    purpose: string;
    file: File;
  }) {
    const dataBase64 = await readFileAsBase64(input.file);
    return apiPost<FileAsset>('/file-assets/upload', {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      purpose: input.purpose,
      fileName: input.file.name,
      contentType: input.file.type || 'application/octet-stream',
      dataBase64
    }, localStorage.getItem(STORAGE_KEYS.sessionToken));
  }

  async function uploadNoticeAttachments(noticeId: string, files: FileList | null): Promise<NoticeAttachment[]> {
    if (!files?.length) return [];
    const assets = await Promise.all(Array.from(files).map((file) => (
      uploadFileAsset({ ownerType: 'notice', ownerId: noticeId, purpose: 'attachment', file })
    )));
    if (assets.some((asset) => !asset)) {
      throw new Error('Notice attachment upload failed');
    }
    return (assets.filter(Boolean) as FileAsset[]).map((asset) => ({
      id: asset.id,
      name: asset.fileName,
      size: asset.byteSize,
      type: asset.contentType,
      dataUrl: toFileAssetDownloadUrl(asset),
      uploadedAt: asset.createdAt
    }));
  }

  async function deleteNoticeAttachment(attachment: NoticeAttachment) {
    if (!attachment.id.startsWith('file-')) return;
    const deletedAsset = await apiDelete<FileAsset>(
      `/file-assets/${encodeURIComponent(attachment.id)}`,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
    if (!deletedAsset) throw new Error('Notice attachment delete failed');
  }

  async function uploadEquipmentImage(equipmentId: string, file: File) {
    const asset = await uploadFileAsset({
      ownerType: 'equipment',
      ownerId: equipmentId,
      purpose: 'image',
      file
    });
    return asset ? toFileAssetDownloadUrl(asset) : null;
  }

  async function addEquipment(item: EquipmentItem) {
    const savedItem = await apiPost<ApiEquipmentItem>(
      '/equipment',
      toApiEquipmentPayload(item),
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
    if (!savedItem) {
      window.alert('장비 등록에 실패했습니다. 입력값 또는 관리자 권한을 확인해 주세요.');
      return false;
    }
    setEquipmentItems((current) => [...current, normalizeEquipment(savedItem, current.length)]);
    return true;
  }

  async function deleteEquipment(equipmentId: string) {
    const deletedItem = await apiDelete<ApiEquipmentItem>(
      `/equipment/${encodeURIComponent(equipmentId)}`,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
    if (!deletedItem) {
      window.alert('장비 삭제에 실패했습니다. 관리자 권한 또는 장비 상태를 확인해 주세요.');
      return false;
    }
    setDeletedEquipmentIds((current) => current.includes(equipmentId) ? current : [...current, equipmentId]);
    return true;
  }

  async function updateEquipment(equipmentId: string, patch: Partial<EquipmentItem>) {
    const savedItem = await apiPatch<ApiEquipmentItem>(
      `/equipment/${encodeURIComponent(equipmentId)}`,
      toApiEquipmentPayload(patch),
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
    if (!savedItem) {
      window.alert('장비 수정에 실패했습니다. 입력값 또는 관리자 권한을 확인해 주세요.');
      return false;
    }
    setEquipmentItems((current) => current.map((item, index) => (
      item.id === equipmentId ? normalizeEquipment(savedItem, index) : item
    )));
    return true;
  }

  function updateNoticeBoard(board: NoticeBoardKey, updater: (items: NoticeItem[]) => NoticeItem[]) {
    const setItems = board === 'operation' ? setManagedOperationNotices : setManagedMeetingNotices;
    setItems((current) => {
      const next = normalizeNoticeItems(updater(current));
      return next;
    });
  }

  function addNotice(board: NoticeBoardKey, item: NoticeItem) {
    void apiPost<NoticeItem>('/notices', {
      ...item,
      board
    }, localStorage.getItem(STORAGE_KEYS.sessionToken)).then((savedNotice) => {
      if (!savedNotice) {
        window.alert('공지 저장에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      updateNoticeBoard(board, (current) => [savedNotice, ...current.filter((notice) => notice.id !== savedNotice.id)]);
    });
  }

  function updateNotice(board: NoticeBoardKey, noticeId: string, patch: Partial<NoticeItem>) {
    void apiPatch<NoticeItem>(
      `/notices/${encodeURIComponent(noticeId)}`,
      patch,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    ).then((savedNotice) => {
      if (!savedNotice) {
        window.alert('공지 수정에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      updateNoticeBoard(board, (current) => current.map((item) => (
        item.id === noticeId ? savedNotice : item
      )));
    });
  }

  function deleteNotice(board: NoticeBoardKey, noticeId: string) {
    void apiDelete<NoticeItem>(
      `/notices/${encodeURIComponent(noticeId)}`,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    ).then((deletedNotice) => {
      if (!deletedNotice) {
        window.alert('공지 삭제에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      updateNoticeBoard(board, (current) => current.filter((item) => item.id !== noticeId));
    });
  }

  function updateFaqItems(updater: (items: FaqItem[]) => FaqItem[]) {
    setManagedFaqItems((current) => {
      const next = updater(current);
      return next;
    });
  }

  function addFaq(item: FaqItem) {
    void apiPost<FaqItem>('/faqs', item, localStorage.getItem(STORAGE_KEYS.sessionToken)).then((savedFaq) => {
      if (!savedFaq) {
        window.alert('FAQ 저장에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      updateFaqItems((current) => [savedFaq, ...current.filter((faq) => faq.id !== savedFaq.id)]);
    });
  }

  function updateFaq(faqId: string, patch: Partial<FaqItem>) {
    void apiPatch<FaqItem>(
      `/faqs/${encodeURIComponent(faqId)}`,
      patch,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    ).then((savedFaq) => {
      if (!savedFaq) {
        window.alert('FAQ 수정에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      updateFaqItems((current) => current.map((item) => (
        item.id === faqId ? savedFaq : item
      )));
    });
  }

  function deleteFaq(faqId: string) {
    void apiDelete<FaqItem>(
      `/faqs/${encodeURIComponent(faqId)}`,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    ).then((deletedFaq) => {
      if (!deletedFaq) {
        window.alert('FAQ 삭제에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      updateFaqItems((current) => current.filter((item) => item.id !== faqId));
    });
  }

  function upsertTrainingRequest(request: ApiTrainingRequest) {
    setTrainingRequests((current) => {
      const exists = current.some((item) => item.id === request.id);
      return exists
        ? current.map((item) => item.id === request.id ? request : item)
        : [request, ...current];
    });
  }

  async function refreshEquipmentPermissions() {
    const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
    if (!token || !sessionRole) return;
    const snapshot = await apiGet<EquipmentPermissionSnapshot>('/equipment-permissions', token);
    if (snapshot) applyEquipmentPermissionSnapshot(snapshot);
  }

  async function createTrainingRequest(input: TrainingRequestInput) {
    const savedRequest = await apiPost<ApiTrainingRequest>(
      '/training-requests',
      input,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
    if (savedRequest) upsertTrainingRequest(savedRequest);
    return savedRequest;
  }

  async function scheduleTrainingRequest(requestId: string, input: { scheduledDate: string; scheduledStart: string; scheduledEnd: string; scheduleChangeReason: string }) {
    const savedRequest = await apiPatch<ApiTrainingRequest>(
      `/training-requests/${encodeURIComponent(requestId)}/schedule`,
      input,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
    if (savedRequest) upsertTrainingRequest(savedRequest);
    return savedRequest;
  }

  async function rejectTrainingRequest(requestId: string, rejectedReason: string) {
    const savedRequest = await apiPatch<ApiTrainingRequest>(
      `/training-requests/${encodeURIComponent(requestId)}/reject`,
      { rejectedReason },
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
    if (savedRequest) upsertTrainingRequest(savedRequest);
    return savedRequest;
  }

  async function completeTrainingRequest(requestId: string) {
    const savedRequest = await apiPatch<ApiTrainingRequest>(
      `/training-requests/${encodeURIComponent(requestId)}/complete`,
      {},
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
    if (savedRequest) {
      upsertTrainingRequest(savedRequest);
      await refreshEquipmentPermissions();
      const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
      if (token) {
        const session = await apiGet<GoogleAuthResponse>('/auth/me', token);
        if (session?.managedUser) registerAuthenticatedUser(session.managedUser);
      }
    }
    return savedRequest;
  }

  async function addReservation(event: ReservationEvent) {
    const savedEvent = await apiPost<ApiReservationEvent>('/reservations', {
      equipmentId: event.equipmentId,
      title: event.title,
      startsAt: toApiReservationDateTime(event.start),
      endsAt: toApiReservationDateTime(event.end),
      purpose: event.purpose ?? event.title,
      userId: event.userId ?? sessionUser?.id,
      status: event.status
    }, localStorage.getItem(STORAGE_KEYS.sessionToken));
    if (!savedEvent) {
      window.alert('예약을 DB에 저장하지 못했습니다. 장비 권한, 교육 이수 상태 또는 중복 예약 여부를 확인해 주세요.');
      return false;
    }
    setReservationEvents((current) => [...current, normalizeApiReservation(savedEvent)]);
    return true;
  }

  async function deleteReservation(reservationId: string) {
    const deletedEvent = await apiDelete<ApiReservationEvent>(
      `/reservations/${encodeURIComponent(reservationId)}`,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
    if (!deletedEvent) {
      window.alert('예약 삭제에 실패했습니다. 권한 또는 예약 상태를 확인해 주세요.');
      return false;
    }
    setReservationEvents((current) => current.filter((event) => event.id !== reservationId));
    return true;
  }

  function dismissPreviewPenaltyDemo() {
    localStorage.setItem(STORAGE_KEYS.previewPenaltyDemoDismissed, 'true');
    setShowPreviewPenaltyDemo(false);
  }

  function addPenalty(userId: string, type: PenaltyType, category: PenaltyCategory, reason: string) {
    const user = managedUsers.find((item) => item.id === userId);
    if (!user) return;
    const startsAt = new Date().toISOString();
    void apiPost<PenaltyRecord>('/penalties', {
      userId,
      type,
      category,
      reason,
      startsAt,
      endsAt: getPenaltyEndsAt(type, startsAt)
    }, localStorage.getItem(STORAGE_KEYS.sessionToken)).then((savedPenalty) => {
      if (!savedPenalty) {
        window.alert('패널티 기록을 DB에 저장하지 못했습니다. 관리자 권한과 입력값을 확인해 주세요.');
        return;
      }
      setPenaltyRecords((current) => [savedPenalty, ...current.filter((record) => record.id !== savedPenalty.id)]);
    });
  }

  function revokePenalty(penaltyId: string) {
    void apiPatch<PenaltyRecord>(
      `/penalties/${encodeURIComponent(penaltyId)}/revoke`,
      {},
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    ).then((savedPenalty) => {
      if (!savedPenalty) {
        window.alert('패널티 해제 상태를 DB에 저장하지 못했습니다. 관리자 권한을 확인해 주세요.');
        return;
      }
      setPenaltyRecords((current) => current.map((record) => (
        record.id === penaltyId ? savedPenalty : record
      )));
    });
  }

  function changeConsumableMonth(month: string) {
    setSelectedConsumableMonth(month);
    setMonthlyConsumables((current) => (
      current[month]
        ? current
        : { ...current, [month]: [] }
    ));
  }

  function clearSaveFeedbackTimers() {
    saveFeedbackTimers.current.forEach((timer) => window.clearTimeout(timer));
    saveFeedbackTimers.current = [];
  }

  function clearUserSaveFeedbackTimers() {
    userSaveFeedbackTimers.current.forEach((timer) => window.clearTimeout(timer));
    userSaveFeedbackTimers.current = [];
  }

  function applyEquipmentPermissionSnapshot(snapshot: EquipmentPermissionSnapshot) {
    setEquipmentPermissions(snapshot.permissions);
    setEquipmentPermissionGrantMeta(snapshot.grantMeta);
    setEquipmentPermissionHistory(snapshot.history);
  }

  function updateConsumable(id: string, patch: Partial<ConsumableItem>) {
    setHasUnsavedConsumables(true);
    clearSaveFeedbackTimers();
    setSaveFeedbackPhase('idle');
    setMonthlyConsumables((current) => ({
      ...current,
      [selectedConsumableMonth]: (current[selectedConsumableMonth] ?? cloneConsumables()).map((item) => (
        item.id === id ? { ...item, ...patch } : item
      ))
    }));
  }

  function addConsumable() {
    setHasUnsavedConsumables(true);
    clearSaveFeedbackTimers();
    setSaveFeedbackPhase('idle');
    setMonthlyConsumables((current) => {
      const rows = current[selectedConsumableMonth] ?? cloneConsumables();
      return {
        ...current,
        [selectedConsumableMonth]: [
          ...rows,
          {
            id: `supply-${selectedConsumableMonth}-${Date.now()}`,
            category: '신규 소모품',
            name: '신규 품목',
            unit: 'EA',
            monthStart: 0,
            current: 0,
            minimum: 0,
            note: ''
          }
        ]
      };
    });
  }

  function deleteConsumable(id: string) {
    setHasUnsavedConsumables(true);
    clearSaveFeedbackTimers();
    setSaveFeedbackPhase('idle');
    setMonthlyConsumables((current) => ({
      ...current,
      [selectedConsumableMonth]: (current[selectedConsumableMonth] ?? cloneConsumables()).filter((item) => item.id !== id)
    }));
  }

  function importConsumables(month: string, rows: ConsumableItem[]) {
    if (rows.length === 0) return;
    setSelectedConsumableMonth(month);
    setMonthlyConsumables((current) => ({
      ...current,
      [month]: rows
    }));
    setHasUnsavedConsumables(true);
    clearSaveFeedbackTimers();
    setSaveFeedbackPhase('idle');
  }

  async function saveConsumables() {
    const savedItems = await apiPut<ConsumableItem[]>(
      `/consumables/${encodeURIComponent(selectedConsumableMonth)}`,
      { items: monthlyConsumables[selectedConsumableMonth] ?? [] },
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
    if (!savedItems) {
      window.alert('소모품 데이터를 DB에 저장하지 못했습니다. 관리자 권한과 입력값을 확인해 주세요.');
      return;
    }
    const savedAt = new Date().toISOString();
    setMonthlyConsumables((current) => ({ ...current, [selectedConsumableMonth]: savedItems }));
    setConsumablesUpdatedAt(savedAt);
    setHasUnsavedConsumables(false);
    clearSaveFeedbackTimers();
    setSaveFeedbackPhase('idle');
    window.requestAnimationFrame(() => setSaveFeedbackPhase('feedback'));
    saveFeedbackTimers.current = [
      window.setTimeout(() => setSaveFeedbackPhase('returning'), 2600),
      window.setTimeout(() => {
        setSaveFeedbackPhase('idle');
        saveFeedbackTimers.current = [];
      }, 3500)
    ];
  }

  function updateManagedUser(id: string, patch: Partial<ManagedUser>) {
    clearUserSaveFeedbackTimers();
    setUserSaveFeedbackPhase('idle');
    void apiPatch<ManagedUser>(
      `/users/${encodeURIComponent(id)}`,
      patch,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    ).then((savedUser) => {
      if (!savedUser) {
        window.alert('사용자 정보를 DB에 저장하지 못했습니다. 로그인 상태와 관리자 권한을 확인해 주세요.');
        return;
      }
      const savedAt = new Date().toISOString();
      setManagedUsers((current) => {
        const next = normalizeManagedUsers(current.map((user) => (
          user.id === id ? { ...user, ...savedUser } : user
        )));
        localStorage.setItem(STORAGE_KEYS.managedUsers, JSON.stringify(next));
        localStorage.setItem(STORAGE_KEYS.usersUpdatedAt, savedAt);
        return next;
      });
      setUsersUpdatedAt(savedAt);
    });
  }

  function addManagedUser(user: Omit<ManagedUser, 'id' | 'index'>) {
    const newUser: ManagedUser = {
      ...user,
      id: `managed-user-${Date.now()}`,
      index: managedUsers.length + 1,
      authProvider: user.authProvider ?? 'Manual',
      onboardingStatus: user.onboardingStatus ?? 'training_pending'
    };
    clearUserSaveFeedbackTimers();
    setUserSaveFeedbackPhase('idle');
    void apiPost<ManagedUser>(
      '/users',
      newUser,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    ).then((savedUser) => {
      if (!savedUser) {
        window.alert('신규 사용자를 DB에 등록하지 못했습니다. 로그인 상태와 관리자 권한을 확인해 주세요.');
        return;
      }
      const savedAt = new Date().toISOString();
      setManagedUsers((current) => {
        const normalized = mergeManagedUsers(current, [savedUser]);
        localStorage.setItem(STORAGE_KEYS.managedUsers, JSON.stringify(normalized));
        localStorage.setItem(STORAGE_KEYS.usersUpdatedAt, savedAt);
        return normalized;
      });
      setUsersUpdatedAt(savedAt);
    });
  }

  function deleteManagedUser(id: string) {
    clearUserSaveFeedbackTimers();
    setUserSaveFeedbackPhase('idle');
    void apiDelete<ManagedUser>(
      `/users/${encodeURIComponent(id)}`,
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    ).then((deletedUser) => {
      if (!deletedUser) {
        window.alert('사용자를 DB에서 삭제하지 못했습니다. 로그인 상태와 관리자 권한을 확인해 주세요.');
        return;
      }
      const savedAt = new Date().toISOString();
      setManagedUsers((current) => {
        const next = current.filter((user) => user.id !== id).map((user, index) => ({ ...user, index: index + 1 }));
        localStorage.setItem(STORAGE_KEYS.managedUsers, JSON.stringify(next));
        localStorage.setItem(STORAGE_KEYS.usersUpdatedAt, savedAt);
        return next;
      });
      setEquipmentPermissions((current) => {
        const { [id]: _deletedUserPermissions, ...next } = current;
        return next;
      });
      setUsersUpdatedAt(savedAt);
    });
  }

  function importManagedUsers(rows: ManagedUser[]) {
    if (rows.length === 0) return;
    clearUserSaveFeedbackTimers();
    setUserSaveFeedbackPhase('idle');
    setManagedUsers(rows.map((user, index) => ({ ...user, index: index + 1 })));
  }

  function saveManagedUsers() {
    clearUserSaveFeedbackTimers();
    setUserSaveFeedbackPhase('idle');
    const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
    const rows = managedUsers.map((user, index) => ({ ...user, index: index + 1 }));
    void Promise.all(rows.map((user) => apiPost<ManagedUser>('/users', user, token))).then((savedUsers) => {
      if (savedUsers.some((user) => !user)) {
        window.alert('일부 사용자 정보를 DB에 저장하지 못했습니다. 로그인 상태와 관리자 권한을 확인해 주세요.');
        return;
      }
      const savedAt = new Date().toISOString();
      const normalized = normalizeManagedUsers(savedUsers.filter(Boolean) as ManagedUser[]);
      setManagedUsers(normalized);
      localStorage.setItem(STORAGE_KEYS.managedUsers, JSON.stringify(normalized));
      localStorage.setItem(STORAGE_KEYS.usersUpdatedAt, savedAt);
      setUsersUpdatedAt(savedAt);
      window.requestAnimationFrame(() => setUserSaveFeedbackPhase('feedback'));
      userSaveFeedbackTimers.current = [
        window.setTimeout(() => setUserSaveFeedbackPhase('returning'), 2600),
        window.setTimeout(() => {
          setUserSaveFeedbackPhase('idle');
          userSaveFeedbackTimers.current = [];
        }, 3500)
      ];
    });
  }

  async function saveEquipmentPermissions(userId: string, equipmentIds: string[]) {
    const snapshot = await apiPut<EquipmentPermissionSnapshot>(
      `/equipment-permissions/users/${encodeURIComponent(userId)}`,
      { equipmentIds },
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
      if (!snapshot) {
        window.alert('장비 권한을 DB에 저장하지 못했습니다. 관리자 권한을 확인해 주세요.');
        return false;
      }
      applyEquipmentPermissionSnapshot(snapshot);
      return true;
  }

  function registerAuthenticatedUser(user: ManagedUser) {
    const savedAt = new Date().toISOString();
    setManagedUsers((current) => {
      const normalized = mergeManagedUsers(current, [user]);
      localStorage.setItem(STORAGE_KEYS.managedUsers, JSON.stringify(normalized));
      return normalized;
    });
    localStorage.setItem(STORAGE_KEYS.usersUpdatedAt, savedAt);
    setUsersUpdatedAt(savedAt);
  }

  const activeEquipmentItems = equipmentItems.filter((item) => !deletedEquipmentIds.includes(item.id));
  const activeConsumables = monthlyConsumables[selectedConsumableMonth] ?? cloneConsumables();
  const managerUserIds = useMemo(() => new Set(activeEquipmentItems.map((item) => item.managerId).filter(Boolean) as string[]), [activeEquipmentItems]);
  const currentManagedUser = useMemo(
    () => getManagedUserForSession(sessionUser, managedUsers),
    [sessionRole, sessionUser?.id, sessionUser?.email, sessionUser?.name, managedUsers]
  );
  const canManageAssignedPermissions = sessionRole === 'ADMIN' || Boolean(currentManagedUser && managerUserIds.has(currentManagedUser.id));

  async function grantAssignedEquipmentPermission(userId: string, equipmentId: string) {
    const snapshot = await apiPost<EquipmentPermissionSnapshot>(
      '/equipment-permissions/grant',
      { userId, equipmentId },
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
      if (!snapshot) {
        window.alert('장비 권한을 부여하지 못했습니다. 담당 장비 범위와 권한을 확인해 주세요.');
        return false;
      }
      applyEquipmentPermissionSnapshot(snapshot);
      return true;
  }

  async function revokeEquipmentPermissionByAdmin(userId: string, equipmentId: string, reason: string) {
    const normalizedReason = reason.trim();
    if (!normalizedReason || sessionRole !== 'ADMIN') return false;
    const snapshot = await apiPost<EquipmentPermissionSnapshot>(
      '/equipment-permissions/revoke',
      { userId, equipmentId, reason: normalizedReason },
      localStorage.getItem(STORAGE_KEYS.sessionToken)
    );
      if (!snapshot) {
        window.alert('장비 권한을 회수하지 못했습니다. 관리자 권한을 확인해 주세요.');
        return false;
      }
      applyEquipmentPermissionSnapshot(snapshot);
      return true;
  }

  return (
    <div className="min-h-screen">
      <LoadingOverlay visible={loading} />
      <InstitutionHeader
        onNavigate={navigate}
        sessionRole={sessionRole}
        onPreviewPenaltyTest={() => setShowPreviewPenaltyDemo(true)}
        onLogout={logout}
      />
      <div className="app-shell mx-auto max-w-[1800px] px-4 py-5 lg:px-6 2xl:px-8">
        <SidebarNavigation activePage={activePage} onNavigate={navigate} isAdmin={sessionRole === 'ADMIN'} canManageAssignedPermissions={canManageAssignedPermissions} />
        <main className="app-main">
          {activePage === 'home' && (
            <>
              <Dashboard
                equipmentItems={activeEquipmentItems}
                calendarEvents={reservationEvents}
                managedUsers={managedUsers}
                sessionUserName={sessionUserName}
                sessionRole={sessionRole}
                sessionUser={sessionUser}
                currentUser={currentManagedUser}
                equipmentPermissions={equipmentPermissions}
                notices={[...managedOperationNotices, ...managedMeetingNotices].sort((a, b) => b.date.localeCompare(a.date))}
                dashboardMetrics={dashboardMetrics}
                onNavigate={navigate}
              />
            </>
          )}
          {activePage === 'notice' && <NoticePage items={[...managedOperationNotices, ...managedMeetingNotices]} />}
          {activePage === 'operationNotice' && (
            <NoticePage
              title="운영공지"
              description="센터 운영, 장비 사용 기준, 안전 점검과 관련한 공지를 확인합니다."
              items={managedOperationNotices}
              filterLabel="운영공지"
            />
          )}
          {activePage === 'meetingNotice' && (
            <NoticePage
              title="회의공지"
              description="장비 담당자 회의, 학생 대표 회의, 운영 협의 관련 공지를 확인합니다."
              items={managedMeetingNotices}
              filterLabel="회의공지"
            />
          )}
          {activePage === 'facility' && <FacilityPage sessionRole={sessionRole} />}
          {activePage === 'equipment' && (
            <EquipmentPage
              equipmentItems={activeEquipmentItems}
              source={source}
              initialGroup={initialGroup}
            />
          )}
          {activePage === 'reservations' && (
            activeSessionPenalty && sessionRole !== 'ADMIN' ? (
              <PenaltyRestrictedPage penalty={activeSessionPenalty} onAcknowledge={() => setShowPenaltyNotice(true)} />
            ) : (
              <ReservationPage
                equipmentItems={activeEquipmentItems}
                calendarEvents={reservationEvents}
                sessionRole={sessionRole}
                sessionUser={sessionUser}
                currentUser={currentManagedUser}
                permissions={equipmentPermissions}
                permissionGrantMeta={equipmentPermissionGrantMeta}
                onNavigate={navigate}
                onAddReservation={addReservation}
                onDeleteReservation={deleteReservation}
              />
            )
          )}
          {activePage === 'training' && (
            <TrainingPage
              equipmentItems={activeEquipmentItems}
              users={managedUsers}
              sessionUser={sessionUser}
              currentUser={currentManagedUser}
              permissions={equipmentPermissions}
              trainingRequests={trainingRequests}
              onNavigate={navigate}
              onCreateTrainingRequest={createTrainingRequest}
            />
          )}
          {activePage === 'trainingManagement' && (
            canManageAssignedPermissions ? (
              <TrainingManagementPage
                users={managedUsers}
                equipmentItems={activeEquipmentItems}
                permissions={equipmentPermissions}
                trainingRequests={trainingRequests}
                currentUser={currentManagedUser}
                sessionRole={sessionRole}
                onScheduleTrainingRequest={scheduleTrainingRequest}
                onRejectTrainingRequest={rejectTrainingRequest}
                onCompleteTrainingRequest={completeTrainingRequest}
              />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'faq' && <FaqPage items={managedFaqItems} />}
          {activePage === 'qna' && <QnaPage sessionRole={sessionRole} />}
          {activePage === 'admin' && (
            sessionRole === 'ADMIN' ? (
              <AdminPage
                equipmentItems={activeEquipmentItems}
                calendarEvents={reservationEvents}
                onAddReservation={addReservation}
                onDeleteReservation={deleteReservation}
                onNavigate={navigate}
                consumablesUpdatedAt={consumablesUpdatedAt}
                usersUpdatedAt={usersUpdatedAt}
              />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'educationAdmin' && (
            sessionRole === 'ADMIN' ? (
              <AdminEducationPermissionPanel
                users={managedUsers}
                equipmentItems={activeEquipmentItems}
                permissions={equipmentPermissions}
                permissionGrantMeta={equipmentPermissionGrantMeta}
                onRevokePermission={revokeEquipmentPermissionByAdmin}
              />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'auditLogs' && (
            sessionRole === 'ADMIN' ? (
              <AuditLogPage />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'users' && (
            sessionRole === 'ADMIN' ? (
              <UserManagementPage
                users={managedUsers}
                saveFeedbackPhase={userSaveFeedbackPhase}
                onUpdateUser={updateManagedUser}
                onAddUser={addManagedUser}
                onDeleteUser={deleteManagedUser}
                onImportUsers={importManagedUsers}
                onSave={saveManagedUsers}
              />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'permissions' && (
            sessionRole === 'ADMIN' ? (
              <PermissionManagementPage
                users={managedUsers}
                equipmentItems={activeEquipmentItems}
                permissions={equipmentPermissions}
                managerUserIds={managerUserIds}
                onSavePermissions={saveEquipmentPermissions}
              />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'managerPermissions' && (
            canManageAssignedPermissions ? (
              <ManagerPermissionGrantPage
                users={managedUsers}
                equipmentItems={activeEquipmentItems}
                permissions={equipmentPermissions}
                permissionGrantMeta={equipmentPermissionGrantMeta}
                currentUser={currentManagedUser}
                sessionRole={sessionRole}
                onGrantPermission={grantAssignedEquipmentPermission}
              />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'equipmentAdmin' && (
            sessionRole === 'ADMIN' ? (
              <EquipmentAdminPage
                equipmentItems={activeEquipmentItems}
                users={managedUsers}
                onAddEquipment={addEquipment}
                onDeleteEquipment={deleteEquipment}
                onUpdateEquipment={updateEquipment}
                onUploadEquipmentImage={uploadEquipmentImage}
              />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'consumables' && (
            sessionRole === 'ADMIN' ? (
              <ConsumablesPage
                month={selectedConsumableMonth}
                consumables={activeConsumables}
                saveFeedbackPhase={saveFeedbackPhase}
                onMonthChange={changeConsumableMonth}
                onUpdateConsumable={updateConsumable}
                onAddConsumable={addConsumable}
                onDeleteConsumable={deleteConsumable}
                onImportConsumables={importConsumables}
                onSave={saveConsumables}
              />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'penalties' && (
            sessionRole === 'ADMIN' ? (
              <PenaltyManagementPage
                users={managedUsers}
                penalties={penaltyRecords}
                onAddPenalty={addPenalty}
                onRevokePenalty={revokePenalty}
              />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'noticeAdmin' && (
            sessionRole === 'ADMIN' ? (
              <NoticeAdminPage
                operationItems={managedOperationNotices}
                meetingItems={managedMeetingNotices}
                faqItems={managedFaqItems}
                onAddNotice={addNotice}
                onUpdateNotice={updateNotice}
                onDeleteNotice={deleteNotice}
                onAddFaq={addFaq}
                onUpdateFaq={updateFaq}
                onDeleteFaq={deleteFaq}
                onUploadAttachments={uploadNoticeAttachments}
                onDeleteAttachment={deleteNoticeAttachment}
              />
            ) : (
              <PlaceholderPage title="접근 권한이 없습니다" />
            )
          )}
          {activePage === 'login' && (
            <LoginPage
              onAuthenticated={(role) => setSessionRole(role)}
              onRegisterUser={registerAuthenticatedUser}
            />
          )}
          {activePage === 'center' && <PlaceholderPage title="센터소개" />}
          {activePage === 'mypage' && sessionRole && (
            <MyPageV2
              equipmentItems={activeEquipmentItems}
              calendarEvents={reservationEvents}
              managedUser={currentManagedUser}
              sessionUser={sessionUser}
              sessionRole={sessionRole}
              managerUserIds={managerUserIds}
              permissions={equipmentPermissions}
              permissionGrantMeta={equipmentPermissionGrantMeta}
              penalties={penaltyRecords}
              onCancelReservation={deleteReservation}
              onNavigate={navigate}
            />
          )}
          <OwnerInfoFooter />
        </main>
      </div>
      {showPenaltyNotice && activeSessionPenalty && (
        <PenaltyNoticeModal penalty={activeSessionPenalty} onClose={() => setShowPenaltyNotice(false)} />
      )}
      {showPreviewPenaltyDemo && !activeSessionPenalty && (
        <PenaltyNoticeModal penalty={previewPenaltyDemo} onClose={dismissPreviewPenaltyDemo} />
      )}
      {globalAccessNotice && (
        <AccessRequirementModal notice={globalAccessNotice} onClose={() => setGlobalAccessNotice(null)} />
      )}
    </div>
  );
}

import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react';
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
  ChevronDown,
  Cpu,
  Download,
  Factory,
  Gauge,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  Megaphone,
  MessageSquare,
  Microscope,
  PackageCheck,
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

type PageKey = 'home' | 'notice' | 'center' | 'facility' | 'equipment' | 'training' | 'faq' | 'qna' | 'reservations' | 'mypage' | 'admin' | 'users' | 'permissions' | 'consumables' | 'login';
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
  roleLevel: '대표' | '일반';
  department: string;
  labProfessor: string;
  phone: string;
  email: string;
  memo: string;
  authProvider?: 'Google' | 'Kakao' | 'Manual';
};
type EquipmentPermissionMap = Record<string, string[]>;

const apiUrl = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL) ?? 'http://localhost:4000';

const menu: Array<{ label: string; page: PageKey; icon: typeof Factory }> = [
  { label: '공지사항', page: 'notice', icon: Megaphone },
  { label: '센터소개', page: 'center', icon: Factory },
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
const initialManagedUsers: ManagedUser[] = [
  { id: 'user-1', index: 1, name: '김동인', roleLevel: '대표', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-9772-5939', email: 'shehdshehd1123@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-2', index: 2, name: '길가영', roleLevel: '일반', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-6595-3930', email: 'gilgayeong2@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-3', index: 3, name: '최진영', roleLevel: '일반', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-4558-3205', email: 'lucy3205@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-4', index: 4, name: '정재웅', roleLevel: '일반', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-7166-2296', email: 'greadex2296@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-5', index: 5, name: '박형규', roleLevel: '일반', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-5660-2425', email: '0518phg@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-6', index: 6, name: '배유진', roleLevel: '일반', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-5291-6172', email: 'yoojin.bae23@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-7', index: 7, name: '김빈섭', roleLevel: '일반', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-9923-4322', email: 'doo4322@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-8', index: 8, name: '이수민', roleLevel: '일반', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-2933-2815', email: 'leesuminn23@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-9', index: 9, name: '허승혁', roleLevel: '일반', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-9643-4117', email: 'heoseunghyeok0@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-10', index: 10, name: '천도현', roleLevel: '일반', department: '전자공학과', labProfessor: '김민회 교수님', phone: '010-5588-2490', email: 'cheondohyun99@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-11', index: 11, name: '김세형', roleLevel: '일반', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-8357-8849', email: 'kimsehyung1009@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-12', index: 12, name: '이현준', roleLevel: '일반', department: '창의융합학과', labProfessor: '김민회 교수님', phone: '010-4266-5253', email: 'hyeonjunlee917@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-13', index: 13, name: '김택균', roleLevel: '대표', department: '기계공학과', labProfessor: '노진성 교수님', phone: '010-4066-1760', email: 'kimtk1346@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-14', index: 14, name: '이동규', roleLevel: '일반', department: '기계공학과', labProfessor: '노진성 교수님', phone: '010-4878-3369', email: 'bestcubist@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-15', index: 15, name: '박준우', roleLevel: '일반', department: '기계공학과', labProfessor: '노진성 교수님', phone: '010-7487-5220', email: 'pjw981121@gmail.com', memo: '1학기 회의 참석 어려움(매주 화요일 19~22시 야간대 수업)', authProvider: 'Manual' },
  { id: 'user-16', index: 16, name: '강정민', roleLevel: '일반', department: '기계공학과', labProfessor: '노진성 교수님', phone: '010-5024-7735', email: 'Scipio.kang@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-17', index: 17, name: 'Chu Duc Thanh', roleLevel: '일반', department: '기계공학과', labProfessor: '노진성 교수님', phone: '010-5801-2310', email: 'chuducthanh972310@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-18', index: 18, name: 'Ngoc Tram Pham Le', roleLevel: '일반', department: '기계공학과', labProfessor: '노진성 교수님', phone: '010-7989-7771', email: 'ngoctram9128@outlook.com', memo: '', authProvider: 'Manual' },
  { id: 'user-19', index: 19, name: 'Truong Dang Thanh', roleLevel: '일반', department: '기계공학과', labProfessor: '노진성 교수님', phone: '010-8837-3979', email: 'michaeldangvn@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-20', index: 20, name: 'To Thi Tu Linh', roleLevel: '일반', department: '기계공학과', labProfessor: '노진성 교수님', phone: '010-3336-7762', email: 'tothitulinhche98@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-21', index: 21, name: '김서현', roleLevel: '대표', department: '창의융합학과', labProfessor: '이재현 교수님', phone: '010-6286-9373', email: 'kshg0419@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-22', index: 22, name: '이승진', roleLevel: '대표', department: '전자공학과', labProfessor: '전승배 교수님', phone: '010-4036-9815', email: '20201706@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-23', index: 23, name: '정우성', roleLevel: '일반', department: '지능형나노반도체학과', labProfessor: '전승배 교수님', phone: '010-2343-8349', email: 'dntjd1972@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-24', index: 24, name: '윤진언', roleLevel: '일반', department: '전자공학과', labProfessor: '전승배 교수님', phone: '010-2559-4804', email: '20211074@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-25', index: 25, name: '노우용', roleLevel: '일반', department: '전자공학과', labProfessor: '전승배 교수님', phone: '010-7550-5669', email: '20221167@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-26', index: 26, name: '박준성', roleLevel: '일반', department: '전자공학과', labProfessor: '전승배 교수님', phone: '010-5635-5915', email: 'qn0esnuj@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-27', index: 27, name: '정재영', roleLevel: '일반', department: '화학생명공학과', labProfessor: '전승배 교수님', phone: '010-2251-5596', email: 'jaeyoung0921@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-28', index: 28, name: '김재윤', roleLevel: '일반', department: '전자공학과', labProfessor: '전승배 교수님', phone: '010-9149-8203', email: 'jaeyun12245@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-29', index: 29, name: '한의정', roleLevel: '일반', department: '전자공학과', labProfessor: '전승배 교수님', phone: '010-5611-5441', email: 'eui_jeong@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-30', index: 30, name: '권준형', roleLevel: '대표', department: '지능형나노반도체학과', labProfessor: '최윤석 교수님', phone: '010-7590-0288', email: 'tmzkdlxka@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-31', index: 31, name: '성유진', roleLevel: '일반', department: '지능형나노반도체학과', labProfessor: '최윤석 교수님', phone: '010-9950-7504', email: 'dbwls010211@naver.com', memo: '5월 이후 회사 출근 (회의 및 청소 참여 어려움)', authProvider: 'Manual' },
  { id: 'user-32', index: 32, name: '권아현', roleLevel: '일반', department: '지능형나노반도체학과', labProfessor: '최윤석 교수님', phone: '010-5426-0458', email: 'kah0458@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-33', index: 33, name: '김보혜', roleLevel: '일반', department: '지능형나노반도체학과', labProfessor: '최윤석 교수님', phone: '010-7166-6290', email: 'qhgP6290@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-34', index: 34, name: '안현식', roleLevel: '일반', department: '전자공학과', labProfessor: '최윤석 교수님', phone: '010-9436-9445', email: 'princass123@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-35', index: 35, name: '임성민', roleLevel: '일반', department: '전자공학과', labProfessor: '최윤석 교수님', phone: '010-4870-5202', email: 'seongmin625@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-36', index: 36, name: '이예규', roleLevel: '대표', department: '기계공학과', labProfessor: '하지환 교수님', phone: '010-5437-9475', email: '20204012@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-37', index: 37, name: '이철희', roleLevel: '일반', department: '기계공학과', labProfessor: '하지환 교수님', phone: '010-4447-0447', email: '20224015@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-38', index: 38, name: '이민규', roleLevel: '일반', department: '기계공학과', labProfessor: '하지환 교수님', phone: '010-9473-2498', email: '20211394@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-39', index: 39, name: '신우빈', roleLevel: '일반', department: '기계공학과', labProfessor: '하지환 교수님', phone: '010-4772-3721', email: 'ssshinwoovin@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-40', index: 40, name: '정진호', roleLevel: '일반', department: '기계공학과', labProfessor: '하지환 교수님', phone: '010-9568-1713', email: '607jinho@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-41', index: 41, name: '빙성윤', roleLevel: '일반', department: '기계공학과', labProfessor: '하지환 교수님', phone: '010-8572-1565', email: 'smartbing2001@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-42', index: 42, name: '이우진', roleLevel: '일반', department: '기계공학과', labProfessor: '하지환 교수님', phone: '010-4137-4829', email: 'wjin03274@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-43', index: 43, name: '정예림', roleLevel: '일반', department: '신소재공학과', labProfessor: '하지환 교수님', phone: '010-5449-2175', email: 'jungyerim0713@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-44', index: 44, name: '이원섭', roleLevel: '대표', department: '창의융합학과', labProfessor: '정우익 교수님', phone: '010-8741-7849', email: 'hahaman767@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-45', index: 45, name: '김동혁', roleLevel: '일반', department: '창의융합학과', labProfessor: '정우익 교수님', phone: '010-2655-3001', email: 'kdhy3001@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-46', index: 46, name: '이리안', roleLevel: '일반', department: '창의융합학과', labProfessor: '정우익 교수님', phone: '010-6631-6162', email: 'comonlra@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-47', index: 47, name: '임경민', roleLevel: '일반', department: '창의융합학과', labProfessor: '정우익 교수님', phone: '010-8871-9415', email: 'dlariddlas@gmail.com', memo: '', authProvider: 'Manual' },
  { id: 'user-48', index: 48, name: '손민진', roleLevel: '일반', department: '창의융합학과', labProfessor: '정우익 교수님', phone: '010-3072-4154', email: '20232713@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-49', index: 49, name: '구연우', roleLevel: '일반', department: '창의융합학과', labProfessor: '정우익 교수님', phone: '010-8625-3711', email: '20242742@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-50', index: 50, name: '박보미', roleLevel: '일반', department: '창의융합학과', labProfessor: '정우익 교수님', phone: '010-8321-1844', email: '20244099@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-51', index: 51, name: '최진규', roleLevel: '대표', department: '전자공학과', labProfessor: '구치완 교수님', phone: '010-7217-3034', email: '30231153@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-52', index: 52, name: '김정태', roleLevel: '일반', department: '전자공학과', labProfessor: '구치완 교수님', phone: '010-3070-3019', email: 'jeotae@edu.hanbat.ac.kr', memo: '', authProvider: 'Manual' },
  { id: 'user-53', index: 53, name: '구자성', roleLevel: '대표', department: '전자공학과', labProfessor: '백근우 교수님', phone: '010-3103-2501', email: 'koo020716@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-54', index: 54, name: '이동현', roleLevel: '일반', department: '전자공학과', labProfessor: '백근우 교수님', phone: '010-6434-8551', email: 'ddadda05@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-55', index: 55, name: '이유경', roleLevel: '일반', department: '전자공학과', labProfessor: '백근우 교수님', phone: '010-5585-5698', email: 'dbsdb8389@naver.com', memo: '', authProvider: 'Manual' },
  { id: 'user-56', index: 56, name: '최민용', roleLevel: '일반', department: '전자공학과', labProfessor: '백근우 교수님', phone: '010-2315-4255', email: 'cjh103741@naver.com', memo: '', authProvider: 'Manual' }
];

const initialConsumables: ConsumableItem[] = [
  { id: 'supply-1', category: '단순소모품', name: '클린 마스크', unit: 'BOX 기준', monthStart: 36, current: 27, minimum: 20, note: 'BOX 기준' },
  { id: 'supply-2', category: '단순소모품', name: '라텍스 장갑 (L)', unit: 'BOX 기준', monthStart: 11, current: 17, minimum: 10, note: 'BOX 기준' },
  { id: 'supply-3', category: '단순소모품', name: '라텍스 장갑 (M)', unit: 'BOX 기준', monthStart: 5, current: 19, minimum: 10, note: 'BOX 기준' },
  { id: 'supply-4', category: '단순소모품', name: '라텍스 장갑 (S)', unit: 'BOX 기준', monthStart: 16, current: 22, minimum: 20, note: 'BOX 기준' },
  { id: 'supply-5', category: '단순소모품', name: 'PVC 장갑 (L)', unit: 'BOX 기준', monthStart: 14, current: 24, minimum: 20, note: 'BOX 기준' },
  { id: 'supply-6', category: '단순소모품', name: 'PVC 장갑 (M)', unit: 'BOX 기준', monthStart: 12, current: 22, minimum: 20, note: 'BOX 기준' },
  { id: 'supply-7', category: '단순소모품', name: 'PVC 장갑 (S)', unit: 'BOX 기준', monthStart: 2, current: 22, minimum: 20, note: 'BOX 기준' },
  { id: 'supply-8', category: '단순소모품', name: '클린룸 sticky mat', unit: '개', monthStart: 37, current: 36, minimum: 20, note: '개' },
  { id: 'supply-9', category: '단순소모품', name: '킴테크 와이퍼', unit: 'BOX 기준', monthStart: 80, current: 75, minimum: 20, note: 'BOX 기준' },
  { id: 'supply-10', category: '단순소모품', name: '알루미늄 호일', unit: '개', monthStart: 69, current: 68, minimum: 20, note: '개' },
  { id: 'supply-11', category: '단순소모품', name: '무진천', unit: '신규주문 필요', monthStart: 0, current: 10, minimum: 10, note: '신규주문 필요' },
  { id: 'supply-12', category: '단순소모품', name: '폐액통', unit: '통', monthStart: 8, current: 21, minimum: 20, note: '2,4주차 수요일 오전' },
  { id: 'supply-13', category: '가스', name: 'N2 gas', unit: '봄베 압력', monthStart: 5.5, current: 12, minimum: 10, note: 'main gas 봄베 regulator 압력 기준' },
  { id: 'supply-14', category: '가스', name: 'O2 gas', unit: '봄베 압력', monthStart: 9.5, current: 9, minimum: 10, note: 'main gas 봄베 regulator 압력 기준' },
  { id: 'supply-15', category: '가스', name: 'Ar gas', unit: '봄베 압력', monthStart: 6, current: 6.5, minimum: 10, note: 'main gas 봄베 regulator 압력 기준' },
  { id: 'supply-16', category: '가스', name: 'CF4 gas', unit: '봄베 압력', monthStart: 8, current: 8, minimum: 10, note: 'main gas 봄베 regulator 압력 기준' },
  { id: 'supply-17', category: '가스', name: 'CHF3 gas', unit: '봄베 압력', monthStart: 4, current: 4, minimum: 5, note: 'main gas 봄베 regulator 압력 기준' },
  { id: 'supply-18', category: 'White room 용액 (산)', name: '황산', unit: '병', monthStart: 2, current: 2, minimum: 5, note: '2병 이하일 때는 분수로 기록' },
  { id: 'supply-19', category: 'White room 용액 (산)', name: '질산', unit: '병', monthStart: 2, current: 2, minimum: 5, note: '2병 이하일 때는 분수로 기록' },
  { id: 'supply-20', category: 'White room 용액 (산)', name: '과산화수소', unit: '병', monthStart: 3, current: 3, minimum: 5, note: '2병 이하일 때는 분수로 기록' },
  { id: 'supply-21', category: 'White room 용액 (산)', name: 'BOE', unit: '병', monthStart: 4, current: 4, minimum: 5, note: '2병 이하일 때는 분수로 기록' },
  { id: 'supply-22', category: 'Yellow room 용액 (유기, 염기)', name: '아세톤', unit: '병', monthStart: 1, current: 4, minimum: 5, note: '2병 이하일 때는 분수로 기록' },
  { id: 'supply-23', category: 'Yellow room 용액 (유기, 염기)', name: 'IPA (이소프로판올)', unit: '병', monthStart: 2, current: 4, minimum: 5, note: '2병 이하일 때는 분수로 기록' },
  { id: 'supply-24', category: 'Yellow room 용액 (유기, 염기)', name: 'AZ300MIF', unit: '병', monthStart: 1, current: 1, minimum: 5, note: '1병 이하일 때는 분수로 기록' },
  { id: 'supply-25', category: 'Yellow room 용액 (유기, 염기)', name: 'AZ GXR601-14cp', unit: '병', monthStart: 1, current: 1, minimum: 5, note: '1병 이하일 때는 분수로 기록' },
  { id: 'supply-26', category: 'Yellow room 용액 (유기, 염기)', name: 'NR9-1000 PY', unit: '병', monthStart: 2, current: 3, minimum: 5, note: '1병 이하일 때는 분수로 기록' },
  { id: 'supply-27', category: 'Yellow room 용액 (유기, 염기)', name: 'RD6', unit: '병', monthStart: 4, current: 4, minimum: 5, note: '1병 이하일 때는 분수로 기록' },
  { id: 'supply-28', category: 'Yellow room 용액 (유기, 염기)', name: 'AZ 5214 E', unit: '병', monthStart: 1, current: 1, minimum: 5, note: '1병 이하일 때는 분수로 기록' },
  { id: 'supply-29', category: 'Yellow room 용액 (유기, 염기)', name: 'AZ AD promoter-K', unit: '병', monthStart: 1, current: 1, minimum: 5, note: '1병 이하일 때는 분수로 기록' },
  { id: 'supply-30', category: '폐기스티커', name: '할로겐폐유기용제', unit: 'EA', monthStart: 33, current: 32, minimum: 20, note: '' },
  { id: 'supply-31', category: '폐기스티커', name: '비할로겐폐유기용제', unit: 'EA', monthStart: 22, current: 50, minimum: 20, note: '' },
  { id: 'supply-32', category: '폐기스티커', name: '폐시약병', unit: 'EA', monthStart: 38, current: 29, minimum: 20, note: '' },
  { id: 'supply-33', category: '폐기스티커', name: '기타폐기물', unit: 'EA', monthStart: 6, current: 50, minimum: 20, note: '' },
  { id: 'supply-34', category: '폐기스티커', name: '폐시약', unit: 'EA', monthStart: 22, current: 22, minimum: 20, note: '' },
  { id: 'supply-35', category: '폐기스티커', name: '폐유독물(액상)', unit: 'EA', monthStart: 14, current: 14, minimum: 10, note: '' },
  { id: 'supply-36', category: '폐기스티커', name: '폐산', unit: 'EA', monthStart: 35, current: 34, minimum: 20, note: '' },
  { id: 'supply-37', category: '폐기스티커', name: '할로겐유기용제', unit: 'EA', monthStart: 28, current: 28, minimum: 20, note: '' },
  { id: 'supply-38', category: '폐기스티커', name: '폐유기용제(고상)', unit: 'EA', monthStart: 14, current: 14, minimum: 10, note: '' },
  { id: 'supply-39', category: '장비 내 소모품', name: 'miniSEM 필라멘트', unit: '교체 일자', monthStart: 0, current: 0, minimum: 5, note: '26년 5월 / 여분 4개' },
  { id: 'supply-40', category: '장비 내 소모품', name: 'miniSEM 코팅 물질(PT Target)', unit: '교체 일자', monthStart: 0, current: 0, minimum: 5, note: '25년 12월 / 재고 여분 있음' },
  { id: 'supply-41', category: '장비 내 소모품', name: 'ALD TMA 소스', unit: '교체 일자', monthStart: 0, current: 0, minimum: 5, note: '24년 5월 / 소스 소진 시 파형 확인' },
  { id: 'supply-42', category: '장비 내 소모품', name: 'ALD TEMAHf 소스', unit: '교체 일자', monthStart: 0, current: 0, minimum: 5, note: '24년 5월 / 소스 소진 시 파형 확인' },
  { id: 'supply-43', category: '장비 내 소모품', name: 'MASK aligner UV lamp', unit: '교체 일자', monthStart: 0, current: 0, minimum: 5, note: '24년 2월 / UV intensity 확인 필요' },
  { id: 'supply-44', category: '장비 내 소모품', name: '클린부스 헤파필터', unit: '교체 일자', monthStart: 0, current: 0, minimum: 5, note: '25년 8월 / 보통 1년 주기 교체' },
  { id: 'supply-45', category: '장비 내 소모품', name: '시약장 필터', unit: '교체 일자', monthStart: 0, current: 0, minimum: 5, note: '25년 9월 / 교체 알림이 뜸' },
  { id: 'supply-46', category: '장비 내 소모품', name: '공기정화장치필터', unit: '교체 일자', monthStart: 0, current: 0, minimum: 5, note: '25년 11월 / 보통 1년 주기 교체' },
  { id: 'supply-47', category: '장비 내 소모품', name: '초순수제조장치필터', unit: '교체 일자', monthStart: 0, current: 0, minimum: 5, note: '26년 5월 / 4개월 주기 교체' }
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

function cloneManagedUsers(items = initialManagedUsers) {
  return items.map((item) => ({ ...item }));
}

function getPreviewEquipmentPermissionIds() {
  return ['eq-1', 'eq-2', 'eq-5', 'eq-14', 'eq-16', 'eq-19'];
}

function createPreviewEquipmentPermissions(): EquipmentPermissionMap {
  const previewUserId = initialManagedUsers[0]?.id;
  if (!previewUserId) return {};
  const previewEquipmentIds = fallbackEquipment
    .filter((item) => getPreviewEquipmentPermissionIds().includes(item.id))
    .map((item) => item.id);
  return { [previewUserId]: previewEquipmentIds };
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

function downloadUsersExcel(rows: ManagedUser[]) {
  const escapeCell = (value: string | number) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const headers = ['연번', '이름', 'ROLE', '소속 학과', '소속 연구실', '연락처', '이메일', '메모', '인증'];
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
    labProfessor: indexOf('소속 연구실'),
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
        roleLevel: row[indexes.roleLevel] === '대표' ? '대표' : '일반',
        department: row[indexes.department] || '',
        labProfessor: row[indexes.labProfessor] || '',
        phone: row[indexes.phone] || '',
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

function InstitutionHeader({ onNavigate, sessionRole }: { onNavigate: (page: PageKey) => void; sessionRole: Role | null }) {
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
          <button className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300 hover:text-cyan-200">ENG</button>
          <button className="rounded-md bg-white px-4 py-2 text-sm font-extrabold text-slate-950 hover:bg-cyan-200" onClick={() => onNavigate('login')}>
            {sessionRole ? `${sessionRole} 접속중` : '로그인'}
          </button>
        </div>
      </div>
    </header>
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
  const inquiryPages: PageKey[] = ['faq', 'qna'];
  const [inquiryOpen, setInquiryOpen] = useState(() => inquiryPages.includes(activePage));
  const inquirySelected = inquiryPages.includes(activePage);

  useEffect(() => {
    if (inquirySelected) setInquiryOpen(true);
  }, [inquirySelected]);

  return (
    <div className="sidebar-stack">
      <aside className="app-sidebar" aria-label="주요 메뉴">
        <div className="sidebar-section-label">Navigation</div>
        <nav className="sidebar-nav">
          {menu.map((item) => {
            const Icon = item.icon;
            const selected = activePage === item.page;
            return (
              <Fragment key={`${item.page}-${item.label}`}>
                <button
                  className={`sidebar-nav-item ${selected ? 'is-active' : ''}`}
                  onClick={() => onNavigate(item.page)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
                {item.page === 'training' && (
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
                )}
              </Fragment>
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

function Hero({
  onNavigate,
  equipmentItems,
  userName,
  userLab,
  userRole,
  grantedEquipmentItems,
  isAdmin
}: {
  onNavigate: (page: PageKey) => void;
  equipmentItems: EquipmentItem[];
  userName: string;
  userLab: string;
  userRole: ManagedUser['roleLevel'];
  grantedEquipmentItems: EquipmentItem[];
  isAdmin: boolean;
}) {
  const [showAllPermissions, setShowAllPermissions] = useState(false);
  const collapsedPermissionItems = grantedEquipmentItems.slice(0, 3);
  const visiblePermissionItems = showAllPermissions ? grantedEquipmentItems : collapsedPermissionItems;
  const hiddenPermissionCount = Math.max(grantedEquipmentItems.length - collapsedPermissionItems.length, 0);
  const isLead = userRole === '대표';

  return (
    <section className="hero-panel relative overflow-hidden">
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
            <h3><strong>{userName}</strong> 님 환영합니다.</h3>
            <span style={{ borderColor: `${getProfessorTone(userLab)}66`, backgroundColor: `${getProfessorTone(userLab)}1f`, color: getProfessorTone(userLab) }}>
              {formatProfessorLab(userLab)}
            </span>
          </div>
          <div className="hero-user-permissions" aria-label="사용자 역할 및 장비 권한">
            <span className={`hero-role-badge ${isLead ? 'is-lead' : 'is-member'}`}>{isAdmin ? 'ADMIN' : userRole}</span>
            {isAdmin && <span className="hero-permission-badge is-admin">전체 장비 접근</span>}
            {visiblePermissionItems.length > 0 ? (
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
            ) : (
              <span className="hero-permission-badge is-empty">부여된 장비 권한 없음</span>
            )}
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
          <p className="hero-section-label">운영 지표</p>
          <StatGrid equipmentItems={equipmentItems} />
        </div>
        <DashboardNoticePanel onNavigate={onNavigate} />
      </div>
    </section>
  );
}

function DashboardNoticePanel({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const dashboardNotices = noticeItems.slice(0, 4);

  return (
    <div className="dashboard-notice-panel">
      <div className="dashboard-notice-head">
        <div>
          <p className="hero-section-label">Notice</p>
          <h3>공지사항</h3>
        </div>
        <button type="button" onClick={() => onNavigate('notice')}>전체 보기</button>
      </div>
      <div className="dashboard-notice-list" aria-label="대시보드 공지사항">
        {dashboardNotices.map((notice) => (
          <button key={notice.id} type="button" className="dashboard-notice-row" onClick={() => onNavigate('notice')}>
            <span className="dashboard-notice-category">{notice.category}</span>
            <strong>{notice.title}</strong>
            <time>{notice.date}</time>
          </button>
        ))}
      </div>
    </div>
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
  managedUsers,
  sessionUserName,
  sessionRole,
  equipmentPermissions,
  onNavigate,
  onOpenEquipment
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  managedUsers: ManagedUser[];
  sessionUserName: string;
  sessionRole: Role | null;
  equipmentPermissions: EquipmentPermissionMap;
  onNavigate: (page: PageKey) => void;
  onOpenEquipment: (group: EquipmentGroup) => void;
}) {
  const dashboardUser = managedUsers.find((user) => user.name === sessionUserName) ?? managedUsers[0];
  const isPermissionPreviewMode = new URLSearchParams(window.location.search).get('permissionPreview') === 'multi';
  const grantedEquipmentIds = isPermissionPreviewMode
    ? getPreviewEquipmentPermissionIds()
    : dashboardUser ? equipmentPermissions[dashboardUser.id] ?? [] : [];
  const grantedEquipmentItems = equipmentItems.filter((item) => grantedEquipmentIds.includes(item.id));
  return (
    <section className="mt-5 grid gap-5">
      <Hero
        onNavigate={onNavigate}
        equipmentItems={equipmentItems}
        userName={sessionUserName || 'USER NAME'}
        userLab={dashboardUser?.labProfessor ?? '백근우 교수님'}
        userRole={dashboardUser?.roleLevel ?? '일반'}
        grantedEquipmentItems={grantedEquipmentItems}
        isAdmin={sessionRole === 'ADMIN'}
      />
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
      />
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
      {showAddModal && <EquipmentAddModal onClose={() => setShowAddModal(false)} onAdd={(item) => { onAddEquipment(item); setActiveGroup(item.group); setShowAddModal(false); }} />}
      {showDeleteModal && <EquipmentDeleteModal equipmentItems={equipmentItems} onClose={() => setShowDeleteModal(false)} onDelete={(equipmentId) => { onDeleteEquipment(equipmentId); setShowDeleteModal(false); }} />}
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
  onDeleteReservation,
  onNavigate,
  consumablesUpdatedAt,
  usersUpdatedAt
}: {
  equipmentItems: EquipmentItem[];
  calendarEvents: ReservationEvent[];
  onAddReservation: (event: ReservationEvent) => void;
  onDeleteReservation: (reservationId: string) => void;
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
        {[
          { title: '사용자관리', page: 'users' as PageKey, icon: UserRound, updatedAt: usersUpdatedAt },
          { title: '권한관리', page: 'permissions' as PageKey, icon: LockKeyhole },
          { title: '장비관리' },
          { title: '소모품관리', page: 'consumables' as PageKey, icon: PackageCheck, updatedAt: consumablesUpdatedAt },
          { title: '예약승인/거부' },
          { title: '교육관리' },
          { title: '홈페이지편집' },
          { title: '대시보드 데이터' },
          { title: '공지사항' },
          { title: '운영 로그' }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              className="rounded-lg border border-white/10 bg-surface/85 p-6 text-left text-lg font-extrabold text-white hover:border-cyan-300 hover:bg-blue-500/20"
              onClick={() => item.page && onNavigate(item.page)}
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

function LoginPage({
  onAuthenticated,
  onRegisterUser
}: {
  onAuthenticated: (role: Role) => void;
  onRegisterUser: (provider: 'Google' | 'Kakao', user: { name?: string; email?: string }) => void;
}) {
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
      onRegisterUser(provider, data.user);
      onAuthenticated(data.user.role);
      setMessage(`${provider} 인증이 완료되었습니다.`);
    } catch {
      const fallbackUser = { name: role === 'ADMIN' ? '관리자' : 'USER NAME', email: `${provider.toLowerCase()}-preview@hbnu.local`, role };
      localStorage.setItem('hbnu-session-token', `preview-${provider.toLowerCase()}-${role}`);
      localStorage.setItem('hbnu-session-user', JSON.stringify(fallbackUser));
      onRegisterUser(provider, fallbackUser);
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
  const newLabValue = '__new_lab__';
  const [departmentMode, setDepartmentMode] = useState(departments[0] ? departments[0] : newDepartmentValue);
  const [labMode, setLabMode] = useState(labs[0] ? labs[0] : newLabValue);
  const [form, setForm] = useState<Omit<ManagedUser, 'id' | 'index'>>({
    name: '',
    roleLevel: '일반',
    department: departments[0] ?? '',
    labProfessor: labs[0] ?? '',
    phone: '',
    email: '',
    memo: '',
    authProvider: 'Manual'
  });
  const isNewDepartment = departmentMode === newDepartmentValue;
  const isNewLab = labMode === newLabValue;

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
      window.alert('소속 연구실을 선택하거나 입력해주세요.');
      return;
    }
    onConfirm({
      ...form,
      name: form.name.trim(),
      department: form.department.trim(),
      labProfessor: form.labProfessor.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      memo: form.memo.trim()
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
            <select value={form.roleLevel} onChange={(event) => updateField('roleLevel', event.target.value === '대표' ? '대표' : '일반')}>
              <option value="일반">일반</option>
              <option value="대표">대표</option>
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
            소속 연구실
            <select
              value={labMode}
              onChange={(event) => {
                const value = event.target.value;
                setLabMode(value);
                updateField('labProfessor', value === newLabValue ? '' : value);
              }}
            >
              <option value={newLabValue}>신규 교수 추가</option>
              {labs.map((lab) => <option key={lab} value={lab}>{lab}</option>)}
            </select>
            {isNewLab && (
              <input
                className="user-add-manual-field"
                value={form.labProfessor}
                onChange={(event) => updateField('labProfessor', event.target.value)}
                placeholder="예: 백근우 교수님"
              />
            )}
          </label>
          <label>
            연락처
            <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="010-0000-0000" />
          </label>
          <label>
            이메일
            <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="user@example.com" />
          </label>
          <label className="is-wide">
            메모
            <input value={form.memo} onChange={(event) => updateField('memo', event.target.value)} placeholder="관리자 메모" />
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

function UserManagementPage({
  users,
  saveFeedbackPhase,
  onUpdateUser,
  onAddUser,
  onImportUsers,
  onSave
}: {
  users: ManagedUser[];
  saveFeedbackPhase: 'idle' | 'feedback' | 'returning';
  onUpdateUser: (id: string, patch: Partial<ManagedUser>) => void;
  onAddUser: (user: Omit<ManagedUser, 'id' | 'index'>) => void;
  onImportUsers: (rows: ManagedUser[]) => void;
  onSave: () => void;
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
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
          <span>Google 또는 Kakao 인증 후 가입자가 입력한 정보를 기준으로 사용자 권한과 Lab 정보를 관리합니다.</span>
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
          <span>대표 사용자</span>
          <strong>{representativeCount}</strong>
          <em>lab representatives</em>
        </div>
        <div>
          <span>소속 Lab</span>
          <strong>{Math.max(labs.length - 1, 0)}</strong>
          <em>professor groups</em>
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
          <option value="대표">대표</option>
          <option value="일반">일반</option>
        </select>
        <select value={labFilter} onChange={(event) => setLabFilter(event.target.value)} aria-label="소속 연구실 필터">
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
            <col className="user-col-auth" />
            <col className="user-col-memo" />
          </colgroup>
          <thead>
            <tr>
              <th>연번</th>
              <th>이름</th>
              <th>ROLE</th>
              <th>소속 학과</th>
              <th>소속 연구실</th>
              <th>연락처</th>
              <th>이메일</th>
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
                  <option value="대표">대표</option>
                  <option value="일반">일반</option>
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
                <select value={labFilter} onChange={(event) => setLabFilter(event.target.value)} aria-label="소속 연구실 컬럼 필터">
                  {labs.map((lab) => (
                    <option key={lab} value={lab}>{lab}</option>
                  ))}
                </select>
              </th>
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
              return (
                <tr key={user.id}>
                  <td>{pageStart + index + 1}</td>
                  <td>
                    <input value={user.name} onChange={(event) => onUpdateUser(user.id, { name: event.target.value })} aria-label={`${user.name} 이름`} />
                  </td>
                  <td>
                    <select
                      className={`user-role-select is-${user.roleLevel === '대표' ? 'lead' : 'member'}`}
                      value={user.roleLevel}
                      onChange={(event) => onUpdateUser(user.id, { roleLevel: event.target.value === '대표' ? '대표' : '일반' })}
                      aria-label={`${user.name} 대표 여부`}
                    >
                      <option value="대표">대표</option>
                      <option value="일반">일반</option>
                    </select>
                  </td>
                  <td>
                    <input value={user.department} onChange={(event) => onUpdateUser(user.id, { department: event.target.value })} aria-label={`${user.name} 소속 학과`} />
                  </td>
                  <td>
                    <label className="user-lab-input">
                      <i style={{ backgroundColor: labTone, color: labTone }} />
                      <input
                        value={user.labProfessor}
                        onChange={(event) => onUpdateUser(user.id, { labProfessor: event.target.value })}
                        aria-label={`${user.name} 소속 연구실`}
                        style={{ borderColor: `${labTone}cc`, backgroundColor: `${labTone}18` }}
                      />
                    </label>
                  </td>
                  <td>
                    <input value={user.phone} onChange={(event) => onUpdateUser(user.id, { phone: event.target.value })} aria-label={`${user.name} 연락처`} />
                  </td>
                  <td>
                    <input value={user.email} onChange={(event) => onUpdateUser(user.id, { email: event.target.value })} aria-label={`${user.name} 이메일`} />
                  </td>
                  <td>
                    <span className={`auth-provider-badge is-${(user.authProvider ?? 'Manual').toLowerCase()}`}>{user.authProvider ?? 'Manual'}</span>
                  </td>
                  <td>
                    <input value={user.memo} onChange={(event) => onUpdateUser(user.id, { memo: event.target.value })} aria-label={`${user.name} 메모`} />
                  </td>
                </tr>
              );
            })}
            {pageUsers.length === 0 && (
              <tr>
                <td colSpan={9} className="permission-empty-row">조건에 맞는 사용자가 없습니다.</td>
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
    </section>
  );
}

function PermissionManagementPage({
  users,
  equipmentItems,
  permissions,
  onSavePermissions
}: {
  users: ManagedUser[];
  equipmentItems: EquipmentItem[];
  permissions: EquipmentPermissionMap;
  onSavePermissions: (userId: string, equipmentIds: string[]) => void;
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
      const keyword = searchTerm.trim().toLowerCase();
      const nameKeyword = nameFilter.trim().toLowerCase();
      const grantedCount = permissions[user.id]?.length ?? 0;
      const matchesSearch = !keyword || `${user.name} ${user.department} ${user.labProfessor} ${grantedCount}`.toLowerCase().includes(keyword);
      const matchesName = !nameKeyword || user.name.toLowerCase().includes(nameKeyword);
      const matchesRole = roleFilter === '전체' || user.roleLevel === roleFilter;
      const matchesDepartment = departmentFilter === '전체' || user.department === departmentFilter;
      const matchesLab = labFilter === '전체' || user.labProfessor === labFilter;
      const matchesPermission = permissionFilter === '전체'
        || (permissionFilter === '부여' && grantedCount > 0)
        || (permissionFilter === '미부여' && grantedCount === 0);
      return matchesSearch && matchesName && matchesRole && matchesDepartment && matchesLab && matchesPermission;
    })
  ), [departmentFilter, labFilter, nameFilter, permissionFilter, permissions, roleFilter, searchTerm, users]);
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
          <option value="대표">대표</option>
          <option value="일반">일반</option>
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
              <th>소속 연구실</th>
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
                  <option value="대표">대표</option>
                  <option value="일반">일반</option>
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
              return (
                <tr key={user.id} className="permission-table-row" onClick={() => setSelectedUser(user)}>
                  <td>{rowIndex}</td>
                  <td><span className="permission-user-pill">{user.name}</span></td>
                  <td><span className={`permission-role-badge ${user.roleLevel === '대표' ? 'is-lead' : 'is-member'}`}>{user.roleLevel}</span></td>
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
          grantedEquipmentIds={permissions[selectedUser.id] ?? []}
          onClose={() => setSelectedUser(null)}
          onSave={(equipmentIds) => {
            onSavePermissions(selectedUser.id, equipmentIds);
          }}
        />
      )}
    </section>
  );
}
function PermissionModal({
  user,
  equipmentItems,
  grantedEquipmentIds,
  onClose,
  onSave
}: {
  user: ManagedUser;
  equipmentItems: EquipmentItem[];
  grantedEquipmentIds: string[];
  onClose: () => void;
  onSave: (equipmentIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(grantedEquipmentIds));
  const [saveFeedbackPhase, setSaveFeedbackPhase] = useState<'idle' | 'feedback' | 'returning'>('idle');
  const saveFeedbackTimers = useRef<number[]>([]);
  const processItems = equipmentItems.filter((item) => item.group === 'process');
  const metrologyItems = equipmentItems.filter((item) => item.group === 'metrology');
  const isLead = user.roleLevel === '대표';

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

  function savePermissions() {
    clearPermissionSaveFeedbackTimers();
    setSaveFeedbackPhase('idle');
    onSave(Array.from(selectedIds));
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
          <span className={`permission-role-badge ${isLead ? 'is-lead' : 'is-member'}`}>{user.roleLevel}</span>
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
          {renderEquipmentGroup('계측 및 분석 장비', metrologyItems)}
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
  onImportConsumables,
  onSave
}: {
  month: string;
  consumables: ConsumableItem[];
  saveFeedbackPhase: 'idle' | 'feedback' | 'returning';
  onMonthChange: (month: string) => void;
  onUpdateConsumable: (id: string, patch: Partial<ConsumableItem>) => void;
  onAddConsumable: () => void;
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const noticeItems = [
  {
    id: 'notice-1',
    category: '운영',
    title: '2026년 6월 장비 공동활용 플랫폼 시범 운영 안내',
    date: '2026.06.22',
    author: '창의융합교육센터',
    views: 184,
    pinned: true,
    summary: '장비예약현황, 교육신청, 권한관리 기능을 중심으로 플랫폼 시범 운영을 시작합니다.',
    body: '시범 운영 기간 동안 장비 예약 및 교육 신청 이력은 플랫폼 기준으로 관리됩니다. 이용자는 예약 전 장비별 교육 인증 상태와 사용 가능 시간을 확인해주시기 바랍니다.'
  },
  {
    id: 'notice-2',
    category: '예약',
    title: '장비 예약 승인 및 취소 기준 안내',
    date: '2026.06.20',
    author: '장비운영팀',
    views: 96,
    pinned: true,
    summary: '관리자 승인 대상 장비와 사용자 직접 예약 가능 장비의 운영 기준을 안내합니다.',
    body: '장비별 사용 조건에 따라 예약 승인 절차가 다를 수 있습니다. 예약 취소가 필요한 경우 마이페이지의 내 예약현황에서 취소 요청을 진행해주세요.'
  },
  {
    id: 'notice-3',
    category: '교육',
    title: '장비사용자 교육 신청 및 인증 절차 안내',
    date: '2026.06.18',
    author: '교육담당자',
    views: 73,
    pinned: false,
    summary: '장비 사용 전 필수 교육 신청 방법과 교육완료 인증 절차를 안내합니다.',
    body: '교육 신청 후 담당자 확인을 거쳐 교육 일정이 확정됩니다. 교육 완료 후 인증 상태가 반영되면 해당 장비의 예약 권한 부여 여부를 확인할 수 있습니다.'
  },
  {
    id: 'notice-4',
    category: '점검',
    title: '클린룸 및 주요 공정 장비 정기 점검 예정',
    date: '2026.06.15',
    author: '시설관리팀',
    views: 58,
    pinned: false,
    summary: '정기 점검 시간에는 일부 장비 예약이 제한될 수 있습니다.',
    body: '점검 일정은 장비예약현황 캘린더에 순차 반영됩니다. 점검 시간과 중복되는 예약은 담당자 확인 후 조정될 수 있습니다.'
  }
];

function NoticePage() {
  const [selectedNoticeId, setSelectedNoticeId] = useState(noticeItems[0]?.id ?? '');
  const selectedNotice = noticeItems.find((notice) => notice.id === selectedNoticeId) ?? noticeItems[0];
  const pinnedCount = noticeItems.filter((notice) => notice.pinned).length;

  return (
    <section className="notice-page">
      <div className="notice-hero">
        <div>
          <p className="consumables-eyebrow">Notice Board</p>
          <h2>공지사항</h2>
          <span>센터 운영, 장비 예약, 교육 인증 관련 주요 공지를 한 곳에서 확인합니다.</span>
        </div>
        <div className="notice-hero-meta" aria-label="공지사항 요약">
          <strong>{noticeItems.length}</strong>
          <span>등록 공지</span>
          <em>중요 {pinnedCount}건</em>
        </div>
      </div>

      <div className="notice-layout">
        <div className="notice-list-panel">
          <div className="notice-toolbar">
            <div className="notice-search-placeholder">
              <Search size={17} />
              <span>제목, 내용, 분류 검색</span>
            </div>
            <button type="button">전체 공지</button>
          </div>

          <div className="notice-list" aria-label="공지사항 목록">
            {noticeItems.map((notice, index) => (
              <button
                key={notice.id}
                type="button"
                className={`notice-row ${selectedNotice.id === notice.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedNoticeId(notice.id)}
              >
                <span className="notice-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="notice-row-main">
                  <span className="notice-row-title">
                    {notice.pinned && <em>중요</em>}
                    {notice.title}
                  </span>
                  <span className="notice-row-summary">{notice.summary}</span>
                </span>
                <span className="notice-row-side">
                  <strong>{notice.category}</strong>
                  <span>{notice.date}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <article className="notice-detail-panel">
          <div className="notice-detail-head">
            <span>{selectedNotice.category}</span>
            {selectedNotice.pinned && <em>상단 고정</em>}
          </div>
          <h3>{selectedNotice.title}</h3>
          <div className="notice-detail-meta">
            <span>작성자 {selectedNotice.author}</span>
            <span>등록일 {selectedNotice.date}</span>
            <span>조회 {selectedNotice.views}</span>
          </div>
          <p>{selectedNotice.body}</p>
          <div className="notice-attachment-box">
            <BookOpen size={18} />
            <div>
              <strong>첨부 및 관련 자료</strong>
              <span>첨부파일, PDF, 교육자료 링크는 추후 관리자 페이지에서 연동 예정입니다.</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

type FaqCategory = '예약' | '장비' | '교육' | '운영' | '계정';

const faqCategoryMeta: Record<FaqCategory, { icon: typeof CalendarDays; tone: string }> = {
  예약: { icon: CalendarDays, tone: 'reservation' },
  장비: { icon: Wrench, tone: 'equipment' },
  교육: { icon: GraduationCap, tone: 'training' },
  운영: { icon: Factory, tone: 'operation' },
  계정: { icon: UserRound, tone: 'account' }
};

const faqCategories: Array<FaqCategory | '전체'> = ['전체', '예약', '장비', '교육', '운영', '계정'];

const faqItems: Array<{
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  updatedAt: string;
}> = [
  {
    id: 'faq-1',
    category: '예약',
    question: '장비 예약은 누가 신청할 수 있나요?',
    answer: '장비별 교육 인증과 권한 부여가 완료된 사용자가 예약할 수 있습니다. 일부 장비는 관리자 승인 후 예약이 확정됩니다.',
    updatedAt: '2026.06.22'
  },
  {
    id: 'faq-2',
    category: '장비',
    question: '장비별 사용 가능 여부는 어디에서 확인하나요?',
    answer: '장비현황에서 장비별 교육 인증, 사용 조건, 위치 정보를 확인하고 장비예약현황에서 실시간 예약 상태를 함께 확인할 수 있습니다.',
    updatedAt: '2026.06.21'
  },
  {
    id: 'faq-3',
    category: '교육',
    question: '장비사용자 교육 이수 여부는 어디에서 확인하나요?',
    answer: '마이페이지의 인증정보 영역과 관리자 권한관리 화면에서 교육 이수 및 장비 권한 상태를 확인할 수 있도록 확장 예정입니다.',
    updatedAt: '2026.06.20'
  },
  {
    id: 'faq-4',
    category: '운영',
    question: '예약 취소나 일정 변경은 어떻게 하나요?',
    answer: '일반 사용자는 마이페이지의 내 예약현황에서 취소 요청을 진행하고, 관리자는 관리자 페이지에서 예약 추가/삭제를 처리할 수 있습니다.',
    updatedAt: '2026.06.18'
  },
  {
    id: 'faq-5',
    category: '계정',
    question: '로그인 후 소속 정보가 다르면 어떻게 수정하나요?',
    answer: '현재는 관리자 사용자관리 화면에서 소속 학과, 연구실, 메모 정보를 수정할 수 있으며 추후 마이페이지 설정과 연동 예정입니다.',
    updatedAt: '2026.06.15'
  }
];

type QnaItem = {
  id: string;
  department: string;
  title: string;
  content?: string;
  status: '답변대기' | '답변완료';
  createdAt: string;
};

const initialQnaItems: QnaItem[] = [
  { id: 'qna-1', department: '전자공학과', title: 'FE-SEM 교육 인증 후 예약 권한 반영 시점 문의', content: '교육 이수 후 장비 예약 가능 권한이 언제 반영되는지 확인 부탁드립니다.', status: '답변완료', createdAt: '2026.06.21' },
  { id: 'qna-2', department: '기계공학과', title: 'Thermal Evaporator 야간 사용 가능 여부 문의', content: '야간 시간대에도 담당자 승인 후 장비 사용이 가능한지 문의드립니다.', status: '답변대기', createdAt: '2026.06.22' },
  { id: 'qna-3', department: '창의융합학과', title: '교육 신청 후 일정 변경 가능 여부 문의', content: '교육 신청 후 개인 일정으로 인해 교육 일정을 변경할 수 있는지 알고 싶습니다.', status: '답변대기', createdAt: '2026.06.22' }
];

function FaqPage() {
  const [activeCategory, setActiveCategory] = useState<FaqCategory | '전체'>('전체');
  const visibleFaqItems = activeCategory === '전체' ? faqItems : faqItems.filter((item) => item.category === activeCategory);

  return (
    <section className="inquiry-page">
      <div className="notice-hero inquiry-hero">
        <div>
          <p className="consumables-eyebrow">Frequently Asked Questions</p>
          <h2>자주 묻는 내용</h2>
          <span>관리자가 등록한 장비 예약, 교육, 계정 관련 주요 안내를 게시물 형태로 제공합니다.</span>
        </div>
        <div className="notice-hero-meta" aria-label="FAQ 요약">
          <strong>{faqItems.length}</strong>
          <span>등록 게시물</span>
          <em>관리자 업로드</em>
        </div>
      </div>

      <div className="faq-filter-bar" aria-label="FAQ 분류 필터">
        {faqCategories.map((category) => {
          const meta = category === '전체' ? null : faqCategoryMeta[category];
          const Icon = meta?.icon ?? LayoutDashboard;
          const count = category === '전체' ? faqItems.length : faqItems.filter((item) => item.category === category).length;
          return (
            <button
              key={category}
              type="button"
              className={`faq-filter-button ${category !== '전체' ? `is-${meta?.tone}` : 'is-all'} ${activeCategory === category ? 'is-active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              <Icon size={17} />
              <span>{category}</span>
              <em>{count}</em>
            </button>
          );
        })}
      </div>

      <div className="faq-grid">
        {visibleFaqItems.map((item) => {
          const meta = faqCategoryMeta[item.category];
          const Icon = meta.icon;
          return (
          <article key={item.id} className="faq-card">
            <div className="faq-card-head">
              <span className={`faq-category-pill is-${meta.tone}`}><Icon size={14} />{item.category}</span>
              <em>{item.updatedAt}</em>
            </div>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function QnaCreateModal({
  onClose,
  onSubmit
}: {
  onClose: () => void;
  onSubmit: (question: { department: string; title: string; content: string }) => void;
}) {
  const [department, setDepartment] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDepartment = department.trim();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedDepartment || !trimmedTitle || !trimmedContent) {
      window.alert('소속 학과, 제목, 문의 내용을 모두 입력해주세요.');
      return;
    }
    onSubmit({ department: trimmedDepartment, title: trimmedTitle, content: trimmedContent });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="qna-modal" role="dialog" aria-modal="true" aria-label="질문 등록" onSubmit={submitQuestion} onMouseDown={(event) => event.stopPropagation()}>
        <div className="qna-modal-head">
          <div>
            <p>User Q&amp;A</p>
            <h3>질문 등록</h3>
          </div>
          <button type="button" className="qna-modal-close" onClick={onClose}>닫기</button>
        </div>
        <label className="reservation-label">소속 학과<input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="예: 전자공학과" /></label>
        <label className="reservation-label">문의 제목<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="문의 제목을 입력" /></label>
        <label className="reservation-label">문의 내용<textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="관리자에게 전달할 문의 내용을 입력하세요." /></label>
        <div className="qna-modal-actions">
          <button type="button" className="qna-modal-cancel" onClick={onClose}>취소</button>
          <button type="submit" className="qna-modal-submit">등록</button>
        </div>
      </form>
    </div>
  );
}

function QnaPage() {
  const [qnaItems, setQnaItems] = useState<QnaItem[]>(() => {
    try {
      const stored = localStorage.getItem('hbnu-qna-items');
      return stored ? JSON.parse(stored) : initialQnaItems;
    } catch {
      return initialQnaItems;
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  function addQuestion(question: { department: string; title: string; content: string }) {
    const now = new Date();
    const createdAt = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    const nextItems = [
      {
        id: `qna-${Date.now()}`,
        department: question.department,
        title: question.title,
        content: question.content,
        status: '답변대기' as const,
        createdAt
      },
      ...qnaItems
    ];
    setQnaItems(nextItems);
    localStorage.setItem('hbnu-qna-items', JSON.stringify(nextItems));
    setShowCreateModal(false);
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleQnaItems = normalizedSearch
    ? qnaItems.filter((item) => (
      item.department.toLowerCase().includes(normalizedSearch)
      || item.title.toLowerCase().includes(normalizedSearch)
      || (item.content ?? '').toLowerCase().includes(normalizedSearch)
    ))
    : qnaItems;

  return (
    <section className="inquiry-page qna-page">
      <div className="notice-hero inquiry-hero">
        <div>
          <p className="consumables-eyebrow">User Q&amp;A</p>
          <h2>사용자 Q&amp;A</h2>
          <span>장비 운영, 예약, 교육 인증 관련 문의를 관리자에게 등록하고 답변 상태를 확인합니다.</span>
        </div>
        <div className="notice-hero-meta" aria-label="Q&A 요약">
          <strong>{qnaItems.length}</strong>
          <span>등록 문의</span>
          <em>대기 {qnaItems.filter((item) => item.status === '답변대기').length}건</em>
        </div>
      </div>

      <div className="qna-compose">
        <label>
          문의내용 검색
          <span className="qna-search-field">
            <Search size={17} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="소속, 제목, 문의내용 검색" />
          </span>
        </label>
        <button type="button" onClick={() => setShowCreateModal(true)}>질문 등록</button>
      </div>

      <div className="qna-table-wrap">
        <table className="qna-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>소속(학과)</th>
              <th>제목</th>
              <th>답변</th>
              <th>작성일</th>
            </tr>
          </thead>
          <tbody>
            {visibleQnaItems.map((item, index) => (
              <tr key={item.id}>
                <td>{visibleQnaItems.length - index}</td>
                <td>{item.department}</td>
                <td>{item.title}</td>
                <td>
                  <span className={`qna-status ${item.status === '답변완료' ? 'is-complete' : 'is-pending'}`}>
                    <i />
                    {item.status}
                  </span>
                </td>
                <td>{item.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showCreateModal && <QnaCreateModal onClose={() => setShowCreateModal(false)} onSubmit={addQuestion} />}
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
  const [selectedConsumableMonth, setSelectedConsumableMonth] = useState('2026-06');
  const [monthlyConsumables, setMonthlyConsumables] = useState<Record<string, ConsumableItem[]>>(() => {
    try {
      const stored = localStorage.getItem('hbnu-consumables-monthly-data');
      return stored ? JSON.parse(stored) : { '2026-06': cloneConsumables() };
    } catch {
      return { '2026-06': cloneConsumables() };
    }
  });
  const [consumablesUpdatedAt, setConsumablesUpdatedAt] = useState(() => (
    localStorage.getItem('hbnu-consumables-updated-at') ?? new Date().toISOString()
  ));
  const [hasUnsavedConsumables, setHasUnsavedConsumables] = useState(false);
  const [saveFeedbackPhase, setSaveFeedbackPhase] = useState<'idle' | 'feedback' | 'returning'>('idle');
  const saveFeedbackTimers = useRef<number[]>([]);
  const [userSaveFeedbackPhase, setUserSaveFeedbackPhase] = useState<'idle' | 'feedback' | 'returning'>('idle');
  const userSaveFeedbackTimers = useRef<number[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(() => {
    try {
      const stored = localStorage.getItem('hbnu-managed-users');
      if (!stored) return cloneManagedUsers();
      const parsed = JSON.parse(stored) as ManagedUser[];
      return parsed.length >= initialManagedUsers.length ? parsed : cloneManagedUsers();
    } catch {
      return cloneManagedUsers();
    }
  });
  const [usersUpdatedAt, setUsersUpdatedAt] = useState(() => (
    localStorage.getItem('hbnu-users-updated-at') ?? new Date().toISOString()
  ));
  const [equipmentPermissions, setEquipmentPermissions] = useState<EquipmentPermissionMap>(() => {
    try {
      const stored = localStorage.getItem('hbnu-equipment-permissions');
      if (!stored) return createPreviewEquipmentPermissions();
      const parsed = JSON.parse(stored) as EquipmentPermissionMap;
      const totalGranted = Object.values(parsed).reduce((sum, equipmentIds) => sum + equipmentIds.length, 0);
      return totalGranted > 0 ? parsed : createPreviewEquipmentPermissions();
    } catch {
      return createPreviewEquipmentPermissions();
    }
  });
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
  const sessionUserName = (() => {
    try {
      const stored = localStorage.getItem('hbnu-session-user');
      return stored ? JSON.parse(stored).name ?? 'USER NAME' : 'USER NAME';
    } catch {
      return 'USER NAME';
    }
  })();

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

  function changeConsumableMonth(month: string) {
    setSelectedConsumableMonth(month);
    setMonthlyConsumables((current) => (
      current[month]
        ? current
        : { ...current, [month]: cloneConsumables(current[selectedConsumableMonth] ?? initialConsumables) }
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

  function saveConsumables() {
    const savedAt = new Date().toISOString();
    localStorage.setItem('hbnu-consumables-monthly-data', JSON.stringify(monthlyConsumables));
    localStorage.setItem('hbnu-consumables-updated-at', savedAt);
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
    setManagedUsers((current) => current.map((user) => (
      user.id === id ? { ...user, ...patch } : user
    )));
  }

  function addManagedUser(user: Omit<ManagedUser, 'id' | 'index'>) {
    clearUserSaveFeedbackTimers();
    setUserSaveFeedbackPhase('idle');
    setManagedUsers((current) => {
      const next = [
        ...current,
        {
          ...user,
          id: `managed-user-${Date.now()}`,
          index: current.length + 1,
          authProvider: user.authProvider ?? 'Manual'
        }
      ];
      return next.map((item, index) => ({ ...item, index: index + 1 }));
    });
  }

  function importManagedUsers(rows: ManagedUser[]) {
    if (rows.length === 0) return;
    clearUserSaveFeedbackTimers();
    setUserSaveFeedbackPhase('idle');
    setManagedUsers(rows.map((user, index) => ({ ...user, index: index + 1 })));
  }

  function saveManagedUsers() {
    const savedAt = new Date().toISOString();
    const normalized = managedUsers.map((user, index) => ({ ...user, index: index + 1 }));
    setManagedUsers(normalized);
    localStorage.setItem('hbnu-managed-users', JSON.stringify(normalized));
    localStorage.setItem('hbnu-users-updated-at', savedAt);
    setUsersUpdatedAt(savedAt);
    clearUserSaveFeedbackTimers();
    setUserSaveFeedbackPhase('idle');
    window.requestAnimationFrame(() => setUserSaveFeedbackPhase('feedback'));
    userSaveFeedbackTimers.current = [
      window.setTimeout(() => setUserSaveFeedbackPhase('returning'), 2600),
      window.setTimeout(() => {
        setUserSaveFeedbackPhase('idle');
        userSaveFeedbackTimers.current = [];
      }, 3500)
    ];
  }

  function saveEquipmentPermissions(userId: string, equipmentIds: string[]) {
    setEquipmentPermissions((current) => {
      const next = { ...current, [userId]: equipmentIds };
      localStorage.setItem('hbnu-equipment-permissions', JSON.stringify(next));
      return next;
    });
  }

  function registerAuthenticatedUser(provider: 'Google' | 'Kakao', user: { name?: string; email?: string }) {
    const savedAt = new Date().toISOString();
    setManagedUsers((current) => {
      const email = user.email ?? `${provider.toLowerCase()}-preview@hbnu.local`;
      const name = user.name ?? 'USER NAME';
      const exists = current.some((item) => item.email === email);
      const next: ManagedUser[] = exists
        ? current.map((item) => item.email === email ? { ...item, name, authProvider: provider } : item)
        : [
            ...current,
            {
              id: `auth-user-${Date.now()}`,
              index: current.length + 1,
              name,
              roleLevel: '일반' as const,
              department: '가입 정보 입력 필요',
              labProfessor: '백근우 교수님',
              phone: '',
              email,
              memo: '인증 완료 후 상세 정보 입력 대기',
              authProvider: provider
            }
          ];
      const normalized = next.map((item, index) => ({ ...item, index: index + 1 }));
      localStorage.setItem('hbnu-managed-users', JSON.stringify(normalized));
      return normalized;
    });
    localStorage.setItem('hbnu-users-updated-at', savedAt);
    setUsersUpdatedAt(savedAt);
  }

  const activeEquipmentItems = equipmentItems.filter((item) => !deletedEquipmentIds.includes(item.id));
  const activeConsumables = monthlyConsumables[selectedConsumableMonth] ?? cloneConsumables();

  return (
    <div className="min-h-screen">
      <LoadingOverlay visible={loading} />
      <InstitutionHeader onNavigate={navigate} sessionRole={sessionRole} />
      <div className="app-shell mx-auto max-w-[1800px] px-4 py-5 lg:px-6 2xl:px-8">
        <SidebarNavigation activePage={activePage} onNavigate={navigate} />
        <main className="app-main">
          {activePage === 'home' && (
            <>
              <Dashboard
                equipmentItems={activeEquipmentItems}
                calendarEvents={reservationEvents}
                managedUsers={managedUsers}
                sessionUserName={sessionUserName}
                sessionRole={sessionRole}
                equipmentPermissions={equipmentPermissions}
                onNavigate={navigate}
                onOpenEquipment={openEquipment}
              />
            </>
          )}
          {activePage === 'notice' && <NoticePage />}
          {activePage === 'facility' && <FacilityPage sessionRole={sessionRole} />}
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
          {activePage === 'faq' && <FaqPage />}
          {activePage === 'qna' && <QnaPage />}
          {activePage === 'admin' && (
            <AdminPage
              equipmentItems={equipmentItems}
              calendarEvents={reservationEvents}
              onAddReservation={addReservation}
              onDeleteReservation={deleteReservation}
              onNavigate={navigate}
              consumablesUpdatedAt={consumablesUpdatedAt}
              usersUpdatedAt={usersUpdatedAt}
            />
          )}
          {activePage === 'users' && (
            <UserManagementPage
              users={managedUsers}
              saveFeedbackPhase={userSaveFeedbackPhase}
              onUpdateUser={updateManagedUser}
              onAddUser={addManagedUser}
              onImportUsers={importManagedUsers}
              onSave={saveManagedUsers}
            />
          )}
          {activePage === 'permissions' && (
            <PermissionManagementPage
              users={managedUsers}
              equipmentItems={activeEquipmentItems}
              permissions={equipmentPermissions}
              onSavePermissions={saveEquipmentPermissions}
            />
          )}
          {activePage === 'consumables' && (
            <ConsumablesPage
              month={selectedConsumableMonth}
              consumables={activeConsumables}
              saveFeedbackPhase={saveFeedbackPhase}
              onMonthChange={changeConsumableMonth}
              onUpdateConsumable={updateConsumable}
              onAddConsumable={addConsumable}
              onImportConsumables={importConsumables}
              onSave={saveConsumables}
            />
          )}
          {activePage === 'login' && (
            <LoginPage
              onAuthenticated={(role) => setSessionRole(role)}
              onRegisterUser={registerAuthenticatedUser}
            />
          )}
          {activePage === 'center' && <PlaceholderPage title="센터소개" />}
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

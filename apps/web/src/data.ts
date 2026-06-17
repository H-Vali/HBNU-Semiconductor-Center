export type EquipmentGroup = 'process' | 'metrology';

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  group: EquipmentGroup;
  groupName: string;
  location: string;
  image: string;
  features: string[];
  condition: string;
  utilization: number;
  usageHours: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  status: 'pending' | 'approved' | 'canceled';
}

const processEquipment = [
  'Photolithography Aligner',
  'Spin Coater',
  'Thermal Evaporator',
  'Sputter System',
  'PECVD',
  'RIE Etcher',
  'Dicing Saw',
  'Wire Bonder',
  'Mask Aligner',
  'Clean Bench',
  'Fume Hood',
  'Tube Furnace',
  'Rapid Thermal Annealer'
];

const metrologyEquipment = [
  'FE-SEM',
  'TEM',
  'XRD',
  'XPS',
  'AFM',
  'Raman Spectrometer',
  'Probe Station',
  'Semiconductor Parameter Analyzer',
  'Ellipsometer',
  'FT-IR',
  'UV-Vis Spectrophotometer'
];

export const equipment: EquipmentItem[] = [...processEquipment, ...metrologyEquipment].map((name, index) => {
  const isProcess = index < processEquipment.length;

  return {
    id: `eq-${index + 1}`,
    name,
    category: isProcess ? '공정장비' : '측정 및 분석장비',
    group: isProcess ? 'process' : 'metrology',
    groupName: isProcess ? '공정' : '측정·분석',
    location: `실습실 ${Math.floor(index / 6) + 1}`,
    image: isProcess
      ? `https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80&sig=${index}`
      : `https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=900&q=80&sig=${index}`,
    features: isProcess
      ? ['공정 레시피 관리', '교육 인증 연동', '예약 캘린더 기록']
      : ['분석 결과 기록', '샘플 측정 예약', '교육 인증 연동'],
    condition: index % 3 === 0 ? '교육 이수 및 관리자 승인 필요' : '교육 이수 후 사용 가능',
    utilization: 42 + ((index * 7) % 53),
    usageHours: 80 + ((index * 19) % 170)
  };
});

export const monthlyUsage = [
  { month: '1월', hours: 420, delta: 8 },
  { month: '2월', hours: 491, delta: 17 },
  { month: '3월', hours: 541, delta: 10 },
  { month: '4월', hours: 556, delta: 3 },
  { month: '5월', hours: 540, delta: -3 },
  { month: '6월', hours: 524, delta: -3 },
  { month: '7월', hours: 538, delta: 3 },
  { month: '8월', hours: 587, delta: 9 },
  { month: '9월', hours: 663, delta: 13 },
  { month: '10월', hours: 744, delta: 12 },
  { month: '11월', hours: 806, delta: 8 },
  { month: '12월', hours: 834, delta: 3 }
];

export const events: CalendarEvent[] = [
  { id: '1', title: 'FE-SEM 분석', start: '2026-06-17T10:00:00', end: '2026-06-17T12:00:00', status: 'approved' },
  { id: '2', title: 'Spin Coater 공정', start: '2026-06-18T14:00:00', end: '2026-06-18T16:00:00', status: 'pending' },
  { id: '3', title: 'Probe Station 측정', start: '2026-06-21T09:30:00', end: '2026-06-21T11:30:00', status: 'approved' }
];

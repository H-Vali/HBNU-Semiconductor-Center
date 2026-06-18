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
    groupName: isProcess ? '공정' : '측정 및 분석',
    location: `공정동 ${Math.floor(index / 6) + 1}층`,
    image: `https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=900&q=80&ixid=${index}`,
    features: ['예약 캘린더', '교육 인증', '사용 로그'],
    condition: index % 3 === 0 ? '교육 이수 및 관리자 승인 필요' : '교육 이수 후 사용 가능',
    utilization: 42 + ((index * 7) % 53),
    usageHours: 80 + ((index * 19) % 170)
  };
});

export const monthlyUsage = [
  { month: '11월', hours: 612, delta: 5 },
  { month: '12월', hours: 706, delta: 15 },
  { month: '1월', hours: 668, delta: -5 },
  { month: '2월', hours: 742, delta: 11 },
  { month: '3월', hours: 689, delta: -7 },
  { month: '4월', hours: 801, delta: 16 },
  { month: '5월', hours: 756, delta: -6 },
  { month: '6월', hours: 834, delta: 3 }
];

export const events = [
  { id: '1', title: 'FE-SEM 분석', start: '2026-06-17T10:00:00', end: '2026-06-17T12:00:00', status: 'approved' },
  { id: '2', title: 'Spin Coater 공정', start: '2026-06-18T14:00:00', end: '2026-06-18T16:00:00', status: 'pending' },
  { id: '3', title: 'Probe Station 측정', start: '2026-06-21T09:30:00', end: '2026-06-21T11:30:00', status: 'approved' }
];

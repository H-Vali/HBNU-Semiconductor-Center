export const equipment = [
  'FE-SEM', 'TEM', 'XRD', 'XPS', 'AFM', 'Raman Spectrometer', 'Photolithography Aligner', 'Spin Coater',
  'Thermal Evaporator', 'Sputter System', 'PECVD', 'RIE Etcher', 'Probe Station', 'Semiconductor Parameter Analyzer',
  'Ellipsometer', 'FT-IR', 'UV-Vis Spectrophotometer', 'Dicing Saw', 'Wire Bonder', 'Mask Aligner',
  'Clean Bench', 'Fume Hood', 'Tube Furnace', 'Rapid Thermal Annealer'
].map((name, index) => ({
  id: `eq-${index + 1}`,
  name,
  category: index < 6 ? '분석장비' : index < 14 ? '공정장비' : '패키징/지원',
  location: `공정동 ${Math.floor(index / 6) + 1}층`,
  image: `https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=900&q=80&ixid=${index}`,
  features: ['예약 캘린더', '교육 인증', '사용 로그'],
  condition: index % 3 === 0 ? '교육 이수 및 관리자 승인 필요' : '교육 이수 후 사용 가능',
  utilization: 42 + ((index * 7) % 53),
  usageHours: 80 + ((index * 19) % 170)
}));

export const monthlyUsage = [
  '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'
].map((month, index) => ({ month, hours: 420 + Math.round(Math.sin(index / 1.8) * 90) + index * 22 }));

export const events = [
  { id: '1', title: 'FE-SEM 분석', start: '2026-06-17T10:00:00', end: '2026-06-17T12:00:00', status: 'approved' },
  { id: '2', title: 'Spin Coater 공정', start: '2026-06-18T14:00:00', end: '2026-06-18T16:00:00', status: 'pending' },
  { id: '3', title: 'Probe Station 측정', start: '2026-06-21T09:30:00', end: '2026-06-21T11:30:00', status: 'approved' }
];

export const equipment = [
    'FE-SEM', 'TEM', 'XRD', 'XPS', 'AFM', 'Raman Spectrometer', 'Photolithography Aligner', 'Spin Coater',
    'Thermal Evaporator', 'Sputter System', 'PECVD', 'RIE Etcher', 'Probe Station', 'Semiconductor Parameter Analyzer',
    'Ellipsometer', 'FT-IR', 'UV-Vis Spectrophotometer', 'Dicing Saw', 'Wire Bonder', 'Mask Aligner',
    'Clean Bench', 'Fume Hood', 'Tube Furnace', 'Rapid Thermal Annealer'
].map((name, index) => ({
    id: `eq-${index + 1}`,
    name,
    category: index < 6 ? 'Analysis' : index < 14 ? 'Process' : 'Packaging',
    location: `공정동 ${Math.floor(index / 6) + 1}층`,
    imageUrl: `https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=900&q=80&sig=${index}`,
    features: ['실시간 예약', '교육 인증 필요', '관리자 승인'],
    usageConditions: index % 3 === 0 ? '교육 이수 및 관리자 승인 후 사용 가능' : '교육 이수 후 예약 가능',
    utilization: 42 + ((index * 7) % 53)
}));
export const reservations = [
    { id: 'r-1', equipmentId: 'eq-1', title: 'FE-SEM 분석', startsAt: '2026-06-17T10:00:00+09:00', endsAt: '2026-06-17T12:00:00+09:00', status: 'approved' },
    { id: 'r-2', equipmentId: 'eq-8', title: 'Spin Coater 공정', startsAt: '2026-06-18T14:00:00+09:00', endsAt: '2026-06-18T16:00:00+09:00', status: 'pending' },
    { id: 'r-3', equipmentId: 'eq-13', title: 'Probe Station 측정', startsAt: '2026-06-21T09:30:00+09:00', endsAt: '2026-06-21T11:30:00+09:00', status: 'approved' }
];

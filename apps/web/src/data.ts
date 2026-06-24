export type EquipmentGroup = 'process' | 'metrology';

export interface EquipmentItem {
  id: string;
  name: string;
  model?: string;
  category: string;
  group: EquipmentGroup;
  groupName: string;
  location: string;
  image: string;
  features: string[];
  condition: string;
  status?: 'available' | 'unavailable';
  description?: string;
  managerId?: string;
  vendorName?: string;
  vendorContactName?: string;
  vendorContactPosition?: string;
  vendorContactPhone?: string;
  utilization: number;
  usageHours: number;
}

const processImage = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80';
const metrologyImage = 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=900&q=80';

const equipmentRows: Array<{
  name: string;
  model: string;
  location: string;
  group: EquipmentGroup;
  category: string;
  vendorName: string;
  vendorContactName: string;
  vendorContactPosition: string;
  vendorContactPhone: string;
  description: string;
}> = [
  { name: 'Audio precision', model: '81150A', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '㈜제이스', vendorContactName: '이재광', vendorContactPosition: '대표', vendorContactPhone: '042-485-9545', description: '오디오 및 전기적 신호 특성 분석을 위한 계측 장비입니다.' },
  { name: 'LPKF', model: 'Promat, Multipress', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: 'LPKF', vendorContactName: '조진상', vendorContactPosition: '차장', vendorContactPhone: '010-8957-9722', description: 'PCB 및 시제품 제작, 패키징 실습 지원 장비입니다.' },
  { name: 'mini SEM', model: 'EM-30N', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '디케이엔씨', vendorContactName: '김동균', vendorContactPosition: '대표', vendorContactPhone: '010-4747-0902', description: '시료 표면 미세 구조를 관찰하는 주사전자현미경 장비입니다.' },
  { name: 'Multimeter', model: 'Keithley, (US)DMM7510', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '㈜제이스', vendorContactName: '이재광', vendorContactPosition: '대표', vendorContactPhone: '042-485-9545', description: '전압, 전류, 저항 등 기본 전기 특성 측정 장비입니다.' },
  { name: 'Optical Profiler', model: 'Keyence, (JP)VK-X3000', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '기술제작소', vendorContactName: '신창훈', vendorContactPosition: '대표', vendorContactPhone: '010-9818-1821', description: '비접촉 방식으로 표면 형상과 단차를 측정하는 장비입니다.' },
  { name: 'Power Supply', model: 'Keysight technologies, (MY)EDU36311A', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '㈜제이스', vendorContactName: '이재광', vendorContactPosition: '대표', vendorContactPhone: '042-485-9545', description: '실험 회로와 소자 구동을 위한 정밀 전원 공급 장비입니다.' },
  { name: 'Source Meter', model: 'B2912B', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '㈜제이스', vendorContactName: '이재광', vendorContactPosition: '대표', vendorContactPhone: '042-485-9545', description: '전압·전류 소스 및 측정을 통합 수행하는 소자 분석 장비입니다.' },
  { name: 'UV Ozone Cleaner', model: 'AC-6', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '㈜아텍엘티에스', vendorContactName: '한경희', vendorContactPosition: '대표', vendorContactPhone: '031-346-6036', description: 'UV 오존을 활용해 기판 표면 유기 오염물을 제거하는 장비입니다.' },
  { name: '반도체검사기', model: '4200A-SCS', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '아이브이솔루션', vendorContactName: '박덕현', vendorContactPosition: '차장', vendorContactPhone: '010-2252-4786', description: '반도체 소자의 I-V, C-V 등 전기적 특성을 분석하는 검사 장비입니다.' },
  { name: '스펙트럼 분석기', model: 'Keysight technologies, (MY)N9030B, 50GHz', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '㈜제이스', vendorContactName: '이재광', vendorContactPosition: '대표', vendorContactPhone: '042-485-9545', description: '고주파 신호의 주파수 성분과 스펙트럼 특성을 분석하는 장비입니다.' },
  { name: '신호발생기', model: '(US)N5183A', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '㈜제이스', vendorContactName: '이재광', vendorContactPosition: '대표', vendorContactPhone: '042-485-9545', description: '소자 및 회로 측정을 위한 RF/마이크로파 신호 발생 장비입니다.' },
  { name: '오실로스코프', model: 'EXR204A', location: 'N11동 107호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '㈜제이스', vendorContactName: '이재광', vendorContactPosition: '대표', vendorContactPhone: '042-485-9545', description: '시간 영역 전기 신호 파형을 관찰하고 분석하는 장비입니다.' },
  { name: '광학현미경', model: 'Olympus, (JP)BX53M', location: 'N11동 113호', group: 'metrology', category: '검사·계측·패키징 장비', vendorName: '디케이엔씨', vendorContactName: '김동균', vendorContactPosition: '대표', vendorContactPhone: '010-4747-0902', description: '시료의 표면 상태와 패턴을 광학적으로 관찰하는 장비입니다.' },
  { name: 'Ebeam Evaporator', model: 'e-beam', location: 'N11동 113호', group: 'process', category: '공정 장비', vendorName: '코리아바큠테크', vendorContactName: '-', vendorContactPosition: '과장', vendorContactPhone: '010-3779-6104', description: '전자빔 증착 방식으로 금속 및 박막을 형성하는 공정 장비입니다.' },
  { name: 'Mask Aligner', model: 'MDA-600S', location: 'N11동 113호', group: 'process', category: '공정 장비', vendorName: '마이다스시스템', vendorContactName: '권영민', vendorContactPosition: '과장', vendorContactPhone: '010-4550-7620', description: '마스크 정렬과 노광 공정을 수행하는 반도체 패터닝 장비입니다.' },
  { name: 'Spin Coater', model: 'SPIN-3000BD, 152.4mm', location: 'N11동 113호', group: 'process', category: '공정 장비', vendorName: '마이다스시스템', vendorContactName: '추혜승', vendorContactPosition: '대리', vendorContactPhone: '010-3910-7620', description: '포토레지스트 및 박막 용액을 균일하게 코팅하는 장비입니다.' },
  { name: '건식식각장치', model: 'VITA, 300W', location: 'N11동 113호', group: 'process', category: '공정 장비', vendorName: '펨토사이언스', vendorContactName: '박홍근', vendorContactPosition: '사원', vendorContactPhone: '010-5185-3083', description: '플라즈마 기반 건식 식각 공정을 수행하는 반도체 공정 장비입니다.' },
  { name: 'ALD', model: 'SPACE S', location: 'N11동 113호', group: 'process', category: '공정 장비', vendorName: '울텍', vendorContactName: '강창훈', vendorContactPosition: '부장', vendorContactPhone: '010-3632-6447', description: '원자층 단위의 박막을 정밀하게 증착하는 공정 장비입니다.' },
  { name: 'Wet Station (산)', model: '8인치 One-Cassettle', location: 'N11동 113호', group: 'process', category: '공정 장비', vendorName: '씨앤에스엔지니어링', vendorContactName: '안준우', vendorContactPosition: '-', vendorContactPhone: '010-9606-0152', description: '산 계열 약액을 활용한 습식 세정 및 식각 공정 장비입니다.' },
  { name: 'Wet Station (유기,염기)', model: '8인치 One-Cassettle', location: 'N11동 113호', group: 'process', category: '공정 장비', vendorName: '씨앤에스엔지니어링', vendorContactName: '안준우', vendorContactPosition: '-', vendorContactPhone: '010-9606-0152', description: '유기·염기 계열 약액을 활용한 습식 공정 장비입니다.' },
  { name: 'Sputter', model: 'sputter', location: 'N11동 113호', group: 'process', category: '공정 장비', vendorName: '포엠일렉트로옵틱', vendorContactName: '송웅선', vendorContactPosition: '차장', vendorContactPhone: '010-3788-8498', description: '스퍼터링 방식으로 금속 및 박막을 증착하는 공정 장비입니다.' }
];

export const equipment: EquipmentItem[] = equipmentRows.map((item, index) => ({
  id: `eq-${index + 1}`,
  name: item.name.trim(),
  model: item.model,
  category: item.category,
  group: item.group,
  groupName: item.group === 'process' ? '공정' : '검사·계측·패키징',
  location: item.location,
  image: item.group === 'process' ? `${processImage}&ixid=process-${index}` : `${metrologyImage}&ixid=metrology-${index}`,
  features: ['예약 캘린더', '교육 인증', '사용 로그'],
  condition: '교육 이수 후 담당자 승인 시 사용 가능',
  status: 'available',
  description: item.description,
  vendorName: item.vendorName,
  vendorContactName: item.vendorContactName,
  vendorContactPosition: item.vendorContactPosition,
  vendorContactPhone: item.vendorContactPhone,
  utilization: 44 + ((index * 9) % 45),
  usageHours: 72 + ((index * 17) % 155)
}));

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
  { id: '1', title: 'mini SEM 분석', equipmentId: 'eq-3', start: '2026-06-17T10:00:00', end: '2026-06-17T12:00:00', status: 'approved' },
  { id: '2', title: 'Spin Coater 공정', equipmentId: 'eq-16', start: '2026-06-18T14:00:00', end: '2026-06-18T16:00:00', status: 'pending' },
  { id: '3', title: '반도체검사기 측정', equipmentId: 'eq-9', start: '2026-06-21T09:30:00', end: '2026-06-21T11:30:00', status: 'approved' }
];

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Factory, GraduationCap, LayoutDashboard, MessageSquare, Search, UserRound, Wrench } from 'lucide-react';
import { STORAGE_KEYS } from '../appStorage';

type Role = 'USER' | 'ADMIN';

function formatSeoulDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
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
  answer?: string;
  answeredAt?: string;
  answeredBy?: string;
};

const initialQnaItems: QnaItem[] = [
  { id: 'qna-1', department: '전자공학과', title: 'mini SEM 교육 인증 후 예약 권한 반영 시점 문의', content: '교육 이수 후 장비 예약 가능 권한이 언제 반영되는지 확인 부탁드립니다.', status: '답변완료', createdAt: '2026.06.21' },
  { id: 'qna-2', department: '기계공학과', title: 'Ebeam Evaporator 야간 사용 가능 여부 문의', content: '야간 시간대에도 담당자 승인 후 장비 사용이 가능한지 문의드립니다.', status: '답변대기', createdAt: '2026.06.22' },
  { id: 'qna-3', department: '창의융합학과', title: '교육 신청 후 일정 변경 가능 여부 문의', content: '교육 신청 후 개인 일정으로 인해 교육 일정을 변경할 수 있는지 알고 싶습니다.', status: '답변대기', createdAt: '2026.06.22' }
];

export function FaqPage() {
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

const QNA_PAGE_SIZE = 5;

export function QnaPage({ sessionRole }: { sessionRole: Role | null }) {
  const [qnaItems, setQnaItems] = useState<QnaItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.qnaItems);
      return stored ? JSON.parse(stored) : initialQnaItems;
    } catch {
      return initialQnaItems;
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedQnaId, setSelectedQnaId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [answerDraft, setAnswerDraft] = useState('');
  const [answerSavePhase, setAnswerSavePhase] = useState<'idle' | 'saved' | 'returning'>('idle');
  const answerSaveTimers = useRef<number[]>([]);
  const isAdmin = sessionRole === 'ADMIN';

  useEffect(() => () => {
    answerSaveTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  function persistQnaItems(nextItems: QnaItem[]) {
    setQnaItems(nextItems);
    localStorage.setItem(STORAGE_KEYS.qnaItems, JSON.stringify(nextItems));
  }

  function addQuestion(question: { department: string; title: string; content: string }) {
    const now = new Date();
    const createdAt = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    const newQuestion: QnaItem = {
      id: `qna-${Date.now()}`,
      department: question.department,
      title: question.title,
      content: question.content,
      status: '답변대기',
      createdAt
    };
    const nextItems = [
      newQuestion,
      ...qnaItems
    ];
    persistQnaItems(nextItems);
    setSelectedQnaId(newQuestion.id);
    setCurrentPage(1);
    setShowCreateModal(false);
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleQnaItems = useMemo(() => (
    normalizedSearch
      ? qnaItems.filter((item) => (
      item.department.toLowerCase().includes(normalizedSearch)
      || item.title.toLowerCase().includes(normalizedSearch)
      || (item.content ?? '').toLowerCase().includes(normalizedSearch)
      || (item.answer ?? '').toLowerCase().includes(normalizedSearch)
    ))
      : qnaItems
  ), [normalizedSearch, qnaItems]);
  const totalPages = Math.max(1, Math.ceil(visibleQnaItems.length / QNA_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * QNA_PAGE_SIZE;
  const pagedQnaItems = visibleQnaItems.slice(pageStartIndex, pageStartIndex + QNA_PAGE_SIZE);
  const selectedQna = qnaItems.find((item) => item.id === selectedQnaId) ?? null;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!visibleQnaItems.length) {
      setSelectedQnaId(null);
      return;
    }
    if (!selectedQnaId || !visibleQnaItems.some((item) => item.id === selectedQnaId)) {
      setSelectedQnaId(visibleQnaItems[0].id);
    }
  }, [selectedQnaId, visibleQnaItems]);

  useEffect(() => {
    setAnswerDraft(selectedQna?.answer ?? '');
    setAnswerSavePhase('idle');
    answerSaveTimers.current.forEach((timer) => window.clearTimeout(timer));
    answerSaveTimers.current = [];
  }, [selectedQna?.id]);

  function updateSearchTerm(value: string) {
    setSearchTerm(value);
    setCurrentPage(1);
  }

  function saveAnswer() {
    if (!isAdmin || !selectedQna) return;
    const trimmedAnswer = answerDraft.trim();
    if (!trimmedAnswer) {
      window.alert('답변 내용을 입력해주세요.');
      return;
    }
    const answeredAt = formatSeoulDateTime(new Date().toISOString());
    const nextItems = qnaItems.map((item) => (
      item.id === selectedQna.id
        ? {
          ...item,
          answer: trimmedAnswer,
          answeredAt,
          answeredBy: '관리자',
          status: '답변완료' as const
        }
        : item
    ));
    persistQnaItems(nextItems);
    answerSaveTimers.current.forEach((timer) => window.clearTimeout(timer));
    answerSaveTimers.current = [
      window.setTimeout(() => setAnswerSavePhase('returning'), 1200),
      window.setTimeout(() => setAnswerSavePhase('idle'), 1900)
    ];
    setAnswerSavePhase('saved');
  }

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
            <input value={searchTerm} onChange={(event) => updateSearchTerm(event.target.value)} placeholder="소속, 제목, 문의내용, 답변 검색" />
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
            {pagedQnaItems.map((item, index) => (
              <tr
                key={item.id}
                className={`qna-table-row ${selectedQnaId === item.id ? 'is-selected' : ''}`}
                tabIndex={0}
                onClick={() => setSelectedQnaId(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedQnaId(item.id);
                  }
                }}
              >
                <td>{visibleQnaItems.length - (pageStartIndex + index)}</td>
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
            {!pagedQnaItems.length && (
              <tr>
                <td colSpan={5} className="qna-empty-row">검색 조건에 맞는 문의가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {visibleQnaItems.length > QNA_PAGE_SIZE && (
        <div className="permission-pagination qna-pagination" aria-label="문의사항 페이지 이동">
          <span>페이지 <strong>{currentPage}</strong> / {totalPages} · 총 {visibleQnaItems.length}건</span>
          <div>
            <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>처음</button>
            <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>이전</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={currentPage === page ? 'is-active' : ''}
                onClick={() => setCurrentPage(page)}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            ))}
            <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>다음</button>
            <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>마지막</button>
          </div>
        </div>
      )}
      <div className="qna-detail-panel" aria-live="polite">
        {selectedQna ? (
          <>
            <div className="qna-detail-head">
              <div>
                <p>SELECTED QUESTION</p>
                <h3>{selectedQna.title}</h3>
              </div>
              <span className={`qna-status ${selectedQna.status === '답변완료' ? 'is-complete' : 'is-pending'}`}>
                <i />
                {selectedQna.status}
              </span>
            </div>
            <div className="qna-detail-meta">
              <span>소속 <strong>{selectedQna.department}</strong></span>
              <span>작성일 <strong>{selectedQna.createdAt}</strong></span>
              {selectedQna.answeredAt && <span>답변일 <strong>{selectedQna.answeredAt}</strong></span>}
            </div>
            <div className="qna-detail-content">
              <strong>문의내용</strong>
              <p>{selectedQna.content}</p>
            </div>
            <div className="qna-answer-section">
              <div className="qna-answer-head">
                <h4>관리자 답변</h4>
                <span>{selectedQna.answeredBy ? `${selectedQna.answeredBy} · ${selectedQna.answeredAt ?? ''}` : '답변 대기'}</span>
              </div>
              {isAdmin ? (
                <>
                  <textarea
                    value={answerDraft}
                    onChange={(event) => setAnswerDraft(event.target.value)}
                    placeholder="문의에 대한 관리자 답변을 입력하세요."
                    aria-label="관리자 답변 입력"
                  />
                  <div className="qna-answer-actions">
                    <button
                      type="button"
                      className={`qna-answer-save is-${answerSavePhase}`}
                      onClick={saveAnswer}
                    >
                      <CheckCircle2 size={17} />
                      {answerSavePhase === 'saved' ? '답변완료!' : '답변완료'}
                    </button>
                  </div>
                </>
              ) : (
                <p className={`qna-answer-readonly ${selectedQna.answer ? 'has-answer' : ''}`}>
                  {selectedQna.answer ?? '관리자 답변이 등록되면 이 영역에서 확인할 수 있습니다.'}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="qna-detail-empty">
            <MessageSquare size={22} />
            <span>문의를 선택하면 하단에서 상세내용과 답변 상태를 확인할 수 있습니다.</span>
          </div>
        )}
      </div>
      {showCreateModal && <QnaCreateModal onClose={() => setShowCreateModal(false)} onSubmit={addQuestion} />}
    </section>
  );
}


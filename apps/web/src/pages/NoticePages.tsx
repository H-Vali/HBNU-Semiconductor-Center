import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { BookOpen, Download, Plus, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { STORAGE_KEYS } from '../appStorage';
import type { FaqCategory, FaqItem } from './InquiryPages';

function getSeoulDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(date);
}

export type NoticeAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

const noticeCategoryOptions = ['운영', '예약', '교육', '점검'] as const;

type NoticeCategory = (typeof noticeCategoryOptions)[number];

export type NoticeItem = {
  id: string;
  category: NoticeCategory;
  title: string;
  date: string;
  author: string;
  views: number;
  important?: boolean;
  pinned: boolean;
  summary: string;
  body: string;
  attachments?: NoticeAttachment[];
};

function normalizeNoticeCategory(category: unknown): NoticeCategory {
  return noticeCategoryOptions.includes(category as NoticeCategory) ? category as NoticeCategory : '운영';
}

export function getNoticeCategoryTone(category: NoticeCategory) {
  return {
    운영: 'is-operation',
    예약: 'is-reservation',
    교육: 'is-training',
    점검: 'is-maintenance'
  }[category];
}

export const noticeItems: NoticeItem[] = [
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

export const operationNoticeItems: NoticeItem[] = [
  {
    id: 'operation-notice-1',
    category: '운영',
    title: '공정동 장비 공동활용 운영 시간 안내',
    date: '2026.06.24',
    author: '창의융합교육센터',
    views: 42,
    pinned: true,
    summary: '장비 공동활용 플랫폼 운영 시간과 예약 확인 기준을 안내합니다.',
    body: '장비 공동활용 운영 시간은 평일 기준으로 관리되며, 담당 장비별 교육 이수 및 예약 승인 상태에 따라 사용 가능 여부가 달라질 수 있습니다. 세부 운영 시간은 장비별 담당자 안내를 확인해 주세요.'
  },
  {
    id: 'operation-notice-2',
    category: '운영',
    title: '장비 사용 전 안전 점검 체크리스트 적용 안내',
    date: '2026.06.21',
    author: '시설운영팀',
    views: 31,
    pinned: false,
    summary: '장비 예약 및 사용 전 안전 점검 항목을 확인하도록 운영 절차를 정비합니다.',
    body: '사용자는 장비 사용 전 장비 상태, 소모품 잔량, 주변 정리 상태를 확인해야 합니다. 이상이 발견될 경우 담당자에게 즉시 공유하고 임의로 장비를 가동하지 않습니다.'
  }
];

export const meetingNoticeItems: NoticeItem[] = [
  {
    id: 'meeting-notice-1',
    category: '운영',
    title: '6월 장비 담당자 운영 회의 일정 안내',
    date: '2026.06.23',
    author: '창의융합교육센터',
    views: 27,
    pinned: true,
    summary: '장비 담당자 대상 운영 회의 일정과 주요 안건을 안내합니다.',
    body: '6월 장비 담당자 운영 회의에서는 교육신청 처리 절차, 장비 사용권한 부여 기준, 점검중 장비 표시 방식, 예약 관리 개선 사항을 논의할 예정입니다.'
  },
  {
    id: 'meeting-notice-2',
    category: '운영',
    title: '학생 대표 회의 안건 접수 안내',
    date: '2026.06.19',
    author: '운영지원팀',
    views: 18,
    pinned: false,
    summary: '장비 사용 교육 및 예약 운영 개선과 관련한 학생 대표 회의 안건을 접수합니다.',
    body: '학생 대표는 장비 사용 과정에서 발생하는 불편 사항, 교육 이수 절차 개선 의견, 예약 캘린더 사용성 관련 의견을 취합해 운영지원팀에 제출할 수 있습니다.'
  }
];

function isImportantNotice(notice: NoticeItem) {
  return notice.important ?? notice.pinned;
}

export function normalizeNoticeItems(items: NoticeItem[]) {
  return items.map((item) => ({
    ...item,
    category: normalizeNoticeCategory(item.category),
    important: item.important ?? item.pinned
  }));
}

export function NoticePage({
  title = '공지사항',
  description = '센터 운영, 장비 예약, 교육 인증 관련 주요 공지를 한 곳에서 확인합니다.',
  items = noticeItems,
  filterLabel = '전체 공지'
}: {
  title?: string;
  description?: string;
  items?: NoticeItem[];
  filterLabel?: string;
}) {
  const [selectedNoticeId, setSelectedNoticeId] = useState(items[0]?.id ?? '');
  const selectedNotice = items.find((notice) => notice.id === selectedNoticeId) ?? items[0];
  const importantCount = items.filter(isImportantNotice).length;

  useEffect(() => {
    if (items[0] && !items.some((notice) => notice.id === selectedNoticeId)) {
      setSelectedNoticeId(items[0].id);
      return;
    }
    if (items.length === 0 && selectedNoticeId) {
      setSelectedNoticeId('');
    }
  }, [items, selectedNoticeId]);

  return (
    <section className="notice-page">
      <div className="notice-hero">
        <div>
          <p className="consumables-eyebrow">Notice Board</p>
          <h2>{title}</h2>
          <span>{description}</span>
        </div>
        <div className="notice-hero-meta" aria-label="공지사항 요약">
          <strong>{items.length}</strong>
          <span>등록 공지</span>
          <em>중요 {importantCount}건</em>
        </div>
      </div>

      <div className="notice-layout">
        <div className="notice-list-panel">
          <div className="notice-toolbar">
            <div className="notice-search-placeholder">
              <Search size={17} />
              <span>제목, 내용, 분류 검색</span>
            </div>
            <button type="button">{filterLabel}</button>
          </div>

          <div className="notice-list" aria-label="공지사항 목록">
            {items.map((notice, index) => (
              <button
                key={notice.id}
                type="button"
                className={`notice-row ${selectedNotice?.id === notice.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedNoticeId(notice.id)}
              >
                <span className="notice-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="notice-row-main">
                  <span className="notice-row-title">
                    {isImportantNotice(notice) && <em>중요</em>}
                    {notice.title}
                  </span>
                  <span className="notice-row-summary">{notice.summary}</span>
                </span>
                <span className="notice-row-side">
                  <strong className={`notice-category-badge ${getNoticeCategoryTone(notice.category)}`}>{notice.category}</strong>
                  <span>{notice.date}</span>
                </span>
              </button>
            ))}
            {items.length === 0 && (
              <div className="notice-empty-state">
                <strong>등록된 공지가 없습니다.</strong>
                <span>관리자 페이지에서 공지를 등록하면 이 영역에 표시됩니다.</span>
              </div>
            )}
          </div>
        </div>

        <article className="notice-detail-panel">
          {selectedNotice ? (
            <>
          <div className="notice-detail-head">
            <span className={`notice-category-badge ${getNoticeCategoryTone(selectedNotice.category)}`}>{selectedNotice.category}</span>
            {isImportantNotice(selectedNotice) && <em>중요 공지</em>}
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
              {(selectedNotice.attachments?.length ?? 0) > 0 ? (
                <ul className="notice-attachment-list">
                  {selectedNotice.attachments?.map((attachment) => (
                    <li key={attachment.id}>
                      <a href={attachment.dataUrl} download={attachment.name}>{attachment.name}</a>
                      <span>{formatFileSize(attachment.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span>등록된 첨부파일이 없습니다.</span>
              )}
            </div>
          </div>
            </>
          ) : (
            <div className="notice-empty-detail">
              <BookOpen size={22} />
              <strong>선택할 공지가 없습니다.</strong>
              <span>현재 등록된 공지가 없으므로 상세 내용을 표시할 수 없습니다.</span>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

export type NoticeBoardKey = 'operation' | 'meeting';
type NoticeAdminSectionKey = NoticeBoardKey | 'faq';
const faqCategoryOptions: FaqCategory[] = ['예약', '장비', '교육', '운영', '계정'];

export const noticeBoardMeta: Record<NoticeBoardKey, { label: string; category: NoticeCategory; storageKey: string }> = {
  operation: { label: '운영공지', category: '운영', storageKey: STORAGE_KEYS.operationNotices },
  meeting: { label: '회의공지', category: '운영', storageKey: STORAGE_KEYS.meetingNotices }
};

function formatNoticeDate(dateKey = getSeoulDateKey()) {
  return dateKey.replace(/-/g, '.');
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readNoticeAttachments(files: FileList | null): Promise<NoticeAttachment[]> {
  if (!files?.length) return Promise.resolve([]);
  const uploadedAt = new Date().toISOString();
  return Promise.all(Array.from(files).map((file, index) => new Promise<NoticeAttachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `notice-attachment-${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      dataUrl: String(reader.result ?? ''),
      uploadedAt
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  })));
}

export function NoticeAdminPage({
  operationItems,
  meetingItems,
  faqItems,
  onAddNotice,
  onUpdateNotice,
  onDeleteNotice,
  onAddFaq,
  onUpdateFaq,
  onDeleteFaq,
  onUploadAttachments,
  onDeleteAttachment
}: {
  operationItems: NoticeItem[];
  meetingItems: NoticeItem[];
  faqItems: FaqItem[];
  onAddNotice: (board: NoticeBoardKey, item: NoticeItem) => void;
  onUpdateNotice: (board: NoticeBoardKey, noticeId: string, patch: Partial<NoticeItem>) => void;
  onDeleteNotice: (board: NoticeBoardKey, noticeId: string) => void;
  onAddFaq: (item: FaqItem) => void;
  onUpdateFaq: (faqId: string, patch: Partial<FaqItem>) => void;
  onDeleteFaq: (faqId: string) => void;
  onUploadAttachments?: (noticeId: string, files: FileList | null) => Promise<NoticeAttachment[]>;
  onDeleteAttachment?: (attachment: NoticeAttachment) => Promise<void>;
}) {
  const [activeBoard, setActiveBoard] = useState<NoticeAdminSectionKey>('operation');
  const [selectedNoticeId, setSelectedNoticeId] = useState('');
  const [selectedFaqId, setSelectedFaqId] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const isFaqBoard = activeBoard === 'faq';
  const items = activeBoard === 'operation' ? operationItems : activeBoard === 'meeting' ? meetingItems : [];
  const selectedNotice = !isFaqBoard ? items.find((item) => item.id === selectedNoticeId) ?? items[0] : undefined;
  const selectedFaq = isFaqBoard ? faqItems.find((item) => item.id === selectedFaqId) ?? faqItems[0] : undefined;
  const meta = !isFaqBoard ? noticeBoardMeta[activeBoard] : { label: '자주묻는 질문', category: '운영' as NoticeCategory };

  useEffect(() => {
    if (isFaqBoard) {
      if (faqItems[0] && !faqItems.some((item) => item.id === selectedFaqId)) {
        setSelectedFaqId(faqItems[0].id);
      }
      return;
    }
    if (items[0] && !items.some((item) => item.id === selectedNoticeId)) {
      setSelectedNoticeId(items[0].id);
    }
  }, [faqItems, isFaqBoard, items, selectedFaqId, selectedNoticeId]);

  async function submitNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isFaqBoard) return;
    const noticeBoard = activeBoard as NoticeBoardKey;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get('title') ?? '').trim();
    const summary = String(form.get('summary') ?? '').trim();
    const body = String(form.get('body') ?? '').trim();
    if (!title || !summary || !body) return;
    const id = `${activeBoard}-notice-${Date.now()}`;
    const fileInput = formElement.elements.namedItem('attachments') as HTMLInputElement | null;
    let attachments: NoticeAttachment[] = [];
    try {
      attachments = onUploadAttachments
        ? await onUploadAttachments(id, fileInput?.files ?? null)
        : await readNoticeAttachments(fileInput?.files ?? null);
    } catch {
      window.alert('첨부파일 업로드에 실패했습니다. 파일 형식 또는 용량을 확인해 주세요.');
      return;
    }
    const item: NoticeItem = {
      id,
      category: normalizeNoticeCategory(form.get('category') ?? meta.category),
      title,
      date: formatNoticeDate(String(form.get('date') ?? getSeoulDateKey())),
      author: String(form.get('author') ?? '관리자').trim() || '관리자',
      views: 0,
      important: form.get('important') === 'on',
      pinned: form.get('pinned') === 'on',
      summary,
      body,
      attachments
    };
    onAddNotice(noticeBoard, item);
    setSelectedNoticeId(item.id);
    setShowEditor(false);
  }

  function submitFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get('question') ?? '').trim();
    const answer = String(form.get('answer') ?? '').trim();
    if (!question || !answer) return;
    const item: FaqItem = {
      id: `faq-${Date.now()}`,
      category: String(form.get('category') ?? '운영') as FaqCategory,
      question,
      answer,
      updatedAt: formatNoticeDate(String(form.get('updatedAt') ?? getSeoulDateKey()))
    };
    onAddFaq(item);
    setSelectedFaqId(item.id);
    setShowEditor(false);
  }

  async function addAttachments(event: ChangeEvent<HTMLInputElement>) {
    if (isFaqBoard || !selectedNotice) return;
    const noticeBoard = activeBoard as NoticeBoardKey;
    let attachments: NoticeAttachment[] = [];
    try {
      attachments = onUploadAttachments
        ? await onUploadAttachments(selectedNotice.id, event.target.files)
        : await readNoticeAttachments(event.target.files);
    } catch {
      event.target.value = '';
      window.alert('첨부파일 업로드에 실패했습니다. 파일 형식 또는 용량을 확인해 주세요.');
      return;
    }
    event.target.value = '';
    if (!attachments.length) return;
    onUpdateNotice(noticeBoard, selectedNotice.id, {
      attachments: [...(selectedNotice.attachments ?? []), ...attachments]
    });
  }

  async function removeAttachment(attachmentId: string) {
    if (isFaqBoard || !selectedNotice) return;
    const noticeBoard = activeBoard as NoticeBoardKey;
    const attachment = selectedNotice.attachments?.find((item) => item.id === attachmentId);
    if (attachment && onDeleteAttachment) {
      try {
        await onDeleteAttachment(attachment);
      } catch {
        window.alert('첨부파일 삭제에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
    }
    onUpdateNotice(noticeBoard, selectedNotice.id, {
      attachments: (selectedNotice.attachments ?? []).filter((attachment) => attachment.id !== attachmentId)
    });
  }

  return (
    <section className="notice-admin-page">
      <div className="notice-admin-hero">
        <div>
          <p className="consumables-eyebrow">Notice CMS</p>
          <h2>공지사항 관리</h2>
          <span>운영공지와 회의공지를 분리해 게시물을 등록하고 관리합니다.</span>
        </div>
        <button type="button" onClick={() => setShowEditor(true)}>
          <Plus size={17} /> 새 공지 등록
        </button>
      </div>

      <div className="notice-admin-tabs" role="tablist" aria-label="공지 구분">
        {([...(Object.keys(noticeBoardMeta) as NoticeBoardKey[]), 'faq'] as NoticeAdminSectionKey[]).map((board) => (
          <button
            key={board}
            type="button"
            className={activeBoard === board ? 'is-active' : ''}
            onClick={() => {
              setActiveBoard(board);
              setSelectedNoticeId('');
              setSelectedFaqId('');
            }}
          >
            {board === 'faq' ? '자주묻는 질문' : noticeBoardMeta[board].label}
            <span>{board === 'operation' ? operationItems.length : board === 'meeting' ? meetingItems.length : faqItems.length}</span>
          </button>
        ))}
      </div>

      <div className="notice-admin-layout">
        <div className="notice-admin-list">
          <div className="notice-admin-list-head">
            <div>
              <p>{meta.label}</p>
              <h3>{isFaqBoard ? 'FAQ 목록' : '게시물 목록'}</h3>
            </div>
            <span>{isFaqBoard ? faqItems.length : items.length}건</span>
          </div>
          {isFaqBoard ? (
            <>
              {faqItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notice-admin-row ${selectedFaq?.id === item.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedFaqId(item.id)}
                >
                  <span>
                    <em>{item.category}</em>
                    {item.question}
                  </span>
                  <small>{item.updatedAt} · FAQ</small>
                </button>
              ))}
              {faqItems.length === 0 && <p className="notice-admin-empty">등록된 FAQ가 없습니다.</p>}
            </>
          ) : (
            <>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notice-admin-row ${selectedNotice?.id === item.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedNoticeId(item.id)}
                >
                  <span>
                    {isImportantNotice(item) && <em>중요</em>}
                    {item.title}
                  </span>
                  <small>{item.date} · {item.author}</small>
                </button>
              ))}
              {items.length === 0 && <p className="notice-admin-empty">등록된 공지가 없습니다.</p>}
            </>
          )}
        </div>

        <div className="notice-admin-editor">
          {isFaqBoard ? (
            selectedFaq ? (
              <>
                <div className="notice-admin-editor-head">
                  <div>
                    <p>Selected FAQ</p>
                    <h3>{selectedFaq.question}</h3>
                  </div>
                  <button type="button" className="is-danger" onClick={() => onDeleteFaq(selectedFaq.id)}>
                    <Trash2 size={16} /> 삭제
                  </button>
                </div>
                <div className="notice-admin-form-grid">
                  <label>분류<select value={selectedFaq.category} onChange={(event) => onUpdateFaq(selectedFaq.id, { category: event.target.value as FaqCategory })}>{faqCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                  <label>수정일<input value={selectedFaq.updatedAt} onChange={(event) => onUpdateFaq(selectedFaq.id, { updatedAt: event.target.value })} /></label>
                  <label className="is-wide">질문<input value={selectedFaq.question} onChange={(event) => onUpdateFaq(selectedFaq.id, { question: event.target.value })} /></label>
                  <label className="is-wide">답변<textarea value={selectedFaq.answer} onChange={(event) => onUpdateFaq(selectedFaq.id, { answer: event.target.value })} /></label>
                </div>
              </>
            ) : (
              <p className="notice-admin-empty">왼쪽에서 FAQ를 선택하거나 새 FAQ를 등록하세요.</p>
            )
          ) : selectedNotice ? (
            <>
              <div className="notice-admin-editor-head">
                <div>
                  <p>Selected Notice</p>
                  <h3>{selectedNotice.title}</h3>
                </div>
                <button type="button" className="is-danger" onClick={() => onDeleteNotice(activeBoard, selectedNotice.id)}>
                  <Trash2 size={16} /> 삭제
                </button>
              </div>
              <div className="notice-admin-form-grid">
                <label>분류<select value={selectedNotice.category} onChange={(event) => onUpdateNotice(activeBoard, selectedNotice.id, { category: normalizeNoticeCategory(event.target.value) })}>{noticeCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                <label>작성자<input value={selectedNotice.author} onChange={(event) => onUpdateNotice(activeBoard, selectedNotice.id, { author: event.target.value })} /></label>
                <label>등록일<input value={selectedNotice.date} onChange={(event) => onUpdateNotice(activeBoard, selectedNotice.id, { date: event.target.value })} /></label>
                <div className="notice-admin-check-stack">
                  <label className="notice-admin-check"><input type="checkbox" checked={isImportantNotice(selectedNotice)} onChange={(event) => onUpdateNotice(activeBoard, selectedNotice.id, { important: event.target.checked })} /> 중요 공지</label>
                  <label className="notice-admin-check"><input type="checkbox" checked={selectedNotice.pinned} onChange={(event) => onUpdateNotice(activeBoard, selectedNotice.id, { pinned: event.target.checked })} /> 상단 고정</label>
                </div>
                <label className="is-wide">제목<input value={selectedNotice.title} onChange={(event) => onUpdateNotice(activeBoard, selectedNotice.id, { title: event.target.value })} /></label>
                <label className="is-wide">요약<input value={selectedNotice.summary} onChange={(event) => onUpdateNotice(activeBoard, selectedNotice.id, { summary: event.target.value })} /></label>
                <label className="is-wide">본문<textarea value={selectedNotice.body} onChange={(event) => onUpdateNotice(activeBoard, selectedNotice.id, { body: event.target.value })} /></label>
                <div className="notice-admin-attachments is-wide">
                  <div className="notice-admin-attachment-head">
                    <div>
                      <strong>첨부파일</strong>
                      <span>{selectedNotice.attachments?.length ?? 0}개 등록</span>
                    </div>
                    <label className="notice-file-upload">
                      <UploadCloud size={16} />
                      파일 첨부
                      <input
                        type="file"
                        multiple
                        onChange={addAttachments}
                        aria-label="공지사항 첨부파일 추가"
                      />
                    </label>
                  </div>
                  {(selectedNotice.attachments?.length ?? 0) > 0 ? (
                    <ul className="notice-admin-attachment-list">
                      {selectedNotice.attachments?.map((attachment) => (
                        <li key={attachment.id}>
                          <div>
                            <strong>{attachment.name}</strong>
                            <span>{formatFileSize(attachment.size)} · {attachment.type || 'file'}</span>
                          </div>
                          <div className="notice-admin-attachment-actions">
                            <a href={attachment.dataUrl} download={attachment.name} aria-label={`${attachment.name} 다운로드`}>
                              <Download size={15} />
                            </a>
                            <button type="button" onClick={() => void removeAttachment(attachment.id)} aria-label={`${attachment.name} 첨부 삭제`}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="notice-admin-attachment-empty">첨부된 파일이 없습니다.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="notice-admin-empty">왼쪽에서 공지를 선택하거나 새 공지를 등록하세요.</p>
          )}
        </div>
      </div>

      {showEditor && (
        <div className="modal-backdrop" onMouseDown={() => setShowEditor(false)}>
          <form className="notice-create-modal" onSubmit={isFaqBoard ? submitFaq : submitNotice} onMouseDown={(event) => event.stopPropagation()}>
            <div className="notice-admin-editor-head">
              <div>
                <p>{meta.label}</p>
                <h3>{isFaqBoard ? '새 FAQ 등록' : '새 공지 등록'}</h3>
              </div>
              <button type="button" className="is-danger" onClick={() => setShowEditor(false)}>
                <X size={16} /> 닫기
              </button>
            </div>
            {isFaqBoard && (
              <div className="notice-admin-form-grid">
                <label>분류<select name="category" defaultValue="운영">{faqCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                <label>수정일<input name="updatedAt" type="date" defaultValue={getSeoulDateKey()} /></label>
                <label className="is-wide">질문<input name="question" required placeholder="자주 묻는 질문을 입력하세요." /></label>
                <label className="is-wide">답변<textarea name="answer" required placeholder="사용자에게 보여줄 답변을 입력하세요." /></label>
              </div>
            )}
            <fieldset disabled={isFaqBoard} className={`notice-admin-form-grid ${isFaqBoard ? 'is-hidden' : ''}`}>
              <label>분류<select name="category" defaultValue={meta.category}>{noticeCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label>작성자<input name="author" defaultValue="관리자" /></label>
              <label>등록일<input name="date" type="date" defaultValue={getSeoulDateKey()} /></label>
              <div className="notice-admin-check-stack">
                <label className="notice-admin-check"><input name="important" type="checkbox" /> 중요 공지</label>
                <label className="notice-admin-check"><input name="pinned" type="checkbox" /> 상단 고정</label>
              </div>
              <label className="is-wide">제목<input name="title" required placeholder={`${meta.label} 제목 입력`} /></label>
              <label className="is-wide">요약<input name="summary" required placeholder="목록에 노출될 요약 문구" /></label>
              <label className="is-wide">본문<textarea name="body" required placeholder="공지 내용을 입력하세요." /></label>
              <label className="notice-create-file is-wide">
                첨부파일
                <input name="attachments" type="file" multiple />
                <span>PDF, Word, Excel, 이미지 등 공지 관련 파일을 함께 등록할 수 있습니다.</span>
              </label>
            </fieldset>
            <div className="notice-create-actions">
              <button type="button" onClick={() => setShowEditor(false)}>취소</button>
              <button type="submit" className="is-primary">등록</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}


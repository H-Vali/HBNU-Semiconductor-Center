import { z } from 'zod';
import { hasDatabase, query } from './db.js';

const noticeAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  dataUrl: z.string(),
  uploadedAt: z.string()
});

export const noticeSchema = z.object({
  id: z.string(),
  board: z.enum(['general', 'operation', 'meeting']).default('general'),
  category: z.string(),
  title: z.string().min(1),
  summary: z.string().default(''),
  body: z.string().default(''),
  author: z.string().default('관리자'),
  date: z.string(),
  views: z.number().int().nonnegative().default(0),
  important: z.boolean().default(false),
  pinned: z.boolean().default(false),
  attachments: z.array(noticeAttachmentSchema).default([])
});

export const faqSchema = z.object({
  id: z.string(),
  category: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
  updatedAt: z.string(),
  sortOrder: z.number().int().default(0)
});

export const qnaSchema = z.object({
  id: z.string(),
  department: z.string(),
  title: z.string().min(1),
  content: z.string().default(''),
  status: z.enum(['답변대기', '답변완료']).default('답변대기'),
  createdAt: z.string(),
  answer: z.string().optional(),
  answeredAt: z.string().optional(),
  answeredBy: z.string().optional()
});

export type Notice = z.infer<typeof noticeSchema>;
export type Faq = z.infer<typeof faqSchema>;
export type QnaItem = z.infer<typeof qnaSchema>;

export const initialNotices: Notice[] = [
  {
    id: 'notice-1',
    board: 'general',
    category: '운영',
    title: '2026년 6월 장비 공동활용 플랫폼 시범 운영 안내',
    date: '2026.06.22',
    author: '창의융합교육센터',
    views: 184,
    pinned: true,
    summary: '장비예약현황, 교육신청, 권한관리 기능을 중심으로 플랫폼 시범 운영을 시작합니다.',
    body: '시범 운영 기간 동안 장비 예약 및 교육 신청 이력은 플랫폼 기준으로 관리됩니다.',
    important: true,
    attachments: []
  },
  {
    id: 'operation-1',
    board: 'operation',
    category: '운영',
    title: '공정동 장비 공동활용 운영 시간 안내',
    date: '2026.06.24',
    author: '장비운영팀',
    views: 42,
    pinned: true,
    summary: '공정동 장비 운영 시간과 담당자 확인 절차를 안내합니다.',
    body: '평일 운영 시간 내 예약 장비를 사용할 수 있으며, 야간 사용은 담당자 승인이 필요합니다.',
    important: false,
    attachments: []
  },
  {
    id: 'meeting-1',
    board: 'meeting',
    category: '운영',
    title: '6월 장비 담당자 운영 회의 일정 안내',
    date: '2026.06.23',
    author: '센터운영팀',
    views: 31,
    pinned: true,
    summary: '장비 담당자 운영 회의 일정을 공유합니다.',
    body: '월간 장비 운영 현황, 교육 신청, 예약 정책을 점검합니다.',
    important: false,
    attachments: []
  }
];

export const initialFaqs: Faq[] = [
  {
    id: 'faq-1',
    category: '예약',
    question: '장비 예약은 누가 신청할 수 있나요?',
    answer: '장비별 교육 인증과 권한 부여가 완료된 사용자가 예약할 수 있습니다.',
    updatedAt: '2026.06.22',
    sortOrder: 1
  },
  {
    id: 'faq-2',
    category: '장비',
    question: '장비별 사용 가능 여부는 어디에서 확인하나요?',
    answer: '장비현황과 장비사용예약 화면에서 장비별 상태와 예약 가능 여부를 확인할 수 있습니다.',
    updatedAt: '2026.06.21',
    sortOrder: 2
  }
];

export const initialQnaItems: QnaItem[] = [
  {
    id: 'qna-1',
    department: '전자공학과',
    title: 'mini SEM 교육 인증 후 예약 권한 반영 시점 문의',
    content: '교육 이수 후 장비 예약 권한이 언제 반영되는지 확인 부탁드립니다.',
    status: '답변완료',
    createdAt: '2026.06.21',
    answer: '관리자 승인 후 즉시 반영됩니다.',
    answeredAt: '2026.06.22',
    answeredBy: '관리자'
  },
  {
    id: 'qna-2',
    department: '기계공학과',
    title: 'Ebeam Evaporator 야간 사용 가능 여부 문의',
    content: '야간 시간대에도 담당자 승인 후 장비 사용이 가능한지 문의드립니다.',
    status: '답변대기',
    createdAt: '2026.06.22'
  }
];

function mapNoticeRow(row: Record<string, unknown>): Notice {
  return {
    id: String(row.id),
    board: row.board as Notice['board'],
    category: String(row.category),
    title: String(row.title),
    summary: String(row.summary ?? ''),
    body: String(row.body ?? ''),
    author: String(row.author ?? '관리자'),
    date: String(row.notice_date),
    views: Number(row.views ?? 0),
    important: Boolean(row.important),
    pinned: Boolean(row.pinned),
    attachments: Array.isArray(row.attachments) ? row.attachments as Notice['attachments'] : []
  };
}

export async function listNotices(board?: string) {
  if (!hasDatabase()) {
    return board ? initialNotices.filter((notice) => notice.board === board) : initialNotices;
  }
  const result = board
    ? await query<Record<string, unknown>>(
      `select * from notices where deleted_at is null and board = $1 order by pinned desc, notice_date desc, created_at desc`,
      [board]
    )
    : await query<Record<string, unknown>>(
      `select * from notices where deleted_at is null order by pinned desc, notice_date desc, created_at desc`
    );
  return result.rows.map(mapNoticeRow);
}

export async function createNotice(input: unknown) {
  const notice = noticeSchema.parse(input);
  if (!hasDatabase()) {
    initialNotices.unshift(notice);
    return notice;
  }
  const result = await query<Record<string, unknown>>(
    `insert into notices (id, board, category, title, summary, body, author, notice_date, views, important, pinned, attachments)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     returning *`,
    [
      notice.id,
      notice.board,
      notice.category,
      notice.title,
      notice.summary,
      notice.body,
      notice.author,
      notice.date,
      notice.views,
      notice.important,
      notice.pinned,
      JSON.stringify(notice.attachments)
    ]
  );
  return mapNoticeRow(result.rows[0]);
}

export async function updateNotice(id: string, input: unknown) {
  const patch = noticeSchema.partial().omit({ id: true }).parse(input);
  if (!hasDatabase()) {
    const index = initialNotices.findIndex((notice) => notice.id === id);
    if (index === -1) return null;
    initialNotices[index] = noticeSchema.parse({ ...initialNotices[index], ...patch, id });
    return initialNotices[index];
  }
  const result = await query<Record<string, unknown>>(
    `update notices
     set board = coalesce($2, board),
       category = coalesce($3, category),
       title = coalesce($4, title),
       summary = coalesce($5, summary),
       body = coalesce($6, body),
       author = coalesce($7, author),
       notice_date = coalesce($8, notice_date),
       views = coalesce($9, views),
       important = coalesce($10, important),
       pinned = coalesce($11, pinned),
       attachments = coalesce($12::jsonb, attachments),
       updated_at = now()
     where id = $1 and deleted_at is null
     returning *`,
    [
      id,
      patch.board ?? null,
      patch.category ?? null,
      patch.title ?? null,
      patch.summary ?? null,
      patch.body ?? null,
      patch.author ?? null,
      patch.date ?? null,
      patch.views ?? null,
      patch.important ?? null,
      patch.pinned ?? null,
      patch.attachments ? JSON.stringify(patch.attachments) : null
    ]
  );
  return result.rows[0] ? mapNoticeRow(result.rows[0]) : null;
}

export async function deleteNotice(id: string) {
  if (!hasDatabase()) {
    const index = initialNotices.findIndex((notice) => notice.id === id);
    if (index === -1) return null;
    const [removed] = initialNotices.splice(index, 1);
    return removed;
  }
  const result = await query<Record<string, unknown>>(
    `update notices
     set deleted_at = now(), updated_at = now()
     where id = $1 and deleted_at is null
     returning *`,
    [id]
  );
  return result.rows[0] ? mapNoticeRow(result.rows[0]) : null;
}

export async function listFaqs() {
  if (!hasDatabase()) return initialFaqs;
  const result = await query<Record<string, unknown>>(
    `select id, category, question, answer, updated_at as "updatedAt", sort_order as "sortOrder"
     from faqs where deleted_at is null order by sort_order asc, id asc`
  );
  return result.rows as Faq[];
}

export async function createFaq(input: unknown) {
  const faq = faqSchema.parse(input);
  if (!hasDatabase()) {
    initialFaqs.push(faq);
    return faq;
  }
  const result = await query<Faq>(
    `insert into faqs (id, category, question, answer, updated_at, sort_order)
     values ($1, $2, $3, $4, $5, $6)
     returning id, category, question, answer, updated_at as "updatedAt", sort_order as "sortOrder"`,
    [faq.id, faq.category, faq.question, faq.answer, faq.updatedAt, faq.sortOrder]
  );
  return result.rows[0];
}

export async function updateFaq(id: string, input: unknown) {
  const patch = faqSchema.partial().omit({ id: true }).parse(input);
  if (!hasDatabase()) {
    const index = initialFaqs.findIndex((faq) => faq.id === id);
    if (index === -1) return null;
    initialFaqs[index] = faqSchema.parse({ ...initialFaqs[index], ...patch, id });
    return initialFaqs[index];
  }
  const result = await query<Faq>(
    `update faqs
     set category = coalesce($2, category),
       question = coalesce($3, question),
       answer = coalesce($4, answer),
       updated_at = coalesce($5, updated_at),
       sort_order = coalesce($6, sort_order)
     where id = $1 and deleted_at is null
     returning id, category, question, answer, updated_at as "updatedAt", sort_order as "sortOrder"`,
    [
      id,
      patch.category ?? null,
      patch.question ?? null,
      patch.answer ?? null,
      patch.updatedAt ?? null,
      patch.sortOrder ?? null
    ]
  );
  return result.rows[0] ?? null;
}

export async function deleteFaq(id: string) {
  if (!hasDatabase()) {
    const index = initialFaqs.findIndex((faq) => faq.id === id);
    if (index === -1) return null;
    const [removed] = initialFaqs.splice(index, 1);
    return removed;
  }
  const result = await query<Faq>(
    `update faqs
     set deleted_at = now()
     where id = $1 and deleted_at is null
     returning id, category, question, answer, updated_at as "updatedAt", sort_order as "sortOrder"`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function listQnaItems() {
  if (!hasDatabase()) return initialQnaItems;
  const result = await query<QnaItem>(
    `select id, department, title, content, status, created_at as "createdAt",
      answer, answered_at as "answeredAt", answered_by as "answeredBy"
     from qna_items where deleted_at is null order by created_at desc, id desc`
  );
  return result.rows;
}

export async function createQnaItem(input: unknown) {
  const item = qnaSchema.parse(input);
  if (!hasDatabase()) {
    initialQnaItems.unshift(item);
    return item;
  }
  const result = await query<QnaItem>(
    `insert into qna_items (id, department, title, content, status, created_at, answer, answered_at, answered_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id, department, title, content, status, created_at as "createdAt",
       answer, answered_at as "answeredAt", answered_by as "answeredBy"`,
    [
      item.id,
      item.department,
      item.title,
      item.content,
      item.status,
      item.createdAt,
      item.answer ?? null,
      item.answeredAt ?? null,
      item.answeredBy ?? null
    ]
  );
  return result.rows[0];
}

export async function answerQnaItem(id: string, input: unknown) {
  const body = z.object({
    answer: z.string().min(1),
    answeredBy: z.string().default('관리자'),
    answeredAt: z.string().default(() => new Date().toISOString())
  }).parse(input);
  if (!hasDatabase()) {
    const index = initialQnaItems.findIndex((item) => item.id === id);
    if (index === -1) return null;
    initialQnaItems[index] = { ...initialQnaItems[index], ...body, status: '답변완료' };
    return initialQnaItems[index];
  }
  const result = await query<QnaItem>(
    `update qna_items
     set answer = $2, answered_by = $3, answered_at = $4, status = '답변완료'
     where id = $1 and deleted_at is null
     returning id, department, title, content, status, created_at as "createdAt",
       answer, answered_at as "answeredAt", answered_by as "answeredBy"`,
    [id, body.answer, body.answeredBy, body.answeredAt]
  );
  return result.rows[0] ?? null;
}

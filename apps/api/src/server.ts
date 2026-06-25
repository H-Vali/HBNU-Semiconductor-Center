import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { requireAuth, requireRole, signToken } from './auth.js';
import {
  answerQnaItem,
  createFaq,
  createNotice,
  createQnaItem,
  deleteFaq,
  deleteNotice,
  listFaqs,
  listNotices,
  listQnaItems,
  updateFaq,
  updateNotice
} from './content.js';
import {
  ReservationOverlapError,
  cancelReservation,
  createReservation,
  getEquipment,
  listEquipment,
  listReservations
} from './core.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/auth/dev-login', (req, res) => {
  const body = z.object({
    role: z.enum(['USER', 'MANAGER', 'ADMIN']).default('USER')
  }).parse(req.body ?? {});

  const user = {
    id: 'dev-user',
    email: body.role === 'ADMIN' ? 'admin@hbnu.ac.kr' : 'user@hbnu.ac.kr',
    name: body.role === 'ADMIN' ? '관리자' : '연구원',
    role: body.role
  };

  res.json({ user, token: signToken(user) });
});

app.get('/equipment', async (_req, res, next) => {
  try {
    res.json(await listEquipment());
  } catch (error) {
    next(error);
  }
});
app.get('/equipment/:id', async (req, res, next) => {
  try {
    const item = await getEquipment(req.params.id);
    if (!item) return res.status(404).json({ message: 'Equipment not found' });
    return res.json(item);
  } catch (error) {
    return next(error);
  }
});

app.get('/notices', async (req, res, next) => {
  try {
    const board = typeof req.query.board === 'string' ? req.query.board : undefined;
    res.json(await listNotices(board));
  } catch (error) {
    next(error);
  }
});

app.post('/notices', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    res.status(201).json(await createNotice(req.body));
  } catch (error) {
    next(error);
  }
});

app.patch('/notices/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const notice = await updateNotice(id, req.body);
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    return res.json(notice);
  } catch (error) {
    next(error);
  }
});

app.delete('/notices/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const notice = await deleteNotice(id);
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    return res.json(notice);
  } catch (error) {
    next(error);
  }
});

app.get('/faqs', async (_req, res, next) => {
  try {
    res.json(await listFaqs());
  } catch (error) {
    next(error);
  }
});

app.post('/faqs', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    res.status(201).json(await createFaq(req.body));
  } catch (error) {
    next(error);
  }
});

app.patch('/faqs/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const faq = await updateFaq(id, req.body);
    if (!faq) return res.status(404).json({ message: 'FAQ not found' });
    return res.json(faq);
  } catch (error) {
    next(error);
  }
});

app.delete('/faqs/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const faq = await deleteFaq(id);
    if (!faq) return res.status(404).json({ message: 'FAQ not found' });
    return res.json(faq);
  } catch (error) {
    next(error);
  }
});

app.get('/qna', async (_req, res, next) => {
  try {
    res.json(await listQnaItems());
  } catch (error) {
    next(error);
  }
});

app.post('/qna', async (req, res, next) => {
  try {
    res.status(201).json(await createQnaItem(req.body));
  } catch (error) {
    next(error);
  }
});

app.patch('/qna/:id/answer', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const item = await answerQnaItem(id, req.body);
    if (!item) return res.status(404).json({ message: 'Q&A item not found' });
    return res.json(item);
  } catch (error) {
    next(error);
  }
});

app.get('/reservations', async (_req, res, next) => {
  try {
    res.json(await listReservations());
  } catch (error) {
    next(error);
  }
});
app.delete('/reservations/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const reservation = await cancelReservation(id);
    if (!reservation) return res.status(404).json({ message: 'Reservation not found' });
    return res.json(reservation);
  } catch (error) {
    next(error);
  }
});
app.post('/reservations', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await createReservation(req.body, req.user));
  } catch (error) {
    next(error);
  }
});

app.get('/admin/summary', requireAuth, requireRole(['ADMIN']), async (_req, res, next) => {
  try {
    res.json({
      users: 128,
      pendingReservations: 9,
      educationRequests: 17,
      equipmentOnline: (await listEquipment()).length
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ReservationOverlapError) {
    return res.status(409).json({ message: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: 'Invalid request body', issues: error.issues });
  }
  console.error(error);
  return res.status(500).json({ message: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`HBNU API listening on ${port}`);
});

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { requireAuth, requireRole } from './auth.js';
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
  ReservationPermissionError,
  cancelReservation,
  createEquipment,
  createReservation,
  deleteEquipment,
  getEquipment,
  listEquipment,
  listReservations,
  updateEquipment
} from './core.js';
import {
  authenticateGoogle,
  createUser,
  deleteUser,
  getCurrentAuthSession,
  listUsers,
  registerGoogleUser,
  updateUser
} from './users.js';
import {
  PermissionDeniedError,
  ensureEquipmentPermissionSchema,
  grantEquipmentPermission,
  listEquipmentPermissions,
  revokeEquipmentPermission,
  setUserEquipmentPermissions
} from './permissions.js';
import {
  completeTrainingRequest,
  createTrainingRequest,
  ensureTrainingRequestSchema,
  listTrainingRequests,
  rejectTrainingRequest,
  scheduleTrainingRequest,
  TrainingRequestStateError
} from './training.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, api: 'apps/api', build: 'current-api' }));

app.get('/auth/config', (_req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID ?? '' });
});

app.post('/auth/google', async (req, res, next) => {
  try {
    res.json(await authenticateGoogle(req.body));
  } catch (error) {
    next(error);
  }
});

app.post('/auth/register', async (req, res, next) => {
  try {
    res.status(201).json(await registerGoogleUser(req.body));
  } catch (error) {
    next(error);
  }
});

app.get('/auth/me', requireAuth, async (req, res, next) => {
  try {
    const session = await getCurrentAuthSession(req.user!);
    if (!session) return res.status(404).json({ message: 'User not found' });
    return res.json(session);
  } catch (error) {
    return next(error);
  }
});

app.get('/users', requireAuth, requireRole(['ADMIN']), async (_req, res, next) => {
  try {
    res.json(await listUsers());
  } catch (error) {
    next(error);
  }
});

app.post('/users', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    res.status(201).json(await createUser(req.body));
  } catch (error) {
    next(error);
  }
});

app.patch('/users/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const user = await updateUser(id, req.body);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (error) {
    next(error);
  }
});

app.delete('/users/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const user = await deleteUser(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (error) {
    next(error);
  }
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

app.post('/equipment', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    res.status(201).json(await createEquipment(req.body));
  } catch (error) {
    next(error);
  }
});

app.patch('/equipment/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const item = await updateEquipment(id, req.body);
    if (!item) return res.status(404).json({ message: 'Equipment not found' });
    return res.json(item);
  } catch (error) {
    return next(error);
  }
});

app.delete('/equipment/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const item = await deleteEquipment(id);
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
    const reservation = await cancelReservation(id, req.user!);
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

app.get('/equipment-permissions', requireAuth, async (req, res, next) => {
  try {
    res.json(await listEquipmentPermissions(req.user!));
  } catch (error) {
    next(error);
  }
});

app.put('/equipment-permissions/users/:userId', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { userId } = z.object({ userId: z.string() }).parse(req.params);
    res.json(await setUserEquipmentPermissions(userId, req.body, req.user!));
  } catch (error) {
    next(error);
  }
});

app.post('/equipment-permissions/grant', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    res.status(201).json(await grantEquipmentPermission(req.body, req.user!));
  } catch (error) {
    next(error);
  }
});

app.post('/equipment-permissions/revoke', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    res.json(await revokeEquipmentPermission(req.body, req.user!));
  } catch (error) {
    next(error);
  }
});

app.get('/training-requests', requireAuth, async (req, res, next) => {
  try {
    res.json(await listTrainingRequests(req.user!, req.query));
  } catch (error) {
    next(error);
  }
});

app.post('/training-requests', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await createTrainingRequest(req.body, req.user!));
  } catch (error) {
    next(error);
  }
});

app.patch('/training-requests/:id/schedule', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const request = await scheduleTrainingRequest(id, req.body, req.user!);
    if (!request) return res.status(404).json({ message: 'Training request not found' });
    return res.json(request);
  } catch (error) {
    return next(error);
  }
});

app.patch('/training-requests/:id/reject', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const request = await rejectTrainingRequest(id, req.body, req.user!);
    if (!request) return res.status(404).json({ message: 'Training request not found' });
    return res.json(request);
  } catch (error) {
    return next(error);
  }
});

app.patch('/training-requests/:id/complete', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const request = await completeTrainingRequest(id, req.user!);
    if (!request) return res.status(404).json({ message: 'Training request not found' });
    return res.json(request);
  } catch (error) {
    return next(error);
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
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type?: unknown }).type === 'entity.parse.failed'
  ) {
    return res.status(400).json({ message: 'Malformed JSON request body' });
  }
  if (error instanceof ReservationOverlapError) {
    return res.status(409).json({ message: error.message });
  }
  if (error instanceof ReservationPermissionError) {
    return res.status(403).json({ message: error.message });
  }
  if (error instanceof PermissionDeniedError) {
    return res.status(403).json({ message: error.message });
  }
  if (error instanceof TrainingRequestStateError) {
    return res.status(409).json({ message: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: 'Invalid request body', issues: error.issues });
  }
  console.error(error);
  return res.status(500).json({ message: 'Internal server error' });
});

Promise.all([ensureEquipmentPermissionSchema(), ensureTrainingRequestSchema()])
  .then(() => {
    app.listen(port, () => {
      console.log(`HBNU API listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

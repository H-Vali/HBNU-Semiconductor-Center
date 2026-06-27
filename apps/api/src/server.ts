import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireRole } from './auth.js';
import { getAdminSummary } from './adminSummary.js';
import { ensureAuditLogSchema, listAuditLogs, writeAuditLog } from './auditLog.js';
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
  updateReservationStatus,
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
import {
  createPenalty,
  ensureOperationalDataSchema,
  listConsumables,
  listPenalties,
  revokePenalty,
  saveConsumables
} from './operationalData.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));

app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = req.header('x-request-id') || randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const logEntry = {
      level: logLevel,
      type: 'request',
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs
    };
    console[logLevel === 'error' ? 'error' : logLevel === 'warn' ? 'warn' : 'log'](JSON.stringify(logEntry));
  });

  next();
});

app.use(express.json());

const healthPayload = { ok: true, api: 'apps/api', build: 'current-api' };

app.head('/', (_req, res) => res.status(204).end());
app.get('/', (_req, res) => res.json(healthPayload));
app.get('/health', (_req, res) => res.json(healthPayload));

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
    const user = await createUser(req.body);
    await writeAuditLog(req.user!, 'USER_CREATE', 'user', user.id, { email: user.email, name: user.name });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

app.patch('/users/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const user = await updateUser(id, req.body);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await writeAuditLog(req.user!, 'USER_UPDATE', 'user', id, { email: user.email, name: user.name });
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
    await writeAuditLog(req.user!, 'USER_DELETE', 'user', id, { email: user.email, name: user.name });
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
    const item = await createEquipment(req.body);
    await writeAuditLog(req.user!, 'EQUIPMENT_CREATE', 'equipment', item.id, { name: item.name });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

app.patch('/equipment/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const item = await updateEquipment(id, req.body);
    if (!item) return res.status(404).json({ message: 'Equipment not found' });
    await writeAuditLog(req.user!, 'EQUIPMENT_UPDATE', 'equipment', id, { name: item.name });
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
    await writeAuditLog(req.user!, 'EQUIPMENT_DELETE', 'equipment', id, { name: item.name });
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
    const notice = await createNotice(req.body);
    await writeAuditLog(req.user!, 'NOTICE_CREATE', 'notice', notice.id, { title: notice.title, board: notice.board });
    res.status(201).json(notice);
  } catch (error) {
    next(error);
  }
});

app.patch('/notices/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const notice = await updateNotice(id, req.body);
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    await writeAuditLog(req.user!, 'NOTICE_UPDATE', 'notice', id, { title: notice.title, board: notice.board });
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
    await writeAuditLog(req.user!, 'NOTICE_DELETE', 'notice', id, { title: notice.title, board: notice.board });
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
    const faq = await createFaq(req.body);
    await writeAuditLog(req.user!, 'FAQ_CREATE', 'faq', faq.id, { question: faq.question });
    res.status(201).json(faq);
  } catch (error) {
    next(error);
  }
});

app.patch('/faqs/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const faq = await updateFaq(id, req.body);
    if (!faq) return res.status(404).json({ message: 'FAQ not found' });
    await writeAuditLog(req.user!, 'FAQ_UPDATE', 'faq', id, { question: faq.question });
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
    await writeAuditLog(req.user!, 'FAQ_DELETE', 'faq', id, { question: faq.question });
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
    await writeAuditLog(req.user!, 'QNA_ANSWER', 'qna', id, { title: item.title, status: item.status });
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
    await writeAuditLog(req.user!, 'RESERVATION_CANCEL', 'reservation', id, { status: reservation.status });
    return res.json(reservation);
  } catch (error) {
    next(error);
  }
});
app.post('/reservations', requireAuth, async (req, res, next) => {
  try {
    const reservation = await createReservation(req.body, req.user);
    await writeAuditLog(req.user!, 'RESERVATION_CREATE', 'reservation', reservation.id, {
      equipmentId: reservation.equipmentId,
      status: reservation.status
    });
    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
});

app.patch('/reservations/:id/status', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const reservation = await updateReservationStatus(id, req.body, req.user!);
    if (!reservation) return res.status(404).json({ message: 'Reservation not found' });
    await writeAuditLog(req.user!, 'RESERVATION_STATUS_UPDATE', 'reservation', id, {
      status: reservation.status,
      reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined
    });
    return res.json(reservation);
  } catch (error) {
    return next(error);
  }
});

app.get('/audit-logs', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 200;
    res.json(await listAuditLogs(Number.isFinite(rawLimit) ? rawLimit : 200));
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
    const snapshot = await grantEquipmentPermission(req.body, req.user!);
    await writeAuditLog(req.user!, 'EQUIPMENT_PERMISSION_GRANT', 'equipment_permission', `${req.body?.userId ?? ''}:${req.body?.equipmentId ?? ''}`, {
      userId: req.body?.userId,
      equipmentId: req.body?.equipmentId
    });
    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
});

app.post('/equipment-permissions/revoke', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const snapshot = await revokeEquipmentPermission(req.body, req.user!);
    await writeAuditLog(req.user!, 'EQUIPMENT_PERMISSION_REVOKE', 'equipment_permission', `${req.body?.userId ?? ''}:${req.body?.equipmentId ?? ''}`, {
      userId: req.body?.userId,
      equipmentId: req.body?.equipmentId,
      reason: req.body?.reason
    });
    res.json(snapshot);
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
    const request = await createTrainingRequest(req.body, req.user!);
    await writeAuditLog(req.user!, 'TRAINING_REQUEST_CREATE', 'training_request', request.id, {
      equipmentId: request.equipmentId,
      applicantId: request.applicantUserId,
      status: request.status
    });
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

app.patch('/training-requests/:id/schedule', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const request = await scheduleTrainingRequest(id, req.body, req.user!);
    if (!request) return res.status(404).json({ message: 'Training request not found' });
    await writeAuditLog(req.user!, 'TRAINING_REQUEST_SCHEDULE', 'training_request', id, {
      equipmentId: request.equipmentId,
      applicantId: request.applicantUserId,
      scheduledDate: request.scheduledDate
    });
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
    await writeAuditLog(req.user!, 'TRAINING_REQUEST_REJECT', 'training_request', id, {
      equipmentId: request.equipmentId,
      applicantId: request.applicantUserId,
      rejectedReason: request.rejectedReason
    });
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
    await writeAuditLog(req.user!, 'TRAINING_REQUEST_COMPLETE', 'training_request', id, {
      equipmentId: request.equipmentId,
      applicantId: request.applicantUserId,
      status: request.status
    });
    return res.json(request);
  } catch (error) {
    return next(error);
  }
});

app.get('/admin/summary', requireAuth, requireRole(['ADMIN']), async (_req, res, next) => {
  try {
    res.json(await getAdminSummary());
  } catch (error) {
    next(error);
  }
});

app.get('/consumables', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const month = z.string().min(1).parse(req.query.month ?? new Date().toISOString().slice(0, 7));
    res.json(await listConsumables(month));
  } catch (error) {
    next(error);
  }
});

app.put('/consumables/:month', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { month } = z.object({ month: z.string().min(1) }).parse(req.params);
    res.json(await saveConsumables(month, req.body));
  } catch (error) {
    next(error);
  }
});

app.get('/penalties', requireAuth, async (req, res, next) => {
  try {
    res.json(await listPenalties(req.user!));
  } catch (error) {
    next(error);
  }
});

app.post('/penalties', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const penalty = await createPenalty(req.body, req.user!);
    await writeAuditLog(req.user!, 'PENALTY_CREATE', 'penalty', penalty.id, {
      userId: penalty.userId,
      type: penalty.type,
      category: penalty.category
    });
    res.status(201).json(penalty);
  } catch (error) {
    next(error);
  }
});

app.patch('/penalties/:id/revoke', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const penalty = await revokePenalty(id, req.user!);
    if (!penalty) return res.status(404).json({ message: 'Penalty record not found' });
    await writeAuditLog(req.user!, 'PENALTY_REVOKE', 'penalty', id, { userId: penalty.userId });
    return res.json(penalty);
  } catch (error) {
    return next(error);
  }
});

function logApiError(error: unknown, req: express.Request, res: express.Response) {
  const knownError = error instanceof Error ? error : null;
  console.error(JSON.stringify({
    level: 'error',
    type: 'exception',
    requestId: res.locals.requestId,
    method: req.method,
    path: req.originalUrl,
    name: knownError?.name ?? 'UnknownError',
    message: knownError?.message ?? String(error),
    stack: process.env.NODE_ENV === 'production' ? undefined : knownError?.stack
  }));
}

function errorResponse(res: express.Response, statusCode: number, body: Record<string, unknown>) {
  return res.status(statusCode).json({
    ...body,
    requestId: res.locals.requestId
  });
}

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type?: unknown }).type === 'entity.parse.failed'
  ) {
    return errorResponse(res, 400, { message: 'Malformed JSON request body' });
  }
  if (error instanceof ReservationOverlapError) {
    return errorResponse(res, 409, { message: error.message });
  }
  if (error instanceof ReservationPermissionError) {
    return errorResponse(res, 403, { message: error.message });
  }
  if (error instanceof PermissionDeniedError) {
    return errorResponse(res, 403, { message: error.message });
  }
  if (error instanceof TrainingRequestStateError) {
    return errorResponse(res, 409, { message: error.message });
  }
  if (error instanceof z.ZodError) {
    return errorResponse(res, 400, { message: 'Invalid request body', issues: error.issues });
  }
  logApiError(error, req, res);
  return errorResponse(res, 500, { message: 'Internal server error' });
});

Promise.all([ensureEquipmentPermissionSchema(), ensureTrainingRequestSchema(), ensureOperationalDataSchema(), ensureAuditLogSchema()])
  .then(() => {
    app.listen(port, () => {
      console.log(`HBNU API listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

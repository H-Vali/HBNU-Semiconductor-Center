import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireRole } from './auth.js';
import { getAdminSummary } from './adminSummary.js';
import { ensureAuditLogSchema, listAuditLogs, writeAuditLog } from './auditLog.js';
import { canAccessFileAsset, createFileAsset, deleteFileAsset, ensureFileAssetSchema, getFileAsset, listFileAssets } from './fileAssets.js';
import { buildEquipmentUsageAnalyticsWorkbook } from './equipmentUsageAnalytics.js';
import { ensureFeatureFlagSchema, isFeatureEnabled } from './features.js';
import { getDashboardMetrics } from './dashboardMetrics.js';
import { deleteR2Object, getR2Object, prepareR2Upload, putR2Object } from './r2Storage.js';
import {
  answerQnaItem,
  createFaq,
  createNotice,
  createQnaItem,
  deleteFaq,
  deleteNotice,
  deleteQnaItem,
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
  ensureCoreSchema,
  getEquipment,
  listEquipment,
  listReservations,
  updateEquipment
} from './core.js';
import {
  authenticateGoogle,
  authenticateGoogleAccessToken,
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
  cancelTrainingRegistration,
  completeTrainingSessionRegistrations,
  confirmPenaltyCandidate,
  createTrainingSession,
  deleteTrainingSession,
  ensureTrainingSessionSchema,
  getTrainingSessionDetail,
  listMyTrainingRegistrations,
  listPenaltyCandidates,
  listTrainingSessions,
  noShowTrainingSessionRegistrations,
  registerTrainingSession,
  rejectPenaltyCandidate,
  TrainingSeatUnavailableError,
  TrainingSessionStateError,
  updateTrainingSession
} from './trainingSessions.js';
import {
  createPenalty,
  ensureOperationalDataSchema,
  getActivePenaltyForUser,
  listConsumables,
  listPenalties,
  revokePenalty,
  saveConsumables
} from './operationalData.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const configuredClientOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedClientOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return configuredClientOrigins.includes(origin) ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.endsWith('.pages.dev');
  } catch {
    return false;
  }
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedClientOrigin(origin)) return callback(null, true);
    return callback(null, false);
  }
}));

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

const defaultJsonParser = express.json({ limit: '1mb' });
const uploadJsonParser = express.json({ limit: '40mb' });

app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/file-assets/upload') {
    return next();
  }
  return defaultJsonParser(req, res, next);
});

const healthPayload = {
  ok: true,
  api: 'apps/api',
  build: process.env.RENDER_GIT_COMMIT ?? process.env.COMMIT_SHA ?? 'local',
  schema: 'core-schema-sequential-v1'
};

app.head('/', (_req, res) => res.status(204).end());
app.get('/', (_req, res) => res.json(healthPayload));
app.get('/health', (_req, res) => res.json(healthPayload));

app.get('/dashboard/metrics', async (_req, res, next) => {
  try {
    res.json(await getDashboardMetrics());
  } catch (error) {
    next(error);
  }
});

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

app.post('/auth/google/access-token', async (req, res, next) => {
  try {
    res.json(await authenticateGoogleAccessToken(req.body));
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

app.delete('/qna/:id', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const item = await deleteQnaItem(id);
    if (!item) return res.status(404).json({ message: 'Q&A item not found' });
    await writeAuditLog(req.user!, 'QNA_DELETE', 'qna', id, { title: item.title, status: item.status });
    return res.json(item);
  } catch (error) {
    next(error);
  }
});

app.get('/reservations', requireAuth, async (req, res, next) => {
  try {
    res.json(await listReservations(req.user!));
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
    if (req.user!.role !== 'ADMIN') {
      const activePenalty = await getActivePenaltyForUser(req.user!.id);
      if (activePenalty) {
        return res.status(423).json({
          message: 'Equipment reservation is locked by an active penalty',
          penalty: activePenalty
        });
      }
    }
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

app.get('/audit-logs', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 200;
    res.json(await listAuditLogs(Number.isFinite(rawLimit) ? rawLimit : 200));
  } catch (error) {
    next(error);
  }
});

app.get('/file-assets', requireAuth, async (req, res, next) => {
  try {
    const query = z.object({
      ownerType: z.string().min(1).optional(),
      ownerId: z.string().min(1).optional()
    }).parse(req.query);
    res.json(await listFileAssets(query, req.user!));
  } catch (error) {
    next(error);
  }
});

app.post('/file-assets', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const file = await createFileAsset(req.body, req.user!);
    await writeAuditLog(req.user!, 'FILE_ASSET_CREATE', 'file_asset', file.id, {
      ownerType: file.ownerType,
      ownerId: file.ownerId,
      storageProvider: file.storageProvider,
      storageKey: file.storageKey
    });
    res.status(201).json(file);
  } catch (error) {
    next(error);
  }
});

app.post('/file-assets/upload', requireAuth, requireRole(['ADMIN', 'MANAGER']), uploadJsonParser, async (req, res, next) => {
  try {
    const upload = prepareR2Upload(req.body);
    await putR2Object(upload.storageKey, upload.buffer, upload.body.contentType);
    const file = await createFileAsset({
      ownerType: upload.body.ownerType,
      ownerId: upload.body.ownerId,
      purpose: upload.body.purpose,
      fileName: upload.body.fileName,
      contentType: upload.body.contentType,
      byteSize: upload.buffer.byteLength,
      storageProvider: 'r2',
      storageKey: upload.storageKey,
      checksum: upload.checksum
    }, req.user!);
    await writeAuditLog(req.user!, 'FILE_ASSET_UPLOAD', 'file_asset', file.id, {
      ownerType: file.ownerType,
      ownerId: file.ownerId,
      storageKey: file.storageKey,
      byteSize: file.byteSize
    });
    res.status(201).json(file);
  } catch (error) {
    next(error);
  }
});

app.get('/file-assets/:id/download', requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const file = await getFileAsset(id);
    if (!file || !canAccessFileAsset(file, req.user!)) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (file.storageProvider === 'external' && file.publicUrl) return res.redirect(file.publicUrl);

    const object = await getR2Object(file.storageKey);
    res.setHeader('Content-Type', file.contentType || object.contentType);
    res.setHeader('Content-Length', String(object.buffer.byteLength));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const fallbackFileName = file.fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'attachment';
    res.setHeader('Content-Disposition', `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    return res.send(object.buffer);
  } catch (error) {
    return next(error);
  }
});

app.delete('/file-assets/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const file = await deleteFileAsset(id, req.user!);
    if (!file) return res.status(404).json({ message: 'File asset not found' });
    if (file.storageProvider === 'r2') {
      await deleteR2Object(file.storageKey).catch((error) => {
        console.warn(JSON.stringify({
          level: 'warn',
          type: 'r2_delete_failed',
          requestId: res.locals.requestId,
          storageKey: file.storageKey,
          message: error instanceof Error ? error.message : String(error)
        }));
      });
    }
    await writeAuditLog(req.user!, 'FILE_ASSET_DELETE', 'file_asset', id, {
      ownerType: file.ownerType,
      ownerId: file.ownerId,
      storageProvider: file.storageProvider,
      storageKey: file.storageKey
    });
    res.json(file);
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
    const snapshot = await setUserEquipmentPermissions(userId, req.body, req.user!);
    await writeAuditLog(req.user!, 'EQUIPMENT_PERMISSION_SET', 'user', userId, {
      userId,
      equipmentIds: Array.isArray(req.body?.equipmentIds) ? req.body.equipmentIds : []
    });
    res.json(snapshot);
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

app.get('/trainings', requireAuth, async (req, res, next) => {
  try {
    res.json(await listTrainingSessions(req.user!, req.query));
  } catch (error) {
    next(error);
  }
});

app.get('/trainings/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const session = await getTrainingSessionDetail(id, req.user!);
    if (!session) return res.status(404).json({ message: 'Training session not found' });
    return res.json(session);
  } catch (error) {
    return next(error);
  }
});

app.post('/trainings/:id/register', requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const session = await registerTrainingSession(id, req.user!);
    await writeAuditLog(req.user!, 'TRAINING_SESSION_REGISTER', 'training_session', id, { userId: req.user!.id });
    return res.status(201).json(session);
  } catch (error) {
    return next(error);
  }
});

app.post('/trainings/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const session = await cancelTrainingRegistration(id, req.user!);
    await writeAuditLog(req.user!, 'TRAINING_SESSION_CANCEL_REGISTRATION', 'training_session', id, { userId: req.user!.id });
    return res.json(session);
  } catch (error) {
    return next(error);
  }
});

app.get('/me/registrations', requireAuth, async (req, res, next) => {
  try {
    return res.json(await listMyTrainingRegistrations(req.user!));
  } catch (error) {
    return next(error);
  }
});

app.post('/manager/trainings', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const session = await createTrainingSession(req.body, req.user!);
    if (!session) return res.status(404).json({ message: 'Training session not found after creation' });
    await writeAuditLog(req.user!, 'TRAINING_SESSION_CREATE', 'training_session', session.id, {
      equipmentId: session.equipmentId,
      applyDeadline: session.applyDeadline
    });
    return res.status(201).json(session);
  } catch (error) {
    return next(error);
  }
});

app.patch('/manager/trainings/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const session = await updateTrainingSession(id, req.body, req.user!);
    await writeAuditLog(req.user!, 'TRAINING_SESSION_UPDATE', 'training_session', id, {
      applyDeadline: session?.applyDeadline,
      note: session?.note
    });
    return res.json(session);
  } catch (error) {
    return next(error);
  }
});

app.delete('/manager/trainings/:id', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const result = await deleteTrainingSession(id, req.user!);
    await writeAuditLog(req.user!, 'TRAINING_SESSION_DELETE', 'training_session', id, result);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.get('/manager/trainings', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    return res.json(await listTrainingSessions(req.user!, { ...req.query, scope: 'manager' }));
  } catch (error) {
    return next(error);
  }
});

app.get('/manager/trainings/:id/registrations', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const session = await getTrainingSessionDetail(id, req.user!);
    if (!session) return res.status(404).json({ message: 'Training session not found' });
    if (req.user!.role !== 'ADMIN' && session.managerId !== req.user!.id) {
      return res.status(403).json({ message: 'Insufficient training manager scope' });
    }
    return res.json(session);
  } catch (error) {
    return next(error);
  }
});

app.post('/manager/trainings/:id/complete', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const session = await completeTrainingSessionRegistrations(id, req.body, req.user!);
    await writeAuditLog(req.user!, 'TRAINING_SESSION_COMPLETE', 'training_session', id, {
      userIds: Array.isArray(req.body?.userIds) ? req.body.userIds : []
    });
    return res.json(session);
  } catch (error) {
    return next(error);
  }
});

app.post('/manager/trainings/:id/no-show', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const session = await noShowTrainingSessionRegistrations(id, req.body, req.user!);
    await writeAuditLog(req.user!, 'TRAINING_SESSION_NO_SHOW', 'training_session', id, {
      userIds: Array.isArray(req.body?.userIds) ? req.body.userIds : [],
      reason: req.body?.reason
    });
    return res.json(session);
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

app.get('/hidden/equipment-usage-analytics/export', requireAuth, requireRole(['ADMIN']), async (_req, res, next) => {
  try {
    const featureKey = 'equipment_usage_analytics_export';
    if (!(await isFeatureEnabled(featureKey))) {
      return res.status(403).json({ message: 'Feature disabled', feature: featureKey });
    }

    const workbook = await buildEquipmentUsageAnalyticsWorkbook();
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="equipment-usage-analytics.xls"');
    return res.send(workbook);
  } catch (error) {
    return next(error);
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
    const items = await saveConsumables(month, req.body);
    await writeAuditLog(req.user!, 'CONSUMABLES_SAVE', 'consumables', month, {
      month,
      count: items.length
    });
    res.json(items);
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

app.get('/admin/penalties/candidates', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    return res.json(await listPenaltyCandidates(req.query));
  } catch (error) {
    return next(error);
  }
});

app.post('/admin/penalties/candidates/:id/confirm', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const candidate = await confirmPenaltyCandidate(id, req.body, req.user!);
    if (!candidate) return res.status(404).json({ message: 'Penalty candidate not found' });
    await writeAuditLog(req.user!, 'PENALTY_CANDIDATE_CONFIRM', 'penalty_candidate', id, { userId: candidate.userId });
    return res.json(candidate);
  } catch (error) {
    return next(error);
  }
});

app.post('/admin/penalties/candidates/:id/reject', requireAuth, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const candidate = await rejectPenaltyCandidate(id, req.body, req.user!);
    if (!candidate) return res.status(404).json({ message: 'Penalty candidate not found' });
    await writeAuditLog(req.user!, 'PENALTY_CANDIDATE_REJECT', 'penalty_candidate', id, { userId: candidate.userId });
    return res.json(candidate);
  } catch (error) {
    return next(error);
  }
});

function logApiError(error: unknown, req: express.Request, res: express.Response) {
  const knownError = error instanceof Error ? error : null;
  const databaseError = typeof error === 'object' && error !== null
    ? error as {
      code?: unknown;
      detail?: unknown;
      table?: unknown;
      column?: unknown;
      constraint?: unknown;
      routine?: unknown;
    }
    : null;
  console.error(JSON.stringify({
    level: 'error',
    type: 'exception',
    requestId: res.locals.requestId,
    method: req.method,
    path: req.originalUrl,
    name: knownError?.name ?? 'UnknownError',
    message: knownError?.message ?? String(error),
    code: typeof databaseError?.code === 'string' ? databaseError.code : undefined,
    detail: typeof databaseError?.detail === 'string' ? databaseError.detail : undefined,
    table: typeof databaseError?.table === 'string' ? databaseError.table : undefined,
    column: typeof databaseError?.column === 'string' ? databaseError.column : undefined,
    constraint: typeof databaseError?.constraint === 'string' ? databaseError.constraint : undefined,
    routine: typeof databaseError?.routine === 'string' ? databaseError.routine : undefined,
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
  if (error instanceof TrainingSessionStateError || error instanceof TrainingSeatUnavailableError) {
    return errorResponse(res, 409, { message: error.message });
  }
  if (error instanceof z.ZodError) {
    return errorResponse(res, 400, { message: 'Invalid request body', issues: error.issues });
  }
  logApiError(error, req, res);
  return errorResponse(res, 500, { message: 'Internal server error' });
});

async function startServer() {
  await ensureCoreSchema();
  await Promise.all([
    ensureEquipmentPermissionSchema(),
    ensureTrainingRequestSchema(),
    ensureTrainingSessionSchema(),
    ensureOperationalDataSchema(),
    ensureAuditLogSchema(),
    ensureFileAssetSchema(),
    ensureFeatureFlagSchema()
  ]);
  app.listen(port, () => {
    console.log(`HBNU API listening on ${port}`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

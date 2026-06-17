import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { requireAuth, requireRole, signToken } from './auth.js';
import { equipment, reservations } from './data.js';
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
app.get('/equipment', (_req, res) => res.json(equipment));
app.get('/equipment/:id', (req, res) => {
    const item = equipment.find((entry) => entry.id === req.params.id);
    if (!item)
        return res.status(404).json({ message: 'Equipment not found' });
    return res.json(item);
});
app.get('/reservations', requireAuth, (_req, res) => res.json(reservations));
app.post('/reservations', requireAuth, (req, res) => {
    const body = z.object({
        equipmentId: z.string(),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        purpose: z.string().min(5)
    }).parse(req.body);
    const overlaps = reservations.some((reservation) => reservation.equipmentId === body.equipmentId &&
        reservation.status !== 'canceled' &&
        new Date(body.startsAt) < new Date(reservation.endsAt) &&
        new Date(body.endsAt) > new Date(reservation.startsAt));
    if (overlaps)
        return res.status(409).json({ message: 'Reservation overlaps existing booking' });
    return res.status(201).json({ id: `r-${Date.now()}`, ...body, status: 'pending' });
});
app.get('/admin/summary', requireAuth, requireRole(['ADMIN']), (_req, res) => {
    res.json({
        users: 128,
        pendingReservations: 9,
        educationRequests: 17,
        equipmentOnline: equipment.length
    });
});
app.listen(port, () => {
    console.log(`HBNU API listening on ${port}`);
});

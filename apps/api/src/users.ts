import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { type RegistrationProfile, type Role, signRegistrationToken, signToken, verifyRegistrationToken } from './auth.js';
import { hasDatabase, query } from './db.js';

const managedUserSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  roleLevel: z.string().default('일반'),
  department: z.string().min(1),
  labProfessor: z.string().min(1),
  phone: z.string().default(''),
  email: z.string().email(),
  memo: z.string().default(''),
  authProvider: z.enum(['Google', 'Manual']).default('Manual'),
  googleSubject: z.string().optional(),
  onboardingStatus: z.enum(['profile_pending', 'training_pending', 'active']).default('training_pending')
});

const googleTokenInfoSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  email_verified: z.union([z.boolean(), z.string()]).optional(),
  name: z.string().optional(),
  aud: z.string().optional()
});

type ManagedUser = z.infer<typeof managedUserSchema> & { id: string; index: number };

const fallbackUsers: ManagedUser[] = [];

function toRoleId(role: Role) {
  return role === 'ADMIN' ? 'role-admin' : role === 'MANAGER' ? 'role-manager' : 'role-user';
}

function getConfiguredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isConfiguredAdminEmail(email: string) {
  return getConfiguredAdminEmails().has(email.toLowerCase());
}

function mapUserRow(row: Record<string, unknown>, index = 0): ManagedUser {
  return {
    id: String(row.id),
    index,
    name: String(row.name),
    roleLevel: String(row.role_level ?? '일반'),
    department: String(row.department ?? ''),
    labProfessor: String(row.lab_professor ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email),
    memo: String(row.memo ?? ''),
    authProvider: String(row.auth_provider ?? 'Manual') === 'Google' ? 'Google' : 'Manual',
    googleSubject: row.google_subject ? String(row.google_subject) : undefined,
    onboardingStatus: row.onboarding_status === 'active' || row.onboarding_status === 'profile_pending'
      ? row.onboarding_status
      : 'training_pending'
  };
}

function toSessionUser(user: ManagedUser, role: Role = 'USER') {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role
  };
}

async function getPrimaryRole(userId: string): Promise<Role> {
  if (!hasDatabase()) return 'USER';
  const result = await query<{ name: Role }>(
    `select r.name
     from user_roles ur
     join roles r on r.id = ur.role_id
     where ur.user_id = $1
     order by case r.name when 'ADMIN' then 1 when 'MANAGER' then 2 else 3 end
     limit 1`,
    [userId]
  );
  return result.rows[0]?.name ?? 'USER';
}

async function grantRole(userId: string, role: Role) {
  if (!hasDatabase()) return;
  await query(
    `insert into user_roles (user_id, role_id)
     values ($1, $2)
     on conflict (user_id, role_id) do nothing`,
    [userId, toRoleId(role)]
  );
}

async function grantConfiguredAdminRole(user: ManagedUser) {
  if (!isConfiguredAdminEmail(user.email)) return false;
  await grantRole(user.id, 'ADMIN');
  return true;
}

export async function listUsers() {
  if (!hasDatabase()) return fallbackUsers;
  const result = await query<Record<string, unknown>>(
    `select id, email, name, auth_provider, google_subject, department, lab_professor, phone, memo,
      role_level, onboarding_status
     from users
     where deleted_at is null
     order by created_at asc, name asc`
  );
  return result.rows.map((row, index) => mapUserRow(row, index + 1));
}

export async function createUser(input: unknown) {
  const user = managedUserSchema.parse(input);
  const id = user.id ?? `user-${randomUUID()}`;

  if (!hasDatabase()) {
    const created = { ...user, id, index: fallbackUsers.length + 1 };
    fallbackUsers.push(created);
    return created;
  }

  const result = await query<Record<string, unknown>>(
    `insert into users (
      id, email, name, auth_provider, google_subject, department, lab_professor, phone, memo,
      role_level, onboarding_status
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (email) do update set
       name = excluded.name,
       auth_provider = excluded.auth_provider,
       google_subject = coalesce(excluded.google_subject, users.google_subject),
       department = excluded.department,
       lab_professor = excluded.lab_professor,
       phone = excluded.phone,
       memo = excluded.memo,
       role_level = excluded.role_level,
       onboarding_status = excluded.onboarding_status,
       updated_at = now(),
       deleted_at = null
     returning id, email, name, auth_provider, google_subject, department, lab_professor, phone, memo,
       role_level, onboarding_status`,
    [
      id,
      user.email,
      user.name,
      user.authProvider,
      user.googleSubject ?? null,
      user.department,
      user.labProfessor,
      user.phone,
      user.memo,
      user.roleLevel,
      user.onboardingStatus
    ]
  );
  const created = mapUserRow(result.rows[0], 1);
  await grantRole(created.id, 'USER');
  return created;
}

export async function updateUser(id: string, input: unknown) {
  const patch = managedUserSchema.partial().omit({ id: true }).parse(input);
  if (!hasDatabase()) {
    const index = fallbackUsers.findIndex((user) => user.id === id);
    if (index === -1) return null;
    fallbackUsers[index] = { ...fallbackUsers[index], ...patch };
    return fallbackUsers[index];
  }

  const result = await query<Record<string, unknown>>(
    `update users
     set name = coalesce($2, name),
       department = coalesce($3, department),
       lab_professor = coalesce($4, lab_professor),
       phone = coalesce($5, phone),
       email = coalesce($6, email),
       memo = coalesce($7, memo),
       role_level = coalesce($8, role_level),
       auth_provider = coalesce($9, auth_provider),
       onboarding_status = coalesce($10, onboarding_status),
       updated_at = now()
     where id = $1 and deleted_at is null
     returning id, email, name, auth_provider, google_subject, department, lab_professor, phone, memo,
       role_level, onboarding_status`,
    [
      id,
      patch.name ?? null,
      patch.department ?? null,
      patch.labProfessor ?? null,
      patch.phone ?? null,
      patch.email ?? null,
      patch.memo ?? null,
      patch.roleLevel ?? null,
      patch.authProvider ?? null,
      patch.onboardingStatus ?? null
    ]
  );
  return result.rows[0] ? mapUserRow(result.rows[0], 1) : null;
}

export async function deleteUser(id: string) {
  if (!hasDatabase()) {
    const index = fallbackUsers.findIndex((user) => user.id === id);
    if (index === -1) return null;
    const [removed] = fallbackUsers.splice(index, 1);
    return removed;
  }

  const result = await query<Record<string, unknown>>(
    `update users
     set deleted_at = now(), updated_at = now()
     where id = $1 and deleted_at is null
     returning id, email, name, auth_provider, google_subject, department, lab_professor, phone, memo,
       role_level, onboarding_status`,
    [id]
  );
  return result.rows[0] ? mapUserRow(result.rows[0], 1) : null;
}

async function findUserByGoogleSubject(googleSubject: string) {
  if (!hasDatabase()) {
    return fallbackUsers.find((user) => user.googleSubject === googleSubject) ?? null;
  }
  const result = await query<Record<string, unknown>>(
    `select id, email, name, auth_provider, google_subject, department, lab_professor, phone, memo,
      role_level, onboarding_status
     from users
     where google_subject = $1 and deleted_at is null
     limit 1`,
    [googleSubject]
  );
  return result.rows[0] ? mapUserRow(result.rows[0], 1) : null;
}

async function findUserByEmail(email: string) {
  if (!hasDatabase()) {
    return fallbackUsers.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  const result = await query<Record<string, unknown>>(
    `select id, email, name, auth_provider, google_subject, department, lab_professor, phone, memo,
      role_level, onboarding_status
     from users
     where lower(email) = lower($1) and deleted_at is null
     limit 1`,
    [email]
  );
  return result.rows[0] ? mapUserRow(result.rows[0], 1) : null;
}

async function verifyGoogleCredential(credential: string): Promise<RegistrationProfile> {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) {
    throw new Error('Google credential verification failed');
  }
  const tokenInfo = googleTokenInfoSchema.parse(await response.json());
  const expectedAudience = process.env.GOOGLE_CLIENT_ID;
  if (expectedAudience && tokenInfo.aud !== expectedAudience) {
    throw new Error('Google credential audience mismatch');
  }
  if (tokenInfo.email_verified === false || tokenInfo.email_verified === 'false') {
    throw new Error('Google email is not verified');
  }
  return {
    googleSubject: tokenInfo.sub,
    email: tokenInfo.email,
    name: tokenInfo.name ?? tokenInfo.email.split('@')[0],
    provider: 'Google'
  };
}

export async function authenticateGoogle(input: unknown) {
  const body = z.object({ credential: z.string().min(1) }).parse(input);
  const profile = await verifyGoogleCredential(body.credential);
  const user = await findUserByGoogleSubject(profile.googleSubject) ?? await findUserByEmail(profile.email);

  if (!user) {
    return {
      requiresRegistration: true,
      registrationToken: signRegistrationToken(profile),
      profile: {
        name: profile.name,
        email: profile.email,
        authProvider: profile.provider
      }
    };
  }

  const isAdmin = await grantConfiguredAdminRole(user);
  const role = isAdmin ? 'ADMIN' : await getPrimaryRole(user.id);
  const sessionUser = toSessionUser(user, role);
  return {
    requiresRegistration: false,
    user: sessionUser,
    managedUser: user,
    token: signToken(sessionUser)
  };
}

export async function registerGoogleUser(input: unknown) {
  const body = z.object({
    registrationToken: z.string().min(1),
    name: z.string().min(1),
    department: z.string().min(1),
    labProfessor: z.string().min(1),
    phone: z.string().default(''),
    email: z.string().email()
  }).parse(input);
  const profile = verifyRegistrationToken(body.registrationToken);
  if (profile.email.toLowerCase() !== body.email.toLowerCase()) {
    throw new Error('Registration email does not match Google account');
  }

  const user = await createUser({
    name: body.name,
    department: body.department,
    labProfessor: body.labProfessor,
    phone: body.phone,
    email: body.email,
    memo: 'Google 본인인증 후 가입, 장비 교육 이수 대기',
    roleLevel: '일반',
    authProvider: 'Google',
    googleSubject: profile.googleSubject,
    onboardingStatus: 'training_pending'
  });
  const isAdmin = await grantConfiguredAdminRole(user);
  const sessionUser = toSessionUser(user, isAdmin ? 'ADMIN' : 'USER');
  return {
    user: sessionUser,
    managedUser: user,
    token: signToken(sessionUser)
  };
}

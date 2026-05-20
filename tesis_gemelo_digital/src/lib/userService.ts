import { WithId } from 'mongodb';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { getDb } from './db';
import { User, UserRole } from '@/types';

const COLLECTION_NAME = 'usuarios';
const PASSWORD_KEY_LENGTH = 64;
const ALLOWED_ROLES: UserRole[] = ['admin', 'user'];
const MIN_PASSWORD_LENGTH = 8;

type UserDocument = Omit<User, '_id' | 'createdAt' | 'updatedAt'> & {
  email: string;
  role: UserRole;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface RegisterPayload {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
}

export interface LoginPayload {
  email?: string;
  password?: string;
}

function mapUser(doc: WithId<UserDocument>): User {
  return {
    _id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function ensureRole(role?: string): UserRole {
  if (!role) {
    return 'user';
  }
  const normalized = role.trim().toLowerCase();
  if (ALLOWED_ROLES.includes(normalized as UserRole)) {
    return normalized as UserRole;
  }
  throw new Error(`Rol no válido. Roles permitidos: ${ALLOWED_ROLES.join(', ')}.`);
}

function ensurePassword(password?: string): string {
  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  return password;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) {
    return false;
  }
  const saltBuffer = Buffer.from(saltHex, 'hex');
  const storedBuffer = Buffer.from(hashHex, 'hex');
  const derived = scryptSync(password, saltBuffer, PASSWORD_KEY_LENGTH);
  if (storedBuffer.length !== derived.length) {
    return false;
  }
  return timingSafeEqual(derived, storedBuffer);
}

export async function registerUser(payload: RegisterPayload): Promise<User> {
  if (!payload.email) {
    throw new Error('El correo es obligatorio.');
  }
  const email = normalizeEmail(payload.email);
  const password = ensurePassword(payload.password);
  const role = ensureRole(payload.role);

  const db = await getDb();
  const collection = db.collection<UserDocument>(COLLECTION_NAME);

  const existing = await collection.findOne({ email });
  if (existing) {
    throw new Error('Ya existe un usuario con ese correo.');
  }

  const now = new Date();
  const document: UserDocument = {
    email,
    name: payload.name?.trim() || undefined,
    role,
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };

  const { insertedId } = await collection.insertOne(document);
  const inserted = await collection.findOne({ _id: insertedId });

  if (!inserted) {
    throw new Error('No se pudo registrar el usuario.');
  }

  return mapUser(inserted);
}

export async function authenticateUser(payload: LoginPayload): Promise<User> {
  if (!payload.email || !payload.password) {
    throw new Error('Correo y contraseña son obligatorios.');
  }

  const email = normalizeEmail(payload.email);
  const db = await getDb();
  const collection = db.collection<UserDocument>(COLLECTION_NAME);

  const user = await collection.findOne({ email });
  if (!user) {
    throw new Error('Credenciales inválidas.');
  }

  const validPassword = verifyPassword(payload.password, user.passwordHash);
  if (!validPassword) {
    throw new Error('Credenciales inválidas.');
  }

  return mapUser(user);
}

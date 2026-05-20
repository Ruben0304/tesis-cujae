import { ObjectId, WithId } from 'mongodb';
import { InverterConfig } from '@/types';
import { getDb } from './db';

const COLLECTION_NAME = 'inversores';

type InverterDocument = Omit<InverterConfig, '_id' | 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};

function mapInverter(doc: WithId<InverterDocument>): InverterConfig {
  return {
    _id: doc._id.toHexString(),
    manufacturer: doc.manufacturer,
    model: doc.model,
    ratedPowerKw: doc.ratedPowerKw,
    quantity: doc.quantity,
    efficiencyPercent: doc.efficiencyPercent,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function ensurePositive(value: unknown, field: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`El campo ${field} debe ser un número mayor que cero.`);
  }
  return num;
}

function ensureNonNegative(value: unknown, field: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`El campo ${field} debe ser un número mayor o igual que cero.`);
  }
  return num;
}

export async function listInverters(): Promise<InverterConfig[]> {
  const db = await getDb();
  const collection = db.collection<InverterDocument>(COLLECTION_NAME);
  const docs = await collection.find().sort({ updatedAt: -1 }).toArray();
  return docs.map(mapInverter);
}

export async function getInverterById(id: string): Promise<InverterConfig | null> {
  const db = await getDb();
  const collection = db.collection<InverterDocument>(COLLECTION_NAME);
  const _id = new ObjectId(id);
  const doc = await collection.findOne({ _id });
  return doc ? mapInverter(doc) : null;
}

export async function createInverter(payload: Partial<InverterConfig>): Promise<InverterConfig> {
  if (!payload.manufacturer?.trim()) {
    throw new Error('El campo manufacturer es obligatorio.');
  }

  const now = new Date();
  const document: InverterDocument = {
    manufacturer: payload.manufacturer.trim(),
    model: payload.model,
    ratedPowerKw: ensurePositive(payload.ratedPowerKw, 'ratedPowerKw'),
    quantity: Math.trunc(ensurePositive(payload.quantity, 'quantity')),
    efficiencyPercent:
      payload.efficiencyPercent !== undefined
        ? ensureNonNegative(payload.efficiencyPercent, 'efficiencyPercent')
        : undefined,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const collection = db.collection<InverterDocument>(COLLECTION_NAME);
  const result = await collection.insertOne(document);

  return {
    ...payload,
    _id: result.insertedId.toHexString(),
    manufacturer: document.manufacturer,
    model: document.model,
    ratedPowerKw: document.ratedPowerKw,
    quantity: document.quantity,
    efficiencyPercent: document.efficiencyPercent,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export async function updateInverter(
  id: string,
  payload: Partial<InverterConfig>
): Promise<InverterConfig | null> {
  const db = await getDb();
  const collection = db.collection<InverterDocument>(COLLECTION_NAME);
  const _id = new ObjectId(id);

  const existing = await collection.findOne({ _id });
  if (!existing) {
    return null;
  }

  const update: Partial<InverterDocument> = {};

  if (payload.manufacturer !== undefined) {
    if (!payload.manufacturer.trim()) {
      throw new Error('El campo manufacturer es obligatorio.');
    }
    update.manufacturer = payload.manufacturer.trim();
  }
  if (payload.model !== undefined) update.model = payload.model;
  if (payload.ratedPowerKw !== undefined) {
    update.ratedPowerKw = ensurePositive(payload.ratedPowerKw, 'ratedPowerKw');
  }
  if (payload.quantity !== undefined) {
    update.quantity = Math.trunc(ensurePositive(payload.quantity, 'quantity'));
  }
  if (payload.efficiencyPercent !== undefined) {
    update.efficiencyPercent = ensureNonNegative(payload.efficiencyPercent, 'efficiencyPercent');
  }

  update.updatedAt = new Date();

  await collection.updateOne({ _id }, { $set: update });
  const refreshed = await collection.findOne({ _id });

  return refreshed ? mapInverter(refreshed) : null;
}

export async function deleteInverter(id: string): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection<InverterDocument>(COLLECTION_NAME);
  const _id = new ObjectId(id);
  const result = await collection.deleteOne({ _id });
  return result.deletedCount === 1;
}

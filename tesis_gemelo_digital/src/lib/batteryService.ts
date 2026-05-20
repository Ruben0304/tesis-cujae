import { ObjectId, WithId } from 'mongodb';
import { BatteryConfig } from '@/types';
import { getDb } from './db';

const COLLECTION_NAME = 'baterias';

type BatteryDocument = Omit<BatteryConfig, '_id' | 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};

function mapBattery(doc: WithId<BatteryDocument>): BatteryConfig {
  return {
    _id: doc._id.toHexString(),
    manufacturer: doc.manufacturer,
    model: doc.model,
    capacityKwh: doc.capacityKwh,
    quantity: doc.quantity,
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

export async function listBatteries(): Promise<BatteryConfig[]> {
  const db = await getDb();
  const collection = db.collection<BatteryDocument>(COLLECTION_NAME);
  const docs = await collection.find().sort({ updatedAt: -1 }).toArray();
  return docs.map(mapBattery);
}

export async function getBatteryById(id: string): Promise<BatteryConfig | null> {
  const db = await getDb();
  const collection = db.collection<BatteryDocument>(COLLECTION_NAME);
  const _id = new ObjectId(id);
  const doc = await collection.findOne({ _id });
  return doc ? mapBattery(doc) : null;
}

export async function createBattery(payload: Partial<BatteryConfig>): Promise<BatteryConfig> {
  if (!payload.manufacturer?.trim()) {
    throw new Error('El campo manufacturer es obligatorio.');
  }

  const now = new Date();
  const document: BatteryDocument = {
    manufacturer: payload.manufacturer.trim(),
    model: payload.model,
    capacityKwh: ensurePositive(payload.capacityKwh, 'capacityKwh'),
    quantity: Math.trunc(ensurePositive(payload.quantity, 'quantity')),
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const collection = db.collection<BatteryDocument>(COLLECTION_NAME);
  const result = await collection.insertOne(document);

  return {
    ...payload,
    _id: result.insertedId.toHexString(),
    manufacturer: document.manufacturer,
    model: document.model,
    capacityKwh: document.capacityKwh,
    quantity: document.quantity,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export async function updateBattery(
  id: string,
  payload: Partial<BatteryConfig>
): Promise<BatteryConfig | null> {
  const db = await getDb();
  const collection = db.collection<BatteryDocument>(COLLECTION_NAME);
  const _id = new ObjectId(id);

  const existing = await collection.findOne({ _id });
  if (!existing) {
    return null;
  }

  const update: Partial<BatteryDocument> = {};

  if (payload.manufacturer !== undefined) {
    if (!payload.manufacturer.trim()) {
      throw new Error('El campo manufacturer es obligatorio.');
    }
    update.manufacturer = payload.manufacturer.trim();
  }
  if (payload.model !== undefined) update.model = payload.model;
  if (payload.capacityKwh !== undefined) {
    update.capacityKwh = ensurePositive(payload.capacityKwh, 'capacityKwh');
  }
  if (payload.quantity !== undefined) {
    update.quantity = Math.trunc(ensurePositive(payload.quantity, 'quantity'));
  }

  update.updatedAt = new Date();

  await collection.updateOne({ _id }, { $set: update });
  const refreshed = await collection.findOne({ _id });

  return refreshed ? mapBattery(refreshed) : null;
}

export async function deleteBattery(id: string): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection<BatteryDocument>(COLLECTION_NAME);
  const _id = new ObjectId(id);
  const result = await collection.deleteOne({ _id });
  return result.deletedCount === 1;
}

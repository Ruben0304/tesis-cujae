import { ObjectId, WithId } from 'mongodb';
import { SolarPanelConfig } from '@/types';
import { getDb } from './db';

const COLLECTION_NAME = 'paneles';

type SolarPanelDocument = Omit<SolarPanelConfig, '_id' | 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};

function mapPanel(doc: WithId<SolarPanelDocument>): SolarPanelConfig {
  return {
    _id: doc._id.toHexString(),
    manufacturer: doc.manufacturer,
    model: doc.model,
    ratedPowerKw: doc.ratedPowerKw,
    quantity: doc.quantity,
    tiltDegrees: doc.tiltDegrees,
    orientation: doc.orientation,
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

export async function listPanels(): Promise<SolarPanelConfig[]> {
  const db = await getDb();
  const collection = db.collection<SolarPanelDocument>(COLLECTION_NAME);
  const docs = await collection.find().sort({ updatedAt: -1 }).toArray();
  return docs.map(mapPanel);
}

export async function getPanelById(id: string): Promise<SolarPanelConfig | null> {
  const db = await getDb();
  const collection = db.collection<SolarPanelDocument>(COLLECTION_NAME);
  const _id = new ObjectId(id);
  const doc = await collection.findOne({ _id });
  return doc ? mapPanel(doc) : null;
}

export async function createPanel(payload: Partial<SolarPanelConfig>): Promise<SolarPanelConfig> {
  if (!payload.manufacturer?.trim()) {
    throw new Error('El campo manufacturer es obligatorio.');
  }

  const now = new Date();
  const document: SolarPanelDocument = {
    manufacturer: payload.manufacturer.trim(),
    model: payload.model,
    ratedPowerKw: ensurePositive(payload.ratedPowerKw, 'ratedPowerKw'),
    quantity: Math.trunc(ensurePositive(payload.quantity, 'quantity')),
    tiltDegrees: payload.tiltDegrees !== undefined
      ? ensureNonNegative(payload.tiltDegrees, 'tiltDegrees')
      : undefined,
    orientation: payload.orientation,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const collection = db.collection<SolarPanelDocument>(COLLECTION_NAME);
  const result = await collection.insertOne(document);

  return {
    ...payload,
    _id: result.insertedId.toHexString(),
    manufacturer: document.manufacturer,
    model: document.model,
    ratedPowerKw: document.ratedPowerKw,
    quantity: document.quantity,
    tiltDegrees: document.tiltDegrees,
    orientation: document.orientation,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export async function updatePanel(
  id: string,
  payload: Partial<SolarPanelConfig>
): Promise<SolarPanelConfig | null> {
  const db = await getDb();
  const collection = db.collection<SolarPanelDocument>(COLLECTION_NAME);
  const _id = new ObjectId(id);

  const existing = await collection.findOne({ _id });
  if (!existing) {
    return null;
  }

  const update: Partial<SolarPanelDocument> = {};

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
  if (payload.tiltDegrees !== undefined) {
    update.tiltDegrees = ensureNonNegative(payload.tiltDegrees, 'tiltDegrees');
  }
  if (payload.orientation !== undefined) update.orientation = payload.orientation;

  update.updatedAt = new Date();

  await collection.updateOne({ _id }, { $set: update });
  const refreshed = await collection.findOne({ _id });

  return refreshed ? mapPanel(refreshed) : null;
}

export async function deletePanel(id: string): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection<SolarPanelDocument>(COLLECTION_NAME);
  const _id = new ObjectId(id);
  const result = await collection.deleteOne({ _id });
  return result.deletedCount === 1;
}

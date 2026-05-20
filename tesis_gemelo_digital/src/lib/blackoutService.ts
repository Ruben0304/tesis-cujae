import { WithId } from 'mongodb';
import { addMinutes, differenceInMinutes, isAfter, isBefore, isValid, startOfDay } from 'date-fns';
import { getDb } from './db';
import { BlackoutSchedule, BlackoutInterval } from '@/types';

const COLLECTION_NAME = 'apagones';

type BlackoutIntervalDocument = {
  start: Date;
  end: Date;
  durationMinutes: number;
};

type BlackoutDocument = {
  date: Date;
  intervals: BlackoutIntervalDocument[];
  province?: string;
  municipality?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface SaveBlackoutPayload {
  date?: string;
  intervals?: Array<{
    start?: string;
    end?: string;
  }>;
  province?: string;
  municipality?: string;
  notes?: string;
}

function mapInterval(doc: BlackoutIntervalDocument): BlackoutInterval {
  return {
    start: doc.start.toISOString(),
    end: doc.end.toISOString(),
    durationMinutes: doc.durationMinutes,
  };
}

function mapSchedule(doc: WithId<BlackoutDocument>): BlackoutSchedule {
  return {
    _id: doc._id.toHexString(),
    date: doc.date.toISOString(),
    intervals: doc.intervals.map(mapInterval),
    province: doc.province,
    municipality: doc.municipality,
    notes: doc.notes,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function ensureValidDate(dateStr?: string): Date {
  if (!dateStr) {
    throw new Error('La fecha del día es obligatoria.');
  }
  const date = new Date(dateStr);
  if (!isValid(date)) {
    throw new Error('La fecha proporcionada es inválida.');
  }
  return startOfDay(date);
}

function ensureValidIntervals(date: Date, intervals?: SaveBlackoutPayload['intervals']): BlackoutIntervalDocument[] {
  if (!intervals || intervals.length === 0) {
    throw new Error('Se requiere al menos un intervalo de apagón.');
  }

  const normalized: BlackoutIntervalDocument[] = intervals.map((interval, index) => {
    if (!interval.start || !interval.end) {
      throw new Error(`El intervalo #${index + 1} debe incluir hora de inicio y fin.`);
    }
    const start = new Date(interval.start);
    const end = new Date(interval.end);

    if (!isValid(start) || !isValid(end)) {
      throw new Error(`El intervalo #${index + 1} tiene fechas inválidas.`);
    }

    if (isAfter(start, end) || start.getTime() === end.getTime()) {
      throw new Error(`El intervalo #${index + 1} debe tener fin posterior al inicio.`);
    }

    if (!isSameDayRange(date, start, end)) {
      throw new Error(`El intervalo #${index + 1} debe pertenecer al mismo día indicado.`);
    }

    const durationMinutes = differenceInMinutes(end, start);
    if (durationMinutes < 15) {
      throw new Error(`El intervalo #${index + 1} debe durar al menos 15 minutos.`);
    }

    return {
      start,
      end,
      durationMinutes,
    };
  });

  normalized.sort((a, b) => a.start.getTime() - b.start.getTime());

  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const current = normalized[i];
    if (!isBefore(prev.end, current.start)) {
      throw new Error('Los intervalos de apagón no pueden solaparse.');
    }
  }

  return normalized;
}

function isSameDayRange(reference: Date, start: Date, end: Date): boolean {
  const rangeStart = startOfDay(reference);
  const rangeEnd = addMinutes(rangeStart, 24 * 60);
  return (
    !isBefore(start, rangeStart) &&
    isBefore(start, rangeEnd) &&
    !isAfter(end, rangeEnd)
  );
}

export async function saveBlackoutSchedule(payload: SaveBlackoutPayload): Promise<BlackoutSchedule> {
  const date = ensureValidDate(payload.date);
  const intervals = ensureValidIntervals(date, payload.intervals);

  const db = await getDb();
  const collection = db.collection<BlackoutDocument>(COLLECTION_NAME);

  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { date },
    {
      $set: {
        date,
        intervals,
        province: payload.province?.trim() || undefined,
        municipality: payload.municipality?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    }
  );

  if (!result) {
    throw new Error('No se pudo guardar el horario de apagón.');
  }

  return mapSchedule(result);
}

export interface ListBlackoutsOptions {
  from?: string;
  to?: string;
  limit?: number;
}

export async function getBlackoutByDate(dateStr: string): Promise<BlackoutSchedule | null> {
  const date = ensureValidDate(dateStr);
  const db = await getDb();
  const collection = db.collection<BlackoutDocument>(COLLECTION_NAME);
  const doc = await collection.findOne({ date });
  return doc ? mapSchedule(doc) : null;
}

export async function listBlackouts(options: ListBlackoutsOptions = {}): Promise<BlackoutSchedule[]> {
  const db = await getDb();
  const collection = db.collection<BlackoutDocument>(COLLECTION_NAME);

  const query: Record<string, unknown> = {};
  const filters: Record<string, unknown> = {};

  if (options.from) {
    const fromDate = startOfDay(new Date(options.from));
    if (!isValid(fromDate)) {
      throw new Error('El parámetro "from" es inválido.');
    }
    filters.$gte = fromDate;
  }

  if (options.to) {
    const toDate = startOfDay(new Date(options.to));
    if (!isValid(toDate)) {
      throw new Error('El parámetro "to" es inválido.');
    }
    filters.$lte = toDate;
  }

  if (Object.keys(filters).length > 0) {
    query.date = filters;
  }

  const cursor = collection
    .find(query)
    .sort({ date: 1 });

  if (options.limit && options.limit > 0) {
    cursor.limit(options.limit);
  }

  const docs = await cursor.toArray();
  return docs.map(mapSchedule);
}

export async function getBlackoutsForRange(from: Date, to: Date): Promise<BlackoutSchedule[]> {
  const db = await getDb();
  const collection = db.collection<BlackoutDocument>(COLLECTION_NAME);

  const docs = await collection
    .find({
      date: {
        $gte: startOfDay(from),
        $lte: startOfDay(to),
      },
    })
    .sort({ date: 1 })
    .toArray();

  return docs.map(mapSchedule);
}

export async function deleteBlackout(dateStr: string): Promise<boolean> {
  const date = ensureValidDate(dateStr);
  const db = await getDb();
  const collection = db.collection<BlackoutDocument>(COLLECTION_NAME);
  const { deletedCount } = await collection.deleteOne({ date });
  return deletedCount === 1;
}

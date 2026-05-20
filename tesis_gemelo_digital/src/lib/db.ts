import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;
const defaultDbName = 'GemeloDigitalCujai';
const dbName = process.env.MONGODB_DB || defaultDbName;

if (!uri) {
  throw new Error('Falta la variable de entorno MONGODB_URI con la cadena de conexión.');
}

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getMongoClient(): Promise<MongoClient> {
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const mongoClient = await getMongoClient();
  return mongoClient.db(dbName);
}

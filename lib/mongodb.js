import mongoose from 'mongoose';

// Import every model here once, so any serverless function that calls
// dbConnect() has all schemas registered before running queries/populate.
import '@/models/Category';
import '@/models/Product'; // adjust to your actual filename

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in .env - add your MongoDB Atlas connection string');
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false }).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
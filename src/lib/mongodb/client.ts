import "server-only";
import mongoose from "mongoose";

/**
 * MongoDB connection setup for SatSlots.
 *
 * Uses Mongoose for schema definition and ODM functionality.
 * Connection is cached on globalThis to avoid connection pool exhaustion
 * during Next.js dev-mode hot reloads.
 */

declare global {
  var __satslotsMongoConnected: boolean | undefined;
}

export async function getMongo(): Promise<void> {
  if (!globalThis.__satslotsMongoConnected) {
    const connectionString = process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error(
        "MONGODB_URI is not set. Add it to your .env file.",
      );
    }
    
    await mongoose.connect(connectionString, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
    
    globalThis.__satslotsMongoConnected = true;
  }
}

export async function disconnectMongo(): Promise<void> {
  if (globalThis.__satslotsMongoConnected) {
    await mongoose.disconnect();
    globalThis.__satslotsMongoConnected = false;
  }
}

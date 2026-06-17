import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// 📂 Safe database presence check
export const isDbAvailable = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim().length > 0;

// 📂 Shared local in-memory fallback registry
export const memoryUsers = new Map<string, any>();
export const memoryCharacters = new Map<string, any>();


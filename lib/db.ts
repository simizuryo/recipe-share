import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { sslOptionsFor } from "@/lib/db-ssl";
import { PrismaClient } from "@/lib/generated/prisma/client";

// 開発中はファイル保存のたびにモジュールが読み直されるため、接続を作りすぎないよう globalThis に1つだけ持つ
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL が設定されていません(.env.example を参照)");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, ssl: sslOptionsFor(connectionString) }),
  });
}

/** アプリ全体で使う Prisma Client。最初に使われたときに作る */
export function getDb(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

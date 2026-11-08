// Prisma CLI(migrate / generate / studio)の設定。Prisma 7 は .env を自動で読まないため、dotenv で読み込む。
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});

import "dotenv/config";
import { defineConfig } from "prisma/config";

const fallbackUrl = "postgresql://postgres:postgres@localhost:5432/solversbounty";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackUrl,
  },
});

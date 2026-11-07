import "dotenv/config";
import { defineConfig } from "prisma/config";

const fallbackUrl = "postgresql://postgres:postgres@localhost:5432/solversbounty";

// Prisma CLI migrations use the direct Neon connection. The API adapter uses
// the pooled DATABASE_URL and does not read this value. Generate does not connect.
const directUrl = process.env.DIRECT_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl && directUrl.length > 0 ? directUrl : fallbackUrl,
  },
});

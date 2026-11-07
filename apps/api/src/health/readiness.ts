import type { DatabaseStatus } from "../database/database.service";

export function readinessResult(database: DatabaseStatus): {
  statusCode: 200 | 503;
  body: { status: "ready" | "not_ready"; checks: { database: DatabaseStatus } };
} {
  if (database === "down") {
    return {
      statusCode: 503,
      body: { status: "not_ready", checks: { database: "down" } },
    };
  }
  return {
    statusCode: 200,
    body: { status: "ready", checks: { database } },
  };
}

import { Logger } from "@nestjs/common";
import { redactSecrets } from "../common/logging/redact";

export type ConnectedClient = {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $queryRawUnsafe: (query: string) => Promise<unknown>;
};

export async function openPrismaClient(connectionString: string): Promise<ConnectedClient> {
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import("../generated/prisma/client.js"),
    import("@prisma/adapter-pg"),
  ]);
  // Runtime traffic uses the pooled DATABASE_URL. DIRECT_URL is only for Prisma CLI.
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export type DatabaseStatus = "not_configured" | "up" | "down";

export class DatabaseService {
  private state: DatabaseStatus = "not_configured";
  private client: ConnectedClient | null = null;

  constructor(
    private readonly settings: { url: string | null },
    private readonly openClient: (url: string) => Promise<ConnectedClient> = openPrismaClient,
  ) {}

  get status(): DatabaseStatus {
    return this.state;
  }

  async onModuleInit(): Promise<void> {
    if (!this.settings.url) {
      this.state = "not_configured";
      return;
    }

    try {
      this.client = await this.openClient(this.settings.url);
      await this.client.$connect();
      await this.client.$queryRawUnsafe("SELECT 1");
      this.state = "up";
    } catch (error) {
      this.state = "down";
      Logger.error(redactSecrets(error instanceof Error ? error.message : "Database connection failed."), "Database");
      await this.safeDisconnect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.safeDisconnect();
  }

  private async safeDisconnect(): Promise<void> {
    const current = this.client;
    this.client = null;
    if (!current) {
      return;
    }
    try {
      await current.$disconnect();
    } catch (error) {
      Logger.error(redactSecrets(error instanceof Error ? error.message : "Disconnect failed."), "Database");
    }
  }
}

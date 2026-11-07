import { Global, Injectable, Module, OnModuleDestroy } from "@nestjs/common";

type Disconnectable = {
  $disconnect: () => Promise<void>;
};

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private client: Disconnectable | null = null;

  constructor() {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      return;
    }
    void this.open(connectionString);
  }

  private async open(connectionString: string): Promise<void> {
    const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
      import("../generated/prisma/client.js"),
      import("@prisma/adapter-pg"),
    ]);
    const adapter = new PrismaPg({ connectionString });
    this.client = new PrismaClient({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

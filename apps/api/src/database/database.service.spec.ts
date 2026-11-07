import { DatabaseService, type ConnectedClient } from "./database.service";

function fakeClient(overrides: Partial<ConnectedClient> = {}): ConnectedClient {
  return {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    ...overrides,
  };
}

describe("DatabaseService", () => {
  it("stays unconfigured when no database URL is set", async () => {
    const openClient = jest.fn();
    const service = new DatabaseService({ url: null }, openClient);
    await service.onModuleInit();
    expect(service.status).toBe("not_configured");
    expect(openClient).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });

  it("connects and disconnects when a URL is configured", async () => {
    const client = fakeClient();
    const service = new DatabaseService({ url: "postgresql://localhost/test" }, async () => client);
    await service.onModuleInit();
    expect(service.status).toBe("up");
    expect(client.$queryRawUnsafe).toHaveBeenCalledWith("SELECT 1");
    await service.onModuleDestroy();
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("records a configured connection failure without throwing", async () => {
    const client = fakeClient({
      $connect: jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
    });
    const service = new DatabaseService({ url: "postgresql://localhost/missing" }, async () => client);
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(service.status).toBe("down");
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });
});

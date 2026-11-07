import { Inject, Injectable, Optional } from "@nestjs/common";
import { DatabaseService, type ConnectedClient } from "../../database/database.service";
import { AuthFlowError } from "./auth.errors";
import {
  findActiveNonce,
  findActiveSession,
  persistLogin,
  persistNonce,
  revokeSessionHash,
  type AuthPrisma,
  type StoredSession,
  type StoredUser,
} from "./auth.persistence";

function isAuthPrisma(value: ConnectedClient): value is ConnectedClient & AuthPrisma {
  return "authNonce" in value && "authSession" in value && "user" in value && "$transaction" in value;
}

@Injectable()
export class PrismaAuthRepository {
  private bound: AuthPrisma | null = null;

  constructor(@Optional() @Inject(DatabaseService) private readonly database?: DatabaseService) {}

  static fromClient(client: AuthPrisma): PrismaAuthRepository {
    const repository = new PrismaAuthRepository(undefined);
    repository.bound = client;
    return repository;
  }

  async issueNonce(input: { userWallet: string; nonce: string; expiresAt: Date; now: Date }) {
    return persistNonce(this.requireClient(), input);
  }

  async findActiveNonce(userWallet: string, now: Date) {
    return findActiveNonce(this.requireClient(), userWallet, now);
  }

  async consumeLogin(input: {
    userWallet: string;
    nonce: string;
    now: Date;
    role: "user" | "admin";
    refreshTokenHash: string;
    sessionExpiresAt: Date;
  }): Promise<{ user: StoredUser; session: StoredSession } | null> {
    return persistLogin(this.requireClient(), input);
  }

  async findSession(hash: string, now: Date) {
    return findActiveSession(this.requireClient(), hash, now);
  }

  async revokeSession(hash: string, now: Date) {
    return revokeSessionHash(this.requireClient(), hash, now);
  }

  private requireClient(): AuthPrisma {
    if (this.bound) {
      return this.bound;
    }
    const client = this.database?.activeClient;
    if (!client || !isAuthPrisma(client)) {
      throw new AuthFlowError(503, "NOT_READY", "Authentication storage is not ready.");
    }
    return client;
  }
}

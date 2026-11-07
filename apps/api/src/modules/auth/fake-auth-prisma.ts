import { randomUUID } from "node:crypto";
import type { AuthPrisma, StoredNonce, StoredSession, StoredUser } from "./auth.persistence";

type MutableNonce = StoredNonce;
type MutableUser = StoredUser;
type MutableSession = StoredSession;

function matchesNulls(value: Date | null, expected: null): boolean {
  return expected === null && value === null;
}

export class FakeAuthPrisma implements AuthPrisma {
  readonly nonces: MutableNonce[] = [];
  readonly users: MutableUser[] = [];
  readonly sessions: MutableSession[] = [];

  async $transaction<T>(fn: (tx: AuthPrisma) => Promise<T>): Promise<T> {
    return fn(this);
  }

  readonly authNonce = {
    updateMany: async (args: {
      where: { userWallet?: string; id?: string; usedAt: null; retiredAt: null };
      data: { retiredAt?: Date; usedAt?: Date };
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const row of this.nonces) {
        if (!matchesNulls(row.usedAt, args.where.usedAt) || !matchesNulls(row.retiredAt, args.where.retiredAt)) {
          continue;
        }
        if (args.where.id !== undefined && row.id !== args.where.id) {
          continue;
        }
        if (args.where.userWallet !== undefined && row.userWallet !== args.where.userWallet) {
          continue;
        }
        if (args.data.retiredAt) {
          row.retiredAt = args.data.retiredAt;
        }
        if (args.data.usedAt) {
          row.usedAt = args.data.usedAt;
        }
        count += 1;
      }
      return { count };
    },
    create: async (args: { data: { userWallet: string; nonce: string; expiresAt: Date } }): Promise<StoredNonce> => {
      const row: StoredNonce = {
        id: randomUUID(),
        userWallet: args.data.userWallet,
        nonce: args.data.nonce,
        expiresAt: args.data.expiresAt,
        usedAt: null,
        retiredAt: null,
        createdAt: new Date(),
      };
      this.nonces.push(row);
      return row;
    },
    findFirst: async (args: {
      where: {
        userWallet: string;
        nonce?: string;
        usedAt: null;
        retiredAt: null;
        expiresAt?: { gt: Date };
      };
    }): Promise<StoredNonce | null> => {
      const matches = this.nonces.filter((row) => {
        if (row.userWallet !== args.where.userWallet || row.usedAt !== null || row.retiredAt !== null) {
          return false;
        }
        if (args.where.nonce !== undefined && row.nonce !== args.where.nonce) {
          return false;
        }
        if (args.where.expiresAt && row.expiresAt.getTime() <= args.where.expiresAt.gt.getTime()) {
          return false;
        }
        return true;
      });
      return matches[0] ?? null;
    },
  };

  readonly user = {
    findUnique: async (args: { where: { walletAddress: string } }): Promise<StoredUser | null> => {
      return this.users.find((row) => row.walletAddress === args.where.walletAddress) ?? null;
    },
    create: async (args: { data: { walletAddress: string; role: "user" | "admin" } }): Promise<StoredUser> => {
      const row: StoredUser = { id: randomUUID(), walletAddress: args.data.walletAddress, role: args.data.role };
      this.users.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: { role: "user" | "admin" } }): Promise<StoredUser> => {
      const row = this.users.find((item) => item.id === args.where.id);
      if (!row) {
        throw new Error("User not found.");
      }
      row.role = args.data.role;
      return row;
    },
  };

  readonly authSession = {
    updateMany: async (args: {
      where: { userId?: string; refreshTokenHash?: string; revokedAt: null };
      data: { revokedAt: Date };
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const row of this.sessions) {
        if (row.revokedAt !== null) {
          continue;
        }
        if (args.where.userId !== undefined && row.userId !== args.where.userId) {
          continue;
        }
        if (args.where.refreshTokenHash !== undefined && row.refreshTokenHash !== args.where.refreshTokenHash) {
          continue;
        }
        row.revokedAt = args.data.revokedAt;
        count += 1;
      }
      return { count };
    },
    create: async (args: {
      data: { userId: string; refreshTokenHash: string; expiresAt: Date };
    }): Promise<StoredSession> => {
      const row: StoredSession = {
        id: randomUUID(),
        userId: args.data.userId,
        refreshTokenHash: args.data.refreshTokenHash,
        expiresAt: args.data.expiresAt,
        revokedAt: null,
      };
      this.sessions.push(row);
      return row;
    },
    findFirst: async (args: {
      where: { refreshTokenHash: string; revokedAt: null; expiresAt: { gt: Date } };
      include: { user: true };
    }): Promise<(StoredSession & { user: StoredUser }) | null> => {
      const row = this.sessions.find(
        (item) =>
          item.refreshTokenHash === args.where.refreshTokenHash &&
          item.revokedAt === null &&
          item.expiresAt.getTime() > args.where.expiresAt.gt.getTime(),
      );
      if (!row) {
        return null;
      }
      const owner = this.users.find((item) => item.id === row.userId);
      if (!owner) {
        return null;
      }
      return { ...row, user: owner };
    },
  };
}

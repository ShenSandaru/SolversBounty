export type StoredNonce = {
  id: string;
  userWallet: string;
  nonce: string;
  expiresAt: Date;
  usedAt: Date | null;
  retiredAt: Date | null;
  createdAt: Date;
};

export type StoredUser = {
  id: string;
  walletAddress: string;
  role: "user" | "admin";
};

export type StoredSession = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type AuthPrisma = {
  $transaction<T>(fn: (tx: AuthPrisma) => Promise<T>): Promise<T>;
  authNonce: {
    updateMany(args: {
      where: { userWallet?: string; id?: string; usedAt: null; retiredAt: null };
      data: { retiredAt?: Date; usedAt?: Date };
    }): Promise<{ count: number }>;
    create(args: { data: { userWallet: string; nonce: string; expiresAt: Date } }): Promise<StoredNonce>;
    findFirst(args: {
      where: {
        userWallet: string;
        nonce?: string;
        usedAt: null;
        retiredAt: null;
        expiresAt?: { gt: Date };
      };
      orderBy?: { createdAt: "desc" };
    }): Promise<StoredNonce | null>;
  };
  user: {
    findUnique(args: { where: { walletAddress: string } }): Promise<StoredUser | null>;
    create(args: { data: { walletAddress: string; role: "user" | "admin" } }): Promise<StoredUser>;
    update(args: { where: { id: string }; data: { role: "user" | "admin" } }): Promise<StoredUser>;
  };
  authSession: {
    updateMany(args: {
      where: { userId?: string; refreshTokenHash?: string; revokedAt: null };
      data: { revokedAt: Date };
    }): Promise<{ count: number }>;
    create(args: {
      data: { userId: string; refreshTokenHash: string; expiresAt: Date };
    }): Promise<StoredSession>;
    findFirst(args: {
      where: { refreshTokenHash: string; revokedAt: null; expiresAt: { gt: Date } };
      include: { user: true };
    }): Promise<(StoredSession & { user: StoredUser }) | null>;
  };
};

export async function persistNonce(
  db: AuthPrisma,
  input: { userWallet: string; nonce: string; expiresAt: Date; now: Date },
): Promise<StoredNonce> {
  return db.$transaction(async (tx) => {
    await tx.authNonce.updateMany({
      where: { userWallet: input.userWallet, usedAt: null, retiredAt: null },
      data: { retiredAt: input.now },
    });
    return tx.authNonce.create({
      data: {
        userWallet: input.userWallet,
        nonce: input.nonce,
        expiresAt: input.expiresAt,
      },
    });
  });
}

export async function persistLogin(
  db: AuthPrisma,
  input: {
    userWallet: string;
    nonce: string;
    now: Date;
    role: "user" | "admin";
    refreshTokenHash: string;
    sessionExpiresAt: Date;
  },
): Promise<{ user: StoredUser; session: StoredSession } | null> {
  return db.$transaction(async (tx) => {
    const row = await tx.authNonce.findFirst({
      where: {
        userWallet: input.userWallet,
        nonce: input.nonce,
        usedAt: null,
        retiredAt: null,
      },
    });
    if (!row || row.expiresAt.getTime() <= input.now.getTime()) {
      return null;
    }
    const consumed = await tx.authNonce.updateMany({
      where: { id: row.id, usedAt: null, retiredAt: null },
      data: { usedAt: input.now },
    });
    if (consumed.count !== 1) {
      return null;
    }
    const existing = await tx.user.findUnique({ where: { walletAddress: input.userWallet } });
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { role: input.role } })
      : await tx.user.create({ data: { walletAddress: input.userWallet, role: input.role } });
    await tx.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: input.now },
    });
    const session = await tx.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.sessionExpiresAt,
      },
    });
    return { user, session };
  });
}

export async function findActiveSession(
  db: AuthPrisma,
  hash: string,
  now: Date,
): Promise<{ user: StoredUser; session: StoredSession } | null> {
  const row = await db.authSession.findFirst({
    where: { refreshTokenHash: hash, revokedAt: null, expiresAt: { gt: now } },
    include: { user: true },
  });
  if (!row) {
    return null;
  }
  return { user: row.user, session: row };
}

export async function revokeSessionHash(db: AuthPrisma, hash: string, now: Date): Promise<boolean> {
  const result = await db.authSession.updateMany({
    where: { refreshTokenHash: hash, revokedAt: null },
    data: { revokedAt: now },
  });
  return result.count === 1;
}

export async function findActiveNonce(db: AuthPrisma, userWallet: string, now: Date): Promise<StoredNonce | null> {
  return db.authNonce.findFirst({
    where: { userWallet, usedAt: null, retiredAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
}

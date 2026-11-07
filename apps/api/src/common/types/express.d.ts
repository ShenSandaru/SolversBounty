declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      authUser?: {
        id: string;
        walletAddress: string;
        role: "user" | "admin";
      };
    }
  }
}

export {};

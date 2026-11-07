import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PayoutWorker } from "./payout-worker";

@Injectable()
export class PayoutLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly worker: PayoutWorker) {}

  onModuleInit(): void {
    this.worker.start();
  }

  onModuleDestroy(): void {
    this.worker.stop();
  }
}

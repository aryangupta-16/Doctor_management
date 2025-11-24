import { Queue } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue("email-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3, // retry failed emails
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export enum EmailPriority {
  HIGH = 1,     // verification, password reset
  MEDIUM = 2,   // receipts, confirmations
  LOW = 3       // newsletters, promotions
}

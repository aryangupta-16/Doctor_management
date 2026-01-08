import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../../config";

const connection = new Redis(config.redisUrl!);

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

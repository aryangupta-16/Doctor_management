import { Queue } from "bullmq";
import { config } from "../../config";

export const emailQueue = new Queue("email-queue", {
  connection: {
    host: config.redisUrl!.includes('://') 
      ? new URL(config.redisUrl!).hostname 
      : config.redisUrl!.split(':')[0],
    port: config.redisUrl!.includes('://') 
      ? parseInt(new URL(config.redisUrl!).port || '6379')
      : parseInt(config.redisUrl!.split(':')[1] || '6379'),
  },
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

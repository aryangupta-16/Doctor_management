import { Worker } from "bullmq";
import { logger } from "../../config/logger";
import { emailService } from "../../lib/mailer";
import { config } from "../../config";

const worker = new Worker(
  "email-queue",
  async job => {
    logger.info({ jobName: job.name }, "Processing email job");

    const { email, subject, html, text, token } = job.data;

    switch (job.name) {
      case "verification":
        await emailService.sendEmail(
          email,
          "Verify your email",
          html,
          text
        );
        break;

      case "reset-password":
        await emailService.sendEmail(
          email,
          "Reset your password",
          html,
          text
        );
        break;

      case "generic":
        await emailService.sendEmail(email, subject, html, text);
        break;
    }
  },
  {
    connection: {
      host: config.redisUrl!.includes('://') 
        ? new URL(config.redisUrl!).hostname 
        : config.redisUrl!.split(':')[0],
      port: config.redisUrl!.includes('://') 
        ? parseInt(new URL(config.redisUrl!).port || '6379')
        : parseInt(config.redisUrl!.split(':')[1] || '6379'),
    }
  }
);

worker.on("completed", job => {
  logger.info({ id: job.id },"Email job completed");
});

worker.on("failed", (job, err) => {
    if(job)
  logger.error({ id: job.id, err },"Email job failed");
});

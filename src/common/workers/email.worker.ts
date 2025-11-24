import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "../../config/logger";
import { emailService } from "../../lib/mailer";

const connection = new Redis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

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
  { connection }
);

worker.on("completed", job => {
  logger.info({ id: job.id },"Email job completed");
});

worker.on("failed", (job, err) => {
    if(job)
  logger.error({ id: job.id, err },"Email job failed");
});

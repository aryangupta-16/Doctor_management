import { emailQueue, EmailPriority } from "../queue/email.queue";
import { logger } from "../../config/logger";

class EmailProducerService {
  async queueVerificationEmail(email: string, token: string, html: string, text?: string) {
    await emailQueue.add(
      "verification",
      { email, token, html, text },
      { priority: EmailPriority.HIGH }
    );

    logger.info({email}, "Queued verification email");
  }

  async queueResetPasswordEmail(email: string, token: string, html: string, text?: string) {
    await emailQueue.add(
      "reset-password",
      { email, token, html, text },
      { priority: EmailPriority.HIGH }
    );

    logger.info({ email }, "Queued reset password email");
  }

  async queueGenericEmail(email: string, subject: string, html: string, text?: string) {
    await emailQueue.add(
      "generic",
      { email, subject, html, text },
      { priority: EmailPriority.MEDIUM }
    );

    logger.info({ email },"Queued generic email");
  }
}

export const emailProducer = new EmailProducerService();

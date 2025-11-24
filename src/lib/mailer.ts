import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../config/logger';
class EmailService {
  private transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  async sendEmail(to: string, subject: string, html: string, text?: string) {
    try {
      const result = await this.transporter.sendMail({
        from: config.smtp.from,
        to,
        subject,
        html,
        text,
      });

      logger.info({ result }, "email.sent");
      return result;
    } catch (err) {
      logger.error({ err }, "email.send_failed");
      throw err;
    }
  }
}

export const emailService = new EmailService();
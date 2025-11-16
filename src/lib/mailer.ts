import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../config/logger';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465, // true for 465, false for other ports
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const msg = {
    from: config.smtp.from,
    to,
    subject,
    html,
    text,
  };

  try {
    const res = await transporter.sendMail(msg);
    logger.info({ res }, 'email.sent');
    return res;
  } catch (err) {
    logger.error({ err }, 'email.send_failed');
    throw err;
  }
}

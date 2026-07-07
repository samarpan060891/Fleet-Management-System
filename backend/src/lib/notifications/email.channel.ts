import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../logger';
import { NotificationChannel, NotificationMessage } from './channel';

// EmailChannel — SMTP configured via env. In dry-run mode (or without SMTP
// host) emails are logged instead of sent, so the app is demoable out of box.
export class EmailChannel implements NotificationChannel {
  readonly name = 'email';
  private transporter: Transporter | null = null;

  get enabled(): boolean {
    return true; // email is the shipped channel
  }

  private getTransporter(): Transporter | null {
    if (env.smtp.dryRun || !env.smtp.host) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
      });
    }
    return this.transporter;
  }

  async send(msg: NotificationMessage): Promise<void> {
    if (!msg.to.length) return;
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info(
        { to: msg.to, subject: msg.subject, category: msg.category },
        '[EmailChannel dry-run] would send email'
      );
      return;
    }
    await transporter.sendMail({
      from: env.smtp.from,
      to: msg.to.join(','),
      subject: msg.subject,
      text: msg.body,
      html: `<pre style="font-family:inherit">${msg.body}</pre>`,
    });
  }
}

import { logger } from '../logger';
import { NotificationChannel, NotificationMessage } from './channel';
import { env } from '../../config/env';

// WhatsAppChannel — intentionally a stub, shipped disabled behind
// FEATURE_WHATSAPP. Implements the same interface so it can be enabled later
// without touching callers.
export class WhatsAppChannel implements NotificationChannel {
  readonly name = 'whatsapp';

  get enabled(): boolean {
    return env.features.whatsapp;
  }

  async send(msg: NotificationMessage): Promise<void> {
    if (!this.enabled) return;
    logger.warn(
      { to: msg.to, subject: msg.subject },
      'WhatsAppChannel is a stub — no message sent'
    );
    // TODO: integrate WhatsApp Business API here when the feature is enabled.
  }
}

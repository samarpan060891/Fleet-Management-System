import { NotificationChannel, NotificationMessage } from './channel';
import { EmailChannel } from './email.channel';
import { WhatsAppChannel } from './whatsapp.channel';
import { logger } from '../logger';

// Registry of channels. Only enabled channels are dispatched to.
const channels: NotificationChannel[] = [new EmailChannel(), new WhatsAppChannel()];

export async function notify(msg: NotificationMessage): Promise<void> {
  for (const ch of channels) {
    if (!ch.enabled) continue;
    try {
      await ch.send(msg);
    } catch (err) {
      logger.error({ err, channel: ch.name }, 'Notification channel failed');
    }
  }
}

export { NotificationMessage };

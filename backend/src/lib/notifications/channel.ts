// Pluggable notification layer. New channels implement NotificationChannel.
export interface NotificationMessage {
  to: string[];
  subject: string;
  body: string; // plain text / simple HTML
  category?: string;
}

export interface NotificationChannel {
  readonly name: string;
  readonly enabled: boolean;
  send(msg: NotificationMessage): Promise<void>;
}

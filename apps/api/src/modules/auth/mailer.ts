import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export type DeliveryStatus = 'SENT' | 'LOGGED' | 'SKIPPED' | 'FAILED';

export interface DeliveryResult {
  status: DeliveryStatus;
  provider: string;
  error?: string;
}

/** A way of delivering email. Add providers by implementing this interface. */
export interface MailTransport {
  readonly name: string;
  /** True only when the recipient will actually receive the email. */
  readonly delivers: boolean;
  send(message: MailMessage & { from: string }): Promise<DeliveryResult>;
}

/** Development: writes the email to the API log. Never reported as delivered. */
class LogTransport implements MailTransport {
  readonly name = 'log';
  readonly delivers = false;
  private readonly logger = new Logger('Mailer');
  async send(m: MailMessage): Promise<DeliveryResult> {
    // Unsubscribe tokens are credentials for a learner's preferences: never written to logs.
    const text = m.text.replace(/(unsubscribe\?token=)[^\s]+/gi, '$1[redacted]');
    this.logger.log(`[dev mail] to=${m.to} subject="${m.subject}"\n${text}`);
    return { status: 'LOGGED', provider: this.name };
  }
}

class NoTransport implements MailTransport {
  readonly name = 'none';
  readonly delivers = false;
  async send(): Promise<DeliveryResult> {
    return { status: 'SKIPPED', provider: this.name };
  }
}

/** Resend (https://resend.com) over plain HTTPS — no SDK dependency. */
export class ResendTransport implements MailTransport {
  readonly name = 'resend';
  readonly delivers = true;
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}
  async send(m: MailMessage & { from: string }): Promise<DeliveryResult> {
    try {
      const res = await this.fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: m.from, to: [m.to], subject: m.subject, text: m.text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { status: 'FAILED', provider: this.name, error: `HTTP ${res.status}` };
      return { status: 'SENT', provider: this.name };
    } catch (err) {
      return { status: 'FAILED', provider: this.name, error: (err as Error).message.slice(0, 200) };
    }
  }
}

/**
 * Account and learning email delivery, independent of the provider. The
 * transport is chosen by MAIL_TRANSPORT; `deliversEmail` is reported to
 * learners so the UI never claims an email was sent when it was only logged.
 */
@Injectable()
export class Mailer {
  private readonly logger = new Logger('Mailer');
  readonly transport: MailTransport;
  private readonly from: string;

  constructor(config: AppConfig) {
    const kind = config.get('MAIL_TRANSPORT') ?? (config.isProduction ? 'none' : 'log');
    this.from = config.get('MAIL_FROM') ?? 'StudyThinker <no-reply@localhost>';
    const key = config.get('RESEND_API_KEY');
    if (kind === 'resend' && key && config.get('MAIL_FROM')) {
      this.transport = new ResendTransport(key);
    } else if (kind === 'resend') {
      this.logger.warn(
        'MAIL_TRANSPORT=resend needs RESEND_API_KEY and MAIL_FROM; emails will only be logged.',
      );
      this.transport = new LogTransport();
    } else {
      this.transport = kind === 'log' ? new LogTransport() : new NoTransport();
    }
    if (this.transport.name === 'log' && config.isProduction) {
      this.logger.warn('Email is only written to logs in production. Configure a provider.');
    }
  }

  get deliversEmail(): boolean {
    return this.transport.delivers;
  }

  send(message: MailMessage): Promise<DeliveryResult> {
    return this.transport.send({ ...message, from: this.from });
  }
}

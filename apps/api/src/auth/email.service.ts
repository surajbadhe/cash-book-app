import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailClient } from '@azure/communication-email';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly connectionString: string;
  private readonly senderAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.connectionString =
      this.configService.get<string>('email.connectionString') ||
      this.configService.get<string>('ACS_EMAIL_CONNECTION_STRING') ||
      '';
    this.senderAddress =
      this.configService.get<string>('email.senderAddress') ||
      this.configService.get<string>('ACS_EMAIL_SENDER_ADDRESS') ||
      '';
  }

  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
    if (!this.connectionString || !this.senderAddress) {
      this.logger.warn(
        'ACS email config missing. Skipping email send and falling back to logs.',
      );
      this.logger.log(`Password reset URL for ${toEmail}: ${resetUrl}`);
      return;
    }

    const client = new EmailClient(this.connectionString);

    const appName = 'CashFlow';
    const subject = `Reset your ${appName} password`;
    const html = `
      <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:20px 24px;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;">
              <div style="font-size:20px;font-weight:700;letter-spacing:0.2px;">${appName}</div>
              <div style="font-size:13px;opacity:0.9;margin-top:4px;">Password reset request</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <h2 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#111827;">Reset your password</h2>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151;">We received a request to reset your ${appName} account password.</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">Use the button below to create a new password. This link is valid for <strong>15 minutes</strong>.</p>
              <p style="margin:0 0 20px;">
                <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">Reset Password</a>
              </p>
              <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6b7280;">If the button doesn’t work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 18px;word-break:break-all;font-size:12px;line-height:1.6;color:#4f46e5;">${resetUrl}</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">If you did not request this, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    const text = `Reset your ${appName} password\n\nUse this link to reset your password (valid for 15 minutes):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;

    const poller = await client.beginSend({
      senderAddress: this.senderAddress,
      recipients: {
        to: [{ address: toEmail }],
      },
      content: {
        subject,
        plainText: text,
        html,
      },
    });

    const result = await poller.pollUntilDone();

    if ((result as any)?.status === 'Succeeded') {
      this.logger.log(`Password reset email sent to ${toEmail}`);
      return;
    }

    this.logger.error(
      `Password reset email failed for ${toEmail}: ${JSON.stringify(result)}`,
    );
  }

  async sendBusinessInviteEmail(
    toEmail: string,
    businessName: string,
    inviterEmail: string,
    acceptUrl: string,
    roleLabel: string,
  ): Promise<void> {
    if (!this.connectionString || !this.senderAddress) {
      this.logger.warn('ACS email config missing. Skipping invite email and falling back to logs.');
      this.logger.log(`Business invite URL for ${toEmail}: ${acceptUrl}`);
      return;
    }

    const client = new EmailClient(this.connectionString);
    const appName = 'CashFlow';
    const subject = `You are invited to join ${businessName} on ${appName}`;
    const html = `
      <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:20px 24px;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;">
              <div style="font-size:20px;font-weight:700;letter-spacing:0.2px;">${appName}</div>
              <div style="font-size:13px;opacity:0.9;margin-top:4px;">Shop invite</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <h2 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#111827;">You're invited</h2>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151;">${inviterEmail} invited you to join <strong>${businessName}</strong> as <strong>${roleLabel}</strong>.</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">Accept this invite to start adding and managing entries for this shop. This link is valid for <strong>7 days</strong>.</p>
              <p style="margin:0 0 20px;">
                <a href="${acceptUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">Accept Invite</a>
              </p>
              <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6b7280;">If the button doesn’t work, copy and paste this link into your browser:</p>
              <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.6;color:#4f46e5;">${acceptUrl}</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    const text = `You are invited to join ${businessName} on ${appName}\n\n${inviterEmail} invited you as ${roleLabel}.\nAccept invitation (valid for 7 days):\n${acceptUrl}`;

    const poller = await client.beginSend({
      senderAddress: this.senderAddress,
      recipients: {
        to: [{ address: toEmail }],
      },
      content: {
        subject,
        plainText: text,
        html,
      },
    });

    const result = await poller.pollUntilDone();
    if ((result as any)?.status === 'Succeeded') {
      this.logger.log(`Business invite email sent to ${toEmail}`);
      return;
    }

    this.logger.error(`Business invite email failed for ${toEmail}: ${JSON.stringify(result)}`);
  }
}

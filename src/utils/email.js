const { Resend } = require('resend');
const config = require('../config');

let resendClient = null;
if (config.RESEND_API_KEY && !config.RESEND_API_KEY.startsWith('re_your')) {
  try {
    resendClient = new Resend(config.RESEND_API_KEY);
  } catch (err) {
    console.error('Failed to init Resend:', err);
  }
}

async function sendWelcomeEmail(subscriber, baseUrl) {
  if (!resendClient) return;

  const unsubUrl = `${baseUrl}/unsubscribe/${subscriber.unsubscribe_token}`;
  const greeting = subscriber.name ? ` ${subscriber.name}` : '';

  try {
    await resendClient.emails.send({
      from: `${config.SITE_AUTHOR} <${config.RESEND_FROM_EMAIL}>`,
      to: subscriber.email,
      subject: `Welcome to ${config.SITE_NAME} ✦`,
      html: `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">
          <h2 style="font-size:28px;margin-bottom:8px;">You're in.</h2>
          <p style="font-size:16px;line-height:1.7;color:#444;">
            Hi${greeting},<br><br>
            Thanks for subscribing to ${config.SITE_NAME}. I write about thinking, writing,
            and building a life on your own terms.<br><br>
            Expect essays in your inbox — no spam, no noise.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
          <p style="font-size:12px;color:#999;">
            <a href="${unsubUrl}" style="color:#999;">Unsubscribe</a>
          </p>
        </div>
      `
    });
  } catch (err) {
    console.error('Welcome email error:', err);
  }
}

async function sendTestEmail(subject, bodyHtml, recipient) {
  if (!resendClient) return false;

  const previewFooter = `
    <br><br><hr style="border:none;border-top:1px solid #333;margin:32px 0">
    <p style="font-size:12px;color:#888;text-align:center;">
      [TEST PREVIEW] — Sent from ${config.SITE_NAME} Dashboard
    </p>
  `;

  try {
    await resendClient.emails.send({
      from: `${config.SITE_AUTHOR} <${config.RESEND_FROM_EMAIL}>`,
      to: recipient,
      subject: `[TEST] ${subject}`,
      html: bodyHtml + previewFooter
    });
    return true;
  } catch (err) {
    console.error('Test email send failed:', err);
    return false;
  }
}

async function sendCampaign(subject, bodyHtml, subscribers, baseUrl) {
  if (!resendClient) return { sent: 0, failed: subscribers.length };

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    const unsubUrl = `${baseUrl}/unsubscribe/${sub.unsubscribe_token}`;
    const personalizedHtml = bodyHtml + `
      <br><br><hr style="border:none;border-top:1px solid #333;margin:32px 0">
      <p style="font-size:12px;color:#888;text-align:center;">
        You're receiving this because you subscribed at ${config.SITE_NAME}.
        <a href="${unsubUrl}" style="color:#888;">Unsubscribe</a>
      </p>
    `;

    try {
      await resendClient.emails.send({
        from: `${config.SITE_AUTHOR} <${config.RESEND_FROM_EMAIL}>`,
        to: sub.email,
        subject,
        html: personalizedHtml
      });
      sent++;
    } catch (err) {
      console.error(`Resend campaign error for ${sub.email}:`, err);
      failed++;
    }
  }

  return { sent, failed };
}

module.exports = {
  sendWelcomeEmail,
  sendTestEmail,
  sendCampaign
};

import nodemailer from 'nodemailer';
import config from '../config/index.js';
import logger from './logger.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { smtp } = config.email;
  if (!smtp.user || !smtp.password) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user.trim(),
      pass: smtp.password.trim().replace(/\s+/g, ''),
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
}

export function isEmailConfigured() {
  return Boolean(config.email?.smtp?.user && config.email?.smtp?.password);
}

export async function verifyEmailTransport() {
  const tx = getTransporter();
  if (!tx) {
    logger.warn('Email not configured: SMTP_USER and SMTP_PASSWORD required.');
    return false;
  }
  try {
    await tx.verify();
    logger.info(`✅ Email transport verified successfully (${config.email.smtp.user})`);
    return true;
  } catch (err) {
    logger.error(`❌ Email transport verification failed: ${err.message}`);
    return false;
  }
}

/**
 * Base email layout branded as JNET Testing System
 */
function baseTemplate({ title, subtitle, bodyHtml, ctaLabel, ctaUrl, previewText }) {
  const brandName = 'JNET Testing System';
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${previewText ? `<div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ''}
</head>
<body style="margin:0;padding:0;background-color:#0b1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#0b1120;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#161f36;border:1px solid #233152;border-radius:18px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.45);">
          
          <!-- Header Bar with Cyan Gradient -->
          <tr>
            <td style="padding:32px 32px 20px;text-align:center;border-bottom:1px solid #233152;background:linear-gradient(180deg,#1c2847 0%,#161f36 100%);">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;padding:8px 18px;border-radius:12px;background:rgba(6,182,212,0.12);border:1px solid rgba(6,182,212,0.35);">
                      <span style="font-size:18px;font-weight:800;letter-spacing:1px;color:#22d3ee;text-transform:uppercase;">${brandName}</span>
                    </div>
                    <div style="font-size:12px;color:#94a3b8;margin-top:8px;font-weight:500;letter-spacing:0.5px;">Intelligent QA Automation Platform</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Section -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f8fafc;line-height:1.3;">${title}</h1>
              ${subtitle ? `<p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.5;">${subtitle}</p>` : ''}
              
              <div style="color:#cbd5e1;font-size:15px;line-height:1.65;">
                ${bodyHtml}
              </div>

              <!-- CTA Button -->
              ${ctaLabel && ctaUrl ? `
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top:28px;margin-bottom:12px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:12px;box-shadow:0 4px 16px rgba(6,182,212,0.35);letter-spacing:0.3px;">
                      ${ctaLabel} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <div style="text-align:center;margin-top:10px;">
                <span style="font-size:11px;color:#64748b;">Or paste this URL in your browser:</span><br/>
                <a href="${ctaUrl}" style="font-size:11px;color:#38bdf8;word-break:break-all;">${ctaUrl}</a>
              </div>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 36px;border-top:1px solid #233152;background-color:#12192c;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#64748b;line-height:1.5;">
                This automated message was sent by <strong>${brandName}</strong>. If you did not request this, please secure your account.
              </p>
              <p style="margin:0;font-size:11px;color:#475569;">
                &copy; ${currentYear} ${brandName} &bull; Intelligent Automation Testing System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Safe email sending helper (never throws to caller, logs errors gracefully)
 */
async function sendMail({ to, subject, html, text }) {
  if (!config.email?.enabled && !isEmailConfigured()) {
    logger.info(`[Email skipped - not configured] To: ${to} | Subject: ${subject}`);
    return { skipped: true };
  }

  const tx = getTransporter();
  if (!tx) {
    logger.warn(`[Email skipped - no transporter] To: ${to} | Subject: ${subject}`);
    return { skipped: true };
  }

  try {
    const info = await tx.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });

    logger.info(`✅ [Email Delivered] Sent to ${to} | Subject: "${subject}" | ID: ${info.messageId || 'ok'}`);
    return info;
  } catch (err) {
    logger.error(`❌ [Email Error] Could not send to ${to}: ${err.message}`);
    return { error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// EMAIL A — Welcome / Account Created
// ─────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(user) {
  const displayName = user.name || 'QA Engineer';
  const frontendUrl = config.email.frontendUrl;

  const html = baseTemplate({
    title: `Welcome to JNET Testing System, ${displayName}!`,
    subtitle: 'Your intelligent test automation workspace is ready.',
    bodyHtml: `
      <p>Thank you for creating your account on <strong>JNET Testing System</strong>.</p>
      <p>You now have full access to:</p>
      <ul style="padding-left:20px;margin:12px 0;color:#94a3b8;">
        <li>AI-powered SRS to Test Case generation with high precision</li>
        <li>Requirements ambiguity detection & edge-case discovery</li>
        <li>Automation script codegen for Cypress, Playwright & Selenium</li>
        <li>Realtime test run execution, analytics & traceability matrix</li>
      </ul>
      <p style="margin-top:16px;">If you did not register for this account, please ignore this email or contact support immediately.</p>
    `,
    ctaLabel: 'Open JNET Testing System',
    ctaUrl: frontendUrl,
    previewText: `Welcome to JNET Testing System! Start generating test cases with AI.`,
  });

  return sendMail({
    to: user.email,
    subject: 'Welcome to JNET Testing System',
    html,
  });
}

// ─────────────────────────────────────────────────────────────
// EMAIL B — Sign-in Notification
// ─────────────────────────────────────────────────────────────
export async function sendSignInNotificationEmail(user, details = {}) {
  const displayName = user.name || 'User';
  const method = details.method || (user.authProvider === 'google' ? 'Google Sign-In' : 'Email & Password');
  const timestamp = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
  const frontendUrl = config.email.frontendUrl;

  const html = baseTemplate({
    title: 'New Sign-in to JNET Testing System',
    subtitle: 'Security notification for your workspace account',
    bodyHtml: `
      <p>Hello ${displayName},</p>
      <p>A new sign-in to your <strong>JNET Testing System</strong> account was detected:</p>
      <div style="background-color:#1c2847;padding:14px 18px;border-radius:10px;margin:16px 0;border:1px solid #233152;">
        <div style="font-size:13px;color:#94a3b8;margin-bottom:4px;"><strong>Account:</strong> ${user.email}</div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:4px;"><strong>Time:</strong> ${timestamp}</div>
        <div style="font-size:13px;color:#94a3b8;"><strong>Method:</strong> ${method}</div>
      </div>
      <p style="color:#f87171;font-size:13px;">If you did not perform this login, please reset your password immediately to protect your test artifacts.</p>
    `,
    ctaLabel: 'Review Account Security',
    ctaUrl: frontendUrl,
    previewText: `New sign-in to your JNET Testing System account at ${timestamp}`,
  });

  return sendMail({
    to: user.email,
    subject: 'New sign-in to JNET Testing System',
    html,
  });
}

// ─────────────────────────────────────────────────────────────
// EMAIL C — Email Verification
// ─────────────────────────────────────────────────────────────
export async function sendVerificationEmail(user, rawToken) {
  const displayName = user.name || 'QA Engineer';
  const verifyUrl = `${config.email.frontendUrl}/?verify=${rawToken}`;

  const html = baseTemplate({
    title: 'Verify your email address',
    subtitle: 'Complete your registration on JNET Testing System',
    bodyHtml: `
      <p>Hello ${displayName},</p>
      <p>Please confirm your email address to complete your registration on <strong>JNET Testing System</strong>.</p>
      <p style="font-size:13px;color:#94a3b8;">This single-use verification link will expire in <strong>24 hours</strong>.</p>
      <p style="font-size:12px;color:#64748b;margin-top:16px;">If you did not create an account on JNET Testing System, you can safely disregard this message.</p>
    `,
    ctaLabel: 'Verify Email Address',
    ctaUrl: verifyUrl,
    previewText: 'Verify your email address for JNET Testing System',
  });

  return sendMail({
    to: user.email,
    subject: 'Verify your email — JNET Testing System',
    html,
  });
}

// ─────────────────────────────────────────────────────────────
// EMAIL D — Forgot Password / Reset Link
// ─────────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(user, rawToken) {
  const displayName = user.name || 'User';
  const resetUrl = `${config.email.frontendUrl}/?reset=${rawToken}`;

  const html = baseTemplate({
    title: 'Reset your JNET Testing System password',
    subtitle: 'Secure single-use password reset link',
    bodyHtml: `
      <p>Hello ${displayName},</p>
      <p>We received a request to reset the password for your account (<strong>${user.email}</strong>).</p>
      <p style="font-size:13px;color:#94a3b8;">This secure reset link is valid for <strong>1 hour</strong> and can only be used once.</p>
      <p style="color:#cbd5e1;margin-top:16px;">Click the button below to choose a new password:</p>
    `,
    ctaLabel: 'Reset Password',
    ctaUrl: resetUrl,
    previewText: 'Reset your password for JNET Testing System',
  });

  return sendMail({
    to: user.email,
    subject: 'Reset your JNET Testing System password',
    html,
    text: `Reset your JNET Testing System password: ${resetUrl}`,
  });
}

// ─────────────────────────────────────────────────────────────
// EMAIL E — Password Changed Confirmation
// ─────────────────────────────────────────────────────────────
export async function sendPasswordChangedEmail(user) {
  const displayName = user.name || 'User';
  const timestamp = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
  const frontendUrl = config.email.frontendUrl;

  const html = baseTemplate({
    title: 'Your password was changed',
    subtitle: 'Security update for your account',
    bodyHtml: `
      <p>Hello ${displayName},</p>
      <p>The password for your <strong>JNET Testing System</strong> account (<strong>${user.email}</strong>) was successfully changed on <strong>${timestamp}</strong>.</p>
      <p style="color:#f87171;font-size:13px;margin-top:16px;">If you did not make this change, please contact your administrator or initiate an immediate password reset.</p>
    `,
    ctaLabel: 'Go to JNET Testing System',
    ctaUrl: frontendUrl,
    previewText: `Your JNET Testing System password was changed at ${timestamp}`,
  });

  return sendMail({
    to: user.email,
    subject: 'Your JNET Testing System password was changed',
    html,
  });
}

// ─────────────────────────────────────────────────────────────
// EMAIL F — Sign-out Confirmation (Optional)
// ─────────────────────────────────────────────────────────────
export async function sendSignOutEmail(user) {
  const displayName = user.name || 'User';
  const timestamp = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

  const html = baseTemplate({
    title: 'Signed out of JNET Testing System',
    bodyHtml: `
      <p>Hello ${displayName},</p>
      <p>You were successfully signed out of <strong>JNET Testing System</strong> on ${timestamp}.</p>
      <p>Your session has been terminated safely.</p>
    `,
    ctaLabel: 'Sign In Again',
    ctaUrl: config.email.frontendUrl,
  });

  return sendMail({
    to: user.email,
    subject: 'Signed out — JNET Testing System',
    html,
  });
}

export default {
  verifyEmailTransport,
  sendWelcomeEmail,
  sendSignInNotificationEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendSignOutEmail,
};

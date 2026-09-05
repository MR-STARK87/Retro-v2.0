import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  // Resend SMTP (https://resend.com/docs/send-with-nodemailer-smtp)
  host: "smtp.resend.com",
  port: 465,
  secure: true,
  auth: {
    user: "resend",
    pass: process.env.RESEND_API_KEY,
  },
});

// Test mode uses Resend's shared onboarding@resend.dev sender, which only
// delivers to the Resend account owner's inbox — enough to prove live
// mailing end-to-end. After verifying a custom domain in Resend, set
// RESEND_FROM_EMAIL to it (e.g. noreply@yourdomain.com) and all users
// start receiving. No code change needed for that switch.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

if (!process.env.RESEND_API_KEY) {
  console.warn(
    "⚠️  WARNING: RESEND_API_KEY is not set — outbound email will fail. " +
      "Add it to your .env (see .env.example). Registration still works; " +
      "only email delivery is affected.",
  );
}

// Custom HTML Email Templates — Retro calm identity: warm paper background,
// soft card, Space Grotesk-style headings, mono eyebrow accents, one black
// pill button. Table layout + inline styles only (email-client safe, no
// webfonts — system stacks everywhere).
const EMAIL_TEMPLATES = {
  verification: (firstName, url) => `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email – Retro</title>
  </head>
  <body style="margin:0; padding:0; background:#f7f7f5; font-family:-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; -webkit-text-size-adjust:100%;">
  <span style="display:none; max-height:0; overflow:hidden; opacity:0;">Verify your Retro account — this link expires in 10 minutes.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5; padding:48px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border:1px solid #e8e6e1; border-radius:20px; overflow:hidden;">
          <tr>
            <td style="padding:44px 40px 0 40px;">
              <p style="margin:0; font-family:ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace; font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#8a8781;">
                Retro · Email verification
              </p>
              <h1 style="margin:14px 0 0 0; font-size:26px; font-weight:700; letter-spacing:-0.02em; line-height:1.2; color:#1a1a1a;">
                Verify your email
              </h1>
              <p style="margin:14px 0 0 0; font-size:15px; line-height:1.6; color:#1a1a1a;">
                Welcome, <strong>${firstName}</strong>.
              </p>
              <p style="margin:10px 0 0 0; font-size:14px; line-height:1.7; color:#55534e;">
                You're one tap away from getting started. Confirm this address so we know it's really you — this link expires in 10 minutes.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:30px 40px 0 40px;">
              <a href="${url}" style="display:inline-block; padding:14px 36px; background:#1a1a1a; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; letter-spacing:-0.01em; border-radius:999px;">
                Verify email address
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5; border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px 0; font-size:12px; font-weight:600; color:#55534e;">Button not working? Paste this link</p>
                    <p style="margin:0; font-family:ui-monospace, Menlo, Consolas, monospace; font-size:11px; line-height:1.7; color:#8a8781; word-break:break-all;">${url}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 40px 0 40px;">
              <p style="margin:0; font-size:12px; line-height:1.7; color:#8a8781;">
                Didn't create a Retro account? Just ignore this email — nothing will happen.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 40px 36px 40px; border-top:1px solid #f0efeb;">
              <p style="margin:14px 0 0 0; font-size:12px; color:#8a8781;">Need a hand? Just reply to this email.</p>
              <p style="margin:14px 0 0 0; font-size:12px; font-weight:600; color:#1a1a1a;">The Retro Project</p>
              <p style="margin:6px 0 0 0; font-size:11px; color:#b0ada6;">© ${new Date().getFullYear()} Retro</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  </body>
  </html>`,

  resetPassword: (firstName, url) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset your password – Retro</title>
    </head>
    <body style="margin:0; padding:0; background:#f7f7f5; font-family:-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; -webkit-text-size-adjust:100%;">
    <span style="display:none; max-height:0; overflow:hidden; opacity:0;">Reset your Retro password — this link expires in 10 minutes.</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5; padding:48px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border:1px solid #e8e6e1; border-radius:20px; overflow:hidden;">
            <tr>
              <td style="padding:44px 40px 0 40px;">
                <p style="margin:0; font-family:ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace; font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#8a8781;">
                  Retro · Password reset
                </p>
                <h1 style="margin:14px 0 0 0; font-size:26px; font-weight:700; letter-spacing:-0.02em; line-height:1.2; color:#1a1a1a;">
                  Reset your password
                </h1>
                <p style="margin:14px 0 0 0; font-size:15px; line-height:1.6; color:#1a1a1a;">
                  Hello, <strong>${firstName}</strong>.
                </p>
                <p style="margin:10px 0 0 0; font-size:14px; line-height:1.7; color:#55534e;">
                  We got a request to reset your password. Choose a new one below — if that wasn't you, just ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:30px 40px 0 40px;">
                <a href="${url}" style="display:inline-block; padding:14px 36px; background:#1a1a1a; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; letter-spacing:-0.01em; border-radius:999px;">
                  Set a new password
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 40px 0 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px;">
                  <tr>
                    <td style="padding:14px 18px;">
                      <p style="margin:0; font-size:13px; font-weight:600; color:#92400e;">Time sensitive</p>
                      <p style="margin:4px 0 0 0; font-size:13px; line-height:1.6; color:#92400e;">This link expires in 10 minutes.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 40px 0 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5; border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0 0 8px 0; font-size:12px; font-weight:600; color:#55534e;">Button not working? Paste this link</p>
                      <p style="margin:0; font-family:ui-monospace, Menlo, Consolas, monospace; font-size:11px; line-height:1.7; color:#8a8781; word-break:break-all;">${url}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 40px 0 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px;">
                  <tr>
                    <td style="padding:14px 18px;">
                      <p style="margin:0; font-size:13px; font-weight:600; color:#991b1b;">Didn't ask for this?</p>
                      <p style="margin:4px 0 0 0; font-size:13px; line-height:1.6; color:#991b1b;">Your account is safe — but never share this link with anyone.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 40px 36px 40px; border-top:1px solid #f0efeb;">
                <p style="margin:14px 0 0 0; font-size:12px; color:#8a8781;">Need a hand? Just reply to this email.</p>
                <p style="margin:14px 0 0 0; font-size:12px; font-weight:600; color:#1a1a1a;">The Retro Project</p>
                <p style="margin:6px 0 0 0; font-size:11px; color:#b0ada6;">© ${new Date().getFullYear()} Retro</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    </body>
    </html>
  `,
};

// Plain text versions for email clients that don't support HTML
const TEXT_TEMPLATES = {
  verification: (firstName, url) => `
Verify your email — Retro

Welcome, ${firstName}.

You're one tap away from getting started. Confirm this address so we know it's really you:

${url}

This link expires in 10 minutes.

Didn't create a Retro account? Just ignore this email — nothing will happen.

Need a hand? Just reply to this email.

The Retro Project
© ${new Date().getFullYear()} Retro
  `,

  resetPassword: (firstName, url) => `
Reset your password — Retro

Hello, ${firstName}.

We got a request to reset your password. Choose a new one here:

${url}

TIME SENSITIVE: this link expires in 10 minutes.

Didn't ask for this? Your account is safe — but never share this link with anyone.

Need a hand? Just reply to this email.

The Retro Project
© ${new Date().getFullYear()} Retro
  `,
};

const sendEmail = async ({ to, subject, url, template, firstName }) => {
  try {
    if (!EMAIL_TEMPLATES[template] || !TEXT_TEMPLATES[template]) {
      throw new Error(`Invalid email template: ${template}`);
    }

    const emailHTML = EMAIL_TEMPLATES[template](firstName, url);
    const emailText = TEXT_TEMPLATES[template](firstName, url);

    const info = await transporter.sendMail({
      from: `"The Retro Project" <${FROM_EMAIL}>`,
      to,
      subject,
      text: emailText,
      html: emailHTML,
    });

    console.log(`✓ Email sent successfully to ${to}`);
    return info;
  } catch (error) {
    console.error("✗ Error sending email:", error);
    throw error;
  }
};

export { sendEmail, EMAIL_TEMPLATES, TEXT_TEMPLATES };

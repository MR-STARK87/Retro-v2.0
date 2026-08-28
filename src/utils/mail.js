import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_SMTP_HOST,
  port: Number(process.env.MAILTRAP_SMTP_PORT) || 587,
  auth: {
    user: process.env.MAILTRAP_SMTP_USER,
    pass: process.env.MAILTRAP_SMTP_PASS,
  },
});

// Custom HTML Email Templates with black/white minimal design and monospace font
const EMAIL_TEMPLATES = {
  verification: (firstName, url) => `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Email – Retro</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
  </style>
  </head>
  <body style="margin:0; padding:0; background:#ffffff; font-family:'JetBrains Mono', 'Courier New', monospace;">
    <!-- Wrapper -->
    <table role="presentation" width="100%" style="padding:60px 20px; background:#ffffff;">
      <tr>
        <td align="center">
          <!-- Card -->
          <table role="presentation" width="100%" style="max-width:520px; background:#ffffff; border:1px solid #000000;">
            <!-- Brand Header -->
            <tr>
              <td style="padding:48px 40px 8px 40px; text-align:left;">
                <h1 style="margin:0; font-size:18px; font-weight:600; color:#000000; letter-spacing:3px; text-transform:uppercase;">
                  RETRO
                </h1>
              </td>
            </tr>
            <!-- Headline -->
            <tr>
              <td style="padding:32px 40px 0 40px; text-align:left;">
                <h2 style="margin:0; font-size:24px; font-weight:500; color:#000; letter-spacing:-0.3px; line-height:1.3;">
                  Verify your email
                </h2>
              </td>
            </tr>
            <!-- Subtext -->
            <tr>
              <td style="padding:20px 40px 0 40px; text-align:left;">
                <p style="margin:0; font-size:13px; color:#000; line-height:1.8; letter-spacing:0px; font-weight:400;">
                  Welcome, <strong style="font-weight:600;">${firstName}</strong>.
                </p>
              </td>
            </tr>
            <!-- Body Text -->
            <tr>
              <td style="padding:16px 40px 0 40px; text-align:left;">
                <p style="margin:0; font-size:12px; color:#000; line-height:1.8; letter-spacing:0px; font-weight:400; opacity:0.8;">
                  To get started and ensure the security of your account, we need to verify your email address.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 40px 32px 40px; text-align:left;">
                <p style="margin:0; font-size:12px; color:#000; line-height:1.8; letter-spacing:0px; font-weight:400; opacity:0.8;">
                  Click the button below to verify your email address and activate your account. This link will expire in 24 hours:
                </p>
              </td>
            </tr>
            <!-- Button -->
            <tr>
              <td style="padding:0 40px 40px 40px;" align="left">
                <a href="${url}"
                   style="display:inline-block; padding:14px 28px; background:#000; color:#fff;
                          font-size:12px; font-weight:500; text-decoration:none; letter-spacing:0.5px;
                          border:1px solid #000;">
                  Verify email address
                </a>
              </td>
            </tr>
            <!-- Divider -->
            <tr>
              <td style="padding:0 40px;">
                <div style="width:100%; height:1px; background:#000;"></div>
              </td>
            </tr>
            <!-- Alternative Link -->
            <tr>
              <td style="padding:32px 40px 24px 40px; text-align:left;">
                <p style="margin:0 0 12px 0; font-size:11px; color:#000; letter-spacing:0.3px; font-weight:500;">
                  Or copy this link
                </p>
                <p style="margin:0; font-size:10px; color:#000; word-break:break-all; line-height:1.7; font-weight:400; opacity:0.6;">
                  ${url}
                </p>
              </td>
            </tr>
            <!-- Security Note -->
            <tr>
              <td style="padding:24px 40px 0 40px; text-align:left;">
                <p style="margin:0; font-size:11px; color:#000; line-height:1.7; font-weight:400; opacity:0.6;">
                  If you didn't create an account with us, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 0 40px; text-align:left;">
                <p style="margin:0; font-size:11px; color:#000; line-height:1.7; font-weight:400; opacity:0.6;">
                  This verification link will expire in 24 hours for security reasons.
                </p>
              </td>
            </tr>
            <!-- Help Text -->
            <tr>
              <td style="padding:16px 40px 0 40px; text-align:left;">
                <p style="margin:0; font-size:11px; color:#000; line-height:1.7; font-weight:400; opacity:0.6;">
                  Need help? Just reply to this email and we'll be happy to assist you.
                </p>
              </td>
            </tr>
            <!-- Signature -->
            <tr>
              <td style="padding:24px 40px 0 40px; text-align:left;">
                <p style="margin:0; font-size:12px; color:#000; line-height:1.7; font-weight:500; letter-spacing:0.3px;">
                  Welcome aboard,
                </p>
                <p style="margin:4px 0 0 0; font-size:12px; color:#000; line-height:1.7; font-weight:600; letter-spacing:0.5px;">
                  The Retro Project
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:32px 40px 48px 40px; text-align:left;">
                <p style="margin:0; font-size:10px; color:#000; letter-spacing:0.3px; font-weight:400; opacity:0.4;">
                  © ${new Date().getFullYear()} Retro
                </p>
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
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Courier New', 'Consolas', monospace; background-color: #f3f4f6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <!-- Main Card Container -->
            <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 24px; overflow: hidden;">

              <!-- Email Body -->
              <tr>
                <td style="padding: 40px 40px 30px 40px;">
                  <!-- Greeting -->
                  <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 500; color: #4b5563; letter-spacing: -0.5px;">
                    Password Reset
                  </h2>
                  <p style="margin: 0 0 24px 0; font-size: 14px; font-weight: 400; color: #6b7280;">
                    Reset your password securely.
                  </p>

                  <!-- Personalized Greeting -->
                  <div style="margin: 0 0 24px 0; padding: 20px; background-color: #f9fafb; border-radius: 16px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; font-weight: 400;">
                      Hello,
                    </p>
                    <p style="margin: 0; font-size: 20px; font-weight: 300; color: #000000; letter-spacing: -0.3px;">
                      ${firstName}
                    </p>
                  </div>

                  <!-- Intro Text -->
                  <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 400; color: #6b7280; line-height: 1.6;">
                    We received a request to reset your password.
                  </p>
                  <p style="margin: 0 0 32px 0; font-size: 14px; font-weight: 400; color: #6b7280; line-height: 1.6;">
                    Click the button below to create a new password. If you didn't make this request, you can ignore this email.
                  </p>

                  <!-- Action Button -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td align="center" style="padding: 0 0 32px 0;">
                        <a href="${url}" style="display: inline-block; width: 100%; max-width: 100%; padding: 14px 24px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 9999px; font-weight: 500; font-size: 14px; text-align: center; border: 2px solid #000000; box-sizing: border-box;">
                          Reset password
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Info Box -->
                  <div style="margin: 0 0 16px 0; padding: 16px 20px; background-color: #f9fafb; border-radius: 12px; border-left: 3px solid #000000;">
                    <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 500; color: #000000;">
                      Time Sensitive
                    </p>
                    <p style="margin: 0; font-size: 13px; font-weight: 400; color: #6b7280; line-height: 1.5;">
                      This password reset link expires in 1 hour.
                    </p>
                  </div>

                  <!-- Alternative Link -->
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                    If the button doesn't work, copy this link:
                  </p>
                  <p style="margin: 0 0 24px 0; padding: 12px; background-color: #f9fafb; border-radius: 8px; font-size: 11px; color: #000000; word-break: break-all; font-family: 'Courier New', 'Consolas', monospace;">
                    ${url}
                  </p>
                </td>
              </tr>

              <!-- Security Warning -->
              <tr>
                <td style="padding: 0 40px 24px 40px;">
                  <div style="padding: 16px 20px; background-color: #fee2e2; border-radius: 12px; border-left: 3px solid #dc2626;">
                    <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 500; color: #7f1d1d;">
                      Security Alert
                    </p>
                    <p style="margin: 0; font-size: 12px; font-weight: 400; color: #991b1b; line-height: 1.5;">
                      If you didn't request this, contact support immediately.
                    </p>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding: 0 40px 40px 40px;">
                  <div style="padding: 16px 20px; background-color: #fef3c7; border-radius: 12px; border-left: 3px solid #d97706;">
                    <p style="margin: 0; font-size: 12px; font-weight: 400; color: #78350f; line-height: 1.5;">
                      Warning: Never share this link with anyone.
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 500; color: #000000;">
                    The Retro Project
                  </p>
                  <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">
                    Need help? Reply to this email.
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                    © ${new Date().getFullYear()} The Retro Project. All rights reserved.
                  </p>
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
Email Verification
Verify your account to get started.

Hello, ${firstName}

Welcome! We're excited to have you on board.

To ensure the security of your account, please verify your email address by clicking the link below.

VERIFY YOUR EMAIL:
${url}

IMPORTANT:
This verification link expires in 24 hours.

SECURITY NOTE:
If you didn't create this account, ignore this email.

Need help? Reply to this email.

---
© ${new Date().getFullYear()} The Retro Project. All rights reserved.
  `,

  resetPassword: (firstName, url) => `
Password Reset
Reset your password securely.

Hello, ${firstName}

We received a request to reset your password.

Click the link below to create a new password. If you didn't make this request, you can ignore this email.

RESET YOUR PASSWORD:
${url}

TIME SENSITIVE:
This password reset link expires in 1 hour.

SECURITY ALERT:
If you didn't request this, contact support immediately.

WARNING:
Never share this link with anyone.

Need help? Reply to this email.

---
© ${new Date().getFullYear()} The Retro Project. All rights reserved.
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
      from: '"The Retro Project" <noreply@retroproject.com>',
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

export { sendEmail };

import nodemailer from "nodemailer";

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function emailFrom() {
  return process.env.EMAIL_FROM ?? "Foxly <no-reply@foxly.local>";
}

async function sendWithResend(input: SendEmailInput) {
  if (!process.env.RESEND_API_KEY) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.warn(`Resend email failed: ${response.status} ${details}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("❌ Resend API call failed:", err);
    return false;
  }
}

async function sendWithSmtp(input: SendEmailInput) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return false;

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transport.sendMail({
      from: emailFrom(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return true;
  } catch (err) {
    console.error("❌ SMTP connection or sending failed:", err);
    return false;
  }
}

export async function sendDeviceLinkCodeEmail(to: string, code: string) {
  const subject = "Your Foxly one-time code";
  const text = `Your Foxly one-time code is ${code}. It expires in 5 minutes. If you did not request this, ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h1 style="font-size: 20px;">Your Foxly one-time code</h1>
      <p>Use this code to add your new sign-in device:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
      <p>This code expires in 5 minutes.</p>
      <p>If you did not request this, ignore this email.</p>
    </div>
  `;
  const input = { to, subject, text, html };

  if (await sendWithResend(input)) return;
  if (await sendWithSmtp(input)) return;

  console.warn("⚠️ Email delivery is not configured. Falling back to console logging.");
  console.log("\n==================================================");
  console.log(`🔑 ONE-TIME CODE FOR: ${to}`);
  console.log(`👉 CODE: ${code}`);
  console.log("==================================================\n");
}

export async function sendEmailChangedNotificationEmail(to: string) {
  const subject = "Your Foxly email address has been changed";
  const text = `The email address associated with your Foxly account has been changed. If you did not make this change, please contact support immediately.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h1 style="font-size: 20px;">Email Address Changed</h1>
      <p>The email address associated with your Foxly account has been changed.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    </div>
  `;
  const input = { to, subject, text, html };

  if (await sendWithResend(input)) return;
  if (await sendWithSmtp(input)) return;

  console.warn("⚠️ Email delivery is not configured. Falling back to console logging.");
  console.log("\n==================================================");
  console.log(`📧 EMAIL CHANGED NOTIFICATION FOR: ${to}`);
  console.log("==================================================\n");
}

export async function sendBackupCodeUsedEmail(to: string, deviceName: string | null) {
  const subject = "A backup code was used to sign in to Foxly";
  
  let text = "";
  let html = "";
  
  if (deviceName) {
    text = `A backup code was used by "${deviceName}" to sign into your Foxly account. If not you, please contact support.`;
    html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h1 style="font-size: 20px;">Backup Code Used</h1>
        <p>A backup code was used by "${deviceName}" to sign into your Foxly account. If not you, please contact support.</p>
      </div>
    `;
  } else {
    text = `A backup code was just used to sign in to your Foxly account.\n\nThis backup code was used by an unrecognized device. If this was not you, please use your passkey to log in and remove the compromised device from your account settings.`;
    html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h1 style="font-size: 20px;">Backup Code Used</h1>
        <p>A backup code was just used to sign in to your Foxly account.</p>
        <p>This backup code was used by an unrecognized device. If this was not you, please use your passkey to log in and remove the compromised device from your account settings.</p>
      </div>
    `;
  }

  const input = { to, subject, text, html };

  if (await sendWithResend(input)) return;
  if (await sendWithSmtp(input)) return;

  console.warn("⚠️ Email delivery is not configured. Falling back to console logging.");
  console.log("\n==================================================");
  console.log(`🛡️ BACKUP CODE USED NOTIFICATION FOR: ${to}`);
  console.log(`Device Known: ${!!deviceName} ${deviceName ? `(${deviceName})` : ""}`);
  console.log("==================================================\n");
}

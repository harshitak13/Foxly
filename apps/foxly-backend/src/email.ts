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
    throw new Error(`Resend email failed: ${response.status} ${details}`);
  }

  return true;
}

async function sendWithSmtp(input: SendEmailInput) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return false;

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

  throw new Error("Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM, or SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM.");
}

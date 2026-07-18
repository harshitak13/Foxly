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

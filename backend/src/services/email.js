import nodemailer from 'nodemailer'
import { appendFileSync } from 'fs'

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// E2E tests need the real reset/approval links without depending on a real
// SMTP account or reading actual email - when EMAIL_TEST_CAPTURE_FILE is set
// (only done in playwright.config.js), append each message as JSON instead
// of sending it, so tests can read the file back for the link.
const captureFile = process.env.EMAIL_TEST_CAPTURE_FILE
const transporter = captureFile
  ? { sendMail: async (msg) => appendFileSync(captureFile, JSON.stringify(msg) + '\n') }
  : nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

export async function sendApprovalEmail(to, name) {
  await transporter.sendMail({
    from: `"Haushalt App" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Dein Account wurde freigeschaltet',
    html: `
      <p>Hallo ${esc(name)},</p>
      <p>Dein Account wurde freigeschaltet. Du kannst dich jetzt anmelden und dein Passwort ändern.</p>
      <p><a href="${esc(process.env.FRONTEND_URL)}/login">Zur App</a></p>
    `,
  })
}

export async function sendPasswordResetEmail(to, name, resetLink) {
  await transporter.sendMail({
    from: `"Haushalt App" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Passwort zurücksetzen',
    html: `
      <p>Hallo ${esc(name)},</p>
      <p>Du hast eine Passwort-Zurücksetzung angefordert. Klicke auf den folgenden Link (gültig für 1 Stunde):</p>
      <p><a href="${esc(resetLink)}">Passwort zurücksetzen</a></p>
      <p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
    `,
  })
}

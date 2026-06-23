import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
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
      <p>Hallo ${name},</p>
      <p>Dein Account wurde freigeschaltet. Du kannst dich jetzt anmelden und dein Passwort ändern.</p>
      <p><a href="${process.env.FRONTEND_URL}/login">Zur App</a></p>
    `,
  })
}

export async function sendPasswordResetEmail(to, name, resetLink) {
  await transporter.sendMail({
    from: `"Haushalt App" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Passwort zurücksetzen',
    html: `
      <p>Hallo ${name},</p>
      <p>Du hast eine Passwort-Zurücksetzung angefordert. Klicke auf den folgenden Link (gültig für 1 Stunde):</p>
      <p><a href="${resetLink}">Passwort zurücksetzen</a></p>
      <p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
    `,
  })
}

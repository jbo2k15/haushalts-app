import prisma from './prisma.js'

// Haushaltsweite Einstellungen (Singleton-Zeile, siehe schema.prisma
// "AppSettings"). Fehlt die Zeile, gelten die sicheren Standardwerte.

// Selbst-Registrierung: standardmäßig AUS. Solange der Haushalt vollständig
// ist, gibt es so keinen öffentlich erreichbaren Weg, Konten anzulegen. Ein
// Admin schaltet sie in den Einstellungen (Nutzerverwaltung) vorübergehend ein.
export async function isRegistrationEnabled() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
  return settings?.registrationEnabled === true
}

export async function setRegistrationEnabled(enabled) {
  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: { registrationEnabled: enabled },
    create: { id: 'singleton', registrationEnabled: enabled },
  })
  return { registrationEnabled: enabled }
}

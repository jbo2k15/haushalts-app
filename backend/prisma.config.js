import { defineConfig } from 'prisma/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import 'dotenv/config'

const dbUrl = process.env.DATABASE_URL ?? 'file:./data/haushalt.db'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: dbUrl,
  },
  migrate: {
    adapter: () => new PrismaBetterSqlite3({ url: dbUrl.replace('file:', '') }),
  },
})

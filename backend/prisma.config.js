import { defineConfig } from 'prisma/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import 'dotenv/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrate: {
    adapter: (url) => new PrismaBetterSqlite3({ url: url.replace('file:', '') }),
  },
})

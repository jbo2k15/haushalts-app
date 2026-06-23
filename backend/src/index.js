import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import taskRoutes from './routes/tasks.js'
import userRoutes from './routes/users.js'
import { startScheduler } from './services/scheduler.js'

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/users', userRoutes)

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY })
})

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

startScheduler()

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`))

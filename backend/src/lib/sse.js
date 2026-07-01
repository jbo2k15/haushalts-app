const clients = new Set()

export function addSSEClient(res) {
  clients.add(res)
}

export function removeSSEClient(res) {
  clients.delete(res)
}

export function broadcastTasksUpdated() {
  const data = 'event: tasks-updated\ndata: {}\n\n'
  for (const res of [...clients]) {
    try {
      res.write(data)
    } catch {
      clients.delete(res)
    }
  }
}

import { createContext, useContext, useEffect, useState } from 'react'

export const ZOOM_LEVELS = [85, 100, 110, 120, 130]
export const DEFAULT_ZOOM = 100

const ZoomContext = createContext(null)

export function ZoomProvider({ children }) {
  const [zoom, setZoomState] = useState(() => {
    const stored = Number(localStorage.getItem('zoom'))
    return ZOOM_LEVELS.includes(stored) ? stored : DEFAULT_ZOOM
  })

  // index.html has an inline script applying the stored value before first
  // paint (same FOUC-avoidance pattern as the theme's dark class) - this
  // effect just keeps it in sync on later changes.
  useEffect(() => {
    document.documentElement.style.fontSize = `${zoom}%`
  }, [zoom])

  function setZoom(level) {
    if (!ZOOM_LEVELS.includes(level)) return
    localStorage.setItem('zoom', String(level))
    setZoomState(level)
  }

  function increaseZoom() {
    const idx = ZOOM_LEVELS.indexOf(zoom)
    if (idx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[idx + 1])
  }

  function decreaseZoom() {
    const idx = ZOOM_LEVELS.indexOf(zoom)
    if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1])
  }

  function resetZoom() {
    setZoom(DEFAULT_ZOOM)
  }

  return (
    <ZoomContext.Provider value={{ zoom, setZoom, increaseZoom, decreaseZoom, resetZoom }}>
      {children}
    </ZoomContext.Provider>
  )
}

export function useZoom() {
  return useContext(ZoomContext)
}

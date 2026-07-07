import { createContext, useContext, useState } from 'react'

// Lets any globally-rendered overlay (currently just ReleaseNotesModal)
// report that it's open, so PageCarousel can disable swipe navigation
// while it's up - two competing gesture surfaces at once is asking for bugs.
const ModalGateContext = createContext({ modalOpen: false, setModalOpen: () => {} })

export function ModalGateProvider({ children }) {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <ModalGateContext.Provider value={{ modalOpen, setModalOpen }}>
      {children}
    </ModalGateContext.Provider>
  )
}

export function useModalGate() {
  return useContext(ModalGateContext)
}

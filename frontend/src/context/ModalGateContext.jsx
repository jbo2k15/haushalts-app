import { createContext, useContext, useState } from 'react'

// Lets any globally-rendered overlay (currently just ReleaseNotesModal)
// report that it's open, so PageCarousel can disable swipe navigation
// while it's up - two competing gesture surfaces at once is asking for bugs.
//
// releaseNotesOpen is separate from modalOpen: AppRoutes uses it to mark
// <Routes>/<VersionFooter> inert while the release notes modal sits on top
// of them, trapping focus/pointer interaction inside the modal. modalOpen
// can't be reused for that - it's also true while ExitConfirmModal is open,
// which lives *inside* that same Routes subtree (via PageCarousel), so
// making Routes inert on modalOpen would make ExitConfirmModal itself
// unreachable too.
const ModalGateContext = createContext({ modalOpen: false, setModalOpen: () => {}, releaseNotesOpen: false, setReleaseNotesOpen: () => {} })

export function ModalGateProvider({ children }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false)
  return (
    <ModalGateContext.Provider value={{ modalOpen, setModalOpen, releaseNotesOpen, setReleaseNotesOpen }}>
      {children}
    </ModalGateContext.Provider>
  )
}

export function useModalGate() {
  return useContext(ModalGateContext)
}

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import useEmblaCarousel from 'embla-carousel-react'
import Home from '../pages/Home.jsx'
import HallOfFame from '../pages/HallOfFame.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useModalGate } from '../context/ModalGateContext.jsx'
import { useZoom } from '../context/ZoomContext.jsx'
import { api } from '../api/client.js'
import ExitConfirmModal, { HIDE_EXIT_CONFIRM_KEY } from './ExitConfirmModal.jsx'

// Ordered list of swipeable pages. Both are mounted at once (not just the
// active one) so Hall of Fame's stats are already loaded by the time a user
// swipes to it, and so its slide can peek in at the edge while dragging.
// A future "let users reorder their pages" feature is just a different
// ordering of this same array.
const PAGES = [
  { path: '/', Component: Home },
  { path: '/hall-of-fame', Component: HallOfFame },
]

export default function PageCarousel() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const { modalOpen, setModalOpen } = useModalGate()
  const { zoom } = useZoom()

  // Read via refs inside the Embla event handler below instead of through
  // effect dependencies - re-subscribing the 'select' listener on every
  // navigation raced against the scrollTo() call that same navigation
  // triggers (the freshly re-attached listener could miss the resulting
  // event). Registering once and always reading the latest value avoids
  // the race entirely.
  const locationRef = useRef(location)
  locationRef.current = location
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const modalOpenRef = useRef(modalOpen)
  modalOpenRef.current = modalOpen

  // watchDrag takes a live-evaluated predicate rather than a static boolean
  // so toggling it doesn't require emblaApi.reInit() - reInit tears down
  // and rebuilds the whole engine, which drops any 'select' listeners
  // attached via emblaApi.on() in the process.
  // Without an explicit startIndex, Embla always initializes at slide 0
  // (Home) and only scrolls to the actual page afterwards, via the
  // location-sync effect below - on a page load that starts at /hall-of-fame
  // (direct link, bookmark, or reload) that produces a visible flash of Home
  // before it animates over to Hall of Fame. Frozen in a ref (read once, on
  // first render only) rather than recomputed from location on every
  // render - a changing startIndex value after mount makes embla-carousel-
  // react reInit() the engine on navigation, which (see comment above)
  // silently drops the 'select' listener registered below.
  const initialIndexRef = useRef(Math.max(0, PAGES.findIndex(p => p.path === location.pathname)))
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    startIndex: initialIndexRef.current,
    watchDrag: () => !modalOpenRef.current,
  })
  const [showTip, setShowTip] = useState(false)
  const syncingFromUrl = useRef(false)

  // A URL change that didn't originate from a swipe (e.g. the "Zurück"
  // button inside Hall of Fame, or the "🏆 Ruhmeshalle" menu entry on Home)
  // should still move the carousel to match.
  useEffect(() => {
    if (!emblaApi) return
    const index = PAGES.findIndex(p => p.path === location.pathname)
    if (index === -1 || emblaApi.selectedScrollSnap() === index) return
    syncingFromUrl.current = true
    emblaApi.scrollTo(index)
  }, [location.pathname, emblaApi])

  // A completed swipe updates the URL - replace, not push, so swiping back
  // and forth doesn't flood the browser history with entries. Registered
  // once per emblaApi instance (see refs above for why). Kept in a ref too
  // (see the zoom effect below) so it can be re-attached after a reInit(),
  // which drops every listener added via .on().
  const onSelectRef = useRef(null)
  useEffect(() => {
    if (!emblaApi) return
    function onSelect() {
      // selectedScrollSnap() should always be within [0, PAGES.length), but
      // loop:true clones slides internally to fill the loop - normalize
      // defensively so an unexpected raw index can't silently skip the URL
      // update below and leave the address bar out of sync with what's
      // actually visible (that mismatch is what a Reload/Pull-to-Refresh
      // would then reload).
      const rawIndex = emblaApi.selectedScrollSnap()
      const index = ((rawIndex % PAGES.length) + PAGES.length) % PAGES.length
      if (syncingFromUrl.current) { syncingFromUrl.current = false; return }
      const target = PAGES[index]
      if (target.path !== locationRef.current.pathname) navigateRef.current(target.path, { replace: true })
    }
    onSelectRef.current = onSelect
    emblaApi.on('select', onSelect)
    return () => emblaApi.off('select', onSelect)
  }, [emblaApi])

  // Changing the zoom level (see Settings.jsx) resizes the root font, which
  // changes every slide's actual pixel width - Embla measures those once at
  // init and doesn't re-measure on its own, so swiping would misbehave
  // without an explicit reInit(). Skip the very first render (zoom hasn't
  // "changed" yet, just been read from storage) and re-attach the 'select'
  // listener afterwards, since reInit() tears down and drops it.
  const zoomMountedRef = useRef(false)
  useEffect(() => {
    if (!zoomMountedRef.current) { zoomMountedRef.current = true; return }
    if (!emblaApi) return
    emblaApi.reInit()
    if (onSelectRef.current) emblaApi.on('select', onSelectRef.current)
  }, [zoom, emblaApi])

  useEffect(() => {
    if (user && !user.hasSeenSwipeTip) setShowTip(true)
  }, [user])

  async function dismissTip() {
    setShowTip(false)
    setUser(u => (u ? { ...u, hasSeenSwipeTip: true } : u))
    try { await api.put('/users/me/swipe-tip-seen') } catch {}
  }

  // Pressing back from Home/Hall of Fame (the app's root screens) would
  // otherwise exit the PWA immediately. Push one extra history entry so the
  // first back-press pops it (a popstate we intercept) instead of actually
  // leaving; showing the modal re-pushes the guard so a repeated back-press
  // asks again. allowExitRef lets the confirm button's own history.back()
  // call pass through without re-triggering this same handler.
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const allowExitRef = useRef(false)

  useEffect(() => {
    if (localStorage.getItem(HIDE_EXIT_CONFIRM_KEY) === 'true') return
    window.history.pushState({ exitGuard: true }, '')
    function handlePopState() {
      if (allowExitRef.current) return
      setShowExitConfirm(true)
      window.history.pushState({ exitGuard: true }, '')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => { setModalOpen(showExitConfirm) }, [showExitConfirm, setModalOpen])

  function cancelExit() {
    setShowExitConfirm(false)
  }

  function confirmExit(dontAskAgain) {
    if (dontAskAgain) localStorage.setItem(HIDE_EXIT_CONFIRM_KEY, 'true')
    setShowExitConfirm(false)
    allowExitRef.current = true
    window.history.back()
  }

  return (
    <div className="relative">
      {/* inert while the exit-confirmation modal is up - traps focus/pointer
          interaction inside the modal instead of letting Tab or a stray tap
          reach the carousel underneath. */}
      <div inert={showExitConfirm}>
        <div className="overflow-hidden" ref={emblaRef} data-testid="page-carousel">
          <div className="flex -ml-4">
            {PAGES.map(({ path, Component }) => (
              <div className="min-w-0 shrink-0 grow-0 basis-[94%] pl-4" key={path}>
                {/* Each slide scrolls independently instead of the shared
                    page/window scroll - without this, both slides sit in the
                    same flex row and get stretched to the taller one's height
                    (Hall of Fame would end up as tall as a long task list),
                    and scrolling deep into one page before swiping would land
                    on a visually "empty" area of the other. A fixed viewport
                    height + its own overflow fixes both: each page keeps its
                    natural height, and since both stay mounted the whole
                    time, each one's scroll position is remembered for free
                    (it's just that DOM node's own scrollTop). */}
                <div className="h-dvh overflow-y-auto" data-testid="carousel-slide-scroll" data-slide-path={path}>
                  <Component />
                </div>
              </div>
            ))}
          </div>
        </div>

        {showTip && (
          <div className="fixed bottom-24 inset-x-0 flex justify-center px-4 z-20 pointer-events-none" data-testid="swipe-tip">
            <div className="bg-orange-600 text-white text-xs rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm pointer-events-auto">
              <span>Tipp: Wische nach links oder rechts für die Ruhmeshalle</span>
              <button onClick={dismissTip} data-testid="swipe-tip-dismiss" aria-label="Tipp schließen" className="shrink-0 w-11 h-11 -my-2 -mr-2 flex items-center justify-center font-semibold leading-none">✕</button>
            </div>
          </div>
        )}
      </div>

      {showExitConfirm && <ExitConfirmModal onCancel={cancelExit} onConfirm={confirmExit} />}
    </div>
  )
}

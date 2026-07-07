import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import useEmblaCarousel from 'embla-carousel-react'
import Home from '../pages/Home.jsx'
import HallOfFame from '../pages/HallOfFame.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useModalGate } from '../context/ModalGateContext.jsx'
import { api } from '../api/client.js'

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
  const { modalOpen } = useModalGate()

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
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    watchDrag: () => !modalOpenRef.current,
  })
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, PAGES.findIndex(p => p.path === location.pathname)))
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
  // once per emblaApi instance (see refs above for why).
  useEffect(() => {
    if (!emblaApi) return
    function onSelect() {
      const index = emblaApi.selectedScrollSnap()
      setSelectedIndex(index)
      if (syncingFromUrl.current) { syncingFromUrl.current = false; return }
      const target = PAGES[index]
      if (target && target.path !== locationRef.current.pathname) navigateRef.current(target.path, { replace: true })
    }
    emblaApi.on('select', onSelect)
    return () => emblaApi.off('select', onSelect)
  }, [emblaApi])

  useEffect(() => {
    if (user && !user.hasSeenSwipeTip) setShowTip(true)
  }, [user])

  async function dismissTip() {
    setShowTip(false)
    setUser(u => (u ? { ...u, hasSeenSwipeTip: true } : u))
    try { await api.put('/users/me/swipe-tip-seen') } catch {}
  }

  return (
    <div className="relative">
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

      <div className="fixed bottom-6 inset-x-0 flex justify-center gap-1.5 pointer-events-none z-20" data-testid="carousel-dots">
        {PAGES.map((p, i) => (
          <span
            key={p.path}
            data-testid="carousel-dot"
            data-active={i === selectedIndex}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === selectedIndex ? 'bg-orange-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          />
        ))}
      </div>

      {showTip && (
        <div className="fixed bottom-12 inset-x-0 flex justify-center px-4 z-20 pointer-events-none" data-testid="swipe-tip">
          <div className="bg-orange-600 text-white text-xs rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm pointer-events-auto">
            <span>Tipp: Wische nach links oder rechts für die Ruhmeshalle</span>
            <button onClick={dismissTip} data-testid="swipe-tip-dismiss" className="font-semibold leading-none">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

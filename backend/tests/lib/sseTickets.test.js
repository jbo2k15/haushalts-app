import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { issueTicket, consumeTicket, _resetTickets } from '../../src/lib/sseTickets.js'

describe('sseTickets', () => {
  beforeEach(() => { _resetTickets() })
  afterEach(() => { vi.useRealTimers() })

  it('löst ein frisch ausgestelltes Ticket zur richtigen userId ein', () => {
    const ticket = issueTicket('user-1')
    expect(consumeTicket(ticket)).toBe('user-1')
  })

  it('ist single-use: die zweite Einlösung liefert null', () => {
    const ticket = issueTicket('user-1')
    expect(consumeTicket(ticket)).toBe('user-1')
    expect(consumeTicket(ticket)).toBeNull()
  })

  it('liefert null für unbekannte oder ungültige Tickets', () => {
    expect(consumeTicket('gibt-es-nicht')).toBeNull()
    expect(consumeTicket('')).toBeNull()
    expect(consumeTicket(undefined)).toBeNull()
    expect(consumeTicket(null)).toBeNull()
    expect(consumeTicket(12345)).toBeNull()
  })

  it('gibt bei jedem Aufruf ein einzigartiges Ticket aus', () => {
    const a = issueTicket('user-1')
    const b = issueTicket('user-1')
    expect(a).not.toBe(b)
  })

  it('lehnt ein abgelaufenes Ticket ab (TTL 30s)', () => {
    vi.useFakeTimers()
    const ticket = issueTicket('user-1')
    vi.advanceTimersByTime(31 * 1000)
    expect(consumeTicket(ticket)).toBeNull()
  })

  it('akzeptiert ein Ticket kurz vor Ablauf', () => {
    vi.useFakeTimers()
    const ticket = issueTicket('user-1')
    vi.advanceTimersByTime(29 * 1000)
    expect(consumeTicket(ticket)).toBe('user-1')
  })
})

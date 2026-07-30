import { describe, it, expect, beforeEach } from 'vitest'
import { installMockLocalStorage } from '../test/mockLocalStorage'
import { forgetTicket, loadWallet, rememberTicket } from './wallet'

beforeEach(() => {
  installMockLocalStorage()
})

describe('the player wallet', () => {
  it('starts empty', () => {
    expect(loadWallet()).toEqual([])
  })

  it('remembers tickets most recent first', () => {
    rememberTicket('K3P9Z-00', 'ROOM')
    rememberTicket('K3P9Z-01', 'ROOM')

    expect(loadWallet().map((ticket) => ticket.id)).toEqual([
      'K3P9Z-01',
      'K3P9Z-00',
    ])
  })

  it('re-opening a ticket moves it to the front without duplicating it', () => {
    rememberTicket('K3P9Z-00', 'ROOM')
    rememberTicket('K3P9Z-01', 'ROOM')
    const tickets = rememberTicket('K3P9Z-00', 'ROOM')

    expect(tickets.map((ticket) => ticket.id)).toEqual(['K3P9Z-00', 'K3P9Z-01'])
  })

  it('keeps the room a ticket arrived with when a later link has none', () => {
    // Scanning the QR, then opening the same ticket from a bookmark: the prize
    // list must not vanish.
    rememberTicket('K3P9Z-00', 'ROOM')
    expect(rememberTicket('K3P9Z-00', null)[0].room).toBe('ROOM')
  })

  it('forgets one ticket and leaves the rest', () => {
    rememberTicket('K3P9Z-00', 'ROOM')
    rememberTicket('K3P9Z-01', 'ROOM')

    expect(forgetTicket('K3P9Z-01').map((ticket) => ticket.id)).toEqual(['K3P9Z-00'])
    expect(loadWallet().map((ticket) => ticket.id)).toEqual(['K3P9Z-00'])
  })

  it('caps the list rather than growing forever', () => {
    for (let i = 0; i < 20; i++) rememberTicket(`K3P9Z-${i}`, null)
    expect(loadWallet()).toHaveLength(12)
    expect(loadWallet()[0].id).toBe('K3P9Z-19')
  })

  it('ignores junk in storage instead of throwing', () => {
    const store = installMockLocalStorage()
    store.setItem('tambola:player:tickets', '{"not":"an array"}')
    expect(loadWallet()).toEqual([])

    store.setItem('tambola:player:tickets', '[{"room":"ROOM"},{"id":"K3P9Z-00"}]')
    expect(loadWallet()).toEqual([{ id: 'K3P9Z-00', room: null }])
  })
})

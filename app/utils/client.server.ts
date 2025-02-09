// This just allows us to track individual clients so we can keep track of
// the posts they've read and make useful suggestions even if they're not logged in.

import type {Request, ResponseInit} from 'remix'
import {Headers, createCookieSessionStorage} from 'remix'
import uuid from 'uuid'
import {getRequiredServerEnvVar} from './misc'

const clientStorage = createCookieSessionStorage({
  cookie: {
    name: 'KCD_client_id',
    secrets: [getRequiredServerEnvVar('SESSION_SECRET')],
    sameSite: 'lax',
    path: '/',
    // no client ID for you on my 100th birthday! 😂
    expires: new Date('2088-10-18'),
  },
})

async function getClientSession(request: Request) {
  const session = await clientStorage.getSession(request.headers.get('Cookie'))
  const initialValue = await clientStorage.commitSession(session)
  async function commit() {
    const currentValue = await clientStorage.commitSession(session)
    return currentValue === initialValue ? null : currentValue
  }

  function getClientId() {
    let clientId = session.get('clientId') as string | undefined
    if (typeof clientId === 'string') return clientId
    clientId = uuid.v4()
    session.set('clientId', clientId)
    return clientId
  }

  // get the clientId set if it's not already
  getClientId()

  return {
    getClientId,
    commit,
    /**
     * This will initialize a Headers object if one is not provided.
     * It will set the 'Set-Cookie' header value on that headers object.
     * It will then return that Headers object.
     */
    getHeaders: async (headers: ResponseInit['headers'] = new Headers()) => {
      const value = await commit()
      if (!value) return headers
      if (headers instanceof Headers) {
        headers.append('Set-Cookie', value)
      } else if (Array.isArray(headers)) {
        headers.push(['Set-Cookie', value])
      } else {
        headers['Set-Cookie'] = value
      }
      return headers
    },
  }
}

export {getClientSession}

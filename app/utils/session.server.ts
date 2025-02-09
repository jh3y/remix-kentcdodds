import type {Request, Response, ResponseInit} from 'remix'
import {createCookieSessionStorage, redirect, Headers} from 'remix'
import type {User} from '@prisma/client'
import {sendMagicLinkEmail} from './send-email.server'
import {
  getUserByEmail,
  getMagicLink,
  getUserFromSessionId,
  prisma,
  validateMagicLink,
  createSession,
  sessionExpirationTime,
} from './prisma.server'
import {getRequiredServerEnvVar} from './misc'

const sessionIdKey = '__session_id__'

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'KCD_root_session',
    secrets: [getRequiredServerEnvVar('SESSION_SECRET')],
    sameSite: 'lax',
    path: '/',
    maxAge: sessionExpirationTime,
  },
})

async function sendToken({
  emailAddress,
  domainUrl,
}: {
  emailAddress: string
  domainUrl: string
}) {
  const confirmationLink = getMagicLink({emailAddress, domainUrl})

  const user = await getUserByEmail(emailAddress).catch(() => {
    /* ignore... */
  })

  await sendMagicLinkEmail({
    emailAddress,
    confirmationLink,
    userExists: Boolean(user),
  })
}

async function getSession(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'))
  const initialValue = await sessionStorage.commitSession(session)
  const getSessionId = () => session.get(sessionIdKey) as string | undefined
  const unsetSessionId = () => session.unset(sessionIdKey)

  const commit = async () => {
    const currentValue = await sessionStorage.commitSession(session)
    return currentValue === initialValue ? null : currentValue
  }
  return {
    session,
    getUser: async () => {
      const token = getSessionId()
      if (!token) return null

      return getUserFromSessionId(token).catch((error: unknown) => {
        unsetSessionId()
        console.error(`Failure getting user from session ID:`, error)
        return null
      })
    },
    getSessionId,
    unsetSessionId,
    singIn: async (user: Pick<User, 'id'>) => {
      const userSession = await createSession({userId: user.id})
      session.set(sessionIdKey, userSession.id)
    },
    signOut: () => {
      const sessionId = getSessionId()
      if (sessionId) {
        unsetSessionId()
        prisma.session
          .delete({where: {id: sessionId}})
          .catch((error: unknown) => {
            console.error(`Failure deleting user session: `, error)
          })
      }
    },
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

async function getUser(request: Request) {
  const {session} = await getSession(request)

  const token = session.get(sessionIdKey) as string | undefined
  if (!token) return null

  return getUserFromSessionId(token).catch((error: unknown) => {
    console.error(`Failure getting user from session ID:`, error)
    return null
  })
}

async function getUserSessionFromMagicLink(request: Request) {
  const email = await validateMagicLink(request.url)

  const user = await getUserByEmail(email)
  if (!user) return null

  const session = await getSession(request)
  await session.singIn(user)
  return session
}

async function requireAdminUser(
  request: Request,
  callback: (data: User) => Response | Promise<Response>,
): Promise<Response> {
  const user = await getUser(request)
  if (!user) {
    const session = await getSession(request)
    session.signOut()
    return redirect('/login', {headers: await session.getHeaders()})
  }
  if (user.role !== 'ADMIN') {
    return redirect('/')
  }
  return callback(user)
}

async function requireUser(
  request: Request,
  callback: (data: User) => Response | Promise<Response>,
): Promise<Response> {
  const user = await getUser(request)
  if (!user) {
    const session = await getSession(request)
    session.signOut()
    return redirect('/login', {headers: await session.getHeaders()})
  }
  return callback(user)
}

export {
  getSession,
  getUserSessionFromMagicLink,
  requireUser,
  requireAdminUser,
  getUser,
  sendToken,
}

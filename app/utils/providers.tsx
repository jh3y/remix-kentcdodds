import * as React from 'react'
import type {Await, CallKentEpisode, User, Workshop} from '~/types'
import type {getUserInfo} from './user-info.server'
import type {Theme} from './theme-provider'
import type {WorkshopEvent} from './workshop-tickets.server'
import type {OptionalTeam} from './misc'
import {unknownTeam} from './misc'

function createSimpleContext<ContextType>(name: string) {
  const defaultValue = Symbol(`Default ${name} context value`)
  const Context = React.createContext<ContextType | null | typeof defaultValue>(
    defaultValue,
  )
  Context.displayName = name

  function useValue() {
    const value = React.useContext(Context)
    if (value === defaultValue) {
      throw new Error(`use${name} must be used within ${name}Provider`)
    }
    if (!value) {
      throw new Error(
        `No value in ${name}Provider context. If the value is optional in this situation, try useOptional${name} instead of use${name}`,
      )
    }
    return value
  }

  function useOptionalValue() {
    const value = React.useContext(Context)
    if (value === defaultValue) {
      throw new Error(`useOptional${name} must be used within ${name}Provider`)
    }
    return value
  }

  return {Provider: Context.Provider, useValue, useOptionalValue}
}

type RequestInfo = {
  origin: string
  session: {
    email: string | undefined
    hasActiveMagicLink: boolean
    theme: Theme | null
  }
}
const {Provider: RequestInfoProvider, useValue: useRequestInfo} =
  createSimpleContext<RequestInfo>('RequestInfo')

type UserInfo = Await<ReturnType<typeof getUserInfo>>
const {
  Provider: UserInfoProvider,
  useValue: useUserInfo,
  useOptionalValue: useOptionalUserInfo,
} = createSimpleContext<UserInfo>('UserInfo')

const {
  Provider: UserProvider,
  useValue: useUser,
  useOptionalValue: useOptionalUser,
} = createSimpleContext<User>('User')

const {Provider: TeamProviderBase, useValue: useTeam} =
  createSimpleContext<
    [OptionalTeam, React.Dispatch<React.SetStateAction<OptionalTeam>>]
  >('Team')

function TeamProvider({
  children,
}: {
  children: React.ReactNode | Array<React.ReactNode>
}) {
  const user = useOptionalUser()
  const [team, setTeam] = React.useState<OptionalTeam>(unknownTeam.UNKNOWN)

  // if the user logs out, we want to reset the team to unknown
  React.useEffect(() => {
    if (!user) setTeam(unknownTeam.UNKNOWN)
  }, [user])
  // NOTE: calling set team will do nothing if we're given an actual team
  return (
    <TeamProviderBase value={[user?.team ?? team, setTeam]}>
      {children}
    </TeamProviderBase>
  )
}

type ChatsEpisodeUIState = {
  sortOrder: 'desc' | 'asc'
}
const {
  Provider: ChatsEpisodeUIStateProvider,
  useValue: useChatsEpisodeUIState,
} = createSimpleContext<ChatsEpisodeUIState>('ChatsEpisodeUIState')

const {Provider: CallKentEpisodesProvider, useValue: useCallKentEpisodes} =
  createSimpleContext<Array<CallKentEpisode>>('CallKentEpisodes')

type Workshops = {
  workshops: Array<Workshop>
  workshopEvents: Array<WorkshopEvent>
}
const {Provider: WorkshopsProvider, useValue: useWorkshops} =
  createSimpleContext<Workshops>('Workshops')

export {
  RequestInfoProvider,
  createSimpleContext,
  useRequestInfo,
  UserInfoProvider,
  useUserInfo,
  useOptionalUserInfo,
  UserProvider,
  useUser,
  useOptionalUser,
  TeamProvider,
  useTeam,
  ChatsEpisodeUIStateProvider,
  useChatsEpisodeUIState,
  CallKentEpisodesProvider,
  useCallKentEpisodes,
  WorkshopsProvider,
  useWorkshops,
}
export type {RequestInfo, OptionalTeam}

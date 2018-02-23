
interface RouterCommon {
  on(eventName: 'started' | 'ended', handler?: (currentState: CurrentStateWithParams, previousState?: StateWithParams) => void): this
  on(eventName: 'error', handler?: (error: any) => void): this
  addState(name: string, state: State): this
}

/* The router API while it's still in its builder phase */
interface Router extends RouterCommon {
  configure(options: ConfigOptions): this
  init(initState?: string, initParams?: Object): RouterAPI
}

/* The initialized router API */
interface RouterAPI extends RouterCommon {
  transitionTo(stateName: string, params?: Object): void
  transitionTo(pathQuery: string): void
  replaceParams(newParams: {[ key: string ]: any }): void
  backTo(stateName: string, defaultParams?: Object): void
  link(stateName: string, params?: Object): string
  previous(): StateWithParams | void
  current(): CurrentStateWithParams
  findState(optionsOrFullName: {}): State | void
  isFirstTransition(): boolean
  paramsDiff(): ParamsDiff
}

interface StateWithParams {
  uri: string
  params: Params
  name: string
  fullName: string
  data: Record<string, {}>

  isIn(fullName: string): boolean
}

interface ParamsDiff {
  update: Record<string, boolean>
  enter: Record<string, boolean>
  exit: Record<string, boolean>
  all: Record<string, boolean>
}

interface CurrentStateWithParams extends StateWithParams {
  paramsDiff: ParamsDiff
}

interface State {
  name: string
  fullName: string
  parent: State | void
  data: Record<string, {}>
}

interface ConfigOptions {
  enableLogs?: boolean
  interceptAnchors?: boolean
  notFound?: string
  urlSync?: 'history' | 'hash'
  hashPrefix?: string
}

type StateMap = Record<string, State>

type Params = Record<string, string | undefined>

interface LifeCycleCallbackParams<R> {
  state: CurrentStateWithParams
  params: Params
  router: RouterAPI
  resolved: R
}

type LifeCycleCallback<R> = (params: LifeCycleCallbackParams<R>) => void


interface StateOptions<R> {
  resolve?: (params: Params) => Promise<R>
  enter?: LifeCycleCallback<R>
  exit?: LifeCycleCallback<R>
  update?: LifeCycleCallback<R>
  data?: Record<string, {}>
}

interface RouterObject {
  (states: StateMap): Router
  log: boolean
}


export const Router: RouterObject
export function State<R>(uri: string, options: StateOptions<R>, children?: StateMap): State
export var api: RouterAPI

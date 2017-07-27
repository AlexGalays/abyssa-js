
interface RouterCommon {
  on(eventName: 'started' | 'ended', handler?: (currentState: CurrentStateWithParams, previousState?: StateWithParams) => void): this
  addState(name: string, state: State): this
}

/* The router API while it's still in its builder phase */
interface Router extends RouterCommon {
  configure(options: ConfigOptions): this
  init(initState?: string, initParams?: Object): RouterAPI
}

/* The initialized router API */
interface RouterAPI extends RouterCommon {
  transitionTo(stateName: string, params?: Object, acc?: any): void
  transitionTo(pathQuery: string, acc?: any): void
  replaceParams(newParams: {[ key: string ]: any }): void
  backTo(stateName: string, defaultParams?: Object, acc?: any): void
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

type LifeCycleCallback = (params: Params, value: {}, router: RouterAPI) => void

interface StateOptions {
  enter?: LifeCycleCallback
  exit?: LifeCycleCallback
  update?: LifeCycleCallback
  data?: Record<string, {}>
}

interface RouterObject {
  (states: StateMap): Router
  log: boolean
}


export const Router: RouterObject
export function State(uri: string, options: StateOptions, children?: StateMap): State
export var api: RouterAPI

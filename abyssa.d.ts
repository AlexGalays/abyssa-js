
type Obj = { [key: string]: any }

interface RouterCommon {
  on(eventName: 'started' | 'ended', handler?: (currentState: StateWithParams, previousState?: StateWithParams) => void): this;
}

/* The initialized router API */
interface RouterAPI extends RouterCommon {
  transitionTo(stateName: string, params?: Object, acc?: any): void;
  transitionTo(pathQuery: string, acc?: any): void;
  replaceStateParams(newParams: {[ key: string ]: any }): void;
  backTo(stateName: string, defaultParams?: Object, acc?: any): void;
  link(stateName: string, params?: Object): string;
  previous(): StateWithParams | void;
  current(): StateWithParams;
  findState(optionsOrFullName: any): State | void;
  isFirstTransition(): boolean;
  paramsDiff(): Object;
}

/* The router API while it's still in its builder phase */
interface Router extends RouterCommon {
  configure(options: ConfigOptions): this;
  addState(name: string, state: State): this;
  init(initState?: string, initParams?: Object): RouterAPI;
}

interface StateWithParams {
  uri: string;
  params: Params;
  name: string;
  fullName: string;
  data: Obj;

  isIn(fullName: string): boolean;
}

interface StateMap {
  [stateName: string]: State;
}

interface State {
  name: string
  fullName: string
  parent: State | void
  data: Obj
}

interface ConfigOptions {
  enableLogs?: boolean;
  interceptAnchors?: boolean;
  notFound?: string;
  urlSync?: 'history' | 'hash';
  hashPrefix?: string;
}

interface Params {
  [key: string]: string;
}

type LifeCycleCallback = (params: Params, value: any, router: RouterAPI) => void;

interface StateOptions {
  enter?: LifeCycleCallback;
  exit?: LifeCycleCallback;
  update?: LifeCycleCallback;
  data?: Obj
}

interface RouterObject {
  (states: StateMap): Router;
  log: boolean;
}


export const Router: RouterObject;
export function State(uri: string, options: StateOptions, children?: StateMap): State;
export var api: RouterAPI;

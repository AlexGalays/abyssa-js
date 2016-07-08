
interface RouterAPI {
  transitionTo(stateName: string, params?: Object, acc?: any): void;
  transitionTo(pathQuery: string, acc?: any): void;
  replaceStateParams(newParams: {[ key: string ]: any }): void;
  backTo(stateName: string, defaultParams?: Object, acc?: any): void;
  link(stateName: string, params?: Object): string;
  previous(): StateWithParams;
  current(): StateWithParams;
  findState(optionsOrFullName: any): State;
  isFirstTransition(): boolean;
  paramsDiff(): Object;

  transition: { on: (eventName: 'started' | 'ended',
    handler: (currentState: StateWithParams, previousState?: StateWithParams) => void) => void };
}

interface Router {
  configure(options: ConfigOptions): this;
  addState(name: string, state: State): this;
  on(eventName: 'started' | 'ended', handler: (currentState: StateWithParams, previousState?: StateWithParams) => void): this;
  init(initState?: string, initParams?: Object): RouterAPI;
}

interface StateWithParams {
  uri: string;
  params: Params;
  name: string;
  fullName: string;

  isIn(fullName: string): boolean;

  data(key: string): any;
  data(key: string, value: any): void;
}

interface StateMap {
  [stateName: string]: State;
}

interface State {
  uri: string
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
}


export function Router(states: StateMap): Router;
export function State(uri: string, options: StateOptions, children?: StateMap): State;
export var api: RouterAPI;


import React = __React;
import { State, StateMap } from './abyssa';


export interface ReactState {
  (uri: string, component: React.ComponentClass<any> | React.StatelessComponent<any>, children?: StateMap): State;
}

export default function reactStateForContainer(container: HTMLElement): ReactState;

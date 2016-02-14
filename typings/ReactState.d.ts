
import React = __React;
import { State, StateMap } from './abyssa';


interface ReactState {
  (uri: string, component: React.ComponentClass<any>, children?: StateMap): State;
}

export default function reactStateForContainer(container: HTMLElement): ReactState;

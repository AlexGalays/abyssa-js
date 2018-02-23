
import { State } from '../'


const state = State<string>('path', {
  resolve: params => new Promise(resolve => { resolve('lol') }),
  enter: enterParams => console.log(enterParams.resolved),
})
/*
* Create a new Transition instance.
*/
function Transition(fromStateWithParams, toStateWithParams, paramsDiff, acc, router, logger) {
  let root
  let enters
  let exits

  const fromState = fromStateWithParams && fromStateWithParams.state
  const toState = toStateWithParams.state
  const params = toStateWithParams.params
  const isUpdate = (fromState == toState)

  const transition = {
    from: fromState,
    to: toState,
    toParams: params,
    cancel: cancel,
    cancelled: false,
    currentState: fromState,
    run: run
  }

  // The first transition has no fromState.
  if (fromState)
    root = transitionRoot(fromState, toState, isUpdate, paramsDiff)

  const inclusive = !root || isUpdate
  exits = fromState ? transitionStates(fromState, root, inclusive) : []
  enters = transitionStates(toState, root, inclusive).reverse()

  function run() {
    startTransition(enters, exits, params, transition, isUpdate, acc, router, logger)
  }

  function cancel() {
    transition.cancelled = true
  }

  return transition
}

function startTransition(enters, exits, params, transition, isUpdate, acc, router, logger) {
  acc = acc || {}

  transition.exiting = true
  exits.forEach(state => {
    if (isUpdate && state.update) return
    runStep(state, 'exit', params, transition, acc, router, logger)
  })
  transition.exiting = false

  enters.forEach(state => {
    const fn = (isUpdate && state.update) ? 'update' : 'enter'
    runStep(state, fn, params, transition, acc, router, logger)
  })
}

function runStep(state, stepFn, params, transition, acc, router, logger) {
  if (transition.cancelled) return

  if (logger.enabled) {
    const capitalizedStep = stepFn[0].toUpperCase() + stepFn.slice(1)
    logger.log(capitalizedStep + ' ' + state.fullName)
  }

  const result = state[stepFn](params, acc, router)

  if (transition.cancelled) return

  transition.currentState = (stepFn == 'exit') ? state.parent : state

  return result
}

/*
* The top-most current state's parent that must be exited.
*/
function transitionRoot(fromState, toState, isUpdate, paramsDiff) {
  let root

  // For a param-only change, the root is the top-most state owning the param(s),
  if (isUpdate) {
    [fromState].concat(fromState.parents).reverse().forEach(parent => {
      if (root) return

      for (let param in paramsDiff.all) {
        if (parent.params[param] || parent.queryParams[param]) {
          root = parent
          break
        }
      }
    })
  }
  // Else, the root is the closest common parent of the two states.
  else {
    let parent
    for (var i = 0; i < fromState.parents.length; i++) {
      parent = fromState.parents[i]
      if (toState.parents.indexOf(parent) > -1) {
        root = parent
        break
      }
    }
  }

  return root
}

function transitionStates(state, root, inclusive) {
  root = root || state.root

  const p = state.parents
  const end = Math.min(p.length, p.indexOf(root) + (inclusive ? 1 : 0))

  return [state].concat(p.slice(0, end))
}


export default Transition

/*
* Create a new Transition instance.
*/
function Transition(fromStateWithParams, toStateWithParams, paramsDiff, router, logger) {
  let root = { root: null, inclusive: true }
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
    cancel,
    run,
    cancelled: false,
    currentState: fromState
  }

  // The first transition has no fromState.
  if (fromState)
    root = transitionRoot(fromState, toState, isUpdate, paramsDiff)

  exits = fromState ? transitionStates(fromState, root) : []
  enters = transitionStates(toState, root).reverse()

  function run() {
    const resolves = enters.map(state => state.resolve ? state.resolve(params) : undefined)

    const doRun = resolves => runTransition(enters, exits, params, transition, isUpdate, router, resolves, logger)

    return resolves.some(r => r)
      ? Promise.all(resolves).then(doRun)
      // For backward compatibility, run the transition synchronously if there are zero resolves
      : new Promise(resolve => resolve(doRun([])))
  }

  function cancel() {
    transition.cancelled = true
  }

  return transition
}

function runTransition(enters, exits, params, transition, isUpdate, router, resolves, logger) {
  transition.exiting = true

  exits.forEach(state => {
    if (isUpdate && state.update) return
    runStep(state, 'exit', params, transition, router, logger)
  })

  transition.exiting = false

  enters.forEach((state, index) => {
    const fn = (isUpdate && state.update) ? 'update' : 'enter'
    runStep(state, fn, params, transition, router, logger, resolves[index])
  })
}

function runStep(state, stepFn, params, transition, router, logger, resolved) {
  if (transition.cancelled) return

  if (logger.enabled) {
    const capitalizedStep = stepFn[0].toUpperCase() + stepFn.slice(1)
    logger.log(capitalizedStep + ' ' + state.fullName)
  }

  const stepParams = {
    resolved,
    state: transition.to,
    params,
    router
  }

  const result = state[stepFn](stepParams)

  if (transition.cancelled) return

  transition.currentState = (stepFn == 'exit') ? state.parent : state

  return result
}

/*
* The top-most fromState's parent that must be exited
* or undefined if the two states are in distinct branches of the tree.
*/
function transitionRoot(fromState, toState, isUpdate, paramsDiff) {
  let closestCommonParent

  const parents = [fromState].concat(fromState.parents).reverse()

  // Find the closest common parent of the from/to states, if any.
  if (!isUpdate) {
    for (let i = 0; i < fromState.parents.length; i++) {
      const parent = fromState.parents[i]

      if (toState.parents.indexOf(parent) > -1) {
        closestCommonParent = parent
        break
      }
    }
  }

  // Find the top-most parent owning some updated param(s) or bail if we first reach the closestCommonParent
  for (let i = 0; i < parents.length; i++) {
    const parent = parents[i]

    for (let param in paramsDiff.all) {
      if (parent.params[param] || parent.queryParams[param])
        return { root: parent, inclusive: true }
    }

    if (parent === closestCommonParent)
      return { root: closestCommonParent, inclusive: false }
  }

  return closestCommonParent
    ? { root: closestCommonParent, inclusive: false }
    : { inclusive: true }
}

function transitionStates(state, { root, inclusive }) {
  root = root || state.root

  const p = state.parents
  const end = Math.min(p.length, p.indexOf(root) + (inclusive ? 1 : 0))

  return [state].concat(p.slice(0, end))
}


export default Transition

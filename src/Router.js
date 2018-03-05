import interceptAnchors from './anchors'
import StateWithParams from './StateWithParams'
import Transition from './Transition'
import * as util from './util'
import State from './State'
import api from './api'


const defaultOptions = {
  enableLogs: false,
  interceptAnchors: true,
  notFound: null,
  urlSync: 'history',
  hashPrefix: ''
}

/*
* Create a new Router instance, passing any state defined declaratively.
* More states can be added using addState().
*
* Because a router manages global state (the URL), only one instance of Router
* should be used inside an application.
*/
function Router(declarativeStates) {
  const router = {}
  const states = stateTrees(declarativeStates)
  const eventCallbacks = {}

  let options = util.copyObject(defaultOptions)
  let firstTransition = true
  let ignoreNextURLChange = false
  let currentPathQuery
  let currentParamsDiff = {}
  let currentState
  let previousState
  let transition
  let leafStates
  let urlChanged
  let initialized
  let hashSlashString

  /*
  * Setting a new state will start a transition from the current state to the target state.
  * A successful transition will result in the URL being changed.
  * A failed transition will leave the router in its current state.
  */
  function setState(state, params) {
    const fromState = transition
      ? StateWithParams(transition.currentState, transition.toParams)
      : currentState

    const diff = util.objectDiff(fromState && fromState.params, params)

    const toState = StateWithParams(state, params, currentPathQuery, diff)

    if (preventTransition(fromState, toState, diff)) {
      if (transition && transition.exiting) cancelTransition()
      return
    }

    if (transition) cancelTransition()

    // While the transition is running, any code asking the router about the previous/current state should
    // get the end result state.
    previousState = currentState
    currentState = toState
    currentParamsDiff = diff

    const newTransition = transition = Transition(
      fromState,
      toState,
      diff,
      router,
      logger
    )

    startingTransition(fromState, toState)

    // In case of a redirect() called from 'startingTransition', the transition already ended.
    if (newTransition === transition) transition.run()
      .then(() => {
        // In case of a redirect() called from the transition itself, the transition already ended
        if (transition) {
          if (transition.cancelled)
            currentState = fromState
          else
            endingTransition(fromState, toState)
        }

        transition = null
      })
      .catch(err => {
        currentState = fromState
        eventCallbacks.error && eventCallbacks.error(err)
        transition = null
      })
  }

  function cancelTransition() {
    logger.log('Cancelling existing transition from {0} to {1}',
      transition.from, transition.to)

    transition.cancel()
  }

  function startingTransition(fromState, toState) {
    logger.log('Starting transition from {0} to {1}', fromState, toState)

    const from = fromState ? fromState.asPublic : null
    const to = toState.asPublic

    eventCallbacks.started && eventCallbacks.started(to, from)
  }

  function endingTransition(fromState, toState) {
    if (!urlChanged) {
      logger.log('Updating URL: {0}', currentPathQuery)
      updateURLFromState(currentPathQuery, document.title, currentPathQuery)
    }

    firstTransition = false

    logger.log('Transition from {0} to {1} ended', fromState, toState)

    toState.state.lastParams = toState.params

    const from = fromState ? fromState.asPublic : null
    const to = toState.asPublic

    eventCallbacks.ended && eventCallbacks.ended(to, from)
  }

  function updateURLFromState(state, title, url) {
    if (isHashMode()) {
      ignoreNextURLChange = true
      location.hash = options.hashPrefix + url
    }
    else if (firstTransition) {
      history.replaceState(state, title, url)
    }
    else
      history.pushState(state, title, url)
  }

  /*
  * Return whether the passed state is the same as the current one
  * in which case the router can ignore the change.
  */
  function preventTransition(current, newState, diff) {
    if (!current) return false

    return (newState.state == current.state) && (Object.keys(diff.all).length == 0)
  }

  /*
  * The state wasn't found
  * Transition to the 'notFound' state if the developer specified it or else throw an error.
  */
  function notFound(state) {
    logger.log('State not found: {0}', state)

    if (options.notFound)
      return setState(leafStates[options.notFound], {})
    else throw new Error ('State "' + state + '" could not be found')
  }

  /*
  * Configure the router before its initialization.
  * The available options are:
  *   enableLogs: Whether (debug and error) console logs should be enabled. Defaults to false.
  *   interceptAnchors: Whether anchor mousedown/clicks should be intercepted and trigger a state change. Defaults to true.
  *   notFound: The State to enter when no state matching the current path query or name could be found. Defaults to null.
  *   urlSync: How should the router maintain the current state and the url in sync. Defaults to true (history API).
  *   hashPrefix: Customize the hash separator. Set to '!' in order to have a hashbang like '/#!/'. Defaults to empty string.
  */
  function configure(withOptions) {
    util.mergeObjects(options, withOptions)
    return router
  }

  /*
  * Initialize the router.
  * The router will immediately initiate a transition to, in order of priority:
  * 1) The init state passed as an argument
  * 2) The state captured by the current URL
  */
  function init(initState, initParams) {
    if (options.enableLogs || Router.log)
      Router.enableLogs()

    if (options.interceptAnchors)
      interceptAnchors(router)

    hashSlashString = '#' + options.hashPrefix + '/'

    logger.log('Router init')

    initStates()
    logStateTree()

    initState = (initState !== undefined) ? initState : urlPathQuery()

    logger.log('Initializing to state {0}', initState || '""')
    transitionTo(initState, initParams)

    listenToURLChanges()

    initialized = true
    return router
  }

  /*
  * Remove any possibility of side effect this router instance might cause.
  * Used for testing purposes where we keep reusing the same router instance.
  */
  function terminate() {
    window.onhashchange = null
    window.onpopstate = null
    options = util.copyObject(defaultOptions)
    logger.enabled = false
    logger.log = logger.error = util.noop
  }

  function listenToURLChanges() {

    function onURLChange(evt) {
      if (ignoreNextURLChange) {
        ignoreNextURLChange = false
        return
      }

      const newState = evt.state || urlPathQuery()

      logger.log('URL changed: {0}', newState)
      urlChanged = true
      setStateForPathQuery(newState)
    }

    window[isHashMode() ? 'onhashchange' : 'onpopstate'] = onURLChange
  }

  function initStates() {
    const stateArray = util.objectToArray(states)

    addDefaultStates(stateArray)

    eachRootState((name, state) => {
      state.init(router, name)
    })

    assertPathUniqueness(stateArray)

    leafStates = registerLeafStates(stateArray, {})

    assertNoAmbiguousPaths()
  }

  function assertPathUniqueness(states) {
    const paths = {}

    states.forEach(state => {
      if (paths[state.path]) {
        const fullPaths = states.map(s => s.fullPath() || 'empty')
        throw new Error('Two sibling states have the same path (' + fullPaths + ')')
      }

      paths[state.path] = 1
      assertPathUniqueness(state.children)
    })
  }

  function assertNoAmbiguousPaths() {
    const paths = {}

    for (var name in leafStates) {
      const path = util.normalizePathQuery(leafStates[name].fullPath())
      if (paths[path]) throw new Error('Ambiguous state paths: ' + path)
      paths[path] = 1
    }
  }

  function addDefaultStates(states) {
    states.forEach(state => {
      var children = util.objectToArray(state.states)

      // This is a parent state: Add a default state to it if there isn't already one
      if (children.length) {
        addDefaultStates(children)

        var hasDefaultState = children.reduce((result, state) => {
          return state.path == '' || result
        }, false)

        if (hasDefaultState) return

        var defaultState = State({ uri: '' })
        state.states._default_ = defaultState
      }
    })
  }

  function eachRootState(callback) {
    for (let name in states) callback(name, states[name])
  }

  function registerLeafStates(states, leafStates) {
    return states.reduce((leafStates, state) => {
      if (state.children.length)
        return registerLeafStates(state.children, leafStates)
      else {
        leafStates[state.fullName] = state
        state.paths = util.parsePaths(state.fullPath())
        return leafStates
      }
    }, leafStates)
  }

  /*
  * Request a programmatic state change.
  *
  * Two notations are supported:
  * transitionTo('my.target.state', {id: 33, filter: 'desc'})
  * transitionTo('target/33?filter=desc')
  */
  function transitionTo(pathQueryOrName) {
    const name = leafStates[pathQueryOrName]
    const params = (name ? arguments[1] : null) || {}

    logger.log('Changing state to {0}', pathQueryOrName || '""')

    urlChanged = false

    if (name)
      setStateByName(name, params)
    else
      setStateForPathQuery(pathQueryOrName)
  }

  /*
   * Replaces the current state's params in the history with new params.
   * The state is NOT exited/re-entered.
   */
  function replaceParams(newParams) {
    if (!currentState) return

    const newUri = router.link(currentState.state.fullName, newParams)

    currentState = StateWithParams(currentState.state, newParams, newUri)

    history.replaceState(newUri, document.title, newUri)
  }

  /*
  * Attempt to navigate to 'stateName' with its previous params or
  * fallback to the defaultParams parameter if the state was never entered.
  */
  function backTo(stateName, defaultParams) {
    const params = leafStates[stateName].lastParams || defaultParams
    transitionTo(stateName, params)
  }

  function setStateForPathQuery(pathQuery) {
    let state, params, _state, _params

    currentPathQuery = util.normalizePathQuery(pathQuery)

    const pq = currentPathQuery.split('?')
    const path = pq[0]
    const query = pq[1]
    const paths = util.parsePaths(path)
    const queryParams = util.parseQueryParams(query)

    for (var name in leafStates) {
      _state = leafStates[name]
      _params = _state.matches(paths)

      if (_params) {
        state = _state
        params = util.mergeObjects(_params, queryParams)
        break
      }
    }

    if (state) setState(state, params)
    else notFound(currentPathQuery)
  }

  function setStateByName(name, params) {
    const state = leafStates[name]

    if (!state) return notFound(name)

    const pathQuery = interpolate(state, params)
    setStateForPathQuery(pathQuery)
  }

  /*
  * Add a new root state to the router.
  * The name must be unique among root states.
  */
  function addState(name, state) {
    if (states[name])
      throw new Error('A state already exist in the router with the name ' + name)

    state = stateTree(state)

    states[name] = state

    // The router is already initialized: Hot patch this state in.
    if (initialized) {
      state.init(router, name)
      registerLeafStates([state], leafStates)
    }

    return router
  }

  /*
  * Read the path/query from the URL.
  */
  function urlPathQuery() {
    const hashSlash = location.href.indexOf(hashSlashString)
    let pathQuery

    if (hashSlash > -1)
      pathQuery = location.href.slice(hashSlash + hashSlashString.length)
    else if (isHashMode())
      pathQuery = '/'
    else
      pathQuery = (location.pathname + location.search).slice(1)

    return util.normalizePathQuery(pathQuery)
  }

  function isHashMode() {
    return options.urlSync == 'hash'
  }

  /*
  * Compute a link that can be used in anchors' href attributes
  * from a state name and a list of params, a.k.a reverse routing.
  */
  function link(stateName, params) {
    const state = leafStates[stateName]
    if (!state) throw new Error('Cannot find state ' + stateName)

    const interpolated = interpolate(state, params)
    const uri = util.normalizePathQuery(interpolated)

    return isHashMode()
      ? '#' + options.hashPrefix + uri
      : uri
  }

  function interpolate(state, params) {
    const encodedParams = {}

    for (let key in params) {
      if (params[key] !== undefined)
        encodedParams[key] = encodeURIComponent(params[key])
    }

    return state.interpolate(encodedParams)
  }

  /*
  * Returns an object representing the current state of the router.
  */
  function getCurrent() {
    return currentState && currentState.asPublic
  }

  /*
  * Returns an object representing the previous state of the router
  * or null if the router is still in its initial state.
  */
  function getPrevious() {
    return previousState && previousState.asPublic
  }

  /*
  * Returns the diff between the current params and the previous ones.
  */
  function getParamsDiff() {
    return currentParamsDiff
  }

  function allStatesRec(states, acc) {
    acc.push.apply(acc, states)
    states.forEach(state => allStatesRec(state.children, acc))
    return acc
  }

  function allStates() {
    return allStatesRec(util.objectToArray(states), [])
  }

  /*
  * Returns the state object that was built with the given options object or that has the given fullName.
  * Returns undefined if the state doesn't exist.
  */
  function findState(by) {
    const filterFn = (typeof by === 'object')
      ? state => by === state.options
      : state => by === state.fullName

    const state = allStates().filter(filterFn)[0]
    return state && state.asPublic
  }

  /*
  * Returns whether the router is executing its first transition.
  */
  function isFirstTransition() {
    return previousState == null
  }

  function on(eventName, cb) {
    eventCallbacks[eventName] = cb
    return router
  }

  function stateTrees(states) {
    return util.mapValues(states, stateTree)
  }

  /*
  * Creates an internal State object from a specification POJO.
  */
  function stateTree(state) {
    if (state.children) state.children = stateTrees(state.children)
    return State(state)
  }

  function logStateTree() {
    if (!logger.enabled) return

    function indent(level) {
      if (level == 0) return ''
      return new Array(2 + (level - 1) * 4).join(' ') + '── '
    }

    const stateTree = function(state) {
      const path = util.normalizePathQuery(state.fullPath())
      const pathStr = (state.children.length == 0)
        ? ' (@ path)'.replace('path', path)
        : ''
      const str = indent(state.parents.length) + state.name + pathStr + '\n'
      return str + state.children.map(stateTree).join('')
    }

    let msg = '\nState tree\n\n'
    msg += util.objectToArray(states).map(stateTree).join('')
    msg += '\n'

    logger.log(msg)
  }


  // Public methods

  router.configure = configure
  router.init = init
  router.transitionTo = transitionTo
  router.replaceParams = replaceParams
  router.backTo = backTo
  router.addState = addState
  router.link = link
  router.current = getCurrent
  router.previous = getPrevious
  router.findState = findState
  router.isFirstTransition = isFirstTransition
  router.paramsDiff = getParamsDiff
  router.options = options
  router.on = on

  // Used for testing purposes only
  router.urlPathQuery = urlPathQuery
  router.terminate = terminate

  util.mergeObjects(api, router)

  return router
}


// Logging

const logger = {
  log: util.noop,
  error: util.noop,
  enabled: false
}

Router.enableLogs = function() {
  logger.enabled = true

  logger.log = function(...args) {
    const message = util.makeMessage.apply(null, args)
    console.log(message)
  }

  logger.error = function(...args) {
    const message = util.makeMessage.apply(null, args)
    console.error(message)
  }

}


export default Router

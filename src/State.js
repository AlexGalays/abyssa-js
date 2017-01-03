import * as util from './util'

const PARAMS = /:[^\\?\/]*/g

/*
* Creates a new State instance from a {uri, enter, exit, update, children} object.
* This is the internal representation of a state used by the router.
*/
function State(options) {
  const state = { options }
  const states = options.children

  state.path = pathFromURI(options.uri)
  state.params = paramsFromURI(options.uri)
  state.queryParams = queryParamsFromURI(options.uri)
  state.states = states
  state.data = options.data

  state.enter = options.enter || util.noop
  state.update = options.update
  state.exit = options.exit || util.noop

  /*
  * Initialize and freeze this state.
  */
  function init(router, name, parent) {
    state.router = router
    state.name = name
    state.isDefault = name == '_default_'
    state.parent = parent
    state.parents = getParents()
    state.root = state.parent ? state.parents[state.parents.length - 1] : state
    state.children = util.objectToArray(states)
    state.fullName = getFullName()
    state.asPublic = makePublicAPI()

    eachChildState((name, childState) => {
      childState.init(router, name, state)
    })
  }

  /*
  * The full path, composed of all the individual paths of this state and its parents.
  */
  function fullPath() {
    let result = state.path
    let stateParent = state.parent

    while (stateParent) {
      if (stateParent.path) result = stateParent.path + '/' + result
      stateParent = stateParent.parent
    }

    return result
  }

  /*
  * The list of all parents, starting from the closest ones.
  */
  function getParents() {
    const parents = []
    let parent = state.parent

    while (parent) {
      parents.push(parent)
      parent = parent.parent
    }

    return parents
  }

  /*
  * The fully qualified name of this state.
  * e.g granparentName.parentName.name
  */
  function getFullName() {
    const result = state.parents.reduceRight((acc, parent) => {
      return acc + parent.name + '.'
    }, '') + state.name

    return state.isDefault
      ? result.replace('._default_', '')
      : result
  }

  function allQueryParams() {
    return state.parents.reduce((acc, parent) => {
      return util.mergeObjects(acc, parent.queryParams)
    }, util.copyObject(state.queryParams))
  }

  function makePublicAPI() {
    return {
      name: state.name,
      fullName: state.fullName,
      data: options.data || {},
      parent: state.parent && state.parent.asPublic
    }
  }

  function eachChildState(callback) {
    for (let name in states) callback(name, states[name])
  }

  /*
  * Returns whether this state matches the passed path Array.
  * In case of a match, the actual param values are returned.
  */
  function matches(paths) {
    const params = {}
    const nonRestStatePaths = state.paths.filter(p => p[p.length - 1] !== '*')

    /* This state has more paths than the passed paths, it cannot be a match */
    if (nonRestStatePaths.length > paths.length) return false

    /* Checks if the paths match one by one */
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i]
      const thatPath = state.paths[i]

      /* This state has less paths than the passed paths, it cannot be a match */
      if (!thatPath) return false

      const isRest = thatPath[thatPath.length - 1] === '*'
      if (isRest) {
        const name = paramName(thatPath)
        params[name] = paths.slice(i).join('/')
        return params
      }

      const isDynamic = thatPath[0] === ':'
      if (isDynamic) {
        const name = paramName(thatPath)
        params[name] = path
      }
      else if (thatPath != path) return false
    }

    return params
  }

  /*
  * Returns a URI built from this state and the passed params.
  */
  function interpolate(params) {
    const path = state.fullPath().replace(PARAMS, p => params[paramName(p)] || '')

    const queryParams = allQueryParams()
    const passedQueryParams = Object.keys(params).filter(p => queryParams[p])

    const query = passedQueryParams.map(p => p + '=' + params[p]).join('&')

    return path + (query.length ? ('?' + query) : '')
  }


  function toString() {
    return state.fullName
  }


  state.init = init
  state.fullPath = fullPath
  state.allQueryParams = allQueryParams
  state.matches = matches
  state.interpolate = interpolate
  state.toString = toString

  return state
}

function paramName(param) {
  return param[param.length - 1] === '*'
    ? param.substr(1).slice(0, -1)
    : param.substr(1)
}

function pathFromURI(uri) {
  return (uri || '').split('?')[0]
}

function paramsFromURI(uri) {
  const matches = PARAMS.exec(uri)
  return matches ? util.arrayToObject(matches.map(paramName)) : {}
}

function queryParamsFromURI(uri) {
  const query = (uri || '').split('?')[1]
  return query ? util.arrayToObject(query.split('&')): {}
}


export default State

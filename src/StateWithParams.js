/*
* Creates a new StateWithParams instance.
*
* StateWithParams is the merge between a State object (created and added to the router before init)
* and params (both path and query params, extracted from the URL after init)
*
* This is an internal model The public model is the asPublic property.
*/
export default function StateWithParams(state, params, pathQuery, diff) {
  return {
    state,
    params,
    toString,
    asPublic: makePublicAPI(state, params, pathQuery, diff)
  }
}

function makePublicAPI(state, params, pathQuery, paramsDiff) {

  /*
  * Returns whether this state or any of its parents has the given fullName.
  */
  function isIn(fullStateName) {
    let current = state
    while (current) {
      if (current.fullName == fullStateName) return true
      current = current.parent
    }
    return false
  }

  return {
    uri: pathQuery,
    params,
    paramsDiff,
    name: state ? state.name : '',
    fullName: state ? state.fullName : '',
    data: state ? state.data : {},
    isIn
  }
}

function toString() {
  const name = this.state && this.state.fullName
  return name + ':' + JSON.stringify(this.params)
}


'use strict';


/*
* Creates a new StateWithParams instance.
*
* StateWithParams is the merge between a State object (created and added to the router before init)
* and params (both path and query params, extracted from the URL after init)
*
* This is an internal model; The public model is the asPublic property.
*/
function StateWithParams(state, params, pathQuery) {
  return {
    state: state,
    params: params,
    toString: toString,
    asPublic: makePublicAPI(state, params, pathQuery)
  };
}

function makePublicAPI(state, params, pathQuery) {

  /*
  * Returns whether this state or any of its parents has the given fullName.
  */
  function isIn(fullStateName) {
    var current = state;
    while (current) {
      if (current.fullName == fullStateName) return true;
      current = current.parent;
    }
    return false;
  }

  return {
    uri: pathQuery,
    params: params,
    name: state ? state.name : '',
    fullName: state ? state.fullName : '',
    data: state ? state.data : null,
    isIn: isIn,
  };
}

function toString() {
  var name = this.state && this.state.fullName;
  return name + ':' + JSON.stringify(this.params)
}


module.exports = StateWithParams;
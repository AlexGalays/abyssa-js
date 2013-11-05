
var when = require('when');

/*
* Create a new Transition instance.
*/
function Transition(fromStateWithParams, toStateWithParams, paramDiff) {
  var root,
      cancelled,
      enters,
      transitionPromise,
      error,
      exits = [];

  var fromState = fromStateWithParams && fromStateWithParams._state;
  var toState = toStateWithParams._state;
  var params = toStateWithParams.params;
  var paramOnlyChange = (fromState == toState);

  var transition = {
    from: fromState,
    to: toState,
    toParams: params,
    then: then,
    cancel: cancel,
    cancelled: cancelled,
    currentState: fromState
  };

  // The first transition has no fromState.
  if (fromState) {
    root = transitionRoot(fromState, toState, paramOnlyChange, paramDiff);
    exits = transitionStates(fromState, root, paramOnlyChange);
  }

  enters = transitionStates(toState, root, paramOnlyChange).reverse();

  transitionPromise = prereqs(enters, exits, params).then(function() {
    if (!cancelled) doTransition(enters, exits, params, transition);
  });

  asyncPromises.newTransitionStarted();

  function then(completed, failed) {
    return transitionPromise.then(
      function success() { if (!cancelled) completed(); },
      function fail(error) { if (!cancelled) failed(error); }
    );
  }

  function cancel() {
    cancelled = transition.cancelled = true;
  }

  return transition;
}

/*
* Return the promise of the prerequisites for all the states involved in the transition.
*/
function prereqs(enters, exits, params) {

  exits.forEach(function(state) {
    if (!state.exitPrereqs) return;

    var prereqs = state._exitPrereqs = when(state.exitPrereqs()).then(
      function success(value) {
        if (state._exitPrereqs == prereqs) state._exitPrereqs.value = value;
      },
      function fail(cause) {
        throw new Error('Failed to resolve EXIT prereqs of ' + state.fullName);
      }
    );
  });

  enters.forEach(function(state) {
    if (!state.enterPrereqs) return;

    var prereqs = state._enterPrereqs = when(state.enterPrereqs(params)).then(
      function success(value) {
        if (state._enterPrereqs == prereqs) state._enterPrereqs.value = value;
      },
      function fail(cause) {
        throw new Error('Failed to resolve ENTER prereqs of ' + state.fullName);
      }
    );
  });

  return when.all(enters.concat(exits).map(function(state) {
    return state._enterPrereqs || state._exitPrereqs;
  }));
}

function doTransition(enters, exits, params, transition) {
  exits.forEach(function(state) {
    state.exit(state._exitPrereqs && state._exitPrereqs.value);
  });

  // Async promises are only allowed in 'enter' hooks.
  // Make it explicit to prevent programming errors.
  asyncPromises.allowed = true;

  enters.forEach(function(state) {
    if (!transition.cancelled) {
      transition.currentState = state;
      state.enter(params, state._enterPrereqs && state._enterPrereqs.value);
    }
  });

  asyncPromises.allowed = false;
}

/*
* The top-most current state's parent that must be exited.
*/
function transitionRoot(fromState, toState, paramOnlyChange, paramDiff) {
  var root,
      parent,
      param;

  // For a param-only change, the root is the top-most state owning the param(s),
  if (paramOnlyChange) {
    fromState.parents.slice().reverse().forEach(function(parent) {
      for (param in paramDiff) {
        if (parent.params[param] || parent.queryParams[param]) {
          root = parent;
          break;
        }
      }
    });
  }
  // Else, the root is the closest common parent of the two states.
  else {
    for (var i = 0; i < fromState.parents.length; i++) {
      parent = fromState.parents[i];
      if (toState.parents.indexOf(parent) > -1) {
        root = parent;
        break;
      }
    }
  }

  return root;
}

function withParents(state, upTo, inclusive) {
  var p   = state.parents,
      end = Math.min(p.length, p.indexOf(upTo) + (inclusive ? 1 : 0));
  return [state].concat(p.slice(0, end));
}

function transitionStates(state, root, paramOnlyChange) {
  var inclusive = !root || paramOnlyChange;
  return withParents(state, root || state.root, inclusive);
}


var asyncPromises = Transition.asyncPromises = (function () {

  var that;
  var activeDeferreds = [];

  /*
   * Returns a promise that will not be fullfilled if the navigation context
   * changes before the wrapped promise is fullfilled. 
   */
  function register(promise) {
    if (!that.allowed)
      throw new Error('Async can only be called from within state.enter()');

    var defer = when.defer();

    activeDeferreds.push(defer);

    when(promise).then(
      function(value) {
        if (activeDeferreds.indexOf(defer) > -1)
          defer.resolve(value);
      },
      function(error) {
        if (activeDeferreds.indexOf(defer) > -1)
          defer.reject(error);
      }
    );

    return defer.promise;
  }

  function newTransitionStarted() {
    activeDeferreds.length = 0;
  }

  that = {
    register: register,
    newTransitionStarted: newTransitionStarted,
    allowed: false
  };

  return that;

})();


module.exports = Transition;
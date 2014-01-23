
'use strict';


var Q    = require('q'),
    util = require('./util');

/*
* Create a new Transition instance.
*/
function Transition(fromStateWithParams, toStateWithParams, paramDiff, reload) {
  var root,
      cancelled,
      enters,
      transitionPromise,
      error,
      exits = [];

  var fromState = fromStateWithParams && fromStateWithParams.state;
  var toState = toStateWithParams.state;
  var params = toStateWithParams.params;
  var isUpdate = (fromState == toState);

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
    root = reload ? toState.root : transitionRoot(fromState, toState, isUpdate, paramDiff);
    exits = transitionStates(fromState, root, isUpdate);
  }

  enters = transitionStates(toState, root, isUpdate).reverse();

  transitionPromise = prereqs(enters, exits, params, isUpdate).then(function() {
    if (!cancelled) doTransition(enters, exits, params, transition, isUpdate);
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
function prereqs(enters, exits, params, isUpdate) {

  exits.forEach(function(state) {
    if (!state.exitPrereqs || (isUpdate && state.update)) return;

    var prereqs = state._exitPrereqs = Q(state.exitPrereqs()).then(
      function success(value) {
        if (state._exitPrereqs == prereqs) state._exitPrereqs.value = value;
      },
      function fail(cause) {
        var message = util.makeMessage('Failed to resolve EXIT prereqs of "{0}"', state.fullName);
        throw TransitionError(message, cause);
      }
    );
  });

  enters.forEach(function(state) {
    if (!state.enterPrereqs || (isUpdate && state.update)) return;

    var prereqs = state._enterPrereqs = Q(state.enterPrereqs(params)).then(
      function success(value) {
        if (state._enterPrereqs == prereqs) state._enterPrereqs.value = value;
      },
      function fail(cause) {
        var message = util.makeMessage('Failed to resolve ENTER prereqs of "{0}"', state.fullName);
        throw TransitionError(message, cause);
      }
    );
  });

  return Q.all(enters.concat(exits).map(function(state) {
    return state._enterPrereqs || state._exitPrereqs;
  }));
}

function doTransition(enters, exits, params, transition, isUpdate) {
  exits.forEach(function(state) {
    if (isUpdate && state.update) return;
    state.exit(state._exitPrereqs && state._exitPrereqs.value);
  });

  enters.forEach(function(state) {
    if (transition.cancelled) return;

    transition.currentState = state;

    if (isUpdate && state.update)
      state.update(params);
    else {
      state.enter(params, state._enterPrereqs && state._enterPrereqs.value);
      if (state.update) state.update(params);
    }
  });
}

/*
* The top-most current state's parent that must be exited.
*/
function transitionRoot(fromState, toState, isUpdate, paramDiff) {
  var root,
      parent,
      param;

  // For a param-only change, the root is the top-most state owning the param(s),
  if (isUpdate) {
    [fromState].concat(fromState.parents).reverse().forEach(function(parent) {
      if (root) return;

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

function transitionStates(state, root, isUpdate) {
  var inclusive = !root || isUpdate;
  return withParents(state, root || state.root, inclusive);
}

function TransitionError(message, cause) {
  var error = new Error(message);
  error.isTransitionError = true;
  error.cause = cause;

  error.toString = function() {
    return util.makeMessage('{0} (cause: {1})', message, cause);
  };

  return error;
}


var asyncPromises = Transition.asyncPromises = (function () {

  var that;
  var activeDeferreds = [];

  /*
   * Returns a promise that will not be fullfilled if the navigation context
   * changes before the wrapped promise is fullfilled. 
   */
  function register(promise) {
    var defer = Q.defer();

    activeDeferreds.push(defer);

    Q(promise).then(
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
  };

  return that;

})();


module.exports = Transition;
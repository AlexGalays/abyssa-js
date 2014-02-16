
'use strict';


var Q    = require('q'),
    util = require('./util');

/*
* Create a new Transition instance.
*/
function Transition(fromStateWithParams, toStateWithParams, paramDiff, reload, logger) {
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

  asyncPromises.newTransitionStarted();

  transitionPromise = isNullTransition(isUpdate, reload, paramDiff)
    ? Q('null')
    : startTransition(enters, exits, params, transition, isUpdate, logger);

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
* Whether there is no need to actually perform a transition.
*/
function isNullTransition(isUpdate, reload, paramDiff) {
  return (isUpdate && !reload && util.objectSize(paramDiff) == 0);
}

function startTransition(enters, exits, params, transition, isUpdate, logger) {
  var promise = Q();

  exits.forEach(function(state) {
    if (isUpdate && state.update) return;
    promise = promise.then(call(state, 'exit'));
  });

  enters.forEach(function(state) {
    var fn = (isUpdate && state.update) ? 'update' : 'enter';
    promise = promise.then(call(state, fn));
  });

  function call(state, fn) {
    return function(value) {
      checkCancellation();

      if (logger.enabled) {
        var capitalizedStep = fn[0].toUpperCase() + fn.slice(1);
        logger.log(capitalizedStep + ' ' + state.fullName);
      }

      var result = state[fn](params, value);

      checkCancellation();

      // If the current function doesn't return anything useful,
      // use the last known value for propagation purpose.
      if (result === undefined) result = value;

      transition.currentState = (fn == 'exit') ? state.parent : state;

      return result;
    };
  }

  function checkCancellation() {
    if (transition.cancelled)
      throw new Error('transition cancelled');
  }

  return promise;
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
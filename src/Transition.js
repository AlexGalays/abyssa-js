
'use strict';

var util = require('./util');

/*
* Create a new Transition instance.
*/
function Transition(fromStateWithParams, toStateWithParams, paramsDiff, reload, logger) {
  var root,
      enters,
      error,
      exits = [];

  var fromState = fromStateWithParams && fromStateWithParams.state;
  var toState = toStateWithParams.state;
  var params = toStateWithParams.params;
  var isUpdate = (fromState == toState);
  var callUpdates = isUpdate && !reload;

  var transition = {
    from: fromState,
    to: toState,
    toParams: params,
    cancel: cancel,
    cancelled: false,
    currentState: fromState,
    start: start
  };

  // The first transition has no fromState.
  if (fromState) {
    root = reload ? toState.root : transitionRoot(fromState, toState, isUpdate, paramsDiff);
    exits = transitionStates(fromState, root, isUpdate);
  }

  enters = transitionStates(toState, root, isUpdate).reverse();

  function start() {
    if (!isNullTransition(isUpdate, reload, paramsDiff))
      startTransition(enters, exits, params, transition, callUpdates, logger);
  }

  function cancel() {
    transition.cancelled = true;
  }

  return transition;
}

/*
* Whether there is no need to actually perform a transition.
*/
function isNullTransition(isUpdate, reload, paramsDiff) {
  return (isUpdate && !reload && util.objectSize(paramsDiff.all) == 0);
}

function startTransition(enters, exits, params, transition, isUpdate, logger) {
  exits.forEach(function(state) {
    if (isUpdate && state.update) return;
    runStep(state, 'exit', params, transition, logger);
  });

  enters.forEach(function(state) {
    var fn = (isUpdate && state.update) ? 'update' : 'enter';
    runStep(state, fn, params, transition, logger);
  });
}

function runStep(state, stepFn, params, transition, logger) {
  if (transition.cancelled) return;

  if (logger.enabled) {
    var capitalizedStep = stepFn[0].toUpperCase() + stepFn.slice(1);
    logger.log(capitalizedStep + ' ' + state.fullName);
  }

  var result = state[stepFn](params);

  if (transition.cancelled) return;

  transition.currentState = (stepFn == 'exit') ? state.parent : state;

  return result;
}

/*
* The top-most current state's parent that must be exited.
*/
function transitionRoot(fromState, toState, isUpdate, paramsDiff) {
  var root,
      parent,
      param;

  // For a param-only change, the root is the top-most state owning the param(s),
  if (isUpdate) {
    [fromState].concat(fromState.parents).reverse().forEach(function(parent) {
      if (root) return;

      for (param in paramsDiff.all) {
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


module.exports = Transition;

/**
 * Creates a new Transition instance.
 *
 * @param {Abyssa.State} fromState The original state.
 * @param {Abyssa.State} toState The target state.
 * @param {Object} fromParams The original params.
 * @param {Object} toParams The target params.
 * @return {Abyssa.Transition}
 */
function Transition(fromState, toState, fromParams, toParams) {
  var root,
      cancelled,
      enters,
      transition,
      exits = [],
      paramDiff = getParamDiff(fromParams, toParams),
      paramOnlyChange = (fromState === toState);

  // The first transition has no fromState.
  if (fromState) {
    root = transitionRoot(fromState, toState, paramOnlyChange, paramDiff);
    exits = transitionStates(fromState, root, paramOnlyChange);
  }

  enters = transitionStates(toState, root, paramOnlyChange).reverse();

  transition = prereqs(enters, exits, toParams).then(function() {
    if (!cancelled) doTransition(enters, exits, toParams);
  });

  asyncPromises.newTransitionStarted();

  function then(completed, failed) {
    return transition.then(
      function success() { if (!cancelled) completed(); },
      function fail(error) { if (!cancelled) failed(error); }
    );
  }

  function cancel() {
    cancelled = true;
  }

  return {
    from: fromState,
    fromParams: fromParams,
    to: toState,
    toParams: toParams,
    then: then,
    cancel: cancel
  };
}

/**
 * Returns the promise of the prerequisites for all the states involved in the transition.
 * 
 * @param {Array} enters The set of states that are entered.
 * @param {Array} exits The set of states that are exited.
 * @param {Object} params The params for the next state.
 * @param {Promise}
 */
function prereqs(enters, exits, params) {

  exits.forEach(function(state) {
    if (!state.exitPrereqs) return;

    var prereqs = state._exitPrereqs = whenTryCatch(function () { return state.exitPrereqs(); }).then(
      function success(value) {
        if (state._exitPrereqs === prereqs) state._exitPrereqs.value = value;
      },
      function fail(cause) {
        var error = new Error('Failed to resolve EXIT prereqs of state "' + state.fullName + '"');
        error.inner = cause;
        throw error;
      }
    );
  });

  enters.forEach(function(state) {
    if (!state.enterPrereqs) return;

    var prereqs = state._enterPrereqs = whenTryCatch(function () { return state.enterPrereqs(params); }).then(
      function success(value) {
        if (state._enterPrereqs === prereqs) state._enterPrereqs.value = value;
      },
      function fail(cause) {
        var error = new Error('Failed to resolve ENTER prereqs of state "' + state.fullName + '"');
        error.inner = cause;
        throw error;
      }
    );
  });

  return when.all(enters.concat(exits).map(function(state) {
    return state._enterPrereqs || state._exitPrereqs;
  }));
}

function doTransition(enters, exits, params) {
  exits.forEach(function(state) {
    state.exit(state._exitPrereqs && state._exitPrereqs.value);
  });

  asyncPromises.allowed = true;
  enters.forEach(function(state) {
    state.enter(params, state._enterPrereqs && state._enterPrereqs.value);
  });
  asyncPromises.allowed = false;
}

/**
 * Finds the top-most current state's parent that must be exited.
 *
 * @param {Abyssa.State} fromState The original state.
 * @param {Abyssa.State} toState The target state.
 * @param {Boolean} paramOnlyChange Whether the states are equal, so only the params have changed.
 * @param {Object} paramDiff The difference between the params of the original and target state.
 * @return {Abyssa.State}
 */
function transitionRoot(fromState, toState, paramOnlyChange, paramDiff) {
  var root,
      parent;

  // For a param-only change, the root is the top-most state owning the param(s),
  if (paramOnlyChange) {
    fromState.parents.slice().reverse().forEach(function(parent) {
      for (var param in paramDiff) {
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


var asyncPromises = (function () {

  var that;
  var activeDeferreds = [];

  /**
   * Returns a promise that will not be fullfilled if the navigation context
   * changes before the wrapped promise is fullfilled.
   *
   * @param {Promise}
   * @return {Promise}
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


Abyssa.Async = asyncPromises.register;

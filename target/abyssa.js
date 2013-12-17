/* abyssa 3.0.1 - A stateful router library for single page applications */

!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.Abyssa=e():"undefined"!=typeof global?global.Abyssa=e():"undefined"!=typeof self&&(self.Abyssa=e())}(function(){var define,module,exports;
return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){

'use strict';


var Signal = require('signals').Signal,
    crossroads = require('crossroads'),

    interceptAnchorClicks = require('./anchorClicks'),
    StateWithParams = require('./StateWithParams'),
    Transition = require('./Transition'),
    util = require('./util');

/*
* Create a new Router instance, passing any state defined declaratively.
* More states can be added using addState() before the router is initialized.
*
* Because a router manages global state (the URL), only one instance of Router
* should be used inside an application.
*/
function Router(declarativeStates) {
  var router = {},
      states = util.copyObject(declarativeStates),
      roads  = crossroads.create(),
      firstTransition = true,
      initOptions = {
        enableLogs: false,
        interceptAnchorClicks: true
      },
      ignoreNextPopState = false,
      currentPathQuery,
      currentState,
      transition,
      leafStates,
      stateFound,
      poppedState,
      initialized;

  // Routes params should be type casted. e.g the dynamic path items/:id when id is 33
  // will end up passing the integer 33 as an argument, not the string "33".
  roads.shouldTypecast = true;
  // Nil transitions are prevented from our side.
  roads.ignoreState = true;

  /*
  * Setting a new state will start a transition from the current state to the target state.
  * A successful transition will result in the URL being changed.
  * A failed transition will leave the router in its current state.
  */
  function setState(state, params, reload) {
    if (!reload && isSameState(state, params)) return;

    var fromState;
    var toState = StateWithParams(state, params);

    if (transition) {
      cancelTransition();
      fromState = StateWithParams(transition.currentState, transition.toParams);
    }
    else {
      fromState = currentState;
    }

    // While the transition is running, any code asking the router about the current state should
    // get the end result state. The currentState is rollbacked if the transition fails.
    currentState = toState;
    currentState._pathQuery = currentPathQuery;

    // A state was popped and the browser already changed the URL as a result;
    // Revert the URL to its previous value and actually change it after a successful transition.
    if (poppedState) replaceState(
      fromState._pathQuery, document.title, fromState._pathQuery);

    startingTransition(fromState, toState);

    transition = Transition(
      fromState,
      toState,
      paramDiff(fromState && fromState.params, params),
      reload);

    transition.then(
      function success() {
        transition = null;

        if (!poppedState && !firstTransition && !reload) {
          log('Pushing state: {0}', currentPathQuery);
          pushState(currentPathQuery, document.title, currentPathQuery);
        }

        if (poppedState) replaceState(
          currentState._pathQuery, document.title, currentState._pathQuery);

        transitionCompleted(fromState, toState);
      },
      function fail(error) {
        transition = null;
        currentState = fromState;

        transitionFailed(fromState, toState, error);
      }
    )
    .otherwise(transitionError);
  }

  function cancelTransition() {
    log('Cancelling existing transition from {0} to {1}',
      transition.from, transition.to);

    transition.cancel();
    firstTransition = false;

    router.transition.cancelled.dispatch(transition.to, transition.from);
  }

  function startingTransition(fromState, toState) {
    log('Starting transition from {0} to {1}', fromState, toState);

    router.transition.started.dispatch(toState, fromState);
  }

  function transitionCompleted(fromState, toState) {
    log('Transition from {0} to {1} completed', fromState, toState);

    firstTransition = false;

    toState._state.lastParams = toState.params;

    router.transition.completed.dispatch(toState, fromState);
  }

  function transitionFailed(fromState, toState, error) {
    logError('Transition from {0} to {1} failed: {2}', fromState, toState, error);
    router.transition.failed.dispatch(toState, fromState);
    throw error;
  }

  function transitionError(error) {
    // Transition errors are not fatal, so just log them.
    if (error.isTransitionError)
      return logError(error);

    // For developer errors, rethrow the error outside
    // of the promise context to retain the script and line of the error.
    setTimeout(function() { throw error; }, 0);
  }

  // Workaround for https://github.com/devote/HTML5-History-API/issues/44
  function replaceState(state, title, url) {
    if (history.emulate) ignoreNextPopState = true;
    history.replaceState(state, title, url);
  }

  // Workaround for https://github.com/devote/HTML5-History-API/issues/44
  function pushState(state, title, url) {
    if (history.emulate) ignoreNextPopState = true;
    history.pushState(state, title, url);
  }

  /*
  * Return whether the passed state is the same as the current one;
  * in which case the router can ignore the change.
  */
  function isSameState(newState, newParams) {
    var state, params, diff;

    if (transition) {
      state = transition.to;
      params = transition.toParams;
    }
    else if (currentState) {
      state = currentState._state;
      params = currentState.params;
    }

    diff = paramDiff(params, newParams);

    return (newState == state) && (util.objectSize(diff) == 0);
  }

  /*
  * Return the set of all the params that changed (Either added, removed or changed).
  */
  function paramDiff(oldParams, newParams) {
    var diff = {},
        oldParams = oldParams || {};

    for (var name in oldParams)
      if (oldParams[name] != newParams[name]) diff[name] = 1;

    for (var name in newParams)
      if (oldParams[name] != newParams[name]) diff[name] = 1;

    return diff;
  }

  /*
  * The state wasn't found;
  * Transition to the 'notFound' state if the developer specified it or else throw an error.
  */
  function notFound(state) {
    log('State not found: {0}', state);

    if (initOptions.notFound) setState(initOptions.notFound);
    else throw new Error ('State "' + state + '" could not be found');
  }

  /*
  * Configure the router before its initialization.
  * The available options are:
  *   enableLogs: Whether (debug and error) console logs should be enabled. Defaults to false.
  *   interceptAnchorClicks: Whether anchor clicks should be intercepted and trigger a state change. Defaults to true.
  *   notFound: The State to enter when no state matching the current path query or name could be found. Defaults to null.
  */
  function configure(options) {
    util.mergeObjects(initOptions, options);
    return router;
  }

  /*
  * Initialize and freeze the router (states can not be added afterwards).
  * The router will immediately initiate a transition to, in order of priority:
  * 1) The init state passed as an argument
  * 2) The state captured by the current URL
  */
  function init(initState, initParams) {
    if (initOptions.enableLogs)
      Router.enableLogs();

    if (initOptions.interceptAnchorClicks)
      interceptAnchorClicks(router);

    log('Router init');
    initStates();

    initState = (initState !== undefined) ? initState : urlPathQuery();

    log('Initializing to state {0}', initState || '""');
    state(initState, initParams);

    window.onpopstate = function(evt) {
      if (ignoreNextPopState) {
        ignoreNextPopState = false;
        return;
      }

      // history.js will dispatch fake popstate events on HTML4 browsers' hash changes; 
      // in these cases, evt.state is null.
      var newState = evt.state || urlPathQuery();

      log('Popped state: {0}', newState);
      poppedState = true;
      setStateForPathQuery(newState);
    };

    initialized = true;
    return router;
  }

  function initStates() {
    eachRootState(function(name, state) {
      state.init(router, name);
    });

    if (initOptions.notFound)
      initOptions.notFound.init('notFound');

    leafStates = {};

    // Only leaf states can be transitioned to.
    eachLeafState(function(state) {
      leafStates[state.fullName] = state;

      state.route = roads.addRoute(state.fullPath() + ":?query:");
      state.route.matched.add(function() {
        stateFound = true;
        setState(state, fromCrossroadsParams(state, arguments));
      });
    });
  }

  function eachRootState(callback) {
    for (var name in states) callback(name, states[name]);
  }

  function eachLeafState(callback) {
    var name, state;

    function callbackIfLeaf(states) {
      states.forEach(function(state) {
        if (state.children.length)
          callbackIfLeaf(state.children);
        else
          callback(state);
      });
    }

    callbackIfLeaf(util.objectToArray(states));
  }

  /*
  * Request a programmatic state change.
  *
  * Two notations are supported:
  * state('my.target.state', {id: 33, filter: 'desc'})
  * state('target/33?filter=desc')
  */
  function state(pathQueryOrName, params) {
    var isName = leafStates[pathQueryOrName] !== undefined;

    log('Changing state to {0}', pathQueryOrName || '""');

    poppedState = false;
    if (isName) setStateByName(pathQueryOrName, params || {});
    else setStateForPathQuery(pathQueryOrName);
  }

  /*
  * An alias of 'state'. You can use 'redirect' when it makes more sense semantically.
  */
  function redirect(pathQueryOrName, params) {
    log('Redirecting...');
    state(pathQueryOrName, params);
  }

  /*
  * Attempt to navigate to 'stateName' with its previous params or 
  * fallback to the defaultParams parameter if the state was never entered.
  */
  function backTo(stateName, defaultParams) {
    var params = leafStates[stateName].lastParams || defaultParams;
    state(stateName, params);
  }

  /*
  * Reload the current state with its current params.
  * All states up to the root are exited then reentered.  
  * This can be useful when some internal state not captured in the url changed 
  * and the current state should update because of it.
  */
  function reload() {
    setState(currentState._state, currentState.params, true);
  }

  function setStateForPathQuery(pathQuery) {
    currentPathQuery = util.normalizePathQuery(pathQuery);
    stateFound = false;
    roads.parse(currentPathQuery);

    if (!stateFound) notFound(currentPathQuery);
  }

  function setStateByName(name, params) {
    var state = leafStates[name];

    if (!state) return notFound(name);

    var pathQuery = state.route.interpolate(toCrossroadsParams(state, params));
    setStateForPathQuery(pathQuery);
  }

  /*
  * Add a new root state to the router.
  * The name must be unique among root states.
  */
  function addState(name, state) {
    if (initialized)
      throw new Error('States can only be added before the Router is initialized');

    if (states[name])
      throw new Error('A state already exist in the router with the name ' + name);

    log('Adding state {0}', name);

    states[name] = state;

    return router;
  }

  function urlPathQuery() {
    var hashSlash = location.href.indexOf('#/');
    var pathQuery = hashSlash > -1
      ? location.href.slice(hashSlash + 2)
      : (location.pathname + location.search).slice(1);

    return util.normalizePathQuery(pathQuery);
  }

  /*
  * Translate the crossroads argument format to what we want to use.
  * We want to keep the path and query names and merge them all in one object for convenience.
  */
  function fromCrossroadsParams(state, crossroadsArgs) {
    var args   = Array.prototype.slice.apply(crossroadsArgs),
        query  = args.pop(),
        params = {},
        pathName;

    state.fullPath().replace(/\{\w*\}/g, function(match) {
      pathName = match.slice(1, -1);
      params[pathName] = args.shift();
      return '';
    });

    if (query) util.mergeObjects(params, query);

    // Decode all params
    for (var i in params) {
      if (util.isString(params[i])) params[i] = decodeURIComponent(params[i]);
    }

    return params;
  }

  /*
  * Translate an abyssa-style params object to a crossroads one.
  */
  function toCrossroadsParams(state, abyssaParams) {
    var params = {};

    for (var key in abyssaParams) {
      if (state.queryParams[key]) {
        params.query = params.query || {};
        params.query[key] = abyssaParams[key];
      } else {
        params[key] = abyssaParams[key];
      }
    }

    return params;
  }

  /*
  * Compute a link that can be used in anchors' href attributes
  * from a state name and a list of params, a.k.a reverse routing.
  */
  function link(stateName, params) {
    var query = {},
        allQueryParams = {},
        hasQuery = false,
        state = leafStates[stateName];

    if (!state) throw new Error('Cannot find state ' + stateName);

    [state].concat(state.parents).forEach(function(s) {
      util.mergeObjects(allQueryParams, s.queryParams);
    });

    // The passed params are path and query params lumped together,
    // Separate them for crossroads' to compute its interpolation.
    for (var key in params) {
      if (allQueryParams[key]) {
        query[key] = params[key];
        delete params[key];
        hasQuery = true;
      }
    }

    if (hasQuery) params.query = query;

    return util.normalizePathQuery(state.route.interpolate(params));
  }

  /*
  * Returns a StateWithParams object representing the current state of the router.
  */
  function getCurrentState() {
    return currentState;
  }


  // Public methods

  router.configure = configure;
  router.init = init;
  router.state = state;
  router.redirect = redirect;
  router.backTo = backTo;
  router.reload = reload;
  router.addState = addState;
  router.link = link;
  router.currentState = getCurrentState;
  router.urlPathQuery = urlPathQuery;


  // Signals

  router.transition = {
    // Dispatched when a transition started.
    started:   new Signal(),
    // Dispatched when a transition either completed, failed or got cancelled.
    ended:     new Signal(),
    // Dispatched when a transition successfuly completed
    completed: new Signal(),
    // Dispatched when a transition failed to complete
    failed:    new Signal(),
    // Dispatched when a transition got cancelled
    cancelled: new Signal()
  };

  // Dispatched once after the router successfully reached its initial state.
  router.initialized = new Signal();

  // Shorter alias for transition.completed: The most commonly used signal
  router.changed = router.transition.completed;

  router.transition.completed.addOnce(function() {
    router.initialized.dispatch();
  });

  router.transition.completed.add(transitionEnded);
  router.transition.failed.add(transitionEnded);
  router.transition.cancelled.add(transitionEnded);

  function transitionEnded(newState, oldState) {
    router.transition.ended.dispatch(newState, oldState);
  }

  return router;
}


// Logging

var log = util.noop,
    logError = util.noop;

Router.enableLogs = function() {
  log = function() {
    var message = util.makeMessage.apply(null, arguments);
    console.log(message);
  };

  logError = function() {
    var message = util.makeMessage.apply(null, arguments);
    console.error(message);
  };
};


module.exports = Router;
},{"./StateWithParams":4,"./Transition":5,"./anchorClicks":6,"./util":8,"crossroads":1,"signals":1}],3:[function(require,module,exports){

'use strict';


var util = require('./util');
var async = require('./Transition').asyncPromises.register;

/*
* Create a new State instance.
*
* State() // A state without options and an empty path.
* State('path', {options}) // A state with a static named path and options
* State(':path', {options}) // A state with a dynamic named path and options
* State('path?query', {options}) // Same as above with an optional query string param named 'query'
* State({options}) // Its path is the empty string.
*
* options is an object with the following optional properties:
* enter, exit, enterPrereqs, exitPrereqs.
*
* Child states can also be specified in the options:
* State({ myChildStateName: State() })
* This is the declarative equivalent to the addState method.
*
* Finally, options can contain any arbitrary data value
* that will get stored in the state and made available via the data() method:
* State({myData: 55})
* This is the declarative equivalent to the data(key, value) method.
*/
function State() {
  var state    = { _isState: true },
      args     = getArgs(arguments),
      options  = args.options,
      states   = getStates(args.options),
      initialized;


  state.path = args.path;
  state.params = args.params;
  state.queryParams = args.queryParams;
  state.states = states;

  state.enter = options.enter || util.noop;
  state.exit = options.exit || util.noop;
  state.enterPrereqs = options.enterPrereqs;
  state.exitPrereqs = options.exitPrereqs;

  state.ownData = getOwnData(options);

  /*
  * Initialize and freeze this state.
  */
  function init(router, name, parent) {
    state.router = router;
    state.name = name;
    state.parent = parent;
    state.parents = getParents();
    state.root = state.parent ? state.parents[state.parents.length - 1] : state;
    state.children = getChildren();
    state.fullName = getFullName();
    state.root = state.parents[state.parents.length - 1];
    state.async = async;

    eachChildState(function(name, childState) {
      childState.init(router, name, state);
    });

    initialized = true;
  }

  /*
  * The full path, composed of all the individual paths of this state and its parents.
  */
  function fullPath() {
    var result      = state.path,
        stateParent = state.parent;

    while (stateParent) {
      if (stateParent.path) result = stateParent.path + '/' + result;
      stateParent = stateParent.parent;
    }

    return result;
  }

  /*
  * The list of all parents, starting from the closest ones.
  */
  function getParents() {
    var parents = [],
        parent  = state.parent;

    while (parent) {
      parents.push(parent);
      parent = parent.parent;
    }

    return parents;
  }

  /*
  * The list of child states as an Array.
  */
  function getChildren() {
    var children = [];

    for (var name in states) {
      children.push(states[name]);
    }

    return children;
  }

  /*
  * The map of initial child states by name.
  */
  function getStates(options) {
    var states = {};

    for (var key in options) {
      if (options[key]._isState) states[key] = options[key];
    }

    return states;
  }

  /*
  * The fully qualified name of this state.
  * e.g granparentName.parentName.name
  */
  function getFullName() {
    return state.parents.reduceRight(function(acc, parent) {
      return acc + parent.name + '.';
    }, '') + state.name;
  }

  function getOwnData(options) {
    var reservedKeys = {'enter': 1, 'exit': 1, 'enterPrereqs': 1, 'exitPrereqs': 1},
        result = {};

    for (var key in options) {
      if (reservedKeys[key] || options[key]._isState) continue;
      result[key] = options[key];
    }

    return result;
  }

  /*
  * Get or Set some arbitrary data by key on this state.
  * child states have access to their parents' data.
  *
  * This can be useful when using external models/services
  * as a mean to communicate between states is not desired.
  */
  function data(key, value) {
    if (value !== undefined) {
      state.ownData[key] = value;
      return state;
    }

    var currentState = state;

    while (currentState.ownData[key] === undefined && currentState.parent)
      currentState = currentState.parent;

    return currentState.ownData[key];
  }

  function eachChildState(callback) {
    for (var name in states) callback(name, states[name]);
  }

  /*
  * Add a child state.
  */
  function addState(name, childState) {
    if (initialized)
      throw new Error('States can only be added before the Router is initialized');

    if (states[name])
      throw new Error('The state {0} already has a child state named {1}'
        .replace('{0}', state.name)
        .replace('{1}', name)
      );

    states[name] = childState;

    return state;
  };

  function toString() {
    return state.fullName;
  }


  state.init = init;
  state.fullPath = fullPath;

  // Public methods

  state.data = data;
  state.addState = addState;
  state.toString = toString;

  return state;
}


// Extract the arguments of the overloaded State "constructor" function.
function getArgs(args) {
  var result  = { path: '', options: {}, params: {}, queryParams: {} },
      arg1    = args[0],
      arg2    = args[1],
      queryIndex,
      param;

  if (args.length == 1) {
    if (util.isString(arg1)) result.path = arg1;
    else result.options = arg1;
  }
  else if (args.length == 2) {
    result.path = arg1;
    result.options = (typeof arg2 == 'object') ? arg2 : {enter: arg2};
  }

  // Extract the query string
  queryIndex = result.path.indexOf('?');
  if (queryIndex != -1) {
    result.queryParams = result.path.slice(queryIndex + 1);
    result.path = result.path.slice(0, queryIndex);
    result.queryParams = util.arrayToObject(result.queryParams.split('&'));
  }

  // Replace dynamic params like :id with {id}, which is what crossroads uses,
  // and store them for later lookup.
  result.path = result.path.replace(/:\w*/g, function(match) {
    param = match.substring(1);
    result.params[param] = 1;
    return '{' + param + '}';
  });

  return result;
}


module.exports = State;
},{"./Transition":5,"./util":8}],4:[function(require,module,exports){

'use strict';


/*
* Creates a new StateWithParams instance.
*
* StateWithParams is the merge between a State object (created and added to the router before init)
* and params (both path and query params, extracted from the URL after init)
*/
function StateWithParams(state, params) {
  return {
    _state: state,
    name: state && state.name,
    fullName: state && state.fullName,
    data: state && state.data,
    params: params,
    is: is,
    isIn: isIn,
    toString: toString
  };
}

/*
* Returns whether this state has the given fullName.
*/
function is(fullStateName) {
  return this.fullName == fullStateName;
}

/*
* Returns whether this state or any of its parents has the given fullName.
*/
function isIn(fullStateName) {
  var current = this._state;
  while (current) {
    if (current.fullName == fullStateName) return true;
    current = current.parent;
  }
  return false;
}

function toString() {
  return this.fullName + ':' + JSON.stringify(this.params)
}


module.exports = StateWithParams;
},{}],5:[function(require,module,exports){

'use strict';


var when = require('when'),
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
    root = reload ? toState.root : transitionRoot(fromState, toState, paramOnlyChange, paramDiff);
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
        var message = util.makeMessage('Failed to resolve EXIT prereqs of "{0}"', state.fullName);
        throw TransitionError(message, cause);
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
        var message = util.makeMessage('Failed to resolve ENTER prereqs of "{0}"', state.fullName);
        throw TransitionError(message, cause);
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

function transitionStates(state, root, paramOnlyChange) {
  var inclusive = !root || paramOnlyChange;
  return withParents(state, root || state.root, inclusive);
}

function TransitionError(message, cause) {
  return {
    message: message,
    isTransitionError: true,
    toString: function() {
      return util.makeMessage('{0} (cause: {1})', message, cause);
    }
  };
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
},{"./util":8,"when":1}],6:[function(require,module,exports){

'use strict';


var ieButton, router;

function anchorClickHandler(evt) {
  evt = evt || window.event;

  var defaultPrevented = ('defaultPrevented' in evt)
    ? evt.defaultPrevented
    : (evt.returnValue === false);

  if (defaultPrevented || evt.metaKey || evt.ctrlKey || !isLeftButtonClick(evt)) return;

  var target = evt.target || evt.srcElement;
  var anchor = anchorTarget(target);
  if (!anchor) return;

  var href = anchor.getAttribute('href');

  if (href.charAt(0) == '#') return;
  if (anchor.getAttribute('target') == '_blank') return;
  if (!isLocalLink(anchor)) return;

  if (evt.preventDefault)
    evt.preventDefault();
  else
    evt.returnValue = false;

  router.state(href);
}

function isLeftButtonClick(evt) {
  evt = evt || window.event;
  var button = (evt.which !== undefined) ? evt.which : ieButton;
  return button == 1;
}

function anchorTarget(target) {
  while (target) {
    if (target.nodeName == 'A') return target;
    target = target.parentNode;
  }
}

// IE does not provide the correct event.button information on 'onclick' handlers 
// but it does on mousedown/mouseup handlers.
function rememberIeButton(evt) {
  ieButton = (evt || window.event).button;
}

function isLocalLink(anchor) {
  var hostname = anchor.hostname;
  var port = anchor.port;

  // IE10 and below can lose the hostname/port property when setting a relative href from JS
  if (!hostname) {
    var tempAnchor = document.createElement("a");
    tempAnchor.href = anchor.href;
    hostname = tempAnchor.hostname;
    port = tempAnchor.port;
  }

  var sameHostname = (hostname == location.hostname);
  var samePort = (port || '80') == (location.port || '80');

  return sameHostname && samePort;
}


module.exports = function interceptAnchorClicks(forRouter) {
  router = forRouter;

  if (document.addEventListener)
    document.addEventListener('click', anchorClickHandler);
  else {
    document.attachEvent('onmousedown', rememberIeButton);
    document.attachEvent('onclick', anchorClickHandler);
  }
};
},{}],7:[function(require,module,exports){

'use strict';

var Abyssa = {
  Router: require('./Router'),
  State:  require('./State'),
  Async:  require('./Transition').asyncPromises.register,

  util:   require('./util')
};

module.exports = Abyssa;
},{"./Router":2,"./State":3,"./Transition":5,"./util":8}],8:[function(require,module,exports){

'use strict';


function isString(instance) {
   return Object.prototype.toString.call(instance) == '[object String]';
}

function noop() {}

function arrayToObject(array) {
  return array.reduce(function(obj, item) {
    obj[item] = 1;
    return obj;
  }, {});
}

function objectToArray(obj) {
  var array = [];
  for (var key in obj) array.push(obj[key]);
  return array;
}

function copyObject(obj) {
  var copy = {};
  for (var key in obj) copy[key] = obj[key];
  return copy;
}

function mergeObjects(to, from) {
  for (var key in from) to[key] = from[key];
}

function objectSize(obj) {
  var size = 0;
  for (var key in obj) size++;
  return size;
}

function makeMessage() {
  var message = arguments[0],
      tokens = Array.prototype.slice.call(arguments, 1);

  for (var i = 0, l = tokens.length; i < l; i++) 
    message = message.replace('{' + i + '}', tokens[i]);

  return message;
}


var LEADING_SLASHES = /^\/+/;
var TRAILING_SLASHES = /^([^?]*?)\/+$/;
var TRAILING_SLASHES_BEFORE_QUERY = /\/+\?/;
function normalizePathQuery(pathQuery) {
  return ('/' + pathQuery
    .replace(LEADING_SLASHES, '')
    .replace(TRAILING_SLASHES, '$1')
    .replace(TRAILING_SLASHES_BEFORE_QUERY, '?'));
}


module.exports = {
  isString: isString,
  noop: noop,
  arrayToObject: arrayToObject,
  objectToArray: objectToArray,
  copyObject: copyObject,
  mergeObjects: mergeObjects,
  objectSize: objectSize,
  makeMessage: makeMessage,
  normalizePathQuery: normalizePathQuery
};
},{}]},{},[7])
(7)
});
;
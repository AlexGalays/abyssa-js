/* abyssa 6.5.0 - A stateful router library for single page applications */

!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.Abyssa=e():"undefined"!=typeof global?global.Abyssa=e():"undefined"!=typeof self&&(self.Abyssa=e())}(function(){var define,module,exports;
return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){

'use strict';


var Signal           = require('signals').Signal,
    crossroads       = require('crossroads'),
    Q                = require('q'),
    interceptAnchors = require('./anchors'),
    StateWithParams  = require('./StateWithParams'),
    Transition       = require('./Transition'),
    util             = require('./util');

/*
* Create a new Router instance, passing any state defined declaratively.
* More states can be added using addState().
*
* Because a router manages global state (the URL), only one instance of Router
* should be used inside an application.
*/
function Router(declarativeStates) {
  var router = {},
      states = util.copyObject(declarativeStates),
      roads  = crossroads.create(),
      firstTransition = true,
      options = {
        enableLogs: false,
        interceptAnchors: true,
        notFound: null,
        urlSync: true
      },
      ignoreNextURLChange = false,
      currentPathQuery,
      currentState,
      previousState,
      transition,
      leafStates,
      urlChanged,
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
    if (!reload && isSameState(state, params))
      return transitionPrevented(currentState);

    var fromState, oldPreviousState;
    var toState = StateWithParams(state, params, currentPathQuery);

    if (transition) {
      cancelTransition();
      fromState = StateWithParams(transition.currentState, transition.toParams);
    }
    else {
      fromState = currentState;
    }

    // While the transition is running, any code asking the router about the previous/current state should
    // get the end result state.
    previousState = currentState;
    currentState = toState;

    var previousTransition = transition;

    var t = transition = Transition(
      fromState,
      toState,
      paramDiff(fromState && fromState.params, params),
      reload,
      logger);

    startingTransition(fromState, toState);

    // setState() was reentered because of a redirect inside a transition.started handler.
    // The end of this method is obsolete.
    if (transition != t) return transitionPromise(transition);

    transition.then(
      function success() {
        finalizeTransition(reload);
        transitionCompleted(fromState, toState);
      },
      function fail(error) {
        currentState = transition.currentState;
        finalizeTransition(reload);
        transitionFailed(fromState, toState, error);
      }
    );

    return transitionPromise(previousTransition || transition);
  }

  /*
  * Returns a promise that should be resolved the next time
  * a transition can complete (so redirects are seen as being part of the same transition)
  */
  function transitionPromise(forTransition) {
    if (forTransition.promise)
      return forTransition.promise;

    var deferred = Q.defer();

    router.transition.completed.addOnce(completed);
    router.transition.failed.addOnce(failed);

    function completed(newState) {
      router.transition.failed.remove(failed);
      deferred.resolve(newState);
    }

    function failed(newState, oldState, error) {
      router.transition.completed.remove(completed);
      deferred.reject(error);
    }

    forTransition.promise = deferred.promise;
    return forTransition.promise;
  }

  function transitionPrevented(toState) {
    router.transition.prevented.dispatch(toState);
    return Q.reject(new Error('prevented'));
  }

  function cancelTransition() {
    logger.log('Cancelling existing transition from {0} to {1}',
      transition.from, transition.to);

    transition.cancel();

    firstTransition = false;

    router.transition.cancelled.dispatch(transition.to, transition.from);
  }

  function startingTransition(fromState, toState) {
    logger.log('Starting transition from {0} to {1}', fromState, toState);

    router.transition.started.dispatch(toState, fromState);
  }

  function transitionCompleted(fromState, toState) {
    logger.log('Transition from {0} to {1} completed', fromState, toState);

    toState.state.lastParams = toState.params;

    router.transition.completed.dispatch(toState, fromState);
  }

  function transitionFailed(fromState, toState, error) {
    logger.error('Transition from {0} to {1} failed: {2}', fromState, toState, error);

    var defaultPrevented;
    function preventDefault() { defaultPrevented = true; }

    router.transition.failed.dispatch(toState, fromState, error, preventDefault);
    if (defaultPrevented) return;

    // Rethrow the error outside
    // of the promise context to retain the script and line of the error.
    setTimeout(function() { throw error; }, 0);
  }

  function finalizeTransition(reload) {
    if (!urlChanged && !firstTransition && !reload) {
      logger.log('Updating URL: {0}', currentPathQuery);
      updateURLFromState(currentPathQuery, document.title, currentPathQuery);
    }

    transition = null;
    firstTransition = false;
    router.flash = null;
  }

  function updateURLFromState(state, title, url) {
    if (!options.urlSync) return;

    // The first check is a workaround for https://github.com/devote/HTML5-History-API/issues/44
    if (history.emulate || isHashMode())
      ignoreNextURLChange = true;

    if (isHashMode())
      location.hash = url;
    else
      history.pushState(state, title, url);
  }

  /*
  * Return whether the passed state is the same as the current one;
  * in which case the router can ignore the change.
  */
  function isSameState(newState, newParams) {
    if (!currentState) return false;

    var diff = paramDiff(currentState.params, newParams);
    return (newState == currentState.state) && (util.objectSize(diff) == 0);
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
    logger.log('State not found: {0}', state);

    if (options.notFound)
      return setState(leafStates[options.notFound] || options.notFound, {});
    else throw new Error ('State "' + state + '" could not be found');
  }

  /*
  * Configure the router before its initialization.
  * The available options are:
  *   enableLogs: Whether (debug and error) console logs should be enabled. Defaults to false.
  *   interceptAnchors: Whether anchor mousedown/clicks should be intercepted and trigger a state change. Defaults to true.
  *   notFound: The State to enter when no state matching the current path query or name could be found. Defaults to null.
  *   urlSync: Whether the router should maintain the current state and the url in sync. Defaults to true.
  */
  function configure(withOptions) {
    util.mergeObjects(options, withOptions);
    return router;
  }

  /*
  * Initialize the router.
  * The router will immediately initiate a transition to, in order of priority:
  * 1) The init state passed as an argument
  * 2) The state captured by the current URL
  */
  function init(initState, initParams) {
    if (options.enableLogs)
      Router.enableLogs();

    if (options.interceptAnchors)
      interceptAnchors(router);

    logger.log('Router init');

    initStates();
    logStateTree();

    initState = (initState !== undefined) ? initState : getInitState();

    logger.log('Initializing to state {0}', initState || '""');
    state(initState, initParams);

    listenToURLChanges();

    initialized = true;
    return router;
  }

  /*
  * Remove any possibility of side effect this router instance might cause.
  * Used for testing purposes.
  */
  function terminate() {
    window.onhashchange = null;
    window.onpopstate = null;
  }

  function listenToURLChanges() {
    if (!options.urlSync) return;

    function onURLChange(evt) {
      if (ignoreNextURLChange) {
        ignoreNextURLChange = false;
        return;
      }

      // history.js will dispatch fake popstate events on HTML4 browsers' hash changes; 
      // in this case, evt.state is null.
      var newState = isHashMode() ? urlPathQuery() : evt.state || urlPathQuery();

      logger.log('URL changed: {0}', newState);
      urlChanged = true;
      setStateForPathQuery(newState);
    }

    window[isHashMode() ? 'onhashchange' : 'onpopstate'] = onURLChange;
  }

  function getInitState() {
    return options.urlSync ? urlPathQuery() : '';
  }

  function initStates() {
    eachRootState(function(name, state) {
      state.init(router, name);
    });

    if (options.notFound && options.notFound.init)
      options.notFound.init('notFound');

    leafStates = {};

    // Only leaf states can be transitioned to.
    addRouteForEachLeafState(states);
  }

  function eachRootState(callback) {
    for (var name in states) callback(name, states[name]);
  }

  function addRouteForEachLeafState(states) {

    function addRoutes(states) {
      states.forEach(function(state) {
        if (state.children.length)
          addRoutes(state.children);
        else
          addRouteForLeafState(state);
      });
    }

    function addRouteForLeafState(state) {
      leafStates[state.fullName] = state;

      var route = roads.addRoute(state.fullPath() + ":?query:");
      state.route = route;
      route.abyssaState = state;
    }

    addRoutes(util.objectToArray(states));
  }

  /*
  * Request a programmatic state change.
  *
  * Two notations are supported:
  * state('my.target.state', {id: 33, filter: 'desc'}, {myFlashData: 10})
  * state('target/33?filter=desc', {myFlashData: 10})
  */
  function state(pathQueryOrName) {
    var isName = leafStates[pathQueryOrName] !== undefined;
    var params = isName ? arguments[1] : null;
    var newFlash = isName ? arguments[2] : arguments[1];

    logger.log('Changing state to {0}', pathQueryOrName || '""');

    if (util.isPlainObject(router.flash) && util.isPlainObject(newFlash)) {
      var merged = {};
      util.mergeObjects(merged, router.flash);
      util.mergeObjects(merged, newFlash);
      newFlash = merged;
    }

    router.flash = newFlash;

    urlChanged = false;

    if (isName)
      return setStateByName(pathQueryOrName, params || {});
    else
      return setStateForPathQuery(pathQueryOrName);
  }

  /*
  * An alias of 'state'. You can use 'redirect' when it makes more sense semantically.
  */
  function redirect() {
    logger.log('Redirecting...');
    return state.apply(null, arguments);
  }

  /*
  * Attempt to navigate to 'stateName' with its previous params or 
  * fallback to the defaultParams parameter if the state was never entered.
  */
  function backTo(stateName, defaultParams, flashData) {
    var params = leafStates[stateName].lastParams || defaultParams;
    return state(stateName, params, flashData);
  }

  /*
  * Reload the current state with its current params.
  * All states up to the root are exited then reentered.  
  * This can be useful when some internal state not captured in the url changed 
  * and the current state should update because of it.
  */
  function reload() {
    return setState(currentState.state, currentState.params, true);
  }

  function setStateForPathQuery(pathQuery) {
    var promise, routeData;

    currentPathQuery = util.normalizePathQuery(pathQuery);

    roads.routed.add(routed);
    roads.parse(currentPathQuery);
    roads.routed.remove(routed);

    function routed(_, data) {
      routeData = data;
    }

    if (routeData)
      promise = setState(
        routeData.route.abyssaState,
        fromCrossroadsParams(routeData.route.abyssaState, routeData.params)) 

    return promise || notFound(currentPathQuery);
  }

  function setStateByName(name, params) {
    var state = leafStates[name];

    if (!state) return notFound(name);

    var pathQuery = interpolate(state, params);
    return setStateForPathQuery(pathQuery);
  }

  /*
  * Add a new root state to the router.
  * The name must be unique among root states.
  */
  function addState(name, state) {
    if (states[name])
      throw new Error('A state already exist in the router with the name ' + name);

    states[name] = state;

    if (initialized) {
      state.init(router, name);
      addRouteForEachLeafState({name: state});
    }

    return router;
  }

  /*
  * Read the path/query from the URL.
  */
  function urlPathQuery() {
    var hashSlash = location.href.indexOf('#/');
    var pathQuery = hashSlash > -1
      ? location.href.slice(hashSlash + 2)
      : (location.pathname + location.search).slice(1);

    return util.normalizePathQuery(pathQuery);
  }

  function isHashMode() {
    return (options.urlSync == 'hash');
  }

  /*
  * Translate the crossroads argument format to what we want to use.
  * We want to keep the path and query names and merge them all in one object for convenience.
  */
  var crossroadsParam = /\{\w*\}/g;
  var crossroadsRestParam = /:\w*\*:/;
  function fromCrossroadsParams(state, crossroadsArgs) {
    var args   = Array.prototype.slice.apply(crossroadsArgs),
        query  = args.pop(),
        params = {},
        pathName;

    state.fullPath().replace(crossroadsParam, function(match) {
      pathName = match.slice(1, -1);
      params[pathName] = args.shift();
      return '';
    });

    state.fullPath().replace(crossroadsRestParam, function(match) {
      pathName = match.slice(1, -2);
      params[pathName] = args.shift();
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
    var params = {},
        allQueryParams = {};

    [state].concat(state.parents).forEach(function(s) {
      util.mergeObjects(allQueryParams, s.queryParams);
    });

    for (var key in abyssaParams) {
      if (allQueryParams[key]) {
        params.query = params.query || {};
        params.query[key] = abyssaParams[key];
      }
      else {
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
    var state = leafStates[stateName];
    if (!state) throw new Error('Cannot find state ' + stateName);

    var interpolated = interpolate(state, params);

    return util.normalizePathQuery(interpolated);
  }

  function interpolate(state, params) {
    var encodedParams = {};
    for (var key in params) {
      encodedParams[key] = encodeURIComponent(params[key]);
    }

    var crossroadsParams = toCrossroadsParams(state, encodedParams);
    var interpolated = state.route.interpolate(crossroadsParams);

    // Fixes https://github.com/millermedeiros/crossroads.js/issues/101
    var pathQuery = interpolated.split('?');
    var path = pathQuery[0], query = pathQuery[1];
    interpolated = path + (query ? ('?' + decodeURI(query)) : '');

    return interpolated;
  }

  /*
  * Returns a StateWithParams object representing the current state of the router.
  */
  function getCurrentState() {
    return currentState;
  }

  /*
  * Returns a StateWithParams object representing the previous state of the router 
  * or null if the router is still in its initial state.
  */
  function getPreviousState() {
    return previousState;
  }

  /*
  * Returns whether the router is executing its first transition.
  */
  function isFirstTransition() {
    return previousState == null;
  }

  function logStateTree() {
    if (!logger.enabled) return;

    var indent = function(level) {
      if (level == 0) return '';
      return new Array(2 + (level - 1) * 4).join(' ') + '── ';
    }

    var stateTree = function(state) {
      var path = util.normalizePathQuery(state.fullPath());
      var pathStr = (state.children.length == 0)
        ? ' (@ path)'.replace('path', path)
        : '';
      var str = indent(state.parents.length) + state.name + pathStr + '\n';
      return str + state.children.map(stateTree).join('');
    }

    var msg = '\nState tree\n\n';
    msg += util.objectToArray(states).map(stateTree).join('');
    msg += '\n';

    logger.log(msg);
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
  router.previousState = getPreviousState;
  router.isFirstTransition = isFirstTransition;

  // Used for testing
  router.urlPathQuery = urlPathQuery;
  router.terminate = terminate;


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
    cancelled: new Signal(),
    // Dispatched when a transition was prevented by the router
    prevented: new Signal()
  };

  // Shorter alias for transition.completed: The most commonly used signal
  router.changed = router.transition.completed;

  router.transition.completed.add(transitionEnded('completed'));
  router.transition.failed.add(transitionEnded('failed'));
  router.transition.cancelled.add(transitionEnded('cancelled'));

  function transitionEnded(reason) {
    return function(newState, oldState) {
      router.transition.ended.dispatch(newState, oldState, reason);
    }
  }

  return router;
}


// Logging

var logger = {
  log: util.noop,
  error: util.noop,
  enabled: false
};

Router.enableLogs = function() {
  logger.enabled = true;

  logger.log = function() {
    var message = util.makeMessage.apply(null, arguments);
    console.log(message);
  };

  logger.error = function() {
    var message = util.makeMessage.apply(null, arguments);
    console.error(message);
  };

};


module.exports = Router;
},{"./StateWithParams":4,"./Transition":5,"./anchors":6,"./util":8,"crossroads":1,"q":1,"signals":1}],3:[function(require,module,exports){

'use strict';


var util  = require('./util');
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
* enter, update, exit.
*
* Child states can also be specified in the options:
* State({ myChildStateName: State() })
* This is the declarative equivalent to the addState method.
*
* Finally, options can contain any arbitrary data value
* that will get stored in the state and made available via the data() method:
* State({data: { myData: 55 } })
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
  state.update = options.update;
  state.exit = options.exit || util.noop;

  state.ownData = options.data || {};

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

  // Replace dynamic params like :id with {id} or :rest* with :rest*:, which is what crossroads uses,
  // and store them for later lookup.
  result.path = result.path.replace(/:[^\\?\/]*/g, function(match) {
    var isRestParam;

    param = match.substring(1);

    if (param[param.length - 1] == '*') {
      param = param.slice(0, -1);
      isRestParam = true;
    }

    result.params[param] = 1;

    return isRestParam
      ? (':' + param + '*:')
      : ('{' + param + '}');
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
function StateWithParams(state, params, pathQuery) {
  return {
    state: state,
    name: state && state.name,
    fullName: state && state.fullName,
    pathQuery: pathQuery,
    data: state && state.data,
    params: params,
    isIn: isIn,
    toString: toString
  };
}

/*
* Returns whether this state or any of its parents has the given fullName.
*/
function isIn(fullStateName) {
  var current = this.state;
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
  var callUpdates = isUpdate && !reload;

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
    : startTransition(enters, exits, params, transition, callUpdates, logger);

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

function startTransition(enters, exits, params, transition, callUpdates, logger) {
  var promise = Q();

  exits.forEach(function(state) {
    if (callUpdates && state.update) return;
    promise = promise.then(call(state, 'exit'));
  });

  enters.forEach(function(state) {
    var fn = (callUpdates && state.update) ? 'update' : 'enter';
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
},{"./util":8,"q":1}],6:[function(require,module,exports){

'use strict';


var ieButton, router;

function onMouseDown(evt) {
  // IE does not provide the correct event.button information on 'onclick' handlers 
  // but it does on mousedown/mouseup handlers.
  ieButton = (evt || window.event).button;

  var href = hrefForEvent(evt);

  if (href !== undefined)
    router.state(href);
}

function onMouseClick(evt) {
  var href = hrefForEvent(evt);

  if (href !== undefined) {
    if (evt.preventDefault) evt.preventDefault();
    else evt.returnValue = false;

    router.state(href);
  }
}

function hrefForEvent(evt) {
  evt = evt || window.event;

  var defaultPrevented = ('defaultPrevented' in evt)
    ? evt.defaultPrevented
    : (evt.returnValue === false);

  if (defaultPrevented || evt.metaKey || evt.ctrlKey || !isLeftButton(evt)) return;

  var target = evt.target || evt.srcElement;
  var anchor = anchorTarget(target);
  if (!anchor) return;

  var dataNav = anchor.getAttribute('data-nav');

  if (dataNav == 'ignore') return;
  if (evt.type == 'mousedown' && dataNav != 'mousedown') return;

  var href = anchor.getAttribute('href');

  if (!href) return;
  if (href.charAt(0) == '#') return;
  if (anchor.getAttribute('target') == '_blank') return;
  if (!isLocalLink(anchor)) return;

  // At this point, we have a valid href to follow.
  // Did the navigation already occur on mousedown though?
  if (evt.type == 'click' && dataNav == 'mousedown') {
    if (evt.preventDefault) evt.preventDefault();
    else evt.returnValue = false;
    return;
  }

  return href;
}

function isLeftButton(evt) {
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


module.exports = function interceptAnchors(forRouter) {
  router = forRouter;

  if (document.addEventListener) {
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('click', onMouseClick);
  }
  else {
    document.attachEvent('onmousedown', onMouseDown);
    document.attachEvent('onclick', onMouseClick);
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

function isPlainObject(obj) {
  return obj && (obj.constructor === Object);
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
  isPlainObject: isPlainObject,
  objectSize: objectSize,
  makeMessage: makeMessage,
  normalizePathQuery: normalizePathQuery
};
},{}]},{},[7])
(7)
});
;
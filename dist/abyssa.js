/** @license
 * abyssa <https://github.com/AlexGalays/abyssa-js/>
 * Author: Alexandre Galays | MIT License
 * v1.1.2 (2013-09-16T12:13:03.976Z)
 */
(function () {
var factory = function (signals, crossroads, when, history) {
var Abyssa = {};

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

/*
* Create a new Transition instance.
*/
function Transition(fromState, toState, params, paramDiff) {
  var root,
      cancelled,
      enters,
      transition,
      exits = [],
      error,
      paramOnlyChange = (fromState == toState);

  // The first transition has no fromState.
  if (fromState) {
    root = transitionRoot(fromState, toState, paramOnlyChange, paramDiff);
    exits = transitionStates(fromState, root, paramOnlyChange);
  }

  enters = transitionStates(toState, root, paramOnlyChange).reverse();

  transition = prereqs(enters, exits, params).then(function() {
    if (!cancelled) doTransition(enters, exits, params);
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
    to: toState,
    toParams: params,
    then: then,
    cancel: cancel
  };
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


var asyncPromises = (function () {

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


Abyssa.Async = asyncPromises.register;

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

  state.enter = options.enter || noop;
  state.exit = options.exit || noop;
  state.enterPrereqs = options.enterPrereqs;
  state.exitPrereqs = options.exitPrereqs;

  state.ownData = getOwnData(options);

  /*
  * Initialize and freeze this state.
  */
  function init(name, parent) {
    state.name = name;
    state.parent = parent;
    state.parents = getParents();
    state.children = getChildren();
    state.fullName = getFullName();
    state.root = state.parents[state.parents.length - 1];
    state.async = Abyssa.Async;

    eachChildState(function(name, childState) {
      childState.init(name, state);
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
  * The map of child states by name.
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
      if (state.ownData[key] !== undefined)
        throw new Error('State ' + state.fullName + ' already has data with the key ' + key);
      state.ownData[key] = value;
      return;
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
  function addState(name, state) {
    if (initialized)
      throw new Error('States can only be added before the Router is initialized');

    if (states[name])
      throw new Error('The state {0} already has a child state named {1}'
        .replace('{0}', state.name)
        .replace('{1}', name)
      );

    states[name] = state;
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
    if (isString(arg1)) result.path = arg1;
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
    result.queryParams = arrayToObject(result.queryParams.split('&'));
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


Abyssa.State = State;

/*
* Create a new Router instance, passing any state defined declaratively.
* More states can be added using addState() before the router is initialized.
*
* Because a router manages global state (The URL), only one instance of Router
* should be used inside an application.
*/
function Router(declarativeStates) {
  var router = {},
      states = copyObject(declarativeStates),
      // Abyssa internally depends on the lower-level crossroads.js router.
      roads  = crossroads.create(),
      firstTransition = true,
      currentPathQuery,
      currentState,
      currentParams,
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

  interceptAnchorClicks(router);

  /*
  * Setting a new state will start a transition from the current state to the target state.
  * A successful transition will result in the URL being changed.
  * A failed transition will leave the router in its current state.
  */
  function setState(state, params) {
    if (isSameState(state, params)) return;

    if (transition) {
      log('Cancelling existing transition from {0} to {1}',
        transition.from, transition.to);
      transition.cancel();
      router.transition.cancelled.dispatch(transition.from, transition.to);
    }

    // Do not evaluate log arguments if logging is disabled:
    if (log !== noop) {
      log('Starting transition from {0}:{1} to {2}:{3}',
        currentState, JSON.stringify(currentParams),
        state, JSON.stringify(params));
    }

    router.transition.started.dispatch(currentState, state);
    transition = Transition(currentState, state, params, paramDiff(currentParams, params));

    transition.then(
      function success() {
        var oldState = currentState,
            historyState;

        currentState = state;
        currentParams = params;
        transition = null;

        if (!poppedState && !firstTransition) {
            historyState = ('/' + currentPathQuery).replace('//', '/');
            log('Pushing state: {0}', historyState);
            history.pushState(historyState, document.title, historyState);
        }

        log('Transition from {0} to {1} completed', oldState, state);
        router.transition.completed.dispatch(oldState, currentState);

        firstTransition = false;
      },
      function fail(error) {
        transition = null;

        logError('Transition from {0} to {1} failed: {2}', currentState, state, error);
        router.transition.failed.dispatch(currentState, state);
      });
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
    else {
      state = currentState;
      params = currentParams;
    }

    diff = paramDiff(params, newParams);

    return (newState == state) && (objectSize(diff) == 0);
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

    if (states.notFound) setState(states.notFound);
    else throw new Error ('State "' + state + '" could not be found');
  }

  /*
  * Initialize and freeze the router (states can not be added afterwards).
  * The router will immediately initiate a transition to, in order of priority:
  * 1) The state captured by the current URL
  * 2) The init state passed as an argument
  * 3) The default state (pathless and queryless)
  */
  function init(initState) {
    log('Router init');
    initStates();

    var initialState = (!Router.ignoreInitialURL && urlPathQuery()) || initState || '';

    log('Initializing to state {0}', initialState || '""');
    state(initialState);

    window.onpopstate = function(evt) {
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
      state.init(name);
    });

    leafStates = {};

    // Only leaf states can be transitioned to.
    eachLeafState(function(state) {
      leafStates[state.fullName] = state;

      state.route = roads.addRoute(state.fullPath() + ":?query:");
      state.route.matched.add(function() {
        stateFound = true;
        setState(state, toParams(state, arguments));
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

    callbackIfLeaf(objectToArray(states));
  }

  /*
  * Request a programmatic state change.
  *
  * Two notations are supported:
  * state('my.target.state', {id: 33, filter: 'desc'})
  * state('target/33?filter=desc')
  */
  function state(pathQueryOrName, params) {
    var isName = (pathQueryOrName.indexOf('.') > -1 || leafStates[pathQueryOrName]);

    log('Changing state to {0}', pathQueryOrName || '""');

    poppedState = false;
    if (isName) setStateByName(pathQueryOrName, params || {});
    else setStateForPathQuery(pathQueryOrName);
  }

  function setStateForPathQuery(pathQuery) {
    currentPathQuery = pathQuery;
    stateFound = false;
    roads.parse(pathQuery);

    if (!stateFound) notFound(pathQuery);
  }

  function setStateByName(name, params) {
    var state = leafStates[name];

    if (!state) return notFound(name);

    var pathQuery = state.route.interpolate(params);
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
  }

  function urlPathQuery() {
    var hashSlash = location.href.indexOf('#/');
    return hashSlash > -1
      ? location.href.slice(hashSlash + 2)
      : (location.pathname + location.search).slice(1);
  }

  /*
  * Translate the crossroads argument format to what we want to use.
  * We want to keep the path and query names and merge them all in one object for convenience.
  */
  function toParams(state, crossroadsArgs) {
    var args   = Array.prototype.slice.apply(crossroadsArgs),
        query  = args.pop(),
        params = {},
        pathName;

    state.fullPath().replace(/\{\w*\}/g, function(match) {
      pathName = match.slice(1, -1);
      params[pathName] = args.shift();
      return '';
    });

    if (query) mergeObjects(params, query);

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
      mergeObjects(allQueryParams, s.queryParams);
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

    return '/' + state.route.interpolate(params).replace('/?', '?');
  }

  // Public methods

  router.init = init;
  router.state = state;
  router.addState = addState;
  router.link = link;


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

  router.transition.completed.addOnce(function() {
    router.initialized.dispatch();
  });

  router.transition.completed.add(transitionEnded);
  router.transition.failed.add(transitionEnded);
  router.transition.cancelled.add(transitionEnded);

  function transitionEnded(oldState, newState) {
    router.transition.ended.dispatch(oldState, newState);
  }

  return router;
}


// Logging

var log = logError = noop;

Router.enableLogs = function() {
  log = function() {
    console.log(getLogMessage(arguments));
  };

  logError = function() {
    console.error(getLogMessage(arguments));
  };

  function getLogMessage(args) {
    var message = args[0],
        tokens = Array.prototype.slice.call(args, 1);

    for (var i = 0, l = tokens.length; i < l; i++) 
      message = message.replace('{' + i + '}', tokens[i]);

    return message;
  }
};


Abyssa.Router = Router;

function detectLeftButton(evt) {
    evt = evt || window.event;
    var button = evt.which || evt.button;
    return button == 1;
}

function interceptAnchorClicks(router) {
  function handler(evt) {
    if (evt.defaultPrevented || evt.metaKey || evt.ctrlKey || !detectLeftButton(evt)) return;

    var anchor = anchorTarget(evt.target);

    if (!anchor) return;
    if (anchor.getAttribute('target') == '_blank') return;
    if (anchor.hostname != location.hostname) return;

    evt.preventDefault();
    router.state(anchor.getAttribute('href'));
  }
  
  if (document.addEventListener) { document.addEventListener('click', handler); }
  else if (document.attachEvent) { document.attachEvent('onclick', handler); }
}


function anchorTarget(target) {
  while (target) {
    if (target.nodeName == 'A') return target;
    target = target.parentNode;
  }
}
return Abyssa;
};
if (typeof define === 'function' && define.amd) {
define(['abyssa'], factory);
} else if (typeof module !== 'undefined' && module.exports) { //Node
module.exports = factory(require('signals'), require('crossroads'), require('when'), require('history'));
} else {
/*jshint sub:true */window['Abyssa'] = factory(window['signals'], window['crossroads'], window['when'], window['history']);
}
}());

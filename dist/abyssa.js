/*! @license
 * abyssa <https://github.com/AlexGalays/abyssa-js/>
 * Author: Alexandre Galays | MIT License
 * v1.2.2 (2013-10-11T10:45:52.422Z)
 */
(function () {
var factory = function (signals, crossroads, when, history) {
var Abyssa = {};

function isString(instance) {
   return Object.prototype.toString.call(instance) === '[object String]';
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

/**
 * Returns the set of all the params that changed (either added, removed or value changed).
 *
 * @param {Object} oldParams The original params.
 * @param {Object} newParams The updated params.
 * @return {Object} The object contains only the keys that have been updated.
 */
function getParamDiff(oldParams, newParams) {
  var diff = {},
      name;

  oldParams = oldParams || {};

  for (name in oldParams)
    if (oldParams[name] !== newParams[name]) diff[name] = 1;

  for (name in newParams)
    if (oldParams[name] !== newParams[name]) diff[name] = 1;

  return diff;
}

/**
 * Normalizes leading and trailing slashes.
 * Removes the leading slash, if required.
 * 
 * @param {String} pathQuery Path with optional query string.
 * @param {Boolean} [removeLeadingSlash=false] If true, the leading slash will not be prepended.
 * @return {String} Normalized path and query string.
 */
function normalizePathQuery(pathQuery, removeLeadingSlash) {
  return ((removeLeadingSlash ? '' : '/') + pathQuery.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+\?/, '?'));
}

/**
 * Returns the path and query string from a full URL.
 * Uses the path in the hash like `#/path/?query`, if present.
 * The returned value may be passed into router.state().
 * 
 * @param {{href:String,pathname:String,search:String}} [urlObject=window.location] Parsed URL (may be a Location or an HTMLAnchorElement).
 * @return {String} Extracted path and query.
 */
function urlPathQuery(urlObject) {
  urlObject = urlObject || window.location;
  var hashSlash = urlObject.href.indexOf('#/');
  return normalizePathQuery(urlObject.pathname + '/' + (hashSlash > -1
    ? (urlObject.href.slice(hashSlash + 2))
    : (urlObject.search)
  ));
}


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

    var prereqs = state._exitPrereqs = when(state.exitPrereqs()).then(
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

    var prereqs = state._enterPrereqs = when(state.enterPrereqs(params)).then(
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


/**
 * Creates a new State instance.
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
 *
 * @signature `State(path)`
 * @param {String} path The state path template.
 * @return {Abyssa.State}
 *
 * @signature `State(options)`
 * @param {Object} options The options object that includes the callbacks and child states.
 * @return {Abyssa.State}
 *
 * @signature `State(path, options)`
 * @param {String} path The state path template.
 * @param {Object} options The options object that includes the callbacks and child states.
 * @return {Abyssa.State}
 *
 * @signature `State(path, enterFn)`
 * @param {String} path The state path template.
 * @param {Function} enterFn The state enter function.
 * @return {Abyssa.State}
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

  /**
   * Initializes and freezes this state.
   *
   * @param {String} name
   * @param {Abyssa.State} parent
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

  /**
   * Builds the full path, composed of all the individual paths of this state and its parents.
   *
   * @return {String}
   */
  function getFullPath() {
    var result      = state.path,
        stateParent = state.parent;

    while (stateParent) {
      if (stateParent.path) result = stateParent.path + '/' + result;
      stateParent = stateParent.parent;
    }

    return normalizePathQuery(result);
  }

  /**
   * Returns the list of all parents, starting from the closest ones.
   *
   * @return {Array.<Abyssa.State>}
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

  /**
   * Returns the list of child states as an Array.
   *
   * @return {Array.<Abyssa.State>}
   */
  function getChildren() {
    var children = [];

    for (var name in states) {
      children.push(states[name]);
    }

    return children;
  }

  /**
   * Finds the states among the options and returns the map of child states by name.
   *
   * @param {Object} options The constructor options, some of them are {Abyssa.State}.
   * @return {Object.<String,Abyssa.State>}
   */
  function getStates(options) {
    var states = {};

    for (var key in options) {
      if (options[key]._isState) states[key] = options[key];
    }

    return states;
  }

  /**
   * Builds the fully qualified name of this state.
   * e.g granparentName.parentName.name
   *
   * @return {String}
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

  /**
   * Gets or Sets some arbitrary data by key on this state.
   * Child states have access to their parents' data.
   *
   * This can be useful when using external models/services
   * as a mean to communicate between states is not desired.
   *
   * @param {String} key The key for the data.
   * @param {*} value The data to store.
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

  /**
   * Adds a child state.
   *
   * @param {String} name The state name.
   * @param {Abyssa.State} state The state to add.
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
  }

  function toString() {
    return state.fullName;
  }


  state.init = init;
  state.getFullPath = getFullPath;

  // Public methods

  state.data = data;
  state.addState = addState;
  state.toString = toString;

  return state;
}


/**
 * Extracts the arguments of the State "constructor" function.
 *
 * @param {Arguments}
 * @return {Object}
 */
function getArgs(args) {
  var result  = { path: '', options: {}, params: {}, queryParams: {} },
      arg1    = args[0],
      arg2    = args[1],
      queryIndex;

  if (args.length === 1) {
    if (isString(arg1)) result.path = arg1;
    else result.options = arg1;
  }
  else if (args.length === 2) {
    result.path = arg1;
    result.options = (typeof arg2 === 'object') ? arg2 : {enter: arg2};
  }

  // Normalize the path, remove the leading slash to allow pathless states
  result.path = normalizePathQuery(result.path, true);

  // Extract the query string
  queryIndex = result.path.indexOf('?');
  if (queryIndex !== -1) {
    result.queryParams = result.path.slice(queryIndex + 1);
    result.path = result.path.slice(0, queryIndex);
    result.queryParams = arrayToObject(result.queryParams.split('&'));
  }

  // Replace dynamic params like :id with {id}, which is what crossroads uses,
  // and store them for later lookup.
  result.path = result.path.replace(/[\:\{][^\/]+/g, function(match) {
    var lastChar = match.charAt(match.length-1);
    var param;
    if (lastChar === '}' || lastChar === ':') {
      param = match.substring(1, match.length-1);
      result.params[param] = 1;
      return match;
    }
    param = match.substring(1);
    result.params[param] = 1;
    return '{' + param + '}';
  });

  return result;
}


Abyssa.State = State;


/**
 * Creates a new Router instance, taking any state defined declaratively.
 * More states can be added using addState() before the router is initialized.
 *
 * Because a router manages global state (the URL), only one instance of Router
 * should be used inside an application.
 *
 * @param {Object.<String,Abyssa.State>}
 * @return {Abyssa.Router}
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
      leafStates = {},
      stateFound,
      poppedState,
      initialized;

  // Routes params should be type casted. e.g the dynamic path items/:id when id is 33
  // will end up passing the integer 33 as an argument, not the string "33".
  roads.shouldTypecast = true;
  // Nil transitions are prevented from our side.
  roads.ignoreState = true;

  /**
   * Starts a transition to the new state.
   *
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
      router.transition.cancelled.dispatch(transition.from, transition.to, transition.fromParams, transition.toParams);
    }

    // Do not evaluate log arguments if logging is disabled:
    if (log !== noop) {
      log('Starting transition from {0}:{1} to {2}:{3}',
        currentState, JSON.stringify(currentParams),
        state, JSON.stringify(params));
    }

    router.transition.started.dispatch(currentState, state, currentParams, params);
    transition = Transition(currentState, state, currentParams, params);

    transition.then(
      function success() {
        var oldState = currentState,
            oldParams = currentParams,
            historyState;

        currentState = state;
        currentParams = params;
        transition = null;

        if (!poppedState && !firstTransition) {
            historyState = currentPathQuery;
            log('Pushing state: {0}', historyState);
            history.pushState(historyState, (window.document && window.document.title) || "", historyState);
        }

        log('Transition from {0} to {1} completed', oldState, state);
        router.transition.completed.dispatch(oldState, currentState, oldParams, currentParams);

        firstTransition = false;
      },
      function fail(error) {
        transition = null;

        logError('Transition from {0} to {1} failed: {2}', currentState, state, error);
        router.transition.failed.dispatch(currentState, state, currentParams, params);
      });
  }

  /**
   * Returns whether the passed state is the same as the current one;
   * in which case the router can ignore the change.
   *
   * @param {Abyssa.State} newState
   * @param {Object} newParams
   * @return {Boolean}
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

    diff = getParamDiff(params, newParams);

    return (newState === state) && (objectSize(diff) === 0);
  }

  /**
   * Returns whether the passed string is a path with an optional query string or a state name.
   *
   * @param {String} pathQueryOrName Either a path starting with a slash / with optional query string or a state name.
   * @return {Boolean}
   */
  function isPathQuery(pathQueryOrName) {
    return (!pathQueryOrName || pathQueryOrName.indexOf('/') > -1 || pathQueryOrName.indexOf('?') > -1);
  }

  /**
   * Handles the missing state.
   * Transition to the 'notFound' state if the developer specified it or else throw an error.
   *
   * @param {String} pathQueryOrName Either a path starting with a slash with optional query string or a state name.
   * @param {Object} params State params (used only if the state name is given).
   */
  function notFound(pathQueryOrName, params) {
    log('State not found: {0}', pathQueryOrName);

    if (states.notFound) {
      setState(states.notFound, (isPathQuery(pathQueryOrName) ? {
        pathQuery: pathQueryOrName
      } : {
        name: pathQueryOrName,
        params: params || {}
      }));
    }
    else throw new Error('State "' + pathQueryOrName + '" could not be found');
  }

  /**
   * Initializes and freezes the router (states can not be added afterwards).
   * The router will immediately initiate a transition to, in order of priority:
   * 1) The state captured by the current URL
   * 2) The init state passed as an argument
   * 3) The default state (pathless and queryless)
   *
   * @param {String} initState The initial state name or a path starting with a slash.
   * @param {Object} initParams State params (used only if the state name is given).
   * @return {Abyssa.Router}
   */
  function init(initState, initParams) {
    log('Router init');
    initStates();

    initState = (!Router.ignoreInitialURL && urlPathQuery()) || initState || "";

    log('Initializing to state {0}', initState);
    state(initState, initParams);

    window.onpopstate = function(evt) {
      // history.js will dispatch fake popstate events on HTML4 browsers' hash changes; 
      // in these cases, evt.state is null.
      var newState = evt.state || urlPathQuery();

      log('Popped state: {0}', newState);
      poppedState = true;
      setStateForPathQuery(newState);
    };

    initialized = true;

    interceptAnchorClicks(router);

    return router;
  }

  function initStates() {
    eachRootState(function(name, state) {
      state.init(name);
    });

    // Only leaf states can be transitioned to.
    eachLeafState(function(state) {
      leafStates[state.fullName] = state;

      state.route = roads.addRoute(state.getFullPath() + ":?query:");
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

  /**
   * Requests a programmatic state change.
   *
   * Two notations are supported:
   * state('my.target.state', {id: 33, filter: 'desc'})
   * state('/target/33?filter=desc')
   *
   * @param {String} pathQueryOrName Either a path starting with a slash / with optional query string or a state name.
   * @param {Object} params State params (used only if the state name is given).
   */
  function state(pathQueryOrName, params) {
    var isPath = isPathQuery(pathQueryOrName);

    log('Changing state to {0} {1}', pathQueryOrName, (isPath ? '(path)' : '(name)'));

    poppedState = false;
    if (isPath) setStateForPathQuery(pathQueryOrName);
    else setStateByName(pathQueryOrName, params || {});
  }

  function setStateForPathQuery(pathQuery) {
    currentPathQuery = normalizePathQuery(pathQuery);
    stateFound = false;
    roads.parse(currentPathQuery);

    if (!stateFound) notFound(currentPathQuery);
  }

  function setStateByName(name, params) {
    var state = leafStates[name];

    if (!state) return notFound(name, params);

    var pathQuery = state.route.interpolate(params);
    setStateForPathQuery(pathQuery);
  }

  /**
   * Adds a new root state to the router.
   * The name must be unique among root states.
   *
   * @param {String} name The state name.
   * @param {Abyssa.State} state The state to add.
   */
  function addState(name, state) {
    if (initialized) 
      throw new Error('States can only be added before the Router is initialized');

    if (states[name])
      throw new Error('A state already exist in the router with the name ' + name);

    log('Adding state {0}', name);

    states[name] = state;
  }

  /**
   * Translates the crossroads argument format to what we want to use.
   * We want to keep the path and query names and merge them all in one object for convenience.
   *
   * @param {Abyssa.State}
   * @param {Arguments} The arguments of the crossroads `matched` handler.
   */
  function toParams(state, crossroadsArgs) {
    var args   = Array.prototype.slice.apply(crossroadsArgs),
        query  = args.pop(),
        params = {},
        pathName;

    state.getFullPath().replace(/(?:\{\w+?\})|(?:\:[^\:\/]+\:)/g, function(match) {
      pathName = match.slice(1, -1);
      params[pathName] = args.shift();
      return '';
    });

    if (query) mergeObjects(params, query);

    return params;
  }

  /**
   * Computes a link that can be used in anchors' href attributes
   * from a state name and a list of params, a.k.a reverse routing.
   *
   * @param {String} stateName
   * @param {Object} params
   * @return {String}
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

    return normalizePathQuery(state.route.interpolate(params));
  }

  // Public methods

  router.init = init;
  router.state = state;
  router.addState = addState;
  router.link = link;


  // Signals

  router.transition = {
    // Dispatched when a transition started.
    started:   new signals.Signal(),
    // Dispatched when a transition either completed, failed or got cancelled.
    ended:     new signals.Signal(),
    // Dispatched when a transition successfuly completed
    completed: new signals.Signal(),
    // Dispatched when a transition failed to complete
    failed:    new signals.Signal(),
    // Dispatched when a transition got cancelled
    cancelled: new signals.Signal()
  };

  // Dispatched once after the router successfully reached its initial state.
  router.initialized = new signals.Signal();

  router.transition.completed.addOnce(function(oldState, newState, oldParams, newParams) {
    router.initialized.dispatch(newState, newParams);
  });

  router.transition.completed.add(transitionEnded);
  router.transition.failed.add(transitionEnded);
  router.transition.cancelled.add(transitionEnded);

  function transitionEnded() {
    router.transition.ended.dispatch.apply(router.transition.ended, arguments);
  }

  return router;
}


// Logging

var log = noop;
var logError = noop;

Router.enableLogs = function() {
  log = function() {
    if (typeof console !== 'undefined') console.log(getLogMessage(arguments));
  };

  logError = function() {
    if (typeof console !== 'undefined') console.error(getLogMessage(arguments));
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

var interceptAnchorClicks = (function (window) {
  if (!window || !window.document || !window.location) return;

  function detectLeftButton(event) {
    // Normalize mouse button for click event: 1 === left; 2 === middle; 3 === right
    var which = event.which, button = event.button;
    if ( !which && typeof button !== 'undefined' ) {
      // Note that in IE, 'click' event only fires from the left mouse button, so we fall back to 1 below:
      which = ( button & 1 ? 1 : ( button & 2 ? 3 : ( button & 4 ? 2 : 1 ) ) );
    }
    return (which === 1);
  }

  function anchorTarget(target) {
    while (target) {
      if (target.nodeName === 'A') return target;
      target = target.parentNode;
    }
  }

  function matchProtocolHostAgainstLocation(anchor) {
    var protocol = anchor.protocol, host = anchor.host;

    /* IE can lose the `protocol`, `host`, `port`, `hostname` properties when setting a relative href from JS.
     * We use a temporary anchor to restore the values from `href` which is always absolute.
     * @see http://stackoverflow.com/questions/10755943/ie-forgets-an-a-tags-hostname-after-changing-href
     */
    var tempAnchor = window.document.createElement("A");
    tempAnchor.href = anchor.href;

    protocol = (protocol && protocol !== ':' ? protocol : tempAnchor.protocol);
    host = host || tempAnchor.host;

    // Compare protocol scheme, hostname and port:
    return (protocol === window.location.protocol && host === window.location.host);
  }

  return function (router) {
    function handler(e) {
      var event = e || window.event;
      var target = event.target || event.srcElement;
      var defaultPrevented = "defaultPrevented" in event ? event['defaultPrevented'] : event.returnValue === false;

      if (
        defaultPrevented
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
        || !detectLeftButton(event)
      ) {
        return;
      }

      var anchor = anchorTarget(target);

      // Check if we can navigate in-page:
      if (
        !anchor
        || anchor.getAttribute('target') //< Non-empty target.
        || !matchProtocolHostAgainstLocation(anchor) //< Different protocol scheme, hostname or port.
        || /([a-z0-9_\-]+\:)?\/\/[^@]+@/.test(anchor.href) //< Non-empty username/password.
      ) {
        return;
      }

      if (event.preventDefault) { event.preventDefault(); }
      else { event.returnValue = false; }

      router.state(urlPathQuery(anchor));
    }

    if (window.document.addEventListener) { window.document.addEventListener('click', handler); }
    else if (window.document.attachEvent) { window.document.attachEvent('onclick', handler); }
  };
}(this));

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

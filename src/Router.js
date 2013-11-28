
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
        router.transition.failed.dispatch(currentState, state, currentParams, params, error);
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
    else return handleAsyncError(new Error('State "' + pathQueryOrName + '" could not be found.'));
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
      // devote/HTML5-History-API will dispatch fake popstate events on HTML4 browsers' hash changes;
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


// Error handling

var handleAsyncError = handleAsyncErrorDefault;

function handleAsyncErrorDefault(error) {
  if (error) {
    if (typeof console !== 'undefined') console.error(error);
    throw error;
  }
}

Router.setAsyncErrorHandler = function(handler) {
  handleAsyncError = handler || handleAsyncErrorDefault;
};


Abyssa.Router = Router;


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
      initOptions = {
        enableLogs: false,
        interceptAnchorClicks: true
      },
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

    if (logEnabled) log('Starting transition from {0}:{1} to {2}:{3}',
      currentState, JSON.stringify(currentParams),
      state, JSON.stringify(params));

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
  * Configure the router before its initialization.
  */
  function configure(options) {
    mergeObjects(initOptions, options);
    return router;
  }

  /*
  * Initialize and freeze the router (states can not be added afterwards).
  * The router will immediately initiate a transition to, in order of priority:
  * 1) The state captured by the current URL
  * 2) The init state passed as an argument
  * 3) The default state (pathless and queryless)
  */
  function init(initState) {
    if (initOptions.enableLogs)
      Router.enableLogs();

    if (initOptions.interceptAnchorClicks)
      interceptAnchorClicks(router);

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

    // Decode all params
    for (var i in params) {
      if (isString(params[i])) params[i] = decodeURIComponent(params[i]);
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

  router.configure = configure;
  router.init = init;
  router.state = state;
  router.redirect = state;
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
var logEnabled = false;

Router.enableLogs = function() {
  logEnabled = true;

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
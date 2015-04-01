
'use strict';


var Signal           = require('signals').Signal,
    crossroads       = require('crossroads'),
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
        urlSync: true,
        hashPrefix: ''
      },
      ignoreNextURLChange = false,
      currentPathQuery,
      currentParamsDiff = {},
      currentState,
      previousState,
      transition,
      leafStates,
      urlChanged,
      initialized,
      hashSlashString;

  // Nil transitions are prevented from our side.
  roads.ignoreState = true;

  /*
  * Setting a new state will start a transition from the current state to the target state.
  * A successful transition will result in the URL being changed.
  * A failed transition will leave the router in its current state.
  */
  function setState(state, params) {
    var fromState = transition
      ? StateWithParams(transition.currentState, transition.toParams)
      : currentState;

    var toState = StateWithParams(state, params);

    var diff = util.objectDiff(fromState && fromState.params, params);

    if (preventTransition(fromState, toState, diff)) {
      if (transition && transition.exiting) cancelTransition();
      return;
    }

    if (transition) cancelTransition();

    // While the transition is running, any code asking the router about the previous/current state should
    // get the end result state.
    previousState = currentState;
    currentState = toState;
    currentParamsDiff = diff;

    transition = Transition(
      fromState,
      toState,
      diff,
      logger
    );

    startingTransition(fromState, toState);

    // In case of a redirect() called from 'startingTransition', the transition already ended.
    if (transition) transition.run();

    // In case of a redirect() called from the transition itself, the transition already ended
    if (transition) {
      if (transition.cancelled) currentState = fromState;
      else endingTransition(fromState, toState);
    }

    transition = null;
  }

  function cancelTransition() {
    logger.log('Cancelling existing transition from {0} to {1}',
      transition.from, transition.to);

    transition.cancel();

    firstTransition = false;
  }

  function startingTransition(fromState, toState) {
    logger.log('Starting transition from {0} to {1}', fromState, toState);

    router.transition.started.dispatch(toState, fromState);
  }

  function endingTransition(fromState, toState) {
    if (!urlChanged && !firstTransition) {
      logger.log('Updating URL: {0}', currentPathQuery);
      updateURLFromState(currentPathQuery, document.title, currentPathQuery);
    }

    firstTransition = false;

    logger.log('Transition from {0} to {1} ended', fromState, toState);

    toState.state.lastParams = toState.params;

    router.transition.ended.dispatch(toState, fromState);
  }

  function updateURLFromState(state, title, url) {
    if (isHashMode()) {
      ignoreNextURLChange = true;
      location.hash = options.hashPrefix + url;
    }
    else
      history.pushState(state, title, url);
  }

  /*
  * Return whether the passed state is the same as the current one;
  * in which case the router can ignore the change.
  */
  function preventTransition(current, newState, diff) {
    if (!current) return false;

    return (newState.state == current.state) && (util.objectSize(diff.all) == 0);
  }

  /*
  * The state wasn't found;
  * Transition to the 'notFound' state if the developer specified it or else throw an error.
  */
  function notFound(state) {
    logger.log('State not found: {0}', state);

    if (options.notFound)
      return setState(leafStates[options.notFound], {});
    else throw new Error ('State "' + state + '" could not be found');
  }

  /*
  * Configure the router before its initialization.
  * The available options are:
  *   enableLogs: Whether (debug and error) console logs should be enabled. Defaults to false.
  *   interceptAnchors: Whether anchor mousedown/clicks should be intercepted and trigger a state change. Defaults to true.
  *   notFound: The State to enter when no state matching the current path query or name could be found. Defaults to null.
  *   urlSync: How should the router maintain the current state and the url in sync. Defaults to true (history API).
  *   hashPrefix: Customize the hash separator. Set to '!' in order to have a hashbang like '/#!/'. Defaults to empty string.
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

    hashSlashString = '#' + options.hashPrefix + '/';

    logger.log('Router init');

    initStates();
    logStateTree();

    initState = (initState !== undefined) ? initState : urlPathQuery();

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

    function onURLChange(evt) {
      if (ignoreNextURLChange) {
        ignoreNextURLChange = false;
        return;
      }

      var newState = isHashMode() ? urlPathQuery() : evt.state;

      logger.log('URL changed: {0}', newState);
      urlChanged = true;
      setStateForPathQuery(newState);
    }

    window[isHashMode() ? 'onhashchange' : 'onpopstate'] = onURLChange;
  }

  function initStates() {
    eachRootState(function(name, state) {
      state.init(router, name);
    });

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
  * state('my.target.state', {id: 33, filter: 'desc'})
  * state('target/33?filter=desc')
  */
  function state(pathQueryOrName) {
    var isName = leafStates[pathQueryOrName] !== undefined;
    var params = isName ? arguments[1] : null;

    logger.log('Changing state to {0}', pathQueryOrName || '""');

    urlChanged = false;

    if (isName)
      setStateByName(pathQueryOrName, params || {});
    else
      setStateForPathQuery(pathQueryOrName);
  }

  /*
  * Attempt to navigate to 'stateName' with its previous params or
  * fallback to the defaultParams parameter if the state was never entered.
  */
  function backTo(stateName, defaultParams) {
    var params = leafStates[stateName].lastParams || defaultParams;
    state(stateName, params);
  }

  function setStateForPathQuery(pathQuery) {
    var routeData;

    currentPathQuery = util.normalizePathQuery(pathQuery);

    roads.routed.add(routed);
    roads.parse(currentPathQuery);
    roads.routed.remove(routed);

    function routed(_, data) {
      routeData = data;
    }

    if (routeData) setState(
      routeData.route.abyssaState,
      fromCrossroadsParams(routeData.route.abyssaState, routeData.params))
    else
      notFound(currentPathQuery);
  }

  function setStateByName(name, params) {
    var state = leafStates[name];

    if (!state) return notFound(name);

    var pathQuery = interpolate(state, params);
    setStateForPathQuery(pathQuery);
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
    var hashSlash = location.href.indexOf(hashSlashString);

    var pathQuery;

    if (hashSlash > -1) {
      pathQuery = location.href.slice(hashSlash + hashSlashString.length);
    }
    else if (isHashMode()) {
      pathQuery = '/';
    }
    else {
      pathQuery = (location.pathname + location.search).slice(1);
    }

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
        allQueryParams = state.allQueryParams();

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
  * Returns the path portion of the current url
  */
  function getPath() {
    return currentPathQuery.split('?')[0];
  }

  /*
  * Returns the query portion of the current url
  */
  function getQuery() {
    return currentPathQuery.split('?')[1];
  }

  /*
  * Returns all params (path and query) associated to the current state
  */
  function getParams() {
    return util.copyObject(currentState.params);
  }

  /*
  * Returns the query params associated to the current state
  */
  function getQueryParams() {
    var queryParams = currentState.state.allQueryParams();
    var allParams = currentState.params;

    var params = {};

    for (var param in allParams) {
      if (param in queryParams)
        params[param] = allParams[param];
    }

    return params;
  }

  /*
  * Returns the diff between the current params and the previous ones.
  */
  function getParamsDiff() {
    return currentParamsDiff;
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
  router.backTo = backTo;
  router.addState = addState;
  router.link = link;
  router.currentState = getCurrentState;
  router.previousState = getPreviousState;
  router.isFirstTransition = isFirstTransition;
  router.path = getPath;
  router.query = getQuery;
  router.params = getParams;
  router.queryParams = getQueryParams;
  router.paramsDiff = getParamsDiff;

  // Used for testing purposes only
  router.urlPathQuery = urlPathQuery;
  router.terminate = terminate;


  // Signals

  router.transition = {
    started: new Signal(),
    ended: new Signal()
  };

  // Shorter alias for transition.completed: The most commonly used signal
  router.changed = router.transition.completed;

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
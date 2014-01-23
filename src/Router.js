
'use strict';


var Signal           = require('signals').Signal,
    crossroads       = require('crossroads'),
    interceptAnchors = require('./anchors'),
    StateWithParams  = require('./StateWithParams'),
    Transition       = require('./Transition'),
    util             = require('./util');

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
      options = {
        enableLogs: false,
        interceptAnchors: true,
        notFound: null,
        urlSync: true
      },
      ignoreNextPopState = false,
      currentPathQuery,
      currentState,
      previousState,
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
    if (!reload && isSameState(state, params)) return transitionPrevented(currentState);

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
    // get the end result state. These states are rollbacked if the transition fails.
    oldPreviousState = previousState;
    previousState = currentState;
    currentState = toState;

    // A state was popped and the browser already changed the URL as a result;
    // Revert the URL to its previous value and actually change it after a successful transition.
    if (poppedState) replaceState(
      fromState.pathQuery, document.title, fromState.pathQuery);

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
          currentState.pathQuery, document.title, currentState.pathQuery);

        transitionCompleted(fromState, toState);
      },
      function fail(error) {
        transition = null;

        currentState = previousState;
        previousState = oldPreviousState;

        transitionFailed(fromState, toState, error);
      }
    )
    .fail(transitionError);
  }

  function transitionPrevented(toState) {
    router.transition.prevented.dispatch(toState);
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

    toState.state.lastParams = toState.params;

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

  function replaceState(state, title, url) {
    if (!options.urlSync) return;

    // Workaround for https://github.com/devote/HTML5-History-API/issues/44
    if (history.emulate) ignoreNextPopState = true;
    history.replaceState(state, title, url);
  }

  function pushState(state, title, url) {
    if (!options.urlSync) return;

    // Workaround for https://github.com/devote/HTML5-History-API/issues/44
    if (history.emulate) ignoreNextPopState = true;
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
    log('State not found: {0}', state);

    if (options.notFound)
      setState(leafStates[options.notFound] || options.notFound, {});
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
  * Initialize and freeze the router (states can not be added afterwards).
  * The router will immediately initiate a transition to, in order of priority:
  * 1) The init state passed as an argument
  * 2) The state captured by the current URL
  */
  function init(initState, initParams) {
    if (options.enableLogs)
      Router.enableLogs();

    if (options.interceptAnchors)
      interceptAnchors(router);

    log('Router init');

    initStates();
    logStateTree();

    initState = (initState !== undefined) ? initState : getInitState();

    log('Initializing to state {0}', initState || '""');
    state(initState, initParams);

    if (options.urlSync)
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
    setState(currentState.state, currentState.params, true);
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

    var crossroadsParams = toCrossroadsParams(state, params);

    return util.normalizePathQuery(state.route.interpolate(crossroadsParams));
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

  function logStateTree() {
    if (!logEnabled) return;

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

    log(msg);
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
    cancelled: new Signal(),
    // Dispatched when a transition was prevented by the router
    prevented: new Signal()
  };

  // Shorter alias for transition.completed: The most commonly used signal
  router.changed = router.transition.completed;

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
    logError = util.noop,
    logEnabled;

Router.enableLogs = function() {
  logEnabled = true;

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
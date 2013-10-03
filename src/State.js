
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

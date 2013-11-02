// abyssa-js 1.1.6
define(function() {

var Abyssa = {};
/*jslint indent:4, white:true, nomen:true, plusplus:true */
/*global define:false, require:false, exports:false, module:false, signals:false */

/** @license
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license
 * Author: Miller Medeiros
 * Version: 0.8.1 - Build: 266 (2012/07/31 03:33 PM)
 */

var Signal = (function(global){

    // SignalBinding -------------------------------------------------
    //================================================================

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name SignalBinding
     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
     * @param {Function} listener Handler function bound to the signal.
     * @param {boolean} isOnce If binding should be executed just once.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @param {Number} [priority] The priority level of the event listener. (default = 0).
     */
    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {

        /**
         * Handler function bound to the signal.
         * @type Function
         * @private
         */
        this._listener = listener;

        /**
         * If binding should be executed just once.
         * @type boolean
         * @private
         */
        this._isOnce = isOnce;

        /**
         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @memberOf SignalBinding.prototype
         * @name context
         * @type Object|undefined|null
         */
        this.context = listenerContext;

        /**
         * Reference to Signal object that listener is currently bound to.
         * @type Signal
         * @private
         */
        this._signal = signal;

        /**
         * Listener priority
         * @type Number
         * @private
         */
        this._priority = priority || 0;
    }

    SignalBinding.prototype = {

        /**
         * If binding is active and should be executed.
         * @type boolean
         */
        active : true,

        /**
         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
         * @type Array|null
         */
        params : null,

        /**
         * Call listener passing arbitrary parameters.
         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
         * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
         * @return {*} Value returned by the listener.
         */
        execute : function (paramsArr) {
            var handlerReturn, params;
            if (this.active && !!this._listener) {
                params = this.params? this.params.concat(paramsArr) : paramsArr;
                handlerReturn = this._listener.apply(this.context, params);
                if (this._isOnce) {
                    this.detach();
                }
            }
            return handlerReturn;
        },

        /**
         * Detach binding from signal.
         * - alias to: mySignal.remove(myBinding.getListener());
         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
         */
        detach : function () {
            return this.isBound()? this._signal.remove(this._listener, this.context) : null;
        },

        /**
         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
         */
        isBound : function () {
            return (!!this._signal && !!this._listener);
        },

        /**
         * @return {Function} Handler function bound to the signal.
         */
        getListener : function () {
            return this._listener;
        },

        /**
         * Delete instance properties
         * @private
         */
        _destroy : function () {
            delete this._signal;
            delete this._listener;
            delete this.context;
        },

        /**
         * @return {boolean} If SignalBinding will only be executed once.
         */
        isOnce : function () {
            return this._isOnce;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
        }

    };


/*global SignalBinding:false*/

    // Signal --------------------------------------------------------
    //================================================================

    function validateListener(listener, fnName) {
        if (typeof listener !== 'function') {
            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
        }
    }

    /**
     * Custom event broadcaster
     * <br />- inspired by Robert Penner's AS3 Signals.
     * @name Signal
     * @author Miller Medeiros
     * @constructor
     */
    function Signal() {
        /**
         * @type Array.<SignalBinding>
         * @private
         */
        this._bindings = [];
        this._prevParams = null;
    }

    Signal.prototype = {

        /**
         * Signals Version Number
         * @type String
         * @const
         */
        VERSION : '0.8.1',

        /**
         * If Signal should keep record of previously dispatched parameters and
         * automatically execute listener during `add()`/`addOnce()` if Signal was
         * already dispatched before.
         * @type boolean
         */
        memorize : false,

        /**
         * @type boolean
         * @private
         */
        _shouldPropagate : true,

        /**
         * If Signal is active and should broadcast events.
         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
         * @type boolean
         */
        active : true,

        /**
         * @param {Function} listener
         * @param {boolean} isOnce
         * @param {Object} [listenerContext]
         * @param {Number} [priority]
         * @return {SignalBinding}
         * @private
         */
        _registerListener : function (listener, isOnce, listenerContext, priority) {

            var prevIndex = this._indexOfListener(listener, listenerContext),
                binding;

            if (prevIndex !== -1) {
                binding = this._bindings[prevIndex];
                if (binding.isOnce() !== isOnce) {
                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
                }
            } else {
                binding = new SignalBinding(this, listener, isOnce, listenerContext, priority);
                this._addBinding(binding);
            }

            if(this.memorize && this._prevParams){
                binding.execute(this._prevParams);
            }

            return binding;
        },

        /**
         * @param {SignalBinding} binding
         * @private
         */
        _addBinding : function (binding) {
            //simplified insertion sort
            var n = this._bindings.length;
            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
            this._bindings.splice(n + 1, 0, binding);
        },

        /**
         * @param {Function} listener
         * @return {number}
         * @private
         */
        _indexOfListener : function (listener, context) {
            var n = this._bindings.length,
                cur;
            while (n--) {
                cur = this._bindings[n];
                if (cur._listener === listener && cur.context === context) {
                    return n;
                }
            }
            return -1;
        },

        /**
         * Check if listener was attached to Signal.
         * @param {Function} listener
         * @param {Object} [context]
         * @return {boolean} if Signal has the specified listener.
         */
        has : function (listener, context) {
            return this._indexOfListener(listener, context) !== -1;
        },

        /**
         * Add a listener to the signal.
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        add : function (listener, listenerContext, priority) {
            validateListener(listener, 'add');
            return this._registerListener(listener, false, listenerContext, priority);
        },

        /**
         * Add listener to the signal that should be removed after first execution (will be executed only once).
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        addOnce : function (listener, listenerContext, priority) {
            validateListener(listener, 'addOnce');
            return this._registerListener(listener, true, listenerContext, priority);
        },

        /**
         * Remove a single listener from the dispatch queue.
         * @param {Function} listener Handler function that should be removed.
         * @param {Object} [context] Execution context (since you can add the same handler multiple times if executing in a different context).
         * @return {Function} Listener handler function.
         */
        remove : function (listener, context) {
            validateListener(listener, 'remove');

            var i = this._indexOfListener(listener, context);
            if (i !== -1) {
                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
                this._bindings.splice(i, 1);
            }
            return listener;
        },

        /**
         * Remove all listeners from the Signal.
         */
        removeAll : function () {
            var n = this._bindings.length;
            while (n--) {
                this._bindings[n]._destroy();
            }
            this._bindings.length = 0;
        },

        /**
         * @return {number} Number of listeners attached to the Signal.
         */
        getNumListeners : function () {
            return this._bindings.length;
        },

        /**
         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
         * @see Signal.prototype.disable
         */
        halt : function () {
            this._shouldPropagate = false;
        },

        /**
         * Dispatch/Broadcast Signal to all listeners added to the queue.
         * @param {...*} [params] Parameters that should be passed to each handler.
         */
        dispatch : function (params) {
            if (! this.active) {
                return;
            }

            var paramsArr = Array.prototype.slice.call(arguments),
                n = this._bindings.length,
                bindings;

            if (this.memorize) {
                this._prevParams = paramsArr;
            }

            if (! n) {
                //should come after memorize
                return;
            }

            bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
            //reverse loop since listeners with higher priority will be added at the end of the list
            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
        },

        /**
         * Forget memorized arguments.
         * @see Signal.memorize
         */
        forget : function(){
            this._prevParams = null;
        },

        /**
         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
         */
        dispose : function () {
            this.removeAll();
            delete this._bindings;
            delete this._prevParams;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        }

    };


    // Namespace -----------------------------------------------------
    //================================================================

    /**
     * Signals namespace
     * @namespace
     * @name signals
     */
    var signals = Signal;

    /**
     * Custom event broadcaster
     * @see Signal
     */
    // alias for backwards compatibility (see #gh-44)
    signals.Signal = Signal;


    global['signals'] = signals;


    return Signal;

}(this));
/** @license
 * crossroads <http://millermedeiros.github.com/crossroads.js/>
 * Author: Miller Medeiros | MIT License
 * v0.12.0 (2013/01/21 13:47)
 */

var crossroads = (function () {
var factory = function (signals) {

    var crossroads,
        _hasOptionalGroupBug,
        UNDEF;

    // Helpers -----------
    //====================

    // IE 7-8 capture optional groups as empty strings while other browsers
    // capture as `undefined`
    _hasOptionalGroupBug = (/t(.+)?/).exec('t')[1] === '';

    function arrayIndexOf(arr, val) {
        if (arr.indexOf) {
            return arr.indexOf(val);
        } else {
            //Array.indexOf doesn't work on IE 6-7
            var n = arr.length;
            while (n--) {
                if (arr[n] === val) {
                    return n;
                }
            }
            return -1;
        }
    }

    function arrayRemove(arr, item) {
        var i = arrayIndexOf(arr, item);
        if (i !== -1) {
            arr.splice(i, 1);
        }
    }

    function isKind(val, kind) {
        return '[object '+ kind +']' === Object.prototype.toString.call(val);
    }

    function isRegExp(val) {
        return isKind(val, 'RegExp');
    }

    function isArray(val) {
        return isKind(val, 'Array');
    }

    function isFunction(val) {
        return typeof val === 'function';
    }

    //borrowed from AMD-utils
    function typecastValue(val) {
        var r;
        if (val === null || val === 'null') {
            r = null;
        } else if (val === 'true') {
            r = true;
        } else if (val === 'false') {
            r = false;
        } else if (val === UNDEF || val === 'undefined') {
            r = UNDEF;
        } else if (val === '' || isNaN(val)) {
            //isNaN('') returns false
            r = val;
        } else {
            //parseFloat(null || '') returns NaN
            r = parseFloat(val);
        }
        return r;
    }

    function typecastArrayValues(values) {
        var n = values.length,
            result = [];
        while (n--) {
            result[n] = typecastValue(values[n]);
        }
        return result;
    }

    //borrowed from AMD-Utils
    function decodeQueryString(str, shouldTypecast) {
        var queryArr = (str || '').replace('?', '').split('&'),
            n = queryArr.length,
            obj = {},
            item, val;
        while (n--) {
            item = queryArr[n].split('=');
            val = shouldTypecast ? typecastValue(item[1]) : item[1];
            obj[item[0]] = (typeof val === 'string')? decodeURIComponent(val) : val;
        }
        return obj;
    }


    // Crossroads --------
    //====================

    /**
     * @constructor
     */
    function Crossroads() {
        this.bypassed = new signals.Signal();
        this.routed = new signals.Signal();
        this._routes = [];
        this._prevRoutes = [];
        this._piped = [];
        this.resetState();
    }

    Crossroads.prototype = {

        greedy : false,

        greedyEnabled : true,

        ignoreCase : true,

        ignoreState : false,

        shouldTypecast : false,

        normalizeFn : null,

        resetState : function(){
            this._prevRoutes.length = 0;
            this._prevMatchedRequest = null;
            this._prevBypassedRequest = null;
        },

        create : function () {
            return new Crossroads();
        },

        addRoute : function (pattern, callback, priority) {
            var route = new Route(pattern, callback, priority, this);
            this._sortedInsert(route);
            return route;
        },

        removeRoute : function (route) {
            arrayRemove(this._routes, route);
            route._destroy();
        },

        removeAllRoutes : function () {
            var n = this.getNumRoutes();
            while (n--) {
                this._routes[n]._destroy();
            }
            this._routes.length = 0;
        },

        parse : function (request, defaultArgs) {
            request = request || '';
            defaultArgs = defaultArgs || [];

            // should only care about different requests if ignoreState isn't true
            if ( !this.ignoreState &&
                (request === this._prevMatchedRequest ||
                 request === this._prevBypassedRequest) ) {
                return;
            }

            var routes = this._getMatchedRoutes(request),
                i = 0,
                n = routes.length,
                cur;

            if (n) {
                this._prevMatchedRequest = request;

                this._notifyPrevRoutes(routes, request);
                this._prevRoutes = routes;
                //should be incremental loop, execute routes in order
                while (i < n) {
                    cur = routes[i];
                    cur.route.matched.dispatch.apply(cur.route.matched, defaultArgs.concat(cur.params));
                    cur.isFirst = !i;
                    this.routed.dispatch.apply(this.routed, defaultArgs.concat([request, cur]));
                    i += 1;
                }
            } else {
                this._prevBypassedRequest = request;
                this.bypassed.dispatch.apply(this.bypassed, defaultArgs.concat([request]));
            }

            this._pipeParse(request, defaultArgs);
        },

        _notifyPrevRoutes : function(matchedRoutes, request) {
            var i = 0, prev;
            while (prev = this._prevRoutes[i++]) {
                //check if switched exist since route may be disposed
                if(prev.route.switched && this._didSwitch(prev.route, matchedRoutes)) {
                    prev.route.switched.dispatch(request);
                }
            }
        },

        _didSwitch : function (route, matchedRoutes){
            var matched,
                i = 0;
            while (matched = matchedRoutes[i++]) {
                // only dispatch switched if it is going to a different route
                if (matched.route === route) {
                    return false;
                }
            }
            return true;
        },

        _pipeParse : function(request, defaultArgs) {
            var i = 0, route;
            while (route = this._piped[i++]) {
                route.parse(request, defaultArgs);
            }
        },

        getNumRoutes : function () {
            return this._routes.length;
        },

        _sortedInsert : function (route) {
            //simplified insertion sort
            var routes = this._routes,
                n = routes.length;
            do { --n; } while (routes[n] && route._priority <= routes[n]._priority);
            routes.splice(n+1, 0, route);
        },

        _getMatchedRoutes : function (request) {
            var res = [],
                routes = this._routes,
                n = routes.length,
                route;
            //should be decrement loop since higher priorities are added at the end of array
            while (route = routes[--n]) {
                if ((!res.length || this.greedy || route.greedy) && route.match(request)) {
                    res.push({
                        route : route,
                        params : route._getParamsArray(request)
                    });
                }
                if (!this.greedyEnabled && res.length) {
                    break;
                }
            }
            return res;
        },

        pipe : function (otherRouter) {
            this._piped.push(otherRouter);
        },

        unpipe : function (otherRouter) {
            arrayRemove(this._piped, otherRouter);
        },

        toString : function () {
            return '[crossroads numRoutes:'+ this.getNumRoutes() +']';
        }
    };

    //"static" instance
    crossroads = new Crossroads();
    crossroads.VERSION = '0.12.0';

    crossroads.NORM_AS_ARRAY = function (req, vals) {
        return [vals.vals_];
    };

    crossroads.NORM_AS_OBJECT = function (req, vals) {
        return [vals];
    };


    // Route --------------
    //=====================

    /**
     * @constructor
     */
    function Route(pattern, callback, priority, router) {
        var isRegexPattern = isRegExp(pattern),
            patternLexer = router.patternLexer;
        this._router = router;
        this._pattern = pattern;
        this._paramsIds = isRegexPattern? null : patternLexer.getParamIds(pattern);
        this._optionalParamsIds = isRegexPattern? null : patternLexer.getOptionalParamsIds(pattern);
        this._matchRegexp = isRegexPattern? pattern : patternLexer.compilePattern(pattern, router.ignoreCase);
        this.matched = new signals.Signal();
        this.switched = new signals.Signal();
        if (callback) {
            this.matched.add(callback);
        }
        this._priority = priority || 0;
    }

    Route.prototype = {

        greedy : false,

        rules : void(0),

        match : function (request) {
            request = request || '';
            return this._matchRegexp.test(request) && this._validateParams(request); //validate params even if regexp because of `request_` rule.
        },

        _validateParams : function (request) {
            var rules = this.rules,
                values = this._getParamsObject(request),
                key;
            for (key in rules) {
                // normalize_ isn't a validation rule... (#39)
                if(key !== 'normalize_' && rules.hasOwnProperty(key) && ! this._isValidParam(request, key, values)){
                    return false;
                }
            }
            return true;
        },

        _isValidParam : function (request, prop, values) {
            var validationRule = this.rules[prop],
                val = values[prop],
                isValid = false,
                isQuery = (prop.indexOf('?') === 0);

            if (val == null && this._optionalParamsIds && arrayIndexOf(this._optionalParamsIds, prop) !== -1) {
                isValid = true;
            }
            else if (isRegExp(validationRule)) {
                if (isQuery) {
                    val = values[prop +'_']; //use raw string
                }
                isValid = validationRule.test(val);
            }
            else if (isArray(validationRule)) {
                if (isQuery) {
                    val = values[prop +'_']; //use raw string
                }
                isValid = this._isValidArrayRule(validationRule, val);
            }
            else if (isFunction(validationRule)) {
                isValid = validationRule(val, request, values);
            }

            return isValid; //fail silently if validationRule is from an unsupported type
        },

        _isValidArrayRule : function (arr, val) {
            if (! this._router.ignoreCase) {
                return arrayIndexOf(arr, val) !== -1;
            }

            if (typeof val === 'string') {
                val = val.toLowerCase();
            }

            var n = arr.length,
                item,
                compareVal;

            while (n--) {
                item = arr[n];
                compareVal = (typeof item === 'string')? item.toLowerCase() : item;
                if (compareVal === val) {
                    return true;
                }
            }
            return false;
        },

        _getParamsObject : function (request) {
            var shouldTypecast = this._router.shouldTypecast,
                values = this._router.patternLexer.getParamValues(request, this._matchRegexp, shouldTypecast),
                o = {},
                n = values.length,
                param, val;
            while (n--) {
                val = values[n];
                if (this._paramsIds) {
                    param = this._paramsIds[n];
                    if (param.indexOf('?') === 0 && val) {
                        //make a copy of the original string so array and
                        //RegExp validation can be applied properly
                        o[param +'_'] = val;
                        //update vals_ array as well since it will be used
                        //during dispatch
                        val = decodeQueryString(val, shouldTypecast);
                        values[n] = val;
                    }
                    // IE will capture optional groups as empty strings while other
                    // browsers will capture `undefined` so normalize behavior.
                    // see: #gh-58, #gh-59, #gh-60
                    if ( _hasOptionalGroupBug && val === '' && arrayIndexOf(this._optionalParamsIds, param) !== -1 ) {
                        val = void(0);
                        values[n] = val;
                    }
                    o[param] = val;
                }
                //alias to paths and for RegExp pattern
                o[n] = val;
            }
            o.request_ = shouldTypecast? typecastValue(request) : request;
            o.vals_ = values;
            return o;
        },

        _getParamsArray : function (request) {
            var norm = this.rules? this.rules.normalize_ : null,
                params;
            norm = norm || this._router.normalizeFn; // default normalize
            if (norm && isFunction(norm)) {
                params = norm(request, this._getParamsObject(request));
            } else {
                params = this._getParamsObject(request).vals_;
            }
            return params;
        },

        interpolate : function(replacements) {
            var str = this._router.patternLexer.interpolate(this._pattern, replacements);
            if (! this._validateParams(str) ) {
                throw new Error('Generated string doesn\'t validate against `Route.rules`.');
            }
            return str;
        },

        dispose : function () {
            this._router.removeRoute(this);
        },

        _destroy : function () {
            this.matched.dispose();
            this.switched.dispose();
            this.matched = this.switched = this._pattern = this._matchRegexp = null;
        },

        toString : function () {
            return '[Route pattern:"'+ this._pattern +'", numListeners:'+ this.matched.getNumListeners() +']';
        }

    };



    // Pattern Lexer ------
    //=====================

    Crossroads.prototype.patternLexer = (function () {

        var
            //match chars that should be escaped on string regexp
            ESCAPE_CHARS_REGEXP = /[\\.+*?\^$\[\](){}\/'#]/g,

            //trailing slashes (begin/end of string)
            LOOSE_SLASHES_REGEXP = /^\/|\/$/g,
            LEGACY_SLASHES_REGEXP = /\/$/g,

            //params - everything between `{ }` or `: :`
            PARAMS_REGEXP = /(?:\{|:)([^}:]+)(?:\}|:)/g,

            //used to save params during compile (avoid escaping things that
            //shouldn't be escaped).
            TOKENS = {
                'OS' : {
                    //optional slashes
                    //slash between `::` or `}:` or `\w:` or `:{?` or `}{?` or `\w{?`
                    rgx : /([:}]|\w(?=\/))\/?(:|(?:\{\?))/g,
                    save : '$1{{id}}$2',
                    res : '\\/?'
                },
                'RS' : {
                    //required slashes
                    //used to insert slash between `:{` and `}{`
                    rgx : /([:}])\/?(\{)/g,
                    save : '$1{{id}}$2',
                    res : '\\/'
                },
                'RQ' : {
                    //required query string - everything in between `{? }`
                    rgx : /\{\?([^}]+)\}/g,
                    //everything from `?` till `#` or end of string
                    res : '\\?([^#]+)'
                },
                'OQ' : {
                    //optional query string - everything in between `:? :`
                    rgx : /:\?([^:]+):/g,
                    //everything from `?` till `#` or end of string
                    res : '(?:\\?([^#]*))?'
                },
                'OR' : {
                    //optional rest - everything in between `: *:`
                    rgx : /:([^:]+)\*:/g,
                    res : '(.*)?' // optional group to avoid passing empty string as captured
                },
                'RR' : {
                    //rest param - everything in between `{ *}`
                    rgx : /\{([^}]+)\*\}/g,
                    res : '(.+)'
                },
                // required/optional params should come after rest segments
                'RP' : {
                    //required params - everything between `{ }`
                    rgx : /\{([^}]+)\}/g,
                    res : '([^\\/?]+)'
                },
                'OP' : {
                    //optional params - everything between `: :`
                    rgx : /:([^:]+):/g,
                    res : '([^\\/?]+)?\/?'
                }
            },

            LOOSE_SLASH = 1,
            STRICT_SLASH = 2,
            LEGACY_SLASH = 3,

            _slashMode = LOOSE_SLASH;


        function precompileTokens(){
            var key, cur;
            for (key in TOKENS) {
                if (TOKENS.hasOwnProperty(key)) {
                    cur = TOKENS[key];
                    cur.id = '__CR_'+ key +'__';
                    cur.save = ('save' in cur)? cur.save.replace('{{id}}', cur.id) : cur.id;
                    cur.rRestore = new RegExp(cur.id, 'g');
                }
            }
        }
        precompileTokens();


        function captureVals(regex, pattern) {
            var vals = [], match;
            // very important to reset lastIndex since RegExp can have "g" flag
            // and multiple runs might affect the result, specially if matching
            // same string multiple times on IE 7-8
            regex.lastIndex = 0;
            while (match = regex.exec(pattern)) {
                vals.push(match[1]);
            }
            return vals;
        }

        function getParamIds(pattern) {
            return captureVals(PARAMS_REGEXP, pattern);
        }

        function getOptionalParamsIds(pattern) {
            return captureVals(TOKENS.OP.rgx, pattern);
        }

        function compilePattern(pattern, ignoreCase) {
            pattern = pattern || '';

            if(pattern){
                if (_slashMode === LOOSE_SLASH) {
                    pattern = pattern.replace(LOOSE_SLASHES_REGEXP, '');
                }
                else if (_slashMode === LEGACY_SLASH) {
                    pattern = pattern.replace(LEGACY_SLASHES_REGEXP, '');
                }

                //save tokens
                pattern = replaceTokens(pattern, 'rgx', 'save');
                //regexp escape
                pattern = pattern.replace(ESCAPE_CHARS_REGEXP, '\\$&');
                //restore tokens
                pattern = replaceTokens(pattern, 'rRestore', 'res');

                if (_slashMode === LOOSE_SLASH) {
                    pattern = '\\/?'+ pattern;
                }
            }

            if (_slashMode !== STRICT_SLASH) {
                //single slash is treated as empty and end slash is optional
                pattern += '\\/?';
            }
            return new RegExp('^'+ pattern + '$', ignoreCase? 'i' : '');
        }

        function replaceTokens(pattern, regexpName, replaceName) {
            var cur, key;
            for (key in TOKENS) {
                if (TOKENS.hasOwnProperty(key)) {
                    cur = TOKENS[key];
                    pattern = pattern.replace(cur[regexpName], cur[replaceName]);
                }
            }
            return pattern;
        }

        function getParamValues(request, regexp, shouldTypecast) {
            var vals = regexp.exec(request);
            if (vals) {
                vals.shift();
                if (shouldTypecast) {
                    vals = typecastArrayValues(vals);
                }
            }
            return vals;
        }

        function interpolate(pattern, replacements) {
            if (typeof pattern !== 'string') {
                throw new Error('Route pattern should be a string.');
            }

            var replaceFn = function(match, prop){
                    var val;
                    prop = (prop.substr(0, 1) === '?')? prop.substr(1) : prop;
                    if (replacements[prop] != null) {
                        if (typeof replacements[prop] === 'object') {
                            var queryParts = [];
                            for(var key in replacements[prop]) {
                                queryParts.push(encodeURI(key + '=' + replacements[prop][key]));
                            }
                            val = '?' + queryParts.join('&');
                        } else {
                            // make sure value is a string see #gh-54
                            val = String(replacements[prop]);
                        }

                        if (match.indexOf('*') === -1 && val.indexOf('/') !== -1) {
                            throw new Error('Invalid value "'+ val +'" for segment "'+ match +'".');
                        }
                    }
                    else if (match.indexOf('{') !== -1) {
                        throw new Error('The segment '+ match +' is required.');
                    }
                    else {
                        val = '';
                    }
                    return val;
                };

            if (! TOKENS.OS.trail) {
                TOKENS.OS.trail = new RegExp('(?:'+ TOKENS.OS.id +')+$');
            }

            return pattern
                        .replace(TOKENS.OS.rgx, TOKENS.OS.save)
                        .replace(PARAMS_REGEXP, replaceFn)
                        .replace(TOKENS.OS.trail, '') // remove trailing
                        .replace(TOKENS.OS.rRestore, '/'); // add slash between segments
        }

        //API
        return {
            strict : function(){
                _slashMode = STRICT_SLASH;
            },
            loose : function(){
                _slashMode = LOOSE_SLASH;
            },
            legacy : function(){
                _slashMode = LEGACY_SLASH;
            },
            getParamIds : getParamIds,
            getOptionalParamsIds : getOptionalParamsIds,
            getParamValues : getParamValues,
            compilePattern : compilePattern,
            interpolate : interpolate
        };

    }());


    return crossroads;
};


return factory(window['signals']);


}());

/** @license MIT License (c) copyright 2011-2013 original author or authors */

/**
* Gaebolg note: The original when.js cannot be used outside amd/commonJS, so it was modified
* to be used inline in our file appending build, for the sake of simplicity.
*/

/**
 * A lightweight CommonJS Promises/A and when() implementation
 * when is part of the cujo.js family of libraries (http://cujojs.com/)
 *
 * Licensed under the MIT License at:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * @author Brian Cavalier
 * @author John Hann
 * @version 2.1.0
 */
var when = (function(global) {

  // Public API

  when.defer     = defer;      // Create a deferred
  when.resolve   = resolve;    // Create a resolved promise
  when.reject    = reject;     // Create a rejected promise

  when.join      = join;       // Join 2 or more promises

  when.all       = all;        // Resolve a list of promises
  when.map       = map;        // Array.map() for promises
  when.reduce    = reduce;     // Array.reduce() for promises
  when.settle    = settle;     // Settle a list of promises

  when.any       = any;        // One-winner race
  when.some      = some;       // Multi-winner race

  when.isPromise = isPromise;  // Determine if a thing is a promise

  when.promise   = promise;    // EXPERIMENTAL: May change. Use at your own risk

  /**
   * Register an observer for a promise or immediate value.
   *
   * @param {*} promiseOrValue
   * @param {function?} [onFulfilled] callback to be called when promiseOrValue is
   *   successfully fulfilled.  If promiseOrValue is an immediate value, callback
   *   will be invoked immediately.
   * @param {function?} [onRejected] callback to be called when promiseOrValue is
   *   rejected.
   * @param {function?} [onProgress] callback to be called when progress updates
   *   are issued for promiseOrValue.
   * @returns {Promise} a new {@link Promise} that will complete with the return
   *   value of callback or errback or the completion value of promiseOrValue if
   *   callback and/or errback is not supplied.
   */
  function when(promiseOrValue, onFulfilled, onRejected, onProgress) {
    // Get a trusted promise for the input promiseOrValue, and then
    // register promise handlers
    return resolve(promiseOrValue).then(onFulfilled, onRejected, onProgress);
  }

  /**
   * Trusted Promise constructor.  A Promise created from this constructor is
   * a trusted when.js promise.  Any other duck-typed promise is considered
   * untrusted.
   * @constructor
   * @name Promise
   */
  function Promise(then, inspect) {
    this.then = then;
    this.inspect = inspect;
  }

  Promise.prototype = {
    /**
     * Register a rejection handler.  Shortcut for .then(undefined, onRejected)
     * @param {function?} onRejected
     * @return {Promise}
     */
    otherwise: function(onRejected) {
      return this.then(undef, onRejected);
    },

    /**
     * Ensures that onFulfilledOrRejected will be called regardless of whether
     * this promise is fulfilled or rejected.  onFulfilledOrRejected WILL NOT
     * receive the promises' value or reason.  Any returned value will be disregarded.
     * onFulfilledOrRejected may throw or return a rejected promise to signal
     * an additional error.
     * @param {function} onFulfilledOrRejected handler to be called regardless of
     *  fulfillment or rejection
     * @returns {Promise}
     */
    ensure: function(onFulfilledOrRejected) {
      return this.then(injectHandler, injectHandler).yield(this);

      function injectHandler() {
        return resolve(onFulfilledOrRejected());
      }
    },

    /**
     * Shortcut for .then(function() { return value; })
     * @param  {*} value
     * @return {Promise} a promise that:
     *  - is fulfilled if value is not a promise, or
     *  - if value is a promise, will fulfill with its value, or reject
     *    with its reason.
     */
    'yield': function(value) {
      return this.then(function() {
        return value;
      });
    },

    /**
     * Assumes that this promise will fulfill with an array, and arranges
     * for the onFulfilled to be called with the array as its argument list
     * i.e. onFulfilled.apply(undefined, array).
     * @param {function} onFulfilled function to receive spread arguments
     * @return {Promise}
     */
    spread: function(onFulfilled) {
      return this.then(function(array) {
        // array may contain promises, so resolve its contents.
        return all(array, function(array) {
          return onFulfilled.apply(undef, array);
        });
      });
    },

    /**
     * Shortcut for .then(onFulfilledOrRejected, onFulfilledOrRejected)
     * @deprecated
     */
    always: function(onFulfilledOrRejected, onProgress) {
      return this.then(onFulfilledOrRejected, onFulfilledOrRejected, onProgress);
    }
  };

  /**
   * Returns a resolved promise. The returned promise will be
   *  - fulfilled with promiseOrValue if it is a value, or
   *  - if promiseOrValue is a promise
   *    - fulfilled with promiseOrValue's value after it is fulfilled
   *    - rejected with promiseOrValue's reason after it is rejected
   * @param  {*} value
   * @return {Promise}
   */
  function resolve(value) {
    return promise(function(resolve) {
      resolve(value);
    });
  }

  /**
   * Returns a rejected promise for the supplied promiseOrValue.  The returned
   * promise will be rejected with:
   * - promiseOrValue, if it is a value, or
   * - if promiseOrValue is a promise
   *   - promiseOrValue's value after it is fulfilled
   *   - promiseOrValue's reason after it is rejected
   * @param {*} promiseOrValue the rejected value of the returned {@link Promise}
   * @return {Promise} rejected {@link Promise}
   */
  function reject(promiseOrValue) {
    return when(promiseOrValue, rejected);
  }

  /**
   * Creates a new Deferred with fully isolated resolver and promise parts,
   * either or both of which may be given out safely to consumers.
   * The resolver has resolve, reject, and progress.  The promise
   * only has then.
   *
   * @return {{
   * promise: Promise,
   * resolve: function:Promise,
   * reject: function:Promise,
   * notify: function:Promise
   * resolver: {
   *  resolve: function:Promise,
   *  reject: function:Promise,
   *  notify: function:Promise
   * }}}
   */
  function defer() {
    var deferred, pending, resolved;

    // Optimize object shape
    deferred = {
      promise: undef, resolve: undef, reject: undef, notify: undef,
      resolver: { resolve: undef, reject: undef, notify: undef }
    };

    deferred.promise = pending = promise(makeDeferred);

    return deferred;

    function makeDeferred(resolvePending, rejectPending, notifyPending) {
      deferred.resolve = deferred.resolver.resolve = function(value) {
        if(resolved) {
          return resolve(value);
        }
        resolved = true;
        resolvePending(value);
        return pending;
      };

      deferred.reject  = deferred.resolver.reject  = function(reason) {
        if(resolved) {
          return resolve(rejected(reason));
        }
        resolved = true;
        rejectPending(reason);
        return pending;
      };

      deferred.notify  = deferred.resolver.notify  = function(update) {
        notifyPending(update);
        return update;
      };
    }
  }

  /**
   * Creates a new promise whose fate is determined by resolver.
   * @private (for now)
   * @param {function} resolver function(resolve, reject, notify)
   * @returns {Promise} promise whose fate is determine by resolver
   */
  function promise(resolver) {
    var value, handlers = [];

    // Call the provider resolver to seal the promise's fate
    try {
      resolver(promiseResolve, promiseReject, promiseNotify);
    } catch(e) {
      promiseReject(e);
    }

    // Return the promise
    return new Promise(then, inspect);

    /**
     * Register handlers for this promise.
     * @param [onFulfilled] {Function} fulfillment handler
     * @param [onRejected] {Function} rejection handler
     * @param [onProgress] {Function} progress handler
     * @return {Promise} new Promise
     */
    function then(onFulfilled, onRejected, onProgress) {
      return promise(function(resolve, reject, notify) {
        handlers
        // Call handlers later, after resolution
        ? handlers.push(function(value) {
          value.then(onFulfilled, onRejected, onProgress)
            .then(resolve, reject, notify);
        })
        // Call handlers soon, but not in the current stack
        : enqueue(function() {
          value.then(onFulfilled, onRejected, onProgress)
            .then(resolve, reject, notify);
        });
      });
    }

    function inspect() {
      return value ? value.inspect() : toPendingState();
    }

    /**
     * Transition from pre-resolution state to post-resolution state, notifying
     * all listeners of the ultimate fulfillment or rejection
     * @param {*|Promise} val resolution value
     */
    function promiseResolve(val) {
      if(!handlers) {
        return;
      }

      value = coerce(val);
      scheduleHandlers(handlers, value);

      handlers = undef;
    }

    /**
     * Reject this promise with the supplied reason, which will be used verbatim.
     * @param {*} reason reason for the rejection
     */
    function promiseReject(reason) {
      promiseResolve(rejected(reason));
    }

    /**
     * Issue a progress event, notifying all progress listeners
     * @param {*} update progress event payload to pass to all listeners
     */
    function promiseNotify(update) {
      if(handlers) {
        scheduleHandlers(handlers, progressing(update));
      }
    }
  }

  /**
   * Coerces x to a trusted Promise
   *
   * @private
   * @param {*} x thing to coerce
   * @returns {Promise} Guaranteed to return a trusted Promise.  If x
   *   is trusted, returns x, otherwise, returns a new, trusted, already-resolved
   *   Promise whose resolution value is:
   *   * the resolution value of x if it's a foreign promise, or
   *   * x if it's a value
   */
  function coerce(x) {
    if(x instanceof Promise) {
      return x;
    }

    if (!(x === Object(x) && 'then' in x)) {
      return fulfilled(x);
    }

    return promise(function(resolve, reject, notify) {
      enqueue(function() {
        try {
          // We must check and assimilate in the same tick, but not the
          // current tick, careful only to access promiseOrValue.then once.
          var untrustedThen = x.then;

          if(typeof untrustedThen === 'function') {
            fcall(untrustedThen, x, resolve, reject, notify);
          } else {
            // It's a value, create a fulfilled wrapper
            resolve(fulfilled(x));
          }

        } catch(e) {
          // Something went wrong, reject
          reject(e);
        }
      });
    });
  }

  /**
   * Create an already-fulfilled promise for the supplied value
   * @private
   * @param {*} value
   * @return {Promise} fulfilled promise
   */
  function fulfilled(value) {
    var self = new Promise(function (onFulfilled) {
      try {
        return typeof onFulfilled == 'function'
          ? coerce(onFulfilled(value)) : self;
      } catch (e) {
        return rejected(e);
      }
    }, function() {
      return toFulfilledState(value);
    });

    return self;
  }

  /**
   * Create an already-rejected promise with the supplied rejection reason.
   * @private
   * @param {*} reason
   * @return {Promise} rejected promise
   */
  function rejected(reason) {
    var self = new Promise(function (_, onRejected) {
      try {
        return typeof onRejected == 'function'
          ? coerce(onRejected(reason)) : self;
      } catch (e) {
        return rejected(e);
      }
    }, function() {
      return toRejectedState(reason);
    });

    return self;
  }

  /**
   * Create a progress promise with the supplied update.
   * @private
   * @param {*} update
   * @return {Promise} progress promise
   */
  function progressing(update) {
    var self = new Promise(function (_, __, onProgress) {
      try {
        return typeof onProgress == 'function'
          ? progressing(onProgress(update)) : self;
      } catch (e) {
        return progressing(e);
      }
    });

    return self;
  }

  /**
   * Schedule a task that will process a list of handlers
   * in the next queue drain run.
   * @private
   * @param {Array} handlers queue of handlers to execute
   * @param {*} value passed as the only arg to each handler
   */
  function scheduleHandlers(handlers, value) {
    enqueue(function() {
      var handler, i = 0;
      while (handler = handlers[i++]) {
        handler(value);
      }
    });
  }

  /**
   * Determines if promiseOrValue is a promise or not
   *
   * @param {*} promiseOrValue anything
   * @returns {boolean} true if promiseOrValue is a {@link Promise}
   */
  function isPromise(promiseOrValue) {
    return promiseOrValue && typeof promiseOrValue.then === 'function';
  }

  /**
   * Initiates a competitive race, returning a promise that will resolve when
   * howMany of the supplied promisesOrValues have resolved, or will reject when
   * it becomes impossible for howMany to resolve, for example, when
   * (promisesOrValues.length - howMany) + 1 input promises reject.
   *
   * @param {Array} promisesOrValues array of anything, may contain a mix
   *      of promises and values
   * @param howMany {number} number of promisesOrValues to resolve
   * @param {function?} [onFulfilled] DEPRECATED, use returnedPromise.then()
   * @param {function?} [onRejected] DEPRECATED, use returnedPromise.then()
   * @param {function?} [onProgress] DEPRECATED, use returnedPromise.then()
   * @returns {Promise} promise that will resolve to an array of howMany values that
   *  resolved first, or will reject with an array of
   *  (promisesOrValues.length - howMany) + 1 rejection reasons.
   */
  function some(promisesOrValues, howMany, onFulfilled, onRejected, onProgress) {

    return when(promisesOrValues, function(promisesOrValues) {

      return promise(resolveSome).then(onFulfilled, onRejected, onProgress);

      function resolveSome(resolve, reject, notify) {
        var toResolve, toReject, values, reasons, fulfillOne, rejectOne, len, i;

        len = promisesOrValues.length >>> 0;

        toResolve = Math.max(0, Math.min(howMany, len));
        values = [];

        toReject = (len - toResolve) + 1;
        reasons = [];

        // No items in the input, resolve immediately
        if (!toResolve) {
          resolve(values);

        } else {
          rejectOne = function(reason) {
            reasons.push(reason);
            if(!--toReject) {
              fulfillOne = rejectOne = identity;
              reject(reasons);
            }
          };

          fulfillOne = function(val) {
            // This orders the values based on promise resolution order
            values.push(val);
            if (!--toResolve) {
              fulfillOne = rejectOne = identity;
              resolve(values);
            }
          };

          for(i = 0; i < len; ++i) {
            if(i in promisesOrValues) {
              when(promisesOrValues[i], fulfiller, rejecter, notify);
            }
          }
        }

        function rejecter(reason) {
          rejectOne(reason);
        }

        function fulfiller(val) {
          fulfillOne(val);
        }
      }
    });
  }

  /**
   * Initiates a competitive race, returning a promise that will resolve when
   * any one of the supplied promisesOrValues has resolved or will reject when
   * *all* promisesOrValues have rejected.
   *
   * @param {Array|Promise} promisesOrValues array of anything, may contain a mix
   *      of {@link Promise}s and values
   * @param {function?} [onFulfilled] DEPRECATED, use returnedPromise.then()
   * @param {function?} [onRejected] DEPRECATED, use returnedPromise.then()
   * @param {function?} [onProgress] DEPRECATED, use returnedPromise.then()
   * @returns {Promise} promise that will resolve to the value that resolved first, or
   * will reject with an array of all rejected inputs.
   */
  function any(promisesOrValues, onFulfilled, onRejected, onProgress) {

    function unwrapSingleResult(val) {
      return onFulfilled ? onFulfilled(val[0]) : val[0];
    }

    return some(promisesOrValues, 1, unwrapSingleResult, onRejected, onProgress);
  }

  /**
   * Return a promise that will resolve only once all the supplied promisesOrValues
   * have resolved. The resolution value of the returned promise will be an array
   * containing the resolution values of each of the promisesOrValues.
   * @memberOf when
   *
   * @param {Array|Promise} promisesOrValues array of anything, may contain a mix
   *      of {@link Promise}s and values
   * @param {function?} [onFulfilled] DEPRECATED, use returnedPromise.then()
   * @param {function?} [onRejected] DEPRECATED, use returnedPromise.then()
   * @param {function?} [onProgress] DEPRECATED, use returnedPromise.then()
   * @returns {Promise}
   */
  function all(promisesOrValues, onFulfilled, onRejected, onProgress) {
    return _map(promisesOrValues, identity).then(onFulfilled, onRejected, onProgress);
  }

  /**
   * Joins multiple promises into a single returned promise.
   * @return {Promise} a promise that will fulfill when *all* the input promises
   * have fulfilled, or will reject when *any one* of the input promises rejects.
   */
  function join(/* ...promises */) {
    return _map(arguments, identity);
  }

  /**
   * Settles all input promises such that they are guaranteed not to
   * be pending once the returned promise fulfills. The returned promise
   * will always fulfill, except in the case where `array` is a promise
   * that rejects.
   * @param {Array|Promise} array or promise for array of promises to settle
   * @returns {Promise} promise that always fulfills with an array of
   *  outcome snapshots for each input promise.
   */
  function settle(array) {
    return _map(array, toFulfilledState, toRejectedState);
  }

  /**
   * Promise-aware array map function, similar to `Array.prototype.map()`,
   * but input array may contain promises or values.
   * @param {Array|Promise} array array of anything, may contain promises and values
   * @param {function} mapFunc map function which may return a promise or value
   * @returns {Promise} promise that will fulfill with an array of mapped values
   *  or reject if any input promise rejects.
   */
  function map(array, mapFunc) {
    return _map(array, mapFunc);
  }

  /**
   * Internal map that allows a fallback to handle rejections
   * @param {Array|Promise} array array of anything, may contain promises and values
   * @param {function} mapFunc map function which may return a promise or value
   * @param {function?} fallback function to handle rejected promises
   * @returns {Promise} promise that will fulfill with an array of mapped values
   *  or reject if any input promise rejects.
   */
  function _map(array, mapFunc, fallback) {
    return when(array, function(array) {

      return promise(resolveMap);

      function resolveMap(resolve, reject, notify) {
        var results, len, toResolve, resolveOne, i;

        // Since we know the resulting length, we can preallocate the results
        // array to avoid array expansions.
        toResolve = len = array.length >>> 0;
        results = [];

        if(!toResolve) {
          resolve(results);
          return;
        }

        resolveOne = function(item, i) {
          when(item, mapFunc, fallback).then(function(mapped) {
            results[i] = mapped;

            if(!--toResolve) {
              resolve(results);
            }
          }, reject, notify);
        };

        // Since mapFunc may be async, get all invocations of it into flight
        for(i = 0; i < len; i++) {
          if(i in array) {
            resolveOne(array[i], i);
          } else {
            --toResolve;
          }
        }
      }
    });
  }

  /**
   * Traditional reduce function, similar to `Array.prototype.reduce()`, but
   * input may contain promises and/or values, and reduceFunc
   * may return either a value or a promise, *and* initialValue may
   * be a promise for the starting value.
   *
   * @param {Array|Promise} promise array or promise for an array of anything,
   *      may contain a mix of promises and values.
   * @param {function} reduceFunc reduce function reduce(currentValue, nextValue, index, total),
   *      where total is the total number of items being reduced, and will be the same
   *      in each call to reduceFunc.
   * @returns {Promise} that will resolve to the final reduced value
   */
  function reduce(promise, reduceFunc /*, initialValue */) {
    var args = fcall(slice, arguments, 1);

    return when(promise, function(array) {
      var total;

      total = array.length;

      // Wrap the supplied reduceFunc with one that handles promises and then
      // delegates to the supplied.
      args[0] = function (current, val, i) {
        return when(current, function (c) {
          return when(val, function (value) {
            return reduceFunc(c, value, i, total);
          });
        });
      };

      return reduceArray.apply(array, args);
    });
  }

  // Snapshot states

  /**
   * Creates a fulfilled state snapshot
   * @private
   * @param {*} x any value
   * @returns {{state:'fulfilled',value:*}}
   */
  function toFulfilledState(x) {
    return { state: 'fulfilled', value: x };
  }

  /**
   * Creates a rejected state snapshot
   * @private
   * @param {*} x any reason
   * @returns {{state:'rejected',reason:*}}
   */
  function toRejectedState(x) {
    return { state: 'rejected', reason: x };
  }

  /**
   * Creates a pending state snapshot
   * @private
   * @returns {{state:'pending'}}
   */
  function toPendingState() {
    return { state: 'pending' };
  }

  //
  // Utilities, etc.
  //

  var reduceArray, slice, fcall, nextTick, handlerQueue,
    setTimeout, funcProto, call, arrayProto, undef;

  //
  // Shared handler queue processing
  //
  // Credit to Twisol (https://github.com/Twisol) for suggesting
  // this type of extensible queue + trampoline approach for
  // next-tick conflation.

  handlerQueue = [];

  /**
   * Enqueue a task. If the queue is not currently scheduled to be
   * drained, schedule it.
   * @param {function} task
   */
  function enqueue(task) {
    if(handlerQueue.push(task) === 1) {
      scheduleDrainQueue();
    }
  }

  /**
   * Schedule the queue to be drained after the stack has cleared.
   */
  function scheduleDrainQueue() {
    nextTick(drainQueue);
  }

  /**
   * Drain the handler queue entirely, being careful to allow the
   * queue to be extended while it is being processed, and to continue
   * processing until it is truly empty.
   */
  function drainQueue() {
    var task, i = 0;

    while(task = handlerQueue[i++]) {
      task();
    }

    handlerQueue = [];
  }

  //
  // Capture function and array utils
  //
  /*global setImmediate,process,vertx*/

  // capture setTimeout to avoid being caught by fake timers used in time based tests
  setTimeout = global.setTimeout;
  // Prefer setImmediate, cascade to node, vertx and finally setTimeout
  nextTick = typeof setImmediate === 'function' ? setImmediate.bind(global)
    : typeof process === 'object' && process.nextTick ? process.nextTick
    : typeof vertx === 'object' ? vertx.runOnLoop // vert.x
      : function(task) { setTimeout(task, 0); }; // fallback

  // Safe function calls
  funcProto = Function.prototype;
  call = funcProto.call;
  fcall = funcProto.bind
    ? call.bind(call)
    : function(f, context) {
      return f.apply(context, slice.call(arguments, 2));
    };

  // Safe array ops
  arrayProto = [];
  slice = arrayProto.slice;

  // ES5 reduce implementation if native not available
  // See: http://es5.github.com/#x15.4.4.21 as there are many
  // specifics and edge cases.  ES5 dictates that reduce.length === 1
  // This implementation deviates from ES5 spec in the following ways:
  // 1. It does not check if reduceFunc is a Callable
  reduceArray = arrayProto.reduce ||
    function(reduceFunc /*, initialValue */) {
      /*jshint maxcomplexity: 7*/
      var arr, args, reduced, len, i;

      i = 0;
      arr = Object(this);
      len = arr.length >>> 0;
      args = arguments;

      // If no initialValue, use first item of array (we know length !== 0 here)
      // and adjust i to start at second item
      if(args.length <= 1) {
        // Skip to the first real element in the array
        for(;;) {
          if(i in arr) {
            reduced = arr[i++];
            break;
          }

          // If we reached the end of the array without finding any real
          // elements, it's a TypeError
          if(++i >= len) {
            throw new TypeError();
          }
        }
      } else {
        // If initialValue provided, use it
        reduced = args[1];
      }

      // Do the actual reduce
      for(;i < len; ++i) {
        if(i in arr) {
          reduced = reduceFunc(reduced, arr[i], i, arr);
        }
      }

      return reduced;
    };

  function identity(x) {
    return x;
  }

  return when;

})(this);
/*
 * History API JavaScript Library v4.0.0
 *
 * Support: IE8+, FF3+, Opera 9+, Safari, Chrome and other
 *
 * Copyright 2011-2013, Dmitrii Pakhtinov ( spb.piksel@gmail.com )
 *
 * http://spb-piksel.ru/
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 * Update: 19.05.13 22:46
 */
(function(window) {
    // symlink to document
    var document = window.document;
    // HTML element
    var documentElement = document.documentElement;
    // symlink to sessionStorage
    var sessionStorage = window['sessionStorage'];
    // symlink to constructor of Object
    var Object = window['Object'];
    // symlink to JSON Object
    var JSON = window['JSON'];
    // symlink to instance object of 'Location'
    var windowLocation = window.location;
    // symlink to instance object of 'History'
    var windowHistory = window.history;
    // new instance of 'History'. The default is a reference to the original object instance
    var historyObject = windowHistory;
    // symlink to method 'history.pushState'
    var historyPushState = windowHistory.pushState;
    // symlink to method 'history.replaceState'
    var historyReplaceState = windowHistory.replaceState;
    // if the browser supports HTML5-History-API
    var isSupportHistoryAPI = !!historyPushState;
    // verifies the presence of an object 'state' in interface 'History'
    var isSupportStateObjectInHistory = 'state' in windowHistory;
    // symlink to method 'Object.defineProperty'
    var defineProperty = Object.defineProperty;
    // new instance of 'Location', for IE8 will use the element HTMLAnchorElement, instead of pure object
    var locationObject = redefineProperty({}, 't') ? {} : document.createElement('a');
    // prefix for the names of events
    var eventNamePrefix = '';
    // String that will contain the name of the method
    var addEventListenerName = window.addEventListener ? 'addEventListener' : (eventNamePrefix = 'on') && 'attachEvent';
    // String that will contain the name of the method
    var removeEventListenerName = window.removeEventListener ? 'removeEventListener' : 'detachEvent';
    // String that will contain the name of the method
    var dispatchEventName = window.dispatchEvent ? 'dispatchEvent' : 'fireEvent';
    // reference native methods for the events
    var addEvent = window[addEventListenerName];
    var removeEvent = window[removeEventListenerName];
    var dispatch = window[dispatchEventName];
    // default settings
    var settings = {"basepath": '/', "redirect": 0, "type": '/'};
    // key for the sessionStorage
    var sessionStorageKey = '__historyAPI__';
    // Anchor Element for parseURL function
    var anchorElement = document.createElement('a');
    // last URL before change to new URL
    var lastURL = windowLocation.href;
    // Control URL, need to fix the bug in Opera
    var checkUrlForPopState = '';
    // trigger event 'onpopstate' on page load
    var isFireInitialState = false;
    // store a list of 'state' objects in the current session
    var stateStorage = {};
    // in this object will be stored custom handlers
    var eventsList = {};

    /**
     * Properties that will be replaced in the global
     * object 'window', to prevent conflicts
     *
     * @type {Object}
     */
    var eventsDescriptors = {
        "onhashchange": null,
        "onpopstate": null
    };

    /**
     * Properties that will be replaced/added to object
     * 'window.history', includes the object 'history.location',
     * for a complete the work with the URL address
     *
     * @type {Object}
     */
    var historyDescriptors = {
        /**
         * @namespace history
         * @param {String} [type]
         * @param {String} [basepath]
         */
        "redirect": function(type, basepath) {
            settings["basepath"] = basepath = basepath == null ? settings["basepath"] : basepath;
            settings["type"] = type = type == null ? settings["type"] : type;
            if (window.top == window.self) {
                var relative = parseURL(null, false, true)._relative;
                var search = windowLocation.search;
                var path = windowLocation.pathname;
                if (isSupportHistoryAPI) {
                    if (relative != basepath && (new RegExp("^" + basepath + "$", "i")).test(path)) {
                        windowLocation.replace(relative);
                    }
                    if ((new RegExp("^" + basepath + "$", "i")).test(path + '/')) {
                        windowLocation.replace(basepath);
                    } else if (!(new RegExp("^" + basepath, "i")).test(path)) {
                        windowLocation.replace(path.replace(/^\//, basepath) + search);
                    }
                } else if (path != basepath) {
                    windowLocation.replace(basepath + '#' + path.
                        replace(new RegExp("^" + basepath, "i"), type) + search + windowLocation.hash);
                }
            }
        },
        /**
         * The method adds a state object entry
         * to the history.
         *
         * @namespace history
         * @param {Object} state
         * @param {string} title
         * @param {string} [url]
         */
        pushState: function(state, title, url) {
            historyPushState && historyPushState.apply(windowHistory, arguments);
            changeState(state, url);
        },
        /**
         * The method updates the state object,
         * title, and optionally the URL of the
         * current entry in the history.
         *
         * @namespace history
         * @param {Object} state
         * @param {string} title
         * @param {string} [url]
         */
        replaceState: function(state, title, url) {
            delete stateStorage[windowLocation.href];
            historyReplaceState && historyReplaceState.apply(windowHistory, arguments);
            changeState(state, url, true);
        },
        /**
         * Object 'history.location' is similar to the
         * object 'window.location', except that in
         * HTML4 browsers it will behave a bit differently
         *
         * @namespace history
         */
        "location": {
            set: function(value) {
                window.location = value;
            },
            get: function() {
                return isSupportHistoryAPI ? windowLocation : locationObject;
            }
        },
        /**
         * A state object is an object representing
         * a user interface state.
         *
         * @namespace history
         */
        "state": {
            get: function() {
                return stateStorage[windowLocation.href] || null;
            }
        }
    };

    /**
     * Properties for object 'history.location'.
     * Object 'history.location' is similar to the
     * object 'window.location', except that in
     * HTML4 browsers it will behave a bit differently
     *
     * @type {Object}
     */
    var locationDescriptors = {
        /**
         * Navigates to the given page.
         *
         * @namespace history.location
         */
        assign: function(url) {
            if (('' + url).indexOf('#') === 0) {
                changeState(null, url);
            } else {
                windowLocation.assign(url);
            }
        },
        /**
         * Reloads the current page.
         *
         * @namespace history.location
         */
        reload: function() {
            windowLocation.reload();
        },
        /**
         * Removes the current page from
         * the session history and navigates
         * to the given page.
         *
         * @namespace history.location
         */
        replace: function(url) {
            if (('' + url).indexOf('#') === 0) {
                changeState(null, url, true);
            } else {
                windowLocation.replace(url);
            }
        },
        /**
         * Returns the current page's location.
         *
         * @namespace history.location
         */
        toString: function() {
            return this.href;
        },
        /**
         * Returns the current page's location.
         * Can be set, to navigate to another page.
         *
         * @namespace history.location
         */
        "href": {
            get: function() {
                return parseURL()._href;
            }
        },
        /**
         * Returns the current page's protocol.
         *
         * @namespace history.location
         */
        "protocol": null,
        /**
         * Returns the current page's host and port number.
         *
         * @namespace history.location
         */
        "host": null,
        /**
         * Returns the current page's host.
         *
         * @namespace history.location
         */
        "hostname": null,
        /**
         * Returns the current page's port number.
         *
         * @namespace history.location
         */
        "port": null,
        /**
         * Returns the current page's path only.
         *
         * @namespace history.location
         */
        "pathname": {
            get: function() {
                return parseURL()._pathname;
            }
        },
        /**
         * Returns the current page's search
         * string, beginning with the character
         * '?' and to the symbol '#'
         *
         * @namespace history.location
         */
        "search": {
            get: function() {
                return parseURL()._search;
            }
        },
        /**
         * Returns the current page's hash
         * string, beginning with the character
         * '#' and to the end line
         *
         * @namespace history.location
         */
        "hash": {
            set: function(value) {
                changeState(null, ('' + value).replace(/^(#|)/, '#'), false, lastURL);
            },
            get: function() {
                return parseURL()._hash;
            }
        }
    };

    /**
     * Just empty function
     *
     * @return void
     */
    function emptyFunction() {
        // dummy
    }

    /**
     * Prepares a parts of the current or specified reference for later use in the library
     *
     * @param {string} [href]
     * @param {boolean} [isWindowLocation]
     * @param {boolean} [isNotAPI]
     * @return {Object}
     */
    function parseURL(href, isWindowLocation, isNotAPI) {
        var re = /(?:([\w0-9]+:))?(?:\/\/(?:[^@]*@)?([^\/:\?#]+)(?::([0-9]+))?)?([^\?#]*)(?:(\?[^#]+)|\?)?(?:(#.*))?/;
        if (href && !isWindowLocation) {
            var current = parseURL(), _pathname = current._pathname, _protocol = current._protocol;
            // convert relative link to the absolute
            href = /^(?:[\w0-9]+\:)?\/\//.test(href) ? href.indexOf("/") === 0
                ? _protocol + href : href : _protocol + "//" + current._host + (
                href.indexOf("/") === 0 ? href : href.indexOf("?") === 0
                    ? _pathname + href : href.indexOf("#") === 0
                    ? _pathname + current._search + href : _pathname.replace(/[^\/]+$/g, '') + href
                );
        } else {
            href = isWindowLocation ? href : windowLocation.href;
            // if current browser not support History-API
            if (!isSupportHistoryAPI || isNotAPI) {
                // get hash fragment
                href = href.replace(/^[^#]*/, '') || "#";
                // form the absolute link from the hash
                href = windowLocation.protocol + '//' + windowLocation.host + settings['basepath']
                    + href.replace(new RegExp("^#[\/]?(?:" + settings["type"] + ")?"), "");
            }
        }
        // that would get rid of the links of the form: /../../
        anchorElement.href = href;
        // decompose the link in parts
        var result = re.exec(anchorElement.href);
        // host name with the port number
        var host = result[2] + (result[3] ? ':' + result[3] : '');
        // folder
        var pathname = result[4] || '/';
        // the query string
        var search = result[5] || '';
        // hash
        var hash = result[6] === '#' ? '' : (result[6] || '');
        // relative link, no protocol, no host
        var relative = pathname + search + hash;
        // special links for set to hash-link, if browser not support History API
        var nohash = pathname.replace(new RegExp("^" + settings["basepath"], "i"), settings["type"]) + search;
        // result
        return {
            _href: result[1] + '//' + host + relative,
            _protocol: result[1],
            _host: host,
            _hostname: result[2],
            _port: result[3] || '',
            _pathname: pathname,
            _search: search,
            _hash: hash,
            _relative: relative,
            _nohash: nohash,
            _special: nohash + hash
        }
    }

    /**
     * Initializing storage for the custom state's object
     */
    function storageInitialize(JSON) {
        var storage = '';
        if (sessionStorage) {
            // get cache from the storage in browser
            storage += sessionStorage.getItem(sessionStorageKey);
        } else {
            var cookie = document.cookie.split(sessionStorageKey + "=");
            if (cookie.length > 1) {
                storage += (cookie.pop().split(";").shift() || 'null');
            }
        }
        try {
            stateStorage = JSON.parse(storage) || {};
        } catch(_e_) {
            stateStorage = {};
        }
        // hang up the event handler to event unload page
        addEvent(eventNamePrefix + 'unload', function() {
            if (sessionStorage) {
                // save current state's object
                sessionStorage.setItem(sessionStorageKey, JSON.stringify(stateStorage));
            } else {
                // save the current 'state' in the cookie
                var state = {};
                if (state[windowLocation.href] = historyObject.state) {
                    document.cookie = sessionStorageKey + '=' + JSON.stringify(state);
                }
            }
        }, false);
    }

    /**
     * This method is implemented to override the built-in(native)
     * properties in the browser, unfortunately some browsers are
     * not allowed to override all the properties and even add.
     * For this reason, this was written by a method that tries to
     * do everything necessary to get the desired result.
     *
     * @param {Object} object The object in which will be overridden/added property
     * @param {String} prop The property name to be overridden/added
     * @param {Object} [descriptor] An object containing properties set/get
     * @param {Function} [onWrapped] The function to be called when the wrapper is created
     * @return {Object|Boolean} Returns an object on success, otherwise returns false
     */
    function redefineProperty(object, prop, descriptor, onWrapped) {
        // test only if descriptor is undefined
        descriptor = descriptor || {set: emptyFunction};
        // variable will have a value of true the success of attempts to set descriptors
        var isDefinedSetter = !descriptor.set;
        var isDefinedGetter = !descriptor.get;
        // for tests of attempts to set descriptors
        var test = {configurable: true, set: function() {
            isDefinedSetter = 1;
        }, get: function() {
            isDefinedGetter = 1;
        }};

        try {
            // testing for the possibility of overriding/adding properties
            defineProperty(object, prop, test);
            // running the test
            object[prop] = object[prop];
            // attempt to override property using the standard method
            defineProperty(object, prop, descriptor);
        } catch(_e_) {
        }

        // If the variable 'isDefined' has a false value, it means that need to try other methods
        if (!isDefinedSetter || !isDefinedGetter) {
            // try to override/add the property, using deprecated functions
            if (object.__defineGetter__) {
                // testing for the possibility of overriding/adding properties
                object.__defineGetter__(prop, test.get);
                object.__defineSetter__(prop, test.set);
                // running the test
                object[prop] = object[prop];
                // attempt to override property using the deprecated functions
                descriptor.get && object.__defineGetter__(prop, descriptor.get);
                descriptor.set && object.__defineSetter__(prop, descriptor.set);
            }

            // Browser refused to override the property, using the standard and deprecated methods
            if ((!isDefinedSetter || !isDefinedGetter) && object === window) {
                try {
                    // save original value from this property
                    var originalValue = object[prop];
                    // set null to built-in(native) property
                    object[prop] = null;
                } catch(_e_) {
                }
                // This rule for Internet Explorer 8
                if ('execScript' in window) {
                    /**
                     * to IE8 override the global properties using
                     * VBScript, declaring it in global scope with
                     * the same names.
                     */
                    window['execScript']('Public ' + prop, 'VBScript');
                } else {
                    try {
                        /**
                         * This hack allows to override a property
                         * with the set 'configurable: false', working
                         * in the hack 'Safari' to 'Mac'
                         */
                        defineProperty(object, prop, {value: emptyFunction});
                    } catch(_e_) {
                    }
                }
                // set old value to new variable
                object[prop] = originalValue;

            } else if (!isDefinedSetter || !isDefinedGetter) {
                // the last stage of trying to override the property
                try {
                    try {
                        // wrap the object in a new empty object
                        var temp = Object.create(object);
                        defineProperty(Object.getPrototypeOf(temp) === object ? temp : object, prop, descriptor);
                        for(var key in object) {
                            // need to bind a function to the original object
                            if (typeof object[key] === 'function') {
                                temp[key] = object[key].bind(object);
                            }
                        }
                        try {
                            // to run a function that will inform about what the object was to wrapped
                            onWrapped.call(temp, temp, object);
                        } catch(_e_) {
                        }
                        object = temp;
                    } catch(_e_) {
                        // sometimes works override simply by assigning the prototype property of the constructor
                        defineProperty(object.constructor.prototype, prop, descriptor);
                    }
                } catch(_e_) {
                    // all methods have failed
                    return false;
                }
            }
        }

        return object;
    }

    /**
     * Adds the missing property in descriptor
     *
     * @param {Object} object An object that stores values
     * @param {String} prop Name of the property in the object
     * @param {Object|null} descriptor Descriptor
     * @return {Object} Returns the generated descriptor
     */
    function prepareDescriptorsForObject(object, prop, descriptor) {
        descriptor = descriptor || {};
        // the default for the object 'location' is the standard object 'window.location'
        object = object === locationDescriptors ? windowLocation : object;
        // setter for object properties
        descriptor.set = (descriptor.set || function(value) {
            object[prop] = value;
        });
        // getter for object properties
        descriptor.get = (descriptor.get || function() {
            return object[prop];
        });
        return descriptor;
    }

    /**
     * Wrapper for the methods 'addEventListener/attachEvent' in the context of the 'window'
     *
     * @param {String} event The event type for which the user is registering
     * @param {Function} listener The method to be called when the event occurs.
     * @param {Boolean} capture If true, capture indicates that the user wishes to initiate capture.
     * @return void
     */
    function addEventListener(event, listener, capture) {
        if (event in eventsList) {
            // here stored the event listeners 'popstate/hashchange'
            eventsList[event].push(listener);
        } else {
            // FireFox support non-standart four argument aWantsUntrusted
            // https://github.com/devote/HTML5-History-API/issues/13
            if (arguments.length > 3) {
                addEvent(event, listener, capture, arguments[3]);
            } else {
                addEvent(event, listener, capture);
            }
        }
    }

    /**
     * Wrapper for the methods 'removeEventListener/detachEvent' in the context of the 'window'
     *
     * @param {String} event The event type for which the user is registered
     * @param {Function} listener The parameter indicates the Listener to be removed.
     * @param {Boolean} capture Was registered as a capturing listener or not.
     * @return void
     */
    function removeEventListener(event, listener, capture) {
        var list = eventsList[event];
        if (list) {
            for(var i = list.length; --i;) {
                if (list[i] === listener) {
                    list.splice(i, 1);
                    break;
                }
            }
        } else {
            removeEvent(event, listener, capture);
        }
    }

    /**
     * Wrapper for the methods 'dispatchEvent/fireEvent' in the context of the 'window'
     *
     * @param {Event|String} event Instance of Event or event type string if 'eventObject' used
     * @param {*} [eventObject] For Internet Explorer 8 required event object on this argument
     * @return {Boolean} If 'preventDefault' was called the value is false, else the value is true.
     */
    function dispatchEvent(event, eventObject) {
        var eventType = ('' + (typeof event === "string" ? event : event.type)).replace(/^on/, '');
        var list = eventsList[eventType];
        if (list) {
            // need to understand that there is one object of Event
            eventObject = typeof event === "string" ? eventObject : event;
            if (eventObject.target == null) {
                // need to override some of the properties of the Event object
                for(var props = ['target', 'currentTarget', 'srcElement', 'type']; event = props.pop();) {
                    // use 'redefineProperty' to override the properties
                    eventObject = redefineProperty(eventObject, event, {
                        get: event === 'type' ? function() {
                            return eventType;
                        } : function() {
                            return window;
                        }
                    });
                }
            }
            // run function defined in the attributes 'onpopstate/onhashchange' in the 'window' context
            ((eventType === 'popstate' ? window.onpopstate : window.onhashchange)
                || emptyFunction).call(window, eventObject);
            // run other functions that are in the list of handlers
            for(var i = 0, len = list.length; i < len; i++) {
                list[i].call(window, eventObject);
            }
            return true;
        } else {
            return dispatch(event, eventObject);
        }
    }

    /**
     * dispatch current state event
     */
    function firePopState() {
        var o = document.createEvent ? document.createEvent('Event') : document.createEventObject();
        if (o.initEvent) {
            o.initEvent('popstate', false, false);
        } else {
            o.type = 'popstate';
        }
        o.state = historyObject.state;
        // send a newly created events to be processed
        dispatchEvent(o);
    }

    /**
     * fire initial state for non-HTML5 browsers
     */
    function fireInitialState() {
        if (isFireInitialState) {
            isFireInitialState = false;
            firePopState();
        }
    }

    /**
     * Change the data of the current history for HTML4 browsers
     *
     * @param {Object} state
     * @param {string} [url]
     * @param {Boolean} [replace]
     * @param {string} [lastURLValue]
     * @return void
     */
    function changeState(state, url, replace, lastURLValue) {
        if (!isSupportHistoryAPI) {
            // normalization url
            var urlObject = parseURL(url);
            // if current url not equal new url
            if (urlObject._relative !== parseURL()._relative) {
                // if empty lastURLValue to skip hash change event
                lastURL = lastURLValue;
                if (replace) {
                    // only replace hash, not store to history
                    windowLocation.replace("#" + urlObject._special);
                } else {
                    // change hash and add new record to history
                    windowLocation.hash = urlObject._special;
                }
            }
        }
        if (!isSupportStateObjectInHistory && state) {
            stateStorage[windowLocation.href] = state;
        }
        isFireInitialState = false;
    }

    /**
     * Event handler function changes the hash in the address bar
     *
     * @param {Event} event
     * @return void
     */
    function onHashChange(event) {
        // if not empty lastURL, otherwise skipped the current handler event
        if (lastURL) {
            // if checkUrlForPopState equal current url, this means that the event was raised popstate browser
            if (checkUrlForPopState !== windowLocation.href) {
                // otherwise,
                // the browser does not support popstate event or just does not run the event by changing the hash.
                firePopState();
            }
            // current event object
            event = event || window.event;

            var oldURLObject = parseURL(lastURL, true);
            var newURLObject = parseURL();
            // HTML4 browser not support properties oldURL/newURL
            if (!event.oldURL) {
                event.oldURL = oldURLObject._href;
                event.newURL = newURLObject._href;
            }
            if (oldURLObject._hash !== newURLObject._hash) {
                // if current hash not equal previous hash
                dispatchEvent(event);
            }
        }
        // new value to lastURL
        lastURL = windowLocation.href;
    }

    /**
     * The event handler is fully loaded document
     *
     * @param {*} [noScroll]
     * @return void
     */
    function onLoad(noScroll) {
        // Get rid of the events popstate when the first loading a document in the webkit browsers
        setTimeout(function() {
            // hang up the event handler for the built-in popstate event in the browser
            addEvent('popstate', function(e) {
                // set the current url, that suppress the creation of the popstate event by changing the hash
                checkUrlForPopState = windowLocation.href;
                // for Safari browser in OS Windows not implemented 'state' object in 'History' interface
                // and not implemented in old HTML4 browsers
                if (!isSupportStateObjectInHistory) {
                    e = redefineProperty(e, 'state', {get: function() {
                        return historyObject.state;
                    }});
                }
                // send events to be processed
                dispatchEvent(e);
            }, false);
        }, 0);
        // for non-HTML5 browsers
        if (!isSupportHistoryAPI && noScroll !== true && historyObject.location) {
            // scroll window to anchor element
            scrollToAnchorId(historyObject.location.hash);
            // fire initial state for non-HTML5 browser after load page
            fireInitialState();
        }
    }

    /**
     * handler url with anchor for non-HTML5 browsers
     *
     * @param e
     */
    function onAnchorClick(e) {
        var event = e || window.event;
        var target = event.target || event.srcElement;
        var defaultPrevented = "defaultPrevented" in event ? event['defaultPrevented'] : event.returnValue === false;
        if (target && target.nodeName === "A" && !defaultPrevented) {
            var current = parseURL();
            var expect = parseURL(target.getAttribute("href", 2));
            var isEqualBaseURL = current._href.split('#').shift() === expect._href.split('#').shift();
            if (isEqualBaseURL) {
                if (current._hash !== expect._hash) {
                    historyObject.location.hash = expect._hash;
                }
                scrollToAnchorId(expect._hash);
                if (event.preventDefault) {
                    event.preventDefault();
                } else {
                    event.returnValue = false;
                }
            }
        }
    }

    /**
     * Scroll page to current anchor in url-hash
     *
     * @param hash
     */
    function scrollToAnchorId(hash) {
        var target = document.getElementById(hash = (hash || '').replace(/^#/, ''));
        if (target && target.id === hash && target.nodeName === "A") {
            var rect = target.getBoundingClientRect();
            window.scrollTo((documentElement.scrollLeft || 0), rect.top + (documentElement.scrollTop || 0)
                - (documentElement.clientTop || 0));
        }
    }

    /**
     * Library initialization
     *
     * @return {Boolean} return true if all is well, otherwise return false value
     */
    function initialize() {
        /**
         * Get custom settings from the query string
         */
        var scripts = document.getElementsByTagName('script');
        var src = (scripts[scripts.length - 1] || {}).src || '';
        var arg = src.indexOf('?') !== -1 ? src.split('?').pop() : '';
        arg.replace(/(\w+)(?:=([^&]*))?/g, function(a, key, value) {
            settings[key] = (value || (key === 'basepath' ? '/' : '')).replace(/^(0|false)$/, '');
        });

        /**
         * hang up the event handler to listen to the events hashchange
         */
        addEvent(eventNamePrefix + 'hashchange', onHashChange, false);

        // a list of objects with pairs of descriptors/object
        var data = [locationDescriptors, locationObject, eventsDescriptors, window, historyDescriptors, historyObject];

        // if browser support object 'state' in interface 'History'
        if (isSupportStateObjectInHistory) {
            // remove state property from descriptor
            delete historyDescriptors['state'];
        }

        // initializing descriptors
        for(var i = 0; i < data.length; i += 2) {
            for(var prop in data[i]) {
                if (data[i].hasOwnProperty(prop)) {
                    if (typeof data[i][prop] === 'function') {
                        // If the descriptor is a simple function, simply just assign it an object
                        data[i + 1][prop] = data[i][prop];
                    } else {
                        // prepare the descriptor the required format
                        var descriptor = prepareDescriptorsForObject(data[i], prop, data[i][prop]);
                        // try to set the descriptor object
                        if (!redefineProperty(data[i + 1], prop, descriptor, function(n, o) {
                            // is satisfied if the failed override property
                            if (o === historyObject) {
                                // the problem occurs in Safari on the Mac
                                window.history = historyObject = data[i + 1] = n;
                            }
                        })) {
                            // if there is no possibility override.
                            // This browser does not support descriptors, such as IE7

                            // remove previously hung event handlers
                            removeEvent(eventNamePrefix + 'hashchange', onHashChange, false);

                            // fail to initialize :(
                            return false;
                        }

                        // create a repository for custom handlers onpopstate/onhashchange
                        if (data[i + 1] === window) {
                            eventsList[prop] = eventsList[prop.substr(2)] = [];
                        }
                    }
                }
            }
        }

        // redirect if necessary
        if (settings['redirect']) {
            historyObject['redirect']();
        }

        // If browser does not support object 'state' in interface 'History'
        if (!isSupportStateObjectInHistory && JSON) {
            storageInitialize(JSON);
        }

        // track clicks on anchors
        if (!isSupportHistoryAPI) {
            document[addEventListenerName](eventNamePrefix + "click", onAnchorClick, false);
        }

        if (document.readyState === 'complete') {
            onLoad(true);
        } else {
            if (!isSupportHistoryAPI && parseURL()._relative !== settings["basepath"]) {
                isFireInitialState = true;
            }
            /**
             * Need to avoid triggering events popstate the initial page load.
             * Hang handler popstate as will be fully loaded document that
             * would prevent triggering event onpopstate
             */
            addEvent(eventNamePrefix + 'load', onLoad, false);
        }

        // everything went well
        return true;
    }

    /**
     * Starting the library
     */
    if (!initialize()) {
        // if unable to initialize descriptors
        // therefore quite old browser and there
        // is no sense to continue to perform
        return;
    }

    /**
     * If the property history.emulate will be true,
     * this will be talking about what's going on
     * emulation capabilities HTML5-History-API.
     * Otherwise there is no emulation, ie the
     * built-in browser capabilities.
     *
     * @type {boolean}
     * @const
     */
    historyObject['emulate'] = !isSupportHistoryAPI;

    /**
     * Replace the original methods on the wrapper
     */
    window[addEventListenerName] = addEventListener;
    window[removeEventListenerName] = removeEventListener;
    window[dispatchEventName] = dispatchEvent;

})(window);

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
    if (!cancelled) doTransition(enters, exits, params, isCancelled);
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

  function isCancelled() {
    return cancelled;
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

function doTransition(enters, exits, params, isCancelled) {
  exits.forEach(function(state) {
    state.exit(state._exitPrereqs && state._exitPrereqs.value);
  });

  asyncPromises.allowed = true;
  enters.forEach(function(state) {
    if (!isCancelled())
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

var interceptAnchorClicks = (function() {

  var ieButton;

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
    var host = anchor.host;

    // IE10 and below can lose the host property when setting a relative href from JS
    if (!host) {
      var tempAnchor = document.createElement("a");
      tempAnchor.href = anchor.href;
      host = tempAnchor.host;
    }

    return (host == location.host);
  }


  return function (router) {
    if (document.addEventListener)
      document.addEventListener('click', anchorClickHandler);
    else {
      document.attachEvent('onmousedown', rememberIeButton);
      document.attachEvent('onclick', anchorClickHandler);
    }
  };


})();


return Abyssa;

});
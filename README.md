
![abyssa-logo](http://i171.photobucket.com/albums/u320/boubiyeah/abyssa-logo_zps745ae9eb.png)

A stateful router library for single page applications.

# Content
* [Browser support](#browser-support)
* [Introduction](#introduction)
* [Installation](#installation)
* [Transitions](#transitions)
* [API](#api)
* [Anchor interception](#anchor-interception)
* [Dependencies](#dependencies)
* [Code examples](#code-examples)
* [Cookbook](#cookbook)


<a name="browser-support"></a>
# Browser support

With shims ([es5-shim](https://github.com/kriskowal/es5-shim) and [history.js](https://github.com/devote/HTML5-History-API))  

[![SauceLabs Status](https://saucelabs.com/browser-matrix/boubiyeah.svg)](https://saucelabs.com/u/boubiyeah)

Without shims  

[![SauceLabs Status](https://saucelabs.com/browser-matrix/bagonzago.svg)](https://saucelabs.com/u/bagonzago)


<a name="introduction"></a>
# Introduction

## What is Abyssa?

Abyssa is a stateful, hierarchical client side router.  
What does stateful mean? it means all states are not equal and abyssa knows how to go from one state to another efficiently.  
Abyssa does only one thing: Routing.  
Upon entering a state, it can be rendered using any technique: Direct DOM manipulation, client or server side templating, with the help of a binding library, etc.
A state can even be abstract and not render anything.

## Abyssa is versatile

Abyssa can be used like a traditional stateless url -> callback router:  

```javascript
Router({
  article: State('articles/:id', articleEnter),
  articleEdit: State('articles/:id/edit', articleEditEnter)
})
.init();
```

Or we can leverage abyssa's state machine nature:  

```javascript
Router({
  article: State('articles/:id', {
    enter: loadArticle,

    show: State('', articleEnter),
    edit: State('edit', articleEditEnter)
  })
})
.init();
```

Now we can freely switch between viewing and editing an article without any pause because the article data is loaded in the parent state and can be shared in the child states.

## Abyssa is performant

What is the main advantage of stateful routers? Performance: Less redraws, less wasteful data loading, less wasteful setUp logic, etc.  
When going from a state A to a state B, as far as a stateless router is concerned, everything has to be done from scratch even if the two states are closely related. Trying to optimize state transitions by hand is going to be awkward and lead to an explosion of custom state variables. On the other hand, abyssa make it simple to reason about what makes each state different and thus compute the minimum set of changes needed to transition from state A to state B.  

![transition-min-changes](http://i171.photobucket.com/albums/u320/boubiyeah/abyssaTransitionPic_zps1315690d.png)

Here, Abyssa will simply swap the red bit for the green bit. Why should everything be redrawn? It's slower and the software would lose all the state implicitly stored in the previous DOM.

Read this excellent blog post for more information: [Make the most of your routes](http://codebrief.com/2012/03/make-the-most-of-your-routes/)

<a name="installation"></a>
# Installation

**Using abyssa as a commonJS/browserify module**
```
npm install abyssa
...
var Router = require('abyssa').Router;

```

**Using abyssa as a global or as an AMD module**  
Use one of the provided prebuilt files in the target folder.


<a name="transitions"></a>
# Transitions

## Error handling

Since transitions are asynchronous and backed by promises, errors are caught centrally.  
By default, any error occuring during the transition will simply be rethrown. This behavior might be unsuitable in production and can be disabled with the following code:  
```javascript
  router.transition.failed.add(function(newState, oldState, error, preventDefault) {
    preventDefault(); // Do not let the router rethrow the error
    // do something with the passed Error instance.
  });
```

## Example

![transition-example](http://i171.photobucket.com/albums/u320/boubiyeah/states1_zps7eb66af6.png)

A few notes:  
- Only leaf-states can be transitionned to.  
- Each transition step can return a promise to temporarily halt the transition. The resolved promise value will be passed
as the second argument of the next step's callback.  
- There can be several root states. The router doesn't enforce the use of a single, top level state like some state machine implementations do.  

The transition from the state `A1` to the state `B` would consist of the following steps:  

**A1 exit -> (Resolve A1 exit promise if applicable) -> PA exit -> (Resolve PA exit promise if applicable) -> B enter**


<a name="api"></a>
# API

<a name="api-router"></a>
## Router


### configure (options: Object): Router
Configure the router before its initialization.
The available options are:  
- enableLogs: Whether (debug and error) console logs should be enabled. Defaults to false.  
- interceptAnchors: Whether anchor mousedown/clicks should be intercepted and trigger a state change. Defaults to true.  
- notFound: The State to enter when no state matching the current path query or name could be found. Either a State instance or a string representing the fullName of an existing state can be passed. Defaults to null.  
- urlSync: How the router state and the URL should be kept in sync. Defaults to true. Possible values are:  
  - true: The router uses the history pushState API. The history.js shim can be used to also support IE8/IE9.
  - false: The url is never read or updated. The starting state is the path-less, default state.
  - 'hash': The router uses the hash part of the URL for all browsers.

### init (initState: String, initParams: Object): Router
Initialize and freeze the router (states can not be updated or added afterwards).  
The router will immediately initiate a transition to, in order of priority:  
1) The init state passed as an argument (useful for testing and debugging)  
2) The state captured by the current URL  

### addState (name: String, state: State): Router
Add a new root state to the router.  
Returns the router to allow chaining.

### state (pathQueryOrName: String, params: Object): void
Request a programmatic state change.  
Only leaf states can be transitionned to.  
While you can change state programmatically, the more idiomatic way to do it is sometimes using anchor tags with the proper href.  

Two notations are supported:  
```javascript
// Fully qualified state name
state('my.target.state', {id: 33, filter: 'desc'})  
// Path and (optionally) query
state('target/33?filter=desc')  
```

### redirect (pathQueryOrName: String, params: Object): void
An alias of `state`. You can use `redirect` when it makes more sense semantically.

### backTo (stateName: String, defaultParams: Object): void
Attempt to navigate to 'stateName' with its previous params or  
fallback to the defaultParams parameter if the state was never entered.

### reload(): void
Reload the current state with its current params.  
All states up to the root are exited then reentered.  
This can be useful when some internal state not captured in the url changed and the current state should update because of it.

### link (stateName: String, params: Object): String
Compute a link that can be used in anchors' href attributes  
from a state name and a list of params, a.k.a reverse routing.

### previousState(): [StateWithParams](#api-stateWithParams)
Returns the previous state of the router or null if the router is still in its initial state.

### currentState(): [StateWithParams](#api-stateWithParams)
Returns the current state of the router.

### isFirstTransition(): Boolean
Returns whether the router is executing its first transition.


### Signals

The router dispatches some signals. The signals' API is: `add`, `addOnce` and `remove`.  
Unless specified otherwise, all signal handlers receive the current state and the old state as arguments (of type [StateWithParams](#api-stateWithParams)).

#### router.transition.started
Dispatched when a transition started.

#### router.transition.ended
Dispatched when a transition either completed, failed or got cancelled.  
The exact signal type is passed as a third argument: 'completed', 'failed' or 'cancelled'.

#### router.transition.completed
Dispatched when a transition successfuly completed.

#### router.transition.failed
Dispatched when a transition failed to complete.

#### router.transition.cancelled
Dispatched when a transition got cancelled.

#### router.transition.prevented
Dispatched when a transition was prevented by the router.  
The router prevents the transition when the next state and params are identical to the current ones.  
Handlers will only receive one argument: The current state.

#### router.changed
Shorter alias for transition.completed: The most commonly used signal.


### Usage example

#### Declarative construction

```javascript
// Create a router with one state named 'index'.
var router = Router({
  index: State()
});
```

#### Programmatic construction

```javascript
var router = Router();
router.addState('index', State());
```


<a name="api-stateWithParams"></a>
## StateWithParams
StateWithParams is the merge between a State object (created and added to the router before init)
and params (both path and query params, extracted from the URL after init).  
Instances of StateWithParams are returned from `router.previousState()`, `router.currentState()` and passed in signal handlers.  

### name: String
Same as State's name.

### fullName: String
Same as State's fullName.

### pathQuery: String
The path/query at the time this state was active.

### data (key: String, value: Any): Any | State
Same as State's data.

### isIn(fullName: String):Boolean
Returns whether this state or any of its parents has the given fullName.

Example:  
```javascript

var router = Router({

  books: State('books', {
    data: { myData: 33 },

    listing: State(':kind')
  })

}).init('books/scifi?limit=10');

var state = router.currentState();

// state looks as follow:

{
  name: 'listing',
  fullName: 'books.listing',
  params: {kind: 'scifi', limit: 10},
  data, // Here, state.data('myData') == 33
  isIn // state.isIn('books') == true
}
```

<a name="api-state"></a>
## State

States represent path segments of an url.  
Additionally, a state can own a list of query params: While all states will be able to read these params, isolated changes to these
will only trigger a transition up to the state owning them (it will be exited and re-entered). The same applies to dynamic query params.   
How much you decompose your applications into states is completely up to you;  
For instance you could have just one state:
```javascript
State('some/path/:slug/:id')
```
Or four different states to represent that path:
```javascript
State('some', {
  child: State('path', {
    grandchild: State(':slug', {
      grandgrandchild: State(':id')
    })
  })
})
```

### addState (name: String, state: State): State
Add a child state.  
Returns the current state to allow chaining.

### data (key: String, value: Any): Any | State
Get or Set some data by key on this state.  
child states have access to their parents' data.  
This can be useful when using external models/services as a mean to communicate between states is not desired.  
Returns the state to allow chaining.

### router: Router
A back reference to the router.  
This property is available after router init (e.g inside an state.enter()).

### name: String
The name of this state.  
This property is available after router init (e.g inside an state.enter()).

### fullName: String
The fully qualified name of this state.  
This property is available after router init (e.g inside an state.enter()).

### parent: State
The parent of this state, or null if this state is a root.  
This property is available after router init (e.g inside an state.enter()).

### parents: Array[State]
The list of parent states, starting with the nearest ones.  
This property is available after router init (e.g inside an state.enter()).

### root: State
The root state in this state tree.  
This property is available after router init (e.g inside an state.enter()).

### children: Array[State]
The children of this state.  
This property is available after router init (e.g inside an state.enter()).

### async (promiseOrValue: Object): Promise
Shortcut for [Async](#api-async).  
This property is available after router init (e.g inside an state.enter()).

### Declarative properties

When creating a State instance with an option object, the following properties have a special meaning and are reserved for abyssa:  
`data`, `enter`, `exit`, `update`  
All other properties should be child states.

#### enter (params: Object, value: Any): void
Specify a function that should be called when the state is entered.  
The params are the dynamic params (path and query alike in one object) of the current url.  
This is where you could render the data into the DOM or do some general work once for many child states.

#### exit (params: Object, value: Any): void
Same as the enter function but called when the state is exited.
This is where you could teardown any state or side effects introduced by the enter function, if needed.

#### update (params: Object, value: Any): void
The update callback is called when the router is moving to the same state as the current state, but with different params or because `reload()` was called.  
Specifying an update callback can be seen as an optimization preventing doing wasteful work in exit/enter, e.g removing and adding the same DOM elements that were already present in the document before the state change.  

```javascript
var router = router({
  people: State('people/:id', {
    enter: function() {},
    update: function() {},
    exit: function() {},
  })
}).init('people/33');
```

During init, `enter` will be called.  

Later, if the router transitions from 'people/33' to 'people/44', only `update` will be called. If an `update` callback wasn't specified,
`exit` then `enter` would have been called in succession.


#### data: Object
Custom data properties can be specified declaratively when building the state.
If more data properties are set later using `state.data(key, value)`, they will all be merged together.


### Usage examples

#### Construction

A state represented by the path "articles", with a child state named "item" represented by the dynamic path "id".  
When the router is in the state "articles.item" with the id param equal to 33, the browser url is http://yourdomain/articles/33  
```javascript
var router = Router({
  articles: State('articles', {
  item: State(':id', {
    // state definition
  })
}).init();
```

Or using the imperative form:  
```javascript
var router = Router();
var articles = State('articles');  

articles.addState('item', State(':id'));
router.addState(articles);
router.init();
```

#### Construction shorthand

It is common to only have an enter callback for a state so a short way to express it is provided:  

```javascript
var state = State('articles', function enter(params) {
  // Do things synchronously here

  this.async(myPromise).then(function(data) {
    // Do things asynchronously here
  });
});
```

#### Pathless states

A state represented by the path "articles" with a path-less child state named "show"  
When the router is in the state "articles.show", the browser url is http://yourdomain/articles

```javascript
var state = State('articles': {
  show: State() // Equivalent to: show: State('', {})
});

router.addState('articles', state);
```

#### Query strings

Now the articles state also tells us it owns the query param named 'filter' in its state hierarchy.  
This means that any isolated change to the filter query param (meaning the filter was added, removed or changed but the path remained the same) is going to make that state exit and re-enter so that it can process the new filter value. If you do not specify which state owns the query param, all states above the currently selected state are exited and reentered, which can be less efficient.  Also, Enumerating the possible query strings is mandatory if you want these to appear when using reverse routing or name-based state changes.
```javascript
var state = State('articles?filter': {
  show: State()
});

```

#### Setting state data

You can set arbitrary data declaratively by just specifying a custom property in the State options.  
This data can be read by all descendant states (Using `this.data('myArbitraryData')`) and from signal handlers.  
For more elaborated use cases, you can store the data in a custom external service or model.
```javascript
var state = State('articles?filter': {
  data: { myArbitraryData: 66 },
  show: State()
});

// The data can also be read inside signal handlers
router.transition.ended.add(function(oldState, newState) {
  // Do something based on newState.data('myArbitraryData')
});
```

#### Creating a state hierarchy declaratively

```javascript
var state = State('articles', {
  enter: function(params, ajaxData) { console.log('articles entered'); },
  exit: function() { console.log('articles exit'); },

  // A child state is simply a property of type 'State'
  item: State(':id', {
    enter: function(params) { console.log('item entered with id ' + params.id); }
  })
});

```

#### Creating a state hierarchy programmatically

```javascript
var state = State('articles');
state.enter = function(params, ajaxData) { console.log('articles entered'); };
state.exit = function() { console.log('articles exit'); };

var item = State(':id');
item.enter = function(params) { console.log('item entered with id ' + params.id); };

state.addState('item', item);
```


<a name="api-async"></a>
## Async

Async is a convenient mean to let the router know some async operations tied to the current state are ongoing.  
The router will ignore (The fulfill/reject handlers will never be called) these promises if the router state changes in the meantime.  
This behavior is useful to prevent states from affecting each other (with side effects such as DOM mutation in the promise handlers)  
You can have as many Async blocks as required.


### Example 1:
```javascript
var Async = Abyssa.Async;

var state = State('articles/:id': {
  
  enter: function(params) {
    var data = $.ajax('api/articles/' + params.id);

    // Do things that should be done synchronously here, like setting up the basic layout.

    // Then load the data and act on it asynchronously.

    Async(data).then(function(article) {
      // Render article safely; the router is still in the right state.
    });

    // Or, equivalently:

    this.async(data).then(function(article) {

    });
  }
}

});
```

### Example 2:
```javascript
var Async = Abyssa.Async;

var state = State('articles/:id': {

  enter: function(params) {
    $('button.refresh').click(function() {
      // The user clicked on a button: Load some data before performing the action.
      // Loading the data is asynchronous, and the response should be ignored if the user
      // navigated away to another state in the meantime.
      Async(loadData()).then(function(data) {
        // Perform the action safely; the router is still in the right state.
      });
    });
  }
}
```

<a name="anchor-interception"></a>
# Anchor interception

By default, the router will intercept anchor clicks and automatically navigate to a state if some conditions are met (left button pressed, href on the same domain, etc).  
This behavior can be turned off by using the corresponding router [configuration setting](#api-router)  
You may want to turn off anchor interception on mobile optimised apps and make manual router.state() calls on touch events.  

You can also intercept mousedown events instead of the usual click events by using a data-attribute as follow:  
```
<a data-nav="mousedown" href="/">
```

If a same-domain link should not be intercepted by Abyssa, you can use:  
```
<a data-nav="ignore" href="/">
```


<a name="dependencies"></a>
# Dependencies

Abyssa uses the following libraries:

[**crossroads.js**](https://github.com/millermedeiros/crossroads.js): A stateless, solid traditional low level router. Abyssa builds on top of it.  
[**signals.js**](https://github.com/millermedeiros/js-signals): A dependency of crossroads.js; Provide an alternative to string based events. Abyssa uses signals instead of events.  
[**q.js**](https://github.com/kriskowal/q): The reference implementation of Promise/A+. This is used internally to orchestrate asynchronous behaviors.  


<a name="code-examples"></a>
# Code examples

## Demo app

Demo: [Abyssa demo async](http://abyssa-async.herokuapp.com/)  
Source: [Abyssa demo async source](https://github.com/AlexGalays/abyssa-demo/tree/async/client)  


<a name="cookbook"></a>
# Cookbook

## Highlight the selected primary navigation item

Assuming the following highlight function is in scope:  

```javascript
function highlight(navItem) {
  $('li.nav').removeClass('active');
  $('li.nav.' + navItem).addClass('active');
}

```

We can either:  

**1) Observe all state changes externally**  

```javascript

var router = Router({

  section1: State('section1', {
    data: { navItem: 'section1' } // custom data property; seen by any substate.
  }),

  section2: State('section2', {
    data: { navItem: 'section2' }
  })

}).init('section1');


router.changed.add(function(state) {
  highlight(state.data('navItem'));
  // or
  highlight(state.name);
});

```

Or  

**2) Create a specialized State factory to deal with that common concern**  

```javascript

function NavState(path, options) {
  var enter = options.enter;

  options.enter = function(params) {
    highlight(this.name);
    enter(params);
  };
}
  return State(path, options);
}

var router = Router({

  section1: NavState('section1'),
  section2: NavState('section2')

}).init('section1');

```
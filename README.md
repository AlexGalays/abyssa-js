
![abyssa-logo](http://i171.photobucket.com/albums/u320/boubiyeah/abyssa-logo_zps745ae9eb.png)

A stateful router library for single page applications.

# Content
* [Browser support](#browser-support)
* [Introduction](#introduction)
* [Code examples](#code-examples)
* [Installation](#installation)
* [API](#api)
* [Blocking/Non-blocking navigation](#blocking)
* [Anchor interception](#anchor)
* [Dependencies](#dependencies)
* [Cookbook](#cookbook)


<a name="browser-support"></a>
# Browser support

With shims ([es5-shim](https://github.com/kriskowal/es5-shim) and [history.js](https://github.com/devote/HTML5-History-API))  

[![SauceLabs Status](https://saucelabs.com/browser-matrix/boubiyeah.svg)](https://saucelabs.com/u/boubiyeah)

Without shims  

[![SauceLabs Status](https://saucelabs.com/browser-matrix/bagonzago.svg)](https://saucelabs.com/u/bagonzago)


<a name="introduction"></a>
# Introduction

## Is it for you?

Abyssa is a stateful, hierarchical client side router.  
It is meant to be used in those single page apps where using a big, comprehensive framework is unwanted: You wish to keep absolute control
of your data, the DOM, and only willing to use a few libraries at most. 
This would be applications with a high performance risk (Complex requirements, data intensive, High frequency of DOM updates (From SSEs, websockets, animations, etc), mobile apps and so on.  

Abyssa does only one thing: Routing.  
Upon entering a route, you can render it using any technique: Direct DOM manipulation, client or server side templating, using a binding library, etc.

## What's so great about (very) stateful clients?

'Stateful' is a swear word for servers but modern clients just love state! Mainframe terminals no longer cut it.  
State on the client can greatly improve the user's experience by providing immediate feedback and minimizing server roundtrips.  
On the other hand, smart clients with a lot of state are obviously more difficult to code, maintain and debug;  
A stateful router can help you manage this complexity by compartmentalizing the app's states, while keeping your URLs in sync with all the different states. It will
also take the complexity of transition asynchronicity and cancellation away from you.

Stateful routing powered clients are also more performant, as they avoid doing wasteful work as much as possible by extracting commonalities into parent states.  
For instance, two child states could share 90% of their layout and only concentrate on the differences. The same principle applies when sharing data between states.  
Read this excellent blog post for an in-depth explanation: [Make the most of your routes](http://codebrief.com/2012/03/make-the-most-of-your-routes/)


<a name="code-examples"></a>
# Code examples

## Demo app

Demo: [Abyssa demo async](http://abyssa-async.herokuapp.com/)  
Source: [Abyssa demo async source](https://github.com/AlexGalays/abyssa-demo/tree/async/public/javascripts)  

## Example using the declarative notation:  
```javascript
Router({

  // The state named 'home' maps to the root of your site (no path is specified)
  home: State('', function() { console.log('We are home'); }),

  // The state named 'articles' maps to /articles
  articles: State('articles', {
    // The state named 'item' maps to /articles/:id where ':id' is the integer/string identifier of the article.
    item: State(':id?filter', function(params) {
      this.async($.getJSON('api/articles/' + params.id)).then(function(article) {
        // Render the article
      });
    })

  })

}).init();

```

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


<a name="api"></a>
# API

<a name="api-router"></a>
## Router


### configure (options: Object): Router
Configure the router before its initialization.
The available options are:  
- enableLogs: Whether (debug and error) console logs should be enabled. Defaults to false.  
- interceptAnchors: Whether anchor mousedown/clicks should be intercepted and trigger a state change. Defaults to true.  
- notFound: The State to enter when no state matching the current path query or name could be found. Defaults to null. 

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
While you can change state programmatically, keep in mind the most idiomatic way to do it is using anchor tags with the proper href.  

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


### Signals

The router dispatches some signals. The signals' API is: `add`, `addOnce` and `remove`.  
All signals receive the current state and the old state as arguments (of type [StateWithParams](#api-stateWithParams)).

#### router.transition.started
Dispatched when a transition started.

#### router.transition.ended
Dispatched when a transition either completed, failed or got cancelled.

#### router.transition.completed
Dispatched when a transition successfuly completed.

#### router.transition.failed
Dispatched when a transition failed to complete.

#### router.transition.cancelled
Dispatched when a transition got cancelled.

#### router.changed
Shorter alias for transition.completed: The most commonly used signal.

#### router.initialized
Dispatched once after the router successfully reached its initial state.


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
Instances of StateWithParams are returned from router.currentState() and passed in signal handlers.  

### name: String
Same as State's name.

### fullName: String
Same as State's fullName.

### pathQuery: String
The path/query at the time this state was active.

### data (key: String, value: Any): Any | State
Same as State's data.

### is(fullName: String): Boolean
Returns whether this state has the given fullName.

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
  is, // state.is('books.listing') == true
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

### async (promiseOrValue: Object): Promise
Shortcut for [Async](#api-async).  
This property is available after router init (e.g inside an state.enter()).

### Declarative properties

When creating a State instance with an option object, the following properties have a special meaning and are reserved for abyssa:  
`data`, `enter`, `exit`, `enterPrereqs`, `exitPrereqs`, `update`  
All other properties should be child states.

#### enter (params: Object, userData: Any): void
Specify a function that should be called when the state is entered.  
The params are the dynamic params (path and query alike in one object) of the current url.  
`userData` is any data you returned in enterPrereqs, or the resolved value of a promise if you did return one.  
This is where you could render the data into the DOM or do some general work once for many child states.

#### enterPrereqs (params: Object): Any
Specify a prerequisite that must be satisfied before the state is entered.  
It can be any value or a promise (a thenable object). Should the promise get rejected, the state will never be entered and the router will remain in its current state.  
Examples of enterPrereqs include fetching an html template file, data via ajax/local cache or get some prerendered html from the server.

#### exit (userData: Any): void
Same as the enter function but called when the state is exited.
This is where you could teardown any state or side effects introduced by the enter function, if needed.

#### exitPrereqs (): Any
Same as enterPrereqs but for the exit phase.  
An example of an exitPrereqs would be a prompt (Backed by a promise) asking the user if she wants to leave the screen with unsaved data.

#### update (params: Object): void
The update callback is called when the router is moving to the same state as the current state, but with different params or because of a reload().  
Specifying an update callback can be seen as an optimization preventing doing wasteful work in exit/enter, e.g removing and adding the same DOM elements that were already present in the document before the state change.  
The update callback can be used to separate the setup/teardown of the static elements of the state (e.g a base layout or some data independant of the url params) in the `ente`/`exit`, while managing the dynamic elements of the state (e.g rendering some list from server data) in `update`.

**Without an update callback**
```javascript
var router = router({
  people: State('people/:id', {
    enter: function() {},
    exit: function() {},
  })
}).init('people/33');
```

During init, the following callbacks will be called:
- enter

Later, if the router moves to 'people/44', the following callbacks will be called:
- exit
- enter

**With an update callback**
```javascript
var router = router({
  people: State('people/:id', {
    enter: function() {},
    update: function() {},
    exit: function() {},
  })
}).init('people/33');
```

During init, the following callbacks will be called:
- enter
- update

Later, if the router moves to 'people/44', the following callbacks will be called:
- update

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

When using non-blocking navigation, it is common to only have an enter callback for a state so a short way to express it is provided:  

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

  enterPrereqs: function(params) { return $.ajax(...); },

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
state.enterPrereqs = function(params) { return $.ajax(...); };

var item = State(':id');
item.enter = function(params) { console.log('item entered with id ' + params.id); };

state.addState('item', item);
```


<a name="api-async"></a>
## Async

Async is a convenient mean to let the router know some async operations tied to the current state are ongoing.  
The router will ignore (The fulfill/reject handlers will never be called) these promises if the navigation state changes in the meantime.  
This behavior is useful to prevent states from affecting each other (with side effects such as DOM mutation in the promise handlers)  
You can have as many Async blocks as required.

`Async` can help implement non-blocking navigation (See [Blocking/Non-blocking navigation](#blocking))  

### Example:
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

    // Or

    this.async(data).then(function(article) {

    });
  }
}

});
```

<a name="blocking"></a>
# Blocking/Non-blocking navigation

You can decide to implement your navigation so that it blocks or doesn't:  

## Blocking
This is close to the traditional client/server website UX: You don't get to see the next page/state till all the data needed to render it is retrieved.  
Of course, unlike classical websites there is no blank between state transitions and you can give feedback to the user during the transition.  
To implement blocking navigation, specify `enterPrereqs`; The prereqs will be resolved in parallel and the navigation will only occur
once they are all resolved; If any of the preReqs fail, the state change doesn't occur.

## Non-blocking
The navigation occurs immediately, but the data comes later. Non-blocking navigation can feel quicker but also more awkward if
the router transitions to a state that is near empty when the data isn't known yet.  
To implement Non-blocking navigation, do not specify any `enterPrereqs`; instead, wrap your promises (ajax, etc) in [Async](#api-async) blocks.


<a name="anchor-interception"></a>
# Anchor interception

By default, the router will intercept anchor clicks and automatically navigate to a state if some conditions are met (left button pressed, href on the same domain, etc).  
This behavior can be turned off by using the corresponding router [configuration setting](#api-router)  
You can also intercept mousedown events instead of the usual click events by using a data-attribute as follow:  
```
<a data-nav="mousedown" href="/">
```
You may want to turn off this behavior on mobile optimised apps and make manual router.state() calls on touch events.


<a name="dependencies"></a>
# Dependencies

Abyssa uses the following libraries:

[**crossroads.js**](https://github.com/millermedeiros/crossroads.js): A stateless, solid traditional low level router. Abyssa builds on top of it.  
[**signals.js**](https://github.com/millermedeiros/js-signals): A dependency of crossroads.js; Provide an alternative to string based events. Abyssa uses signals instead of events.  
[**q.js**](https://github.com/kriskowal/q): The reference implementation of Promise/A+. This is used internally to orchestrate asynchronous behaviors.  


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
    navItem: 'section1' // custom data property; seen by any substate.
  }),

  section2: State('section2', {
    navItem: 'section2'
  })

}).init('section1');


router.changed.add(function(state) {
  highlight(state.data('navItem'));
  // or
  highlight(state.name);
});

```

Or  

**2) Create a specialized State type to deal with that common concern**  

```javascript

// utility
function doBefore(func, beforeFunc) {
  return function() {
    beforeFunc.apply(this, arguments);
    return func && func.apply(this, arguments);
  };
}

function NavState(path, options) {
  options.enter = doBefore(options.enter, function(params) {
    highlight(this.name);
  });
  return State(path, options);
}

var router = Router({

  section1: NavState('section1'),
  section2: NavState('section2')

}).init('section1');

```


## Disable anchor click interception on HTML4 browsers

pros:  
- Only one URL kind around (no hashes)
- Can use traditional anchor # links to jump to sections in all browsers without using JS

cons:  
- Slower browsing in HTML4 browsers: Everytime a state change occurs, the page fully reloads, the router initializes again, etc.
- Some UX become impossible to deliver. Ex: A three steps form process where each step has its own route and where the state accumulates in JS before being sent to the server after the final step.  

```javascript

var router = Router({
  // ...
})
.configure({
  interceptAnchorClicks: !history.emulate
})
.init();

```

![abyssa-logo](http://i171.photobucket.com/albums/u320/boubiyeah/abyssa-logo_zps745ae9eb.png)

Hierarchical router library for single page applications.

# Content
* [Browser support](#browser-support)
* [Introduction](#introduction)
* [Installation](#installation)
* [Transitions](#transitions)
* [API](#api)
  * [Router](#api-router)
  * [State](#api-state)
  * [StateWithParams](#api-stateWithParams)
  * [async](#api-async)
* [Anchor interception](#anchor-interception)
* [Code examples](#code-examples)
* [Cookbook](#cookbook)
  * [Removing router <-> state circular dependencies](#removingCircularDeps)
  * [Central router, modular states](#centralRouter)
  * [Highlight the selected primary navigation item](#navHighlight)
  * [Handling the change of some params differently in `update`](#updateParamChanges)


<a name="browser-support"></a>
# Browser support

[![SauceLabs Status](https://saucelabs.com/browser-matrix/bagonzago.svg)](https://saucelabs.com/u/bagonzago)

With IE8/IE9, The router won't throw any errors at script evaluation time, so it can be used to support these browsers in degraded mode.

<a name="introduction"></a>
# Introduction

## What is Abyssa?

Abyssa is a stateful, hierarchical client side router.  
What does stateful mean? It means all states are not equal and abyssa knows how to go from one state to another efficiently.  
Abyssa does only one thing: Routing.  
Upon entering a state, it can be rendered using any technique: Direct DOM manipulation, client or server side templating, with the help of a binding library, etc.
A state can even be abstract and not render anything.

## Abyssa is versatile

Abyssa can be used like a traditional stateless url -> callback router:  

```javascript

var show = { enter: articleEnter };
var edit = { enter: articleEditEnter };

Router({
  article: State('articles/:id', show),
  articleEdit: State('articles/:id/edit', edit)
})
.init();
```

Or we can leverage abyssa's state machine nature and nest states when it serves us:  

```javascript

var article = { enter: loadArticle };
var show = { enter: articleEnter, exit: articleExit };
var edit = { enter: articleEditEnter, exit: articleEditExit };

Router({
  article: State('articles/:id', article, {
    show: State('', show),
    edit: State('edit', edit)
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

**Using abyssa as a global**  
Use one of the provided prebuilt files in the target folder.


<a name="transitions"></a>
# Transitions

## Example

![transition-example](http://i171.photobucket.com/albums/u320/boubiyeah/states1_zps7eb66af6.png)

A few notes:  
- Only leaf-states can be transitionned to.  
- There can be several root states. The router doesn't enforce the use of a single, top level state like some state machine implementations do.  

The transition from the state `A1` to the state `B` would consist of the following steps:  

**A1 exit -> PA exit -> B enter**


<a name="api"></a>
# API

<a name="api-router"></a>
## Router


### configure (options: Object): Router
Configure the router before its initialization.
The available options are:  
- enableLogs: Whether (debug and error) console logs should be enabled. Defaults to false.  
- interceptAnchors: Whether anchor mousedown/clicks should be intercepted and trigger a state change. Defaults to true.  
- notFound: The State to enter when no state matching the current path query or name could be found. This is a string representing the fullName of an existing state. Defaults to null.  
- urlSync: How the router state and the URL should be kept in sync. Defaults to true. Possible values are:  
  - true: The router uses the history pushState API.
  - 'hash': The router uses the hash part of the URL for all browsers.
- hashPrefix: Customize the hash separator. Set to '!' in order to have a hashbang like '/#!/'. Defaults to empty string.

### init (initState: String, initParams: Object): Router
Initialize the router.  
The router will immediately initiate a transition to, in order of priority:  
1) The init state passed as an argument (useful for testing and debugging)  
2) The state captured by the current URL  

### addState (name: String, state: Object): Router
Add a new root state to the router.  
Returns the router to allow chaining.  
The state Object is a simple POJO. See [State](#api-state)

### transitionTo (stateName: String, params: Object, acc: Object): void
### transitionTo (pathQuery: String, acc: Object): void
Request a programmatic, synchronous state change.  
Only leaf states can be transitionned to.  
While you can change state programmatically, the more idiomatic way to do it is sometimes using anchor tags with the proper href.  

Two notations are supported:  
```javascript
// Fully qualified state name
transitionTo('my.target.state', { id: 33, filter: 'desc' })  
// Path and (optionally) query
transitionTo('target/33?filter=desc')  
```
The `acc` parameter can be used to specify an object that will be passed up then down every state involved in the transition.  
It can be used to share information from a state with the subsequent states.

### backTo (stateName: String, defaultParams: Object, acc: Object): void
Attempt to navigate to 'stateName' with its previous params or  
fallback to the defaultParams parameter if the state was never entered.

### link (stateName: String, params: Object): String
Compute a link that can be used in anchors' href attributes  
from a state name and a list of params, a.k.a reverse routing.

### previous(): [StateWithParams](#api-stateWithParams)
Returns the previous state of the router or null if the router is still in its initial state.

### current(): [StateWithParams](#api-stateWithParams)
Returns the current state of the router.

### isFirstTransition(): Boolean
Returns whether the router is executing its first transition.

### paramsDiff(): Object
Returns the diff between the current params and the previous ones
```javascript
var diff = router.paramsDiff();

{
  update: { // params staying but being updated
    id: true
  },
  enter: { // params making an appearance
    q: true
  },
  exit: { // params now gone
    section: true
  },
  all: { // all param changes
    id: true,
    q: true,
    section: true
  }
}
```

### Events

All event handlers receive the current state and the old state as arguments (of type [StateWithParams](#api-stateWithParams)).

#### router.transition.on('started', handler)
#### router.transition.on('ended', handler)


<a name="api-state"></a>
## State

### Basics
States are simple POJOs used to build the router and represent path segments of an url (indeed, the router only matches routes against states' paths).  

A state can also own a list of query params: While all states will be able to read these params, isolated changes to these
will only trigger a transition up to the state owning them (it will be exited and re-entered). The same applies to dynamic query params.   
How much you decompose your applications into states is completely up to you.

### Properties

A state is really just an object with an `uri` property. Optionally, the following properties can be specified:  
`enter`, `exit`, `update`, `data`, `children`.

#### uri: String
The path segment this state owns. Can also contain a query string. Ex: `uri: 'articles/:id?filter'`

#### enter (params: Object, value: Any): void
Specify a function that should be called when the state is entered.  
The params are the dynamic params (path and query alike in one object) of the current url.  
This is where you could render the data into the DOM or do some general work once for many child states.

#### exit (params: Object, value: Any): void
Same as the enter function but called when the state is exited.
This is where you could teardown any state or side effects introduced by the enter function, if needed.

#### update (params: Object, value: Any): void
The update callback is called when the router is moving to the same state as the current state, but with different path/query params.  
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

### children: Object
A map of child names to states.


### Usage examples

#### Construction

Given a state represented by the path "articles", with a child state named "item" represented by the dynamic path "id".  
When the router is in the state "articles.item" with the id param equal to 33, the browser url is http://yourdomain/articles/33.  
There are at least 3 ways to build such a router; It is advised to build the router centrally, even if the state definitions are 
located in their own modules.

Using pojos
```javascript
var router = Router({
  articles: {
    uri: 'articles', 
    children: {
      item: {
        uri: ':id'
      }
    }
  }
}).init();
```
Or using the `State` factory shorthand:  
```javascript
var router = Router({
  articles: State('articles', {}, {
    item: State(':id', {})
}).init();
```


Or using the imperative form:  
```javascript
var router = Router();
var articles = State('articles');  

articles.children.item = State(':id');
router.addState(articles);
router.init();
```


#### Pathless states

A state represented by the path "articles" with a path-less child state named "show"  
When the router is in the state "articles.show", the browser url is http://yourdomain/articles

```javascript
var state = State('articles', {}, {
  show: State('')
});

router.addState('articles', state);
```

#### Query strings

Now the articles state also tells us it owns the query param named 'filter' in its state hierarchy.  
This means that any isolated change to the filter query param (meaning the filter was added, removed or changed but the path remained the same) is going to make that state exit and re-enter so that it can process the new filter value. If you do not specify which state owns the query param, all states above the currently selected state are exited and reentered, which can be less efficient.  Also, Enumerating the possible query strings is mandatory if you want these to appear when using reverse routing or name-based state changes.
```javascript
var state = State('articles?filter', {}, {
  show: State('')
});

```

#### Rest segments
Additionaly, the last path segment of a state can end with a `*` to match any number of extra path segments:

```javascript
State('path/:rest*')

// All these state changes will result in that state being entered:  

// router.transitionTo('path'); // params.rest === undefined
// router.transitionTo('path/other'); // params.rest === 'other'
// router.transitionTo('path/other/yetAnother'); // params.rest === 'other/yetAnother'
```

#### Setting state data

You can set arbitrary data declaratively by just specifying a custom property in the State options.  
This data can be read by all descendant states (Using `stateWithParams.data('myArbitraryData')`) and from event handlers.  
For more elaborated use cases, you can store the data in a custom external service or model.
```javascript
var state = State('articles?filter', {
  data: { myArbitraryData: 66 }
});

// The data can also be read inside event handlers
router.transition.on('ended', function(oldState, newState) {
  // Do something based on newState.data('myArbitraryData')
});
```

<a name="api-stateWithParams"></a>
## StateWithParams
`StateWithParams` objects are returned from `router.previous()`, `router.current()` and passed in event handlers.  

### uri: String
The current uri associated with this state

### params: Object
The path and query params set for this state

### name: String
The (local) name of the state

### firstname: String
The fully qualified, unique name of the state

### isIn(fullName: String): Boolean
Returns whether this state or any of its parents has the given fullName.

### data (key: String, value: Any): Any
Get or Set some data by key on this state.  
child states have access to their parents' data.  
This can be useful when using external models/services as a mean to communicate between states is not desired.  
Returns the state to allow chaining.

Example:  
```javascript

var router = Router({

  books: State('books', {
    data: { myData: 33 }
  }, {
    listing: State(':kind')
  })

}).init('books/scifi?limit=10');

var state = router.current();

// state looks as follow:

{
  uri: 'books/scifi?limit=10'
  name: 'listing'
  fullName: 'books.listing'
  params: {kind: 'scifi', limit: 10}
  data // state.data('myData') == 33
  isIn // state.isIn('books') === true
}
```

<a name="api-async"></a>
## async

Async is a convenient mean to let the router know some async operations tied to the current state are ongoing.  
The router will ignore (The fulfill/reject handlers will never be called) these promises if the router state changes in the meantime.  
This behavior is useful to prevent states from affecting each other (with side effects such as DOM mutation in the promise handlers)  
You can have as many Async blocks as required.


### Example
```javascript
var async = Abyssa.async;

var state = State('articles/:id': {

  enter: function(params) {
    $('button.refresh').click(function() {
      // The user clicked on a button: Load some data before performing the action.
      // Loading the data is asynchronous, and the response should be ignored if the user
      // navigated away to another state in the meantime.
      async(loadData()).then(function(data) {
        // Perform the action safely; the router is still in the right state.
      });
    });
  }
}
```

### Note
In order to use the `async` function, you either need to have a modern browser supporting promises natively (or shimmed globally) or give the `async` function a suitable shim for it:  

```javascript
require('abyssa').async.Promise = Q.Promise;  // Or when, bluebird, etc.
```

<a name="anchor-interception"></a>
# Anchor interception

By default, the router will intercept anchor clicks and automatically navigate to a state if some conditions are met (left button pressed, href on the same domain, etc).  
This behavior can be turned off by using the corresponding router [configuration setting](#api-router)  
You may want to turn off anchor interception on mobile optimised apps and perform manual router.transitionTo() calls on touch/pointer events.  

You can also intercept mousedown events instead of the usual click events by using a data-attribute as follow:  
```
<a data-nav="mousedown" href="/">
```

If a same-domain link should not be intercepted by Abyssa, you can use:  
```
<a data-nav="ignore" href="/">
```


<a name="code-examples"></a>
# Code examples

## Demo app
NOTE: THIS APPLICATION'S CODE IS OUT OF DATE FOR THE TIME BEING
Demo: [Abyssa demo async](http://abyssa-async.herokuapp.com/)  
Source: [Abyssa demo async source](https://github.com/AlexGalays/abyssa-demo/tree/async/client)  

## Abyssa + React
[JSFiddle](http://jsfiddle.net/Wp3Yx/)

<a name="cookbook"></a>
# Cookbook

<a name="removingCircularDeps"></a>
## Removing router <-> state circular dependencies

States must be added to the router but states also often need to call methods on the router, for instance to create href links.
This creates circular dependencies which are annoying when using primitive module systems such as CommonJS'.  
To break that circular dependency, simply require the api object instead of the router in your states:  

```javascript
var api = require('abyssa').api;

// then api.link('state', { id: 123 })

```

<a name="centralRouter"></a>
## Central router, modular states
It is much easier to reason about an application and its routes if the various uris can be all be read in one place instead of being spread all over the code base. However, states should be modularized for the sake of easier maintenance and separation of concerns. Here's how it might be achieved with CommonJS modules:  

```javascript

// router.js

var Router = require('abyssa').Router;
var State = require('abyssa').State;

var index = require('./index'),
    articles = require('./articles'),
    articlesDetail = require('./articles/detail'),
    articlesDetailEdit = require('./articles/detailEdit');

Router({
  
  index: State('', index),

  articles: State('articles', articles, {
    articlesDetail: State(':id/show', articlesDetail),
    articlesDetailEdit: State(':id/edit', articlesDetailEdit),
  })

}).init();


// index.js

module.exports = {
  enter: function() {
    console.log('index entered');
  },
  exit: function() {
    console.log('index exited');
  }
};


```

<a name="navHighlight"></a>
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

  section1: State('section1', {}, {
    data: { navItem: 'section1' } // custom data property; seen by any substate.
  }),

  section2: State('section2', {}, {
    data: { navItem: 'section2' }
  })

}).init('section1');


router.transition.on('started', function(state) {
  highlight(state.data('navItem'));
});

```

Or  

**2) Create a State factory to deal with that common concern**  

```javascript

function NavState(state) {
  var enter = state.enter;

  state.enter = function(params, acc) {
    highlight(state.data.navItem);
    enter(params, acc);
  };

  return state;
}

var router = Router({

  section1: NavState(State('section1', {}, {
    data: { navItem: 'section1' }
  })),

  section2: NavState(State('section2', {}, {
    data: { navItem: 'section2' }
  }))

}).init('section1');

```

<a name="updateParamChanges"></a>
## Handling the change of some params differently in `update`

`update` is an optional hook that will be called whenever the router moves to the same state but with updated path/query params.

However, not all params are equal: A change in the path param representing the resource id may induce more work than the change of some secondary query param.

Example of a conditional update:  

```javascript

var api = require('abyssa').api;

var state = State({
  enter: function(params) {
    loadResourceForId(params.id);
  },

  update: function(params) {
    var diff = api.paramsDiff();

    // The id was changed
    if (diff.update.id) {
      loadResourceForId(params.id);
    }
    // Some other params were changed
    else {
      filterInPlace(params);
    }
  }
});

```

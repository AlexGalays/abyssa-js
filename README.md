# Abyssa
A stateful router for single page applications.

# Content
* [Introduction](#introduction)
* [Code examples](#code-examples)
* [API](#api)
* [Blocking/Non-blocking navigation](#blocking)
* [Dependencies](#dependencies)
* [Browser support](#browser-support)


<a name="introduction"></a>
# Introduction

## Is it for you?

Abyssa is a stateful, hierarchical client side router.  
It is meant to be used in those single page apps where using a big, comprehensive framework is unwanted: You wish to keep absolute control
of your data, the DOM, and only willing to use a few libraries at most. 
This would be applications with a high performance risk (Complex requirements, data intensive, High frequency of DOM updates (From SSEs, websockets, animations, etc), mobile apps and so on.  

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

## Demo app with blocking navigation

Demo: [Abyssa demo sync](http://calm-cove-4493.herokuapp.com/)  
Source: [Abyssa demo sync source](https://github.com/AlexGalays/abyssa-demo/tree/master/public/javascripts)  

## Demo app with non-blocking navigation

Demo: [Abyssa demo async](http://abyssa-async.herokuapp.com/)  
Source: [Abyssa demo async source](https://github.com/AlexGalays/abyssa-demo/tree/async/public/javascripts)  


Example using the monolithic, declarative notation:  
```javascript
Router({

  home: State({
    enter: function() { console.log('We are home'); }
  }),

  articles: State('articles', {
    item: State(':id?filter', {
      enterPrereqs: function(params) {
        return $.getJSON('api/articles/' + params.id);
      },
      enter: function(params, article) {
        // params.id is the article's id
        // params.filter is the query string value for the key 'filter' (Or undefined if unavailable)
        // article is the JSON representation of an article, ready to be rendered
      }
    })
  })

}).init();

```

<a name="api"></a>
# API

## Router

### init (initState: String): Router
Initialize and freeze the router (states can not be added afterwards).  
The router will immediately initiate a transition to, in order of priority:  
1) The state captured by the current URL  
2) The init state passed as an argument  
3) The default state (pathless and queryless)  

### addState (name: String, state: State): void
Add a new root state to the router.

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

### link (stateName: String, params: Object): String
Compute a link that can be used in anchors' href attributes  
from a state name and a list of params, a.k.a reverse routing.

### Signals

The router dispatches some signals. The signals' API is: `add`, `addOnce` and `remove`.  
All signals receive the current state and the next state as arguments.

#### router.transition.started
Dispatched when a transition started.

#### router.transition.ended
Dispatched when a transition either completed, failed or got cancelled.

#### router.transition.completed
Dispatched when a transition successfuly completed

#### router.transition.failed
Dispatched when a transition failed to complete

#### router.transition.cancelled
Dispatched when a transition got cancelled

#### router.initialized
Dispatched once after the router successfully reached its initial state.


### Usage example

```javascript
// Create a router with one state named 'index'.
var router = Router({
  index: State()
});
```


## State

States represent path segments of an url.  
Additionally, a state can own a list of query params: While all states will be able to read these params, isolated changes to these
will only trigger a transition up to the state owning them (it will be exited and re-entered). The same applies to dynamic query params.   
How much you decompose your applications into states is completely up to you;  
For instance you could have just one state (A la stateless):
```javascript
State('some/path/:slug/:id')
```
Just like you could have four different states to break down the complexity of that one path combination:
```javascript
State('some')
State('path')
State(':slug')
State(':id')

```

### addState (name: String, state: State): void
Add a child state

### data (key: String, value: Any): void | Any
Get or Set some data by key on this state.  
child states have access to their parents' data.  
This can be useful when using external models/services as a mean to communicate between states is not desired.  

### Declarative properties

#### enter (params: Object, userData: Any): void
Specify a function that should be called when the state is entered.  
The params are the dynamic params (path and query alike in one object) of the current url.  
`userData` is any data you returned in enterPrereqs, or the resolved value of a promise if you did return one.  
This is where you could render the data into the DOM or do some general work once for many child states.

#### enterPrereqs (params: Object): Any
Specify a prerequisite that must be satisfied before the state is entered.  
It can be any value or a promise. Should the promise get rejected, the state will never be entered and the router will remain in its current state.  
Examples of enterPrereqs include fetching an html template file, data via ajax/local cache or get some prerendered html from the server.

#### exit (userData: Any): void
Same as the enter function but called when the state is exited.
This is where you could teardown any state or side effects introduced by the enter function, if needed.

#### exitPrereqs (): Any
Same as enterPrereqs but for the exit phase.  
An example of an exitPrereqs would be a prompt (Backed by a promise) asking the user if she wants to leave the screen with unsaved data.



### Usage examples

A state represented by the path "articles", with a child state named "item" represented by the dynamic path "id".  
When the router is in the state "articles.item" with the id param equal to 33, the browser url is http://domain/articles/33  
```javascript
var router = Router({
  articles: State('articles', {
  item: State(':id', {
    // state definition
  })
}).init();
```

This is equivalent to:  
```javascript
var router = Router();
var articles = State('articles');
articles.addState('item', State(':id'));
router.init();

```

A state represented by the path "articles" with a path-less child state named "item"  
When the router is in the state "articles.show", the browser url is http://domain/articles

```javascript
var state = State('articles': {
  show: State()
});

router.addState('articles', state);
```

Now the articles state also tells us it owns the query param named 'filter' in its state hierarchy.  
This means any isolated change to the filter query param (Added, removed or changed) is going to make that state exit and re-enter so that it can take action with that new filter.
```javascript
var state = State('articles?filter': {
  show: State()
});

```

You can set arbitrary data declaratively instead of using the `data()` method by just specifying a custom property in the State options.  
This data can be read by all descendant states (Using `this.data('myArbitraryData')`) and from signal handlers.
```javascript
var state = State('articles?filter': {
  myArbitraryData: 66,
  show: State()
});

router.transition.ended.add(function(oldState, newState) {
  // Do something based on newState.data('myArbitraryData')
});
```

Options
```javascript
var state = State('articles': {
  enter: function(params, ajaxData) { console.log('articles entered'); },
  exit: function() { console.log('articles exit'); },

  enterPrereqs: function(params) { return $.ajax(...); },

  item: State(':id', {
    enter: function(params) { console.log('item entered with id ' + params.id); }
  })
});

```

## Async

Async is a convenient mean to let the router know some async operations tied to the current state are ongoing.  
The router will ignore (The fulfill/reject handlers will never be called) these promises if the navigation state changes in the meantime.  
This behavior is useful to prevent states from affecting each other (with side effects such as DOM mutation in the promise handlers)  

`Async` can help implement non-blocking navigation (See next section)  

### Example:
```javascript
var Async = Abyssa.Async;

var state = State('articles/:id': {
  
  enter: function(params) {
    var data = $.ajax('api/articles/' + params.id);

    Async(data).then(function(article) {
      // Render article safely; the router is still in the right state.
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
To implement Non-blocking navigation, do not specify any `enterPrereqs`; instead, wrap your promises (ajax, etc) in `Async` blocks.


<a name="dependencies"></a>
# Dependencies

## External dependencies (dependencies you must provide to use Abyssa)
None

## Internal dependencies (dependencies used in the Abyssa's build process)
**history.js (devote/HTML5-History-API)**: Used to support HTML4 browsers and abstract the HTML5 history implementation differences.  
**crossroads.js**: A stateless, solid traditional low level router. Abyssa builds on top of it.  
**signals.js**: A dependency of crossroads.js; Provide an alternative to string based events. Abyssa uses signals instead of events.  
**when.js**: A small and solid implementation of Promise/A+. This is used internally to orchestrate asynchronous behaviors.  



<a name="browser-support"></a>
# Browser support

Tested with most modern browsers, IE9 and IE8 (with the inclusion of proper es5 shims).  

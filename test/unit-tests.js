Router = Abyssa.Router;
State  = Abyssa.State;

//Router.enableLogs();
stubHistory();


test('Simple states', function() {

  var events = [],
      lastArticleId,
      lastFilter;

  var router = Router({

    index: State({
      enter: function() {
        events.push('indexEnter');
      },

      exit: function() {
        events.push('indexExit');
      }
    }),

    articles: State('articles/:id?filter', {
      enter: function(params) {
        events.push('articlesEnter');
        lastArticleId = params.id;
        lastFilter = params.filter;
      },

      exit: function() {
        events.push('articlesExit');
      }
    })

  }).init('');

  indexWasEntered();
  goToArticles();
  articlesWasEntered();
  resetToIndex();
  indexWasEntered2();
  goToArticlesWithFilter();
  articlesWasEnteredWithFilter();


  function indexWasEntered() {
    deepEqual(events, ['indexEnter']);
    events = [];
  }

  function goToArticles() {
    router.state('articles', { id: 38, filter: 'dark green' });
  }

  function articlesWasEntered() {
    deepEqual(events, ['indexExit', 'articlesEnter']);
    strictEqual(lastArticleId, '38');
    strictEqual(lastFilter, 'dark green');
    events = [];
  }

  function resetToIndex() {
    router.state('index');
  }

  function indexWasEntered2() {
    deepEqual(events, ['articlesExit', 'indexEnter']);
    events = [];
  }

  function goToArticlesWithFilter() {
    router.state('articles/44?filter=666');
  }

  function articlesWasEnteredWithFilter() {
    deepEqual(events, ['indexExit', 'articlesEnter']);
    strictEqual(lastArticleId, '44');
    strictEqual(lastFilter, '666');
  }

});


test('Custom initial state', function() {

  var router = Router({

    articles: State('articles/:id', {
      edit: State('edit', {
        enter: function() { 
          ok(true);
        }
      })
    })

  }).init('articles/33/edit');

});


test('Multiple dynamic paths', function() {

  Router({
    article: State('articles/:slug/:articleId', {
      changeLogs: State('changelogs/:changeLogId', {
        enter: function(params) {
          equal(params.slug, 'le-roi-est-mort');
          equal(params.articleId, 127);
          equal(params.changeLogId, 5);
        }
      })
    })
  }).init('articles/le-roi-est-mort/127/changelogs/5');

});


test('Nested state with pathless parents', function() {

  Router({

    // articles and nature are abstract parent states
    articles: State({
      nature: State({
        edit: State('articles/nature/:id/edit', {
          enter: function() {
            ok(true);
          }
        })
      })
    })

  }).init('articles/nature/88/edit');

});


test('Missing state with a "notFound" state defined by its fullName', function() {

  var reachedNotFound;

  var router = Router({

    index: State(),

    articles: State({
      nature: State({
        edit: State('articles/nature/:id/edit')
      })
    }),

    iamNotFound: State('404', {
      enter: function() { reachedNotFound = true; }
    })

  })
  .configure({
    notFound: 'iamNotFound'
  })
  .init('articles/naturess/88/edit');


  notFoundWasEntered();
  resetToIndex();
  goToWrongState();
  notFoundWasEntered2();


  function notFoundWasEntered() {
    ok(reachedNotFound);
  }

  function resetToIndex() {
    router.state('');
    reachedNotFound = false;
  }

  // Should also work with the reverse routing notation
  function goToWrongState() {
    router.state('articles.naturess.edit', { id: '88' });
  }

  function notFoundWasEntered2() {
    ok(reachedNotFound);
  }

});


test('Missing state without a "notFound" state defined', function() {

  var router = Router({

    index: State(),

    articles: State({
      nature: State({
        edit: State('articles/nature/:id/edit')
      })
    }),

  }).init('');

  throws(function() {
    router.state('articles/naturess/88/edit');
  });

  // Also work with the reverse routing notation
  throws(function() {
    router.state('articles.naturess.edit', { id: '88' });
  });

});


test('The router can be built bit by bit', function() {

  var reachedArticlesEdit,
      router = Router(),
      index = State(''),
      articles = State('articles'),
      edit = State('edit');

  edit.enter = function() {
    reachedArticlesEdit = true;
  };

  articles.addState('edit', edit);
  router.addState('index', index);
  router.addState('articles', articles);
  router.init('articles.edit');

  ok(reachedArticlesEdit);
});


test('State names must be unique among siblings', function() {
  var router, root;

  router = Router();
  router.addState('root', State());
  throws(function() {
    router.addState('root', State());
  });

  root = State();
  root.addState('child', State());
  throws(function() {
    root.addState('child', State());
  });

});


test('Only leaf states are addressable', function() {

  var router = Router({
    index: State(),

    articles: State({
      item: State('articles/:id', {})
    })
  }).init('');

  throws(function() {
    router.state('articles');
  });

});


test('No transition occurs when going to the same state', function() {

  var events = [];
  var router = Router({

    articles: State('articles/:id', {
      enter: function() { events.push('articlesEnter'); },
      exit: function() { events.push('articlesExit'); },

      today: State('today', {
        enter: function() { events.push('todayEnter'); },
        exit: function() { events.push('todayExit'); }
      })
    })

  }).init('articles/33/today');

  events = [];

  router.state('articles/33/today');
  deepEqual(events, []);

});


test('Param and query changes should trigger a transition', function() {

  var events = [],
      lastArticleId;

  var router = Router({

    blog: State('blog', {
      enter: function() {
        events.push('blogEnter');
      },

      exit: function() {
        events.push('blogExit');
      },

      articles: State('articles/:id', {
        enter: function(params) {
          events.push('articlesEnter');
          lastArticleId = params.id;
        },

        exit: function() {
          events.push('articlesExit');
        },


        edit: State('edit', {
          enter: function() {
            events.push('editEnter');
          },

          exit: function() {
            events.push('editExit');
          }
        })

      })

    })

  }).init('blog/articles/33/edit');


  changeParamOnly();
  stateWasReEntered();
  addQueryString();
  stateWasFullyReEntered();
  changeQueryStringValue();
  stateWasFullyReEntered();


  function changeParamOnly() {
    events = [];
    router.state('blog/articles/44/edit');
  }

  // The transition only goes up to the state owning the param
  function stateWasReEntered() {
    deepEqual(events, ['editExit', 'articlesExit', 'articlesEnter', 'editEnter']);
    events = [];
  }

  function addQueryString() {
    router.state('blog/articles/44/edit?filter=1');
  }

  // By default, a change in the query will result in a complete transition to the root state and back.
  function stateWasFullyReEntered() {
    deepEqual(events, ['editExit', 'articlesExit', 'blogExit', 'blogEnter', 'articlesEnter', 'editEnter']);
    events = [];
  }

  function changeQueryStringValue() {
    router.state('blog/articles/44/edit?filter=2');
  }

});


test('Param changes in a leaf state should not trigger a parent transition', function() {

  var events = [],
      lastArticleId;

  var router = Router({

    blog: State('blog', {
      enter: function() {
        events.push('blogEnter');
      },

      exit: function() {
        events.push('blogExit');
      },


      articles: State('articles/:id', {
        enter: function(params) {
          events.push('articlesEnter');
          lastArticleId = params.id;
        },

        exit: function() {
          events.push('articlesExit');
        }

      })

    })

  }).init('/blog/articles/33');


  changeParamOnly();
  stateWasReEntered();
  addQueryString();
  stateWasFullyReEntered();
  changeQueryStringValue();
  stateWasFullyReEntered();


  function changeParamOnly() {
    events = [];
    router.state('/blog/articles/44');
  }

  // The transition only goes up to the state owning the param
  function stateWasReEntered() {
    deepEqual(events, ['articlesExit', 'articlesEnter']);
    events = [];
  }

  function addQueryString() {
    router.state('/blog/articles/44?filter=1');
  }

  // By default, a change in the query will result in a complete transition to the root state and back.
  function stateWasFullyReEntered() {
    deepEqual(events, ['articlesExit', 'blogExit', 'blogEnter', 'articlesEnter']);
    events = [];
  }

  function changeQueryStringValue() {
    router.state('/blog/articles/44?filter=2');
  }

});


test('Query-only transitions', function() {

  var events = [];

  var router = Router({

    blog: State('blog', {
      enter: function() {
        events.push('blogEnter');
      },

      exit: function() {
        events.push('blogExit');
      },

      // articles is the state that owns the filter query param
      articles: State('articles/:id?filter', {
        enter: function() {
          events.push('articlesEnter');
        },

        exit: function() {
          events.push('articlesExit');
        },

        edit: State('edit', {
          enter: function() {
            events.push('editEnter');
          },

          exit: function() {
            events.push('editExit');
          }
        })
      })
    })
  }).init('blog/articles/33/edit');


  setSomeUnknownQuery();
  fullTransitionOccurred();
  setFilterQuery();
  onlyExitedUpToStateOwningFilter();
  swapFilterValue();
  onlyExitedUpToStateOwningFilter();
  removeFilterQuery();
  onlyExitedUpToStateOwningFilter();


  function setSomeUnknownQuery() {
    events = [];
    router.state('blog/articles/33/edit?someQuery=true');
  }

  function fullTransitionOccurred() {
    deepEqual(events, ['editExit', 'articlesExit', 'blogExit', 'blogEnter', 'articlesEnter', 'editEnter']);
  }

  function setFilterQuery() {
    events = [];
    router.state('blog/articles/33/edit?filter=33');
  }

  function onlyExitedUpToStateOwningFilter() {
    deepEqual(events, ['editExit', 'articlesExit', 'articlesEnter', 'editEnter']);
  }
  
  function swapFilterValue() {
    events = [];
    router.state('blog/articles/33/edit?filter=34');
  }

  function removeFilterQuery() {
    events = [];
    router.state('blog/articles/33/edit');
  }

});


test('The query string is provided to all states', function() {

  Router({
    one: State('one/:one', {
      enter: function(param) {
        assertions(param.one, 44, param);
      },

      two: State('two/:two', {
        enter: function(param) {
          assertions(param.two, 'bla', param);
        },

        three: State('three/:three', {
          enter: function(param) {
            assertions(param.three, 33, param);
          }
        })
      })
    })
  }).init('one/44/two/bla/three/33?filter1=123&filter2=456');


  function assertions(param, expectedParam, queryObj) {
    equal(param, expectedParam);
    equal(queryObj.filter1, 123);
    equal(queryObj.filter2, 456);
  }

});


test('Data can be stored on states and later retrieved', function() {

  var two = State();

  var router = Router({

    one: State({
      // Statically declared
      data: { someArbitraryData: 3 },

      enter: function() {
        // We can also store data at an arbitrary time.
        this.data('otherData', 5);
      },

      two: two
    })

  }).init('');

  // A child state can see the data of its parent
  equal(two.data('someArbitraryData'), 3);
  equal(two.data('otherData'), 5);

  // The parent can see its own data
  equal(two.parent.data('someArbitraryData'), 3);
});


test('Reverse routing', function() {
  var router = Router({

    index: State(),

    one: State('one?filter&pizza', {
      two: State(':id/:color')
    })

  }).init('');

  var href = router.link('one.two', {id: 33, color: 'dark green', filter: 'a&b', pizza: 123, bla: 55});
  equal(href, '/one/33/dark%20green?filter=a%26b&pizza=123');

  href = router.link('one.two', {id: 33, color: 'dark green'});
  equal(href, '/one/33/dark%20green')

});


test('State construction shorthand', function() {

  var router = Router({

    index: State('index/:id', function(params) {
      strictEqual(params.id, '55');
      strictEqual(params.filter, 'true');
    })

  }).init('index/55?filter=true');

});


test('params should be decoded automatically', function() {
  var passedParams;

  var router = Router({

    index: State('index/:id/:filter', function(params) {
      passedParams = params;
    })

  }).init('index/The%20midget%20%40/a%20b%20c');

  equal(passedParams.id, 'The midget @');
  equal(passedParams.filter, 'a b c');
});


test('redirect', function() {
  var oldRouteChildEntered;
  var oldRouteExited;
  var newRouteEntered;

  var router = Router({

    oldRoute: State('oldRoute', {
      enter: function() {
        router.state('newRoute'); 
      },
      exit: function() { oldRouteExited = true; },

      oldRouteChild: State('child', function() { oldRouteChildEntered = true; })
    }),

    newRoute: State('newRoute', function() { newRouteEntered = true; })

  });

  router.init('oldRoute.oldRouteChild');

  ok(!oldRouteExited, 'The state was not properly entered as it redirected immediately. Therefore, it should not exit.');
  ok(!oldRouteChildEntered, 'A child state of a redirected route should not be entered');
  ok(newRouteEntered);
});


test('Redirecting from transition.started', function() {

  var completedCount = 0;

  var router = Router({
    index: State(''),
    uno: State('uno', incrementCompletedCount),
    dos: State('dos', incrementCompletedCount)
  })
  .init('');

  addListener();
  goToUno();
  assertions();

  function addListener() {
    var binding = router.transition.started.add(function() {
      binding.detach();
      router.state('dos');
    });
  }
  
  function goToUno() {
    router.state('uno');
  }

  function assertions() {
    equal(completedCount, 1);
    equal(router.currentState().state.name, 'dos');
  }

  function incrementCompletedCount() {
    completedCount++;
  }

});


test('rest params', function() {

  var lastParams;

  var router = Router({
    index: State(),
    colors: State('colors/:rest*', function(params) {
      lastParams = params;
    })
  }).init('');

  goToColors();
  wentToColorsOk();
  goToColors2();
  wentToColors2Ok();
  goToColors3();
  wentToColors3Ok();


  function goToColors() {
    router.state('colors');
  }

  function wentToColorsOk() {
    strictEqual(lastParams.rest, undefined);
  }

  function goToColors2() {
    router.state('colors/red');
  }

  function wentToColors2Ok() {
    strictEqual(lastParams.rest, 'red');
  }

  function goToColors3() {
    router.state('colors/red/blue');
  }

  function wentToColors3Ok() {
    strictEqual(lastParams.rest, 'red/blue');
  }

});


test('backTo', function() {
  var passedParams;

  var router = Router({

    articles: State('articles/:id?filter', rememberParams),

    books: State('books'),

    cart: State('cart/:mode', rememberParams)

  }).init('articles/33?filter=66');


  goToBooks();
  goBackToArticles();
  paramsShouldBeThePreviousOnes();
  goBackToCart();
  paramsShouldBeThePassedDefaults();


  function rememberParams(params) {
    passedParams = params;
  }

  function goToBooks() {
    router.state('books');
  }

  function goBackToArticles() {
    passedParams = null;
    router.backTo('articles', { id: 1 });
  }

  function paramsShouldBeThePreviousOnes() {
    strictEqual(passedParams.id, '33');
    strictEqual(passedParams.filter, '66');
  }

  // We've never been to cart before, thus the default params we pass should be used
  function goBackToCart() {
    router.backTo('cart', {mode: 'default'});
  }

  function paramsShouldBeThePassedDefaults() {
    strictEqual(passedParams.mode, 'default');
  }

});


test('update', function() {
  var events = [];
  var updateParams;

  var root    = RecordingState('root', '');
  var news    = RecordingState('news', 'news/:id', root, true);
  var archive = RecordingState('archive', 'archive', news);
  var detail  = RecordingState('detail', 'detail', archive, true);


  var router = Router({
    root: root
  })
  .init('root.news.archive.detail', { id: 33 });


  callbacksWereProperlyCalledOnInit();
  changeIdParam();
  stateWereEnteredOrUpdated();


  function callbacksWereProperlyCalledOnInit() {
    deepEqual(events, [
      'rootEnter',
      'newsEnter',
      'archiveEnter',
      'detailEnter'
    ]);
  }

  function changeIdParam() {
    events = [];
    updateParams = null;
    router.state('root.news.archive.detail', { id: 34 });
  }

  function stateWereEnteredOrUpdated() {
    deepEqual(events, [
      'archiveExit',
      'newsUpdate',
      'archiveEnter',
      'detailUpdate'
    ]);
    strictEqual(updateParams.id, '34');
  }

  function RecordingState(name, path, parent, withUpdate) {
    var state = State(path, {
      enter: function(params) { events.push(name + 'Enter'); },
      exit: function() { events.push(name + 'Exit'); }
    });

    if (withUpdate) state.update = function(params) {
      events.push(name + 'Update');
      updateParams = params;
    };

    if (parent) parent.addState(name, state);

    return state;
  }

});


function stateWithParamsAssertions(stateWithParams) {
  equal(stateWithParams.state.name, 'state1Child');
  equal(stateWithParams.state.fullName, 'state1.state1Child');

  ok(stateWithParams.state.data('myData'), 666);

  ok(stateWithParams.params.id, '33');
  ok(stateWithParams.params.category, 'misc');
  ok(stateWithParams.params.filter, true);

  ok(stateWithParams.isIn('state1'));
  ok(stateWithParams.isIn('state1.state1Child'));
  ok(!stateWithParams.isIn('state2'));
}

test('signal handlers are passed StateWithParams objects', function() {

  var router = Router({

    state1: State('state1/:id', {
      state1Child: State(':category', {
        data: { myData: 666 }
      })
    }),

    state2: State('state2/:country/:city')
  });

  router.transition.started.addOnce(stateWithParamsAssertions);

  router.init('state1/33/misc?filter=true');
});


test('router.currentState and router.previousState', function() {

  var router = Router({

    state1: State('state1/:id', {
      state1Child: State(':category', {
        enter: assertions,
        data: { myData: 666 }
      })
    }),

    state2: State('state2/:country/:city')

  });

  router.init('state1/33/misc?filter=true');


  function assertions() {
    var state = router.currentState();
    stateWithParamsAssertions(state);

    equal(router.previousState(), null);

    router.state('state2/england/london');

    var previousState = router.previousState();
    equal(previousState, state);
    stateWithParamsAssertions(previousState);

    equal(router.currentState().state.fullName, 'state2');
  }

});


test('urls can contain dots', function() {

  Router({
    map: State('map/:lat/:lon', function(params) {
      strictEqual(params.lat, '1.5441');
      strictEqual(params.lon, '0.9986');
    })
  }).init('map/1.5441/0.9986');

});


test('util.normalizePathQuery', function() {

  function expect(from, to) {
    var assertMessage = ('"' + from + '" => "' + to + '"');
    equal(Abyssa.util.normalizePathQuery(from), to, assertMessage);
  }

  // No slash changes required
  expect("/", "/");
  expect("/path", "/path");
  expect("/path/a/b/c", "/path/a/b/c");
  expect("/path?query", "/path?query");
  expect("/path/a/b/c?query", "/path/a/b/c?query");
  expect("/path/a/b/c?query=///", "/path/a/b/c?query=///");
  
  // Slashes are added
  expect("", "/");
  expect("path", "/path");
  expect("path/a/b/c", "/path/a/b/c");
  expect("path?query", "/path?query");
  expect("path/a/b/c?query", "/path/a/b/c?query");
  expect("?query", "/?query");
  
  // Slashes are removed
  expect("//", "/");
  expect("///", "/");
  expect("//path", "/path");
  expect("//path/a/b/c", "/path/a/b/c");
  expect("//path/", "/path");
  expect("//path/a/b/c/", "/path/a/b/c");
  expect("//path//", "/path");
  expect("//path/a/b/c//", "/path/a/b/c");
  expect("/path//", "/path");
  expect("/path/a/b/c//", "/path/a/b/c");
  expect("//path?query", "/path?query");
  expect("//path/a/b/c?query", "/path/a/b/c?query");
  expect("/path/?query", "/path?query");
  expect("/path/a/b/c/?query", "/path/a/b/c?query");
  expect("/path//?query", "/path?query");
  expect("/path/a/b/c//?query", "/path/a/b/c?query");

});


test('can prevent a transition by navigating to self from the exit handler', function() {

  var events = [];

  var router = Router({
    uno: State('uno', {
      enter: function() { events.push('unoEnter'); },
      exit: function() { router.state('uno'); }
    }),
    dos: State('dos', {
      enter: function() { events.push('dosEnter'); },
      exit: function() { events.push('dosExit'); }
    })
  })
  .init('uno');

  router.state('dos');
  // Only the initial event is here. 
  // Since the exit was interrupted, there's no reason to re-enter.
  deepEqual(events, ['unoEnter']);
  equal(router.currentState().state.name, 'uno');
});


test('router path/query/params utils', function() {

  var queryParams = ['q1', 'q2', 'q3'].join('&');

  var router = Router({
    parent: State('?parentQuery', {
      book: State('books/:id/category/:cat?' + queryParams)
    })
  })
  .init('books/33/category/sci-fi?q1=11&q2=yes');

  bookAssertions();
  updateBook();
  updatedBookAssertions();

  function bookAssertions() {
    equal(router.path(), '/books/33/category/sci-fi');
    equal(router.query(), 'q1=11&q2=yes');

    deepEqual(router.params(), { id: '33', cat: 'sci-fi', q1: '11', q2: 'yes' });
    deepEqual(router.queryParams(), { q1: '11', q2: 'yes' });

    deepEqual(router.paramsDiff(), {
      update: {},
      enter:  { id: true, cat: true, q1: true, q2: true },
      exit:   {},
      all:    { id: true, cat: true, q1: true, q2: true }
    });
  }

  function updateBook() {
    var params = router.params();
    params.id = 44;
    params.q1 = 'red';
    params.q3 = 'new';
    delete params.q2;

    router.state('parent.book', params);
  }

  function updatedBookAssertions() {
    equal(router.path(), '/books/44/category/sci-fi');
    equal(router.query(), 'q1=red&q3=new');

    deepEqual(router.params(), { id: '44', cat: 'sci-fi', q1: 'red', q3: 'new' });
    deepEqual(router.queryParams(), { q1: 'red', q3: 'new' });

    deepEqual(router.paramsDiff(), {
      update: { id: true, q1: true },
      enter:  { q3: true },
      exit:   { q2: true },
      all:    { id: true, q1: true, q2: true, q3: true }
    });
  }

});


function stubHistory() {
  window.history.pushState = function() {};
}
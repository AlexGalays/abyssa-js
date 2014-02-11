

Router = Abyssa.Router;
State  = Abyssa.State;
Async  = Abyssa.Async;

//Router.enableLogs();
stubHistory();

QUnit.config.testTimeout = 4000;


asyncTest('Simple states', function() {

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

  whenSignal(router.changed)
    .then(indexWasEntered)
    .then(goToArticles)
    .then(articlesWasEntered)
    .then(resetToIndex)
    .then(indexWasEntered2)
    .then(goToArticlesWithFilter)
    .then(articlesWasEnteredWithFilter)
    .done(start);

  function indexWasEntered() {
    deepEqual(events, ['indexEnter']);
    events = [];
  }

  function goToArticles() {
    router.state('articles', {id: 38, filter: 555});
  }

  function articlesWasEntered() {
    return nextTick().then(function() {
      deepEqual(events, ['indexExit', 'articlesEnter']);
      strictEqual(lastArticleId, 38);
      strictEqual(lastFilter, 555);
      events = [];
    });
  }

  function resetToIndex() {
    router.state('index');
  }

  function indexWasEntered2() {
    return nextTick().then(function() {
      deepEqual(events, ['articlesExit', 'indexEnter']);
      events = [];
    });
  }

  function goToArticlesWithFilter() {
    router.state('articles/44?filter=666');
  }

  function articlesWasEnteredWithFilter() {
    return nextTick().then(function() {
      deepEqual(events, ['indexExit', 'articlesEnter']);
      strictEqual(lastArticleId, 44);
      strictEqual(lastFilter, 666);
    });
  }

});


asyncTest('Custom initial state', function() {

  var router = Router({

    articles: State('articles/:id', {
      edit: State('edit', {
        enter: function() { 
          ok(true);
          start();
        }
      })
    })

  }).init('articles/33/edit');

});


asyncTest('Multiple dynamic paths', function() {

  Router({
    article: State('articles/:slug/:articleId', {
      changeLogs: State('changelogs/:changeLogId', {
        enter: function(params) {
          equal(params.slug, 'le-roi-est-mort');
          equal(params.articleId, 127);
          equal(params.changeLogId, 5);
          start();
        }
      })
    })
  }).init('articles/le-roi-est-mort/127/changelogs/5');

});


asyncTest('Nested state with pathless parents', function() {

  Router({

    // articles and nature are abstract parent states
    articles: State({
      nature: State({
        edit: State('articles/nature/:id/edit', {
          enter: function() {
            ok(true);
            start();
          }
        })
      })
    })

  }).init('articles/nature/88/edit');

});


asyncTest('Missing state with a "notFound" state defined', function() {

  var reachedNotFound;

  var router = Router({

    index: State(),

    articles: State({
      nature: State({
        edit: State('articles/nature/:id/edit')
      })
    })

  })
  .configure({
    notFound: State({
      enter: function() { reachedNotFound = true; }
    })
  })
  .init('articles/naturess/88/edit');

  whenSignal(router.changed)
    .then(notFoundWasEntered)
    .then(resetToIndex)
    .then(goToWrongState)
    .then(notFoundWasEntered2)
    .then(start);

  function notFoundWasEntered() {
    ok(reachedNotFound);
  }

  function resetToIndex() {
    router.state('');
    reachedNotFound = false;
  }

  // Should also work with the reverse routing notation
  function goToWrongState() {
    return nextTick().then(function() {
      router.state('articles.naturess.edit', {id: 88});
    });
  }

  function notFoundWasEntered2() {
    return nextTick().then(function() {
      ok(reachedNotFound);
    });
  }

});


asyncTest('Missing state with a "notFound" state defined by its fullName', function() {

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

  whenSignal(router.changed)
    .then(notFoundWasEntered)
    .then(resetToIndex)
    .then(goToWrongState)
    .then(notFoundWasEntered2)
    .then(start);

  function notFoundWasEntered() {
    ok(reachedNotFound);
  }

  function resetToIndex() {
    router.state('');
    reachedNotFound = false;
  }

  // Should also work with the reverse routing notation
  function goToWrongState() {
    return nextTick().then(function() {
      router.state('articles.naturess.edit', {id: 88});
    });
  }

  function notFoundWasEntered2() {
    return nextTick().then(function() {
      ok(reachedNotFound);
    });
  }

});


asyncTest('Missing state without a "notFound" state defined', function() {

  var router = Router({

    index: State(),

    articles: State({
      nature: State({
        edit: State('articles/nature/:id/edit')
      })
    }),

  }).init('');

  router.changed.addOnce(function() {
    throws(function() {
      router.state('articles/naturess/88/edit');
    });

    // Also work with the reverse routing notation
    throws(function() {
      router.state('articles.naturess.edit', {id: 88});
    });

    start();
  });

});


asyncTest('The router can be built bit by bit', function() {

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

  router.changed.addOnce(function() {
    ok(reachedArticlesEdit);
    start();
  });
  
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


asyncTest('Only leaf states are addressable', function() {

  var router = Router({
    index: State(),

    articles: State({
      item: State('articles/:id', {})
    })
  }).init('');

  router.changed.addOnce(function() {
    throws(function() {
      router.state('articles');
    });
    start();
  });

});


asyncTest('No transition occurs when going to the same state', function() {

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

  router.changed.addOnce(function() {
    events = [];

    router.state('articles/33/today');

    nextTick().then(function() {
      deepEqual(events, []);
      start();
    });
  });

});


asyncTest('Forcing reload on same state transition is possible', function() {

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

  })
  .init('articles/33/today');

  router.transition.prevented.addOnce(function(stateCandidate) {
    if (stateCandidate.fullName == 'articles.today') router.reload();
  });

  router.changed.addOnce(function() {
    events = [];

    router.state('articles/33/today');

    nextTick().then(function() {
      deepEqual(events, ['todayExit', 'articlesExit', 'articlesEnter', 'todayEnter']);
      start();
    });
  });

});


asyncTest('Async enter transitions', function() {

  var events = [];
  var router = Router({

    index: State({
      enter: function() {
        events.push('indexEnter');
      },

      exit: function() {
        events.push('indexExit');
      }
    }),

    news: State('news', {
      enter: function(params, data) {
        strictEqual(data, 'data');
        events.push('newsEnter');
      },
      enterPrereqs: function() {
        return successPromise(50, 'data', notYetEntered);
      },

      exit: function() {
        events.push('newsExit');
      },


      today: State('today', {
        enter: function(params, data) {
          strictEqual(data, 48);
          events.push('todayEnter');
        },
        enterPrereqs: function() {
          return successPromise(150, 48);
        },

        exit: function() {
          events.push('todayExit');
        }
      }),


      thisWeek: State('thisWeek', {
        enter: function() {
          events.push('thisWeekEnter');
        },

        exit: function() {
          events.push('thisWeekExit');
        }
      })

    }),

    failing: State('fail', {
      enterPrereqs: function() {
        return failPromise(50);
      },

      // This child state is unreachable because its parent can never resolve its enterPrereqs.
      failingChild: State('child', {
        enter: function() {
          events.push('failChildEnter');
        }
      })

    })

  }).init('');

  router.changed.addOnce(function() {
    events = [];

    router.state('news/today');
    router.changed.addOnce(function() {
      todayWasEntered();
      goToThisWeek();

      thisWeekWasEntered()
        .then(resetToIndex)
        .then(goToFailChild)
        .then(failChildWasNotEntered)
        .then(start);
    });

  });

  // The news's enterPrereqs has been resolved but not today's.
  // No transition occured as we wait for all the prereqs to be resolved.
  function notYetEntered() {
    deepEqual(events, []);
  }

  function todayWasEntered() {
    deepEqual(events, ['indexExit', 'newsEnter', 'todayEnter']);
    events = [];
  }

  function goToThisWeek() {
    router.state('news/thisWeek');
  }

  function thisWeekWasEntered() {
    return nextTick().then(function() {
      deepEqual(events, ['todayExit', 'thisWeekEnter']);
      events = [];
    });
  }

  function resetToIndex() {
    router.state('');

    return nextTick().then(function() {
      events = [];
    });
  }

  function goToFailChild() {
    router.state('fail/child');
  }

  // In case of an async failure, the transition must not occur.
  function failChildWasNotEntered() {
    return whenSignal(router.transition.failed).then(function() {
      deepEqual(events, []);
    });
  }

});


asyncTest('prereqs can return non promise values', function() {

  Router({
    index: State({
      enterPrereqs: function() {
        return 3;
      },
      enter: function(params, value) {
        equal(value, 3);
        start();
      }
    })
  }).init('');

});


asyncTest('Cancelling an async transition', function() {

  var events = [];
  var router = Router({

    index: State(),

    articles: State('articles', {
      enter: function() {
        events.push('articlesEnter');
      },

      exit: function() {
        events.push('articlesExit');
      }
    }),

    news: State('news', {
      enter: function() { events.push('newsEnter'); },
      exit: function() { events.push('newsExit'); },

      today: State('today', {
        enter: function() { events.push('todayEnter'); },
        enterPrereqs: function() {
          return delay(60);
        },
        exit: function() { events.push('todayExit'); }
      }),

      thisWeek: State('thisWeek', {
        enter: function() { events.push('thisWeekEnter'); },
        exit: function() { events.push('thisWeekExit'); }
      })

    })

  }).init('news/today');

  nextTick()
    .then(cancelAndGoToThisWeek)
    .then(thisWeekWasEntered)
    .then(todayWasNeverEntered)
    .then(start);

  function cancelAndGoToThisWeek() {
    // But we change our mind and go to the 'thisWeek' (synchronous) section
    router.state('news/thisWeek');
  }

  function thisWeekWasEntered() {
    return nextTick().then(function() {
      deepEqual(events, ['newsEnter', 'thisWeekEnter']);
      events = [];
    });
  }

  function todayWasNeverEntered() {
    return delay(200).then(function() {
      deepEqual(events, []);
    });
  }

});


asyncTest('Param and query changes should trigger a transition', function() {

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


  whenSignal(router.changed)
    .then(changeParamOnly)
    .then(stateWasReEntered)
    .then(addQueryString)
    .then(stateWasFullyReEntered)
    .then(changeQueryStringValue)
    .then(stateWasFullyReEntered)
    .then(start);


  function changeParamOnly() {
    router.state('blog/articles/44/edit');
    events = [];
  }

  // The transition only goes up to the state owning the param
  function stateWasReEntered() {
    return nextTick().then(function() {
      deepEqual(events, ['editExit', 'articlesExit', 'articlesEnter', 'editEnter']);
      events = [];
    });
  }

  function addQueryString() {
    router.state('blog/articles/44/edit?filter=1');
  }

  // By default, a change in the query will result in a complete transition to the root state and back.
  function stateWasFullyReEntered() {
    return nextTick().then(function() {
      deepEqual(events, ['editExit', 'articlesExit', 'blogExit', 'blogEnter', 'articlesEnter', 'editEnter']);
      events = [];
    });
  }

  function changeQueryStringValue() {
    router.state('blog/articles/44/edit?filter=2');
  }

});


asyncTest('Param changes in a leaf state should not trigger a parent transition', function() {

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


  nextTick()
    .then(changeParamOnly)
    .then(stateWasReEntered)
    .then(addQueryString)
    .then(stateWasFullyReEntered)
    .then(changeQueryStringValue)
    .then(stateWasFullyReEntered)
    .then(start);


  function changeParamOnly() {
    router.state('/blog/articles/44');
    events = [];
  }

  // The transition only goes up to the state owning the param
  function stateWasReEntered() {
    return nextTick().then(function() {
      deepEqual(events, ['articlesExit', 'articlesEnter']);
      events = [];
    });
  }

  function addQueryString() {
    router.state('/blog/articles/44?filter=1');
  }

  // By default, a change in the query will result in a complete transition to the root state and back.
  function stateWasFullyReEntered() {
    return nextTick().then(function() {
      deepEqual(events, ['articlesExit', 'blogExit', 'blogEnter', 'articlesEnter']);
      events = [];
    });
  }

  function changeQueryStringValue() {
    router.state('/blog/articles/44?filter=2');
  }

});


asyncTest('Query-only transitions', function() {

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


  whenSignal(router.changed)
    .then(setSomeUnknownQuery)
    .then(fullTransitionOccurred)
    .then(setFilterQuery)
    .then(onlyExitedUpToStateOwningFilter)
    .then(swapFilterValue)
    .then(onlyExitedUpToStateOwningFilter)
    .then(removeFilterQuery)
    .then(onlyExitedUpToStateOwningFilter)
    .then(start);


  function setSomeUnknownQuery() {
    router.state('blog/articles/33/edit?someQuery=true');
    events = [];
  }

  function fullTransitionOccurred() {
    return nextTick().then(function() {
      deepEqual(events, ['editExit', 'articlesExit', 'blogExit', 'blogEnter', 'articlesEnter', 'editEnter']);
    });
  }

  function setFilterQuery() {
    router.state('blog/articles/33/edit?filter=33');
    events = [];
  }

  function onlyExitedUpToStateOwningFilter() {
    return nextTick().then(function() {
      deepEqual(events, ['editExit', 'articlesExit', 'articlesEnter', 'editEnter']);
    });
  }
  
  function swapFilterValue() {
    router.state('blog/articles/33/edit?filter=34');
    events = [];
  }

  function removeFilterQuery() {
    router.state('blog/articles/33/edit');
    events = [];
  }

});


asyncTest('The query string is provided to all states', function() {

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
            start();
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


asyncTest('Prereqs also get params', function() {

  Router({

    articles: State('articles', {
      item: State(':id', {
        enterPrereqs: function(params) {
          equal(params.id, 56);
          start();
          return 'dummy';
        }
      })
    })

  }).init('articles/56');

});


asyncTest('Data can be stored on states and later retrieved', function() {

  var router = Router({

    one: State({
      // Statically declared
      data: { someArbitraryData: 3 },

      enter: function() {
        // We can also store data at an arbitrary time.
        this.data('otherData', 5);
      },

      two: State()
    })

  }).init('');

  router.changed.add(function(newState) {

    // A child state can see the data of its parent
    equal(newState.data('someArbitraryData'), 3);
    equal(newState.data('otherData'), 5);

    // The parent can see its own data
    equal(newState.state.parent.data('someArbitraryData'), 3);

    start();
  });

});


test('Reverse routing', function() {
  var router = Router({

    index: State(),

    one: State('one?filter', {
      two: State(':id')
    })

  }).init('');

  var href = router.link('one.two', {id: 33, filter: 'bloup', bla: 55});
  equal(href, '/one/33?filter=bloup');

});


asyncTest('Non blocking promises as an alternative to prereqs', function() {
  var promiseValue = null;

  var router = Router({

    index: State(),

    one: State('one', {
      enter: function() {
        Async(successPromise(150, 'value')).then(function(value) {
          promiseValue = value;

          beginAssertions();
        });
      }
    })

  }).init('one');

  function beginAssertions() {
    when(promiseWasResolved())
      .then(exitThenReEnterStateOne)
      .then(cancelNavigation)
      .then(promiseShouldNotHaveBeenResolved)
      .then(start);
  }

  function promiseWasResolved() {
    strictEqual(promiseValue, 'value');
    promiseValue = null;
  }

  function exitThenReEnterStateOne() {
    router.state('index');
    return nextTick().then(function() {
      router.state('one');
    });
  }

  function cancelNavigation() {
    return nextTick().then(function() {
      router.state('index');
    });
  }

  function promiseShouldNotHaveBeenResolved() {
    return delay(200).then(function() {
      strictEqual(promiseValue, null);
    });
  }

});

asyncTest('Non blocking rejected promises', function() {
  var promiseValue = null,
      promiseError = null;

  var router = Router({

    index: State(),

    one: State('one', {
      enter: function() {
        Async(failPromise(80)).then(
          function(value) { promiseValue = value; },
          function(error) { promiseError = error; }
        )
        .fin(beginAssertions);
      }
    })

  }).init('one');

  function beginAssertions() {
    when(promiseWasRejected())
      .then(exitThenReEnterStateOne)
      .then(cancelNavigation)
      .then(promiseShouldNotHaveBeenResolved)
      .done(start);
  }

  function promiseWasRejected() {
    strictEqual(promiseValue, null);
    strictEqual(promiseError.message, 'error');
    promiseError = null;
  }

  function exitThenReEnterStateOne() {
    router.state('index');
    return nextTick().then(function() {
      router.state('one');
    });
  }

  function cancelNavigation() {
    return nextTick().then(function() {
      router.state('index');
    });
  }

  function promiseShouldNotHaveBeenResolved() {
    return delay(150).then(function() {
      strictEqual(promiseValue, null);
      strictEqual(promiseError, null);
    });
  }

});

asyncTest('State construction shorthand', function() {

  var passedParams = {};
  var passedData;

  var router = Router({

    index: State('index/:id', function(params) {
      var data = successPromise(50, 'data');

      passedParams = params;

      paramsWerePassed();

      this.async(data).then(function(data) {
        passedData = data;

        asyncWasCalled();
        start();
      });

    })

  }).init('index/55?filter=true');

  function paramsWerePassed() {
    strictEqual(passedParams.id, 55);
    strictEqual(passedParams.filter, true);
    strictEqual(passedData, undefined);
  }

  function asyncWasCalled() {
    strictEqual(passedData, 'data');
  }

});


asyncTest('params should be decoded automatically', function() {
  var passedParams;

  var router = Router({

    index: State('index/:id/:filter', function(params) {
      passedParams = params;
    })

  }).init('index/The%20midget%20%40/a%20b%20c');

  whenSignal(router.changed).then(paramsWereDecoded);

  function paramsWereDecoded() {
    equal(passedParams.id, 'The midget @');
    equal(passedParams.filter, 'a b c');
    start();
  }

});


asyncTest('Redirects', function() {
  var oldRouteChildEntered;
  var oldRouteExited;
  var newRouteEntered;

  var router = Router({

    oldRoute: State('oldRoute', {
      enter: function() { router.redirect('newRoute'); },
      exit: function() { oldRouteExited = true; },

      oldRouteChild: State('child', function() { oldRouteChildEntered = true; })
    }),

    newRoute: State('newRoute', function() { newRouteEntered = true; })

  }).init('oldRoute.oldRouteChild');

  whenSignal(router.changed).then(assertions);

  function assertions() {
    ok(oldRouteExited, 'Any entered state should be exited, even if it simply redirected');
    ok(!oldRouteChildEntered, 'A child state of a redirected route should not be entered');
    ok(newRouteEntered);

    start();
  }

});


asyncTest('Redirecting from transition.started', function() {

  var completedCount = 0;

  var router = Router({
    index: State(''),
    uno: State('uno', incrementCompletedCount),
    dos: State('dos', incrementCompletedCount)
  })
  .init('');

  whenSignal(router.changed)
    .then(addListener)
    .then(goToUno)
    .then(assertions)
    .then(start);


  function addListener() {
    router.transition.started.addOnce(function() {
      router.redirect('dos');
    });
  }
  
  function goToUno() {
    router.state('uno');
  }

  function assertions() {
    return nextTick().then(function() {
      equal(completedCount, 1);
      equal(router.currentState().name, 'dos');
    });
  }

  function incrementCompletedCount() {
    completedCount++;
  }

});


asyncTest('backTo', function() {
  var passedParams;

  var router = Router({

    articles: State('articles/:id?filter', rememberParams),

    books: State('books'),

    cart: State('cart/:mode', rememberParams)

  }).init('articles/33?filter=66');


  whenSignal(router.changed)
    .then(goToBooks)
    .then(goBackToArticles)
    .then(paramsShouldBeThePreviousOnes)
    .then(goBackToCart)
    .then(paramsShouldBeThePassedDefaults)
    .done(start);


  function rememberParams(params) {
    passedParams = params;
  }

  function goToBooks() {
    router.state('books');
  }

  function goBackToArticles() {
    return nextTick().then(function() {
      passedParams = null;
      router.backTo('articles', {id : 1});
    });
  }

  function paramsShouldBeThePreviousOnes() {
    return nextTick().then(function() {
      strictEqual(passedParams.id, 33);
      strictEqual(passedParams.filter, 66);
    });
  }

  // We've never been to cart before, thus the default params we pass should be used
  function goBackToCart() {
    router.backTo('cart', {mode: 'default'});
  }

  function paramsShouldBeThePassedDefaults() {
    return nextTick().then(function() {
      strictEqual(passedParams.mode, 'default');
    });
  }

});


asyncTest('update', function() {
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


  whenSignal(router.changed)
    .then(callbacksWereProperlyCalledOnInit)
    .then(changeIdParam)
    .then(stateWereEnteredOrUpdated)
    .done(start);


  function callbacksWereProperlyCalledOnInit() {
    deepEqual(events, [
      'rootEnterPrereqs', 'newsEnterPrereqs', 'archiveEnterPrereqs', 'detailEnterPrereqs',
      'rootEnter',
      'newsEnter', 'newsUpdate',
      'archiveEnter',
      'detailEnter', 'detailUpdate'
    ]);

    strictEqual(updateParams.id, 33);
  }

  function changeIdParam() {
    events = [];
    updateParams = null;
    router.state('root.news.archive.detail', { id: 34 });
  }

  function stateWereEnteredOrUpdated() {
    return nextTick().then(function() {
      deepEqual(events, [
        'archiveEnterPrereqs',
        'archiveExit',
        'newsUpdate',
        'archiveEnter',
        'detailUpdate'
      ]);
      strictEqual(updateParams.id, 34);
    });
  }

  function RecordingState(name, path, parent, withUpdate) {
    var state = State(path, {
      enter: function(params) { events.push(name + 'Enter'); },
      enterPrereqs: function() { events.push(name + 'EnterPrereqs'); },
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


asyncTest('reload', function() {
  var articleId;

  var router = Router({

    articles: State('articles/:id', {

      enter: function(params) {
        articleId = params.id;
      },

      show: State('')

    })

  }).init('articles/99');

  whenSignal(router.changed)
    .then(reload)
    .then(allStatesWereReentered)
    .done(start);

  function reload() {
    articleId = null;
    router.reload();
  }

  function allStatesWereReentered() {
    return nextTick().then(function() {
      strictEqual(articleId, 99);
      strictEqual(router.currentState().fullName, 'articles.show');
    });
  }

});


function stateWithParamsAssertions(state) {
  ok(state.name, 'state1Child');
  ok(state.fullName, 'state1.state1Child');

  ok(state.data('myData'), 666);

  ok(state.params.id, 33);
  ok(state.params.category, 'misc');
  ok(state.params.filter, true);

  equal(state.fullName, 'state1.state1Child');
  notEqual(state.fullName, 'state1');
  ok(state.isIn('state1'));
  ok(state.isIn('state1.state1Child'));
  ok(!state.isIn('state2'));
}

asyncTest('signal handlers are passed StateWithParams objects', function() {

  var router = Router({

    state1: State('state1/:id', {
      state1Child: State(':category', {
        data: { myData: 666 }
      })
    }),

    state2: State('state2/:country/:city')

  }).init('state1/33/misc?filter=true');


  router.changed.addOnce(function(newState) {
    stateWithParamsAssertions(newState);
    start();
  });

});


asyncTest('router.currentState and router.previousState', function() {

  var router = Router({

    state1: State('state1/:id', {
      state1Child: State(':category', {
        enter: assertions,
        data: { myData: 666 }
      })
    }),

    state2: State('state2/:country/:city')

  }).init('state1/33/misc?filter=true');


  function assertions() {
    var state = router.currentState();
    stateWithParamsAssertions(state);

    equal(router.previousState(), null);

    router.state('state2/england/london');
    nextTick().done(function() {
      var previousState = router.previousState();
      equal(previousState, state);
      stateWithParamsAssertions(previousState);

      equal(router.currentState().fullName, 'state2');

      start();
    });
  }

});


asyncTest('urls can contain dots', function() {

  Router({
    map: State('map/:lat/:lon', function(params) {
      strictEqual(params.lat, 1.5441);
      strictEqual(params.lon, 0.9986);
      start();
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


function delay(time, value) {
  var defer = when.defer();
  setTimeout(function() { defer.resolve(value); }, time);
  return defer.promise;
}

function successPromise(time, value, afterResolveCallback) {
  var promise = delay(time, value);
  if (afterResolveCallback) promise.then(function() {
    // Ensures all 'then' callbacks were called
    setTimeout(afterResolveCallback, 0);
  });
  return promise;
}

function failPromise(time) {
  return delay(time).then(function() { throw new Error('error'); });
}

function nextTick() {
  return delay(20);
}

function whenSignal(signal) {
  var defer = when.defer();
  signal.addOnce(defer.resolve);
  return defer.promise;
}


function stubHistory() {
  window.history.pushState = function() {}; 
}
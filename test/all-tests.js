(function (global, QUnit, when, window) {

var
  Abyssa = global.Abyssa,
  Router, State, Async;

// An option to enable logging at the Router:
var routerLoggingEnabled = true;

// An option to add logging to the HTML5 History API methods:
var historyLoggingEnabled = true;

// An option to enable the HTML5 History API actual URL change:
var historyApiEnabled = false;

var
  initialTitle = (window.document && window.document.title),
  initialUrl = (window.location && window.location.href),
  pushState = (window.history && window.history.pushState),
  replaceState = (window.history && window.history.replaceState);

var historyStubsInstalled;
QUnit.module('Abyssa', {
  setup: function() {
    Router = Abyssa.Router;
    State  = Abyssa.State;
    Async  = Abyssa.Async;

    if (Router) {
      if (routerLoggingEnabled) {
        Router.enableLogs();
      }
      Router.ignoreInitialURL = true;
    }

    // Add logging to the HTML5 History API methods:
    if (window.history && (historyLoggingEnabled || !historyApiEnabled) && !historyStubsInstalled) {
      var logState = function(prefix, state, title, url) {
        window.document.title = initialTitle + " - " + url + "";
        if (global.console) { global.console.log(prefix + [global.JSON.stringify(url), global.JSON.stringify(title), global.JSON.stringify(state), global.JSON.stringify(window.location.href)].join(' ')); }
      };
      
      window.history.pushState = function(state, title, url) {
        if (historyLoggingEnabled) { logState('window.history.pushState ', state, title, url); }
        if (!pushState) { throw new TypeError("window.history.pushState"); }
        if (historyApiEnabled) { return pushState.apply(window.history, arguments); }
      };
      
      window.history.replaceState = function(state, title, url) {
        if (historyLoggingEnabled) { logState('window.history.replaceState ', state, title, url); }
        if (!replaceState) { throw new TypeError("window.history.replaceState"); }
        if (historyApiEnabled) { return replaceState.apply(window.history, arguments); }
      };
      
      historyStubsInstalled = true;
    }
  }
});

QUnit.done(function () {
  // Change the location bar URL to initial to be able to reload the test page:
  if (!window.history.emulate) {
    if (historyApiEnabled && pushState) { pushState.apply(window.history, [null, null, initialUrl]); }
  }
});


QUnit.test('Dependencies and Globals', function() {
  QUnit.assert.ok(window.history, "window.history");
  QUnit.assert.ok(window.history.pushState, "window.history.pushState");
  QUnit.assert.ok(window.history.replaceState, "window.history.replaceState");
  QUnit.assert.ok(global.JSON, "JSON");
  QUnit.assert.ok(Abyssa, "Abyssa");
  QUnit.assert.ok(Router, "Abyssa.Router");
  QUnit.assert.ok(typeof Router.enableLogs === 'function', "Abyssa.Router.enableLogs is a function");
  QUnit.assert.ok(typeof Router.setAsyncErrorHandler === 'function', "Abyssa.Router.setAsyncErrorHandler is a function");
  QUnit.assert.ok(State, "Abyssa.State");
  QUnit.assert.ok(Async, "Abyssa.Async");
});

QUnit.test('Abyssa.getParamDiff', function() {
  QUnit.assert.ok(typeof Abyssa.getParamDiff === 'function', "Abyssa.getParamDiff is a function");
  
  // TODO: Add tests for the param diff.
});

QUnit.test('Abyssa.normalizePathQuery', function() {
  function expectOne(from, to, removeLeadingSlash) {
    if (removeLeadingSlash) { to = to.replace(/^\//, ''); }
    QUnit.assert.equal(Abyssa.normalizePathQuery(from, removeLeadingSlash), to, '"' + from + '" => "' + to + '"'
      + ' (removeLeadingSlash === ' + (removeLeadingSlash === false ? 'false' : (removeLeadingSlash === true ? 'true' : typeof removeLeadingSlash)) + ')');
  }
  function expect(from, to) {
    expectOne(from, to);
    expectOne(from, to, false);
    expectOne(from, to, true);
  }
  
  QUnit.assert.ok(typeof Abyssa.normalizePathQuery === 'function', "Abyssa.normalizePathQuery is a function");

  // Keep:
  expect("/", "/");
  expect("/path", "/path");
  expect("/path/a/b/c", "/path/a/b/c");
  expect("/path?query", "/path?query");
  expect("/path/a/b/c?query", "/path/a/b/c?query");
  expect("/path/a/b/c?query=///", "/path/a/b/c?query=///");
  
  // Add:
  expect("", "/");
  expect("path", "/path");
  expect("path/a/b/c", "/path/a/b/c");
  expect("path?query", "/path?query");
  expect("path/a/b/c?query", "/path/a/b/c?query");
  expect("?query", "/?query");
  
  // Remove:
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

QUnit.test('Abyssa.getLocationObject', function() {
  QUnit.assert.ok(typeof Abyssa.getLocationObject === 'function', "Abyssa.getLocationObject is a function");
  
  // TODO: Add tests for the location object.
});

QUnit.test('Abyssa.getPathQuery', function() {
  QUnit.assert.ok(typeof Abyssa.getPathQuery === 'function', "Abyssa.getPathQuery is a function");
  
  // TODO: Add tests for the path-query.
});

QUnit.test('Abyssa.interceptAnchorClicks', function() {
  QUnit.assert.ok(typeof Abyssa.interceptAnchorClicks === 'function', "Abyssa.interceptAnchorClicks is a function");
  
  // TODO: Add tests for the anchor clicks interceptor.
});

QUnit.asyncTest('Simple states', function() {

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

    articles: State('articles/:id', {
      enter: function(params) {
        events.push('articlesEnter');
        lastArticleId = params.id;
        lastFilter = params.filter;
      },

      exit: function() {
        events.push('articlesExit');
      }
    })

  }).init();


  nextTick()
    .then(indexWasEntered)
    .then(goToArticles)
    .then(articlesWasEntered)
    .then(resetToIndex)
    .then(indexWasEntered2)
    .then(goToArticlesWithFilter)
    .then(articlesWasEnteredWithFilter)
    .then(QUnit.start);


  function indexWasEntered() {
    QUnit.assert.deepEqual(events, ['indexEnter']);
    events = [];
  }

  function goToArticles() {
    router.state('articles', {id: 38, query: {filter: 555}});
  }

  function articlesWasEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['indexExit', 'articlesEnter']);
      QUnit.assert.strictEqual(lastArticleId, 38);
      QUnit.assert.strictEqual(lastFilter, 555);
      events = [];
    });
  }

  function resetToIndex() {
    router.state('index');
  }

  function indexWasEntered2() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['articlesExit', 'indexEnter']);
      events = [];
    });
  }

  function goToArticlesWithFilter() {
    router.state('/articles/44?filter=666');
  }

  function articlesWasEnteredWithFilter() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['indexExit', 'articlesEnter']);
      QUnit.assert.strictEqual(lastArticleId, 44);
      QUnit.assert.strictEqual(lastFilter, 666);
    });
  }

});


QUnit.asyncTest('Custom initial state', function() {

  var router = Router({

    articles: State('articles/:id', {
      edit: State('edit', {
        enter: function() { 
          QUnit.assert.ok(true);
          QUnit.start();
        }
      })
    })

  }).init('/articles/33/edit');

});


QUnit.asyncTest('Multiple dynamic paths', function() {

  Router({
    article: State('articles/:slug/:articleId', {
      changeLogs: State('changelogs/:changeLogId', {
        enter: function(params) {
          QUnit.assert.equal(params.slug, 'le-roi-est-mort');
          QUnit.assert.equal(params.articleId, 127);
          QUnit.assert.equal(params.changeLogId, 5);
          QUnit.start();
        }
      })
    })
  }).init('/articles/le-roi-est-mort/127/changelogs/5');

});


QUnit.asyncTest('Optional path params', function() {

  var lastParams;

  var router = Router({
    articles: State('articles/:slug:/:articleId:', {
      enter: function(params) {
        lastParams = params;
      }
    })
  }).init('/articles');

  nextTick()
    .then(articlesWasEntered)
    .then(goToArticlesWithParams)
    .then(articlesWasEnteredWithParams)
    .then(QUnit.start);


  function goToArticlesWithParams() {
    router.state('articles', {slug: 'le-roi-est-mort', articleId: 127});
  }

  function articlesWasEntered() {
    QUnit.assert.notStrictEqual(lastParams, undefined);
    QUnit.assert.strictEqual(lastParams.slug, undefined);
    QUnit.assert.strictEqual(lastParams.articleId, undefined);
    lastParams = undefined;
  }

  function articlesWasEnteredWithParams() {
    return nextTick().then(function() {
      QUnit.assert.notStrictEqual(lastParams, undefined);
      QUnit.assert.strictEqual(lastParams.slug, 'le-roi-est-mort');
      QUnit.assert.strictEqual(lastParams.articleId, 127);
      lastParams = undefined;
    });
  }
});


QUnit.asyncTest('Nested state with pathless parents', function() {

  Router({

    // articles and nature are abstract parent states
    articles: State({
      nature: State({
        edit: State('articles/nature/:id/edit', {
          enter: function() {
            QUnit.assert.ok(true);
            QUnit.start();
          }
        })
      })
    })

  }).init('/articles/nature/88/edit');

});


QUnit.asyncTest('Missing state with a "notFound" state defined', function() {

  var reachedNotFound;

  var router = Router({

    index: State(),

    articles: State({
      nature: State({
        edit: State('articles/nature/:id/edit')
      })
    }),

    notFound: State({
      enter: function() { reachedNotFound = true; }
    })

  }).init('/articles/naturess/88/edit');

  nextTick()
    .then(notFoundWasEntered)
    .then(resetToIndex)
    .then(goToWrongState)
    .then(notFoundWasEntered2)
    .then(QUnit.start);

  function notFoundWasEntered() {
    QUnit.assert.ok(reachedNotFound);
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
      QUnit.assert.ok(reachedNotFound);
    });
  }

});


QUnit.asyncTest('Missing state without a "notFound" state defined', function() {

  var router = Router({

    index: State(),

    articles: State({
      nature: State({
        edit: State('/articles/nature/:id/edit')
      })
    })

  }).init();

  router.initialized.addOnce(function() {
    QUnit.assert.throws(function() {
      router.state('/articles/naturess/88/edit');
    });

    // Also work with the reverse routing notation
    QUnit.assert.throws(function() {
      router.state('articles.naturess.edit', {id: 88});
    });

    QUnit.start();
  });

});


QUnit.asyncTest('The router can be built bit by bit', function() {

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

  router.initialized.addOnce(function() {
    QUnit.assert.ok(reachedArticlesEdit);
    QUnit.start();
  });
  
});


QUnit.test('State names must be unique among siblings', function() {
  var router, root;

  router = Router();
  router.addState('root', State());
  QUnit.assert.throws(function() {
    router.addState('root', State());
  });

  root = State();
  root.addState('child', State());
  QUnit.assert.throws(function() {
    root.addState('child', State());
  });

});


QUnit.asyncTest('Only leaf states are addressable', function() {

  var router = Router({
    index: State(),

    articles: State({
      item: State('articles/:id', {})
    })
  });

  nextTick().then(function() {
    QUnit.assert.throws(function() {
      router.state('articles');
    });
    QUnit.start();
  });

});


QUnit.asyncTest('No transition occurs when going to the same state', function() {

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

  }).init('/articles/33/today');

  router.initialized.addOnce(function() {
    events = [];
    router.state('/articles/33/today');

    nextTick().then(function() {
      QUnit.assert.deepEqual(events, []);
      QUnit.start();
    });
  });

});


QUnit.asyncTest('Async enter transitions', function() {

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
        QUnit.assert.strictEqual(data, 'data');
        events.push('newsEnter');
      },
      enterPrereqs: function() {
        return successPromise(50, 'data');
      },

      exit: function() {
        events.push('newsExit');
      },


      today: State('today', {
        enter: function(params, data) {
          QUnit.assert.strictEqual(data, 48);
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

  }).init();

  router.initialized.addOnce(function() {
    events = [];
    router.state('/news/today');

    // The news's enterPrereqs has been resolved but not today's.
    // No transition occured as we wait for all the prereqs to be resolved.
    delay(100)
      .then(notYetEntered);

    delay(240)
      .then(todayWasEntered)
      .then(goToThisWeek)
      .then(thisWeekWasEntered)
      .then(resetToIndex)
      .then(goToFailChild)
      .then(failChildWasNotEntered)
      .then(QUnit.start);
  });

  function notYetEntered() {
    QUnit.assert.deepEqual(events, []);
  }

  function todayWasEntered() {
    QUnit.assert.deepEqual(events, ['indexExit', 'newsEnter', 'todayEnter']);
    events = [];
  }

  function goToThisWeek() {
    router.state('/news/thisWeek');
  }

  function thisWeekWasEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['todayExit', 'thisWeekEnter']);
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
    router.state('/fail/child');
  }

  // In case of an async failure, the transition must not occur.
  function failChildWasNotEntered() {
    return delay(100).then(function() {
      QUnit.assert.deepEqual(events, []);
    });
  }

});


QUnit.asyncTest('Prereqs can return non promise values', function() {

  Router({
    index: State({
      enterPrereqs: function() {
        return 3;
      },
      enter: function(params, value) {
        QUnit.assert.equal(value, 3);
        QUnit.start();
      }
    })
  }).init();

});


QUnit.asyncTest('Async exit transitions', function() {

  var events = [];
  var router = Router({

    index: State(),

    details: State('details', {
      enter: function() {
        events.push('detailsEnter');
      },

      exit: function() {
        events.push('detailsExit');
      },
      exitPrereqs: function() {
        return successPromise(150);
      },

      edit: State('edit', {
        enter: function() {
          events.push('editEnter');
        },

        exit: function() {
          events.push('editExit');
        },
        exitPrereqs: function() {
          return successPromise(50);
        }
      })
    })

  }).init('/details/edit');

  nextTick().then(function() {
    QUnit.assert.deepEqual(events, ['detailsEnter', 'editEnter']);
    events = [];
    router.state('');

    delay(100)
      .then(notYetExited);

    delay(200)
      .then(exited)
      .then(QUnit.start);
  });

  function notYetExited() {
    QUnit.assert.deepEqual(events, []);
  }

  function exited() {
    QUnit.assert.deepEqual(events, ['editExit', 'detailsExit']);
  }

});


QUnit.asyncTest('Cancelling an async transition', function() {

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
          return delay(50);
        },
        exit: function() { events.push('todayExit'); }
      }),

      thisWeek: State('thisWeek', {
        enter: function() { events.push('thisWeekEnter'); },
        exit: function() { events.push('thisWeekExit'); }
      })

    })

  }).init('/news/today');


  delay(40)
    .then(todayNotEnteredYet)
    .then(cancelAndGoToThisWeek)
    .then(thisWeekWasEntered)
    .then(todayWasNeverEntered)
    .then(QUnit.start);

  function todayNotEnteredYet() {
    // The 'today' section is still being transitionned to
    QUnit.assert.deepEqual(events, []);
  }

  function cancelAndGoToThisWeek() {
    // But we change our mind and go to the 'thisWeek' (synchronous) section
    router.state('/news/thisWeek');
  }

  function thisWeekWasEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['newsEnter', 'thisWeekEnter']);
      events = [];
    });
  }

  function todayWasNeverEntered() {
    return delay(100).then(function() {
      QUnit.assert.deepEqual(events, []);
    });
  }

});


QUnit.asyncTest('Param and query changes should trigger a transition', function() {

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

  }).init('/blog/articles/33/edit');


  nextTick()
    .then(changeParamOnly)
    .then(stateWasReEntered)
    .then(addQueryString)
    .then(stateWasFullyReEntered)
    .then(changeQueryStringValue)
    .then(stateWasFullyReEntered)
    .then(QUnit.start);


  function changeParamOnly() {
    router.state('/blog/articles/44/edit');
    events = [];
  }

  // The transition only goes up to the state owning the param
  function stateWasReEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['editExit', 'articlesExit', 'articlesEnter', 'editEnter']);
      events = [];
    });
  }

  function addQueryString() {
    router.state('/blog/articles/44/edit?filter=1');
  }

  // By default, a change in the query will result in a complete transition to the root state and back.
  function stateWasFullyReEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['editExit', 'articlesExit', 'blogExit', 'blogEnter', 'articlesEnter', 'editEnter']);
      events = [];
    });
  }

  function changeQueryStringValue() {
    router.state('/blog/articles/44/edit?filter=2');
  }

});


QUnit.asyncTest('Query-only transitions', function() {

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
  }).init('/blog/articles/33/edit');


  nextTick()
    .then(setSomeUnknownQuery)
    .then(fullTransitionOccurred)
    .then(setFilterQuery)
    .then(onlyExitedUpToStateOwningFilter)
    .then(swapFilterValue)
    .then(onlyExitedUpToStateOwningFilter)
    .then(removeFilterQuery)
    .then(onlyExitedUpToStateOwningFilter)
    .then(QUnit.start);


  function setSomeUnknownQuery() {
    router.state('/blog/articles/33/edit?someQuery=true');
    events = [];
  }

  function fullTransitionOccurred() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['editExit', 'articlesExit', 'blogExit', 'blogEnter', 'articlesEnter', 'editEnter']);
    });
  }

  function setFilterQuery() {
    router.state('/blog/articles/33/edit?filter=33');
    events = [];
  }

  function onlyExitedUpToStateOwningFilter() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['editExit', 'articlesExit', 'articlesEnter', 'editEnter']);
    });
  }
  
  function swapFilterValue() {
    router.state('/blog/articles/33/edit?filter=34');
    events = [];
  }

  function removeFilterQuery() {
    router.state('/blog/articles/33/edit');
    events = [];
  }

});


QUnit.asyncTest('Param changes only in a child-most state should not trigger a parent transition', function() {

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
    .then(QUnit.start);


  function changeParamOnly() {
    router.state('/blog/articles/44');
    events = [];
  }

  // The transition only goes up to the state owning the param
  function stateWasReEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['articlesExit', 'articlesEnter']);
      events = [];
    });
  }

  function addQueryString() {
    router.state('/blog/articles/44?filter=1');
  }

  // By default, a change in the query will result in a complete transition to the root state and back.
  function stateWasFullyReEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['articlesExit', 'blogExit', 'blogEnter', 'articlesEnter']);
      events = [];
    });
  }

  function changeQueryStringValue() {
    router.state('/blog/articles/44?filter=2');
  }

});


QUnit.asyncTest('The query string is provided to all states', function() {

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
            QUnit.start();
          }
        })
      })
    })
  }).init('/one/44/two/bla/three/33?filter1=123&filter2=456');


  function assertions(param, expectedParam, queryObj) {
    QUnit.assert.equal(param, expectedParam);
    QUnit.assert.equal(queryObj.filter1, 123);
    QUnit.assert.equal(queryObj.filter2, 456);
  }

});


QUnit.asyncTest('Prereqs also get params', function() {

  Router({

    articles: State('articles', {
      item: State(':id', {
        enterPrereqs: function(params) {
          QUnit.assert.equal(params.id, 56);
          QUnit.start();
          return 'dummy';
        }
      })
    })

  }).init('/articles/56');

});


QUnit.asyncTest('Data can be stored on states and later retrieved', function() {

  var router = Router({

    one: State({
      someArbitraryData: 3,

      enter: function() {
        // We can also store data at an arbitrary time.
        this.data('otherData', 5);
      },

      two: State()
    })

  }).init();

  router.transition.completed.add(function(oldState, newState) {

    // A child state can see the data of its parent
    QUnit.assert.equal(newState.data('someArbitraryData'), 3);
    QUnit.assert.equal(newState.data('otherData'), 5);

    // The parent can see its own data
    QUnit.assert.equal(newState.parent.data('someArbitraryData'), 3);

    QUnit.start();
  });

});


QUnit.test('Reverse routing', function() {
  var router = Router({

    index: State(),

    one: State('one', {
      two: State(':id?filter')
    })

  }).init();

  var href = router.link('one.two', {id: 33, filter: 'bloup'});
  QUnit.assert.equal(href, '/one/33?filter=bloup');

});


QUnit.test('Both prereqs can be specified on a single state', function() {
  QUnit.stop();

  var enterPrereq,
      exitPrereq;

  var router = Router({

    index: State(),

    one: State('one', {
      enterPrereqs: function() { return 3; },
      enter: function(params, _enterPrereq) { enterPrereq = _enterPrereq; },

      exitPrereqs: function() { return 4; },
      exit: function(_exitPrereq) { exitPrereq = _exitPrereq; }
    })

  }).init('one');

  nextTick()
    .then(assertions)
    .then(QUnit.start);

  function assertions() {
    enterPrereq = exitPrereq = undefined;
    // This will cause the state to be both exited and re-entered.
    router.state('/one?filter=1');

    return nextTick().then(function() {
      QUnit.assert.equal(enterPrereq, 3);
      QUnit.assert.equal(exitPrereq, 4);
    });
  }


});


QUnit.test('Non blocking promises as an alternative to prereqs', function() {
  QUnit.stop();

  var promiseValue = null;

  var router = Router({

    index: State(),

    one: State('one', {
      enter: function() {
        Async(successPromise(150, 'value')).then(function(value) {
          promiseValue = value;
        });
      }
    })

  }).init('one');


  delay(300)
    .then(promiseWasResolved)
    .then(exitThenReEnterStateOne)
    .then(cancelNavigation)
    .then(promiseShouldNotHaveBeenResolved)
    .then(QUnit.start);

  function promiseWasResolved() {
    QUnit.assert.strictEqual(promiseValue, 'value');
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
      QUnit.assert.strictEqual(promiseValue, null);
    });
  }

});

QUnit.test('Non blocking rejected promises', function() {
  QUnit.stop();

  var promiseValue = null,
      promiseError = null;

  var router = Router({

    index: State(),

    one: State('one', {
      enter: function() {
        Async(failPromise(150)).then(
          function(value) { promiseValue = value; },
          function(error) { promiseError = error; }
        );
      }
    })

  }).init('one');


  delay(200)
    .then(promiseWasRejected)
    .then(exitThenReEnterStateOne)
    .then(cancelNavigation)
    .then(promiseShouldNotHaveBeenResolved)
    .then(QUnit.start);

  function promiseWasRejected() {
    QUnit.assert.strictEqual(promiseValue, null);
    QUnit.assert.strictEqual(promiseError, 'error');
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
    return delay(200).then(function() {
      QUnit.assert.strictEqual(promiseValue, null);
      QUnit.assert.strictEqual(promiseError, null);
    });
  }

});

QUnit.test('State construction shorthand', function() {
  QUnit.stop();

  var passedParams = {};
  var passedData;

  var router = Router({

    index: State('index/:id', function(params) {
      var data = successPromise(50, 'data');

      passedParams = params;

      this.async(data).then(function(data) {
        passedData = data;
      });

    })

  }).init('/index/55?filter=true');

  nextTick()
    .then(paramsWerePassed)
    .then(asyncWasCalled)
    .then(QUnit.start);

  function paramsWerePassed() {
    QUnit.assert.strictEqual(passedParams.id, 55);
    QUnit.assert.strictEqual(passedParams.filter, true);
    QUnit.assert.strictEqual(passedData, undefined);
    
    return delay(80);
  }

  function asyncWasCalled() {
    QUnit.assert.strictEqual(passedData, 'data');
  }

});

QUnit.asyncTest('Transition failed handler receives error thrown from enter', function() {
  var testError = new Error();

  var router = Router({

    failed: State('failed', {
      enter: function() {
        throw testError;
      }
    })

  });

  router.transition.failed.add(function(oldState, newState, oldParams, newParams, error) {

    QUnit.assert.ok(error, "error parameter is not empty");

    // The error is the one that was thrown from the enter function
    QUnit.assert.strictEqual(error, testError, "error equals the original error");

    QUnit.start();

  });

  router.init('failed');
});

QUnit.asyncTest('Transition failed handler receives rejection from enterPrereqs', function() {
  var testError = new Error('TEST ERROR');

  var router = Router({

    failed: State('failed', {
      enterPrereqs: function() {
        return when.defer().reject(testError);
      }
    })

  });

  router.transition.failed.add(function(oldState, newState, oldParams, newParams, error) {

    // The error is about prereqs
    QUnit.assert.ok(error, "error parameter is not empty");

    // The inner error is the one that was wrapped into the rejection
    QUnit.assert.strictEqual(error.inner, testError, "error.inner equals the original error");

    // The error message contains the original error message
    QUnit.assert.ok(error.message.indexOf(testError.message) >= 0, "error message contains the original error message");

    QUnit.start();

  });

  router.init('failed');
});

QUnit.asyncTest('Transition failed handler receives rejection from exitPrereqs', function() {
  var testError = new Error('TEST ERROR');

  var router = Router({

    failed: State('failed', {
      exitPrereqs: function() {
        return when.defer().reject(testError);
      }
    }),

    success: State('success')

  });

  router.transition.failed.add(function(oldState, newState, oldParams, newParams, error) {

    // The error is about prereqs
    QUnit.assert.ok(error, "error parameter is not empty");

    // The inner error is the one that was wrapped into the rejection
    QUnit.assert.strictEqual(error.inner, testError, "error.inner equals the original error");

    // The error message contains the original error message
    QUnit.assert.ok(error.message.indexOf(testError.message) >= 0, "error message contains the original error message");

    QUnit.start();

  });

  router.init('failed');

  nextTick().then(function() {
    router.state('success');
  });
});

QUnit.asyncTest('Transition failed handler receives error thrown from enterPrereqs', function() {
  var testError = new Error('TEST ERROR');

  var router = Router({

    failed: State('failed', {
      enterPrereqs: function() {
        throw testError;
      }
    })

  });

  router.transition.failed.add(function(oldState, newState, oldParams, newParams, error) {

    // The error is about prereqs
    QUnit.assert.ok(error, "error parameter is not empty");

    // The inner error is the one that was wrapped into the rejection
    QUnit.assert.strictEqual(error.inner, testError, "error.inner equals the original error");

    // The error message contains the original error message
    QUnit.assert.ok(error.message.indexOf(testError.message) >= 0, "error message contains the original error message");

    QUnit.start();

  });

  router.init('/failed');
});

QUnit.asyncTest('Transition failed handler receives error thrown from exitPrereqs', function() {
  var testError = new Error('TEST ERROR');

  var router = Router({

    failed: State('failed', {
      exitPrereqs: function() {
        throw testError;
      }
    }),

    success: State('success')

  });

  router.transition.failed.add(function(oldState, newState, oldParams, newParams, error) {

    // The error is about prereqs
    QUnit.assert.ok(error, "error parameter is not empty");

    // The inner error is the one that was wrapped into the rejection
    QUnit.assert.strictEqual(error.inner, testError, "error.inner equals the original error");

    // The error message contains the original error message
    QUnit.assert.ok(error.message.indexOf(testError.message) >= 0, "error message contains the original error message");

    QUnit.start();

  });

  router.init('failed');

  nextTick().then(function() {
    router.state('success');
  });
});

QUnit.asyncTest('State not entered if the transition enterPrereqs have failed with a rejection having an async error handler that does not throw or return a rejection', function() {

  var events = [],
      testError = new Error('TEST ERROR'),
      oldAsyncErrorHandler = Router.setAsyncErrorHandler(function() {
        events.push('asyncErrorHandler');
      });

  var router = Router({

    failed: State('failed', {
      enterPrereqs: function() {
        return when.defer().reject();
      },
      enter: function() {
        events.push('failedEnter');
      }
    }),

    success: State('success', {
      enterPrereqs: function() {
        return when.defer().resolve().promise;
      },
      enter: function() {
        events.push('successEnter');
      }
    })

  });

  router.init('failed');

  delay(200)
    .then(failedStateWasNotEntered)
    .then(goToSuccessState)
    .then(successStateWasEntered)
    .then(unstubAsyncErrorHandler)
    .then(QUnit.start);

  function failedStateWasNotEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['asyncErrorHandler'], 'failed state was not entered');
      events = [];
    });
  }

  function goToSuccessState() {
    return nextTick().then(function() {
      router.state('success');
    });
  }

  function successStateWasEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['successEnter'], 'success state was entered');
      events = [];
    });
  }

  function unstubAsyncErrorHandler() {
    Router.setAsyncErrorHandler(oldAsyncErrorHandler);
  }
});

QUnit.asyncTest('pushState called on next successful transition if the first has failed', function() {

  var events = [],
      testError = new Error('TEST ERROR'),
      oldPushState;

  stubPushState();

  var router = Router({

    failed: State('failed', {
      enterPrereqs: function() {
        return when.defer().reject(testError);
      },
      enter: function() {
        events.push('failedEnter');
      }
    }),

    success: State('success', {
      enter: function() {
        events.push('successEnter');
      }
    })

  });

  router.init('failed');

  delay(200)
    .then(failedStateWasNotEntered)
    .then(goToSuccessState)
    .then(successStateWasEntered)
    .then(unstubPushState)
    .then(QUnit.start);

  function failedStateWasNotEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, [], 'failed state was not entered, pushState not called');
      events = [];
    });
  }

  function goToSuccessState() {
    return nextTick().then(function() {
      router.state('success');
    });
  }

  function successStateWasEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['successEnter','pushState'], 'success state was entered, pushState called');
      events = [];
    });
  }

  function stubPushState() {
    oldPushState = window.history.pushState;
    window.history.pushState = function() { events.push('pushState'); }
  }

  function unstubPushState() {
    window.history.pushState = oldPushState;
  }
});

QUnit.asyncTest('Transition does not occur if exitPrereqs are rejected having enterPrereqs fulfilled on the same state before', function() {

  var events = [],
      testError = new Error('TEST ERROR');

  var router = Router({

    test: State('test', {
      enterPrereqs: function() {
        return when.defer().resolve();
      },
      enter: function() {
        events.push('testEnter');
      },

      exitPrereqs: function() {
        return when.defer().reject(testError);
      },
      exit: function() {
        events.push('testExit');
      }
    }),

    home: State('home', {
      enter: function() {
        events.push('homeEnter');
      }
    })

  });

  router.init('test');

  delay(200)
    .then(testStateWasEntered)
    .then(goToHomeState)
    .then(testStateWasNotExited)
    .then(QUnit.start);

  function testStateWasEntered() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, ['testEnter'], 'test state was entered');
      events = [];
    });
  }

  function goToHomeState() {
    return nextTick().then(function() {
      router.state('home');
    });
  }

  function testStateWasNotExited() {
    return nextTick().then(function() {
      QUnit.assert.deepEqual(events, [], 'test state was not exited, home state was not entered');
      events = [];
    });
  }
});


function delay(time, value) {
  var defer = when.defer();
  global.setTimeout(function() {
    defer.resolve(value);
  }, time);
  return defer.promise;
}

function successPromise(time, value) {
  return delay(time, value);
}

function failPromise(time) {
  return delay(time).then(function() {
    throw 'error';
  });
}

function nextTick() {
  return delay(25);
}


}(this, this.QUnit, this.when, this.window));
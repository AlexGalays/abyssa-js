

Router = Abyssa.Router;
State  = Abyssa.State;

Router.enableLogs();
Router.ignoreInitialURL = true;
stubHistory();


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
    .then(start);


  function indexWasEntered() {
    deepEqual(events, ['indexEnter']);
    events = [];
  }

  function goToArticles() {
    router.state('articles', {id: 38, query: {filter: 555}});
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
    }),

    notFound: State({
      enter: function() { reachedNotFound = true; }
    })

  }).init('articles/naturess/88/edit');

  nextTick()
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

  }).init();

  router.initialized.addOnce(function() {
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

  router.initialized.addOnce(function() {
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
  });

  nextTick().then(function() {
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

  router.initialized.addOnce(function() {
    events = [];
    router.state('articles/33/today');

    nextTick().then(function() {
      deepEqual(events, []);
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
        return successPromise(50, 'data');
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

  }).init();

  router.initialized.addOnce(function() {
    events = [];
    router.state('news/today');

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
      .then(start)
  });

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
    return delay(100).then(function() {
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
  }).init();

});


asyncTest('Async exit transitions', function() {

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

  }).init('details/edit');

  nextTick().then(function() {
    deepEqual(events, ['detailsEnter', 'editEnter']);
    events = [];
    router.state('');

    delay(100)
      .then(notYetExited);

    delay(200)
      .then(exited)
      .then(start);
  });

  function notYetExited() {
    deepEqual(events, []);
  }

  function exited() {
    deepEqual(events, ['editExit', 'detailsExit']);
  }

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
          return delay(50);
        },
        exit: function() { events.push('todayExit'); }
      }),

      thisWeek: State('thisWeek', {
        enter: function() { events.push('thisWeekEnter'); },
        exit: function() { events.push('thisWeekExit'); }
      })

    })

  }).init('news/today');


  delay(40)
    .then(todayNotEnteredYet)
    .then(cancelAndGoToThisWeek)
    .then(thisWeekWasEntered)
    .then(todayWasNeverEntered)
    .then(start);

  function todayNotEnteredYet() {
    // The 'today' section is still being transitionned to
    deepEqual(events, []);
  }

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
    return delay(100).then(function() {
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


  nextTick()
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


  nextTick()
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
    equal(newState.data('someArbitraryData'), 3);
    equal(newState.data('otherData'), 5);

    // The parent can see its own data
    equal(newState.parent.data('someArbitraryData'), 3);

    start();
  });

});


test('Reverse routing', function() {
  var router = Router({

    index: State(),

    one: State('one', {
      two: State(':id?filter')
    })

  }).init();

  var href = router.link('one.two', {id: 33, filter: 'bloup'});
  equal(href, 'one/33?filter=bloup');

});


function delay(time, value) {
  var defer = when.defer();
  setTimeout(defer.resolve, time, value);
  return defer.promise;
}

function successPromise(time, value) {
  return delay(time, value);
}

function failPromise(time) {
  return delay(time).then(function() { throw 'error'; });
}

function nextTick() {
  return delay(25);
}


function stubHistory() {
  window.history.pushState = function() {}; 
}
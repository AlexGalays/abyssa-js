
// To run these tests, setup a http server's root as abyssa's repository root

Router = Abyssa.Router;
State  = Abyssa.State;
Async  = Abyssa.Async;

//Router.enableLogs();

var initialURL = window.location.href;
var testElements = document.getElementById('test-elements');
var router;

QUnit.config.testTimeout = 4000;

QUnit.testDone(function() {
  changeURL(initialURL);
  testElements.innerHTML = '';
  router.terminate();
});



asyncTest('Router initialization from initial URL', function() {

  changeURL('/initialState/36');

  router = Router({

    index: State('initialState/:num', function(param) {
      strictEqual(param.num, 36);
      startLater();
    })

  }).init();

});


asyncTest('Default anchor interception', function() {

  var a = document.createElement('a');
  a.href = '/articles/33';
  testElements.appendChild(a);

  router = Router({

    index: State(''),

    articles: State('articles/:id', function(params) {
      strictEqual(params.id, 33);
      startLater();
    })

  }).init('');

  router.changed.addOnce(function() {
    simulateClick(a);
  });

});


asyncTest('Mousedown anchor interception', function() {
  var a = document.createElement('a');
  a.href = '/articles/33';
  a.setAttribute('data-nav', 'mousedown');
  testElements.appendChild(a);

  router = Router({

    index: State(''),

    articles: State('articles/:id', function(params) {
      strictEqual(params.id, 33);
      startLater();
    })

  }).init('');

  router.changed.addOnce(function() {
    simulateMousedown(a);
  });

});


asyncTest('Redirect', function() {

  router = Router({

    index: State('index', function() {
      router.redirect('articles');
    }),

    articles: State('articles')

  }).init('index');

  router.changed.addOnce(function() {
    equal(router.urlPathQuery(), '/articles');
    startLater();
  });

});


asyncTest('history.back()', function() {

  router = Router({

    index: State('index'),
    books: State('books'),
    articles: State('articles')

  }).init('index');

  whenSignal(router.changed)
    .then(goToArticles)
    .then(goToBooks)
    .then(pathnameShouldBeBooks)
    .then(doHistoryBack)
    .then(pathnameShouldBeArticles)
    .done(startLater);

  // First state pushed
  function goToArticles() {
    router.state('articles');
  }

  // Second state pushed
  function goToBooks() {
    return nextTick().then(function() {
      router.state('books');
    });
  }

  function pathnameShouldBeBooks() {
    return nextTick().then(function() {
      equal(router.urlPathQuery(), '/books');
    });
  }

  function doHistoryBack() {
    return nextTick().then(function() {
      history.back();
    });
  }

  function pathnameShouldBeArticles() {
    return delay(60).then(function() {
      equal(router.urlPathQuery(), '/articles');
    });
  }

});


asyncTest('hash mode switched on', function() {

  var lastParams;

  window.addEventListener('hashchange', startTest);
  window.location.hash = '/category1/56';

  function startTest() {
    window.removeEventListener('hashchange', startTest);

    router = Router({

      index: State(''),

      category1: State('category1', {
        detail: State(':id', function(params) {
          lastParams = params;
        })
      })

    })
    .configure({
      urlSync: 'hash'
    })
    .init();

    whenSignal(router.changed)
      .then(stateShouldBeCategoryDetail)
      .then(goToIndex)
      .then(stateShouldBeIndex)
      .then(goToCategoryDetail)
      .then(stateShouldBeCategoryDetail2)
      .done(startLater);

    function stateShouldBeCategoryDetail() {
      strictEqual(router.currentState().state.fullName, 'category1.detail');
      strictEqual(lastParams.id, 56);
      strictEqual(window.location.hash, '#/category1/56');
    }

    function goToIndex() {
      router.state('/');
    }

    function stateShouldBeIndex() {
      return nextTick().then(function() {
        strictEqual(router.currentState().state.fullName, 'index');
        strictEqual(window.location.hash, '#/');
      });
    }

    function goToCategoryDetail() {
      router.state('category1.detail', {id: 88});
    }

    function stateShouldBeCategoryDetail2() {
      return nextTick().then(function() {
        strictEqual(router.currentState().state.fullName, 'category1.detail');
        strictEqual(lastParams.id, 88);
        strictEqual(window.location.hash, '#/category1/88');
      });
    }
  }

});


asyncTest('urlSync switched off', function() {

  var lastParams;

  // We should never leave the starting URL.
  var defaultURL = window.location.href;

  router = Router({

    index: State(''),

    category1: State('category1', {
      detail: State(':id', function(params) {
        lastParams = params;
      })
    })

  })
  .configure({
    urlSync: false
  })
  .init();

  whenSignal(router.changed)
    .then(ShouldDefaultToIndex)
    .then(goToCategoryDetail)
    .then(shouldBeInCategoryDetail)
    .done(startLater);


  function ShouldDefaultToIndex() {
    strictEqual(router.currentState().state.fullName, 'index');
    strictEqual(window.location.href, defaultURL);
  }

  function goToCategoryDetail() {
    router.state('category1/33');
  }

  function shouldBeInCategoryDetail() {
    return nextTick().then(function() {
      strictEqual(router.currentState().state.fullName, 'category1.detail');
      strictEqual(lastParams.id, 33);
      strictEqual(window.location.href, defaultURL);
    });
  }

});


asyncTest('customize hashbang', function() {

  var lastParams;

  window.addEventListener('hashchange', startTest);
  window.location.hash = '!/category1/56';

  function startTest() {
    window.removeEventListener('hashchange', startTest);

    router = Router({

      index: State(''),

      category1: State('category1', {
        detail: State(':id', function(params) {
          lastParams = params;
        })
      })

    })
    .configure({
      urlSync: 'hash',
      hashPrefix: '!'
    })
    .init();

    whenSignal(router.changed)
      .then(stateShouldBeCategoryDetail)
      .then(goToIndex)
      .then(stateShouldBeIndex)
      .then(goToCategoryDetail)
      .then(stateShouldBeCategoryDetail2)
      .done(startLater);

    function stateShouldBeCategoryDetail() {
      strictEqual(router.currentState().state.fullName, 'category1.detail');
      strictEqual(lastParams.id, 56);
      strictEqual(window.location.hash, '#!/category1/56');
    }

    function goToIndex() {
      router.state('/');
    }

    function stateShouldBeIndex() {
      return nextTick().then(function() {
        strictEqual(router.currentState().state.fullName, 'index');
        strictEqual(window.location.hash, '#!/');
      });
    }

    function goToCategoryDetail() {
      router.state('category1.detail', {id: 88});
    }

    function stateShouldBeCategoryDetail2() {
      return nextTick().then(function() {
        strictEqual(router.currentState().state.fullName, 'category1.detail');
        strictEqual(lastParams.id, 88);
        strictEqual(window.location.hash, '#!/category1/88');
      });
    }
  }

});


asyncTest('customize hashbang the funny way', function() {

  var lastParams;

  window.addEventListener('hashchange', startTest);
  window.location.hash = 'iAmLimitless@ndW!thStuff/category1/56';

  function startTest() {
    window.removeEventListener('hashchange', startTest);

    router = Router({

      index: State(''),

      category1: State('category1', {
        detail: State(':id', function(params) {
          lastParams = params;
        })
      })

    })
    .configure({
      urlSync: 'hash',
      hashPrefix: 'iAmLimitless@ndW!thStuff'
    })
    .init();

    whenSignal(router.changed)
      .then(stateShouldBeCategoryDetail)
      .then(goToIndex)
      .then(stateShouldBeIndex)
      .then(goToCategoryDetail)
      .then(stateShouldBeCategoryDetail2)
      .done(startLater);

    function stateShouldBeCategoryDetail() {
      strictEqual(router.currentState().state.fullName, 'category1.detail');
      strictEqual(lastParams.id, 56);
      strictEqual(window.location.hash, '#iAmLimitless@ndW!thStuff/category1/56');
    }

    function goToIndex() {
      router.state('/');
    }

    function stateShouldBeIndex() {
      return nextTick().then(function() {
        strictEqual(router.currentState().state.fullName, 'index');
        strictEqual(window.location.hash, '#iAmLimitless@ndW!thStuff/');
      });
    }

    function goToCategoryDetail() {
      router.state('category1.detail', {id: 88});
    }

    function stateShouldBeCategoryDetail2() {
      return nextTick().then(function() {
        strictEqual(router.currentState().state.fullName, 'category1.detail');
        strictEqual(lastParams.id, 88);
        strictEqual(window.location.hash, '#iAmLimitless@ndW!thStuff/category1/88');
      });
    }
  }

});


function changeURL(pathQuery) {
  history.pushState('', '', pathQuery);
}

function simulateClick(element) {
  var event = document.createEvent('MouseEvents');
  event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
  element.dispatchEvent(event);
}

function simulateMousedown(element) {
  var event = document.createEvent('MouseEvents');
  event.initMouseEvent('mousedown', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
  element.dispatchEvent(event);
}

function whenSignal(signal) {
  var defer = when.defer();
  signal.addOnce(defer.resolve);
  return defer.promise;
}

function delay(time, value) {
  var defer = when.defer();
  setTimeout(function() { defer.resolve(value); }, time);
  return defer.promise;
}

function nextTick() {
  return delay(20);
}

// The hashchange event is dispatched asynchronously.
// At the end of a test changing the hash, give the event enough time to be dispatched
// so that the following test's router doesn't try to react to it.
function startLater() {
  delay(80).then(start);
}


// To run these tests, setup a http server's root as abyssa's repository root

Router = Abyssa.Router;
State  = Abyssa.State;
Async  = Abyssa.Async;

//Router.enableLogs();

var isHTML5Browser = !history.emulate;
var initialURL = window.location.href;
var testElements = document.getElementById('test-elements');


QUnit.config.testTimeout = 4000;

QUnit.testDone(function() {
  if (isHTML5Browser) changeURL(initialURL);
  testElements.innerHTML = '';
});


asyncTest('Router initialization from initial URL', function() {

  changeURL('/initialState/36');

  var router = Router({

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

  var router = Router({

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

  var router = Router({

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

  var router = Router({

    index: State('index', function() {
      router.redirect('articles');
    }),

    articles: State('articles')

  }).init('index');

  router.changed.addOnce(function() {
    equal(router.urlPathQuery(), '/articles');
    start();
  });

});


asyncTest('history.back()', function() {

  var router = Router({

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
    .then(start);

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


// IMPORTANT: In old browsers, This test actually fails because of this bug: https://github.com/devote/HTML5-History-API/issues/46
// The line 718 of lib/history.iegte8.js has been modified to make the test pass for now.
asyncTest('history.back() with an exitPrereqs', function() {

  var exitDefer = when.defer();

  var router = Router({

    index: State('index'),
    books: State('books', {

      exitPrereqs: function() {
        return exitDefer.promise;
      }

    }),
    articles: State('articles')

  }).init('index');

  whenSignal(router.changed)
    .then(goToArticles)
    .then(goToBooks)
    .then(pathnameShouldBeBooks)
    .then(doHistoryBack)
    .then(pathnameShouldStillBeBooks)
    .then(allowExit)
    .then(pathnameShouldBeArticles)
    .then(start);

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

  function pathnameShouldStillBeBooks() {
    return delay(60).then(function() {
      equal(router.urlPathQuery(), '/books');
    });
  }

  function allowExit() {
    exitDefer.resolve();
  }

  function pathnameShouldBeArticles() {
    return nextTick().then(function() {
      equal(router.urlPathQuery(), '/articles');
    });
  }

});


asyncTest('urlSync switched off', function() {

  var lastParams;

  // We should never leave the starting URL.
  var defaultURL = window.location.href;

  var router = Router({

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
    .then(start);


  function ShouldDefaultToIndex() {
    strictEqual(router.currentState().fullName, 'index');
    strictEqual(window.location.href, defaultURL);
  }

  function goToCategoryDetail() {
    router.state('category1/33');
  }

  function shouldBeInCategoryDetail() {
    return nextTick().then(function() {
      strictEqual(router.currentState().fullName, 'category1.detail');
      strictEqual(lastParams.id, 33);
      strictEqual(window.location.href, defaultURL);
    });
  }

});



function changeURL(pathQuery) {
  history.pushState('', '', pathQuery);
}

function simulateClick(element) {
  if (document.createEvent) {
    var event = document.createEvent('MouseEvents');
    event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
    element.dispatchEvent(event);
  }
  else {
    var params = document.createEventObject();
    params.button = 1;
    element.fireEvent('onmousedown', params);
    element.fireEvent('onclick');
  }
}

function simulateMousedown(element) {
  if (document.createEvent) {
    var event = document.createEvent('MouseEvents');
    event.initMouseEvent('mousedown', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
    element.dispatchEvent(event);
  }
  else {
    var params = document.createEventObject();
    params.button = 1;
    element.fireEvent('onmousedown', params);
  }
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
  return delay(0);
}

// The hashchange event is dispatched asynchronously.
// At the end of a test changing the hash, give the event enough time to be dispatched 
// so that the following test's router doesn't try to react to it.
function startLater() {
  delay(80).then(start);
}
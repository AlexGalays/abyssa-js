
// To run these tests, setup a http server's root as abyssa's repository root

Router = Abyssa.Router;
State  = Abyssa.State;
Async  = Abyssa.Async;

//Router.enableLogs();

var isHTML5Browser = !history.emulate;
var initialURL = window.location.href;
var testElements = document.getElementById('test-elements');


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


asyncTest('Simple anchor interception', function() {

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


asyncTest('Redirect', function() {

  var router = Router({

    index: State('index', function() {
      router.redirect('articles');
    }),

    articles: State('articles')

  }).init('index');

  router.changed.addOnce(function() {
    equal(history.location.pathname, '/articles');
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
      equal(history.location.pathname, '/books');
    });
  }

  function doHistoryBack() {
    return nextTick().then(function() {
      history.back();
    });
  }

  function pathnameShouldBeArticles() {
    return delay(60).then(function() {
      equal(history.location.pathname, '/articles');
    });
  }

});


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
      equal(history.location.pathname, '/books');
    });
  }

  function doHistoryBack() {
    return nextTick().then(function() {
      history.back();
    });
  }

  function pathnameShouldStillBeBooks() {
    return delay(60).then(function() {
      equal(history.location.pathname, '/books');
    });
  }

  function allowExit() {
    exitDefer.resolve();
  }

  function pathnameShouldBeArticles() {
    return nextTick().then(function() {
      equal(history.location.pathname, '/articles');
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
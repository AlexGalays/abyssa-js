
// To run these tests, setup a http server's root as abyssa's repository root

Router = Abyssa.Router;
State  = Abyssa.State;
Async  = Abyssa.Async;

//Router.enableLogs();

var isHTML5Browser = !history.emulate;
var initialURL = window.location.href;
var testElements = document.getElementById('test-elements');

if (isHTML5Browser) {
  QUnit.testDone(function() {
    changeURL(initialURL);
    testElements.innerHTML = '';
  });
}


asyncTest('Router initialization from initial URL', function() {

  changeURL('/initialState/33');

  var router = Router({

    index: State('initialState/:num', function(param) {
      strictEqual(param.num, 33);
      start();
    })

  }).init();

});


asyncTest('Simple anchor interception', function() {

  changeURL('/');

  var a = document.createElement('a');
  a.href = '/articles/33';
  testElements.appendChild(a);

  var router = Router({

    index: State(''),

    articles: State('articles/:id', function(params) {
      strictEqual(params.id, 33);
      start();
    })

  }).init();

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
    return nextTick().then(function() {
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
    return nextTick().then(function() {
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
  if ('MouseEvent' in window) {
    var event = new MouseEvent('click', {
      'view': window,
      'bubbles': true,
      'cancelable': true
    });
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
  return delay(25);
}
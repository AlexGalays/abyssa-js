
// To run these tests, setup a http server's root as abyssa's repository root

Router = Abyssa.Router;
State  = Abyssa.State;

//Router.enableLogs();

var initialURL = window.location.href;
var testElements = document.getElementById('test-elements');
var router;

QUnit.testDone(function() {
  changeURL(initialURL);
  testElements.innerHTML = '';
  router.terminate();
});


asyncTest('Router initialization from initial URL', function() {

  changeURL('/initialState/36');

  router = Router({

    index: State('initialState/:num', { enter: function(param) {
      strictEqual(param.num, '36');
      startLater();
    }})

  }).init();

});


asyncTest('Default anchor interception', function() {
  var a = document.createElement('a');
  a.href = '/articles/33';
  testElements.appendChild(a);

  router = Router({

    index: State(''),

    articles: State('articles/:id', { enter: function(params) {
      strictEqual(params.id, '33');
      startLater();
    }})

  }).init('');

  simulateClick(a);
});


asyncTest('Mousedown anchor interception', function() {
  var a = document.createElement('a');
  a.href = '/articles/33';
  a.setAttribute('data-nav', 'mousedown');
  testElements.appendChild(a);

  router = Router({

    index: State(''),

    articles: State('articles/:id', { enter: function(params) {
      strictEqual(params.id, '33');
      startLater();
    }})

  }).init('');

  simulateMousedown(a);
});


asyncTest('Redirect', function() {

  router = Router({

    index: State('index', { enter: function() {
      router.state('articles');
    }}),

    articles: State('articles')

  });

  router.init('index');

  equal(router.urlPathQuery(), '/articles');
  startLater();
});


asyncTest('history.back()', function() {

  router = Router({

    index: State('index'),
    books: State('books'),
    articles: State('articles')

  }).init('index');


  router.state('articles');
  router.state('books');
  equal(router.urlPathQuery(), '/books');
  history.back();

  delay(60).then(function() {
    equal(router.urlPathQuery(), '/articles');
  })
  .then(startLater);

});


asyncTest('history.back() on the notFound state', function() {

  router = Router({
    index: State('index'),
    notFound: State('notFound')
  })
  .configure({
    notFound: 'notFound'
  })
  .init('index');


  router.state('/wat');
  equal(router.currentState().state.name, 'notFound');
  router.state('index');
  history.back();

  delay(60).then(function() {
    // TODO: This assertion should pass ideally; uncomment after the biggest refactorings
    //equal(router.urlPathQuery(), '/notFound');
    equal(router.currentState().state.name, 'notFound');
  })
  .then(startLater);

});


asyncTest('hash mode switched on', function() {

  var lastParams;

  window.addEventListener('hashchange', startTest);
  window.location.hash = '/category1/56';

  function startTest() {
    window.removeEventListener('hashchange', startTest);

    router = Router({

      index: State(''),

      category1: State('category1', {}, {
        detail: State(':id', { enter: function(params) {
          lastParams = params;
        }})
      })

    })
    .configure({
      urlSync: 'hash'
    })
    .init();

    stateShouldBeCategoryDetail();
    goToIndex();
    stateShouldBeIndex();
    goToCategoryDetail();
    stateShouldBeCategoryDetail2();
    startLater();

    function stateShouldBeCategoryDetail() {
      strictEqual(router.currentState().state.fullName, 'category1.detail');
      strictEqual(lastParams.id, '56');
      strictEqual(window.location.hash, '#/category1/56');
    }

    function goToIndex() {
      router.state('/');
    }

    function stateShouldBeIndex() {
      strictEqual(router.currentState().state.fullName, 'index');
      strictEqual(window.location.hash, '#/');
    }

    function goToCategoryDetail() {
      router.state('category1.detail', { id: 88 });
    }

    function stateShouldBeCategoryDetail2() {
      strictEqual(router.currentState().state.fullName, 'category1.detail');
      strictEqual(lastParams.id, '88');
      strictEqual(window.location.hash, '#/category1/88');
    }
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

      category1: State('category1', {}, {
        detail: State(':id', { enter: function(params) {
          lastParams = params;
        }})
      })

    })
    .configure({
      urlSync: 'hash',
      hashPrefix: '!'
    })
    .init();

    stateShouldBeCategoryDetail();
    goToIndex();
    stateShouldBeIndex();
    goToCategoryDetail();
    stateShouldBeCategoryDetail2();
    startLater();

    function stateShouldBeCategoryDetail() {
      strictEqual(router.currentState().state.fullName, 'category1.detail');
      strictEqual(lastParams.id, '56');
      strictEqual(window.location.hash, '#!/category1/56');
    }

    function goToIndex() {
      router.state('/');
    }

    function stateShouldBeIndex() {
      strictEqual(router.currentState().state.fullName, 'index');
      strictEqual(window.location.hash, '#!/');
    }

    function goToCategoryDetail() {
      router.state('category1.detail', { id: 88 });
    }

    function stateShouldBeCategoryDetail2() {
      strictEqual(router.currentState().state.fullName, 'category1.detail');
      strictEqual(lastParams.id, '88');
      strictEqual(window.location.hash, '#!/category1/88');
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

function delay(time, value) {
  var defer = when.defer();
  setTimeout(function() { defer.resolve(value); }, time);
  return defer.promise;
}

// The hashchange event is dispatched asynchronously.
// At the end of a test changing the hash, give the event enough time to be dispatched
// so that the following test's router doesn't try to react to it.
function startLater() {
  delay(80).then(start);
}

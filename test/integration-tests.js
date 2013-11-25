
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


// To run these tests, setup a http server's root as abyssa's repository root

Router = Abyssa.Router
State  = Abyssa.State

//Router.enableLogs()

var initialURL = window.location.href
var testElements = document.getElementById('test-elements')
var router

QUnit.testDone(function() {
  changeURL(initialURL)
  testElements.innerHTML = ''
  router.terminate()
})


asyncTest('Router initialization from initial URL', function() {

  changeURL('/initialState/36')

  router = Router({

    index: State('initialState/:num', { enter: function(enterParams) {
      strictEqual(enterParams.params.num, '36')
      startLater()
    }})

  }).init()

})


asyncTest('Default anchor interception', function() {
  var a = document.createElement('a')
  a.href = '/articles/33'
  testElements.appendChild(a)

  router = Router({

    index: State(''),

    articles: State('articles/:id', { enter: function(enterParams) {
      strictEqual(enterParams.params.id, '33')
      startLater()
    }})

  }).init('')

  simulateClick(a)
})


asyncTest('Mousedown anchor interception', function() {
  var a = document.createElement('a')
  a.href = '/articles/33'
  a.setAttribute('data-nav', 'mousedown')
  testElements.appendChild(a)

  router = Router({

    index: State(''),

    articles: State('articles/:id', { enter: function(enterParams) {
      strictEqual(enterParams.params.id, '33')
      startLater()
    }})

  }).init('')

  simulateMousedown(a)
})


asyncTest('Redirect', function() {

  router = Router({

    index: State('index', { enter: function() {
      router.transitionTo('articles')
    }}),

    articles: State('articles')

  })

  router.init('index')

  nextFrame().then(function() {
    equal(router.urlPathQuery(), '/articles')
    startLater()
  })
})


asyncTest('history.back()', function() {

  router = Router({

    index: State('index'),
    books: State('books'),
    articles: State('articles')

  }).init('index')


  router.transitionTo('articles')

  nextFrame()
    .then(function() {
      router.transitionTo('books')
    })
    .then(nextFrame)
    .then(function() {
      equal(router.urlPathQuery(), '/books')
      history.back()
    })
    .then(function() { return delay(60) })
    .then(function() {
      equal(router.urlPathQuery(), '/articles')
      startLater()
    })
})


asyncTest('history.back() on the notFound state', function() {

  router = Router({
    index: State('index'),
    notFound: State('notFound')
  })
  .configure({
    notFound: 'notFound'
  })
  .init('index')


  router.transitionTo('/wat')
  equal(router.current().name, 'notFound')

  nextFrame()
    .then(function() {
      router.transitionTo('index')
    })
    .then(nextFrame)
    .then(function() {
      history.back()
    })
    .then(function() { return delay(60) })
    .then(function() {
      // TODO: Fix this
      //equal(router.urlPathQuery(), '/notFound')
      equal(router.current().name, 'notFound')
      startLater()
    })
})


asyncTest('hash mode switched on', function() {

  var lastParams

  window.addEventListener('hashchange', startTest)
  window.location.hash = '/category1/56'

  function startTest() {
    window.removeEventListener('hashchange', startTest)

    router = Router({

      index: State(''),

      category1: State('category1', {}, {
        detail: State(':id', { enter: function(enterParams) {
          lastParams = enterParams.params
        }})
      })

    })
    .configure({
      urlSync: 'hash'
    })
    .init()

    nextFrame()
      .then(stateShouldBeCategoryDetail)
      .then(goToIndex)
      .then(nextFrame)
      .then(stateShouldBeIndex)
      .then(goToCategoryDetail)
      .then(nextFrame)
      .then(stateShouldBeCategoryDetail2)
      .then(startLater)

    function stateShouldBeCategoryDetail() {
      strictEqual(router.current().fullName, 'category1.detail')
      strictEqual(lastParams.id, '56')
      strictEqual(window.location.hash, '#/category1/56')
    }

    function goToIndex() {
      router.transitionTo('/')
    }

    function stateShouldBeIndex() {
      strictEqual(router.current().fullName, 'index')
      strictEqual(window.location.hash, '#/')
    }

    function goToCategoryDetail() {
      router.transitionTo('category1.detail', { id: 88 })
    }

    function stateShouldBeCategoryDetail2() {
      strictEqual(router.current().fullName, 'category1.detail')
      strictEqual(lastParams.id, '88')
      strictEqual(window.location.hash, '#/category1/88')
    }
  }

})


asyncTest('customize hashbang', function() {

  var lastParams

  window.addEventListener('hashchange', startTest)
  window.location.hash = '!/category1/56'

  function startTest() {
    window.removeEventListener('hashchange', startTest)

    router = Router({

      index: State(''),

      category1: State('category1', {}, {
        detail: State(':id', { enter: function(enterParams) {
          lastParams = enterParams.params
        }})
      })

    })
    .configure({
      urlSync: 'hash',
      hashPrefix: '!'
    })
    .init()

    nextFrame()
      .then(stateShouldBeCategoryDetail)
      .then(goToIndex)
      .then(nextFrame)
      .then(stateShouldBeIndex)
      .then(goToCategoryDetail)
      .then(nextFrame)
      .then(stateShouldBeCategoryDetail2)
      .then(startLater)

    function stateShouldBeCategoryDetail() {
      strictEqual(router.current().fullName, 'category1.detail')
      strictEqual(lastParams.id, '56')
      strictEqual(window.location.hash, '#!/category1/56')
    }

    function goToIndex() {
      router.transitionTo('/')
    }

    function stateShouldBeIndex() {
      strictEqual(router.current().fullName, 'index')
      strictEqual(window.location.hash, '#!/')
    }

    function goToCategoryDetail() {
      router.transitionTo('category1.detail', { id: 88 })
    }

    function stateShouldBeCategoryDetail2() {
      strictEqual(router.current().fullName, 'category1.detail')
      strictEqual(lastParams.id, '88')
      strictEqual(window.location.hash, '#!/category1/88')
    }
  }

})


test('replaceParams', function() {
  var router = Abyssa.api

  Router({

    articles: {
      uri: 'articles?popup',

      children: {
        detail: {
          uri: ':id',

          children: {
            moreDetails: {
              uri: 'moreDetails'
            }
          }
        }
      }
    }

  })
  .init('articles/33/moreDetails?popup=true')

  equal(router.current().params.id, '33')
  equal(router.current().params.popup, 'true')

  var transitionHappened = false
  router.on('ended', function() {
    transitionHappened = true
    router.on('ended', undefined)
  })

  router.replaceParams({ id: '44', popup: 'false' })

  equal(transitionHappened, false)
  equal(router.current().params.id, '44')
  equal(router.current().params.popup, 'false')
  equal(router.current().uri, '/articles/44/moreDetails?popup=false')
  equal(router.urlPathQuery(), '/articles/44/moreDetails?popup=false')

  router.replaceParams({ id: '44', popup: undefined })

  equal(transitionHappened, false)
  equal(router.current().params.id, '44')
  equal(router.current().params.popup, undefined)
  equal(router.current().uri, '/articles/44/moreDetails')
  equal(router.urlPathQuery(), '/articles/44/moreDetails')
})


function changeURL(pathQuery) {
  history.pushState('', '', pathQuery)
}

function simulateClick(element) {
  var event = document.createEvent('MouseEvents')
  event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null)
  element.dispatchEvent(event)
}

function simulateMousedown(element) {
  var event = document.createEvent('MouseEvents')
  event.initMouseEvent('mousedown', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null)
  element.dispatchEvent(event)
}

function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms) })
}

// The hashchange event is dispatched asynchronously.
// At the end of a test changing the hash, give the event enough time to be dispatched
// so that the following test's router doesn't try to react to it.
function startLater() {
  delay(80).then(start)
}

function nextFrame() {
  return new Promise(function(resolve) { resolve() })
}
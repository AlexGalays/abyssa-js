
Router = Abyssa.Router
State  = Abyssa.State

//Router.enableLogs()

stubHistory()

QUnit.testDone(function() {
  // Reset global state
  Abyssa.api.terminate()
})


test('Simple states', function() {

  var events = [],
      lastArticleId,
      lastFilter

  var router = Router({

    index: {
      enter: function() {
        events.push('indexEnter')
      },

      exit: function() {
        events.push('indexExit')
      }
    },

    articles: {
      uri: 'articles/:id?filter',

      enter: function(enterParams) {
        events.push('articlesEnter')

        lastArticleId = enterParams.params.id
        lastFilter = enterParams.params.filter
      },

      exit: function() {
        events.push('articlesExit')
      }
    }

  }).init('')

  deepEqual(events, ['indexEnter'])
  events = []

  router.transitionTo('articles', { id: 38, filter: 'dark green' })

  deepEqual(events, ['indexExit', 'articlesEnter'])
  strictEqual(lastArticleId, '38')
  strictEqual(lastFilter, 'dark green')
  events = []

  router.transitionTo('index')

  deepEqual(events, ['articlesExit', 'indexEnter'])
  events = []

  router.transitionTo('articles/44?filter=666')

  deepEqual(events, ['indexExit', 'articlesEnter'])
  strictEqual(lastArticleId, '44')
  strictEqual(lastFilter, '666')
})

test('Simple states with shorthand function', function() {

  var events = [],
      lastArticleId,
      lastFilter

  var router = Router({

    index: State('', {
      enter: function() {
        events.push('indexEnter')
      },

      exit: function() {
        events.push('indexExit')
      }
    }),

    articles: State('articles/:id?filter', {
      enter: function(enterParams) {
        events.push('articlesEnter')
        lastArticleId = enterParams.params.id
        lastFilter = enterParams.params.filter
      },

      exit: function() {
        events.push('articlesExit')
      }
    })

  }).init('')

  deepEqual(events, ['indexEnter'])
  events = []

  router.transitionTo('articles', { id: 38, filter: 'dark green' })

  deepEqual(events, ['indexExit', 'articlesEnter'])
  strictEqual(lastArticleId, '38')
  strictEqual(lastFilter, 'dark green')
  events = []

  router.transitionTo('index')

  deepEqual(events, ['articlesExit', 'indexEnter'])
  events = []

  router.transitionTo('articles/44?filter=666')

  deepEqual(events, ['indexExit', 'articlesEnter'])
  strictEqual(lastArticleId, '44')
  strictEqual(lastFilter, '666')
})


test('Custom initial state', function() {

  var router = Router({

    articles: State('articles/:id', {}, {
      edit: State('edit', {
        enter: function() {
          ok(true)
        }
      })
    })

  }).init('articles/33/edit')

})


test('Multiple dynamic paths', function() {

  Router({
    article: State('articles/:slug/:articleId', {}, {
      changeLogs: State('changelogs/:changeLogId', {
        enter: function(enterParams) {
          equal(enterParams.params.slug, 'le-roi-est-mort')
          equal(enterParams.params.articleId, 127)
          equal(enterParams.params.changeLogId, 5)
        }
      })
    })
  }).init('articles/le-roi-est-mort/127/changelogs/5')

})


test('Nested state with pathless parents', function() {

  Router({

    // articles and nature are abstract parent states
    articles: State('', {}, {
      nature: State('', {}, {
        edit: State('articles/nature/:id/edit', {
          enter: function() {
            ok(true)
          }
        })
      })
    })

  }).init('articles/nature/88/edit')

})


test('Missing state with a "notFound" state defined by its fullName', function() {

  var reachedNotFound

  var router = Router({

    index: State(),

    articles: State('articles', {}, {
      nature: State('', {}, {
        edit: State('nature/:id/edit')
      })
    }),

    iamNotFound: State('404', {
      enter: function() { reachedNotFound = true }
    })

  })
  .configure({
    notFound: 'iamNotFound'
  })
  .init('articles/naturess/88/edit')


  ok(reachedNotFound)

  router.transitionTo('')
  reachedNotFound = false

  // Should also work with the reverse routing notation
  router.transitionTo('articles.naturess.edit', { id: '88' })

  ok(reachedNotFound)
})


test('Missing state without a "notFound" state defined', function() {

  var router = Router({

    index: State(),

    articles: State('articles', {}, {
      nature: State('', {}, {
        edit: State('nature/:id/edit')
      })
    }),

  }).init('')

  throws(function() {
    router.transitionTo('articles/naturess/88/edit')
  })

  // Also work with the reverse routing notation
  throws(function() {
    router.transitionTo('articles.naturess.edit', { id: '88' })
  })

})


test('The router can be built bit by bit', function() {

  var reachedArticlesEdit,
      router = Router(),
      index = State(''),
      articles = State('articles'),
      edit = State('edit')

  edit.enter = function() {
    reachedArticlesEdit = true
  }

  articles.children.edit = edit

  router.addState('index', index)
  router.addState('articles', articles)
  router.init('articles.edit')

  ok(reachedArticlesEdit)
})


test('More states can be added after router initialization', function() {
  var router = Router({
    index: State('')
  })

  router.init('')

  router.addState('articles', State('articles/:id', {}, {
    detail: State('detail')
  }))

  router.transitionTo('articles.detail', { id: '33' })

  equal(router.current().fullName, 'articles.detail')
})


test('Sibling states can not have the same path', function() {
  var router = Router({
    index: State('index'),
    index2: State('index')
  })

  throws(function() { router.init('/index') })

  var nestedRouter = Router({
    top: State('top', {}, {
      index: State('index'),
      index2: State('index')
    })
  })

  throws(function() { nestedRouter.init('top/index') })
})


test('State names must be unique among siblings', function() {
  var router, root

  router = Router()
  router.addState('root', State())
  throws(function() {
    router.addState('root', State())
  })

  root = State()
  root.children.child = State()
  throws(function() {
    root.addState('child', State())
  })

})


test('Ambiguous paths in different states are forbidden', function() {
  var router = Router({
    books: State('', {}, {
      default: State('books', {}, {})
    }),

    oldBooks: State('books', {}, {
      default: State('', {}, {})
    })
  })

  throws(function() { router.init('books') })
})


test('Transitioning to a non leaf state is possible', function() {
  var events = []

  function recordEvents(name) {
    return {
      enter: function() { events.push(name + 'Enter') },
      exit: function() { events.push(name + 'Exit') }
    }
  }

  var router = Router({
    index: State('index', recordEvents('index')),

    articles: State('', recordEvents('articles'), {
      item: State('articles/:id', recordEvents('item'))
    })
  }).init('index')

  events = []
  router.transitionTo('articles')

  deepEqual(events, ['indexExit', 'articlesEnter'])
  events = []

  router.transitionTo('articles/33')

  deepEqual(events, ['itemEnter'])
})


test('No transition occurs when going to the same state', function() {

  var events = []
  var router = Router({

    articles: State('articles/:id', {
      enter: function() { events.push('articlesEnter') },
      exit: function() { events.push('articlesExit') },
    }, {
      today: State('today', {
        enter: function() { events.push('todayEnter') },
        exit: function() { events.push('todayExit') }
      })
    })

  }).init('articles/33/today')

  events = []

  router.transitionTo('articles/33/today')
  deepEqual(events, [])
})


test('Param and query changes should trigger a transition', function() {

  var events = [],
      lastArticleId

  var router = Router({

    blog: State('blog', {
      enter: function() {
        events.push('blogEnter')
      },

      exit: function() {
        events.push('blogExit')
      }
    }, {

      articles: State('articles/:id', {
        enter: function(enterParams) {
          events.push('articlesEnter')
          lastArticleId = enterParams.params.id
        },

        exit: function() {
          events.push('articlesExit')
        },
      }, {

        edit: State('edit', {
          enter: function() {
            events.push('editEnter')
          },

          exit: function() {
            events.push('editExit')
          }
        })
      })
    })

  }).init('blog/articles/33/edit')


  events = []
  router.transitionTo('blog/articles/44/edit')

  // The transition only goes up to the state owning the param
  deepEqual(events, ['editExit', 'articlesExit', 'articlesEnter', 'editEnter'])
  events = []

  router.transitionTo('blog/articles/44/edit?filter=1')

  // By default, a change in the query will result in a complete transition to the root state and back.
  deepEqual(events, ['editExit', 'articlesExit', 'blogExit', 'blogEnter', 'articlesEnter', 'editEnter'])
  events = []

  router.transitionTo('blog/articles/44/edit?filter=2')

  deepEqual(events, ['editExit', 'articlesExit', 'blogExit', 'blogEnter', 'articlesEnter', 'editEnter'])
})


test('Param changes in a leaf state should not trigger a parent transition', function() {

  var events = [],
      lastArticleId

  var router = Router({

    blog: State('blog', {
      enter: function() {
        events.push('blogEnter')
      },

      exit: function() {
        events.push('blogExit')
      }
    }, {
      articles: State('articles/:id', {
        enter: function(enterParams) {
          events.push('articlesEnter')
          lastArticleId = enterParams.params.id
        },

        exit: function() {
          events.push('articlesExit')
        }

      })
    })

  }).init('/blog/articles/33')


  events = []
  router.transitionTo('/blog/articles/44')

  // The transition only goes up to the state owning the param
  deepEqual(events, ['articlesExit', 'articlesEnter'])
  events = []

  router.transitionTo('/blog/articles/44?filter=1')

  // By default, a change in the query will result in a complete transition to the root state and back.
  deepEqual(events, ['articlesExit', 'blogExit', 'blogEnter', 'articlesEnter'])
  events = []

  router.transitionTo('/blog/articles/44?filter=2')

  deepEqual(events, ['articlesExit', 'blogExit', 'blogEnter', 'articlesEnter'])
})


test('Query-only transitions', function() {

  var events = []

  var router = Router({

    blog: State('blog', {
      enter: function() {
        events.push('blogEnter')
      },

      exit: function() {
        events.push('blogExit')
      }
    }, {

      // articles is the state that owns the filter query param
      articles: State('articles/:id?filter', {
        enter: function() {
          events.push('articlesEnter')
        },

        exit: function() {
          events.push('articlesExit')
        }
      }, {

        edit: State('edit', {
          enter: function() {
            events.push('editEnter')
          },

          exit: function() {
            events.push('editExit')
          }
        })
      })
    })
  }).init('blog/articles/33/edit')


  setSomeUnknownQuery()
  fullTransitionOccurred()
  setFilterQuery()
  onlyExitedUpToStateOwningFilter()
  swapFilterValue()
  onlyExitedUpToStateOwningFilter()
  removeFilterQuery()
  onlyExitedUpToStateOwningFilter()


  function setSomeUnknownQuery() {
    events = []
    router.transitionTo('blog/articles/33/edit?someQuery=true')
  }

  function fullTransitionOccurred() {
    deepEqual(events, ['editExit', 'articlesExit', 'blogExit', 'blogEnter', 'articlesEnter', 'editEnter'])
  }

  function setFilterQuery() {
    events = []
    router.transitionTo('blog/articles/33/edit?filter=33')
  }

  function onlyExitedUpToStateOwningFilter() {
    deepEqual(events, ['editExit', 'articlesExit', 'articlesEnter', 'editEnter'])
  }

  function swapFilterValue() {
    events = []
    router.transitionTo('blog/articles/33/edit?filter=34')
  }

  function removeFilterQuery() {
    events = []
    router.transitionTo('blog/articles/33/edit')
  }

})


test('Updating both a parent param and navigating to a different child state', function() {
  var events = []
  var router = Router({

    articles: State('articles/:id', {
      enter: function() {
        events.push('articlesEnter')
      },

      exit: function() {
        events.push('articlesExit')
      }
    }, {

      edit: State('edit', {
        enter: function() {
          events.push('editEnter')
        },

        exit: function() {
          events.push('editExit')
        }
      })
    })
  }).init('articles/33')

  events = []

  router.transitionTo('articles/88/edit')

  deepEqual(events, ['articlesExit', 'articlesEnter', 'editEnter'])
})


test('The query string is provided to all states', function() {

  Router({
    one: State('one/:one', {
      enter: function(enterParams) {
        assertions(enterParams.params.one, 44, enterParams.params)
      }
    }, {

      two: State('two/:two', {
        enter: function(enterParams) {
          assertions(enterParams.params.two, 'bla', enterParams.params)
        }
      }, {

        three: State('three/:three', {
          enter: function(enterParams) {
            assertions(enterParams.params.three, 33, enterParams.params)
          }
        })
      })
    })
  }).init('one/44/two/bla/three/33?filter1=123&filter2=456')


  function assertions(param, expectedParam, queryObj) {
    equal(param, expectedParam)
    equal(queryObj.filter1, 123)
    equal(queryObj.filter2, 456)
  }

})


test('Reverse routing', function() {
  var router = Router({

    index: State(),

    one: State('one?filter&pizza&ble', {}, {
      two: State(':id/:color')
    })

  }).init('')

  var href = router.link('one.two', { id: 33, color: 'dark green', filter: 'a&b', pizza: 123, bla: 55, ble: undefined })
  equal(href, '/one/33/dark%20green?filter=a%26b&pizza=123')

  href = router.link('one.two', { id: 33, color: 'dark green' })
  equal(href, '/one/33/dark%20green')

})


test('Reverse routing in hash mode', function() {
  var router = Router({

    index: State(),

    one: State('one?filter&pizza', {}, {
      two: State(':id/:color')
    })

  })
  .configure({ urlSync: 'hash', 'hashPrefix': '!' })
  .init('')

  var href = router.link('one.two', {id: 33, color: 'dark green', filter: 'a&b', pizza: 123, bla: 55})
  equal(href, '#!/one/33/dark%20green?filter=a%26b&pizza=123')

  href = router.link('one.two', {id: 33, color: 'dark green'})
  equal(href, '#!/one/33/dark%20green')

})


test('params should be decoded automatically', function() {
  var passedParams

  var router = Router({

    index: State('index/:id/:filter', { enter: function(enterParams) {
      passedParams = enterParams
    }})

  }).init('index/The%20midget%20%40/a%20b%20c')

  equal(passedParams.params.id, 'The midget @')
  equal(passedParams.params.filter, 'a b c')
})

asyncTest('Init with a redirect', function() {
  var oldRouteChildEntered
  var oldRouteExited
  var newRouteEntered

  var router = Router({

    oldRoute: State('oldRoute', {
      enter: function() {
        router.transitionTo('newRoute')
      },
      exit: function() { oldRouteExited = true }
    }, {
      oldRouteChild: State('child', { enter: function() { oldRouteChildEntered = true } })
    }),

    newRoute: State('newRoute', { enter: function() { newRouteEntered = true } })

  })

  pushedStates.length = 1
  router.init('oldRoute.oldRouteChild')

  nextFrame()
    .then(function() {
      equal(pushedStates.length, 1, 'Initiating with a redirection should not push a new state in history')

      ok(!oldRouteExited, 'The state was not properly entered as it redirected immediately. Therefore, it should not exit.')
      ok(!oldRouteChildEntered, 'A child state of a redirected route should not be entered')
      ok(newRouteEntered)
    })
    .then(start)
})


asyncTest('redirect', function() {
  var oldRouteChildEntered
  var oldRouteExited
  var newRouteEntered

  var router = Router({
    init: State('init'),

    oldRoute: State('oldRoute', {
      enter: function() {
        router.transitionTo('newRoute')
      },
      exit: function() { oldRouteExited = true }
    }, {
      oldRouteChild: State('child', { enter: function() { oldRouteChildEntered = true } })
    }),

    newRoute: State('newRoute', { enter: function() { newRouteEntered = true } })

  })

  router.init('init')

  nextFrame()
    .then(function() {
      router.transitionTo('oldRoute.oldRouteChild')
    })
    .then(nextFrame)
    .then(function() {
      equal(pushedStates.length, 2, 'A redirection should push a single history entry')
    })
    .then(start)
})


test('Redirecting from transition.started', function() {

  var completedCount = 0

  var router = Router({
    index: State(''),
    uno: State('uno', { enter: incrementCompletedCount }),
    dos: State('dos', { enter: incrementCompletedCount })
  })
  .init('')

  router.on('started', function() {
    router.on('started', null)
    router.transitionTo('dos')
  })

  router.transitionTo('uno')

  equal(completedCount, 1)
  equal(router.current().name, 'dos')

  function incrementCompletedCount() {
    completedCount++
  }
})


test('rest params', function() {

  var lastParams

  var router = Router({
    index: State(),
    colors: State('colors/:rest*', { enter: function(enterParams) {
      lastParams = enterParams
    }})
  }).init('')


  router.transitionTo('colors')

  strictEqual(lastParams.params.rest, undefined)

  router.transitionTo('colors/red')

  strictEqual(lastParams.params.rest, 'red')

  router.transitionTo('colors/red/blue')

  strictEqual(lastParams.params.rest, 'red/blue')
})


asyncTest('backTo', function() {
  var passedParams

  var router = Router({

    articles: State('articles/:id?filter', { enter: rememberParams }),

    books: State('books'),

    cart: State('cart/:mode', { enter: rememberParams })

  }).init('articles/33?filter=66')


  router.transitionTo('books')

  nextFrame().then(function() {
    passedParams = null
    router.backTo('articles', { id: 1 })
  
    strictEqual(passedParams.params.id, '33')
    strictEqual(passedParams.params.filter, '66')
  
    // We've never been to cart before, thus the default params we pass should be used
    router.backTo('cart', { mode: 'default' })
  
    strictEqual(passedParams.params.mode, 'default')
    
    start()
  })

  function rememberParams(params) {
    passedParams = params
  }
})


test('update', function() {
  var events = []
  var updateParams

  var root    = RecordingState('root', '')
  var news    = RecordingState('news', 'news/:id', root, true)
  var archive = RecordingState('archive', 'archive', news)
  var detail  = RecordingState('detail', 'detail', archive, true)


  var router = Router({
    root: root
  })
  .init('root.news.archive.detail', { id: 33 })


  deepEqual(events, [
    'rootEnter',
    'newsEnter',
    'archiveEnter',
    'detailEnter'
  ])

  events = []
  updateParams = null
  router.transitionTo('root.news.archive.detail', { id: 34 })

  deepEqual(events, [
    'archiveExit',
    'newsUpdate',
    'archiveEnter',
    'detailUpdate'
  ])
  strictEqual(updateParams.id, '34')


  function RecordingState(name, path, parent, withUpdate) {
    var state = State(path, {
      enter: function(params) { events.push(name + 'Enter') },
      exit: function() { events.push(name + 'Exit') }
    })

    if (withUpdate) state.update = function(params) {
      events.push(name + 'Update')
      updateParams = params.params
    }

    if (parent) parent.children[name] = state

    return state
  }

})


asyncTest('data can be accumulated before the transition ends', function() {

  var enterArgs = []
  var resolveCalls = []

  var router = Router({

    missions: State('missions/:id', {
      resolve: function(params) {
        resolveCalls.push('missions')
        return okData({ id: params.id }, 20)
      },
      enter: function(arg) { enterArgs.push(arg) }
    }, {
      comments: State('comments', {
        resolve: function(params) {
          resolveCalls.push('comments')
          return okData({ id: params.id, comments: true }, 40)
        },
        enter: function(arg) { enterArgs.push(arg) }
      }),
      chat: State('chat', {
        resolve: function(params) {
          resolveCalls.push('chat')
          return okData({ id: params.id, chat: true }, 20)
        },
        enter: function(arg) { enterArgs.push(arg) }
      })
    }),

    profile: State('me/profile', {

    }),

  }).init('me/profile')

  router.on('started', function(params) {
    equal(params.isAsyncTransition, false)
    router.on('started', null)
  })

  nextFrame()
    .then(function() {
      router.on('started', function(params) {
        equal(params.isAsyncTransition, true)
        router.on('started', null)
      })

      router.transitionTo('missions.comments', { id: 33 })

      deepEqual(resolveCalls, ['missions', 'comments'])
    })
    .then(function() {
      return delay(45)
    })
    .then(function() {
      deepEqual(enterArgs.map(function(a) { return a.resolved }), [
        { id: '33' },
        { id: '33', comments: true }
      ])
    })
    .then(function() {
      router.on('started', function(params) {
        equal(params.isAsyncTransition, true)
        router.on('started', null)
      })

      router.transitionTo('missions.chat', { id: 33 })
      deepEqual(resolveCalls, ['missions', 'comments', 'chat'])
    })
    .then(function() {
      return delay(25)
    })
    .then(function() {
      deepEqual(enterArgs.map(function(a) { return a.resolved }), [
        { id: '33' },
        { id: '33', comments: true },
        { id: '33', chat: true }
      ])
    })
    .then(start)
    .catch(function() {
      console.log(err)
      start()
    })
})


asyncTest('if a resolve promise fails, an error is emitted', function() {

  var router = Router({

    missions: State('missions/:id', {
      resolve: function(params) {
        return okData({ id: params.id }, 20)
      },
      enter: function(arg) {}
    }, {
      comments: State('comments', {
        resolve: function(params) {
          return errorData('oh no', 40)
        },
        enter: function(arg) {}
      })
    }),

    profile: State('me/profile', {

    }),

  }).init('me/profile')


  var receivedError

  nextFrame()
    .then(function() {
      router.on('error', function(err) {
        receivedError = err
      })

      router.transitionTo('missions.comments', { id: 33 })
    })
    .then(function() {
      return delay(45)
    })
    .then(function() {
      strictEqual(receivedError, 'oh no')
      strictEqual(router.current().fullName, 'profile')
    })
    .then(start)
    .catch(function() {
      console.log(err)
      start()
    })
})



function stateWithParamsAssertions(stateWithParams) {
  equal(stateWithParams.uri, '/state1/33/misc?filter=true')
  equal(stateWithParams.name, 'state1Child')
  equal(stateWithParams.fullName, 'state1.state1Child')
  equal(stateWithParams.data.dd, 12)

  equal(stateWithParams.params.id, '33')
  equal(stateWithParams.params.category, 'misc')
  equal(stateWithParams.params.filter, 'true')

  equal(stateWithParams.paramsDiff.enter.filter, true)
  equal(stateWithParams.paramsDiff.all.filter, true)

  ok(stateWithParams.isIn('state1'))
  ok(stateWithParams.isIn('state1.state1Child'))
  ok(!stateWithParams.isIn('state2'))
}

test('event handlers are passed StateWithParams objects', function() {

  var router = Router({

    state1: State('state1/:id', {}, {
      state1Child: State(':category', { data: { dd: 12 } })
    }),

    state2: State('state2/:country/:city')
  })

  router.on('started', function(params) {
    router.on('started', null)
    equal(params.isAsyncTransition, false)
    stateWithParamsAssertions(params.toState)
  })

  router.init('state1/33/misc?filter=true')
})


test('router.current and router.previous', function() {

  var router = Router({

    state1: State('state1/:id', {}, {
      state1Child: State(':category', {
        data: { dd: 12 },
        enter: assertions
      })
    }),

    state2: State('state2/:country/:city')

  })

  router.init('state1/33/misc?filter=true')


  function assertions() {
    var state = router.current()
    stateWithParamsAssertions(state)

    equal(router.previous(), null)

    router.transitionTo('state2/england/london')

    var previous = router.previous()
    equal(previous, state)
    stateWithParamsAssertions(previous)

    equal(router.current().fullName, 'state2')
  }

})


test('router.findState', function() {
  var state1 = {
    uri: 'articles',
    enter: function() {},
    children: {
      detail: {
        uri: ':id?q',
        data: { kk: 'bb' }
      }
    },
    data: { kk: 'aa' }
  }

  var state2 = {
    uri: 'index',
    children: {
      dashboard: {
        uri: 'dashboard'
      },
      stats: {
        uri: 'stats'
      }
    }
  }

  var router = Router({
    state1: state1,
    state2: state2
  })
  .init('state1')

  function assertStateApi(stateApi, name, fullName, parentFullName, data) {
    equal(stateApi.name, name)
    equal(stateApi.fullName, fullName)
    equal((stateApi.parent && stateApi.parent.fullName), parentFullName)
    equal(stateApi.data.kk, data)
    equal(Object.keys(stateApi).length, 4)
  }

  var state1Api = router.findState(state1)
  var state1Api2 = router.findState('state1')
  assertStateApi(state1Api, 'state1', 'state1', undefined, 'aa')
  equal(state1Api, state1Api2)

  var state1DetailApi = router.findState('state1.detail')
  assertStateApi(state1DetailApi, 'detail', 'state1.detail', 'state1', 'bb')

  equal(router.findState('nope'), undefined)
})


test('urls can contain dots', function() {

  Router({
    map: State('map/:lat/:lon', { enter: function(enterParams) {
      strictEqual(enterParams.params.lat, '1.5441')
      strictEqual(enterParams.params.lon, '0.9986')
    }})
  }).init('map/1.5441/0.9986')

})


test('util.normalizePathQuery', function() {

  function expect(from, to) {
    var assertMessage = ('"' + from + '" => "' + to + '"')
    equal(Abyssa.util.normalizePathQuery(from), to, assertMessage)
  }

  // No slash changes required
  expect("/", "/")
  expect("/path", "/path")
  expect("/path/a/b/c", "/path/a/b/c")
  expect("/path?query", "/path?query")
  expect("/path/a/b/c?query", "/path/a/b/c?query")
  expect("/path/a/b/c?query=///", "/path/a/b/c?query=///")

  // Slashes are added
  expect("", "/")
  expect("path", "/path")
  expect("path/a/b/c", "/path/a/b/c")
  expect("path?query", "/path?query")
  expect("path/a/b/c?query", "/path/a/b/c?query")
  expect("?query", "/?query")

  // Slashes are removed
  expect("//", "/")
  expect("///", "/")
  expect("//path", "/path")
  expect("//path/a/b/c", "/path/a/b/c")
  expect("//path/", "/path")
  expect("//path/a/b/c/", "/path/a/b/c")
  expect("//path//", "/path")
  expect("//path/a/b/c//", "/path/a/b/c")
  expect("/path//", "/path")
  expect("/path/a/b/c//", "/path/a/b/c")
  expect("//path?query", "/path?query")
  expect("//path/a/b/c?query", "/path/a/b/c?query")
  expect("/path/?query", "/path?query")
  expect("/path/a/b/c/?query", "/path/a/b/c?query")
  expect("/path//?query", "/path?query")
  expect("/path/a/b/c//?query", "/path/a/b/c?query")
})


asyncTest('can prevent a transition by navigating to self from the exit handler', function() {

  var events = []

  var router = Router({
    uno: State('uno', {
      enter: function() { events.push('unoEnter') },
      exit: function() { router.transitionTo('uno') }
    }),
    dos: State('dos', {
      enter: function() { events.push('dosEnter') },
      exit: function() { events.push('dosExit') }
    })
  })
  .init('uno')

  nextFrame()
    .then(function() {
      router.transitionTo('dos')
    })
    .then(nextFrame)
    .then(function() {
      // Only the initial event is here.
      // Since the exit was interrupted, there's no reason to re-enter.
      deepEqual(events, ['unoEnter'])
      equal(router.current().name, 'uno')

      start()
    })
})


test('to break circular dependencies, the api object can be used instead of the router', function() {

  var router = Abyssa.api
  var events = []

  Router({

    index: {
      enter: function() {
        events.push('indexEnter')
      },

      exit: function() {
        events.push('indexExit')
      }
    },

    articles: {
      uri: 'articles/:id?filter',

      enter: function() {
        events.push('articlesEnter')
      },

      exit: function() {
        events.push('articlesExit')
      }
    }

  }).init('')

  events = []
  router.transitionTo('articles/33')

  deepEqual(events, ['indexExit', 'articlesEnter'])
})


test('The public fullName of a _default_ state is the same as its parent', function() {
  var router = Abyssa.api

  Router({

    articles: {
      uri: 'articles',

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

  }).init('articles/33')

  // The router is actually at articles.detail._default_ but that should be an implementation detail.
  equal(router.current().fullName, 'articles.detail')
})


function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms) })
}

function okData(data, delay) {
  return new Promise(function(resolve) { setTimeout(function() { resolve(data) }, delay) })
}

function errorData(reason, delay) {
  return new Promise(function(resolve, reject) { setTimeout(function() { reject(reason) }, delay) })
}

function nextFrame() {
  return new Promise(function(resolve) { resolve() })
}

const pushedStates = [{}]

function stubHistory() {
  QUnit.testStart(function(){
    pushedStates.splice(0, pushedStates.length, {})
  })  
  
  window.history.pushState = function(state, title, url) {
    pushedStates.push({
      state: state,
      title: title,
      url: url
    })
  }
  window.history.replaceState = function(state, title, url) {
    pushedStates.pop()
    pushedStates.push({
      state: state,
      title: title,
      url: url
    })
  }
}

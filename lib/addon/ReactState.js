
/* Addon making using React easier */

'use strict';

(function () {

  // Enable this addon even in build-less systems (JsFiddle, etc)
  var React = typeof require == 'function' ? require('react') : window.React;
  var ReactDOM = typeof require == 'function' ? require('react-dom') : window.ReactDOM;

  function ReactStateForContainer(container) {
    return function ReactState(uri, component, children) {

      // Create the Abyssa state object
      var state = {
        data: { _component: component },
        uri: uri,
        children: children
      };

      // The router will add a default state to any parent without one; Add ours first so that it's a ReactState.
      if (children && !Object.keys(children).some(function (name) {
        return children[name].uri.split('?')[0] == '';
      })) children._default_ = ReactState('');

      state.enter = function (params, acc, router) {
        // Let the component react to the route change, e.g to redirect to another state
        if (component.onEnter) {
          var current = router.current().fullName;
          component.onEnter();
          // The current state changed, cancel everything.
          if (router.current().fullName != current) return;
        }

        // It is the responsability of the leaf state to render the whole component hierarchy; Bail if we're a parent.
        if (children) return;

        var stateApi = router.findState(state);
        var parents = parentStates(stateApi);
        var states = component ? [stateApi].concat(parents) : parents;

        // The actual VDOM element created from the component class hierarchy
        var instance = states.slice(1).reduce(function (child, parent) {
          return createEl(parent.data('_component'), params, parent.fullName, child);
        }, createEl(states[0].data('_component'), params, states[0].fullName));

        ReactDOM.render(instance, container);
      };

      return state;
    };
  }

  function createEl(fromClass, params, key, child) {
    return React.createElement(fromClass, { params: params, key: key }, child);
  }

  function parentStates(stateApi) {
    var result = [];
    var parent = stateApi.parent;

    while (parent) {
      result.push(parent);
      parent = parent.parent;
    }

    return result;
  }

  typeof module == 'object' ? module.exports = ReactStateForContainer : Abyssa.ReactState = ReactStateForContainer;
})();
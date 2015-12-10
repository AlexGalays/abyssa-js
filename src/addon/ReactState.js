
/* Addon making using React easier */


(function() {

// Enable this addon even in build-less systems (JsFiddle, etc)
const React = (typeof require == 'function') ? require('react') : window.React;
const ReactDOM = (typeof require == 'function') ? require('react-dom') : window.ReactDOM;


function ReactStateForContainer(container) {
  return function ReactState(uri, component, children) {

    // Create the Abyssa state object
    const state = {
      data: { _component: component },
      uri,
      children
    };

    // The router will add a default state to any parent without one; Add ours first so that it's a ReactState.
    if (children && !Object.keys(children).some(name => children[name].uri.split('?')[0] == ''))
      children._default_ = ReactState('');

    state.enter = function(params, acc, router) {
      const route = router.current();

      // Let the component react to the route change, e.g to redirect to another state
      if (component && component.onEnter) {
        const current = route.fullName;
        component.onEnter();
        // The current state changed, cancel everything.
        if (router.current().fullName != current) return;
      }

      // It is the responsability of the leaf state to render the whole component hierarchy; Bail if we're a parent.
      if (children) return;

      const stateApi = router.findState(state);
      const parents = parentStates(stateApi);
      const states = component ? [stateApi].concat(parents) : parents;

      // The actual VDOM element created from the component class hierarchy
      const instance = states.slice(1).reduce((child, parent) => {
        return createEl(parent.data('_component'), route, params, acc, parent.fullName, child);
      }, createEl(states[0].data('_component'), route, params, acc, states[0].fullName));

      ReactDOM.render(instance, container);
    };

    return state;
  }
}

function createEl(fromClass, route, params, acc, key, child) {
  return React.createElement(fromClass, { route, params, acc, key }, child);
}

function parentStates(stateApi) {
  const result = [];
  let parent = stateApi.parent;

  while (parent) {
    result.push(parent);
    parent = parent.parent;
  }

  return result;
}

(typeof module == 'object')
  ? (module.exports = ReactStateForContainer)
  : (Abyssa.ReactState = ReactStateForContainer);

})();
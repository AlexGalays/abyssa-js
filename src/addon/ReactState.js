
/* Addon making using React easier */


(function() {

// Enable this addon even in build-less systems (JsFiddle, etc)
let React = (typeof require == 'function') ? require('react') : window.React;
let ReactDOM = (typeof require == 'function') ? require('react-dom') : window.ReactDOM;


function ReactStateForContainer(container) {
  return function ReactState(uri, component, children) {

    // Create the Abyssa state object
    let state = {
      data: { _component: component },
      uri,
      children
    };

    // The router will add a default state to any parent without one; Add ours first so that it's a ReactState.
    if (children && !Object.keys(children).some(name => children[name].uri == ''))
      children._default_ = ReactState('');

    state.enter = function(params, acc, router) {
      // It is the responsability of the leaf state to render the whole component hierarchy; Bail if we're a parent.
      if (children) return;

      let stateApi = router.findState(state);
      let parents = parentStates(stateApi);
      let states = component ? [stateApi].concat(parents) : parents;

      // The actual VDOM element created from the component class hierarchy
      let instance = states.slice(1).reduce((child, parent) => {
        return createEl(parent.data('_component'), params, parent.fullName, child);
      }, createEl(states[0].data('_component'), params, states[0].fullName));

      ReactDOM.render(instance, container);
    };

    return state;
  }
}

function createEl(fromClass, params, key, child) {
  return React.createElement(fromClass, { params, key }, child);
}

function parentStates(stateApi) {
  let result = [];
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
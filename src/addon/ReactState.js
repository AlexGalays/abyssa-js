
/* Addon making using React easier */


(function() {


var React = (typeof require == 'function')
  ? require('react')
  : window.React;


function ReactStateForContainer(container) {
  return function ReactState(uri, component, children) {
    var state = {
      _component: component,
      uri,
      children
    };

    // The component class chain.
    var components;

    if (children) {
      if (!Object.keys(children).some(name => children[name].uri == ''))
        children._default_ = ReactState('');

      Object.keys(children).forEach(name => children[name]._parent = state);
    }

    state.enter = function(params) {
      // It is the responsability of the leaf state to render the whole component chain; Bail if we're a parent.
      if (children) return;

      if (!components) {
        var parents = [];
        var parent = state._parent;

        while (parent) {
          parents.push(parent._component);
          parent = parent._parent;
        }
        parents.reverse();
        components = component ? parents.concat(component) : parents;
      }

      var instance;
      if (components.length == 1)
        instance = React.createElement(components[0], { params });
      else
        instance = components.reduceRight((child, parent) => {
          if (!React.isValidElement(child))
            child = React.createElement(child, { params });
          
          return React.createElement(parent, { params }, child);
        });

       React.render(instance, container);
    };

    return state;
  }
}

(typeof module == 'object')
  ? (module.exports = ReactStateForContainer)
  : (Abyssa.ReactState = ReactStateForContainer);

})();
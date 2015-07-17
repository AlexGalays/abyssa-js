
/* Addon making using React easier */


(function() {


var React = (typeof require == 'function')
  ? require('react')
  : window.React;


function ReactStateForContainer(container) {
  return function ReactState(uri, component, children) {
    var state = {
      _component: component,
      uri: uri,
      children: children
    };

    // The component class chain.
    var components;

    if (children) {
      children._default_ = ReactState('');

      Object.keys(children).forEach(function(name) {
        children[name]._parent = state;
      });
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
        instance = React.createElement(components[0], { params: params });
      else
        instance = components.reduceRight(function(child, parent) {
          if (!React.isValidElement(child))
            child = React.createElement(child, { params: params });
          
          return React.createElement(parent, { params: params }, child);
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
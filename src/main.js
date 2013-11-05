
require('html5-history-api/history.iegte8');

var Abyssa = {
  Router: require('./Router'),
  State:  require('./State'),
  Async:  require('./Transition').asyncPromises.register
};

module.exports = Abyssa;
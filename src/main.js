
'use strict';

var util = require('./util');


var Abyssa = {
  Router: require('./Router'),
  api: require('./api'),
  State: util.stateShorthand,

  _util: util
};

module.exports = Abyssa;
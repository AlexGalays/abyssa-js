
'use strict';

var util = require('./util');

var Abyssa = {
  Router: require('./Router'),
  api: require('./api'),
  async: require('./async'),
  State: util.stateShorthand,

  _util: util
};

module.exports = Abyssa;
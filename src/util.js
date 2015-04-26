
'use strict';

var util = {};


util.noop = function() {};

util.arrayToObject = function(array) {
  return array.reduce(function(obj, item) {
    obj[item] = 1;
    return obj;
  }, {});
};

util.objectToArray = function(obj) {
  var array = [];
  for (var key in obj) array.push(obj[key]);
  return array;
};

util.copyObject = function(obj) {
  var copy = {};
  for (var key in obj) copy[key] = obj[key];
  return copy;
};

util.mergeObjects = function(to, from) {
  for (var key in from) to[key] = from[key];
  return to;
};

util.objectSize = function(obj) {
  var size = 0;
  for (var key in obj) size++;
  return size;
};

util.mapValues = function(obj, fn) {
  var result = {};
  for (var key in obj) {
    result[key] = fn(obj[key]);
  }
  return result;
};

/*
* Return the set of all the keys that changed (either added, removed or modified).
*/
util.objectDiff = function(obj1, obj2) {
  var diff, update = {}, enter = {}, exit = {}, all = {},
      name,
      obj1 = obj1 || {};

  for (name in obj1) {
    if (!(name in obj2))
      exit[name] = all[name] = true;
    else if (obj1[name] != obj2[name])
      update[name] = all[name] = true;
  }

  for (name in obj2) {
    if (!(name in obj1))
      enter[name] = all[name] = true;
  }

  diff = {
    all: all,
    update: update,
    enter: enter,
    exit: exit
  };

  return diff;
};

util.makeMessage = function() {
  var message = arguments[0],
      tokens = Array.prototype.slice.call(arguments, 1);

  for (var i = 0, l = tokens.length; i < l; i++) 
    message = message.replace('{' + i + '}', tokens[i]);

  return message;
};

util.parsePaths = function(path) {
  return path.split('/')
    .filter(function(str) { return str.length })
    .map(function(str) { return decodeURIComponent(str) });
};

util.parseQueryParams = function(query) {
  return query ? query.split('&').reduce(function(res, paramValue) {
    var pv = paramValue.split('=');
    res[pv[0]] = decodeURIComponent(pv[1]);
    return res;
  }, {}) : {};
};


var LEADING_SLASHES = /^\/+/;
var TRAILING_SLASHES = /^([^?]*?)\/+$/;
var TRAILING_SLASHES_BEFORE_QUERY = /\/+\?/;
util.normalizePathQuery = function(pathQuery) {
  return ('/' + pathQuery
    .replace(LEADING_SLASHES, '')
    .replace(TRAILING_SLASHES, '$1')
    .replace(TRAILING_SLASHES_BEFORE_QUERY, '?'));
};

util.stateShorthand = function(uri, options, children) {
  return util.mergeObjects({ uri: uri, children: children || {} }, options);
};


module.exports = util;

'use strict';


function isString(instance) {
   return Object.prototype.toString.call(instance) == '[object String]';
}

function noop() {}

function arrayToObject(array) {
  return array.reduce(function(obj, item) {
    obj[item] = 1;
    return obj;
  }, {});
}

function objectToArray(obj) {
  var array = [];
  for (var key in obj) array.push(obj[key]);
  return array;
}

function copyObject(obj) {
  var copy = {};
  for (var key in obj) copy[key] = obj[key];
  return copy;
}

function mergeObjects(to, from) {
  for (var key in from) to[key] = from[key];
}

function objectSize(obj) {
  var size = 0;
  for (var key in obj) size++;
  return size;
}

function makeMessage() {
  var message = arguments[0],
      tokens = Array.prototype.slice.call(arguments, 1);

  for (var i = 0, l = tokens.length; i < l; i++) 
    message = message.replace('{' + i + '}', tokens[i]);

  return message;
}


var LEADING_SLASHES = /^\/+/;
var TRAILING_SLASHES = /^([^?]*?)\/+$/;
var TRAILING_SLASHES_BEFORE_QUERY = /\/+\?/;
function normalizePathQuery(pathQuery) {
  return ('/' + pathQuery
    .replace(LEADING_SLASHES, '')
    .replace(TRAILING_SLASHES, '$1')
    .replace(TRAILING_SLASHES_BEFORE_QUERY, '?'));
}


module.exports = {
  isString: isString,
  noop: noop,
  arrayToObject: arrayToObject,
  objectToArray: objectToArray,
  copyObject: copyObject,
  mergeObjects: mergeObjects,
  objectSize: objectSize,
  makeMessage: makeMessage,
  normalizePathQuery: normalizePathQuery
};
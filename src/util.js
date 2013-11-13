
function isString(instance) {
   return Object.prototype.toString.call(instance) === '[object String]';
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

/**
 * Returns the set of all the params that changed (either added, removed or value changed).
 *
 * @param {Object} oldParams The original params.
 * @param {Object} newParams The updated params.
 * @return {Object} The object contains only the keys that have been updated.
 */
function getParamDiff(oldParams, newParams) {
  var diff = {},
      name;

  oldParams = oldParams || {};

  for (name in oldParams)
    if (oldParams[name] !== newParams[name]) diff[name] = 1;

  for (name in newParams)
    if (oldParams[name] !== newParams[name]) diff[name] = 1;

  return diff;
}

/**
 * Gets the browser location object.
 * 
 * @return {Location}
 */
function getLocationObject() {
  var location = window && window.location;
  if (!location) { throw new Error('Browser location object cannot be obtained.'); }
  return location;
}

/**
 * Normalizes leading and trailing slashes.
 * Removes the leading slash, if required.
 * 
 * @param {String} pathQuery Path with optional query string.
 * @param {Boolean} [removeLeadingSlash=false] If true, the leading slash will not be prepended.
 * @return {String} Normalized path and query string.
 */
function normalizePathQuery(pathQuery, removeLeadingSlash) {
  return ((removeLeadingSlash ? '' : '/') + pathQuery.replace(/^\/+/, '').replace(/^([^?]*?)\/+$/, '$1').replace(/\/+\?/, '?'));
}

// Export for tests and possible outside usage:
Abyssa.normalizePathQuery = normalizePathQuery;

/**
 * Returns the path and query string from a full URL.
 * Uses the path in the hash like `#/path/?query`, if present.
 * For the hash, assumes it contains the full pathname from the root.
 * We do not use devote/HTML5-History-API patched location object because it ignores the original pathname if the hash-fallback is empty.
 * The returned value may be passed into router.state().
 * 
 * @param {{href:String,pathname:String,search:String}} [urlObject=location] Parsed URL (may be a Location or an HTMLAnchorElement).
 * @return {String} Extracted path and query.
 */
function urlPathQuery(urlObject) {
  urlObject = urlObject || getLocationObject();
  var hashSlash = urlObject.href.indexOf('#/');
  return normalizePathQuery((hashSlash > -1
    ? (urlObject.href.slice(hashSlash + 2))
    : (urlObject.pathname + urlObject.search)
  ));
}

/**
 * Returns a promise of a function call wrapped in a try...catch block.
 * If the call succeeds, the return value is wrapped with a promise.
 * If the call throws, the promise is rejected with the exception.
 *
 * @param {Function} fn
 * @return {Promise}
 */
function whenTryCatch(fn) {
  var ret;
  try {
    ret = when(fn());
  }
  catch (ex) {
    ret = when.defer().reject(ex);
  }
  return ret;
}


export function noop() {}

export function arrayToObject(array) {
  return array.reduce((obj, item) => {
    obj[item] = 1
    return obj
  }, {})
}

export function objectToArray(obj) {
  const array = []
  for (let key in obj) array.push(obj[key])
  return array
}

export function copyObject(obj) {
  const copy = {}
  for (let key in obj) copy[key] = obj[key]
  return copy
}

export function mergeObjects(to, from) {
  for (let key in from) to[key] = from[key]
  return to
}

export function mapValues(obj, fn) {
  const result = {}
  for (let key in obj) result[key] = fn(obj[key])
  return result
}

/*
* Return the set of all the keys that changed (either added, removed or modified).
*/
export function objectDiff(obj1, obj2) {
  const update = {}
  const enter = {}
  const exit = {}
  const all = {}

  obj1 = obj1 || {}

  for (let name in obj1) {
    if (!(name in obj2))
      exit[name] = all[name] = true
    else if (obj1[name] != obj2[name])
      update[name] = all[name] = true
  }

  for (let name in obj2) {
    if (!(name in obj1))
      enter[name] = all[name] = true
  }

  return { all, update, enter, exit }
}

export function makeMessage() {
  let message = arguments[0]
  const tokens = Array.prototype.slice.call(arguments, 1)

  for (let i = 0, l = tokens.length; i < l; i++)
    message = message.replace('{' + i + '}', tokens[i])

  return message
}

export function parsePaths(path) {
  return path.split('/')
    .filter(str => str.length)
    .map(str => decodeURIComponent(str))
}

export function parseQueryParams(query) {
  return query ? query.split('&').reduce((res, paramValue) => {
    const [param, value] = paramValue.split('=')
    res[param] = decodeURIComponent(value)
    return res
  }, {}) : {}
}


var LEADING_SLASHES = /^\/+/
var TRAILING_SLASHES = /^([^?]*?)\/+$/
var TRAILING_SLASHES_BEFORE_QUERY = /\/+\?/
export function normalizePathQuery(pathQuery) {
  return ('/' + pathQuery
    .replace(LEADING_SLASHES, '')
    .replace(TRAILING_SLASHES, '$1')
    .replace(TRAILING_SLASHES_BEFORE_QUERY, '?'))
}

export function stateShorthand(uri, options, children) {
  return mergeObjects({ uri: uri, children: children || {} }, options)
}

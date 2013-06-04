
function isString(instance) {
   return Object.prototype.toString.call(instance) == '[object String]';
}

function noop() {}

function memoize(func) {
  return function() {
    var args  = Array.prototype.slice.call(arguments),
        hash  = '',
        i     = args.length,
        memos = func.__memo || (func.__memo = {}),
        arg;

    while (i--) {
      arg = args[i];
      hash += (arg === Object(arg)) ? JSON.stringify(arg) : arg;
    }

    return (hash in memos)
      ? memos[hash]
      : (memos[hash] = func.apply(this, args));
  };
}

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
(function (factory) {

  // No AMD/CommonJS dependencies for now, just use the local (slighty modified) lib/ files.
  // html5-history-api is not in npm yet. To be continued.

  if (typeof define === 'function' && define.amd) {
    define([], factory);
  }
  else if (typeof exports === "object") {
    module.exports = factory();
  }
  else {
    window.Abyssa = factory();
  }

})(function() {
  var Abyssa = {};
  var Signal = signals.Signal;


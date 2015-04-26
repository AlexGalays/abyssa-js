
var api = require('./api');


/* Wraps a thennable/promise and only resolve it if the router didn't transition to another state in the meantime */
function async(wrapped) {
  var PromiseImpl = async.Promise || Promise;
  var fire = true;

  api.transition.once('started', function() {
    fire = false;
  });

  var promise = new PromiseImpl(function(resolve, reject) {
    wrapped.then(
      function(value) { if (fire) resolve(value); },
      function(err) { if (fire) reject(err); }
    );
  });

  return promise;
};


module.exports = async;
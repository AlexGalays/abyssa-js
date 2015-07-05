
var api = require('./api');


/* Wraps a thennable/promise and only resolve it if the router didn't transition to another state in the meantime */
function async(wrapped) {
  var PromiseImpl = async.Promise || Promise;
  var fire = true;

  api.transition.once('started', () => {
    fire = false;
  });

  var promise = new PromiseImpl((resolve, reject) => {
    wrapped.then(
      value => { if (fire) resolve(value); },
      err => { if (fire) reject(err); }
    );
  });

  return promise;
};


module.exports = async;
/**
 *  class Promise
 *
 *  Provides basic but sexy promise implementation.
 *
 *  ##### Example
 *
 *      var p = Promise(function when_done(err, user) {
 *        if (err) {
 *          // do something
 *        }
 *
 *        // with user as well...
 *      });
 *
 *      User.find({id: 1}, p.resolve);
 **/


// NOTE: For efficiency reasons Promise does not depends on EventEmitter (see
// ./lib/events.js of NodeJS for visual explanation).


/**
 *  new Promise([callback])
 *
 *  If `callback` was specified, passes it to [[Promise#done()]].
 **/
var Promise = module.exports = function Promise(callback) {
  // allow reate promise without new keyword
  if (!(this instanceof Promise)) {
    return new Promise(callback);
  }


  var fired, // Arguments passed to [[Promise#resolve()]]
      subscribers = []; // Callbacks waiting for promise to be resolved


  /**
   *  Promise#resolve() -> Promise
   *
   *  Fulfills promise. You can pass any arguments you want - they will be then
   *  passed to all subscribers of promise fulfillment.
   *
   *  Returns promise itself for chaining purposes.
   *
   *  **NOTICE** You can't resolve promise more than once. Once promise is
   *  fulfilled `resolve` will be silently ignored.
   *
   *  ##### Example
   *
   *      User.find({is_admin: 1}, function (err, users) {
   *        var first_admin = users.shift();
   *
   *        if (!user) {
   *          p.resolve(Error('No admins found at all'));
   *        } else {
   *          p.resolve(err, first_admin);
   *        }
   *      });
   *
   *      // or even like this
   *      User.find({id: 1}, p.resolve);
   **/
  this.resolve = function resolve() {
    if (!fired) {
      fired = arguments;

      var i, l;
      for (i = 0, l = subscribers.length; i < l; i++) {
        subscribers[i].apply(subscribers[i], fired);
      }

      subscribers = null;
    }

    return this;
  };

  /**
   *  Promise#done(callback) -> Promise
   *
   *  Fires `callback` with arguments passed to [[Promise#resolve()]] when
   *  promise was resolved.
   *
   *  Returns promise itself for chaining purposes.
   *
   *  ##### Example
   *
   *      p.done(function (err, user) {
   *        if (err) {
   *          throw err;
   *        }
   *
   *        // we have user, woo-hoo
   *      });
   **/
  this.done = function done(callback) {
    if (!fired) {
      subscribers.push(callback);
    } else {
      callback.apply(callback, fired);
    }

    return this;
  };


  // register done callback if it was specified in the constructor
  if (callback) {
    this.done(callback);
  }
};
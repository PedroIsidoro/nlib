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


'use strict';


// NOTE: For efficiency reasons Promise does not depends on EventEmitter (see
// ./lib/events.js of NodeJS for visual explanation).


/**
 *  new Promise([callback])
 *
 *  If `callback` was specified, passes it to [[Promise#done]].
 **/
var Promise = module.exports = function Promise(callback) {
  // allow create instance without new keyword
  if (!(this instanceof Promise)) {
    return new Promise(callback);
  }


  var fired, // Arguments passed to [[Promise#resolve]]
      subscribers = [], // Callbacks waiting for promise to be resolved
      self = this; // Self-reference


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

      subscribers.forEach(function (subscriber) {
        process.nextTick(function () {
          subscriber.apply(subscriber, fired);
        });
      });

      subscribers = null;
    }

    return self;
  };

  /**
   *  Promise#done(callback) -> Promise
   *
   *  Fires `callback` with arguments passed to [[Promise#resolve]] when
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
    process.nextTick(function () {
      if (!fired) {
        subscribers.push(callback);
      } else {
        callback.apply(callback, fired);
      }
    });

    return self;
  };


  /**
   *  Promise#resolved -> Boolean
   *
   *  Tells whenever promise was yet resolved or not.
   **/
  this.__defineGetter__('resolved', function () { return !!fired; });


  // register done callback if it was specified in the constructor
  if (callback) {
    this.done(callback);
  }
};


Promise.Joint = require('./promise/joint');


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

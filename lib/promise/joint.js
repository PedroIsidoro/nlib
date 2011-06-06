/**
 *  class Promise.Joint
 *
 *  Provides way to guarntee that some particular code will be fired once all
 *  promises will become resolved.
 *
 *  ##### Example
 *
 *      var promise_all = new Promise(),
 *          promise_active = new Promise(),
 *          joint = new Promise.Joint();
 *
 *      User.find(function (err, rows) {
 *        promise_all.resolve(err, rows.length);
 *      });
 *
 *      User.find({active: true}, function (err, rows) {
 *        if (0 === rows.length) {
 *          joint.reject(Error('No active users? No way!'));
 *        }
 *
 *        promise_active.resolve(err, rows.length);
 *      });
 *
 *      // include promises
 *      joint.include(promise_all, promise_active);
 *
 *      // register callback when everything is done
 *      joint.done(function (err, result_all, result_active) {
 *        if (err) {
 *          // something went wrong
 *        }
 *
 *        var stats = {
 *          all: result_all[1],
 *          active: result_active[1]
 *        };
 *      });
 *
 *      // start waiting for joint to be resolved
 *      joint.wait();
 **/


var Promise = require('../promise');


/**
 *  new Promise.Joint([callback])
 *
 *  If `callback` was specified, it passed to [[Promise.Joint#done()]].
 **/
var Joint = module.exports = function Joint(callback) {
  // allow reate promise without new keyword
  if (!(this instanceof Joint)) {
    return new Joint(callback);
  }


  var self = this, // self-reference
      joint = new Promise(), // underlying promise resolved when all included are
      waiting = false, // tells whenever joint is awaiting included promise to be resolved
      count = 0, // amount of registered promises
      fired = 0, // amount of resolved promises
      results = {}, // results buffer for promises' results
      resolve; // resolves joint if necessary


  // helper for [[Promise.Joint#include()]]
  resolve = function resolve() {
    if (!joint.resolved && waiting && count === fired) {
      var args = [null], // add err
          i;

      // add r1, r2, ..., rN
      for (i = 0; i < count; i++) {
        args.push(results[i]);
      }

      // resolve joint with (err, r1, r2, ..., rN)
      joint.resolve.apply(joint, args);
    }
  };


  /**
   *  Promise.Joint#include([p1[, p2[, pN]]]) -> Promise.Joint
   *
   *  Includes given promises (any amount) into joint, so joint will be resolved
   *  only when all the included promises become resolved.
   *
   *  **WARNING** Throws `Error` if called after joint start waiting for
   *  promises resolution.
   *
   *  Returns joint itself for chaining purposes.
   *
   *  ##### Example
   *
   *      joint.include(promise_all, promise_active).include(promise_anything);
   *
   *  ##### See Also
   *
   *  - [[Promise.Joint#done()]]
   *  - [[Promise.Joint#wait()]]
   **/
  this.include = function include() {
    var i, l;

    if (waiting) {
      // TODO: log errors instead of throwing error?
      throw Error("Can't include new promise when joint start wainting");
    }

    for (i = 0, l = arguments.length; i < l; i++) {
      (function (p, n) {
        p.done(function () {
          fired++;
          results[n] = arguments;
          resolve();
        });
      })(arguments[i], count);

      // raise amount of registered promises
      count++;
    }

    return self;
  };


  /**
   *  Promise.Joint#done(callback) -> Promise.Joint
   *
   *  Fires `callback` when all included promises were resolved. Called with
   *  `err, r1, r2, ..., rN`, where `err` is an Error instance if joint ws
   *  rejected, r1 is an `arguments` object of first included promise, r2 is an
   *  `arguments` of second included promise and so on.
   *
   *  Results are passed in the order of promises inclusion. If we have
   *  included `p1`, then `p2`, then `r1` will be the result of `p1`, and `r2`
   *  will be the result of `p2`, even if `p2` will be resolved much more
   *  earlier than `p1`.
   *
   *  Returns joint itself for chaining purposes.
   *
   *  ##### Example
   *
   *      var p1 = Promise(),
   *          p2 = Promise(),
   *          joint = Promise.Joint();
   *
   *      p2.resolve(321);
   *      p1.resolve(123);
   *
   *      joint.include(p1, p2).wait().done(function (err, r1, r2) {
   *        if (err) {
   *          // joint was rejected by some reason
   *          // so r1 and r2 are undefined
   *        }
   *
   *        // we can access arguments of resolved promises:
   *        // r1[0] -> 123
   *        // r2[0] -> 321
   *      });
   *
   *  ##### See Also
   *
   *  - [[Promise.Joint#include()]]
   **/
  this.done = function done(callback) {
    joint.done(callback);
    return self;
  };


  /**
   *  Promise.Joint#wait() -> Promise.Joint
   *
   *  Close joint agreement (no more promises are allowed to be included) and
   *  start waiting while all included promises will become resolved.
   *
   *  Returns joint itself for chaining purposes.
   *
   *  ##### Example
   *
   *      joint.wait().done(function (err, r1, r2) {
   *        // ...
   *      });
   *
   *  ##### See Also
   *
   *  - [[Promise.Joint#include()]]
   **/
  this.wait = function wait() {
    waiting = true;
    resolve();
    return self;
  };


  /**
   *  Promise.Joint#reject(err) -> Void
   *
   *  Immediately terminate and resolve joint promise with `err`.
   *
   *  ##### Example
   *
   *      joint.reject(Error('OMG|WTF|BBQ'));
   *
   *      joint.done(function (err, r1, r2) {
   *        if (err) {
   *          // err is 'OMG|WTF|BBQ'
   *        }
   *
   *        // r1, r2, rN are undefined, as joint was rejected
   *      });
   **/
  this.reject = function reject(err) {
    if (!joint.resolved) {
      joint.resolve(err || Error('Rejected'));
    }
  };


  // register done callback if it was specified in the constructor
  if (callback) {
    this.done(callback);
  }
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

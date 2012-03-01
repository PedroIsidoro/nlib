/** internal
 *  class Permission.Test
 *
 *  Represents single group of tests, e.g.
 *
 *      // a AND b AND c OR d AND e
 *      Test(a).and(b).and(c).or(d).and(e);
 *
 *  You can pass `Test` objects into tests to get "groupings", e.g.:
 *
 *      // a AND ( b OR c AND d ) AND e
 *      var t = Test(b).or(c).and(d);
 *      Test(a).and(t).and(e);
 *
 *
 *  ##### Test Handlers
 *
 *  Each `Test` instance consist of _stacks_ of tests. Each `or` creates new
 *  stack and calls `and`. Each `and` pushes test to the latest stack. Each
 *  `test` handler is a simple function (or any object that responds to `call`
 *  method) that accepts only one argument `callback(err, result)` and being
 *  called within context of `env` object provided to the `call`.
 *
 *      var a = function (cb) {
 *            // I want foobar to be zero
 *            cb(null, 0 == this.foobar);
 *          },
 *          b = {
 *            call: function (env, cb) {
 *              // I want foobar to be odd
 *              cb(null, env.foobar % 2);
 *            }
 *          },
 *          t = Test(a).or(b);
 *      ////////////////////////////////////////////
 *      t.call({foobar: 0}, function (err, result) {
 *        // result === true
 *      });
 *      ////////////////////////////////////////////
 *      t.call({foobar: 1}, function (err, result) {
 *        // result === true
 *      });
 *      ////////////////////////////////////////////
 *      t.call({foobar: 2}, function (err, result) {
 *        // result === false
 *      });
 **/


'use strict';


// 3rd-party
var Async = require('async');
var _ = require('underscore');


// executes all `tests` (array of functions) within `env` context.
// fires `success` if ALL tests resulted in true and no error occured.
// fires `failure` if error during test attempt occured or if at least one of
// tests resulted into false.
var run_tests = function run_tests(env, tests, callback) {
  Async.map(tests, function (test, next) {
    test.call(env, next);
  }, function (err, results) {
    callback(err, !_.include(results, false));
  });
};


/**
 *  new Permission.Test([test])
 *  - test (Function): Test handler proxied to [[Permission.Test#and]]
 *
 *  Class constructor. Allows omit `new` keyword.
 **/
var Test = module.exports = function Test(test) {
  // allow omit `new` keyword
  if (!(this instanceof Test)) {
    return new Test(test);
  }

  // this.__.tests is an array of arrays. first level of depth represents OR,
  // second - AND. e.g.:[ [1,2], [4,5] ] => ( 1 AND 2 ) OR ( 4 AND 5 )
  this.__ = { tests: [[]], idx: 0 };

  // make test creation more sexy
  if (test) {
    this.and(test);
  }
};


/**
 *  Permission.Test#and(test) -> Permission.Test
 *  - test (Function): Test handler.
 *
 *  Adds `test` to the latest stack of tests.
 *
 *  ##### See Also
 *
 *  - _Test Handlers_ section of [[Permission.Test]]
 **/
Test.prototype.and = function and(test) {
  this.__.tests[this.__.idx].push(test);
  return this;
};


/**
 *  Permission.Test#or(test) -> Permission.Test
 *  - test (Function): Test handler.
 *
 *  Appends new stack of tests and adds `test` to it.
 *
 *  ##### See Also
 *
 *  - _Test Handlers_ section of [[Permission.Test]]
 **/
Test.prototype.or = function or(test) {
  this.__.tests.push([]); // add new ANDs stack
  this.__.idx += 1; // raise last stack index
  return this.and(test);
};


/**
 *  Permission.Test#call(env, callback) -> Void
 *  - env (Object): Context of tests execution
 *  - callback (Function): Fired after all tests finished with `(err, result)`,
 *    where `err` is an error if any, null otherwise and `result` is boolean.
 *
 *  ** NOTICE **
 *  This method was named `call` _specially_ to blur differences between
 *  functions and [[Test]] instance, it can be _executed_ same way. And when all
 *  attached test handlers (via [[Test#and]] | [[Test#or]]) are being processed,
 *  there would be no need in special checking if object is a function or not.
 *  So any object with `call` property can be used as test handler in fact.
 *
 *  Runs all tests and fires callback.
 **/
Test.prototype.call = function call(env, callback) {
  Async.map(this.__.tests, function (tests, next) {
    run_tests(env, tests, next);
  }, function (err, results) {
    callback(err, _.include(results, true));
  });
};

/**
 *  class Permission.Test
 **/


'use strict';


// 3rd-patry
var Promise = require('simple-promise');


// internal
var $$ = require('./utilities');


var run_tests = function run_tests(env, tests, success, failure) {
  var all_tests = new Promise.Joint();

  // start solvng each test
  tests.forEach(function (test) {
    var promise = all_tests.promise();

    test.call(env, function (err, result) {
      if (err) {
        all_tests.reject(err);
        return;
      }

      promise.resolve(result);
    });
  });
 
  // wait for all tests to complete
  all_tests.wait().done(function (err) {
    var i;

    if (err) {
      // raise up error
      failure(err);
      return;
    }

    for (i = 1; i < arguments.length; i++) {
      // if at least one test resolved as false - fail all tests
      if (!arguments[i][0]) {
        failure();
        return;
      }
    }

    // all tests resulted in true
    success();
  });
};


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


Test.prototype.and = function and(test) {
  this.__.tests[this.__.idx].push(test);
  return this;
};


This.prototype.or = function or(test) {
  this.__.tests.push([]); // add new ANDs stack
  this.__.idx++; // raise last stck index
  return this.and(test);
};


Test.prototype.call = function call(env, callback) {
  var stack = $$.reverse(this.__.tests),
      success = function () { callback(null, true); },
      failure = function () { callback(null, false); };

  // dynmically build waterfall of tests. first success stops it.
  $$.inject(stack, failure, function (next, curr) {
    return function (env) {
      run_tests(env, curr, success, function (err) {
        if (err) {
          callback(err);
          return;
        }

        // try next group.
        next(env);
      });
    };
  }).call(env);
};


// vim:ts=2:sw=2

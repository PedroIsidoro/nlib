/** belongs to: Application
 *  class Permission
 **/


'use strict';


// 3rd-party
var Promise = require('simple-promise');


// internal
var $$ = require('../utilities');



var find_fail_handler = function find_fail_handler(onFail) {
  return ['handler', 'redirect', 'forward'].select(function (k, v) {
    return undefined !== override[v];
  }).shift();
};


var merge_on_fail = function (generic, override) {
  var result = {message: override.message || generic.message || 'Access denied'},
      handler = null;

  if (handler = find_fail_handler(override)) {
    result[handler] = override[handler];
  } else if (handler = find_fail_handler(generic)) {
    result[handler] = generic[handler];
  }

  return result;
};


var handle_failure = function (onFail, req, res, next) {
  var handler = find_fail_handler(onFail),
      args = [];

  req.error = onFail.message || "Access denied";

  switch (handler) {
    case "forward":
      req.flash("error", req.error);
      req.forward(onFail[handler]);
      return;

    case "redirect":
      req.flash("error", req.error);
      if (Array.isArray(onFail[handler])) {
        args = [ onFail[handler][1], onFail[handler][0] || 302 ];
      } else {
        // redirect specified as a string. redirect 302
        args = [ onFail[handler], 302 ];
      }
      res.redirect.apply(res, args);
      return;

    case "handler":
      onFail[handler](req, res, next);
      return;

    default:
      next(Error(req.error));
  }
};


/**
 *  new Permission(settingsGetter[, onFail])
 *  - settingsGetter (Function): Handler that is used to get values of settings.
 *    Will be fired with `(key, env, callback)` and expects callback to receive
 *    arguments: `err, val, stirct`.
 *
 *  `onFail` is a hash with possible values:
 *    - forward (String): Forwards request to `controller#action`
 *    - redirect (String|Array): Redirects request to given URL with 302 code
 *      when String. Alternatively you can specify code and URL as an array:
 *      `[301, 'http://example.com']`
 *    - handler (Function): Custom handler function with `req, res, next` args.
 *    - message (String): Message to be written into flash-messanger stack.
 *
 *  When permission denied, and execution have to fall to generic error handler
 *  of permission (particular tests can override it), then following algorithm
 *  will be used:
 *
 *    - Assign `req.error` to `onFail.message`
 *    - Try error handlers (first one found):
 *      - `onFail.handler` pass execution to it and stop default route
 *      - `onFail.redirect` will redirect request and stop routing execution
 *      - `onFail.forward` will forward request to given action
 *    - Stop execution by call `next(Error(onFail.message))`
 **/
var Permission = module.exports = function Permission(settingsGetter, onFail) {
  // protected scope
  this.__ = {get: settingsGetter, onFail: (onFail || {}), tests: []};
}


/**
 *  Permission#filter -> Function
 *
 *  Handler, suitable to be used as before filter.
 *  Will run all attached tests and will either deny action or will
 *  pass execution to next filter/action.
 *
 *
 *  ##### See Also
 *
 *  - [[Permission#test]]
 **/
Permission.prototype.filter = function (req, res, next) {
  var self = this, // self-reference
      all_tests = new Promise.Joint(); // all tests passed

  // execute all tests
  this.__.tests.forEach(function (data) {
    var test_done = all_tests.promise(),
        strict_test = data[0],
        func = data[1],
        onFail = data[2];

    // run test handler
    func(req, function (err, val, strict_setting) {
      if (err) {
        all_done.reject(err);
        return;
      }

      // if test/setting is strict and value is false - deny access immidiately
      if ((strict_test || strict_setting) && !val) {
        handle_failure(merge_on_fail(self.__.onFail, onFail), req, res, next);
        return;
      }

      // otherwise delay decision for joint promise
      test_done.resolve(val);
    });
  });
 
  // when all tests passed, make final decision
  all_tests.wait().done(function (err) {
    var i;

    // joint was rejected
    if (err) {
      next(err);
      return;
    }

    for (i = 1; i < arguments.length; i++) {
      // `AND false` is handled by test (above)
      // if at least one of the results is true - allow action.
      // TODO: in order to support "groupings", this needs to be rewitten ???
      if (arguments[i][0]) {
        next();
        return;
      }
    }

    handle_failure(self.__.onFail, req, res, next);
  });
};


/**
 *  Permission#test(operation, condition[, onFail]) -> Permission
 *  - condition (String|Function):
 *  - onFail (Object): See [[Permission]] constructor for detailed info
 *
 *  Adds given test to the permission.
 *
 *
 *  ##### When `condition` is a Function
 *
 *  Will fire given function as `fn(req, callback)` upon permission check and
 *  will wait for `callback(err, result, strict)`, where `strict` is boolean
 *  true for `AND` boolean logic, false for `OR` and `result` is boolean.
 *
 *
 *  ##### When `condition` is a String
 *
 *  Will transform into a function that will check boolean setting with given
 *  name.
 **/
Permission.prototype.test = function test(operation, condition, onFail) {
  var self, func = condition;

  if ('function' !== typeof func) {
    self = this;
    func = function(req, callback) { self.__.get(condition, req, callback); };
  }

  this.__.tests.push(['AND' == operation, func, (onFail || {})]);
  return this;
};


// vim:ts=2:sw=2

/**
 *  class Permission
 *
 *  Represents single permission object. Each permission object consist of tests
 *  generlly functions, but mostly declared as a setting keys to check for.
 **/


'use strict';


// 3rd-party
var Promise = require('simple-promise');


// internal
var $$ = require('./utilities'),
    Test = require('./permission/test');



// finds fail handler (by priority)
var find_fail_handler = function find_fail_handler(onFail) {
  return $$.select(['handler', 'redirect', 'forward'], function (k, v) {
    return undefined !== override[v];
  }).shift();
};


// prepares merged onFail object.
// tries to find handler of `override` so in case it will override generic's
// despite it's priority
var merge_on_fail = function (generic, override) {
  var result = {message: override.message || generic.message};

  if (handler = find_fail_handler(override)) {
    result[handler] = override[handler];
  } else if (handler = find_fail_handler(generic)) {
    result[handler] = generic[handler];
  }

  return result;
};


// serves failure event regarding to the onFail definition
var handle_failure = function (onFail, req, res, next) {
  var handler = find_fail_handler(onFail);

  req.error = onFail.message || "DENIED";

  switch (handler) {
    case "forward":
      req.flash("error", req.error);
      req.forward(onFail[handler]);
      return;

    case "redirect":
      var code = 302, url;

      if (!Array.isArray(onFail[handler])) {
        url = onFail[handler];
      } else {
        code = onFail[handler][1] || code;
        url = onFail[handler][1];
      }

      req.flash("error", req.error);
      res.redirect(url, code);
      return;

    case "handler":
      onFail[handler](req, res, next);
      return;

    default:
      next(Error(req.error));
  }
};


// returns function suitale for test instance that returns result of
// setting (e.g. can_propose_translation)
var build_setting_test = function build_setting_test(setting) {
  var get = this.__.getter;
  return (function (callback) {
    get(setting, this, callback);
  });
};


// builds Test instance from the string.
// TODO:  replace with normal tokenizer and walker
//        current possible bugs:
//          foo AND () OR bar' will fail
//          foo AND( bar OR boo ) OR have
//
//          no space between tokens `()` and `AND(` will cause parse failure
var build_condition = function build_condition(condition) {
  var test = new Test()
      parts = condition.replace(/^\(|\)$/, '').replace(/\s+/g, ' ').split(' '),
      token = null,
      positive = true,
      operation = 'and',
      func = null,
      inner = '',
      depth = 0;

  // walk through all parts
  while (token = parts.shift()) {
    switch (token.toUpperCase()) {
      case '&&':
      case 'AND':
        operation = 'and';
        break;

      case '||':
      case 'OR':
        operation = 'or';
        break;

      case 'NOT':
        positive = false;
        break;

      default:
        if ('(' != token[0]) {
          // process setting string, e.g. can_propose_translation
          func = build_setting_test.call(this, token)
        } else {
          // process inner group, e.g, ( foo AND ( bar OR baz ) )
          depth = 1;
          inner = token;

          while (token && 0 < depth) {
            token = parts.shift();
            if ('(' == token[0]) { depth++; }
            if (')' == token[token.length - 1]) { depth--; }
            inner += token;
          }

          func = build_condition.call(this, inner);
        }

        if (positive) {
          // add positive test
          test[operation](func);
        } else {
          // add negative test
          test[operation](function (callback) {
            func.call(this, function (err, result) {
              callback(err, !result);
            });
          });
        }

        // reset
        operation = 'and';
        positive = true;
        func = null;
        inner = '',
        depth = 0;
    }
  }

  return test;
};


// functon that will be used if no getter specified
var default_getter = function (key, env, callback) {
  callback(Error("No settings getter provided"));
};


/**
 *  new Permission(settingsGetter[, onFail])
 *  - settingsGetter (Function): Handler that is used to get values of settings.
 *    Will be fired with `(key, env, callback)` and expects callback to receive
 *    arguments: `err, val, stirct`.
 *
 *  ** TODO: DESCRIPTION IS OBSOLETE NEEDS REVIEW **
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
var Permission = module.exports = function Permission(getter, onFail) {
  // protected scope
  this.__ = {
    getter: (getter || default_getter),
    onFail: (onFail || {}),
    tests: []
  };
}


/**
 *  Permission#filter -> Function
 *
 *  Handler, suitable to be used as before filter of the controller.
 *  Will run all attached tests and will either deny action or will
 *  pass execution to next filter/action.
 *
 *
 *  ##### See Also
 *
 *  - [[Permission#test]]
 **/
Permission.prototype.filter = function permission_filter(req, res, next) {
  // loop through all OR tests check whenever at lest one is true
  // then loop through AND test and check for all of them being true
  // if all fine - next(), otherwise handle_failure()
  next(Error("Not implemented yet"));
};


/**
 *  Permission#test(operation, condition[, onFail]) -> Permission
 *  - condition (String|Function):
 *  - onFail (Object): See [[Permission]] constructor for detailed info
 *
 *  ** TODO: DESCRIPTION IS OBSOLETE NEEDS REVIEW **
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
  // fix operation name
  operation = ('AND' == operation.toUpperCase()) ? 'AND' : 'OR';

  if ('function' !== typeof func) {
    condition = build_test.call(this, condition);
  }

  this.__.tests.push(operation, condition, (onFail || {}));
  return this;
};


/**
 *  Permission#and(condition, onFail) -> Permission
 *
 *  Syntax sugar. Shortcut for `test('AND', condition, onFail)`.
 *
 *  ##### See Also
 *
 *  - [[Permission#test]]
 **/
Permission.prototype.and = function and(condition, onFail) {
  return this.test('AND', condition, onFail);
};


/**
 *  Permission#or(condition, onFail) -> Permission
 *
 *  Syntax sugar. Shortcut for `test('OR', condition, onFail)`.
 *
 *  ##### See Also
 *
 *  - [[Permission#test]]
 **/
Permission.prototype.or = function or(condition, onFail) {
  return this.test('OR', condition, onFail);
};


// vim:ts=2:sw=2

/**
 *  class Permission
 *
 *  Represents single permission object. Each permission object consist of
 *
 *  - custom test functions
 *  - tests of settings
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
      req.flash("error", req.error);
      res.redirect(onFail[handler], 302);
      return;

    case "handler":
      onFail[handler](req, res, next);
      return;

    default:
      next(Error(req.error));
  }
};


// builds Test instance from the string.
// TODO:  replace with normal tokenizer and walker
//        current possible bugs:
//          foo AND () OR bar' will fail
//          foo AND( bar OR boo ) OR have
//
//          no space between tokens `()` and `AND(` will cause parse failure
var build_condition = function build_condition(condition) {
  var self = this,
      test = new Test()
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
          func = (function (callback) {
            self.__.getter(token, this, callback);
          });
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
 *  new Permission(getter[, onFail])
 *  - getter (Function): Handler that is used to get values of settings.
 *  - onFail (Object): Definition of action in case of permission denied.
 *
 *  ##### Settings Getter
 *
 *  Getter is supposed to be a function with three arguments:
 *
 *      `getter(key, env, callback)`
 *
 *  And it's callback supposed to be fired as `callback(err, value)`, thus it
 *  should be suitable to be used as test callback for the [[Permission.Test]].
 *
 *  ##### Handling Failures
 *
 *  Failures are handled by schema defined in `onFail`. This object may contain
 *  following keys:
 *
 *    - forward (String): Forwards request to `controller#action`
 *    - redirect (String): Redirects request to given URL with 302 code
 *    - handler (Function): Custom handler function with `req, res, next` args.
 *    - message (String): Message to be written into flash-messanger stack.
 *
 *  When permission denied, then following algorithm will be used:
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
 *  Adds test with given `operation`. You can override message and/or handler of
 *  the generic `onFail` (given in the constructor).
 *
 *
 *  ##### When `condition` is a Function
 *
 *  Instance of [[Permission.Test]] will be created with this function.
 *
 *
 *  ##### When `condition` is a String
 *
 *  Will parse given string and create [[Permission.Test]] instance filled with
 *  tests of given settings. You can use `AND` or `&&` and `OR` or `||` for
 *  alternatives. You can use `NOT` for negative test. You can use `()` brackets
 *  for grouping tests.
 *
 *      is_translator_moderator OR ( can_propose_translation AND NOT banned )
 *
 *
 *  ##### See Also
 *
 *  - [[Permission.Test]]
 **/
Permission.prototype.test = function test(operation, condition, onFail) {
  operation = ('AND' == operation.toUpperCase()) ? 'AND' : 'OR';
  condition = ('function' === typeof condition)
            ? new Test(condition)
            : build_test.call(this, condition);

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


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

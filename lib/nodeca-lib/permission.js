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
var _ = require('underscore');


// internal
var $$ = require('./utilities'),
    Test = require('./permission/test');


// list of possible handler names
var on_fail_handlers = _(['handler', 'redirect', 'forward']);


// finds fail handler (by priority)
var find_fail_handler = function find_fail_handler(onFail) {
  return on_fail_handlers.detect(function (k, v) { return !!onFail[v]; });
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


// runs all given tests and returns _(array) of objects each object is
// either `{ok: true}` or `{fail: onFailDecaration}`
var run_tests = function run_tests(arr, env, callback) {
  var results = [],
      waterfall = $$.waterall();

  arr.forEach(function (test) {
    waterfall.queue(function (next) {
      test.handler.call(env, function (err, result) {
        results.push(!!result ? {ok: true} : {faile: test.onFail});
        next(err);
      });
    });
  });

  waterfall.run(function (err) {
    callback(err, _(results));
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
  var self = this,
      test = new Test(),
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
            self.__.app.settings.get(token, this, callback);
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


/**
 *  new Permission(app[, onFail])
 *  - app (Application): Instance of application
 *  - onFail (Object): Definition of action in case of permission denied.
 *
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
var Permission = module.exports = function Permission(app, onFail) {
  // protected scope
  this.__ = {
    app: app,
    onFail: (onFail || {}),
    tests: {OR: [], AND: []}
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
  var self = this;

  if (0 === this.__.tests.OR.length && 0 === this.__.tests.AND.length) {
    next(Error("Permission has no tests defined."));
    return;
  }

  // we don't care about if OR stack is empty, because we don't care about
  // strict trues. e.g. if we have `OR = []` and `AND = [{value: true}]`
  // that should result in false. so assume result is false untl we find at
  // least one OR test resulted into true

  run_tests(self.__.tests.OR, function (err, results) {
    // none of OR tests resulted in success
    if (!results.any(function (r) { return r.ok; })) {
      handle_failure(self.__.onFail, req, res, next);
      return;
    }

    // try AND tests
    run_tests(self.__.tests.AND, function (err, results) {
      // find first failure in results
      var r = results.detect(function (r) { return !r.ok });

      // at lest one of the tests resulted in failure
      if (r) {
        handle_failure(merge_on_fail(self.__.onFail, r.fail), req, res, next);
        return;
      }

      next();
    });
  });
};


/**
 *  Permission#addTest(operation, condition[, onFail]) -> Permission
 *  - condition (String|Function):
 *  - onFail (Object): See [[Permission]] constructor for detailed info
 *
 *  Adds test with given `operation`. You can override message and/or handler of
 *  the generic `onFail` (given in the constructor).
 *
 *
 *  ** NOTICE **
 *  `onFail` will be _ignored_ when `operation` is `OR`.
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
Permission.prototype.addTest = function addTest(operation, condition, onFail) {
  operation = ('AND' == operation.toUpperCase()) ? 'AND' : 'OR';
  condition = ('function' === typeof condition)
            ? new Test(condition)
            : build_condition.call(this, condition);
  onFail    = onFail || {};

  this.__.tests[operation].push({handler: condition, onFail: onFail});
  return this;
};


/**
 *  Permission#test(condition, onFail) -> Permission
 *  Permission#and(condition, onFail) -> Permission
 *
 *  Syntax sugar. Shortcut for `test('AND', condition, onFail)`.
 *
 *  ##### See Also
 *
 *  - [[Permission#addTest]]
 **/
Permission.prototype.test =
Permission.prototype.and = function and(condition, onFail) {
  return this.addTest('AND', condition, onFail);
};


/**
 *  Permission#or(condition) -> Permission
 *
 *  Syntax sugar. Shortcut for `test('OR', condition, null)`.
 *
 *  ##### See Also
 *
 *  - [[Permission#addTest]]
 **/
Permission.prototype.or = function or(condition) {
  return this.addTest('OR', condition, null);
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

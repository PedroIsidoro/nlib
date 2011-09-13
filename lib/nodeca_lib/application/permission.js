/**
 *  class Permission
 **/


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
var Permission = function Permission(settings, onFail) {
  throw Error("Not implemented yet");
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
  next(Error("Not implemented yet"));  
};


/**
 *  Permission#test(opeation, condition[, onFail]) -> Permission
 *  - operation (String): `AND`|`OR`
 *  - condition (String|Function):
 *  - onFail (Object): See [[Permission]] constructor for detailed info
 *
 *  Adds given test to the permission.
 *
 *
 *  ##### When `condition` is a Function
 *
 *  Will fire given function as `fn(req, callback)` upon permission check and
 *  will wait for `callback(operation, result)`, where `operation` is `AND` or
 *  `OR` and `result` is boolean.
 *
 *
 *  ##### When `condition` is a String
 *
 *  Will transform into a function that will check boolean setting with given
 *  name.
 **/
Permission.prototype.test = function test(operation, condition, onFail) {
  throw Error("Not implemented yet");
};


// vim:ts=2:sw=2

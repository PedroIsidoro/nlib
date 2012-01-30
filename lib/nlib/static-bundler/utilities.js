/** internal
 *  Utilities
 **/

'use strict';


// stdlib
var path = require('path'),
    fs = require('fs');


// 3rd party
var _ = require('underscore');


var $$ = module.exports = {};


// ensures iterator has being successfully called on all elements
$$.sequence = function sequence(arr, iterator, callback) {
  var arr_copy = _.clone(arr), walk_on;

  walk_on = function () {
    var el = arr_copy.shift();

    // one more time
    if (el) {
      iterator(el, function (err) {
        if (err) {
          callback(err);
          return;
        }

        walk_on();
      });
      return;
    }

    // final lap
    callback();
  };

  walk_on();
};


// returns new buffer with contents of a and b
var merge_buffers = function merge_buffers(a, b) {
  var result = new Buffer(a.length + b.length);

  a.copy(result, 0);
  b.copy(result, a.length);

  return result;
};


/**
 *  Utilities.mergeBuffers(buf1, buf2[, bufN]) -> Buffer
 *
 *  Returns new `Buffer` with contents of all given bufers merged together.
 *
 *  **NOTICE** that _raw_ contents is merged:
 *
 *      var a = new Buffer(4), b = new Buffer(3);
 *      a.write('abc');
 *      b.write('def');
 *
 *      Utilities.mergeBuffers(a, b).toString();
 *      // -> 'abc\u0000def'
 *
 *  ##### Throws Error
 *
 *  - When at least one of arguments is not Buffer
 **/
$$.mergeBuffers = function mergeBuffers() {
  var result = new Buffer(0), i, l;

  for (i = 0, l = arguments.length; i < l; i += 1) {
    if (!Buffer.isBuffer(arguments[i])) {
      throw new Error("Cannot merge non-Buffer");
    }

    result = merge_buffers(result, arguments[i]);
  }

  return result;
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

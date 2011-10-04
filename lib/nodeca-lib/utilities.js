/**
 *  class Utilities
 *
 *  Collection of helper functions used by nodeca-lib and apps.
 **/


'use strict';


// stdlib
var fs = require('fs');


// 3rd-party
var yaml = require('yaml');


// self-namespace
var Utilities = exports = module.exports = {};


var warn = function (err) { console.error('WARN: ' + err.toString()); };

/**
 *  Utilities.readYaml(file, callback) -> void
 *
 *  Reads and parses given file as YAML.
 *  Fires `callback(err, obj)` when finished.
 *
 *  **NOTICE** File should be UTF-8 encoded.
 **/
Utilities.readYaml = function readYaml(file, callback) {
  fs.readFile(file, 'utf-8', function (err, str) {
    var result, error;

    if (err) {
      callback(err);
      return;
    }

    try { result = yaml.eval(str); }
    catch (err) { error = err; }

    callback(err, result);
  });
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
Utilities.mergeBuffers = function mergeBuffers() {
  var result = new Buffer(0), i, l;

  for (i = 0, l = arguments.length; i < l; i++) {
    if (!Buffer.isBuffer(arguments[i])) {
      throw Error("Cannot merge non-Buffer");
    }

    result = merge_buffers(result, arguments[i]);
  }

  return result;
};


/**
 *  Utilities.patchBuffers(original, patch1[, patch2[, patchN]]) -> Buffer
 *  
 *  Applies `patch`es to `original` buffer. Each `patch` should be a Buffer with
 *  unified patch, e.g.:
 *
 *      @@ -1,3 +1,3 @@
 *       123
 *      -455
 *      +456
 *       789
 *
 *  Patches are applied from left to right (first `patch1`, then `patch2`, and
 *  so on). Each patch (except first one) is applied on the result of patching
 *  with previous one.
 **/
Utilities.patchBuffers = function patchBuffers(original) {
  // not implemented yet
  warn(Error('Utilities.patchBuffers not implemented yet'));
  return original || new Buffer(0);
};


// TODO: Utilities.waterfall needs documentation
Utilities.waterfall = function waterfall(context) {
  var handlers_queue = [],
      walk_on,
      final;

  // allow pass no context
  context = context || {};

  walk_on = function () {
    var handler = handlers_queue.shift();

    // all stages done
    if (!handler) {
      final();
      return;
    }

    handler(function (err) {
      if (err) {
        final(err);
        return;
      }

      walk_on();
    });
  };

  return {
    queue: function queue(handler) {
      handlers_queue.push(handler.bind(context));
      return this;
    },
    run: function run(callback) {
      final = callback.bind(context);
      walk_on();
    }
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

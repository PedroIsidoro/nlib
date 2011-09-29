/**
 *  class Utilities
 *
 *  Collection of helper functions used by nodeca-lib and apps.
 **/


'use strict';


// TODO: CHANGE `each` signature - it should be ruby  each_with_index` alike,
//       so it will be mapped directly on `forEach` for Arrays and will create
//       a wrapper for Objects only


// stdlib
var fs = require('fs');


// 3rd-party
var _ = require('.').Underscore,
    yaml = require('yaml');


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

//// DEPRECATED METHODS ////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

Utilities.deepMerge = function deprecated_deepMerge() {
  warn(Error("deepMerge is deprecated use nodeca._.extend()"));
  return _.extend.apply(_, arguments);
};

Utilities.merge = function deprecated_merge() {
  warn(Error("merge is deprecated use nodeca._.extend()"));
  return _.extend.apply(_, arguments);
};

Utilities.grab = function deprecated_grab() {
  warn(Error("grab will be deprecated soon. Consider using nodeca._.delete()"));
  return _.delete.apply(_, arguments);
};

Utilities.each = function deprecated_each(obj, cb) {
  warn(Error("each is deprecated use nodeca._.each(). IT'S INCOMPATIBLE"));
  return _.each(obj, function (val, key) { return cb(key, val); }); 
};


Utilities.values = function deprecated_values(obj) {
  warn(Error("values is deprecated use nodeca._.values()"));
  return _.values(obj);
};


Utilities.camelCase = function deprecated_camelCase(str) {
  warn(Error("camelCase is deprecated use nodeca._.camelize(). IT'S INCOMPATIBLE"));
  return _.camelize(str);
};


Utilities.splitCamelCase = function deprecated_splitCamelCase(str) {
  warn(Error("splitCamelCase is deprecated use nodeca._.uncamelize()"));
  return _.uncamelize(str);
};


Utilities.parameterize = function deprecated_parameterize(str) {
  warn(Error("parameterize is deprecated use nodeca._.dasherized(). IT'S INCOMPATIBLE"));
  return _(str).underscored().replace('_', '-');
};


Utilities.select = function deprecated_select(data, callback) {
  if ('function' !== typeof callback) {
    return Utilities.select(data, function (v) {
      return (v == callback);
    });
  }

  warn(Error("select is deprecated use nodeca._.select(). IT'S INCOMPATIBLE"));
  return _.select(data, callback);
};


Utilities.reject = function deprecated_reject(data, callback) {
  if ('function' === typeof callback) {
    return Utilities.reject(data, function (v, k) {
      return (v == callback);
    });
  }

  warn(Error("reject is deprecated use nodeca._.reject(). IT'S INCOMPATIBLE"));
  return _.reject(data, callback);
};


Utilities.includes = function deprecated_includes(arr, val) {
  warn(Error("includes is deprecated use nodeca._.include()"));
  return _.include.apply(_, arguments);
};


Utilities.map = function map(data, callback) {
  warn(Error("map is deprecated use nodeca._.map(). IT'S INCOMPATIBLE"));
  return _.map.apply(_, arguments);
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

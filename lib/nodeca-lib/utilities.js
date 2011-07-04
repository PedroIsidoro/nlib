/**
 *  class Utilities
 *
 *  Collection of helper functions used by nodeca-lib and apps.
 **/


'use strict';


var os = require('os'),
    fs = require('fs'),
    path = require('path'),
    yaml = require('yaml');


var Utilities = exports = module.exports = {};


// checks whenever argument is an object and not (instanceof) an array
var is_hash = function is_hash(o) {
  return ('object' === typeof o) && !Array.isArray(o);
};


// Deeply merges properties of object b into object a
var deep_merge = function deep_merge(a, b) {
  Object.getOwnPropertyNames(b || {}).forEach(function (prop) {
    // prevent from cyclic loops (when both sides are same circular reference)
    if (a[prop] === b[prop]) {
      return;
    }

    // deep merge objects and override any other types
    if (is_hash(b[prop]) && is_hash(a[prop])) {
      deep_merge(a[prop], b[prop]);
    } else {
      var descriptor = Object.getOwnPropertyDescriptor(b, prop);
      Object.defineProperty(a, prop, descriptor);
    }
  });
};


/**
 *  Utilities.deepMerge(receiver[, t1[, t2[, tN]]]) -> Object
 *  
 *  Deeply (recursively) merges properties of `transmitter(s)` into `receiver`:
 *
 *  - Values of `transmitter(s)` overrides `receiver`'s
 *  - Objects are recursively merged
 *  - Transmitters are merged from left to right
 *
 *  ##### See Also
 *
 *  - [[Utilities.merge]]
 **/
Utilities.deepMerge = function deepMerge(receiver) {
  var i, l, transmitter;

  for (i = 1, l = arguments.length; i < l; i++) {
    deep_merge(receiver, arguments[i]);
  }

  return receiver;
};


// Merges properties of object b into object a
var straight_merge = function straight_merge(a, b) {
  Object.getOwnPropertyNames(b || {}).forEach(function (prop) {
    var descriptor = Object.getOwnPropertyDescriptor(b, prop);
    Object.defineProperty(a, prop, descriptor);
  });
};


/**
 *  Utilities.merge(receiver[, t1[, t2[, tN]]]) -> Object
 *  
 *  Merges properties of `transmitter(s)` into `receiver`:
 *
 *  - Values of `transmitter(s)` overrides `receiver`'s
 *  - Transmitters are merged from left to right
 *
 *  ##### See Also
 *
 *  - [[Utilities.deepMerge]]
 **/
Utilities.merge = function merge(receiver) {
  var i, l, transmitter;

  for (i = 1, l = arguments.length; i < l; i++) {
    straight_merge(receiver, arguments[i]);
  }

  return receiver;
};


/**
 *  Utilities.grab(obj, key) -> Mixed
 *
 *  Removes given key from object and returns value of removed key, similar to
 *  Ruby's `Object#delete`.
 *
 *  ##### Example
 *
 *      var obj = { k1: 'abc', k2: 'def' };
 *      var k1  = Utilities.grab(obj, 'k1');
 *
 *      inspect(k1);
 *      // -> 'abc'
 *
 *      inspect(obj);
 *      // -> { k2: 'def' }
 **/
Utilities.grab = function grab(obj, key) {
  var val = obj[key];
  delete obj[key];
  return val;
};


/**
 *  Utilities.readYamlSync(file, silent) -> Object|Null
 *
 *  Reads and parses given file as YAML. Returns `NULL` on any error
 *  instead of throwing them if `silent`.
 *
 *  **NOTICE** File should be UTF-8 encoded.
 **/
Utilities.readYamlSync = function readYamlSync(file, silent) {
  try {
    return yaml.eval(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    if (silent) {
      return null;
    }

    throw err;
  }
};


// iterates array until the end of array, or false returned by callback
var iterate_array = function iterate_array(arr, callback) {
  var i, l;

  for (i = 0, l = arr.length; i < l; i++) {
    if (false === callback(i, arr[i])) {
      return;
    }
  }
};


// wrapper over iterate_array() to iterate through object
var iterate_object = function iterate_object(obj, callback) {
  iterate_array(Object.getOwnPropertyNames(obj), function (i, k) {
    return callback(k, obj[k]);
  });
};



/**
 *  Utilities.each(hash, callback) -> Void
 *  - hash (Array|Object): array or hash of key-value pairs to iterate through.
 *  - callback (Function): fired on each element of `arr` with `i, val, next`
 *    when `hash` is an array and `key, val, next` if object.
 *
 *  Provides common interface for iterating `hash` firing `callback` on each
 *  element. You can interrupt iterator by returning boolean false.
 *
 *  Returns boolen false if `hash` was neither `Object` nor `Array`, boolean
 *  true if it was.
 *
 *  **NOTICE** When `hash` is an object, then iterator will iterate through own
 *  properties only.
 *
 *  **WARNING** `callback` is fired with `indexOfElement, elementValue`
 *  arguments  just like in  [jQuery.each](http://api.jquery.com/jQuery.each/).
 *  In comparison, V8 native `Array#forEach` method fires callback with
 *  opposite order of arguments.
 *
 *  ##### Example: Iterating array
 *
 *      Utilities.each(['a', 'b', 'c'], function (idx, val) {
 *        console.log(idx + ' => ' + val);
 *      });
 *      // -> 0 => a
 *      // -> 1 => b
 *      // -> 2 => c
 *
 *  ##### Example: Iterating object
 *
 *      Utilities.each({a: 1, b:2, c:3}, function (key, val) {
 *        console.log(key + ' => ' + val);
 *      });
 *      // -> a => 1
 *      // -> b => 2
 *      // -> c => 3
 *
 *  ##### Example: Interrupt iterator
 *
 *      Utilities.each(['a', 'b', 'c'], function (idx, val) {
 *        if (1 == idx) {
 *          return false;
 *        }
 *
 *        console.log(idx + ' => ' + val);
 *      });
 *      // -> 0 => a
 **/
Utilities.each = function each(hash, callback) {
  if (Array.isArray(hash)) {
    iterate_array(hash, callback);
    return true;
  }

  if ('object' === typeof hash) {
    iterate_object(hash, callback);
    return true;
  }

  // hash is not iteratable
  return false;
};


/**
 *  Utilities.values(obj) -> Array
 *  - obj (Object): Object to get all values from
 *
 *  Retreives values of all own properties of `obj`.
 *
 *  ##### See Also
 *
 *  - [[Utilities.each]]
 **/
Utilities.values = function values(obj) {
  var arr = [];

  Utilities.each(obj, function(key, val) {
    arr.push(val);
  });

  return arr;
};


/**
 *  Utilities.camelCase(str) -> String
 *  - str (String): string to becom CamelCase
 *
 *  Returns CamelCased string, e.g. "Foo Bar" will become "FooBar".
 *
 *  ##### See Also
 *
 *  - [[Utilities.splitCamelCase]]
 **/
Utilities.camelCase = function camelCase(str) {
  return str.replace(/\s+(.)/g, function (m, c) {
    return c.toUpperCase();
  });
};


/**
 *  Utilities.splitCamelCase(str) -> String
 *  - str (String): CamelCase'd string
 *
 *  Returns string splitted by the borders of words, e.g. "FooBar" will become
 *  "Foo Bar".
 *
 *  ##### See Also
 *
 *  - [[Utilities.camelCase]]
 **/
Utilities.splitCamelCase = function splitCamelCase(str) {
  // RegExps are copy-pasted from RoR's ActiveSupport
  return str.replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2')
            .replace(/([a-z\d])([A-Z])/g,'$1 $2');
};


/**
 *  HooksManager.parameterize(str) -> String
 *
 *  Returns lower-cased words dash-separted `str`.
 *
 *  ##### Example
 *
 *      Utilities.parameterize('FooBar'); // -> 'foo-bar'
 **/
Utilities.parameterize = function parameterize(str) {
  return $$.splitCamelCase(str).replace(/[ _]+/g, '-').toLowerCase();
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


// Generates unique filename, or at least tries to...
// make_tmpname('foobar') -> 'foobar-nodeca-1309786066779-167870464-0'
var make_tmpname = function make_tmpname(prefix, n) {
  prefix = prefix ? (prefix + '-') : '';
  return prefix + 'nodeca-' + Date.now() + '-' + os.freemem() + '-' + (+n);
};


/**
 *  Utilities.tmpFilename([prefix = ""]) -> String
 *  - prefix (String): Optional prefix of filename
 **/
Utilities.tmpFilename = function tmpFilename(prefix) {
  var n = 0, file;

  do { file = '/tmp/' + make_tmpname(prefix, n++); }
  while (path.existsSync(file) && n < 10);

  if (path.existsSync(file)) {
    throw Error("Can't create unique filename. Last attempt was: " + file);
  }

  return file;
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
  // Not implemented yet
  return new Buffer(0);
};


Utilities.filewalker = require('./utilities/filewalker');


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

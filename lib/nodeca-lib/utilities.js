/**
 *  class Utilities
 *
 *  Collection of helper functions used by nodeca-lib and apps.
 **/


var fs = require('fs'),
    yaml = require('yaml');


var Utilities = exports = module.exports = {};


// Merges properties of object b into object a
var deep_merge = function deep_merge(a, b) {
  Object.getOwnPropertyNames(b || {}).forEach(function (prop) {
    // prevent from cyclic loops
    if (a[prop] === b[prop]) {
      return;
    }

    // deep merge objects and override any other types
    if ('object' == typeof b[prop] && 'object' === typeof a[prop]) {
      deep_merge(a[prop], b[prop]);
    } else {
      a[prop] = b[prop];
    }
  });
};


/**
 *  Utilities.deepMerge(receiver[, t1[, t2[, tN]]]) -> Object
 *  
 *  Merges properties of `transmitter(s)` into `receiver`:
 *  - Values of `transmitter(s)` overrides `receiver`'s
 *  - Objects are recursively merged
 *  - Transmitters are merged from left to right
 **/
Utilities.deepMerge = function deepMerge(receiver) {
  var i, l, transmitter;

  for (i = 1, l = arguments.length; i < l; i++) {
    deep_merge(receiver, arguments[i]);
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



// creates parser wrappers for given format with underlying parser
// - read<Format>
// - read<Format>Sync
// - parse<Format>
// - parse<Format>Sync
var create_parsers = function create_parsers(format, parser) {
  // format -> Format
  format = format[0].toUpperCase() + format.slice(1).toLowerCase();

  // parseFormat
  var parse = Utilities['parse' + format] = function parse(str, callback) {
    process.nextTick(function parsing() {
      try {
        callback(null, parser(str));
      } catch (err) {
        callback(err);
      }
    });
  };

  // parseFormatSync
  var parseSync = Utilities['parse' + format + 'Sync'] = function parseSync(str, silent) {
    try {
      return parser(str);
    } catch (err) {
      if (silent) {
        return null;
      }

      throw err;
    }
  };

  // readFormat
  Utilities['read' + format] = function readAndParse(file, callback) {
    fs.readFile(file, 'utf-8', function reading(err, str) {
      if (err) {
        callback(err);
        return;
      }

      parse(str, callback);
    });
  };

  // readFormatSync
  Utilities['read' + format + 'Sync'] = function readAndParseSync(file, silent) {
    try {
      return parseSync(fs.readFileSync(file, 'utf-8'));
    } catch (err) {
      if (silent) {
        return null;
      }

      throw err;
    }
  };
};


/**
 *  Utilities.parseYaml(str, callback) -> Void
 *
 *  Safely parses given YAML `str` and fires callback with `err, obj`.
 **/

/**
 *  Utilities.parseYamlSync(str, silent) -> Object|Null
 *
 *  Synchronous version of [[Utilities.parseYaml]]. Returns `NULL` on any error
 *  instead of throwing exception if `silent`.
 **/

/**
 *  Utilities.readYaml(file, callback) -> Void
 *
 *  Reads and parses given file as YAML. Then fires callback with `err, obj`.
 *
 *  **NOTICE** File should be UTF-8 encoded.
 **/

/**
 *  Utilities.readYamlSync(file, silent) -> Object|Null
 *
 *  Synchronous version of [[Utilities.readYaml]]. Returns `NULL` on any error
 *  instead of throwing exception if `silent`.
 *
 *  **NOTICE** File should be UTF-8 encoded.
 **/
create_parsers('yaml', yaml.eval);


/**
 *  Utilities.parseJson(str, callback) -> Void
 *
 *  Safely parses given JSON `str` and fires callback with `err, obj`.
 **/

/**
 *  Utilities.parseJsonSync(str, silent) -> Object|Null
 *
 *  Synchronous version of [[Utilities.parseJson]]. Returns `NULL` on any error
 *  instead of throwing exception if `silent`.
 **/

/**
 *  Utilities.readJson(file, callback) -> Void
 *
 *  Reads and parses given file as JSON. Then fires callback with `err, obj`.
 *
 *  **NOTICE** File should be UTF-8 encoded.
 **/

/**
 *  Utilities.readJsonSync(file, silent) -> Object|Null
 *
 *  Synchronous version of [[Utilities.readJson]]. Returns `NULL` on any error
 *  instead of throwing exception if `silent`.
 *
 *  **NOTICE** File should be UTF-8 encoded.
 **/
create_parsers('json', JSON.parse);


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
 *  **WARNING** `callback` is fired with `indexOfElement, elementValue`
 *  arguments  just like in  [jQuery.each](http://api.jquery.com/jQuery.each/).
 *  In comparison, V8 native `Array#forEach` method fires callback with
 *  opposite order of arguments.
 *
 *  ##### Example: Iterating array
 *
 *      Utilities.iterate(['a', 'b', 'c'], function (idx, val) {
 *        console.log(idx + ' => ' + val);
 *      });
 *      // -> 0 => a
 *      // -> 1 => b
 *      // -> 2 => c
 *
 *  ##### Example: Iterating object
 *
 *      Utilities.iterate({a: 1, b:2, c:3}, function (key, val) {
 *        console.log(key + ' => ' + val);
 *      });
 *      // -> a => 1
 *      // -> b => 2
 *      // -> c => 3
 *
 *  ##### Example: Interrupt iterator
 *
 *      Utilities.iterate(['a', 'b', 'c'], function (idx, val) {
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


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

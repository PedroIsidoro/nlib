/**
 *  class Utilities
 *
 *  Collection of helper functions used by nodeca-lib and apps.
 **/


var fs = require('fs'),
    yaml = require('yaml');


var Utilities = exports = module.exports = {};


/**
 *  Utilities.deepMerge(receiver, transmitter) -> Objcet
 *  
 *  Merges properties of `transmitter` into `receiver`:
 *  - Values of `transmitter` overrides `receiver`'s
 *  - Objects are recursively merged
 **/
Utilities.deepMerge = function deepMerge(a, b) {
  Object.getOwnPropertyNames(b || {}).forEach(function (prop) {
    // prevent from cyclic loops
    if (a[prop] === b[prop]) {
      return;
    }

    // deep merge objects and override any other types
    if ('object' == typeof b[prop] && 'object' === typeof a[prop]) {
      Utilities.deepMerge(a[prop], b[prop]);
    } else {
      a[prop] = b[prop];
    }
  });

  return a;
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
 *  Utilities.readYamlSync(file, silent) -> Void
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
 *  Utilities.readJsonSync(file, silent) -> Void
 *
 *  Synchronous version of [[Utilities.readJson]]. Returns `NULL` on any error
 *  instead of throwing exception if `silent`.
 *
 *  **NOTICE** File should be UTF-8 encoded.
 **/
create_parsers('json', JSON.parse);


// wraps iterate function for objects
var iterate_object = function iterate_object(obj, each, final) {
  var arr = [].concat(Object.getOwnPropertyNames(obj)),
      _each = function (i, name, next) {
        each(name, obj[name], next);
      };

  Utilities.iterate(arr, _each, final);
};


/**
 *  Utilities.iterate(arr, each, final) -> Void
 *  - arr (Array|Object): array or hash of key-value pairs to iterate through.
 *  - each (Function): fired on each element of `arr` with `i, val, next` for
 *    `Array`'s and `key, val, next` for objects.
 *  - final (Function): fired after all elements were iterated or if one of
 *    iterations caused exception. Called with `err` if iteration failed.
 *
 *  Iterates through `arr` calling `each` function on each element and firing
 *  `final` after all elements were iterated, or immediately if one of
 *  iterations throwed exception.
 *
 *  Don't forget to call `next` after all manipulations with element in order to
 *  procede iteration with next element.
 *
 *  ##### Example: Iterating array
 *
 *      Utilities.iterate(['a', 'b', 'c'], function (i, v, next) {
 *        console.log(i + ' => ' + v);
 *        next();
 *      }, function (err) {
 *        console.log('done');
 *      });
 *      // -> 0 => a
 *      // -> 1 => b
 *      // -> 2 => c
 *      // -> done
 *
 *  ##### Example: Iterating object
 *
 *      Utilities.iterate({a: 1, b:2, c:3}, function (k, v, next) {
 *        console.log(k + ' => ' + v);
 *        if (2 == v) {
 *          throw Error('Stopped');
 *        }
 *        next();
 *      }, fnction (err) {
 *        console.log(err.toString());
 *      });
 *      // -> a => 1
 *      // -> b => 2
 *      // -> Error: Stopped
 *
 *  ##### Example: Invalid iterator
 *
 *      Utilities.iterate([1, 2, 3], function (i, v, next) {
 *        console.log(v);
 *      }, function (err) {
 *        console.log('This will never happen');
 *      });
 *      // -> 1
 **/
Utilities.iterate = function iterate(arr, each, final) {
  var is_objcet = 'object' === typeof arr,
      is_array = Array.isArray(arr),
      l, // amount of elements in arr
      iterator; // iterator function

  if (is_objcet && !is_array) {
    iterate_object(arr, each, final);
    return;
  }

  // we expect to iterate either through arrays or objects
  if (!is_array) {
    final(Error("Can't iterate. Given argument neither array nor object."));
    return;
  }

  // prepare iterator
  l = arr.length;
  iterator = function iterator(i) {
    if (i >= l) {
      final();
      return;
    }

    try {
      each(i, arr[i], function next() {
        iterator(i + 1);
      });
    } catch (err) {
      final(err);
    }
  };

  // start iterator
  iterator(0);
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

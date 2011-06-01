var fs = require('fs'),
    yaml = require('yaml');


var Utilities = exports = module.exports = {};


/**
 *  Utilities.deepMerge(receiver, transmitter) -> Objcet
 *  
 *  Merges properties of `transmitter` into `receiver`:
 *  - Values of `transmitter` overrides `receiver`'s
 *  - Objcets are recursively merged
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


/**
 *  Utilities.parseYaml(str, callback) -> Void
 *
 *  Safely parses given YAML `str` and fires callback with `err, obj`.
 **/
Utilities.parseYaml = function parseYaml(str, callback) {
  process.nextTick(function parsingYaml() {
    try {
      var obj = yaml.eval(str);
      callback(null, obj);
    } catch (err) {
      callback(err);
    }
  });
};


/**
 *  Utilities.readYaml(file, callback) -> Void
 *
 *  Reads and parses given file as YAML. Then fires callback with `err, obj`.
 **/
Utilities.readYaml = function readYaml(file, callback) {
  fs.readFile(file, function readingYaml(err, str) {
    if (err) {
      callback(err);
      return;
    }

    Utilities.parseYaml(str, callback);
  });
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

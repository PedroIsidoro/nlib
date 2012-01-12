/**
 *  class Utilities
 *
 *  Collection of helper functions used by nodeca-lib and apps.
 **/


'use strict';


// stdlib
var fs = require('fs');


// 3rd-party
var yaml = require('yaml'),
    Promise = require('simple-promise'),
    Underscore = require('underscore');


// self-namespace
var Utilities = module.exports = {};


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

    // TODO: replace TJ's yaml with js-yaml

    /*jshint evil:true*/
    try { result = yaml.eval(str); }
    catch (err) { error = err; }

    callback(err, result);
  });
};


//  TODO: Utilities.waterfall needs documentation
//
//  Waterfall is a "sequencer" which runs all queued function one after another
//  (in order they were added) and finally calls ginve callback:
//
//  waterfall()
//    .queue(function (callback)) {
//      // do something
//    }).queue(function (callback)) {
//      callback(Error("Snap!"));
//    }).queue(function (callback)) {
//      // this will never run
//    }).run(function (err) {
//      if (err) console.error(err);
//      console.log("Done");
//    });
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

    handler.call(context, function (err) {
      if (err) {
        final(err);
        return;
      }

      walk_on();
    });
  };

  return {
    queue: function queue(handler) {
      handlers_queue.push(handler);
      return this;
    },
    run: function run(callback) {
      final = function () {
        callback.apply(context, arguments);
      };
      walk_on();
    }
  };
};


//  TODO: Utilities.aeach needs documentation
//
//  Applies `iterator` on each element of array with three arguments
//  `val, key, callback`. Waits for all callbacks to be called and then
//  fires `callback` passed as third argument of `aeach`.
//
//  Similar to `waterfall`, but iterators runns in parallel.
//
//  aeach(["foo", "bar", "baz"], function (val, idx, callback) {
//    if ("bar" === val) {
//      callback(Error("We were not going to bar this night!!!"));
//      return;
//    }
//
//    callback();
//  }, function (err) {
//    if (err) console.error(err);
//    console.log("Done")
//  });
Utilities.aeach = function aeach(arr, iterator, callback) {
  var all = new Promise.Joint(callback);

  Underscore.each(arr, function (val, key) {
    var promise = all.promise();

    iterator(val, key, function (err) {
      if (err) {
        all.reject(err);
        return;
      }

      promise.resolve();
    });
  });

  all.wait();
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

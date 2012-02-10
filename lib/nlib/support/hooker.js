/** internal, belongs to: Support
 *  class Support.Hooker
 *
 *  Hooks manager. Provides easy way to manage before/after filter chains.
 *
 *  ##### Example
 *
 *      var hooks = new Hooker();
 *
 *      //
 *      // run function, with before/after hooks...
 *      hooks.before('spanish.pub', 20, function (callback) {
 *        console.log('Amigos!');
 *        callback();
 *      });
 *
 *      hooks.before('spanish.pub', 10, function (callback) {
 *        console.log('Hola,');
 *        callback();
 *      });
 *
 *      hooks.after('spanish.pub', function (callback) {
 *        console.log('Adios!');
 *        callback();
 *      });
 *
 *      hooks.run('spanish.pub', function (callback) {
 *        console.log('...inside pub...');
 *        callback();
 *      }, function (err) {
 *        if (err) {
 *          console.log(err);
 *          return;
 *        }
 *
 *        console.log('DONE');
 *      });
 *      // -> Hola,
 *      // -> Amigos!
 *      // -> ...inside pub...
 *      // -> Adios!
 *      // -> DONE
 *
 *      //
 *      // run function without before/after hooks...
 *      hooks.run('silent room', function (callback) {
 *        console.log('...inside pub...');
 *        callback();
 *      }, function (err) {
 *        if (err) {
 *          console.log(err);
 *          return;
 *        }
 *
 *        console.log('DONE');
 *      });
 *      // -> ...inside pub...
 *      // -> DONE
 *
 *      //
 *      // interrupt execution of the chain
 *      hooks.before('movie', function (callback) {
 *        if (global.hasPopcorn) {
 *          callback();
 *          return;
 *        }
 *
 *        callback(new Error("No pop corn left..."));
 *      });
 *
 *      global.hasPopcorn = true;
 *      hooks.run('movie', function (callback) {
 *        console.log('...watching movie...');
 *        callback();
 *      }, function (err) {
 *        if (err) {
 *          console.log(err);
 *          return;
 *        }
 *
 *        console.log('DONE');
 *      });
 *      // -> ...watching movie...
 *      // -> DONE
 *
 *      global.hasPopcorn = false;
 *      hooks.run('movie', function (callback) {
 *        console.log('...watching movie...');
 *        callback();
 *      }, function (err) {
 *        if (err) {
 *          console.log(err);
 *          return;
 *        }
 *
 *        console.log('DONE');
 *      });
 *      // -> No pop corn left...
 **/


// TODO: Simplify documentation


'use strict';


var SortedSet = require('types').SortedSet;
var Async = require('async');


/**
 *  new Support.Hooker()
 **/
var Hooker = module.exports = function Hooker() {
  this.__hooks__ = {};
};


// returns before/after chains for given `bucket`
function get_hooks(self, bucket) {
  if (!self.__hooks__[bucket]) {
    self.__hooks__[bucket] = {
      before: SortedSet.create(),
      after: SortedSet.create()
    };
  }

  return self.__hooks__[bucket];
}


// add fn to the before/after `chain` of the `bucket`
function filter(self, chain, bucket, weight, fn) {
  var hooks = get_hooks(self, bucket);

  if (!fn) {
    fn = weight;
    weight = ('before' === chain) ? (-9999) : 9999;
  }

  if ('function' !== typeof fn) {
    // TODO log warning
    return false;
  }

  hooks[chain].add(+weight, fn);
  return true;
}


/** alias of: Support.Hooker.new
 *  Support.Hooker.create() -> Support.Hooker
 *
 *  Constructor proxy.
 **/
Hooker.create = function create() {
  return new Hooker();
};


/**
 *  Support.Hooker.before(bucket, weight, fn) -> Boolean
 *  Support.Hooker.before(bucket, fn) -> Boolean
 **/
Hooker.prototype.before = function before(bucket, weight, fn) {
  return filter(this, 'before', bucket, weight, fn);
};


/**
 *  Support.Hooker.after(bucket, weight, fn) -> Boolean
 *  Support.Hooker.after(bucket, fn) -> Boolean
 **/
Hooker.prototype.after = function after(bucket, weight, fn) {
  return filter(this, 'after', bucket, weight, fn);
};


/** alias of: Hooker#after
 *  Support.Hooker#on(bucket, weight, fn) -> Boolean
 *  Support.Hooker#on(bucket, fn) -> Boolean
 **/
Hooker.prototype.on = Hooker.prototype.after;


/**
 *  Support.Hooker.run(bucket[, arg1[, argN]], block, callback) -> Void
 **/
Hooker.prototype.run = function run(bucket) {
  var hooks = get_hooks(this, bucket), before, after, args, block, callback;

  args      = Array.prototype.slice.call(arguments, 1);
  callback  = args.pop(); // last arg - callback
  block     = [args.pop()]; // one before last - block
  before    = hooks.before.sorted;
  after     = hooks.after.sorted;

  // make sure block is a function. otherwise remove it from the execution chain
  if ('function' !== typeof block[0]) { block = []; }

  // Fatal fuckup! SHOULD never happen.
  if ('function' !== typeof callback) {
    throw new TypeError('Hooker#run requires callback to be a function');
  }

  Async.forEachSeries([].concat(before, block, after), function (fn, next) {
    fn.apply(null, args.concat([next]));
  }, function (err/*, results */) {
    callback(err);
  });
};

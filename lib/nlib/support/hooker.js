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
 *      hooks.run('silent-room', function (callback) {
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

// runs hooks over single bucket
function run_single(self, bucket, args, block, callback, ctx) {
  var hooks = get_hooks(self, bucket), before, after;

  before = hooks.before.sorted;
  after  = hooks.after.sorted;

  Async.forEachSeries([].concat(before, block, after), function (fn, next) {
    fn.apply(ctx, args.concat([next]));
  }, function (err/*, results */) {
    callback(err);
  });
}


// runs hooks for bucket and all it's parents
function run_stack(self, bucket, args, block, callback, ctx) {
  var parts = bucket.split('.'), stack, more;

  //  We need to call before/after filters of all api_path parents.
  //  For this purpose we need to each parent filter run should nest child
  //  execution and the most bottom child is `func` itself (block).
  //  In other words we are doing something like `reduce` (or `inject`).
  //
  //  ##### Visual Explanation
  //
  //    api_path = "forum.posts.show"
  //
  //  Stack is filled from func, and up to the top most parent:
  //
  //    - stack: func
  //    - stack: filter('forum.posts.show') -> stack
  //    - stack: filter('forum.posts') -> stack
  //    - stack: filter('forum') -> stack
  //
  //  After filling the stack it's execution will be something like this:
  //
  //    - filter.before('forum')                  -> stack = filter('forum')
  //      - filter.before('forum.posts')          -> stack = filter('forum.posts')
  //        - filter.before('forum.posts.show')   -> stack = filter('forum.posts.show')
  //          - func                              -> stack = func
  //        - filter.after('forum.posts.show')
  //      - filter.after('forum.posts')
  //    - filter.after('forum')

  // initial memo
  stack = block;

  // helper wrap `nest` with parent filter execution
  more = function (hook_name) {
    // save current stack in current closure
    var curr = stack;

    // reassign stack with caller of `hook_name`,
    // using previous stack as `block` of hook chain
    stack = function () {
      // we care only about `next` callback here,
      // which is always the last one
      var next = arguments[arguments.length - 1];
      run_single(self, hook_name, args, curr, next, ctx);
    };
  };

  // fill the stack
  while (parts.length) {
    more(parts.join('.'));
    parts.pop();
  }

  // run stack
  stack(callback);
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
 *  Support.Hooker.run(bucket[, arg1[, argN]], block, callback, thisArg) -> Void
 *
 *  **NOTICE** We support "nested" buckets or buckets with parents. Nesting is
 *  done with `.` so running hooks for `foo.bar` bucket will run:
 *
 *  - before `foo`
 *  - before `foo.bar`
 *  - block
 *  - after `foo.bar`
 *  - after `foo`
 **/
Hooker.prototype.run = function run(bucket) {
  var args, ctx, block, callback;

  args = Array.prototype.slice.call(arguments, 1);
  ctx  = args.pop();

  if ('function' !== typeof ctx) {
    callback = args.pop();
  } else {
    callback = ctx;
    ctx = null;
  }

  block = [args.pop()];

  // make sure block is a function. otherwise remove it from the execution chain
  if ('function' !== typeof block[0]) { block = []; }

  // Fatal fuckup! SHOULD never happen.
  if ('function' !== typeof callback) {
    throw new TypeError('Hooker#run requires callback to be a function');
  }

  run_stack(this, bucket, args, block, callback, ctx);
};

/** internal, belongs to: Application
 *  class HooksManager
 *
 *  Provides application hooks registry.
 *
 *  ##### Example
 *
 *      var hooks = new HooksManager(['foo']);
 *
 *      hooks.add('foo', 20, function () { console.log('b'); });
 *      hooks.add('foo', 10, function () { console.log('a'); });
 *      hooks.exec('foo');
 *      // -> a
 *      // -> b
 *
 *      hooks.add('bar', 10, function () { console.log('sorry'); });
 *      // -> throws Error
 **/


'use strict';


// 3rd-party
var Promise = require('simple-promise');

// internal
var $$ = require('../utilities'),
    PriorityStack = require('../priority_stack');


/**
 *  new HooksManager(allowedNames[, context])
 *  - allowedNames (Array): List of allowed hooks
 *  - context (Object): `this` context of hook handlers when executing them
 *
 *  Creates an instance of hooks manager, which accepts only specified `names`
 *  of hooks to be registered and executed.
 **/
var HooksManager = module.exports = function HooksManager(allowedNames, context) {
  // allow instance without new keyword
  if (!(this instanceof HooksManager)) {
    return new HooksManager(allowedNames, context);
  }

  // names is requried and should be array
  if (!Array.isArray(allowedNames)) {
    throw Error(this.constructor.name + " requires list of allowed names");
  }

  var self = this,
      registry = {};


  // preset hooks' names and stacks
  allowedNames.forEach(function (name) {
    name = $$.parameterize(name);

    if (0 < name.length) {
      registry[name] = new PriorityStack();

      // create a shortcut for exec()
      self[name] = function (callback) {
        self.exec(name, callback);
      };
    }
  });


  /**
   *  HooksManager#getStack(name) -> PriorityStack
   *  - name (String): Name of the hook
   *
   *  Returns stack of handlers assigned to the `name` hook.
   *
   *  ##### Throws Error
   *
   *  - If `name` is not a valid hook name (specified in the constructor)
   **/
  this.getStack = function getStack(name) {
    var n = $$.parameterize(name);

    // hook name was not registered
    if (!registry.hasOwnProperty(n)) {
      throw Error("Unknown hook name '" + name + "'");
    }

    return registry[n];
  };


  /** chainable
   *  HooksManager#add(name, priority, handler) -> HooksManager
   *  - name (String): Name of the hook
   *  - priority (Number): Priority of hook `handler`
   *  - handler (Function): Will be fired during hook execution
   *
   *  Register `handler` in the stack of `name` hook.
   *
   *  ##### Override handler's context
   *
   *  All registered handlers are executed with `context` given by constructor,
   *  but you may bind you own context for `handler` if you need it:
   *
   *      var somePlace = new Restaurant("Good Food Ltd."),
   *          lunchHandler = function lunchHandler() {
   *            console.log("Having lunch. Don't buzzing me please...");
   *
   *            this.askMenu(function chooseFood(err, menu) {
   *              // ...
   *            });
   *          };
   *
   *      hooks.add('lunch', lunchHandler.bind(somePlace));
   *
   *  ##### See Also
   *
   *  - [[HooksManager#getStack]]
   *
   *  ##### Throws Error
   *
   *  - If `handler` is not a function
   **/
  this.add = function add(name, priority, handler) {
    if ('function' !== typeof handler) {
      throw Error("Hook's handler must be a function");
    }

    if (2 !== handler.length) {
      throw Error("Handler must accept (resolve, reject) arguments");
    }

    this.getStack(name).push(priority, handler);
    return this;
  };


  /**
   *  HooksManager#exec(name, callback) -> Promise.Joint
   *  - name (String): Name of the hook
   *  - callback (Function): [[Promise.Joint]]'s `done` handler
   *
   *  Executes each handler registered in the `name` hook stack:
   *
   *  * Each handler is "wrapped" in promise and called with two arguments:
   *    - successCallback (Function): See [[Promise#resolve]]
   *    - failureCallback (Function): See [[Promise.Joint#reject]]
   *
   *  * Each handler will be called with context specified in constructor. You
   *    may bind different context if you need, see [[HooksManager#add]] for
   *    details.
   *
   *  ##### Example
   *
   *      var context = {action: 'have a coffee'},
   *          awaiter = function waiter(err, p1, p2) {
   *            if (err) { console.log(err.message); }
   *            if (p1 && p1[0]) { console.log(p1[0]); }
   *            if (p2 && p2[0]) { console.log(p2[0]); }
   *          },
   *          handler = function handler(resolve, reject) {
   *            if (!this.action) {
   *              reject(Error("This will mark hooks executor as 'rejected'."));
   *              return;
   *            }
   *            
   *            console.log("While having " + hook + "...");
   *            console.log("Going to " + this.action + " with my wife.");
   *
   *            // Normally you will need to "resolve" with `null` as first arg,
   *            // but you may want to "mark" handler's promise as error for
   *            // your own internal purposes, without marking whole hooks
   *            // stack executor as being rejected.
   *            resolve(Error("This error will not affect executor anyhow."));
   *          };
   *
   *      HooksManager('lunch', context)
   *        .add('lunch', handler)
   *        .exec('lunch', awaiter);
   *        // -> While having lunch...
   *        // -> Going to have a coffee with my wife.
   *        // -> This error will not affect executor anyhow.
   *
   *      HooksManager('lunch', context)
   *        .add('lunch', handler, handler.bind({action: 'have a tea'})
   *        .exec('lunch', awaiter);
   *        // -> While having lunch...
   *        // -> Going to have a coffee with my wife.
   *        // -> While having lunch...
   *        // -> Going to have a tea with my wife.
   *        // -> This error will not affect executor anyhow.
   *        // -> This error will not affect executor anyhow.
   *
   *      HooksManager('lunch')
   *        .add('lunch', handler)
   *        .exec('lunch', awaiter);
   *        // -> This will mark hooks executor as 'rejected'.
   *
   *
   *  ##### See Also
   *
   *  - [[HooksManager#add]]
   *  - [[HooksManager#getStack]]
   *  - [[Promise.Joint]]
   **/
  this.exec = function exec(name, callback) {
    var joint = new Promise.Joint(callback);

    this.getStack(name).flatten().forEach(function (handler) {
      var promise = new Promise();

      handler.apply(context || {}, promise.resolve, joint.reject);

      joint.include(promise);
    });

    joint.wait();
    return this;
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

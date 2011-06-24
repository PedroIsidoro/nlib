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


var $$ = require('../utilities'),
    PriorityStack = require('./priority_stack');


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

  var registry = {};


  // preset hooks' names and stacks
  allowedNames.forEach(function (name) {
    name = HooksManager.normalize(name);

    if (0 < name.length) {
      registry[name] = new PriorityStack();
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
    var n = HooksManager.normalize(name);

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

    this.getStack(name).push(priority, handler);
    return this;
  };


  /**
   *  HooksManager#exec(name[, arg1[, argN]]) -> HooksManager
   *  - name (String): Name of the hook
   *
   *  Executes each handler registered in the `name` hook stack. Each handler
   *  will be fired with arguments provided to `exec` method itself.
   *
   *  Each handler will be called with context specified in constructor. You may
   *  bind different context if you need, see [[HooksManager#add]] for details.
   *
   *  ##### Example
   *
   *      var hooks = HooksManager(['lunch'], {action: 'a cup of coffee'}),
   *          handler = function handler(hook, person) {
   *            console.log("While having " + hook + "...");
   *            console.log("Going to " + this.action + " with " + person);
   *          };
   *
   *      hooks.add('lunch', handler).exec('lunch');
   *      // -> While having lunch...
   *      // -> Going to drink a cup of coffee with my friend
   *
   *  ##### See Also
   *
   *  - [[HooksManager#getStack]]
   **/
  this.exec = function exec(name) {
    var arguments_orig = arguments;

    this.getStack(name).flatten().forEach(function (callback) {
      callback.apply(context || {}, arguments_orig);
    });
    
    return this;
  };
};


/** internal
 *  HooksManager.normalize(str) -> String
 *
 *  Returns normalized version of `str` - lower-cased words dash-separted, e.g.:
 *  'FooBar' will become'foo-bar'.
 **/
HooksManager.normalize = function normalize(str) {
  return $$.splitCamelCase(str).replace(/[ _]+/g, '-').toLowerCase();
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

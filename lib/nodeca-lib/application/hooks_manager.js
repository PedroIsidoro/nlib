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


var PriorityStack = require('./priority_stack');


var fix_hook_name = function fix_hook_name(name) {
  return name.toLowerCase();
};


/**
 *  new HooksManager(names[, context])
 *  - names (Array): List of allowed hooks
 *  - context (Object): `this` context of hook handlers when executing them
 *
 *  Creates an instance of hooks manager, which accepts only specified `names`
 *  of hooks to be registered and executed.
 **/
var HooksManager = module.exports = function HooksManager(names, context) {
  // allow instance without new keyword
  if (!(this instanceof HooksManager)) {
    return new HooksManager(names, context);
  }

  // names is requried and should be array
  if (!Array.isArray(names)) {
    throw Error(this.constructor.name + " requires list of allowed names");
  }

  var registry = {};


  // preset hooks' names and stacks
  names.forEach(function (name) {
    name = fix_hook_name(name);

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
    name = fix_hook_name(name);

    // hook name was not registered
    if (!registry.hasOwnProperty(name)) {
      throw Error("Unknown hook name '" + name + "'");
    }

    return registry[name];
  };


  /** chainable
   *  HooksManager#add(name, priority, handler) -> HooksManager
   *  - name (String): Name of the hook
   *  - priority (Number): Priority of hook `handler`
   *  - handler (Function): Will be fired during hook execution
   *
   *  Register `handler` in the stack of `name` hook.
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
   *  Each handler will be called with context specified in constructor, or with
   *  handler itself as context if context was not specified.
   *
   *  ##### Example
   *
   *      var mega_hook = function mega_hook(name, person) {
   *        console.log("While having " + name + "...");
   *        console.log("Going to " + this.action + " with " + person);
   *      };
   *
   *      var ctx = {action: 'drink a cup of coffee'};
   *      HooksManager(['lunch'], ctx).add('lunch').exec('lunch', 'my friend');
   *      // -> While having lunch...
   *      // -> Going to drink a cup of coffee with my friend
   *
   *      mega_hook.action = 'drink a cup of tea';
   *      HooksManager(['dinner']).add('dinner').exec('dinner', 'my wife');
   *      // -> While having dinner...
   *      // -> Going to drink a cup of tea with my wife
   *
   *  ##### See Also
   *
   *  - [[HooksManager#getStack]]
   **/
  this.exec = function exec(name) {
    var arguments_orig = arguments;
    this.getStack(name).flatten().forEach(function (callback) {
      callback.apply(context || callback, arguments_orig);
    });
    
    return this;
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

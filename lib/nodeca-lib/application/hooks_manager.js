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
 *      hooks.run('foo');
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
 *  new HooksManager(name)
 *
 *  Creates an instance of hooks manager, which accepts only specified `names`
 *  of hooks to be registered and ran.
 **/
var HooksManager = module.exports = function HooksManager(names) {
  // allow instance without new keyword
  if (!(this instanceof HooksManager)) {
    return new HooksManager(callback);
  }

  // names is requried and should be array
  if (!Array.isArray(names)) {
    throw Error(this.constructor.name + " requires list of allowed names");
  }

  var registry = {};


  // preset hooks' names and stacks
  names.forEach(function (name) {
    if (name) {
      registry[fix_hook_name(name)] = new PriorityStack();
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
      if (!Object.hasOwnProperty(registry, name)) {
        throw Error("Unknown hook name '" + name + "'");
      }

      return registry[name];
  };


  /** chainable
   *  HooksManager#add(name, priority, callback) -> HooksManager
   *  - name (String): Name of the hook
   *  - priority (Number): Priority of `callback` handler for the hook
   *  - callback (Function): Callback to be fired during hook execution
   *
   *  Register `callback` in the stack of `name` hook handlers.
   *
   *  ##### See Also
   *
   *  - [[HooksManager#getStack]]
   *
   *  ##### Throws Error
   *
   *  - If `callback` is not a function
   **/
  this.add = function add(name, priority, callback) {
    if ('function' !== typeof callback) {
      throw Error("Hook's callback must be a function");
    }

    this.getStack(name).push(priority, callback);
    return this;
  };


  /**
   *  HooksManager#run(name[, arg1[, argN]]) -> HooksManager
   *  - name (String): Name of the hook
   *
   *  Executes each callback registered in the `name` hook stack. Each handler
   *  will be fired with context of itself and arguments provided to the method
   *  itself.
   *
   *  ##### Example
   *
   *      var mega_hook = function mega_hook(name, girl) {
   *        console.log("While having " + name + "...");
   *        console.log("Going to " + this.action + " with " + girl);
   *      };
   *
   *      mega_hook.action = 'drink some coffee';
   *
   *      hooks.add('coffee-break', mega_hook).run('coffee-break', 'my wife');
   *      // -> While having coffee-break...
   *      // -> Going to drink some coffee with my wife
   *
   *  ##### See Also
   *
   *  - [[HooksManager#getStack]]
   **/
  this.run = function run(name) {
    this.getStack(name).flatten().forEach(function (callback) {
      callback.apply(callback, arguments);
    });
    
    return this;
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

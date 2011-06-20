/** internal, belongs-to: Application
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


var PriorityStack = require('../priority_stack');


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

  var registry = {},
      get_valid_name = function get_valid_name(name) {
        name = fix_hook_name(name);

        // hook name was not registered
        if (!Object.hasOwnProperty(registry, name)) {
          throw Error("Unknown hook name '" + name + "'");
        }

        // hook was already fired
        if (null === registry[name]) {
          throw Error("Hook were already ran");
        }

        return name;
      };


  // preset hooks' names and stacks
  names.forEach(function (name) {
    if (name) {
      registry[fix_hook_name(name)] = new PriorityStack();
    }
  });


  /** chainable
   *  HooksManager#add(name, priority, callback) -> HooksManager
   *  - name (String): Name of the hook
   *  - priority (Number): Priority of `callback` handler for the hook
   *  - callback (Function): Callback to be fired during hook execution
   *
   *  Register `callback` in the stack of `name` hook handlers.
   *
   *  ##### Throws Error
   *
   *  - If `callback` is not a function
   *  - If `name` is not a valid hook name (specified in the constructor)
   *  - If `name` hook was already ran
   **/
  this.add = function add(name, priority, callback) {
    if ('function' !== typeof callback) {
      throw Error("Hook's callback must be a function");
    }

    name = get_valid_name(name);
    registry[name].push(priority, callback);

    return this;
  };


  /**
   *  HooksManager#run(name) -> HooksManager
   *  - name (String): Name of the hook
   *
   *  Executes all `name` hook registered handlers.
   *
   *  ##### Throws Error
   *
   *  - If `name` is not a valid hook name (specified in the constructor)
   *  - If `name` hook was already ran
   **/
  this.run = function run(name) {
    name = get_valid_name(name);

    registry[name].flatten().forEach(function (hook) {
      hook();
    });
    
    // mark hook as being fired
    registry[name] = null;

    return this;
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

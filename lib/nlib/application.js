/**
 *  class Application
 *
 *
 *  ##### Application Hooks
 *
 *  You can attach hooks that will be called before or after some event with
 *  [[Application.before]] and [[Application.after]] methods accordingly.
 *
 *  These are known list of hooks:
 *
 *  - *init.schemas*
 *
 *
 *  ##### Example
 *
 *      // file: index.js
 *      module.exports = new Application({
 *        name: 'hello-world',
 *        root: __dirname
 *      });
 *
 *      // ...
 *
 *      Application.after('init.schemas', function (callback) {
 *          // monkey-patch some schemas...
 *          // ...
 *          // when something went wrong...
 *          callback(Error("Something happened"));
 *          // ...
 *          // otherwise, if everything is OK...
 *          callback(null);
 *      });
 **/


'use strict';


/**
 *  new Application(options)
 *  - options (Object): Application basic configuration
 *
 *  Creates new nodeca application with given `options.root` as application
 *  root (directory with application methods, views etc).
 *
 *
 *  ##### Options
 *
 *  - `root` (required) - Application's root path (usually `__dirname`)
 *  - `name` (required) - Application name must be unique (usaually same as you
 *    provide in `package.json`
 *
 *
 *  ##### Example
 *
 *      var app = new Application({
 *        name: 'my_app',
 *        root: __dirname
 *      });
 *
 *
 *  ##### See Also
 *
 *  - [[Application.before]]
 *  - [[Application.after]]
 **/
var Application = module.exports = function Application(options) {
  var self = this; // self-reference


  if (!options.root) { throw new Error("Application root is required"); }
  if (!options.name) { throw new Error("Application name is required"); }


  /** read-only
   *  Application#root -> String
   *
   *  Applications's root directory
   **/
  Object.defineProperty(this, 'root', {value: options.root});


  /** read-only
   *  Application#name -> String
   *
   *  Applications's name.
   **/
  Object.defineProperty(this, 'name', {value: options.name});
};


/**
 *  Application#run() -> Void
 *
 *  Runs application (initialize, start http and websocket servers).
 **/
Application.prototype.run = function run() {
  var initialize = require('./application/initializer');
  initialize(this, function (err) {
    throw "Not implemented yet";
    // start server here
  });
};


/** internal, read-only
 *  Application.__hooks__ -> Hooker
 *
 *  Global application hooks registry.
 **/
Object.defineProperty(Application, '__hooks__', {
  value: require('./support/hooker').create()
});


/**
 *  Application.before(name[, priority = 10], fn) -> Void
 *  - name (String): Name of the hook.
 *  - priority (Number): Priority in the chain of hooks.
 *  - fn (Function): Hook handler.
 *
 *  Registers given `fn` to be called before `name` event, e.g. `init.schemas`.
 *
 *
 *  ##### See Also
 *
 *  - [[Application]]
 *  - [[Application.after]]
 *  - [[Support.Hooker]]
 **/
Application.before = function before(name, priority, fn) {
  if (undefined === fn) {
    fn = priority;
    priority = 10;
  }

  Application.__hooks__.before(name, priority, fn);
};


/**
 *  Application.after(name[, priority = 10], fn) -> Void
 *  - name (String): Name of the hook.
 *  - priority (Number): Priority in the chain of hooks.
 *  - fn (Function): Hook handler.
 *
 *  Registers given `fn` to be called after `name` event, e.g. `init.schemas`.
 *
 *
 *  ##### See Also
 *
 *  - [[Application]]
 *  - [[Application.before]]
 *  - [[Support.Hooker]]
 **/
Application.after = function after(name, priority, fn) {
  if (undefined === fn) {
    fn = priority;
    priority = 10;
  }

  Application.__hooks__.after(name, priority, fn);
};


/** alias to: Application.new
 *  Application.create(options) -> Application
 *
 *  Constructor proxy
 **/
Application.create = function create(options) {
  return new Application(options);
};

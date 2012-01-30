/**
 *  class Application
 *
 *
 *  ##### Example
 *
 *      // file: index.js
 *      module.exports = new Application({
 *        name: 'hello-world',
 *        root: __dirname
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


/** alias to: Application.new
 *  Application.create(options) -> Application
 *
 *  Constructor proxy
 **/
Application.create = function create(options) {
  return new Application(options);
};

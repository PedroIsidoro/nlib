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


// stdlib
var Path = require('path');


// 3rd-party
var Underscore = require('underscore');


// internal
var Initializer = require('./application/initializer');


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


  /**
   *  Application#bootstrap(callback) -> Void
   *
   *  Proxy to the `bootstrap` function provided in constructor's options.
   **/
  this.bootstrap = options.bootstrap || function (nodeca, cb) { cb(null); };
};



/**
 *  Application#readConfigFile(name, callback) -> Void
 **/
Application.prototype.readConfigFile = function readConfigFile(name, callback) {
  var env = Application.env, config;

  try {
    config = require(Path.join(this.root, 'config', name) + '.yml').shift();
    if (config && config.general || config[env]) {
      // load per-environment config
      config = !config[env] ? Underscore.extend({}, config.general)
             : Underscore.extend({}, config.general, config[env]);
    }
  } catch (err) {
    callback(err);
    return;
  }

  callback(null, config);
};


/**
 *  Application#run() -> Void
 *
 *  Runs application (initialize, start http and websocket servers).
 **/
Application.prototype.run = function run(callback) {
  Initializer.initialize(this, callback || function (err) {
    console.warn('Application#run() expects callback, but no one was given');

    if (err) {
      console.error(err);
      process.exit(1);
    }
  });
};


/** alias of: Application.new
 *  Application.create(options) -> Application
 *
 *  Constructor proxy
 **/
Application.create = function create(options) {
  return new Application(options);
};


/**
 *  Application.env -> String
 *
 *  Proxy to process.env['NODECA_ENV']
 **/
Object.defineProperty(Application, 'env', {
  value: process.env['NODECA_ENV'] || 'development'
});

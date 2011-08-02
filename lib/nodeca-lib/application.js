/**
 *  class Application
 **/


'use strict';


// stdlib
var path = require('path'),
    fs = require('fs');

// 3rd-party
var Promise = require('simple-promise'),
    Winston = require('winston');

// internal
var $$ = require('./utilities'),
    HooksManager = require('./application/hooks_manager');


// list of valid hooks. don't forget to update [[Application#addHook]]
// documentation if it is changed
var VALID_HOOKS = [
  'subapps-loaded',
  'schemas-loaded',
  'models-loaded',
  'controllers-loaded',
  'routes-loaded',
  'init-complete'
];


/**
 *  new Application(dirname[, bootstrapper])
 *  - dirname (String): Application's root directory
 *  - bootstrapper (Function): Callback used by [[Application#bootstrap]]
 *
 *  Creates new nodeca application with given `dirname` as application root. If
 *  `bootstrapper` was given, it will be used upon [[Application#bootstrap]] and
 *  it's the only place where you may add hooks.
 *
 *  ##### Example
 *
 *      var app = new Application)(__dirname, function bootstrapper() {
 *        this.addHook('bootstrapped', 10, function () {
 *          this.log.info('All applications were bootstrapped');
 *        });
 *      });
 *
 *  ##### See Also
 *
 *  - [[Application#addHook]]
 **/
var Application = module.exports = function Application(dirname, bootstrapper) {
  var self = this, // self-reference
      main = this, // master app when this instance is sub-app
      hooks = new HooksManager(VALID_HOOKS, this), // stack of hooks for app
      config_promise = new Promise(), // defaults config were loaded
      mongoose_promise = new Promise(), // db config were read and mongoose was connected
      loaded_apps = {},
      schemas = {},
      models = {},
      controllers = {},
      routers = [];


  /** internal, read-only
   *  Application#dirname -> String
   *
   *  Applications's root directory
   **/
  this.__defineGetter__('dirname', function get_dirname() {
    return dirname;
  });


  /** internal, read-only
   *  Application#main -> Application
   *
   *  Instance of "host" application if any or self-reference otherwise
   *
   *  ##### See Also
   *
   *  - [[Application#embedInto]]
   *  - [[Application#embed]]
   **/
  this.__defineGetter__('main', function get_main() {
    return main;
  });


  /**
   *  Application#getConfig(callback) -> Void
   *
   *  Fires `callback(err, config)` once `defaults` config of application was
   *  read and parsed.
   **/
  this.getConfig = config_promise.done;


  /**
   *  Application#getMongoose(callback) -> Void
   *
   *  Fires `callback(err, mongoose)` once mongoose is connected to databse.
   **/
  this.getMongoose = mongoose_promise.done;


  // needs to be rewritten I guess
  this.getLogger = function (callback) {
    callback(null, Winston);
  };


  /** chainable
   *  Application#addHook(name[, priority = 10], handler) -> Application
   *
   *  Registers given `handler` as `name` hook of main (host) appliction
   *  (see [[Application#main]]). Each handler will be fired with current
   *  application instance as `this` context.
   *
   *  **WARNING** This method should be used only inside `bootstrapper`.
   *
   *  ##### Available Hooks
   *
   *  - *bootstrapped* - Executed once all applications were bootstrapped
   *  - *schemas-loaded* - Executed once all schemas were loaded
   *  - *models-loaded* - Executed once all models were created from schemas
   *  - *controllers-loaded* - Executes once all controllers were loaded
   *  - *routes-loaded* - Executed once all routes were processed and assigned
   *
   *  ##### See Also
   *
   *  - [[Application#bootstrap]]
   *  - [[HooksManager#add]]
   **/
  this.addHook = function addHook(name, priority, handler) {
    // add hook into host app's stack if app was embedded
    if (main !== this) {
      main.addHook(name, priority, handler);
    } else {
      if (undefined === handler) {
        handler = priority;
        priority = 10;
      }

      hooks.add(name, priority, handler);
    }

    return this;
  };


  /** chainable
   *  Application#embedInto(mainApp) -> Application
   *  - mainApp (Application): Instance of host application to become master.
   *
   *  Embeds application into master (host) application.
   *
   *  ##### Example
   *
   *      subapp.embedInto(app) === subapp;
   *      subapp.main === app;
   *
   *  ##### Throws Error
   *
   *  - When application was already embeded before
   **/
  this.embedInto = function embedInto(mainApp) {
    if (main !== this) {
      throw Error("Application was already embedded before")
    }

    main = mainApp;
    return this;
  };


  /** 
   *  Application#init(appConfig, callback) -> Void
   *
   *  Initializes master application.
   **/
  this.init = function init(appConfig, callback) {
    // allow call init with callback only
    if (undefined === callback) {
      callback = appConfig;
      appConfig = {};
    }

    // init can be started on master app only
    if (main !== this) {
      callback(Error("Only master application can call init()"));
      return;
    }

    // expose private objects through binding them to the initializer
    var initializer = require('./application/initializer').bind({
      loaded_apps: loaded_apps,
      schemas: schemas,
      models: models,
      controllers: controllers,
      routers: routers,
      hooks: hooks,
      main: this
    });
   
    // run initializer and grab some of the references back
    initializer(appConfig, function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback();
    });
  };
};


/**
 *  Application#env -> String
 *
 *  Application environment retreived from `NODE_ENV` environment variable.
 *  By default `development` if `NODE_ENV` was not set.
 **/
Object.defineProperty(Application.prototype, 'env', {
  value: process.env['NODE_ENV'] || 'development'
});


/** chainable
 *  Application#embed(app) -> Application
 *
 *  Opposite method of [[Application#embedInto]].
 *
 *  ##### Example
 *
 *      app.embed(subapp) === app;
 *      subapp.main === app;
 **/
Application.prototype.embed = function embed(app) {
  app.embedInto(this);
  return this;
};


/**
 *  Application#getConfigFilename(name) -> String
 *
 *  Returns full path of `name` config.
 *
 *  ##### Example
 *
 *  Assuming app is placed under /srv/red-hot-chili-peppers
 *
 *      app.getConfigFilename('database');
 *      // -> /srv/red-hot-chili-peppers/config/database.yml
 **/
Application.prototype.getConfigFilename = function getConfigFilename(name) {
  return path.join(this.dirname, 'config', name + '.yml');
};


/**
 *  Application#readConfig(name, callback) -> Void
 *  Application#readConfig(name, env, callback) -> Void
 *  - name (String): filename to read (without extension), e.g.: `application`
 *  - env (String): get specific environment section of config (method does not
 *    checks if config has different sections or not)
 *  - callback (Function): fired once config was read or error met. Called with
 *    arguments as follows - `callback(err, config)`.
 *
 *  Reads and parses `config/<name>.yml` file of application. If `env` is
 *  given result is merged `general` and `env` sections of config.
 *
 *  ##### Example
 *
 *  Assuming we have file `config/application.yml`:
 *
 *      ---
 *      general:
 *        foo: bar
 *
 *      production:
 *        baz: baz
 *
 *  We can grab whole config:
 *
 *      app.readConfig('application', function (err, config) {
 *        console.log(config);
 *        // -> {general: {foo: 'bar'}, production: {baz: 'baz'}}
 *      });
 *
 *  Or syntethic config for environment:
 *
 *      app.readConfig('application', 'production', function (err, config) {
 *        console.log(config);
 *        // -> {foo: 'bar', baz: 'baz'}
 *      });
 *
 *  ##### See Also
 *
 *  - [[Application#getConfigFile]]
 *  - [[Utilities.readYaml]]
 **/
Application.prototype.readConfig = function readConfig(name, env, callback) {
  var self = this,
      file = this.getConfigFilename(name);

  if (undefined === callback) {
    callback = env;
    env = null;
  }

  $$.readYaml(file, function (err, config) {
    if (err) {
      callback(err);
      return;
    }

    if (env) {
      config = $$.merge({}, config.general, config[env]);
    }

    callback(null, config);
  });
};


/**
 *  Application#readPackageInfo(callback) -> Void
 *
 *  Reads `package.json` from application's root directory and fires
 *  `callback(err, json)`.
 *
 *  **NOTICE** File should be UTF-8 encoded.
 **/
Application.prototype.readPackageInfo = function readPackageInfo(callback) {
  var file = path.join(this.dirname, 'package.json');

  fs.readFile(file, 'utf-8', function (err, str) {
    if (err) {
      callback(err);
      return;
    }

    try {
      callback(null, JSON.parse(str));
    } catch (err) {
      callback(err);
    }
  });
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

/**
 *  class Application
 **/


'use strict';


// stdlib
var path = require('path'),
    fs = require('fs');

// 3rd-party
var Promise = require('simple-promise');

// internal
var $$ = require('./utilities'),
    HooksManager = require('./application/hooks_manager');


// hooks regstry. see [[Application#addHook]]
var hooks_registry = new HooksManager([
  'apps-loaded',
  'schemas-loaded',
  'models-loaded',
  'views-loaded',
  'controllers-loaded',
  'routes-loaded',
  'public-assets-loaded',
  'static-lulz-loaded'
]);


// read package.json under dirname and returns name
var get_app_name = function get_app_name(dirname) {
  try {
    var pkg = fs.readFileSync(path.join(dirname, 'package.json'), 'utf-8');
    return JSON.parse(pkg).name;
  } catch (err) {
    err.message = "Failed retreive application's name. " + err.message;
    throw err;
  }
};


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
  if (!(this instanceof Application)) {
    return new Application(dirname, bootstrapper);
  }

  var self = this, // self-reference
      main = this, // master app when this instance is sub-app
      name = get_app_name(dirname); // application name (from package.json)


  /** read-only
   *  Application#dirname -> String
   *
   *  Applications's root directory
   **/
  this.__defineGetter__('dirname', function get_dirname() {
    return dirname;
  });


  /** read-only
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


  /** read-only
   *  Application#name -> String
   *
   *  Applications's name.
   **/
  this.__defineGetter__('name', function get_name() {
    return name;
  });


  this.__defineGetter__('config', function () {
    throw Error("Application was not bootstrapped yet.");
  });


  /**
   *  Application#bootstrap(appConfig, callback) -> Void
   *  Application#bootstrap(callback) -> Void
   *
   *  Configures and bootstraps (if bootstrapper was given in constructor)
   *  application.
   **/
  this.bootstrap = function bootstrap(appConfig, callback) {
    if (undefined === callback) {
      callback = appConfig;
      appConfig = {};
    }

    this.readConfig('defaults', function (err, config) {
      // remove config getter stub
      delete self.config;

      if (err) {
        self.__defineGetter__('config', function () { throw err; });
        callback(err);
        return;
      }

      $$.merge(config, appConfig);
      self.__defineGetter__('config', function () { return config; });

      if (bootstrapper) {
        bootstrapper(callback);
        return;
      }

      callback(null);
    });
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
    shared = mainApp.__shared__;
    return this;
  };


  /** 
   *  Application#init(appConfig, callback) -> Void
   *
   *  Initializes master application.
   **/
  this.init = function init(appConfig, callback) {
    var initializer; // initializer function

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
    initializer = require('./application/initializer').bind({
      self: this,
      hooks: hooks_registry,
      shared: Application.prototype,
      appConfig: appConfig
    });
   
    // run initializer
    initializer(callback);
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
 *  Application.addHook(name[, priority = 10], handler) -> Void
 *
 *  Registers given `handler` as `name` hook.
 *
 *
 *  ##### Available Hooks
 *
 *  TODO: Add list of available hooks
 *
 *
 *  ##### See Also
 *
 *  - [[HooksManager#add]]
 **/
Application.addHook = function addHook(name, priority, handler) {
  if (undefined === handler) {
    handler = priority;
    priority = 10;
  }

  hooks_registry.add(name, priority, handler);
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

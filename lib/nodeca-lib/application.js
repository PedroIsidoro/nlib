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
  var self = this, // self-reference
      main = this, // master app when this instance is sub-app
      name = get_app_name(dirname), // application name (from package.json)
      hooks = new HooksManager(VALID_HOOKS, this), // stack of hooks for app
      config = new Promise(), // defaults config were loaded
      logger = new Promise(), // logger were loaded
      mongoose = new Promise(), // db config were read and mongoose was connected
      apps, // hash of all loaded applications, see init()
      schemas, // hash of all loaded schemas, see init()
      models, // hash of all loaded models, see init()
      controllers, // hash of all loaded controllers, see init()
      routers; // hash of all loaded routers, see init()


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


  /**
   *  Application#getConfig(callback) -> Void
   *
   *  Fires `callback(err, config)` once `defaults` config of application was
   *  read and parsed.
   **/
  this.getConfig = config.done;


  /**
   *  Application#getLogger(callback) -> Void
   *
   *  Fires `callback(err, logger)` once logger is ready.
   **/
  this.getLogger = logger.done;


  /**
   *  Application#getMongoose(callback) -> Void
   *
   *  Fires `callback(err, mongoose)` once mongoose is connected to databse.
   **/
  this.getMongoose = mongoose.done;


  /**
   *  Application#bootstrap(appConfig, callback) -> Void
   *  Application#bootstrap(callback) -> Void
   *
   *  Configures and bootstraps (if bootstrapper was given in constructor)
   *  application.
   **/
  this.bootstrap = function bootstrap(appConfig, callback) {
    if (undefined === callback) {
      callback = config;
      config = {};
    }

    this.getConfig(function (err, appDefaults) {
      $$.merge(appDefaults, appConfig);

      if (bootstrapper) {
        bootstrapper(callback);
        return;
      }

      callback(null);
    });
  };


  // TODO:  getApplication, getSchema, getModel, getController are made in
  //        "callback" style because, in future they most likely will be
  //        scheduled to do their work after corresponding hook was fired.


  /**
   *  Application#getApplication(name, callback) -> Void
   *
   *  Returns instance of loaded application with specified name if found and
   *  fires `callback(err, app)`.
   **/
  this.getApplication = function getApplication(name, callback) {
    var found;

    if (main !== this) {
      main.getApplication(name, callback);
      return;
    }

    found = apps[name];

    if (!found) {
      callback(Error("Application " + name + " not found"));
      return;
    }

    callback(null, found);
  };


  /**
   *  Application#getSchema(name, callback) -> Void
   *
   *  Returns instance of loaded schema with specified name if found and
   *  fires `callback(err, schema)`.
   **/
  this.getSchema = function getSchema(name, callback) {
    var found;

    if (main !== this) {
      main.getSchema(name, callback);
      return;
    }

    found = schemas[name];

    if (!found) {
      callback(Error("Schema " + name + " not found"));
      return;
    }

    callback(null, found);
  };


  /**
   *  Application#getModel(name, callback) -> Void
   *
   *  Returns instance of loaded model with specified name if found and
   *  fires `callback(err, model)`.
   **/
  this.getModel = function getModel(name, callback) {
    var found;

    if (main !== this) {
      main.getModel(name, callback);
      return;
    }

    found = models[name];

    if (!found) {
      callback(Error("Model " + name + " not found"));
      return;
    }

    callback(null, found);
  };


  /**
   *  Application#getController(name, callback) -> Void
   *
   *  Returns instance of loaded controller with specified name if found and
   *  fires `callback(err, controller)`.
   **/
  this.getController = function getController(name, callback) {
    var found;

    if (main !== this) {
      main.getController(name, callback);
      return;
    }

    found = controllers[name];

    if (!found) {
      callback(Error("Controller " + name + " not found"));
      return;
    }

    callback(null, found);
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
    var initializer, // initializer function
        context; // context of initializer

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

    // init hash storages
    apps = {};
    schemas = {};
    models = {};
    controllers = {};
    routers = {};

    // expose private objects through binding them to the initializer
    var initializer = require('./application/initializer').bind({
      self: this,
      hooks: hooks,
      logger: logger,
      mongoose: mogoose,

      apps: apps,
      schemas: schemas,
      models: models,
      controllers: controllers,
      routers: routers,

      appConfig: appConfig
    });
   
    // run initializer
    initializer(callback);
  };


  // start resolving config promise
  this.readConfig('defaults', config.resolve);
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


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

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
  'apps-loaded',
  'schemas-loaded',
  'models-loaded',
  'views-loaded',
  'controllers-loaded',
  'routes-loaded',
  'public-assets-loaded',
  'static-lulz-loaded'
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
  if (!(this instanceof Application)) {
    return new Application(dirname, bootstrapper);
  }

  var self = this, // self-reference
      main = this, // master app when this instance is sub-app
      name = get_app_name(dirname), // application name (from package.json)
      hooks = new HooksManager(VALID_HOOKS, this), // stack of hooks for app
      config_ready = new Promise(), // defaults config were loaded
      logger_ready = new Promise(), // logger were loaded
      mongoose_ready = new Promise(), // db config were read and mongoose was connected
      apps_ready = new Promise(), // all loaded applications
      schemas_ready = new Promise(), // all loaded schemas
      models_ready = new Promise(), // all loaded models
      views_ready = new Promise(), // all loaded views
      controllers_ready = new Promise(), // all loaded controllers
      dispatcher_ready = new Promise(), // dispatcher was created and filled
      routers_ready = new Promise(), // all loaded routers
      static_builder_ready = new Promise(), // AssetsBuilder is filled with all public assets
      static_lulz_ready = new Promise(); // public/ assets dir is compiled


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
  this.getConfig = config_ready.done;


  /**
   *  Application#getLogger(callback) -> Void
   *
   *  Fires `callback(err, logger)` once logger is ready.
   **/
  this.getLogger = logger_ready.done;


  /**
   *  Application#getMongoose(callback) -> Void
   *
   *  Fires `callback(err, mongoose)` once mongoose is connected to databse.
   **/
  this.getMongoose = mongoose_ready.done;


  /**
   *  Application#getDispatcher(callback) -> Void
   *
   *  Fires `callback(err, dispatcher)` once dispatcher is created and filled.
   **/
  this.getDispatcher = dispatcher_ready.done;


  this.getAllApplications = apps_ready.done;
  this.getAllSchemas = schemas_ready.done;
  this.getAllModels = models_ready.done;
  this.getAllViews = views_ready.done;
  this.getAllRouters = routers_ready.done;
  this.getStaticBuilder = static_builder_ready.done;
  this.getStatcLulz = static_lulz_ready.done;


  /**
   *  Application#getApplication(name, callback) -> Void
   *
   *  Fires `callback(err, app)` with instance of loaded application with
   *  specified name if found.
   **/
  this.getApplication = function getApplication(name, callback) {
    this.getAllApplications(function (err, apps) {
      var found = apps[name];

      if (err) {
        callback(err);
        return;
      }

      if (!found) {
        callback(Error("Application " + name + " not found"));
        return;
      }

      callback(null, found);
    });
  };


  /**
   *  Application#getSchema(name, callback) -> Void
   *
   *  Returns instance of loaded schema with specified name if found and
   *  fires `callback(err, schema)`.
   **/
  this.getSchema = function getSchema(name, callback) {
    this.getAllSchemas(function (err, schemas) {
      var found = schemas[name];

      if (err) {
        callback(err);
        return;
      }

      if (!found) {
        callback(Error("Schema " + name + " not found"));
        return;
      }

      callback(null, found);
    });
  };


  /**
   *  Application#getModel(name, callback) -> Void
   *
   *  Returns instance of loaded model with specified name if found and
   *  fires `callback(err, model)`.
   **/
  this.getModel = function getModel(name, callback) {
    this.getAllModels(function (err, models) {
      var found = models[name];

      if (err) {
        callback(err);
        return;
      }

      if (!found) {
        callback(Error("Model " + name + " not found"));
        return;
      }

      callback(null, found);
    });
  };



  /**
   *  Application#getController(name, callback) -> Void
   *
   *  Returns instance of loaded controller with specified name if found and
   *  fires `callback(err, controller)`.
   **/
  this.getController = function getController(name, callback) {
    this.getAllControllers(function (err, controllers) {
      var found = controllers[name];

      if (err) {
        callback(err);
        return;
      }

      if (!found) {
        callback(Error("Controller " + name + " not found"));
        return;
      }

      callback(null, found);
    });
  };


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

    // expose some "shared" getters
    this.getLogger          = main.getLogger;
    this.getMongoose        = main.getMongoose;
    this.getDispatcher      = main.getDispatcher;
    this.getAllApplications = main.getAllApplications;
    this.getAllSchemas      = main.getAllSchemas;
    this.getAllModels       = main.getAllModels;
    this.getAllViews        = main.getAllViews;
    this.getAllControllers  = main.getAllControllers;
    this.getAllRouters      = main.getAllRouters;
    this.getStaticBuilder   = main.getStaticBuilder;
    this.getStaticLulz      = main.getStaticLulz;

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
      hooks: hooks,

      // expose private promises
      logger_ready:         logger_ready,
      mongoose_ready:       mongoose_ready,
      apps_ready:           apps_ready,
      schemas_ready:        schemas_ready,
      models_ready:         models_ready,
      views_ready:          views_ready,
      controllers_ready:    controllers_ready,
      dispatcher_ready:     dispatcher_ready,
      routers_ready:        routers_ready,
      static_builder_ready: static_builder_ready,
      static_lulz_ready:    static_lulz_ready,

      appConfig: appConfig
    });
   
    // run initializer
    initializer(callback);
  };


  // start resolving config promise
  this.readConfig('defaults', config_ready.resolve);
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

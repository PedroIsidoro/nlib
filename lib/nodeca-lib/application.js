/**
 *  class Application
 *
 *  Provides application creation class.
 *
 *  ##### Example
 *
 *      var app = new Application(__dirname, function bootstrapMyApp() {
 *        this.addHook('schemas_loaded', 5, function () {
 *          // do something here...
 *        });
 *      });
 **/


var path          = require('path'),
    fs            = require('fs'),
    express       = require('express'),
    railer        = require('express-railer'),
    winston       = require('winston'),
    HooksManager  = require('./application/hooks_manager');
    $$            = require('./utilities');


// list of valid hooks. don't forget to update [[Application#addHook]]
// documentation if it is changed
var VALID_HOOKS = [
  'bootstrapped',
  'schemas_loaded',
  'models_loaded',
  'controllers_loaded',
  'routes_loaded'
];


// returns Object representing package.json of application
var get_package_info = function get_package_info(app) {
  return $$.readJsonSync(path.join(dirname, 'package.json'), true) || {};
};


var init_database = function init_database(config) {
  throw Error("Not implemented yet");
  // this.conn = ...
};


var init_schemas = function init_schemas() {
  var dirname = path.join(this.dirname, 'app', 'models'),
      suffix_re = new RegExp('\.js$'),
      schemas = {};
 
  // TODO: read all files from models dir and create a hash of schemas

  return schemas;
};


var init_models = function init_models() {
  var models = {},
      mongoose = this.mongoose;

  $$.each(this.schemas, function (name, schema) {
    models[name] = mongoose.model(name, schema, schema.get('collection'));
  });

  return models;
};


var load_controllers = function load_controllers() {
  var dirname = path.join(this.dirname, 'app', 'controllers'),
      suffix_re = new RegExp('_controller\.js$'),
      controllers = {};

  // TODO: read all files from controllers dir and create a hash of controllers

  return controllers;
};


var load_routes = function load_routes() {
  var app = this;

  (this.config.routes || []).forEach(function (params) {
    // prepare constraints
    if (params.constraints) {
      Object.getOwnPropertyNames(params.constraints).forEach(function (key) {
        var str = params.constraints[key];
        // remove trailing slashes
        if ('/' == str.charAt(0)) {
          str = str.slice(1, -1);
        }
        params.constraints[key] = new RegExp(str);
      });
    }

    // attach route
    if (params.root) {
      app.router.root(params.root);
    } else if (params.match) {
      app.router.match($$.grab(params, 'match'), params);
    } else {
      throw Error('Unkown routes option');
    }
  });
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
 *  ##### Throws Error
 *
 *  - When app's root dir had no package.json, or when there were no application
 *    `name` defined.
 *
 *  ##### See Also
 *
 *  - [[Application#addHook]]
 **/
var Application = module.exports = function Application(dirname, bootstrapper) {
  var that = this, // self-reference
      super = this, // instance of host app if embeded, that-referene otherwise
      dispatcher = new railer.Dispatcher(), // app's dispatcher
      router = new railer.Router(this.dispatcher), // app's router
      schemas = {}, // cache of loaded schemas
      models = {}, // cache of loaded models
      controllers = {}, // cache of loaded controllers
      bootstrapped = false, // whenever app is bootstrapped yet or not
      initialized = false; // whenever app is initialized yet or not


  // loaded apps hash {name: app}
  var apps = {};


  // stacks of registered hooks
  var hooks = new HooksManager(VALID_HOOKS, this);


  /** internal
   *  Application#config -> Object
   *
   *  Application configuration got from `config/defaults.yml` and extended with
   *  config given when [[Application#bootstrap]] is called.
   **/
  this.config = $$.readYamlSync(path.join(dirname, 'config/defaults.yml', true)) || {};


  /** read-only
   *  Application#name -> String
   *
   *  Name of the application (module) from `package.json`.
   **/
  Object.defineProperty(this, 'name', {
    value: this.config.name || get_package_info().name, 
    writable: false
  });


  // disallow anonymous applications
  if (!this.name) {
    throw Error("Application has no package.json or no name was defined");
  }


  /** internal, read-only
   *  Application#dirname -> String
   *
   *  Applications's root directory
   **/
  this.__defineGetter__('dirname', function get_dirname() {
    return dirname;
  });


  /** internal, read-only
   *  Application#super -> Application
   *
   *  Instance of "host" application if any or self-reference otherwise
   *
   *  ##### See Also
   *
   *  - [[Application#embedInto]]
   *  - [[Application#embed]]
   **/
  this.__defineGetter__('super', function get_super() {
    return super;
  });


  /** read-only
   *  Application#dispatcher -> ExpressRailer.Dispatcher
   *
   *  Applications's dispatcher instance
   **/
  this.__defineGetter__('dispatcher', function get_dispatcher() {
    return dispatcher;
  });


  /** read-only
   *  Application#router -> ExpressRailer.Router
   *
   *  Application's router instance
   **/
  this.__defineGetter__('router', function get_router() {
    return router;
  });


  this.__defineGetter__('schemas', function get_schemas() {
    return $$.merge({}, schemas);
  });


  /** read-only
   *  Application#log -> Winston.Logger
   *
   *  Proxy to super app's logger if any.
   **/
  this.__defineGetter__('log', function get_logger() {
    if (!super.log) {
      super.log = winston;
    }

    return super.log;
  });


  /**
   *  Application#require(filename) -> Mixed
   *  - filename (String): File realtive to app's `lib` directory
   *
   *  Returns result of core `require` function against specified `filename`
   *  under `lib/` directory off application.
   **/
  this.require = function require(filename) {
    return require(path.join(dirname, 'lib', filename));
  };


  /** chainable
   *  Application#bootstrap([config = {}]) -> Application
   *  - config (Object): Application config overriding app's defaults
   *
   *  Merges-in provided config and calls bootstrapper provided in constructor.
   *
   *  ##### Throws Error
   *
   *  - If application was already bootstrapped
   **/
  this.bootstrap = function bootstrap(config) {
    if (bootstrapped) {
      throw Error("Application was already bootstrapped");
    }

    bootstrapped = true;
    $$.deepMerge(this.config, config || {});

    if ('function' === typeof bootstrapper) {
      bootstrapper.call(this);
    }

    return this;
  };


  /** chainable
   *  Application#addHook(name[, priority = 10], handler) -> Application
   *
   *  Registers given `handler` as `name` hook of super (host) appliction
   *  (see [[Application#super]]). Each handler will be fired with current
   *  application instance as `this` context.
   *
   *  **WARNING** This method should be used only inside `bootstrapper`.
   *
   *  ##### Available Hooks
   *
   *  - *bootstrapped* - Executed once all applications were bootstrapped
   *  - *schemas_loaded* - Executed once all schemas were loaded
   *  - *models_loaded* - Executed once all models were created from schemas
   *  - *controllers_loaded* - Executes once all controllers were loaded
   *  - *routes_loaded* - Executed once all routes were processed and assigned
   *
   *  ##### See Also
   *
   *  - [[Application#bootstrap]]
   *  - [[HooksManager#add]]
   *  - [[HooksManager#exec]]
   **/
  this.addHook = function addHook(name, priority, handler) {
    // add hook into host app's stack if app was embedded
    if (super !== this) {
      super.addHook(name, priority, handler);
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
   *  Application#embedInto(superApp) -> Application
   *  - superApp (Application): Instance of host application to become master.
   *
   *  Embeds application into master (host) application.
   *
   *  ##### Throws Error
   *
   *  - When application was already embeded before
   **/
  this.embedInto = function embedInto(superApp) {
    if (super !== this) {
      throw Error("Application was already embedded before")
    }

    super = superApp;
    return this;
  };


  /** chainable
  *  Application#init([config = {}]) -> Application
  *
  *  Initializes application. You can specify `config` object to override default
  *  settings of `config/defaults.yml`.
  *
  *  ##### Throws Error
  *
  *  - When called more than once.
  **/
  this.init = function init(config) {
    if (!!initialized) {
      throw Error("Application '" + this.name + "' was already initialized");
    }

    // mark application as initialized
    initialized = true;

    var log = this.log.info('Initializing ' + this.name || '<unknown>');

    init_database.call(app, config.database);

    // register ourthat in the applications hash
    apps[this.name] = this.bootstrap(config);

    // load apps
    $$.each(this.config.modules || {}, function (name, config) {
      apps[name] = require(name).embedInto(this).bootstrap(config);
    });

    hooks.run('bootstrapped');

    // load schemas
    $$.each(apps, function (name, app) {
      schemas = $$.merge({}, load_schemas.call(app), schemas);
    });

    hooks.run('schemas_loaded');

    // load models
    $$.each(apps, function (name, app) {
      models = $$.merge({}, load_models.call(app), models);
    });

    hooks.run('models_loaded');

    // load controllers
    $$.each(apps, function (name, app) {
      controllers = $$.merge({}, load_controllers.call(app), controllers);
    });

    hooks.run('controllers_loaded');

    // load routes
    $$.each(apps, function (name, app) {
      load_routes.call(app);
    });

    hooks.run('routes_loaded');

    return this;
  };


  this.getApp = function getApp(name) {
    throw Error("Not implemented yet");
  };


  this.getSchema = function getSchema(name) {
    throw Error("Not implemented yet");
  };


  this.getModel = function getModel(name) {
    throw Error("Not implemented yet");
  };


  this.getController = function getController(name) {
    throw Error("Not implemented yet");
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

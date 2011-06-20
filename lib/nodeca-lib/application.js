/**
 *  class Application
 *
 *  Provides application creation class.
 *
 *  ##### Example
 *
 *      var app = new Application(__dirname, function bootstrapMyApp() {
 *        this.addHook(Application.HOOKS.SCHEMAS_LOADED, 5, function () {
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


// Loads controller to the app dispatcher
var loadControllers = function loadControllers(app) {
  var dirname = path.join(app.__dirname__, 'app', 'controllers'),
      suffix_re = new RegExp('_controller\.js$');

  fs.readdir(dirname, function (err, files) {
    if (err) {
      throw err;
    }

    files.forEach(function (filename) {
      if (filename.match(suffix_re)) {
        var controller = require(path.join(dirname, filename));
        app.dispatcher.addController(new controller(app));
      }
    });
  });
};


// Fills app router with routes
var loadRoutes = function loadRoutes(app) {
  app.getConfig(function (err, config) {
    (config.routes || []).forEach(function (params) {
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
  });
};


var HOOKS = {
  BOOTSTRAPPED: 'bootstrapped',
  SCHEMAS_LOADED: 'schemas-loaded',
  MODELS_LOADED: 'models-loaded',
  CONTROLLERS_LOADED: 'controllers-loaded',
  ROUTES_LOADED: 'routes-loaded'
};


/**
 *  new Application(dirname[, bootstrapper])
 *  - dirname (String): Application's root directory
 *  - bootstrapper (Function): Callback used by [[Application#bootstrap]]
 *
 *  Creates new nodeca application with given `dirname` as application root.
 *
 *  ##### Example
 *
 *  var app = new (require('nodeca-lib').Application)(__dirname);
 *
 *  ##### Throws Error
 *
 *  - When app's root dir had no package.json, or when there were no application
 *    `name` defined.
 **/
var Application = module.exports = function Application(dirname, bootstrapper) {
  var that = this, // that-reference
      super = this, // instance of host app if embeded, that-referene otherwise
      dispatcher = new railer.Dispatcher(), // app's dispatcher
      router = new railer.Router(this.dispatcher), // app's router
      bootstrapped = false, // whenever app is bootstrapped yet or not
      initialized = false; // whenever app is initialized yet or not


  // loaded apps hash {name: app}
  var apps = {};


  // stacks of registered hooks
  var hooks = new HooksManager($$.values(HOOKS));


  /** internal
   *  Application#__config__ -> Object
   *
   *  Application configuration
   **/
  this.__config__ = $$.readYamlSync(path.join(dirname, 'config/defaults.yml', true)) || {};


  /** internal
   *  Application#__info__ -> Object
   *
   *  Application description info (normally comes from package.json).
   **/
  this.__info__ = $$.readJsonSync(path.join(dirname, 'package.json'), true) || {};



  // disallow anonymous applications
  if (!this.__info__.name) {
    throw Error("Application has no package.json or no name was defined");
  }


  /** internal, read-only
   *  Application#__dirname__ -> String
   *
   *  Applications's root directory
   **/
  this.__defineGetter__('__dirname__', function get_dirname() {
    return dirname;
  });


  /** internal, read-only
   *  Application#__super__ -> Application
   *
   *  Instance of "host" application if any or self-reference otherwise
   *
   *  ##### See Also
   *
   *  - [[Application#embedInto]]
   *  - [[Application#embed]]
   **/
  this.__defineGetter__('__super__', function get_super() {
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
   *  Merges in provided config and bootstraps application with bootstrapper
   *  provided in constructor (if any).
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
    $$.deepMerge(that.__config__, config || {});

    if ('function' === typeof bootstrapper) {
      bootstrapper.call(that);
    }

    return that;
  };


  /** chainable
   *  Application#addHook(name[, priority = 10], callback) -> Application
   *
   *  Registers given `callback` as `name` hook of host appliction
   *  (see [[Application#__super__]]).
   *
   *  ##### See Also
   *
   *  - [[Application.HOOKS]]
   *  - [[HooksManager#add]]
   **/
  this.addHook = function addHook(name, priority, callback) {
    // add hook into host app's stack if app was embedded
    if (super !== this) {
      super.addHook(name, priority, callback);
    } else {
      if (undefined === callback) {
        callback = priority;
        priority = 10;
      }

      hooks.add(name, priority, callback);
    }

    return that;
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
    if (super !== that) {
      throw Error("Application was already embedded before")
    }

    super = superApp;

    return that;
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

    var log = that.log;

    log.info('Initializing ' + this.name || '<unknown>');

    // merg-in config
    $$.deepMerge(that.__config__, config || {});

    // TODO: initialize database

    apps[this.name] = this.bootstrap(config); // register ourthat in the applications hash

    // load apps
    $$.each(this.__config__.modules || {}, function (name, config) {
      apps[name] = require(name).embedInto(this).bootstrap(config);
    });

    hooks.run(HOOKS.BOOTSTRAPPED);

    // load schemas
    $$.each(apps, function (name, app) {
      schemas = $$.merge({}, loadSchemas(app), schemas);
    });

    hooks.run(HOOKS.SCHEMAS_LOADED);

    // load models
    $$.each(apps, function (name, app) {
      models = $$.merge({}, loadModels(app), models);
    });

    hooks.run(HOOKS.MODELS_LOADED);

    // load controllers
    $$.each(apps, function (name, app) {
      controllers = $$.merge({}, loadControllers(app), controllers);
    });

    hooks.run(HOOKS.CONTROLLERS_LOADED);

    // load routes
    $$.each(apps, function (name, app) {
      loadRoutes(app);
    });

    hooks.run(HOOKS.ROUTES_LOADED);

    return this;
  };
};


/** read-only
 *  Application#name -> String
 *
 *  Returns application name.
 *
 *  ##### See Also
 *
 *  - [[Application#__info__]]
 **/
Application.prototype.__defineGetter__('name', function get_name() {
  return this.__info__.name;
});


/**
 *  Application.HOOKS -> Object
 *
 *  Available application hooks
 **/
Application.HOOKS = HOOKS;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

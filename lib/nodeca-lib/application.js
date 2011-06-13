/**
 *  class Application
 *
 *  Provides application creation class.
 *
 *  ##### Example
 *
 *      var app = new Application(__dirname, ['application.yml']);
 **/


var path    = require('path'),
    fs      = require('fs'),
    express = require('express'),
    railer  = require('express-railer'),
    winston = require('winston'),
    Promise = require('./promise'),
    $$      = require('./utilities');


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


/**
 *  new Application(dirname)
 *  - dirname (String): Application's root directory
 *
 *  Creates new nodeca application with given `dirname` as appliction root.
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
var Application = module.exports = function Application(dirname) {
  var self = this, // self-reference
      super = this, // instance of host app if embeded, self-referene otherwise
      dispatcher = new railer.Dispatcher(), // app's dispatcher
      router = new railer.Router(this.dispatcher); // app's router


  /** internal
   *  Application#__apps__ -> Object
   *
   *  Sub-applications hash.
   *
   *  ##### See Also
   *
   *  - [[Application#embed]]
   **/
  this.__apps__ = {};


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
    if (super !== self) {
      throw Error("Application was already embedded before")
    }

    super = superApp;
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


/** chainable
 *  Application#embed(name[, config]) -> Application
 *  - name (String): Name of the application to embed
 *  - config (Object): Configuration for initilizer if needed
 *
 *  Embeds and initializes application.
 *
 *  ##### See Also
 *
 *  - [[Application#__apps__]]
 *  - [[Application#embedInto]]
 **/
Application.prototype.embed = function embed(name, config) {
  config = config || {};

  var app = require(name),
      mnt = $$.grab(config, 'mount') || {path: '/' + name};

  app.embedInto(this).init(config);

  // do not mount app if requested
  if (!mnt.no_mount) {
    this.router.mount(mnt, app.router);
  }

  // register app
  this.__apps__[name] = app;

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
Application.prototype.init = function init(config) {
  if (undefined !== this.__initialized__) {
    throw Error("Application '" + this.__info__.name + "' was already initialized");
  }

  // mark application as initialized
  this.__initialized__ = true;

  var self = this,
      models_dir = path.join(this.__dirname__, 'app', 'models'),
      log = this.log;

  log.info('Initializing ' + this.__info__.name || '<unknown>');

  // merge in config
  $$.deepMerge(this.__config__, config || {});

  // load models
  if (fs.statSync(models_dir).isDirectory()) {
    log.debug('Loading models');
    fs.readdirSync(models_dir).forEach(function (file) {
      // initialize model with self-reference
      (require(file))(self);
    });
  }

  log.debug('Loading controllers');
  loadControllers(self);

  log.debug('Loading routes');
  loadRoutes(self);

  return this;
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

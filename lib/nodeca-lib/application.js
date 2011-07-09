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
    Promise       = require('./promise');
    $$            = require('./utilities');


// list of valid hooks. don't forget to update [[Application#addHook]]
// documentation if it is changed
var VALID_HOOKS = [
  'bootstrapped',
  'schemas-loaded',
  'models-loaded',
  'controllers-loaded',
  'routes-loaded'
];


// foo_bar => FooBar
var beautify = function beautify(str) {
  str = $$.camelCase(str.replace(/[-_]+/g, ' '));
  return str.charAt(0).toUpperCase() + str.slice(1);
}


var get_mongoose_uri = function get_mongoose_uri(config) {
  if (!config.database) {
    throw Error("Database config has no database name");
  }

  var uri = 'mongodb://';

  // add user and pass if user specified
  if (config.user && config.user.length) {
    uri += config.user;

    if (config.password && config.password.length) {
      uri += ':' + config.password;
    }

    uri += '@';
  }

  // add host:portdatabase
  uri += (config.host || 'localhost') + ':' + (config.port || 27017);

  // and /databse
  uri += '/' + config.database;

  return uri;
};


var init_database = function init_database(callback) {
  var config;
 
  try {
    config = this.readConfig('database', this.env);
  } catch (err) {
    err.message = "Database config error: " + err.message;
    throw err;
  }

  var uri = get_mongoose_uri(config);

  this.mongoose = require('mongoose');
  this.mongoose.connect(uri, callback);
};


var init_schemas = function init_schemas() {
  var self = this,
      debug = this.log.debug,
      dirname = path.join(this.dirname, 'app', 'models'),
      suffix_re = new RegExp('\.js$'),
      schemas = {};

  if (path.existsSync(dirname)) {
    fs.readdirSync(dirname).forEach(function (file) {
      if (suffix_re.test(file)) {
        var name = $$.parameterize(file.replace(suffix_re, ''));
        debug('  > ' + name);
        schemas[name] = (require(path.join(dirname, file)))(self);
      }
    });
  }

  return schemas;
};


var init_models = function init_models() {
  var models = {},
      debug = this.log.debug,
      mongoose = this.mongoose;

  $$.each(this.schemas, function (name, schema) {
    var nice_name = beautify(name), // user-post -> UserPost
        collection = schema.set('collection');

    // imho `set` is the most idiotic name for accessor

    debug('  > ' + nice_name);
    models[name] = mongoose.model(nice_name, schema, collection);
  });

  return models;
};


var init_controllers = function init_controllers() {
  var self = this,
      debug = this.log.debug,
      dirname = path.join(this.dirname, 'app', 'controllers'),
      suffix_re = new RegExp('_controller\.js$'),
      controllers = {};

  if (path.existsSync(dirname)) {
    fs.readdirSync(dirname).forEach(function (file) {
      var name = $$.parameterize(file.replace(suffix_re, '')),
          controller = require(path.join(dirname, file));

      debug('  > ' + name);
      controllers[name] = new controller(self);
    });
  }

  return controllers;
};


var init_each = function init_each(apps, collection, callback) {
  var log = this.log.debug('--- ' + callback.name);

  // iterate through each application
  $$.each(apps, function (appName, app) {
    log.debug(' >> ' + appName); 

    // iterate through hash returned by `callback`
    $$.each(callback.call(app), function (name, item) {
      log.debug('  > ' + name);

      // raise error if collection already has such name
      if (collection.hasOwnProperty(name)) {
        throw Error('Duplicate name=' + name + ' in app=' + appName);
      }

      collection[name] = item;
    });
  });

  log.debug('+++ ' + callback.name);
};


var init_routes = function init_routes() {
  var app = this;

  // each route (params) may be something like this:
  //
  //    root: foo#bar
  //
  // is a shortcut to:
  //
  //    match: /
  //    to: foo#bar
  //
  // in other words `match` and `root` are "actions" of router, everything else
  // is second argument of router's `match` method.
  (this.config.routes || []).forEach(function (params) {
    // prepare constraints
    if (params.constraints) {
      Object.getOwnPropertyNames(params.constraints).forEach(function (key) {
        var str = params.constraints[key];
        // remove trailing slashes
        if ('/' == str.charAt(0) && '/' == str.charAt(str.length - 1)) {
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
  var self = this, // self-reference
      super = this, // instance of host app if embeded, self-referene otherwise
      log = null, // logger instance, see this.log getter
      dispatcher = new railer.Dispatcher(), // app's dispatcher
      router = new railer.Router(dispatcher), // app's router
      schemas = {}, // cache of loaded schemas
      models = {}, // cache of loaded models
      controllers = {}, // cache of loaded controllers
      bootstrapped = false, // whenever app is bootstrapped yet or not
      initialized = false; // whenever app is initialized yet or not


  // promises that helps to decide if app is ready or not
  var db_ready = new Promise();
  this.ready = db_ready.done;


  // loaded apps hash {name: app}
  var apps = {};


  // stacks of registered hooks
  var hooks = new HooksManager(VALID_HOOKS, this);


  /** read-only
   *  Application#name -> String
   *
   *  Name of the application (module) from `package.json`.
   **/
  Object.defineProperty(this, 'name', {
    value: Application.getPackageInfo(dirname).name, 
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


  /** read-only
   *  Application#schemas -> Object
   *
   *  Copy of hash holding schemas registered in application.
   **/
  this.__defineGetter__('schemas', function get_schemas() {
    return $$.merge({}, schemas);
  });


  /** read-only
   *  Application#log -> Winston.Logger
   *
   *  Proxy to super app's logger if any.
   **/
  this.__defineGetter__('log', function get_logger() {
    if (super !== this) {
      return super.log;
    } 

    if (null === log) {
      log = winston;
    }

    return log;
  });


  /** internal
   *  Application#config -> Object
   *
   *  Application configuration got from `config/defaults.yml` and extended with
   *  config given when [[Application#bootstrap]] is called.
   **/
  this.config = this.readConfig('defaults');


  /** chainable
   *  Application#bootstrap([config = {}]) -> Application
   *  - config (Object): Application config overriding app's defaults
   *
   *  Merges-in given config and calls bootstrapper (if provided in constructor).
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

    // init database for host app only
    if (this.super === this) {
      init_database.call(this, db_ready.resolve);
    } else {
      this.mongoose = this.super.mongoose;
    }

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
   *  - *schemas-loaded* - Executed once all schemas were loaded
   *  - *models-loaded* - Executed once all models were created from schemas
   *  - *controllers-loaded* - Executes once all controllers were loaded
   *  - *routes-loaded* - Executed once all routes were processed and assigned
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
  *  - When failed to parse or invalid database config.
  *  - On duplicate name of app, schema, model or controller.
  *  - When error occured during bootstraping.
  *  - When error occured during (schemas|models|controllers|routes) loading.
  *  - When error was thrown by one of [[Application#addHook]] handlers.
  **/
  this.init = function init(config) {
    if (!!initialized) {
      throw Error("Application '" + this.name + "' was already initialized");
    }

    // mark application as initialized
    initialized = true;

    var log = this.log.info('Initializing ' + this.name || '<unknown>');

    // bootstrap and register ourself in the applications hash
    log.info('*** Bootstraping main application...');
    this.bootstrap(config || {});
    apps[this.name] = this;

    // load child apps
    log.info('*** Loading sub-applications...');
    $$.each(this.config.modules || {}, function (name, config) {
      log.debug(' >> ' + name);

      var app = require('nodeca-' + name);

      if (apps.hasOwnProperty(app.name)) {
        throw Error("Duplicate application name=" + app.name + " provided by module=" + name);
      }

      apps[$$.parameterize(app.name)] = app.embedInto(self).bootstrap(config);
    });

    hooks.exec('bootstrapped');

    // init schemas
    log.info('*** Loading schemas...');
    init_each.call(this, apps, schemas, init_schemas);
    hooks.exec('schemas-loaded');

    // init models
    log.info('*** Loading models...');
    init_each.call(this, apps, models, init_models);
    hooks.exec('models-loaded');

    // init controllers
    log.info('*** Loading controllers...');
    init_each.call(this, apps, controllers, init_controllers);
    hooks.exec('controllers-loaded');

    // init routes
    log.info('*** Loading routes...');
    $$.each(apps, function (name, app) { init_routes.call(app); });
    hooks.exec('routes-loaded');

    // mount sub-apps
    log.info('*** Mounting sub-apps...');
    $$.each(apps, function (name, app) {
      var mnt = app.config.mount || {path: '/' + $$.parameterize(app.name)};
      router.mount(mnt, app.router);
    });

    return this;
  };


  /**
   *  Application#getApp(name) -> Application|Null
   *
   *  Returns instance of `name` application, if it was embedded upon
   *  [[Application#init]], `NULL` otherwise.
   *
   *  Name should be same as defined in `package.json`.
   *
   *  ##### Example
   *
   *      var usersApp = this.getApp('nodeca-users');
   *
   *  ##### See Also
   *
   *  - [[Application#name]]
   **/
  this.getApp = function getApp(name) {
    name = $$.parameterize(name);

    if (super !== this) {
      return super.getApp(name);
    }

    if (apps.hasOwnProperty(name)) {
      return apps[name];
    }

    return null;
  };


  /**
   *  Application#getSchema(name) -> Mongoose.Schema|Null
   *
   *  Returns instance of `name` schema, if it was initilized and registered
   *  upon [[Application#init]], `NULL` otherwise.
   *
   *  ##### Example
   *
   *      var postSchema = this.getSchema('BlogPost');
   **/
  this.getSchema = function getSchema(name) {
    name = $$.parameterize(name);

    if (super !== this) {
      return super.getSchema(name);
    }

    if (schemas.hasOwnProperty(name)) {
      return schemas[name];
    }

    return null;
  };


  /**
   *  Application#getModel(name) -> Mongoose.Model|Null
   *
   *  Returns instance of `name` model, if it was initilized and registered
   *  upon [[Application#init]], `NULL` otherwise.
   *
   *  ##### Example
   *
   *      var postModel = this.getModel('BlogPost');
   **/
  this.getModel = function getModel(name) {
    name = $$.parameterize(name);

    if (super !== this) {
      return super.getModel(name);
    }

    if (models.hasOwnProperty(name)) {
      return models[name];
    }

    return null;
  };


  /**
   *  Application#getController(name) -> ExpressRailer.Controller|Null
   *
   *  Returns instance of `name` controller, if it was initilized and registered
   *  upon [[Application#init]], `NULL` otherwise.
   *
   *  ##### Example
   *
   *      var controller = this.getController('post');
   **/
  this.getController = function getController(name) {
    name = $$.parameterize(name);

    if (super !== this) {
      return super.getController(name);
    }

    if (controllers.hasOwnProperty(name)) {
      return controllers[name];
    }

    return null;
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


/**
 *  Application#getConfigFile(name) -> String
 *
 *  Returns full pathname of `name` config.
 *
 *  ##### Example
 *
 *  Assuming app is placed under /srv/red-hot-chili-peppers
 *
 *      app.getConfigFile('database');
 *      // -> /srv/red-hot-chili-peppers/config/database.yml
 **/
Application.prototype.getConfigFile = function getConfigFile(name) {
  return path.join(this.dirname, 'config', name + '.yml');
};


/**
 *  Application#readConfig(name[, env]) -> Object
 *
 *  Reads and parses `config/<name>.yml` file of application. If `env` is
 *  given returns merged `general` and `env` sections of config.
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
 *      var cfg = app.readConfig('application');
 *      // -> {general: {foo: 'bar'}, production: {baz: 'baz'}}
 *
 *  Or syntethic config for environment:
 *
 *      var cfg = app.readConfig('application', 'production');
 *      // -> {foo: 'bar', baz: 'baz'}
 *
 *  ##### Throws Error
 *
 *  - If file not found
 *  - If failed to read or parse file
 *
 *  ##### See Also
 *
 *  - [[Application#getConfigFile]]
 *  - [[Utilities.readYamlSync]]
 **/
Application.prototype.readConfig = function readConfig(name, env) {
  var file = this.getConfigFile(name),
      data = {};

  if (!path.existsSync(file)) {
    throw Error('Config file not found. file=' + file);
  }

  // read config into data object
  $$.merge(data, $$.readYamlSync(file));

  return !!env ? $$.merge({}, data.general, data[env]) : data;
};


/**
 *  Application.getPackageInfo(dirname[, filename = 'package.json']) -> Object
 *
 *  Reads `filename` as JSON and returns result. Retuns empty object if any
 *  error (even if file was not found).
 *
 *  **NOTICE** File should be UTF-8 encoded.
 **/
Application.getPackageInfo = function getPackageInfo(dirname, filename) {
  try {
    var file = path.join(dirname, filename || 'package.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    return {};
  }
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

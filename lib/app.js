var path    = require('path'),
    fs      = require('fs'),
    yaml    = require('yaml'),
    express = require('express'),
    railer  = require('express-railer'),
    $$      = require('./utilities');


// error codes
var ERR_CONFIG  = 128;
var ERR_INIT    = 129;
var ERR_START   = 130;


// Outputs error to stderr and terminates process with given code
var halt = function halt(err, code) {
  console.error(err.stack.toString());
  process.exit(code || 1);
};


// Reads YAML config file
var readConfig = function readConfig(file) {
  return yaml.eval(fs.readFileSync(file).toString());
};


// Loads controller to the app dispatcher
var loadControllers = function loadControllers(app) {
  var dirname = path.join(app.__dirname__, 'app', 'controllers'),
      suffix_re = new RegExp('_controller\.js$');

  fs.readdir(dirname, function(err, files) {
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
  (app.__config__.routes || []).forEach(function (params) {
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
 *  new App(dirname)
 *
 *  Creates new nodeca application with given `dirname` as appliction root.
 *
 *  ##### Example
 *
 *  var app = new (require('nodeca-lib').App)(__dirname);
 *  app.start();
 **/
var App = module.exports = function App(dirname) {
  var libs_dir = path.join(dirname, 'lib/'),
      models_dir = path.join(dirname, 'app/models/');


  /**
   *  App#__dirname__ -> String
   *
   *  **PRIVATE**
   *  Application root dir.
   **/
  this.__dirname__ = dirname;



  /**
   *  App#__config__ -> Object
   *
   *  **PRIVATE**
   *  Application configuration.
   **/
  this.__config__ = null;


  /**
   *  App#require(file) -> Mixed
   *  - file (String): File realtive to app's `lib` directory
   *
   *  Returns result of core `require` function against specified `file` under
   *  `lib/` directory.
   **/
  this.require = function require(file) {
    return require(path.join(libs_dir, file));
  };



  /**
   *  App#model(name) -> Object
   *  - name (String): Model name under `app/models` directory
   *
   *  Returns `Mongoose` model from `app/models/` directory
   **/
  this.model = function model(name) {
    return require(path.join(models_dir, name));
  };


  /**
   *  App#dispatcher -> ExpressRailer.Dispatcher
   *
   *  Instance of application dispatcher.
   **/
  this.dispatcher = new railer.Dispatcher();


  /**
   *  App#router -> ExpressRailer.Router
   *
   *  Instance of application router.
   **/
  this.router = new railer.Router(this.dispatcher);
};


/**
 *  App#init(config, callback) -> Void
 *
 *  Initializes application. You can specify `config` object to override default
 *  settings of `config/app.defaults.yml`, After all `callback` is called with
 *  Error if any occured and application itself (if everything is ok).
 **/
App.prototype.init = function init(config, callback) {
  if (null !== this.__config__) {
    callback(Error('Applcation was already initialized before.'));
    return;
  }

  try {
    var defaults = path.join(this.__dirname__, 'config', 'app.defaults.yml');
    this.__config__ = $$.deepMerge(readConfig(defaults), config || {});

    loadControllers(this);
    loadRoutes(this);

    callback(null, this);
  } catch (err) {
    callback(err, this);
  }
};


// Creates error handler
var initErrorHandler = function initErrorHandler(dispatcher) {
  var controller = 'errors';
  var action     = 'error';

  if (!dispatcher.isDispatchable({"controller": controller, "action": action})) {
    return function (err, req, res, next) {
      res.send(err.message, 500);
    }
  }

  return function(err, req, res, next) {
    logger.error(err, req);
    logger.debug(err.stack);

    req.originalController  = req.controller;
    req.originalAction      = req.action;
    req.controller          = controller;
    req.action              = action;
    req.error               = err;

    dispatcher.dispatch(req, res, next);
  }
};


/**
 *  App#start() -> Void
 *
 *  Configures and runs standalone application.
 **/
App.prototype.start = function start() {
  try {
    var app = this,
        cfg = (function(cfg) {
          var general = $$.grab(cfg, 'general') || {},
              env_cfg = $$.grab(cfg, process.env.NODE_ENV) || {};
          return $$.deepMerge(general, env_cfg);
        })(readConfig(path.join(app.__dirname__, 'config', 'app.yml')));

    app.init(cfg, function (err, app) {
      if (err) {
        halt(err, ERR_INIT);
        return;
      }

      // create server and run it
      var server = express.createServer();

      // set view engine and some default options
      server.set('view engine', 'jade');
      server.set('view options', {layout: 'layouts/default'});

      // set request handlers chain
      server.use(express.static(path.join(app.dirname, 'public')));
      server.use(express.bodyParser());
      server.use(express.methodOverride());
      server.use(express.cookieParser());
      server.use(server.router);

      // last handler starts new cycle with error
      server.use(function RouteNotFound(req, res, next) {
        var err  = new Error('Not Found');
        err.code = 404;
        return next(err);
      });

      // register rerror handler should be configured
      server.error(initErrorHandler(app.dispatcher));

      // register heplers
      server.helpers({
        config: function (section) { return app.config[section]; }
      });

      // inject routes
      app.router.inject(server);

      // start server
      var listen = $$.deepMerge({port: 8000}, app.__config__.listen);
      server.listen(listen.port, listen.host);
    });
  } catch (err) {
    halt(err, ERR_START);
  }
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

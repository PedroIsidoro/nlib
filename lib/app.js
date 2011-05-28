var path    = require('path'),
    fs      = require('fs'),
    yaml    = require('yaml'),
    railer  = require('express-railer'),
    $$      = require('./utilities');


var App = module.exports = function App(dirname) {
  this.__dirname = dirname;


  this.require = function require(file) {
    return require(path.join(dirname, 'lib', file));
  };


  this.model = function load_model(name) {
    return require(path.join(dirname, 'app/models', file));
  };
};



var loadControllers = function loadControllers(dirname) {

};


var loadRoutes = function loadRoutes(routes) {

};



App.prototype.init = function init(config, callback) {
  if (undefined == callback) {
    callback = config;
    config   = false;
  }

  if (this.__config && false == config) {
    callback(null, this);
    return;
  }

  var file = path.join(this.__dirname, 'config', 'app.defaults.yml'),
      app  = this;

  fs.readFile(cfg_file, function (err, data) {
    if (err) {
      callback(err, app);
      return;
    }

    try {
      var defaults = yaml.eval(data.toString());
      app.__config = $$.deepMerge(defaults, config || {});

      app.logger = require('winston');

      loadControllers(path.join(app.__dirname, 'controllers'));
      loadRoutes(app.__config.routes);

      callback(null, app);
    } catch (err) {
      callback(err, app);
    }
  });
};



Object.defineProperties(App.prototype, {
  dispatcher: {
    get: function get_dispatcher() {
      if (!this.__dispatcher) {
        this.__dispatcher = new railer.Dispatcher();
      }

      return this.__dispatcher;
    }
  },
  router: {
    get: function get_router() {
      if (!this.__router) {
        this.__router = new railer.Router(this.dispatcher);
      }

      return this.__router;
    }
  }
});

// error codes
var ERR_CONFIG  = 128;
var ERR_INIT    = 129;


// Outputs error to stderr and terminates process with given code
var halt = function halt(err, code) {
  console.error(err);
  process.exit(code || 255);
};

// Creates error handler
var initErrorHandler = function initErrorHandler(dispatcher) {
  var controller = 'errors';
  var action     = 'error';

  if (!dispatcher.isDispatchable({"controller": controller, "action": action})) {
    halt(Error("ErrorHandler's controller/action are not dispatchable"), ERR_CONFIG);
    return;
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
  var app = this;

  // read standalone app config
  app.readConfig('app.yml', function (err, config) {
    if (err) {
      halt(err, ERR_CONFIG);
      return;
    }

    // init application with extra config added
    app.init(config, function (err, app) {
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
      var listen = {
        host: app.config.listen.host || '0.0,0,0',
        port: app.config.listen.port || 8000
      }

      server.listen(listen.port, listen.host);
      app.logger.info('Server started...', {
        "host": listen.host,
        "port": listen.port
      });
    });
  });
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

'use strict';


// 3rd-party
var Express = require('express'),
    Promise = require('simple-promise');


// internal
var $$ = require('./utilities');


var init_app = function init_app(next) {
  $$.waterfall(this)
    .queue(function (next) {
      this.app.init(this.config, next);
    })
    .queue(function (next) {
      var context = this;
      this.app.getLogger(function (err, logger) {
        if (err) {
          next(err);
          return;
        }

        cnotext.logger = logger;
        next(null);
      });
    })
    .run(next);
};


var init_server_config = function init_server_config(next) {
  var server = this.server;
  this.app.getAllViews(function (err, dir) {
    server.set('views', dir);
    server.set('view engine', 'jade');
    server.set('view options', {layout: 'layouts/default'});
    next();
  });
};


var init_middleware_stack = function init_middleware_stack(next) {
  var app = this.app,
      log = this.logger,
      server = this.server,
      finished = new Promise.Joint(),
      lulz, dispatcher;

  app.getStatcLulz(finished.promise().resolve);
  app.getDispatcher(finished.promise().resolve);

  finished.wait().done(function (err, p1, p2) {
    if (err = err || p1[0] || p2[0]) {
      next(err);
      return;
    }

    lulz = p1[1], dispatcher = p2[1];

    server.use(lulz.middleware);
    server.use(Express.bodyParser());
    server.use(Express.methodOverride());
    server.use(Express.cookieParser());
    server.use(server.router);
  
    // last handler starts new cycle with error
    server.use(function RouteNotFound(req, res, next) {
      var err  = new Error('Not Found');
      err.code = 404;
      return next(err);
    });
  
    // register rerror handler should be configured
    server.error(function(err, req, res, next) {
      log.error(err, req).error(err.stack);
  
      req.originalController  = req.controller;
      req.originalAction      = req.action;
      req.controller          = 'errors';
      req.action              = 'error';
      req.error               = err;
  
      dispatcher.dispatch(req, res, next);
    });

    // expose lulz linkTo helper
    server.helpers({lulz_link: lulz.helper});
  });
};


var init_routes = function init_routes(next) {
  var server = this.server,
      app_name = this.app.name;

  this.app.getAllRouters(function (err, routers) {
    if (err) {
      next(err);
      return;
    }

    try {
      $$.each(routers, function (name, router) {
        router.inject((name == app_name) ? '' : name, server);
      });
    } catch (err) {
      next(err);
      return;
    }

    next();
  });
};


var Server = module.exports = function Server(app) {
  if (!(this instanceof Server)) {
    return new Server(app);
  }


  var server = Express.createServer();


  this.start = function start(config, callback) {
    $$.waterfall({app: app, config: config, server: server})
      .queue(init_app)
      .queue(init_server_config)
      .queue(init_middleware_stack)
      .queue(init_routes)
      .run(function (err) {
        if (err) {
          callback(err);
          return;
        }

        var listen = $$.merge({port: 8000}, this.config.listen);
        server.listen(listen.port, listen.host);

        callback(null, server);
      });
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

// TODO: Improve load_schemas|models to accept any models (not only Mongoose)


'use strict';


// 3rd-party
var ExpressRailer = require('express-railer'),
    AssetsBuilder = require('assets-builder'),
    StaticLulz = require('static-lulz'),
    Promise = require('simple-promise'),
    Winston = require('winston'),
    Mongoose = require('mongoose');

// internal
var $$ = require('../utilities');


// foo_bar => FooBar
var beautify = function beautify(str) {
  str = $$.camelCase(str.replace(/[-_]+/g, ' '));
  return str.charAt(0).toUpperCase() + str.slice(1);
}


// prepare mongoose connection URI
var get_mongoose_uri = function get_mongoose_uri(config) {
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


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


var init_logger = function init_logger(next) {
  var context = this,
      logger = Winston;

  context.logger = context.shared.logger = logger;
  next();
};


var init_mongoose = function init_mongoose(next) {
  var context = this;

  context.main.readConfig('database', context.main.env, function (err, config) {
    if (err) {
      next(err);
      return;
    }

    if (!config.database) {
      next(Error("Database config has no database name"));
      return;
    }

    var uri = get_mongoose_uri(config);

    Mongoose.connect(uri, function (err) {
      if (err) {
        next(err);
        return;
      }

      context.shared.mongoose = Mongoose;
      next();
    });
  });
};


var load_mainapp = function load_mainapp(next) {
  var context = this;

  context.main.bootstrap(context.appConfig, function (err) {
    if (err) {
      next(err);
      return;
    }

    context.shared.applications[context.main.name] = context.main;
    next();
  });
};


var load_subapps = function load_subapps(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Loading subapps');
  $$.each(context.config.modules, function (module, appConfig) {
    var app,
        bootstrapped = finished.promise();

    context.logger.debug('Loading subapp', {module: module});

    // trying to find and load apropriate module
    try {
      app = require(module);
    } catch (err) {
      finished.reject(err);
      return;
    }

    context.logger.debug('Loaded subapp', {name: app.name});
    app.embedInto(context.main).bootstrap(appConfig, function (err) {
      if (err) {
        finished.reject(err);
        return;
      }

      context.shared.applications[app.name] = app;
      bootstrapped.resolve();
    });
  });

  finished.wait();
};


var load_app_schemas = function load_app_schemas(app, callback) {
  var context = this,
      dirname = path.join(app.dirname, 'app', 'models'),
      suffix_re = new RegExp('\.js$');

  context.logger.debug('Loading schemas for app', {name: app.name, path: dirname});
  path.exists(dirname, function (exists) {
    if (!exists) {
      // load schemas ONLY if models directory exists
      context.logger.debug('Application has no schemas');
      callback(null);
    }

    // directory exists. get all files from it
    fs.readdir(dirname, function (err, files) {
      var finished = new Promise.Joint(callback); // ALL schemas of app loaded

      files.forEach(function (file) {
        var name, promise, schema_loader;

        if (!suffix_re.test(file)) {
          // skip non-valid files
          return;
        }

        context.logger.debug('Found file ' + file);
        promise = finished.promise();

        // require schema loader
        try {
          name = $$.parameterize(file.replace(suffix_re, '')),
          schema_loader = require(path.join(dirname, file));
        } catch (err) {
          finished.reject(err);
          return;
        }

        // load schema with callback
        context.logger.debug('Loading schema ' + name);
        schema_loader(context.main, function (err, schema) {
          if (err) {
            finished.reject(err);
            return;
          }

          context.shared.schemas[name] = schema;
          promise.resolve();
        });
      });

      // wait for all schemas to be loaded
      finished.wait();
    });
  });
};


var load_schemas = function load_schemas(next) {
  var context = this,
      finished = new Promise.Joint(next); // ALL schemas of ALL apps were loaded

  context.logger.info('Loading schemas');
  $$.each(context.shared.applications, function (name, app) {
    var promise = finished.promise();

    load_app_schemas.call(context, app, function (err) {
      if (err) {
        finished.reject(err);
        return;
      }

      // all schemas of app were loaded without errors
      promise.resolve();
    });
  });

  finished.wait();
};


var load_models = function load_models(next) {
  var context = this,
      mongoose = context.shared.mongoose;

  context.logger.info('Loading models');
  $$.each(context.shared.schemas, function (name, schema) {
    // BEWARE: Mongoose.Schema does not have `get()` getter. Instead it has
    // accessor with `set()` name!!!

    var nice_name = beautify(name), // user-post -> UserPost
        collection = schema.set('collection');

    context.logger.debug('Processing model', {name: name, nice_name: nice_name});
    context.shared.models[name] = mongoose.model(nice_name, schema, collection);
  });

  next();
};


var load_views = function load_views(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Filling up assets builder with views');
  $$.each(context.shared.applications, function (name, app) {
    var static_path = path.join(app.dirname, 'app/views'),
        promise = finished.promise();

    log.debug('Trying add path=' + static_path);
    path.exists(function (exists) {
      if (!exists) {
        log.debug('Path not found. Skipping.');
        promise.resolve();
      }

      context.shared.viewsBuilder.addPath(static_path, function (err) {
        if (err) {
          finished.reject(err);
          return;
        }

        context.logger.debug('Added static path=' + static_path);
        promise.resolve();
      });
    });
  });

  finished.wait();
};


var load_app_controllers = function load_app_controllers(app, callback) {
  var context = this,
      dirname = path.join(app.dirname, 'app', 'controllers'),
      suffix_re = new RegExp('_controller\.js$');

  context.logger.debug('Loading controllers for app', {name: app.name, path: dirname});
  path.exists(dirname, function (exists) {
    if (!exists) {
      // load controllers ONLY if directory exists
      context.logger.debug('Application has no controllers');
      callback(null);
    }

    // directory exists. get all files from it
    fs.readdir(dirname, function (err, files) {
      var finished = new Promise.Joint(callback); // ALL controllers of app loaded

      files.forEach(function (file) {
        var name, promise, controller_loader;

        if (!suffix_re.test(file)) {
          // skip non-valid files
          return;
        }

        context.logger.debug('Found file ' + file);
        promise = finished.promise();

        // require schema loader
        try {
          name = $$.parameterize(file.replace(suffix_re, '')),
          controller_loader = require(path.join(dirname, file));
        } catch (err) {
          finished.reject(err);
          return;
        }

        // load controller with callback
        context.logger.debug('Loading controller ' + name);
        controller_loader(context.main, function (err, controller) {
          if (err) {
            finished.reject(err);
            return;
          }

          context.shared.controllers[name] = controller;
          context.shared.dispatcher.addController(controller);

          promise.resolve();
        });
      });

      // wait for all schemas to be loaded
      finished.wait();
    });
  });
};


var load_controllers = function controllers(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Loading controllers');

  $$.each(context.shared.applications, function (name, app) {
    var promise = finished.promise();

    load_app_controllers.call(context, app, function (err) {
      if (err) {
        finished.reject(err);
        return;
      }

      // all schemas of app were loaded without errors
      promise.resolve();
    });
  });

  finished.wait();
};


var load_routes = function load_routes(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Loading routes');
  $$.each(context.shared.applications, function (name, app) {
    var promise = finished.promise(),
        router = new ExpressRailer.Router(context.dispatcher);

    if (!Array.isArray(app.config.routes) || 0 === app.config.routes.length) {
      promise.resolve();
      return;
    }

    context.logger.debug('Loading routes for app', {name: name});
    app.config.routes.forEach(function (params) {
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

      try {  
        // attach route
        if (params.root) {
          router.root(params.root);
        } else if (params.match) {
          app.router.match($$.grab(params, 'match'), params);
        } else if (params.resource) {
          app.router.resource($$.grab(params, 'resource'), params);
        } else {
          throw Error('Unkown routes option');
        }
      } catch (err) {
        finished.reject(err);
      }
    });

    context.shared.routers[name] = router;
    promise.resolve();
  });

  finished.wait();
};


var load_public_assets = function load_public_assets(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Filling up assets builder');
  $$.each(context.shared.applications, function (name, app) {
    var static_path = path.join(app.dirname, 'public'),
        promise = finished.promise();

    log.debug('Trying add path=' + static_path);
    path.exists(function (exists) {
      if (!exists) {
        log.debug('Path not found. Skipping.');
        promise.resolve();
      }

      context.shared.assetsBuilder.addPath(static_path, function (err) {
        if (err) {
          finished.reject(err);
          return;
        }

        context.logger.debug('Added static path=' + static_path);
        promise.resolve();
      });
    });
  });

  finished.wait();
};


var load_static_lulz = function load_static_lulz(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.shared.assetsBuilder.compile(function (err, dir, files) {
    if (err) {
      finished.reject(err);
      return;
    }

    files.forEach(function (file) {
      var p = finished.promise();
      fs.readFile(file, function (err, buff) {
        if (err) {
          finished.reject(err);
          return;
        }

        context.shared.staticLulz.add(file.replace(dir, ''), buff);
        p.resolve();
      });
    });

    delete context.assets_builder;
    finished.wait();
  });
};


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


// expose module-function.
// private objects should be "binded" to the function:
//
// init.bind({
//   hooks: hooks
//   router: router
// })(function (err) {
//   if (err) {
//     // initializer failed
//   }
//
//   // otherwise callback is called with "extended" context:
//   this.hooks === hooks; // old references are kept
//   this.router; // new references are present as well
// });
module.exports = function initialize(callback) {
  var context = this;

  context.shared.applications   = {};
  context.shared.schemas        = {};
  context.shared.models         = {};
  context.shared.controllers    = {};
  context.shared.routers        = {};
  context.shared.dispatcher     = new ExpressRailer.Dispatcher();
  context.shared.viewsBuilder   = new AssetsBuilder({
                                    tmp: '/tmp/nodeca-views.' + process.pid,
                                    plugins: []
                                  });
  context.shared.assetsBuilder  = new AssetsBuilder({
                                    tmp: '/tmp/nodeca-public.' + process.pid
                                  });
  context.shared.staticLulz     = new StaticLulz();

  $$.waterfall(context)
    .queue(init_logger)
    .queue(init_mongoose)
    .queue(load_mainapp)
    .queue(load_subapps)
    .queue(context.hooks['apps-loaded'])
    .queue(load_schemas)
    .queue(context.hooks['schemas-loaded'])
    .queue(load_models)
    .queue(context.hooks['models-loaded'])
    .queue(load_views)
    .queue(context.hooks['views-loaded'])
    .queue(load_controllers)
    .queue(context.hooks['controllers-loaded'])
    .queue(load_routes)
    .queue(context.hooks['routes-loaded'])
    .queue(load_public_assets)
    .queue(context.hooks['public-assets-loaded'])
    .queue(load_static_lulz)
    .queue(context.hooks['static-lulz-loaded'])
    .run(callback);
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

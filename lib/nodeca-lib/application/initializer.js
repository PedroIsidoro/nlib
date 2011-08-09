//  Generally we can separate three main steps of init:
//
//    * warm up
//      - bootstrap main application
//    * preparation stages (see below)
//    * after init
//      - mount downstream applications into main application's router
//      - compile static files storage
//
//  The main and most complex part of above is preparations stages. It consist
//  of different stages. After each stage an associated hook is being fired.
//  Each stage takes place ONLY after previous stage and it's post-finish hooks
//  was finished. So it's a waterfall of: stage_a -> hook_a -> stage_b -> ...
//
//  These are preparations tages and their associated hooks
//
//    * load subapps (hook: subapps-loaded)
//      - require corresponding application module
//      - and bootstrap it
//    * load schemas (hook: schemas-loaded)
//      - load files under {app.dirname}/app/models directory
//      - register found schemas
//    * load models (hook: models-loaded)
//      - compile all Mongoose schemas into models
//      - register compiled models
//    * load controllers (hook: controllers-loaded)
//      - load files under {app.dirname}/app/controllers directory
//      - register found controllers
//      - propose each controller to (!) main app's dispatcher (!)
//    * load routes (hook: routes-loaded)
//      - configure each app's router
//      - propose to each router main app's dispatcher
//    * load static files (hook: init-complete)
//      - create and fill StaticLulz with /public directories


// TODO: Find the way to simplify and beautify load_schemas and load_controllers
// TODO: Improve load_schemas|models to accept any models (not only Mongoose)
// TODO: Add create_promise_stage for linear stages (like models loader)


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

  context.logger = logger;
  context.logger_ready.resolve(null, logger);
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
      context.mongoose_ready.resolve(err, Mongoose);
      next(err);
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

    context.apps[context.main.name] = context.main;
    next();
  });
};


var load_subapps = function load_subapps(next) {
  var context = this,
      finished = new Promise.Joint(function (err) {
        context.apps_ready.resolve(err, context.apps);
        next(err);
      });

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

      context.apps[app.name] = app;
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

          context.schemas[name] = schema;
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
      finished = new Promise.Joint(function (err) { // ALL schemas of ALL apps were loaded
        context.schemas_ready.resolve(err, context.schemas);
        next(err);
      });

  context.logger.info('Loading schemas');
  $$.each(context.apps, function (name, app) {
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
  var context = this;

  context.logger.info('Loading models');
  context.main.getMongoose(function (err, mongoose) {
    if (err) {
      context.models_ready.resolve(err);
      next(err);
      return;
    }

    $$.each(context.schemas, function (name, schema) {
      // BEWARE: Mongoose.Schema does not have `get()` getter. Instead it has
      // accessor with `set()` name!!!

      var nice_name = beautify(name), // user-post -> UserPost
          collection = schema.set('collection');

      context.logger.debug('Processing model', {name: name, nice_name: nice_name});
      context.models[name] = mongoose.model(nice_name, schema, collection);
    });

    context.models_ready.resolve(null, context.models);
    next();
  });
};


var load_views = function load_views(next) {
  var context = this,
      builder = new AssetsBuilder(),
      finished = new Promise.Joint(function (err) {
        if (err) {
          context.views_ready.resolve(err);
          next(err);
          return;
        }

        builder.compile(context.views_ready.resolve);
        next();
      });

  context.logger.info('Filling up assets builder with views');

  $$.each(context.apps, function (name, app) {
    var static_path = path.join(app.dirname, 'app/views'),
        promise = new Promise();

    log.debug('Trying add path=' + static_path);
    finished.include(promise);

    path.exists(function (exists) {
      if (!exists) {
        log.debug('Path not found. Skipping.');
        promise.resolve();
      }

      builder.addPath(static_path, function (err) {
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

          context.controllers[name] = controller;
          context.dispatcher.addController(controller);

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
      finished = new Promise.Joint(function (err) {
        context.controllers_ready.resolve(err, context.controllers);
        cnotext.dispatcher_ready.resolve(err, context.dispatcher);
        next(err);
      });

  context.logger.info('Loading controllers');

  $$.each(context.apps, function (name, app) {
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
      finished = new Promise.Joint(function (err) {
        context.routers_ready.resolve(err, context.routers);
        next(err);
      });

  context.logger.info('Loading routes');
  $$.each(context.apps, function (name, app) {
    var promise = new Promise(),
        router = new ExpressRailer.Router(context.dispatcher);

    context.logger.debug('Loading routes for app', {name: name});
    finished.include(promise);

    if (!Array.isArray(app.config.routes) || 0 === app.config.routes.length) {
      promise.resolve();
      return;
    }

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

    context.routers[name] = router;
    promise.resolve();
  });

  finished.wait();
};


var load_public_assets = function load_public_assets(next) {
  var context = this,
      finished = new Promise.Joint(function (err) {
        context.static_builder_ready.resolve(err, context.assets_builder);
        next(err);
      });

  context.logger.info('Filling up assets builder');

  $$.each(context.apps, function (name, app) {
    var static_path = path.join(app.dirname, 'public'),
        promise = new Promise();

    log.debug('Trying add path=' + static_path);
    finished.include(promise);

    path.exists(function (exists) {
      if (!exists) {
        log.debug('Path not found. Skipping.');
        promise.resolve();
      }

      context.assets_builder.addPath(static_path, function (err) {
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
      finished = new Promise.Joint(function (err) {
        context.static_lulz_ready.resolve(err, context.static_lulz);
        next(err);
      });

  context.assets_builder.compile(function (err, dir, files) {
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

        context.static_lulz.add(file.replace(dir, ''), buff);
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

  context.apps            = {};
  context.schemas         = {};
  context.models          = {};
  context.controllers     = {};
  context.routers         = {};
  context.dispatcher      = new ExpressRailer.Dispatcher();
  context.assets_builder  = new AssetsBuilder();
  context.static_lulz     = new StaticLulz();

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

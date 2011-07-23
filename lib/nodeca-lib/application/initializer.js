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
//      - create and fill AssetsManager with /public directories


// TODO: Find the way to simplify and beautify load_schemas and load_controllers
// TODO: Improve load_schemas|models to accept any models (not only Mongoose)
// TODO: Add create_promise_stage for linear stages (like models loader)


'use strict';


var ExpressRailer = require('express-railer'),
    Promise = require('../promise'),
    $$ = require('../utilities');



// foo_bar => FooBar
var beautify = function beautify(str) {
  str = $$.camelCase(str.replace(/[-_]+/g, ' '));
  return str.charAt(0).toUpperCase() + str.slice(1);
}


// provides easy way to stack stages in desired order
var create_stack = function create_stack(context) {
  var queue = [],
      walk_on,
      final;

  walk_on = function () {
    var handler = queue.shift();

    // all stages done
    if (!handler) {
      final();
      return;
    }

    handler(function (err) {
      if (err) {
        final(err);
        return;
      }

      walk_on();
    });
  };

  return {
    queue: function queue(handler) {
      queue.push(handler.bind(context));
      return this;
    },
    run: function run(callback) {
      final = callback.bind(context);
      walk_on();
    }
  };
};


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


var load_subapps = function load_subapps(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Loading subapps');
  $$.each(context.config.modules, function (name, config) {
    var app,
        module = 'nodeca-' + name,
        bootstrapped = new Promise();

    context.logger.debug('Loading subapp', {module: module});
    finished.include(bootstrapped);

    // trying to find and load apropriate module
    try {
      app = require(module);
      context.logger.debug('Loaded subapp', {module: module, name: app.name});
    } catch (err) {
      finished.reject(err);
      return;
    }

    $$.merge(app.config, config);
    app.bootstrap(function (err) {
      if (err) {
        finished.reject(err);
        return;
      }

      context.loaded_apps[app.name] = app;
      bootstrapped.resolve();
    });
  });

  finished.wait();
};


var load_schemas = function load_schemas(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Loading schemas');
  $$.each(context.loaded_apps, function (name, app) {
    var dirname = path.join(app.dirname, 'app', 'models'),
        suffix_re = new RegExp('\.js$'),
        promise = new Promise();

    context.logger.debug('Loading schemas for app', {name: name, path: dirname});
    finished.include(promise);

    path.exists(dirname, function (exists) {
      if (!exists) {
        context.logger.debug('Application has no models', {name: name});
        promise.resolve();
        return;
      }

      // read all files
      fs.readdir(dirname, function (err, files) {
        if (err) {
          finished.reject(err);
          return;
        }

        files.forEach(function (file) {
          try {
            if (suffix_re.test(file)) {
              context.logger.debug('Found file ' + file);

              var name = $$.parameterize(file.replace(suffix_re, '')),
                  schema = require(path.join(dirname, file));

              context.logger.debug('Loading schema ' + name);
              context.schemas[name] = schema(context.main);
            }
          } catch (err) {
            finished.reject(err);
            return;
          }
        });

        // all files were loaded
        promise.resolve();
      }); // fs.readdir
    }); // path.exists
  }); // $$.each

  finished.wait();
};


var load_models = function load_models(next) {
  var context = this;

  context.logger.info('Loading models');
  context.main.getMongoose(function (err, mongoose) {
    if (err) {
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

    next();
  });
};


var load_controllers = function controllers(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Loading controllers');
  context.dispatcher = new ExpressRailer.Dispatcher();

  $$.each(context.loaded_apps, function (name, app) {
    var dirname = path.join(app.dirname, 'app', 'controllers'),
        suffix_re = new RegExp('_controller\.js$'),
        promise = new Promise();

    context.logger.debug('Loading controllers for app', {name: name, path: dirname});
    finished.include(promise);

    path.exists(dirname, function (exists) {
      if (!exists) {
        context.logger.debug('Application has no controllers', {name: name});
        promise.resolve();
        return;
      }

      // read all files
      fs.readdir(dirname, function (err, files) {
        if (err) {
          finished.reject(err);
          return;
        }

        files.forEach(function (file) {
          try {
            if (suffix_re.test(file)) {
              context.logger.debug('Found file ' + file);

              var name = $$.parameterize(file.replace(suffix_re, '')),
                  module = require(path.join(dirname, file)),
                  controller = new module(context.name);

              debug('Loaded controller ' + name + ' (' + controller.name + ')');

              context.controllers[name] = controller;
              context.dispatcher.addController(controller);
            }
          } catch (err) {
            finished.reject(err);
            return;
          }
        });

        // all files were loaded
        promise.resolve();
      }); // fs.readdir
    }); // path.exists
  }); // $$.each

  finished.wait();
};


var load_routes = function load_routes(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Loading routes');
  $$.each(context.loaded_apps, function (name, app) {
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

    context.routers.push(router);
    promise.resolve();
  });

  finished.wait();
};


var load_static_storage = function load_static_storage(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.assets_mgr = new StaticManager();
  context.logger.info('Filling up assets manager');

  $$.each(context.loaded_apps, function (name, app) {
    var static_path = path.join(app.dirname, 'public'),
        promise = new Promise();

    log.debug('Trying add path=' + static_path);
    finished.include(promise);

    path.exists(function (exists) {
      if (!exists) {
        log.debug('Path not found. Skipping.');
        promise.resolve();
      }

      context.assets_mgr.add(static_path, function (err) {
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


var compile_assets = function compile_assets(next) {
  var context = this;

  context.assets_mgr.compile(function (err, assets) {
    if (err) {
      next(err);
      return;
    }

    context.assets = assets;
    next();
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
module.exports = function initialize(appConfig, callback) {
  var context = this;

  // propose merged config of application to the init context
  context.config = $$.merge(self.config, appConfig);

  self.getLogger(function (err, logger) {
    if (err) {
      callback(err);
      return;
    }

    // propose initialized logger to the init context
    context.logger = logger;

    self.bootstrap(function (err) {
      if (err) {
        callback(err);
        return;
      }

      // register main app in cache
      context.loaded_apps[self.name] = self;

      // stack and run all stages
      create_stack(context)
        .queue(load_subapps)
        .queue(context.hooks['subapps-loaded'])
        .queue(load_schemas)
        .queue(context.hooks['schemas-loaded'])
        .queue(load_models)
        .queue(context.hooks['models-loaded'])
        .queue(load_controllers)
        .queue(context.hooks['controllers-loaded'])
        .queue(load_routes)
        .queue(context.hooks['routes-loaded'])
        .queue(load_static_storage)
        .queue(context.hooks['init-complete'])
        .queue(compile_assets)
        .run(callback);
    });
  });
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

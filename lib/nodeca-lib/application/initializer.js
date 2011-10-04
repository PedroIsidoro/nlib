// TODO:  Improve load_schemas|models to accept any models (not only Mongoose)
// TODO:  Refactor initializer into pieces


'use strict';


// stdlib
var fs = require('fs'),
    path = require('path');

// 3rd-party
var ExpressRailer = require('express-railer'),
    AssetsBuilder = require('assets-builder'),
    StaticLulz = require('static-lulz'),
    Promise = require('simple-promise'),
    Winston = require('winston'),
    Mongoose = require('mongoose'),
    Yaml = require('yaml'),
    _ = require('underscore');

// internal
var $$ = require('../utilities');


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
  _.each(context.main.config.modules, function (appConfig, module) {
    var app, app_ready = finished.promise();

    context.logger.debug('Loading subapp', {module: module});

    // trying to find and load apropriate module
    try {
      app = require(module);
    } catch (err) {
      finished.reject(err);
      return;
    }

    context.logger.debug('Bootstrapping subapp', {name: app.name});
    app.bootstrap(appConfig, function (err) {
      if (err) {
        context.logger.debug("Bootstrap failed", {name: app.name});
        finished.reject(err);
        return;
      }

      context.logger.debug("Bootstrap success", {name: app.name});
      context.shared.applications[app.name] = app;
      app_ready.resolve();
    });
  });

  context.logger.debug("waiting for subapps to be loaded");
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
      return;
    }

    // directory exists. get all files from it
    fs.readdir(dirname, function (err, files) {
      var finished // ALL schemas of app loaded

      if (err) {
        callback(err);
        return;
      }

      finished = new Promise.Joint(callback);
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
          name = _.dasherize(file.replace(suffix_re, '')),
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
  _.each(context.shared.applications, function (app, name) {
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
  _.each(context.shared.schemas, function (schema, name) {
    // BEWARE: Mongoose.Schema does not have `get()` getter. Instead it has
    // accessor with `set()` name!!!

    var nice_name = _.camelize(_.capitalize(name)),
        collection = schema.set('collection');

    context.logger.debug('Processing model', {name: name, nice_name: nice_name});
    context.shared.models[name] = mongoose.model(nice_name, schema, collection);
  });

  next();
};


var load_views_builder = function load_views_builder(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Filling up assets builder with views');

  _.each(context.shared.applications, function (app, name) {
    var views_path = path.join(app.dirname, 'app/views'),
        promise = finished.promise();

    context.logger.debug('Trying add path.', {app: name, path: views_path});
    path.exists(views_path, function (exists) {
      if (!exists) {
        context.logger.debug('Path not found. Skipping.', {app: name, path: views_path});
        promise.resolve();
        return;
      }

      context.shared.viewsBuilder.addPath(views_path, function (err) {
        if (err) {
          context.logger.debug("Failed add views path.", {app: name, path: views_path});
          finished.reject(err);
          return;
        }

        context.logger.debug('Added views path.', {app: name, path: views_path});
        promise.resolve();
      });
    });
  });

  finished.wait();
};


var compile_views = function compile_views(next) {
  var context = this;

  context.shared.viewsBuilder.compile(function (err, dir, files) {
    var finished = new Promise.Joint(next);

    files.forEach(function (f) {
      var promise = finished.promise(),
          filename = path.join('/', f.replace(dir, ''));

      fs.readFile(f, 'utf-8', function (err, str) {
        if (err) {
          finished.reject(err);
          return;
        }

        context.shared.views[filename] = str;
        promise.resolve();
      });
    });

    finished.wait();
  });
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
      return;
    }

    // directory exists. get all files from it
    fs.readdir(dirname, function (err, files) {
      var finished;

      if (err) {
        callback(err);
        return;
      }

      finished = new Promise.Joint(callback); // ALL controllers of app loaded
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
          name = _.dasherize(file.replace(suffix_re, '')),
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

  _.each(context.shared.applications, function (app, name) {
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


var load_app_stores = function load_app_stores(app, callback) {
  var context = this,
      dirname = path.join(app.dirname, 'app', 'stores'),
      suffix_re = new RegExp('\.js$');

  context.logger.debug('Loading stores for app', {name: app.name, path: dirname});
  path.exists(dirname, function (exists) {
    if (!exists) {
      // load stores ONLY if directory exists
      context.logger.debug('Application has no stores');
      callback(null);
      return;
    }

    // directory exists. get all files from it
    fs.readdir(dirname, function (err, files) {
      var finished;

      if (err) {
        callback(err);
        return;
      }

      finished = new Promise.Joint(callback); // ALL stores of app loaded
      files.forEach(function (file) {
        var name, promise, store_loader;

        if (!suffix_re.test(file)) {
          // skip non-valid files
          return;
        }

        context.logger.debug('Found file ' + file);
        promise = finished.promise();

        // require schema
        try {
          name = _.dasherize(file.replace(suffix_re, '')),
          store_loader = require(path.join(dirname, file));
        } catch (err) {
          // stop with an error
          finished.reject(err);
          return;
        }

        // load store with callback
        context.logger.debug('Loading store ' + name);
        store_loader(app, function (err, store) {
          if (err) {
            finished.reject(err);
            return;
          }

          app.settings.store(name, store);
          promise.resolve();
        });
      });

      // all done
      finished.wait();
    });
  });
};


var load_stores = function load_stores(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Loading stores');

  _.each(context.shared.applications, function (app, name) {
    var promise = finished.promise();

    load_app_stores.call(context, app, function (err) {
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


var load_app_settings = function load_app_settings(app, callback) {
  var context = this,
      dirname = path.join(app.dirname, 'config', 'settings'),
      suffix_re = new RegExp('\.yml$');

  context.logger.debug('Loading settings for app', {name: app.name, path: dirname});
  path.exists(dirname, function (exists) {
    if (!exists) {
      // load settings ONLY if directory exists
      context.logger.debug('Application has no settings');
      callback(null);
      return;
    }

    // directory exists. get all files from it
    fs.readdir(dirname, function (err, files) {
      var finished;

      if (err) {
        callback(err);
        return;
      }

      finished = new Promise.Joint(callback); // ALL stores of app loaded

      files.forEach(function (file) {
        var name, promise;

        if (!suffix_re.test(file)) {
          // skip non-valid files
          return;
        }

        context.logger.debug('Found file ' + file);
        promise = finished.promise();

        app.logger.warn('Skipped - We need to finish YAML first');
        promise.resolve();
        return;

        Yaml.readFile(path.join(dirname, file), function (err, data) {
          if (err) {
            finished.reject(err);
            return;
          }

          _.each(data, function (settings, store) {
            _.each(settings, function (definition, key) {
              app.settings.definition(store, key, definition);
            });
          });

          promise.resolve();
        });
      });

      // all done
      finished.wait();
    });
  });
};


var load_settings = function load_settings(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Loading stores');

  _.each(context.shared.applications, function (app, name) {
    var promise = finished.promise();

    load_app_settings.call(context, app, function (err) {
      if (err) {
        finished.reject(err);
        return;
      }

      // all settings of app were loaded without errors
      promise.resolve();
    });
  });

  finished.wait();
};


var load_routes = function load_routes(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Loading routes');
  _.each(context.shared.applications, function (app, name) {
    var promise = finished.promise(),
        router = new ExpressRailer.Router(context.shared.dispatcher);

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
          router.match(_.remove(params, 'match'), params);
        } else if (params.resource) {
          router.resource(_.remove(params, 'resource'), params);
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


var load_static_builder = function load_static_builder(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.logger.info('Filling up assets builder');
  _.each(context.shared.applications, function (app, name) {
    var static_path = path.join(app.dirname, 'public'),
        promise = finished.promise();

    context.logger.debug('Trying add path.', {app: name, path: static_path});
    path.exists(static_path, function (exists) {
      if (!exists) {
        context.logger.debug('Path not found. Skipping.', {app: name, path: static_path});
        promise.resolve();
        return;
      }

      context.shared.staticBuilder.addPath(static_path, function (err) {
        if (err) {
          context.logger.debug('Faile add path.', {app: name, path: static_path});
          finished.reject(err);
          return;
        }

        context.logger.debug('Added static path.', {app: name, path: static_path});
        promise.resolve();
      });
    });
  });

  finished.wait();
};


var load_static_assets = function load_static_assets(next) {
  var context = this,
      finished = new Promise.Joint(next);

  context.shared.staticBuilder.compile(function (err, dir, files) {
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

        context.shared.staticAssets.add(file.replace(dir, ''), buff);
        p.resolve();
      });
    });

    delete context.assets_builder;
    finished.wait();
  });
};


var cleanup = function cleanup(next) {
  var context = this,
      views_builder = _.remove(context.shared, 'viewsBuilder'),
      static_builder = _.remove(context.shared, 'staticBuilder');

  context.shared.__defineGetter__('viewsBuilder', function () {
    throw Error("Can't access viewsBuilder once init() finished");
  });

  context.shared.__defineGetter__('staticBuilder', function () {
    throw Error("Can't access staticBuilder once init() finished");
  });

  if (!!context.main.config.debug) {
    // delete references
    views_builder = static_builder = null;
    next();
    return;
  } 

  // cleanup assets builders
  Promise.Joint(next)
    .promise(function (p) {
      var joint = this;
      views_builder.cleanup(function (err) {
        if (err) {
          joint.reject(err);
          return;
        }

        views_builder = null;
        p.resolve();
      });
    })
    .promise(function (p) {
      var joint = this;
      static_builder.cleanup(function (err) {
        if (err) {
          joint.reject(err);
          return;
        }

        static_builder = null;
        p.resolve();
      });
    })
    .wait();
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
  context.shared.views          = {};
  context.shared.controllers    = {};
  context.shared.routers        = {};
  context.shared.dispatcher     = new ExpressRailer.Dispatcher();
  context.shared.viewsBuilder   = new AssetsBuilder({
                                    tmp: '/tmp/nodeca-views.' + process.pid,
                                    plugins: []
                                  });
  context.shared.staticBuilder  = new AssetsBuilder({
                                    tmp: '/tmp/nodeca-public.' + process.pid
                                  });
  context.shared.staticAssets   = new StaticLulz();

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
    .queue(load_views_builder)
    .queue(context.hooks['views-builder-loaded'])
    .queue(compile_views)
    .queue(load_controllers)
    .queue(context.hooks['controllers-loaded'])
    .queue(load_stores)
    .queue(load_settings)
    .queue(context.hooks['stores-loaded'])
    .queue(load_routes)
    .queue(context.hooks['routes-loaded'])
    .queue(load_static_builder)
    .queue(context.hooks['static-builder-loaded'])
    .queue(load_static_assets)
    .queue(context.hooks['static-assets-loaded'])
    .queue(cleanup)
    .run(callback);
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

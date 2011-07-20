// TODO: slice into separate functions

module.exports = function init(self, appConfig, callback) {
  var // reveal some binded secrets
      hooks = this.hooks,
      router = this.router,
      dispatcher = this.dispatcher,
      // define local things
      log,                // assigned during main app initialization
      config,             // assigned during main app initialization
      create_joint_stage, // joint that executes hook and calls next on sucess
      load_subapps,       // after main app bootstrapped - see below
      load_schemas,       // after subapps loaded and `boostrapped` hook fired
      load_models,        // after schemas and `schemas-loaded` hook
      load_controllers,   // after models and `models-loaded` hook
      load_routes,        // after controllers and `controllers-loaded` hook
      mount_subapps,      // after routes and `routes-loaded` hook
      init_static_mgr;    // after subapps mounting


  //
  // Creates new promse joint that will fire next() once it was resolved and
  // associated hook executed without error, will fires callback(err) in the
  // end otherwise.
  create_joint_stage = function (hookName, next) {
    return new Promise.Joint(function (err) {
      // joint was rejected
      if (err) {
        callback(err);
        return;
      }

      hooks.exec(hookName, function (err) {
        // one of hook handlers failed
        if (err) {
          callback(err);
          return;
        }

        // call next initializer
        next();
      });
    });
  };


  //
  // loading, embedding and bootstraping all downstream apps
  load_subapps = function () {
    // joint that waits for all subapps to be boostrapped, or until it will
    // get reject it (due to errors)
    var joint = create_joint_stage('bootstrapped', load_schemas);

    log.info('Loading sub applications');

    $$.each(, function (name, subappConfig) {
      var subapp, subapp_ready = new Promise();

      log.debug('Loading subapp=' + name);
      joint.include(subapp_ready);

      // trying to find and load apropriate module
      try {
        subapp = require('nodeca-' + name);
      } catch (err) {
        joint.reject(err);
        return;
      }

      // configure and boostrap application
      subapp.getConfig(function (err, config) {
        if (err) {
          joint.reject(err);
          return;
        }

        $$.merge(config, subappConfig);

        subapp.bootstrap(function (err) {
          if (err) {
            joint.reject(err);
            return;
          }

          // notify joint, that this app was loaded
          subapp_ready.resolve();
        });
      });
    });

    // start waiting for all subapps to be bootstrapped
    joint.wait();
  };


  //
  // load schemas. downstream apps must be loaded first
  load_schemas = function () {
    var joint = create_joint_stage('schemas-loaded', load_models);

    log.info('Loading schemas...');
    $$.each(apps, function (name, subapp) {
      var schemas_dir = path.join(subapp.dirname, 'app', 'models'),
          suffix_re = new RegExp('\.js$'),
          subapp_schemas_ready = new Promise();

      log.debug('Loading schemas for app=' + name);

      // check if models directory exists
      path.exists(schemas_dir, function (exists) {
        if (!exists) {
          log.debug('Application ' + name + ' has no models');
          subapp_schemas_ready.resolve();
          return;
        }

        // get all files from models directory
        fs.readdir(schemas_dir, function (err, files) {
          if (err) {
            joint.reject(err);
            return;
          }

          // WARNING: I'm not sure about how forEach will work, will it
          // "schedule" iterator on next tick or not. If it will - we need
          // to add joint_each() helper to ensure all elements finished
          // iteration, e.g.:
          // joint_each(files, function (file, done) {
          //   if (...) { done(err); return; }
          //   done();
          // }, my_promise.resolve, common_joint.reject);

          // try to load each file
          files.forEach(function (file) {
            try {
              if (suffix_re.test(file)) {
                var name = $$.parameterize(file.replace(suffix_re, ''));

                log.debug('Found schema ' + name);
                schemas[name] = (require(path.join(schemas, file)))(self);
              }
            } catch (err) {
              joint.reject(err);
              return;
            }
          });

          // all schema files were loaded
          subapp_schemas_ready.resolve();
        });
      });
    });

    joint.wait();
  };


  //
  // load models. schemas must be loaded first
  load_models = function () {
    var joint = create_joint_stage('models-loaded', load_controllers);

    log.info('Loading models...');
    $$.each(schames, function (name, schema) {
      // BEWARE: Mongoose.Schema does not have `get()` getter. Instead it has
      // accessor with `set()` name!!!

      var nice_name = beautify(name), // user-post -> UserPost
          collection = schema.set('collection');

      log.debug(' > ' + nice_name);
      models[name] = mongoose.model(nice_name, schema, collection);
    });

    joint.wait();
  };


  //
  // load controllers. models must be loaded first.
  load_controllers = function () {
    var joint = create_joint_stage('controllers-loaded', load_routes);

    log.info('Loading controllers...');
    $$.each(apps, function (name, subapp) {
      var ctrls_dir = path.join(subapp.dirname, 'app', 'controllers'),
          suffix_re = new RegExp('\_controller.js$'),
          subapp_ctrls_ready = new Promise();

      log.debug('Loading controllers for app=' + name);

      // check if controllers directory exists
      path.exists(ctrls_dir, function (exists) {
        if (!exists) {
          log.debug('Application ' + name + ' has no controllers');
          subapp_ctrls_ready.resolve();
          return;
        }

        // get all files from controllers directory
        fs.readdir(ctrls_dir, function (err, files) {
          if (err) {
            joint.reject(err);
            return;
          }

          // try to load each file
          files.forEach(function (file) {
            try {
              if (suffix_re.test(file)) {
                log.debug('Loading controller from file=' + file);

                var controller = require(path.join(dirname, file)),
                    instance = new controller(self),
                    ctrl_name = name + '/' + $$.parameterize(instance.name);

                debug('Loaded controller ' + name + ' (' + instance.name + ')');

                controllers[ctrl_name] = instance;
                subapp.dispatcher.addController(instance);
              }
            } catch (err) {
              joint.reject(err);
              return;
            }
          });

          // all controller files were loaded
          subapp_ctrls_ready.resolve();
        });
      });
    });

    joint.wait();
  };


  load_routes = function () {
    var joint = create_joint_stage('routes-loaded', mount_subapps);

    // each route (params) may be something like this:
    //
    // root: foo#bar
    //
    // is a shortcut to:
    //
    // match: /
    // to: foo#bar
    //
    // in other words `match` and `root` are "actions" of router, everything else
    // is second argument of router's `match` method.
    (self.config.routes || []).forEach(function (params) {
      var route_loaded_promise = new Promise();

      log.info('Loading routes...');
      joint.include(route_loaded_promise);

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
          app.router.root(params.root);
        } else if (params.match) {
          app.router.match($$.grab(params, 'match'), params);
        } else if (params.resource) {
          app.router.resource($$.grab(params, 'resource'), params);
        } else {
          throw Error('Unkown routes option');
        }

        route_loaded_promise.resolve();
      } catch (err) {
        joint.reject(err);
      }
    });

    joint.wait();
  };


  mount_subapps = function () {
    log.info('Mounting sub-apps...');
    $$.each(apps, function (name, app) {
      if (name === self.name) { return; }
      var mnt = app.config.mount || {path: '/' + $$.parameterize(app.name)};
      router.mount(mnt, app.router);
    });

    init_static_mgr();
  };


  init_static_mgr = function () {
    var paths_joint = new Promise.Joint(),
        static_manager = new StaticManager();

    log.info('Configuring StaticManager');

    $$.each(apps, function (name, app) {
      var static_path = path.join(app.dirname, 'public'),
          path_promise = new Promise();

      log.debug('Trying add path=' + static_path);
      paths_joint.include(path_promise);

      path.exists(function (exists) {
        if (!exists) {
          log.debug('Path not found. Skipping.');
          path_promise.resolve();
        }

        static_manager.add(static_path, function (err) {
          if (err) {
            paths_joint.reject(err);
            return;
          }

          log.debug('Added static path=' + static_path);
          path_promise.resolve();
        });
      });
    });


    paths_joint.wait().done(function (err) {
      if (err) {
        callback(err);
        return;
      }

      log.info('Compiling static files...');
      static_manager.compile(function (err, vfs) {
        if (err) {
          callback(err);
          return;
        }

        self.staticFiles = vfs;
        callback(); // get out of init successfully
      });
    });
  };


  //
  // configure and bootstrap main app, then pass execution to load_subapps();
  self.getAppName(function (err, name) {
    if (err) {
      callback(err);
      return;
    }

    self.getLogger(function (err, logger) {
      if (err) {
        callback(err);
        return;
      }

      log = logger.info('Initializing ' + name);
      self.getConfig(function (err, appDefaults) {
        if (err) {
          callback(err);
          return;
        }

        config = $$.merge({}, appDefaults, appConfig);

        log.info('Bootstraping main application...');
        self.bootstrap(function (err) {
          if (err) {
            callback(err);
            return;
          }

          load_subapps();
        });
      });
    });
  });
};

////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

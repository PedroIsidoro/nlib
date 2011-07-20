/**
 *  class Application
 **/


'use strict';


var path = require('path'),
    fs = require('fs');


// list of valid hooks. don't forget to update [[Application#addHook]]
// documentation if it is changed
var VALID_HOOKS = [
  'bootstrapped',
  'schemas-loaded',
  'models-loaded',
  'controllers-loaded',
  'routes-loaded'
];


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
 *  ##### See Also
 *
 *  - [[Application#addHook]]
 **/
var Application = module.exports = function Application(dirname, bootstrapper) {
  var self = this, // self-reference
      super = this, // master app when this instance is sub-app
      hooks = new HooksManager(VALID_HOOKS, this), // stack of hooks for app
      config_promise = new Promise(), // defaults config were loaded
      mongoose_promise = new Promise(); // db config were read and mongoose was connected


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


  /**
   *  Application#getConfig(callback) -> Void
   *
   *  Fires `callback(err, config)` once `defaults` config of application was
   *  read and parsed.
   **/
  this.getConfig = config_promise.done;


  /**
   *  Application#getMongoose(callback) -> Void
   *
   *  Fires `callback(err, mongoose)` once mongoose is connected to databse.
   **/
  this.getMongoose = mongoose_promise.done;


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
   *  ##### Example
   *
   *      subapp.embedInto(app) === subapp;
   *      subapp.super = app;
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


  /** 
   *  Application#init(appConfig, callback) -> Void
   *
   *  Initializes master application.
   **/
  this.init = function init(appConfig, callback) {
    // allow call init with callback only
    if (undefined === callback) {
      callback = appConfig;
      appConfig = {};
    }

    // init can be started on master app only
    if (super !== this) {
      callback(Error("Only master application can call init()"));
      return;
    }

    var log,                // assigned during main app initialization
        config,             // assigned during main app initialization
        create_joint_stage, // joint that executes hook and calls next on sucess
        load_subapps,       // after main app bootstrapped - see below
        load_schemas,       // after subapps loaded and `boostrapped` hook fired
        load_models,        // after schemas and `schemas-loaded` hook
        load_controllers,   // after models and `models-loaded` hook
        load_routes;        // after controllers and `controllers-loaded` hook


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
  }; // this.init()
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


/** chainable
 *  Application#embed(app) -> Application
 *
 *  Opposite method of [[Application#embedInto]].
 *
 *  ##### Example
 *
 *      app.embed(subapp) === app;
 *      subapp.super = app;
 **/
Application.prototype.embed = function embed(app) {
  app.embedInto(this);
  return this;
};


/**
 *  Application#getConfigFilename(name) -> String
 *
 *  Returns full path of `name` config.
 *
 *  ##### Example
 *
 *  Assuming app is placed under /srv/red-hot-chili-peppers
 *
 *      app.getConfigFilename('database');
 *      // -> /srv/red-hot-chili-peppers/config/database.yml
 **/
Application.prototype.getConfigFilename = function getConfigFilename(name) {
  return path.join(this.dirname, 'config', name + '.yml');
};


/**
 *  Application#readConfig(name, callback) -> Void
 *  Application#readConfig(name, env, callback) -> Void
 *  - name (String): filename to read (without extension), e.g.: `application`
 *  - env (String): get specific environment section of config (method does not
 *    checks if config has different sections or not)
 *  - callback (Function): fired once config was read or error met. Called with
 *    arguments as follows - `callback(err, config)`.
 *
 *  Reads and parses `config/<name>.yml` file of application. If `env` is
 *  given result is merged `general` and `env` sections of config.
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
 *      app.readConfig('application', function (err, config) {
 *        console.log(config);
 *        // -> {general: {foo: 'bar'}, production: {baz: 'baz'}}
 *      });
 *
 *  Or syntethic config for environment:
 *
 *      app.readConfig('application', 'production', function (err, config) {
 *        console.log(config);
 *        // -> {foo: 'bar', baz: 'baz'}
 *      });
 *
 *  ##### See Also
 *
 *  - [[Application#getConfigFile]]
 *  - [[Utilities.readYaml]]
 **/
Application.prototype.readConfig = function readConfig(name, env, callback) {
  var self = this,
      file = this.getConfigFilename(name);

  if (undefined === callback) {
    callback = env;
    env = null;
  }

  $$.readYaml(file, function (err, config) {
    if (err) {
      callback(err);
      return;
    }

    if (env) {
      config = $$.merge({}, config.general, config[env]);
    }

    callback(null, config);
  });
};


/**
 *  Application#readPackageInfo(callback) -> Void
 *
 *  Reads `package.json` from application's root directory and fires
 *  `callback(err, json)`.
 *
 *  **NOTICE** File should be UTF-8 encoded.
 **/
Application.prototype.readPackageInfo = function readPackageInfo(callback) {
  var file = path.join(this.dirname, 'package.json');

  fs.readFile(file, 'utf-8', function (err, str) {
    if (err) {
      callback(err);
      return;
    }

    try {
      callback(null, JSON.parse(str));
    } catch (err) {
      callback(err);
    }
  });
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

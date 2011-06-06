var path    = require('path'),
    fs      = require('fs'),
    express = require('express'),
    railer  = require('express-railer'),
    Promise = require('./promise'),
    $$      = require('./utilities');


// Loads controller to the app dispatcher
var loadControllers = function loadControllers(app) {
  var dirname = path.join(app.__dirname__, 'app', 'controllers'),
      suffix_re = new RegExp('_controller\.js$');

  fs.readdir(dirname, function (err, files) {
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
  app.getConfig(function (err, config) {
    (config.routes || []).forEach(function (params) {
      if (params.root) {
        app.router.root(params.root);
      } else if (params.match) {
        app.router.match($$.grab(params, 'match'), params);
      } else {
        throw Error('Unkown routes option');
      }
    });
  });
};


/**
 *  new Application(dirname)
 *
 *  Creates new nodeca application with given `dirname` as appliction root.
 *
 *  ##### Example
 *
 *  var app = new (require('nodeca-lib').Application)(__dirname);
 **/
var Application = module.exports = function Application(dirname, extConfigs) {
  var self = this,
      libs_dir = path.join(dirname, 'lib/'),
      config_promise = new Promise();


  /**
   *  Application#__dirname__ -> String
   *
   *  **PRIVATE**
   *  Application root dir.
   **/
  this.__dirname__ = dirname;


  /**
   *  Application#__apps__ -> Object
   *
   *  **PRIVATE**
   *  Sub-applications hash.
   **/
  this.__apps__ = {};


  /**
   *  Application#getConfig(callback) -> Void
   *
   *  Fires callback with `err, config` once it became ready
   **/
  this.getConfig = config_promise.done;


  // read config and resolve promise
  $$.readYaml(path.join(dirname, 'config', 'defaults.yml'), function (err, cfg) {
    if (!extConfigs) {
      config_promise.resolve(err, cfg);
      return;
    }

    if (!Array.isArray(extConfigs)) {
      config_promise.resolve(Error('Wrong type of extra configs. Array expected.'));
      return;
    }

    $$.iterate(extConfigs, function (i, file, next) {
      $$.readYaml(path.join(dirname, 'config', file), function (err, extra) {
        if (err) {
          config_promise.resolve(err);
          return;
        }

        $$.deepMerge(cfg, $$.grab(extra, 'general') || {});
        $$.deepMerge(cfg, $$.grab(extra, process.env.NODE_ENV) || {});

        next();
      });
    }, function (err) {
      config_promise.resolve(err, cfg);
    });
  });


  /**
   *  Application#require(file) -> Mixed
   *  - file (String): File realtive to app's `lib` directory
   *
   *  Returns result of core `require` function against specified `file` under
   *  `lib/` directory.
   **/
  this.require = function require(file) {
    return require(path.join(libs_dir, file));
  };


  /**
   *  Application#dispatcher -> ExpressRailer.Dispatcher
   *
   *  Instance of application dispatcher.
   **/
  this.dispatcher = new railer.Dispatcher();


  /**
   *  Application#router -> ExpressRailer.Router
   *
   *  Instance of application router.
   **/
  this.router = new railer.Router(this.dispatcher);



  /**
   *  Application#mount(name, config, callback) -> Void
   *
   *  Initializes and mount application `name` with `config`.
   **/
  this.mount = function mount(name, config, callback) {
    var mount_cfg = $$.grab(config, 'mount') || {path: '/' + name};

    require(name).init(config, function (err, app) {
      if (err) {
        callback(err);
        return;
      }

      self.router.mount(mount_cfg, app.router);
      self.__apps__[name] = app;

      callback(err, app);
    });
  };
};


/**
 *  Application#init([config, ]callback) -> Void
 *
 *  Initializes application. You can specify `config` object to override default
 *  settings of `config/app.defaults.yml`, After all `callback` is called with
 *  Error if any occured and application itself (if everything is ok).
 **/
Application.prototype.init = function init(userConfig, callback) {
  var self = this;

  if (!callback) {
    callback = userConfig;
    userConfig = {};
  }

  this.getConfig(function (err, config) {
    if (err) {
      callback(err);
      return;
    }

    // merge in user defined config
    $$.deepMerge(config, userConfig);

    var models_dir = path.join(app.__dirname__, 'app', 'models'),
        start_app = function () {
          loadControllers(self);
          loadRoutes(self);
          callback(null, self, config);
        };

    path.exists(models_dir, function (exists) {
      if (!exitst) {
        try {
          start_app();
        } catch (err) {
          callback(err);
        }
        return;
      }

      fs.readdir(dirname, function (err, files) {
        if (err) {
          callback(err);
          return;
        }

        try {
          files.forEach(function (file) {
            require(path.join(dirname, file));
          });

          start_app(); 
        } catch (err) {
          callback(err);
        }
      });
    });
  });
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

'use strict';


// stdlib
var Fs = require('fs');
var Path = require('path');


// 3rd-party
var Async = require('async');
var Underscore = require('underscore');
var FsTools = require('fs-tools');
var StaticLulz = require('static-lulz');


// internal
var Application = require('./../application');
var StaticBundler = require('./../static-bundler');
var Hooker = require('./../support/hooker');
var HashTree = require('./../support/hash-tree');


/**
 *  nodeca
 *
 *  Nodeca global object
 **/
var nodeca = global.nodeca = {
  hooks: {},
  models: {
    // cache non-treeish models, where keys are api paths, e.g.
    // nodeca.models.__loaded__['forum.post'] = model;
    __loaded__: {} 
  },
  runtime: {
    apps: []
  }
};


/**
 *  nodeca.hooks.models
 **/
nodeca.hooks.models = new Hooker();


/**
 *  nodeca.hooks.init
 **/
nodeca.hooks.init = new Hooker();


/**
 *  nodeca.hooks.models.on(name, priority, hook) -> Void
 **/
nodeca.hooks.models.on = function (name, priority, hook) {
  nodeca.hooks.models.after(name, priority, function (callback) {
    try {
      // KLUDGE: It's not needed, as one may access loaded model
      //         directly through nodeca.model
      hook(nodeca.models.__loaded__[name]);
      callback();
    } catch (err) {
      callback(err);
    }
  });
};


/**
 *  nodeca.hooks.init.on(name, priority, hook) -> Void
 **/
nodeca.hooks.init.on = function (name, priority, hook) {
  nodeca.hooks.init.after(name, priority, hook);
};


////////////////////////////////////////////////////////////////////////////////


function load_main_app(app, next) {
  app.getConfig('application', function (err, config) {
    if (err) {
      next(err);
      return;
    }

    nodeca.config = config;
    Object.defineProperty(app, 'config', {value: nodeca.config});
    nodeca.runtime.apps.push(app);

    next();
  });
}


function init_logger(next) {
  // TODO: Implement winston initialization.
  nodeca.logger = {
    debug:  console.debug,
    log:    console.log,
    warn:   console.warn,
    err:    console.err
  };
  next(null);
}


function load_sub_apps(next) {
  var tasks = [];

  Underscore.each(nodeca.config.modules, function (modCfg, modName) {
    if (!modCfg || 'off' === modCfg || modCfg.disabled) {
      // skip disabled app
      return;
    }

    if (true === modCfg || 'on' === modCfg || 'object' !== typeof modCfg) {
      // app has no config overrides
      modCfg = {};
    }

    tasks.push(function (callback) {
      var app = require(modName);
      app.getConfig('defaults', function (err, cfgDefaults) {
        if (err) {
          callback(err);
          return;
        }

        nodeca.config.modules[modName] = Underscore.extend({}, cfgDefaults, modCfg);
        Object.defineProperty(app, 'config', {value: nodeca.config.modules[modName]});
        nodeca.runtime.apps.push(app);

        callback();
      });
    });
  });

  Async.parallel(tasks, next);
}


function init_apps(next) {
  Async.forEach(nodeca.runtime.apps, function (app, callback) {
    app.bootstrap(callback);
  }, next);
}


function load_models(next) {
  Async.forEach(nodeca.runtime.apps, function (app, callback) {
    var models_dirname = Path.join(app.root, 'models');

    FsTools.walk(models_dirname, function (file, stats, next_file) {
      var api_path;
      
      api_path = file
        .replace(models_dirname, '')
        .replace(/^\/|\.js$/g, '')
        .replace(/\//g, '.');


      nodeca.hooks.models.run(api_path, function (next_hook) {
        try {
          var model = require(file);

          if (!!nodeca.models.__loaded__[api_path]) {
            next_hook(new Error("Duplicate model: " + api_path));
            return;
          }

          HashTree.set(nodeca.models, api_path, model);
          nodeca.models.__loaded__[api_path] = model;

          next_hook();
        } catch (err) {
          next_hook(err);
          return;
        }
      }, next_file);
    }, callback);
  }, next);
}


function init_models(next) {
  var tasks = [];

  Underscore.each(nodeca.models.__loaded__, function (model, api_path) {
    if ('function' === typeof model.__init__) {
      tasks.push(function (callback) {
        HashTree.set(nodeca.models, api_path, model.__init__());
      });
    }
  });

  Async.parallel(tasks, next);
}


// TODO: Initilization of API tree is missing
function init_api_tree(next) {

}


function init_settings(next) {
  // TODO: Settings initialization
  next();
}


function init_translations(next) {
  // TODO: Translations initialization
  next();
}


function build_bundles(next) {
  StaticBundler.bundle(nodeca, function (err, bundle_dir) {
    nodeca.runtime.bundled_assets = bundle_dir;
    next(err);
  });
}


function init_router(next) {
  // TODO: Router initialization
  next(new Error("Not implemented yet"));
}


function init_views(next) {
  // TODO: init_views? We get views in bundles builder...
  next();
}


function init_assets_server(next) {
  nodeca.runtime.lulz_server = new StaticLulz();

  FsTools.walk(nodeca.runtime.bundled_assets, function (file, stats, next_file) {
    // Fill in Static lulz with files and data
    Async.waterfall([
      Async.apply(Fs.readFile, file),
      function (buffer, callback) {
        var rel_path = file.replace(nodeca.runtime.bundled_assets, '');
        nodeca.runtime.lulz_server.add(rel_path, buffer);
        callback();
      }
    ], next_file);
  }, next);
}


////////////////////////////////////////////////////////////////////////////////


// expose module-function.
module.exports = function initialize(main, callback) {
  var stage = function (name, fn) {
    return Async.apply(nodeca.hooks.init.run, name, fn);
  };

  Async.series([
    Async.apply(load_main_app, main),

    // run stages
    stage('logger',             init_logger),
    stage('apps-loaded',        load_sub_apps),
    stage('apps-initialized',   init_apps),
    stage('models-loaded',      load_models),
    stage('models-initialized', init_models),
    stage('settings',           init_settings),
    stage('translations',       init_translations),
    stage('bundles',            build_bundles),
    stage('router',             init_router),
    stage('views',              init_views),
    stage('assets-server',      init_assets_server)
  ], callback);
};

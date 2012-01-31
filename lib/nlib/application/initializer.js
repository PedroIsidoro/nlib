'use strict';


// stdlib
var Fs = require('fs');
var Path = require('path');


// 3rd-party
var Async = require('async');
var Underscore = require('underscore');
var FsTools = require('fs-tools');


// internal
var Application = require('./../application');
var Hooker = require('./../support/hooker');


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


// Inserts obj with given api path into tree:
// insert_into_tree(nodeca.models, 'forum.post', model);
function insert_into_tree(tree, api, obj) {
  throw "Not implemented yet";
}


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
    Object,defineProperty(app, 'config', {value: nodeca.config});
    nodeca.runtime.apps.push(app);
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
        Object,defineProperty(app, 'config', {value: nodeca.config.modules[modName]});
        nodeca.runtime.apps.push(main);

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

    FsTools.walk(models_path, function (file, stats, next_file) {
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

          insert_into_tree(nodeca.models, api_path, model);
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
        insert_into_tree(nodeca.models, api_path, model.__init__());
      });
    }
  });

  Async.parallel(tasks, next);
}


function init_settings(next) {
  next(new Error("Not implemented yet"));
}


function init_translations(next) {
  next(new Error("Not implemented yet"));
}


function build_bundles(next) {
  next(new Error("Not implemented yet"));
}


function init_router(next) {
  next(new Error("Not implemented yet"));
}


function init_views(next) {
  next(new Error("Not implemented yet"));
}


function init_assets_server(next) {
  next(new Error("Not implemented yet"));
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

'use strict';


// stdlib
var Fs = require('fs');
var Path = require('path');


// 3rd-party
var Async = require('async');
var Underscore = require('underscore');
var JsYaml = require('js-yaml');
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
  models: {},
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
  Async.forEach(HashTree.getKnownPaths(nodeca.models), function (api_path, callback) {
    var model = HashTree.get(nodeca.models, api_path);

    if ('function' === typeof model.__init__) {
      HashTree.set(nodeca.models, api_path, model.__init__());
    }

    callback();
  }, next);
}


function init_server_api_tree(next) {
  // TODO: Server API tree init
  next();
}


function init_shared_api_tree(next) {
  // TODO: Server API tree init
  next();
}


function init_client_api_tree(next) {
  // TODO: Server API tree init
  next();
}


function init_settings(next) {
  // TODO: Settings initialization
  next();
}


function init_translations(next) {
  // TODO: Translations initialization
  next();
}


function init_themes_configs(next) {
  var is_enabled, config;

  nodeca.runtime.themes = {};

  // get white/black lists of themes
  config = nodeca.config.themes || {};

  // check whenever theme is enabled or not
  is_enabled = function (id) {
    // when whitelist speciefied:
    // enable only those specified in whitelist
    if (config.enabled) {
      return 0 <= config.enabled.indexOf(id);
    // when blacklist is given and there's no whitelist
    // enable only those, not specified in the blacklist
    } else if (config.disabled) {
      return -1 === config.disabled.indexOf(id);
    // else, when no white/black lists are given
    // enable by default
    } else {
      return true;
    }
  };

  // read theme configs
  Async.forEachSeries(nodeca.runtime.apps, function (app, next_app) {
    FsTools.walk(Path.join(app.root, 'config', 'themes'), function (file, stats, next_file) {
      var theme_id, config;
      
      theme_id = Path.basename(file);
      config = JsYaml.load(Fs.readFileSync(file));

      config.disabled = !is_enabled(theme_id);

      nodeca.runtime.themes[theme_id] = config;
    });
  }, next);
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
  nodeca.runtime.views = {};
  Async.forEach(nodeca.runtime.themes, function (theme, next_theme) {
    var theme_path, theme_views;

    theme_views = nodeca.runtime.views[theme] = {};
    theme_path = Path.join(nodeca.runtime.bundled_assets, 'views', theme);

    FsTools.walk(theme_path, function (file, stats, next_file) {
      var data, lang, namespace;

      data = require(file);
      lang = Path.basename(file);
      namespace = Path.dirname(file)
        .replace(theme_path, '')
        .replace(/^\/+|\/+$/g, '')
        .replace(/\//g, '.');

      //  in:   /default-blue/forum/posts/ru-RU.json
      //  out:  views['default-blue']['ru-RU'].forum.posts
      HashTree.set(theme_views, lang + '.' + namespace, data);

      next_file();
    }, next_theme);
  }, next);
  next();
}


function init_assets_server(next) {
  nodeca.runtime.assets_server = new StaticLulz();

  FsTools.walk(nodeca.runtime.bundled_assets, function (file, stats, next_file) {
    // Fill in Static lulz with files and data
    Async.waterfall([
      Async.apply(Fs.readFile, file),
      function (buffer, callback) {
        var rel_path = file.replace(nodeca.runtime.bundled_assets, '');
        nodeca.runtime.assets_server.add(rel_path, buffer);
        callback();
      }
    ], next_file);
  }, next);
}


////////////////////////////////////////////////////////////////////////////////


// expose module-function.
module.exports = function initialize(main, callback) {
  var stage = function () {
    var hook, steps, func;

    hook  = arguments[0];
    steps = Array.prototype.slice.call(arguments, 1);
    func  = Async.apply(Async.series, steps);

    return Async.apply(nodeca.hooks.init.run, hook, func);
  };

  Async.series([
    Async.apply(load_main_app, main),

    // run stages
    stage('logger',               init_logger),
    stage('apps-loaded',          load_sub_apps),
    stage('apps-initialized',     init_apps),
    stage('models-loaded',        load_models),
    stage('models-initialized',   init_models),
    stage('api-tree-initialized', init_server_api_tree,
                                  init_shared_api_tree,
                                  init_client_api_tree),
    stage('settings',             init_settings),
    stage('translations',         init_translations),
    stage('themes-configs',       init_themes_configs),
    stage('bundles',              build_bundles),
    stage('router',               init_router),
    stage('views',                init_views),
    stage('assets-server',        init_assets_server)
  ], callback);
};

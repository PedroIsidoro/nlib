/** internal
 *  Application.Initializer
 **/


'use strict';


// TODO:  Move hooks into NLib.Application scope,
//        so creation of nodeca tree could be made in:
//        Application.hooks.before('initialization', handler);


// stdlib
var Fs = require('fs');
var Path = require('path');


// 3rd-party
var Async = require('async');
var _ = require('underscore');
var JsYaml = require('js-yaml');
var FsTools = require('fs-tools');
var BabelFish = require('babelfish');
var Pointer = require('pointer');


// internal
var StaticBundler = require('./static-bundler');
var Hooker = require('../support/hooker');
var HashTree = require('../support/hash-tree');
var Common = require('../common');


/**
 *  nodeca
 *
 *  Nodeca global object
 **/
var nodeca = {
  hooks: {},
  models: {},
  server: {},
  shared: {},
  client: {},
  config: {},
  runtime: {
    views: {}
  }
};


// reference to the main app and main config
// used within initializer only
var main_app = null;
var main_cfg = null;

// sandbox that exists within initializer only
var init_env = {
  apps: [],
  themes: {},
  registerView: function (path, fun) {
    HashTree.set(nodeca.runtime.views, path, fun);
  }
};


/**
 *  nodeca.hooks.models -> Hooker
 **/
nodeca.hooks.models = new Hooker();


/**
 *  nodeca.hooks.init -> Hooker
 **/
nodeca.hooks.init = new Hooker();


/**
 *  nodeca.filter -> Hooker
 **/
nodeca.filters = new Hooker();


// regexp that matches ll files except those with `_` prefix
var NON_PARTIAL_RE = /\/[^_][^\/]+$/;


////////////////////////////////////////////////////////////////////////////////


function load_app_configs(app, callback) {
  var config = {};

  FsTools.walk(Path.join(app.root, 'config'), /[.]yml$/, function (file, stats, next) {
    Async.waterfall([
      Async.apply(Fs.readFile, file),
      function (data, next) {
        Common.mergeConfigs(config, JsYaml.load(data));
      }
    ], next);
  }, function (err) {
    callback(err, config);
  });
}


function load_main_app(next) {
  init_env.apps.push(main_app);
  load_app_configs(main_app, function (err, config) {
    main_cfg = config;
    next(err);
  });
}


function init_logger(next) {
  // TODO: Implement winston initialization.
  nodeca.logger = {
    debug:  console.log,
    log:    console.log,
    warn:   console.warn,
    error:  console.error
  };
  next(null);
}


function load_sub_apps(next) {
  nodeca.config = {};

  if (!main_cfg.applications) {
    // no sub-apps
    next(null);
    return;
  }

  Async.forEachSeries(_.keys(main_cfg.applications), function (app_name, next_app) {
    var app;

    if (!main_cfg.applications[app_name]) {
      next_app();
      return;
    }

    try {
      app = require(app_name);
    } catch (err) {
      next_app(err);
      return;
    }

    init_env.apps.push(app);
    load_app_configs(app, function (err, config) {
      Common.mergeConfigs(nodeca.config, config);
      next_app(err);
    });
  }, next);
}


function expand_environment_configs(obj) {
  _.each(obj, function (val, key) {
    if ('^' === key[0]) {
      delete obj[key];

      if (nodeca.runtime.env === key.substr(1)) {
        Common.mergeConfigs(obj, val);
      }

      return;
    }

    if (_.isObject(val)) {
      expand_environment_configs(val);
    }
  });
}


function apply_main_config(next) {
  Common.mergeConfigs(nodeca.config, main_cfg);
  expand_environment_configs(nodeca.config);
  next();
}


function init_all_apps(next) {
  Async.forEach(init_env.apps, function (app, callback) {
    app.bootstrap(nodeca, callback);
  }, next);
}


function load_models(next) {
  Async.forEach(init_env.apps, function (app, next_app) {
    var models_dirname = Path.join(app.root, 'models');

    FsTools.walk(models_dirname, NON_PARTIAL_RE, function (file, stats, next_file) {
      var api_path, model;

      api_path = file
        .replace(models_dirname, '')
        .replace(/^\/|[.]js$/g, '')
        .replace(/\//g, '.');

      if (HashTree.has(nodeca.models, api_path)) {
        next_app(new Error("Duplicate model: " + api_path));
        return;
      }

      try {
        model = require(file);
      } catch (err) {
        next_file(err);
        return;
      }

      nodeca.hooks.models.run(api_path, model, null, function (err) {
        if (err) {
          next_file(err);
          return;
        }

        if ('function' === model.__init__) {
          model = model.__init__();
          delete model.__init__;
        }

        HashTree.set(nodeca.models, api_path, model);
        next_file();
      });
    }, next_app);
  }, next);
}


function load_api_subtree(branch, next) {
  Async.forEachSeries(init_env.apps, function (app, next_app) {
    var branch_path = Path.join(app.root, branch);
    FsTools.walk(branch_path, NON_PARTIAL_RE, function (file, stats, next_file) {
      var api_path, leaf;

      api_path = file
        .replace(branch_path, '')
        .replace(/^\/|[.]js$/g, '')
        .replace(/\//g, '.');

      if (HashTree.has(nodeca[branch], api_path)) {
        next_file(new Error("Duplicate " + branch + " api tree node: " + api_path));
        return;
      }

      try {
        leaf = require(file);
      } catch (err) {
        next_file(err);
        return;
      }

      if ('function' === leaf.__init__) {
        leaf = leaf.__init__();
        delete leaf.__init__;
      }

      HashTree.set(nodeca[branch], api_path, leaf);
      next_file();
    }, next_app);
  }, next);
}


function load_settings(next) {
  // TODO: Settings initialization
  next();
}


function init_translations(next) {
  var enabledLocales, defaultLocale, cfg;

  // make sure we have at least empty object as config
  cfg = nodeca.config.locales || (nodeca.config.locales = {});

  enabledLocales  = (cfg['enabled']) ? cfg['enabled'] : _.keys(nodeca.config.i18n || {});
  defaultLocale   = (cfg['default']) ? cfg['default'] : enabledLocales[0];

  if (-1 === enabledLocales.indexOf(defaultLocale)) {
    next(new Error("Default locale " + defaultLocale + " must be enabled"));
    return;
  }

  nodeca.runtime.i18n = new BabelFish(defaultLocale);

  // reset languages configuration
  nodeca.config.locales = {
    "default": defaultLocale,
    "enabled": enabledLocales,
    "aliases": cfg['aliases'] || {}
  };

  // fill in locales
  _.each(enabledLocales, function (locale) {
    _.each(nodeca.config.i18n[locale], function (data, scope) {
      nodeca.runtime.i18n.addPhrase(locale, scope, data);
    });
  });

  next();
}


function load_themes_configs(next) {
  var is_enabled, config;

  init_env.themes = {};

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
  Async.forEachSeries(init_env.apps, function (app, next_app) {
    FsTools.walk(Path.join(app.root, 'config', 'themes'), /[.]yml$/, function (file, stats, next_file) {
      var theme_id, config;

      try {
        theme_id = Path.basename(file, '.yml');
        config = JsYaml.load(Fs.readFileSync(file));
      } catch (err) {
        next_file(err);
        return;
      }

      config.disabled = !is_enabled(theme_id);

      init_env.themes[theme_id] = config;
      next_file();
    }, next_app);
  }, next);
}


function build_bundles(next) {
  StaticBundler.bundle(nodeca, init_env, function (err, bundle_dir) {
    nodeca.runtime.assets_path = bundle_dir;
    next(err);
  });
}


function init_router(next) {
  var config = nodeca.config.router;

  nodeca.runtime.router = new Pointer();

  // TODO: fill the router
  next();
}


////////////////////////////////////////////////////////////////////////////////


/** internal
 *  Application.Initializer.preload(mainApp, callback) -> Void
 **/
module.exports.preload = function preload(mainApp, callback) {
  main_app = mainApp;

  Async.series([
    load_main_app,
    init_logger,
    load_sub_apps,
    apply_main_config,
    init_all_apps
  ], callback);
};


/** internal
 *  Application.Initializer.initialize(callback) -> Void
 **/
module.exports.initialize = function initialize(callback) {
  var stage = function (hook, func) {
    // Async apply calls function with null context.
    // So using our own wrapper.
    return function (next) { nodeca.hooks.init.run(hook, func, next); };
  };

  nodeca.hooks.init.run('initialization', function (init_complete) {
    Async.series([
      stage('models-tree',    load_models),
      stage('server-tree',    Async.apply(load_api_subtree, 'server')),
      stage('shared-tree',    Async.apply(load_api_subtree, 'shared')),
      stage('client-tree',    Async.apply(load_api_subtree, 'client')),
      stage('settings',       load_settings),
      stage('translations',   init_translations),
      stage('themes-configs', load_themes_configs),
      stage('bundles',        build_bundles),
      stage('router',         init_router)
    ], init_complete);
  }, callback);
};


////////////////////////////////////////////////////////////////////////////////


global.nodeca = nodeca;
global._ = _;

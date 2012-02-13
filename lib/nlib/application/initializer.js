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
var Underscore = require('underscore');
var JsYaml = require('js-yaml');
var FsTools = require('fs-tools');
var StaticLulz = require('static-lulz');
var BabelFish = require('babelfish');
var CrossRoads = require('crossroads');


// internal
var StaticBundler = require('./static-bundler');
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
  server: {},
  shared: {},
  client: {},
  runtime: {}
};


// sandbox that exists during init stage only
var init_env = {
  apps: [],
  themes: {}
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


function load_main_app(app, next) {
  app.readConfigFile('application', function (err, config) {
    if (err) {
      next(err);
      return;
    }

    app.config = nodeca.config = config;
    init_env.apps.push(app);

    next();
  });
}


function init_logger(next) {
  // TODO: Implement winston initialization.
  nodeca.logger = {
    debug:  console.debug,
    log:    console.log,
    warn:   console.warn,
    error:  console.error
  };
  next();
}


function load_sub_apps(next) {
  Async.forEachSeries(Underscore.keys(nodeca.config.modules), function (mod_name, next_mod) {
    var app, mod_cfg = nodeca.config.modules[mod_name];

    if (false === mod_cfg || 'off' === mod_cfg || mod_cfg.disabled) {
      // skip disabled app
      next_mod();
      return;
    }

    if (true === mod_cfg || 'on' === mod_cfg || 'object' !== typeof mod_cfg) {
      // app has no config overrides
      mod_cfg = {};
    }

    try {
      app = require(mod_name);
    } catch (err) {
      next_mod(err);
      return;
    }

    app.readConfigFile('defaults', function (err, defaults) {
      if (err) {
        next_mod(err);
        return;
      }

      app.config = nodeca.config.modules[mod_name] = Underscore.extend({}, defaults, mod_cfg);
      init_env.apps.push(app);

      next_mod();
    });
  }, function (err) {
    next(err);
  });
}


function init_apps(next) {
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
        .replace(/^\/|\.js$/g, '')
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
        .replace(/[.]js$/, '')
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


function load_translations(next) {
  var locales = {};

  Async.forEachSeries(init_env.apps, function (app, next_app) {
    var locales_path = Path.join(app.root, 'config', 'locales');
    FsTools.walk(locales_path, /[.]ya?ml$/i, function (file, stats, next_file) {
      var data;

      try {
        data = JsYaml.load(Fs.readFileSync(file));
      } catch (err) {
        next_file(err);
        return;
      }

      Underscore.each(data, function (locale, phrases) {
        if (!locales[locale]) {
          locales[locale] = {};
        }

        Underscore.extend(locales[locale], data);
      });

      next_file();
    }, next_app);
  }, function (err) {
    next(err, locales);
  });
}


function init_translations(locales, next) {
  var enabledLocales, defaultLocale, cfg;

  // make sure we have at least empty object as config
  cfg = nodeca.config.languages || (nodeca.config.languages = {});

  enabledLocales  = (cfg['enabled']) ? cfg['enabled'] : Underscore.keys(locales);
  defaultLocale   = (cfg['default']) ? cfg['default'] : enabledLocales[0];

  if (-1 === enabledLocales.indexOf(defaultLocale)) {
    next(new Error("Default locale " + defaultLocale + " must be enabled"));
    return;
  }

  nodeca.runtime.i18n = new BabelFish(defaultLocale);

  // reset languages configuration
  nodeca.config.languages = {
    "default": defaultLocale,
    "enabled": enabledLocales,
    "aliases": cfg['aliases'] || {}
  };

  // fill in locales
  Underscore.each(enabledLocales, function (locale) {
    Underscore.each(locales[locale], function (data, scope) {
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
    FsTools.walk(Path.join(app.root, 'config', 'themes'), function (file, stats, next_file) {
      var theme_id, config;

      try {
        theme_id = Path.basename(file);
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


// TODO:  refactor load/init routes/router into waterfall, once NRouter will be
//        finished...


function load_routes(next) {
  var routes = {};

  // merge routes in reverse order, so main app routes will override defaults
  Async.forEachSeries(init_env.apps.reverse(), function (app, next_app) {
    app.readConfigFile('routes', function (err, app_routes) {
      if (err) {
        next_app(err);
        return;
      }

      Underscore.extend(routes, app_routes);
      next_app();
    });
  }, function (err) {
    next(err, routes);
  });
}


function init_router(routes, next) {
  nodeca.runtime.router = CrossRoads;

  Async.forEachSeries(Underscore.keys(init_env.routes.routes), function (match) {
    var route = routes.routes[match];
    nodeca.runtime.router.addRoute(match, HashTree.get(nodeca.server, route.to));
  });
}


function init_views(next) {
  /*jshint evil:true*/
  nodeca.runtime.views = {};
  Async.forEach(init_env.themes, function (theme_id, next_theme) {
    var theme_path, theme_views;

    theme_views = nodeca.runtime.views[theme_id] = {};
    theme_path = Path.join(nodeca.runtime.assets_path, 'views', theme_id);

    FsTools.walk(theme_path, function (file, stats, next_file) {
      var data, lang, namespace;

      try {
        data = eval(require(file).dump);
      } catch (err) {
        next_file(err);
        return;
      }

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


////////////////////////////////////////////////////////////////////////////////


/**
 *  Application.Initializer.initialize(main, callback) -> Void
 **/
module.exports.initialize = function initialize(main, callback) {
  var stage = function () {
    var hook, steps, func;

    hook  = arguments[0];
    steps = Array.prototype.slice.call(arguments, 1);
    func  = Async.apply(Async.waterfall, steps);

    // Async apply calls function with null context.
    // So using our own wrapper.
    return function (next) { nodeca.hooks.init.run(hook, func, next); };
  };

  nodeca.hooks.init.run('initialize', function (init_complete) {
    Async.series([
      Async.apply(load_main_app, main),

      // run stages
      stage('logger',               init_logger),
      stage('apps-loaded',          load_sub_apps),
      stage('apps-initialized',     init_apps),
      stage('models',               load_models),
      stage('api-tree-initialized', Async.apply(load_api_subtree, 'server'),
                                    Async.apply(load_api_subtree, 'shared'),
                                    Async.apply(load_api_subtree, 'client')),
      stage('settings',             load_settings),
      stage('translations',         load_translations,
                                    init_translations),
      stage('themes-configs',       load_themes_configs),
      stage('bundles',              build_bundles),
      stage('router',               load_routes,
                                    init_router),
      stage('views',                init_views)
    ], init_complete);
  }, callback);
};

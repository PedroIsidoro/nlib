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
  themes: {},
  locales: {},
  routes: {}
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


////////////////////////////////////////////////////////////////////////////////


function load_main_app(app, next) {
  app.getConfig('application', function (err, config) {
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
    err:    console.err
  };
  next();
}


function load_sub_apps(next) {
  Async.forEachSeries(Underscore.keys(nodeca.config.modules), function (mod_name, next_mod) {
    var app, mod_cfg = nodeca.config.modules[mod_name];

    if (false === mod_cfg || 'off' === mod_cfg || mod_cfg.disabled) {
      // skip disabled app
      next_mod();
    }

    if (true === mod_cfg || 'on' === mod_cfg || 'object' !== typeof mod_cfg) {
      // app has no config overrides
      mod_cfg = {};
    }

    app = require(mod_name);
    app.getConfig('defaults', function (err, defaults) {
      if (err) {
        next_mod(err);
        return;
      }

      app.config = nodeca.config.modules[mod_name] = Underscore.extend({}, defaults, mod_cfg);
      init_env.apps.push(app);

      next_mod();
    });
  }, next);
}


function init_apps(next) {
  Async.forEach(init_env.apps, function (app, callback) {
    app.bootstrap(nodeca, callback);
  }, next);
}


function load_models(next) {
  // empty function used to "glue" before/after filters
  var noop = function () {};

  Async.forEach(init_env.apps, function (app, next_app) {
    var models_dirname = Path.join(app.root, 'models');

    FsTools.walk(models_dirname, /\/[^_][^\/]+$/, function (file, stats, next_file) {
      var api_path, model;

      api_path = file
        .replace(models_dirname, '')
        .replace(/^\/|\.js$/g, '')
        .replace(/\//g, '.');

      if (HashTree.has(nodeca.models, api_path)) {
        next_app(new Error("Duplicate model: " + api_path));
        return;
      }

      model = require(file);

      nodeca.hooks.models.run(api_path, model, noop, function (err) {
        if (err) {
          next_file(err);
          return;
        }

        if ('function' === model.__init__) {
          model = model.__init__();
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
    FsTools.walk(branch_path, function (file, stats, next_file) {
      var api_path, leaf;

      api_path = file
        .replace(branch_path, '')
        .replace(/[.]js$/, '')
        .replace(/\//g, '.');

      if (HashTree.has(nodeca[branch], api_path)) {
        next_file(new Error("Duplicate " + branch + " api tree node: " + api_path));
        return;
      }

      leaf = require(file);
      if ('function' === leaf.__init__) {
        leaf = leaf.__init__(nodeca);
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
  init_env.locales = {};

  Async.forEachSeries(init_env.apps, function (app, next_app) {
    var locales_path = Path.join(app.root, 'config', 'locales');
    FsTools.walk(locales_path, function (file, stats, next_file) {
      var locale, data;

      locale = Path.basename(file, Path.extname(file));
      data = JsYaml.load(Fs.readFileSync(file))[locale];

      if (!init_env.locales[locale]) {
        init_env.locales[locale] = data || {};
      } else {
        Underscore.extend(init_env.locales[locale], data);
      }

      next_file();
    }, next_app);
  }, next);
}


function init_translations(next) {
  var enabledLocales = ['en-US'], defaultLocale = 'en-US', localeAliases = [];

  if (nodeca.config.languages) {
    if (nodeca.config.languages["enabled"]) {
      enabledLocales = nodeca.config.languages["enabled"];
    }

    if (nodeca.config.languages["default"]) {
      defaultLocale = nodeca.config.languages["default"];
    }

    if (nodeca.config.languages["aliases"]) {
      localeAliases = nodeca.config.languages["aliases"];
    }

    if (-1 === enabledLocales.indexOf(defaultLocale)) {
      enabledLocales.unshift(defaultLocale);
    }
  }

  nodeca.runtime.translator = new BabelFish(defaultLocale);

  // reset languages configuration
  nodeca.config.languages = {
    "default": defaultLocale,
    "enabled": enabledLocales,
    "aliases": localeAliases
  };

  // fill in locales
  Underscore.each(enabledLocales, function (locale) {
    Underscore.each(init_env.locales[locale], function (data, scope) {
      nodeca.runtime.translator.addPhrase(locale, scope, data);
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
      
      theme_id = Path.basename(file);
      config = JsYaml.load(Fs.readFileSync(file));

      config.disabled = !is_enabled(theme_id);

      init_env.themes[theme_id] = config;
    });
  }, next);
}


function build_bundles(next) {
  StaticBundler.bundle(nodeca, function (err, bundle_dir) {
    nodeca.runtime.assets_path = bundle_dir;
    next(err);
  });
}


// TODO:  refactor load/init routes/router into waterfall, once NRouter will be
//        finished...


function load_routes(next) {
  Async.forEachSeries(init_env.apps, function (app, next_app) {
    app.getConfig('routes', function (err, routesCfg) {
      if (err) {
        next_app(err);
        return;
      }

      Underscore.extend(init_env.routes, routesCfg);
      next_app();
    });
  }, next);
}


function init_router(next) {
  nodeca.runtime.router = CrossRoads;

  Async.forEachSeries(Underscore.keys(init_env.routes.routes), function (match) {
    var route = init_env.routes.routes[match];
    nodeca.runtime.router.addRoute(match, HashTree.get(nodeca.server, route.to));
  });
}


function init_views(next) {
  nodeca.runtime.views = {};
  Async.forEach(init_env.themes, function (theme, next_theme) {
    var theme_path, theme_views;

    theme_views = nodeca.runtime.views[theme] = {};
    theme_path = Path.join(nodeca.runtime.assets_path, 'views', theme);

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


////////////////////////////////////////////////////////////////////////////////


module.exports.initialize = function initialize(main, callback) {
  var stage = function () {
    var hook, steps, func;

    hook  = arguments[0];
    steps = Array.prototype.slice.call(arguments, 1);
    func  = Async.apply(Async.series, steps);

    return Async.apply(nodeca.hooks.init.run, hook, func);
  };

  nodeca.hooks.init.run('initialize', function (init_complete) {
    Async.series([
      Async.apply(load_main_app, main),

      // run stages
      stage('logger',               init_logger),
      stage('apps-loaded',          load_sub_apps),
      stage('apps-initialized',     init_apps),
      stage('models',               load_models),
      stage('api-tree-initialized', Async.apply('server', load_api_subtree),
                                    Async.apply('shared', load_api_subtree),
                                    Async.apply('client', load_api_subtree)),
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

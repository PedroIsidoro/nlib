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


// sandbox that exists within initializer only
var init_env = {
  apps: [],
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


function load_configs(dir, callback) {
  var config = {};

  FsTools.walk(dir, /[.]yml$/, function (file, stats, next) {
    Async.waterfall([
      Async.apply(Fs.readFile, file),
      function (data, next) {
        Common.mergeConfigs(config, JsYaml.load(data));
        next();
      }
    ], next);
  }, function (err) {
    callback(err, config);
  });
}


function init_config(next) {
  var app_root = nodeca.runtime.main_app.root, main_cfg = {}, config = {};

  Async.series([
    // load main app cnfig
    function (next) {
      var cfg_path = Path.join(app_root, 'config');
      load_configs(cfg_path, function (err, app_cfg) {
        main_cfg = app_cfg;
        next(err);
      });
    },
    //
    // read configs of sub-applications
    function (next) {
      // FIXME: JsYaml returns object for sequence???
      var subapps = _.values(main_cfg.applications);

      Async.forEachSeries(subapps, function (app_name, next_app) {
        var cfg_path = Path.join(app_root, 'node_modules', app_name, 'config');

        load_configs(cfg_path, function(err, app_cfg) {
          Common.mergeConfigs(config, app_cfg);
          next_app(err);
        });
      }, next);
    },
    //
    // merge in main config and resolve `per-environment` configs
    function (next) {
      Common.mergeConfigs(config, main_cfg);

      // expand environment-dependent configs
      _.each(config, function (val, key) {
        if ('^' === key[0]) {
          delete config[key];

          if (nodeca.runtime.env === key.substr(1)) {
            Common.mergeConfigs(config, val);
          }
        }
      });

      next();
    },
    //
    // post-process config
    function (next) {
      var is_enabled, cfg;

      // get white/black lists of themes
      cfg = nodeca.config.themes || {};

      // check whenever theme is enabled or not
      is_enabled = function (id) {
        // when whitelist speciefied:
        // enable only those specified in whitelist
        if (cfg.enabled) {
          return 0 <= cfg.enabled.indexOf(id);
        // when blacklist is given and there's no whitelist
        // enable only those, not specified in the blacklist
        } else if (cfg.disabled) {
          return -1 === cfg.disabled.indexOf(id);
        // else, when no white/black lists are given
        // enable by default
        } else {
          return true;
        }
      };

      _.each(config.theme_schemas, function (opts, id) {
        opts.enabled = is_enabled(id);
      });

      next();
    }
  ], function (err/*, results */) {
    nodeca.config = config;
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


function init_apps(next) {
  init_env.apps.push(nodeca.runtime.main_app);

  try {
    _.each(nodeca.config.applications, function (app_name) {
      init_env.apps.push(require(app_name));
    });
  } catch (err) {
    next(err);
    return;
  }

  Async.forEachSeries(init_env.apps, function (app, next_app) {
    app.bootstrap(nodeca, next_app);
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


function build_bundles(next) {
  StaticBundler.bundle(nodeca, init_env, function (err, bundle_dir) {
    nodeca.runtime.assets_path = bundle_dir;
    next(err);
  });
}


function fix_params_regexps(obj) {
  if (!obj) {
    // noting to do
    return;
  }

  _.each(obj, function (k, val) {
    if (_.isString(val) && '/' === val[0] && '/' === val.substr(-1)) {
      obj[k] = new RegExp(val.substr(1, -1));
      return;
    }

    if (_.isString(val.match) && '/' === val.match[0] && '/' === val.match.substr(-1)) {
      val.match = new RegExp(val.match.substr(1, -1));
      return;
    }

    if (_.isString(val.match)) {
      val.match = new RegExp(val.match);
      return;
    }
  });
}


function find_mount_point(api_path, default_mount, mount_points) {
  var parts = api_path.split('.'), processed = [], result = default_mount;

  while (parts.length) {
    processed.push(parts.shift());
    result = mount_points[processed.join('.')] || result;
  }

  return result;
}


function init_router(next) {
  var config = nodeca.config.router, pointer, default_mount;

  pointer = nodeca.runtime.router = new Pointer();

  // calculate default route
  default_mount = '//' + nodeca.config.listen.host;
  if (80 !== nodeca.config.listen.port) {
    default_mount += ':' + nodeca.config.listen.port;
  }
  if ('/' !== nodeca.config.listen.path.replace(/^\/+|\/+$/g, '')) {
    default_mount += '/' + nodeca.config.listen.path.replace(/^\/+|\/+$/g, '');
  }

  //
  // fill in routes
  _.each(config.map || {}, function (routes, api_path) {
    var prefix, func;

    prefix = find_mount_point(api_path, default_mount, config.mount || {});
    func = HashTree.get(nodeca.server, api_path) || function (params, cb) {
      cb(new Error('Unkown server method: ' + api_path));
    };

    _.each(routes, function (params, pattern) {
      if ('#' !== pattern[0]) {
        // skip non-server routes
        return;
      }

      pointer.addRoute(pattern, {
        name: api_path,
        prefix: prefix,
        params: fix_params_regexps(params),
        handler: func
      });
    });
  });

  //
  // fill in redirects
  _.each(config.redirects || {}, function (options, old_pattern) {
    var code, link_to;

    // redirect provided as a function
    if (_.isFunction(options.to)) {
      pointer.addRoute(old_pattern, {
        params: fix_params_regexps(options.params),
        handler: function (params, cb) {
          options.to.call(nodeca, params, cb);
        }
      });
      return;
    }

    // create detached route - to build URLs
    code = options.to.shift();
    link_to = Pointer.createLinkBuilder(options.to.shift(), options.params);

    pointer.addRoute(old_pattern, {
      params: fix_params_regexps(options.params),
      handler: function (params, cb) {
        var url = link_to(params);

        if (!url) {
          cb(new Error('Invalid redirect.'));
          return;
        }

        cb({redirect: [code, url]});
      }
    });
  });

  //
  // fill in direct invocators
  _.each(config.direct_invocators || {}, function (enabled, api_path) {
    if (!enabled) {
      // skip disabled invocators
      return;
    }

    pointer.addRoute('/!' + api_path, {
      handler: HashTree.get(nodeca.server, api_path) || function (params, cb) {
        cb(new Error('Unkown server method: ' + api_path));
      }
    });
  });

  next();
}


////////////////////////////////////////////////////////////////////////////////


/** internal
 *  Application.Initializer.preload(mainApp, callback) -> Void
 **/
module.exports.preload = function preload(mainApp, callback) {
  nodeca.runtime.main_app = mainApp;

  Async.series([
    init_config,
    init_logger,
    init_apps,
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
      stage('bundles',        build_bundles),
      stage('router',         init_router)
    ], init_complete);
  }, callback);
};


////////////////////////////////////////////////////////////////////////////////


global.nodeca = nodeca;
global._ = _;

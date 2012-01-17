/**
 *  StaticBundler
 *
 *  Collect and build views, assets, api trees etc from all applications
 **/


'use strict';


// stdlib
var Fs = require('fs');
var Path = require('path');


// 3rd-party
var Async = require('async');
var Underscore = require('underscore');
var FsTools = require('fs-tools');


// internal
var Utilities = require('./utilities');
var Builder = require('./static-bundler/builder');


// PRIVATE /////////////////////////////////////////////////////////////////////


//  tmpdir(name) -> String
//  - name (String): Base name of the directory
//
//  Returns unique name (for the temporary directory)
//
//  ##### Example:
//
//      tmpdir('foobar'); // -> '/tmp/static-bundler.foobar.20134-512'
//      tmpdir('foobar'); // -> '/tmp/static-bundler.foobar.20134-649'
//      tmpdir('blabla'); // -> '/tmp/static-bundler.blabla.20134-461'
function tmpdir(name) {
  return  '/tmp/static-bundler.' + name +
          '.' + process.pid +
          '-' + Math.floor(Math.random() * 1000);
}


//  build_theme_regexp(id, dir) -> RegExp
//  - id (String): Theme id (without `theme-` prefix)
//  - dir (String): Path to themed assets
//
//  Returns RegExp matching theme dirs/files. Produce three capture groups:
//
//  - [*1*]: `assets` or `views`
//  - [*2*]: `theme-id`, e.g. `theme-default-desktop`
//  - [*3*]: relative path, e.g. 'users/show.jade`
function build_theme_regexp(id, dir) {
  return new RegExp(
    '^'                   + // Bound to the string beginning
    dir,                  + // Path to themed views and assets
    '(views|assets)/'     + // (type)
    '(theme-' + id + ')/' + // (theme-id)
    '(.+)'                  // (relative path)
  );
}


// PUBLIC INTERFACE ////////////////////////////////////////////////////////////


/**
 *  StaticBundler.bundle(destination, callback) -> Void
 *  - nodeca (Object): Nodeca API tree
 *  - apps (Array): Loaded and initialized applications
 *  - destination (String): Destination directory.
 *  - callback (Function): Executed once assets bundled with `err` if any.
 *
 *  Build all assets and output result into `destination` directory.
 **/
module.exports.bundle = function(nodeca, apps, destination, callback) {
  var assets_tmp;
  
  assets_tmp = tmpdir('assets'); // Temporary directory for views and assets

  Async.waterfall([
    //
    //
    // Make sure all directories exists before we will start
    ////////////////////////////////////////////////////////////////////////////
    Async.apply(FsTools.mkdir, assets_tmp),
    Async.apply(FsTools.mkdir, destination),
    //
    //
    // 1.1. prepare generated api-tree
    ////////////////////////////////////////////////////////////////////////////
    function build_api_tree(next) {
      //  TODO: NOT IMPLEMENTED YET
      //  QUESTIONS:
      //    - How to "flush" `client` nodes (server node wrappers are generted
      //    dynamically here, while client nodes should be simpy merged - solution
      //    is to "enclose" each file into closure with providing "module.exports"
      //    as equal to given leaf, or force client modules to be written in
      //    separate way.
      next();
    },
    //
    //
    // 1.1. prepare compiled languages (of babelfish)
    ////////////////////////////////////////////////////////////////////////////
    function build_language_files(next) {
      // TODO: NOT IMPLEMENTED YET
      next();
    },
    //
    //
    // 1.2. make copy of all views and assets tmp directories by app
    ////////////////////////////////////////////////////////////////////////////
    function collect_views_and_assets(next) {
      var tasks = [], worker;

      // for each application
      Async.forEach(Underscore.values(nodeca.apps), function (app, next_app) {
        // for assets and views
        Async.forEach(['views', 'assets'], function (grp, next_grp) {
          var src, dst;

          src = Path.join(app.root, grp);
          dst = Path.join(assets_tmp, app.name, grp);

          // if application have views/assets directory
          Path.exists(src, function (exists) {
            if (exists) {
              FsTools.copy(src, dst, next_grp);
              return;
            }

            next_grp(null);
          });
        }, next_app);
      }, next);
    },
    //
    //
    // 1.3. make unique filenames for patches
    ////////////////////////////////////////////////////////////////////////////
    function make_unique_filenames(next) {
      var re = /[.](patch|before|after)$/i;

      // for each patch|before|after file...
      FsTools.walk(assets_tmp, re, function (file, stats, callback) {
        // mixin md5 hash of original path
        FsTools.move(file, Builder.unique_name(file), callback);
      }, next);
    },
    //
    //
    // 1.4. move base themes (not inherited or extended) into one place
    ////////////////////////////////////////////////////////////////////////////
    function move_base_themes(next) {
      var themes;

      // get theme ids
      themes = Underscore.filter(nodeca.themes, function (theme) {
        return !theme.extends && !theme.inherits;
      });

      // for each application
      Async.forEach(Underscore.values(nodeca.apps), function (app, next_app) {
        // for each theme
        Async.forEach(Underscore.values(themes), function (theme, next_theme) {
          // for assets and views
          Async.forEach(['views', 'assets'], function (grp, next_grp) {
            var src, dst;
            
            src = Path.join(assets_tmp, app.name, 'theme-' + theme.id, grp);
            dst = Path.join(destination, 'theme-' + theme.id, grp);

            // if source path exists
            Path.exists(src, function (exists) {
              if (exists) {
                // move theme assets/views into final destination
                FsTools.move(src, dst, next_grp);
                return;
              }

              next_grp(null);
            });
          }, next_theme);
        }, next_app);
      }, next);
    },
    //
    //
    // 2.1. process all "extended" themes
    ////////////////////////////////////////////////////////////////////////////
    function process_theme_extensions(next) {
      var themes;

      // get theme ids
      themes = Underscore.filter(nodeca.themes, function (theme) {
        return !!theme.extends;
      });

      // for each application
      Async.forEach(Underscore.values(nodeca.apps), function (app, next_app) {
        // for each theme
        Async.forEach(Underscore.values(themes), function (theme, next_theme) {
          // for assets and views
          Async.forEach(['views', 'assets'], function (grp, next_grp) {
            var src, dst;
            
            src = Path.join(assets_tmp, app.name, 'theme-' + theme.id, grp);
            dst = Path.join(destination, 'theme-' + themes[theme.id].extends, grp);

            // if source path exists
            Path.exists(src, function (exists) {
              if (exists) {
                // move theme assets/views into final destination
                FsTools.move(src, dst, next_grp);
                return;
              }

              next_grp(null);
            });
          }, next_theme);
        }, next_app);
      }, next);
    },
    //
    //
    // 2.2. process all "inherits" themes
    ////////////////////////////////////////////////////////////////////////////
    //
    // 2.2.A) Clone base theme
    function clone_base_theme(next) {
      var themes;

      // get theme ids
      themes = Underscore.filter(nodeca.themes, function (theme) {
        return !!theme.inherits;
      });

      // for each application
      Async.forEach(Underscore.values(nodeca.apps), function (app, next_app) {
        // for each theme
        Async.forEach(Underscore.values(themes), function (theme, next_theme) {
          // for assets and views
          Async.forEach(['views', 'assets'], function (grp, next_grp) {
            var src, dst;
            
            src = Path.join(destination, 'theme-' + themes[theme.id].inherits, grp);
            dst = Path.join(destination, 'theme-' + theme.id, grp);

            // if source path exists
            Path.exists(src, function (exists) {
              if (exists) {
                // clone theme assets/views into final destination
                FsTools.copy(src, dst, next_grp);
                return;
              }

              next_grp(null);
            });
          }, next_theme);
        }, next_app);
      }, next);
    },
    //
    //
    // 2.2. process all "inherits" themes (move overrides)
    ////////////////////////////////////////////////////////////////////////////
    function process_inherited_themes_move_overrides(next) {
      var themes;

      // get theme ids
      themes = Underscore.filter(nodeca.themes, function (theme) {
        return !!theme.inherits;
      });

      // for each application
      Async.forEach(Underscore.values(nodeca.apps), function (app, next_app) {
        // for each theme
        Async.forEach(Underscore.values(themes), function (theme, next_theme) {
          // for assets and views
          Async.forEach(['views', 'assets'], function (grp, next_grp) {
            var src, dst;
            
            src = Path.join(assets_tmp, app.name, 'theme-' + theme.id, grp);
            dst = Path.join(destination, 'theme-' + theme.id, grp);

            // if source path exists
            Path.exists(src, function (exists) {
              if (exists) {
                // move theme assets/views into final destination
                FsTools.move(src, dst, next_grp);
                return;
              }

              next_grp(null);
            });
          }, next_theme);
        }, next_app);
      }, next);
    },
    //
    //
    // 2.3. move non-theme assets (everything that left)
    // TODO: refactor static-bundler specs to match 1.5 -> 2.3 transition
    ////////////////////////////////////////////////////////////////////////////
    function move_generic_assets(next) {
      // TODO: NOT IMPLEMENTED YET
      next();
    },
    //
    //
    // 3.1. apply patches
    ////////////////////////////////////////////////////////////////////////////
    function apply_unified_patches(next) {
      // TODO: NOT IMPLEMENTED YET
      next();
    },
    //
    //
    // 3.2. apply merges (before|after, subdirs)
    ////////////////////////////////////////////////////////////////////////////
    function apply_simple_patches(next) {
      // TODO: NOT IMPLEMENTED YET
      next();
    },
    //
    //
    // 4. localize view
    ////////////////////////////////////////////////////////////////////////////
    function localize_views(next) {
      // TODO: NOT IMPLEMENTED YET
      next();
    },
    //
    //
    // 5.1. compile JADE
    ////////////////////////////////////////////////////////////////////////////
    function compile_jade_assets(next) {
      // TODO: NOT IMPLEMENTED YET
      next();
    },
    //
    //
    // 5.2. compile Stylus
    ////////////////////////////////////////////////////////////////////////////
    function compile_styl_assets(next) {
      // TODO: NOT IMPLEMENTED YET
      next();
    },
    //
    //
    // 5.3. minify assets (in production only)
    ////////////////////////////////////////////////////////////////////////////
    function minify_assets(next) {
      if ('production' !== nodeca.environment) {
        next(null);
        return;
      }

      // TODO: NOT IMPLEMENTED YET
      next();
    }
  ], callback);
};

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


// Wrapper over Async.parallel that provides unified interface that can
// be used with outer Async.watefall without breaking callflow (by  mixing
// unwished "results" argument
function run_tasks(tasks, next) {
  // Async.parallel fires callback(err, result), so we can't pass next
  // directly, in order to keep outer watefall callflow execution clean.
  Async.parallel(tasks, function (err) {
    // we care ONLY about error, and do not care about results
    next(err);
  });
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

      // copy <app_root>/{grp} to <assets_tmp>/{app_name}/{grp}
      worker = function (app_root, app_name, grp, next) {
        var src, dst;

        src = Path.join(app_root, grp);
        dst = Path.join(assets_tmp, app_name, grp);

        FsTools.copy(src, dst, next);
      };

      // fill in tasks with workers
      Underscore.each(apps, function (app, name) {
        tasks.push(Async.apply(worker, app.root, name, 'views'));
        tasks.push(Async.apply(worker, app.root, name, 'assets'));
      });

      // run tasks
      run_tasks(tasks, next);
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
      var tasks, worker;

      // move base theme worker
      worker = function (id, callback) {
        var re = build_theme_regexp(id, assets_tmp + '/[^/]+/');

        // FsTools.walk walks ONLY files, so no need to check stats
        FsTools.walk(assets_tmp, re, function (src, stats, next) {
          var match = re.exec(src), dst;

          dst = Path.join(
            destination,  // Destination path
            match[1],     // views|assets
            match[2],     // theme-id
            match[3]      // relative path of the file
          );

          FsTools.move(src, dst, next);
        }, callback);
      };

      // prepare tasks list (of workers)
      tasks = Underscore.chain(nodeca.__themes__)
        // leave only base themes
        .filter(function(theme, id) {
          return !theme.extends && !theme.inherits;
        })
        // make an array of worker tasks
        .map(function (theme, id) {
          return Async.apply(worker, id);
        });

      run_tasks(tasks, next);
    },
    //
    //
    // 2.1. process all "extended" themes
    ////////////////////////////////////////////////////////////////////////////
    function process_theme_extensions(next) {
      var tasks, worker;

      // extend theme worker
      worker = function (id, base_id, callback) {
        var re = build_theme_regexp(id, assets_tmp + '/[^/]+/');

        // FsTools.walk walks ONLY files, so no need to check stats
        FsTools.walk(assets_tmp, re, function (src, stats, next) {
          var match = re.exec(src), dst;

          dst = Path.join(
            destination,          // Destination path
            match[1],             // views|assets
            'theme-' + base_id,   // base theme-id
            match[3]              // relative path of the file
          );

          FsTools.move(src, dst, next);
        }, callback);
      };

      // prepare tasks list (of workers)
      tasks = Underscore.chain(nodeca.__themes__)
        // leave only "extends" themes
        .filter(function(theme, id) {
          return !!theme.extends;
        })
        // make an array of worker tasks
        .map(function (theme, id) {
          return Async.apply(worker, id, theme.extends);
        });

      run_tasks(tasks, next);
    },
    //
    //
    // 2.2. process all "inherits" themes (clone base themes)
    ////////////////////////////////////////////////////////////////////////////
    function process_inherited_themes_clone_base(next) {
      var tasks, worker;

      // clone base theme worker
      worker = function (base_id, id, callback) {
        var re = build_theme_regexp(base_id, destination);

        // FsTools.walk walks ONLY files, so no need to check stats
        FsTools.walk(assets_tmp, re, function (src, stats, next) {
          var match = re.exec(src), dst;

          dst = Path.join(
            destination,          // Destination path
            match[1],             // views|assets
            'theme-' + id,        // clone theme-id
            match[3]              // relative path of the file
          );

          FsTools.copy(src, dst, next);
        }, callback);
      };

      // prepare tasks list (of workers)
      tasks = Underscore.chain(nodeca.__themes__)
        // leave only "inherits" themes
        .filter(function(theme, id) {
          return !!theme.inherits;
        })
        // make an array of worker tasks
        .map(function (theme, id) {
          return Async.apply(worker, theme.inherits, id);
        });

      run_tasks(tasks, next);
    },
    //
    //
    // 2.2. process all "inherits" themes (move overrides)
    ////////////////////////////////////////////////////////////////////////////
    function process_inherited_themes_move_overrides(next) {
      var tasks, worker;

      // inherits theme worker
      worker = function (id, callback) {
        var re = build_theme_regexp(id, assets_tmp + '/[^/]+/');

        // FsTools.walk walks ONLY files, so no need to check stats
        FsTools.walk(assets_tmp, re, function (src, stats, next) {
          var match = re.exec(src), dst;

          dst = Path.join(
            destination,     // Destination path
            match[1],        // views|assets
            'theme-' + id,   // base theme-id
            match[3]         // relative path of the file
          );

          FsTools.move(src, dst, next);
        }, callback);
      };

      // prepare tasks list (of workers)
      tasks = Underscore.chain(nodeca.__themes__)
        // leave only "inherits" themes
        .filter(function(theme, id) {
          return !!theme.inherits;
        })
        // make an array of worker tasks
        .map(function (theme, id) {
          return Async.apply(worker, id);
        });

      run_tasks(tasks, next);
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

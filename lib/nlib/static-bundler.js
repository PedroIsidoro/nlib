/**
 *  StaticBundler
 *
 *  Collect and build views, assets, api trees etc from all applications
 **/


'use strict';


// stdlib
var Fs = require('fs');
var Path = require('path');
var Crypto = require('crypto');
var exec = require('child_process').exec;


// 3rd-party
var Async = require('async');
var Types = require('types');
var Underscore = require('underscore');
var FsTools = require('fs-tools');
var Stylus = require('stylus');


// TODO: move should respect existing detinations


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

//  process_assets(options, callback) -> Void
//  - options (Object): task definition
//  - callback (Function): fired, once tasks finished
//
//  ##### Options
//
//  - *handler*: Worker function, e.g. `move` | `FsTools.copy`
//  - *src_dir*: Path to source views/assets
//  - *dst_dir*: Path to destination views/assets
//  - *src_id*: (Optional) Source theme id
//  - *dst_id*: (Optional) Destination theme id
function process_assets(options, callback) {
  // for assets and views
  Async.forEach(['views', 'assets'], function (grp, next) {
    var src, dst;

    src = Path.join(options.src_dir, grp);
    dst = Path.join(options.dst_dir, grp);

    if (options.src_id || options.dst_id) {
      src = Path.join(src, 'theme-' + options.src_id);
      dst = Path.join(dst, 'theme-' + options.dst_id);
    }

    // if source views/assets directory
    Path.exists(src, function (exists) {
      if (exists) {
        // process them with handler
        options.handler(src, dst, next);
        return;
      }

      next(null);
    });
  }, callback);
}


// concat_files(dst_file[, source_file[, sources_arr[, ...]]], callback)
// conctenate all sources into dst_file
function concat_files(dst_file) {
  var tmp, tmp_file, src_files, src_file_iterator, callback;

  src_files = Underscore.toArray(arguments).slice(1);
  callback  = src_files.pop();
  src_files = Underscore.flatten(src_files);
  tmp_file  = dst_file + '.tmp';
  tmp       = Fs.createWriteStream(tmp_file);

  // function that will be called on each src_file
  src_file_iterator = function (file, next) {
    Path.exists(file, function (exists) {
      var src;

      if (!exists) {
        callback(null);
        return;
      }

      src = Fs.createReadStream(file).pipe(tmp);

      // assign error listeners
      src.on('error', function (err) {
        src.destroy();
        callback(err);
      });

      // assign end listeners
      src.on('end', function () {
        src.destroy();
        callback(null);
      });
    });
  };

  // assign error listener
  tmp.on('error', function (err) {
    tmp.destroy();
    callback(err);
  });

  // handle close (success) event
  tmp.on('close', function () {
    Fs.rename(tmp_file, dst_file, callback);
  });

  // start concatenating
  Async.waterfall([
    Async.apply(Async.forEachSeries, src_files, src_file_iterator),
    Async.apply(Async.forEach, src_files, Fs.unlink)
  ], function (err) {
    if (err) {
      tmp.emit('error', err);
      return;
    }

    // schedule stream close as soon as all data will be flushed
    tmp.destroySoon();
  });
}


// move files/dirs
function move(src, dst, callback) {
  Async.waterfall([
    Async.apply(FsTools.copy, src, dst),
    Async.apply(FsTools.remove, src)
  ], callback);
}


// PUBLIC INTERFACE ////////////////////////////////////////////////////////////


/**
 *  StaticBundler.bundle(nodeca, apps, destination, callback) -> Void
 *  - nodeca (Object): Nodeca API tree
 *  - apps (Array): Loaded and initialized applications
 *  - destination (String): Destination directory.
 *  - callback (Function): Executed once assets bundled with `err` if any.
 *
 *  Build all assets and output result into `destination` directory.
 **/
module.exports.bundle = function(nodeca, apps, destination, callback) {
  var assets_tmp, source_tmp;


  // define some internal variable...
 

  assets_tmp = tmpdir('assets');  // Temp dir for building theme views and assets
  source_tmp = tmpdir('source');  // Temporary directory for all source assets, langs, etc.


  // start bundling...


  Async.waterfall([
    //
    //
    // Make sure all directories exists before we will start
    ////////////////////////////////////////////////////////////////////////////
    Async.apply(FsTools.mkdir, assets_tmp),
    Async.apply(FsTools.mkdir, source_tmp),
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
      // for each application
      Async.forEach(Underscore.values(nodeca.apps), function (app, next_app) {
        process_assets({
          handler : FsTools.copy,
          src_dir : app.root,
          dst_dir : Path.join(assets_tmp, app.name)
        }, next_app);
      }, next);
    },
    //
    //
    // 1.3. make unique filenames for patches
    //
    //      *.{patch|before|after} -> *._md5_.{patch|before|after}
    //      *.{prio}.{patch|before|after} -> *.{prio}._md5_.{patch|before|after}
    //
    ////////////////////////////////////////////////////////////////////////////
    function make_unique_filenames(next) {
      var re = /^(.+?)([.]\d+)?([.](?:patch|before|after))$/i;

      // for each patch|before|after file...
      FsTools.walk(assets_tmp, re, function (file, stats, callback) {
        var uniq, match, name, prio, ext;

        uniq  = Crypto.createHash('md5').update(file).digest('hex').slice(0, 8);
        match = re.exec(file);
        name  = match[1];
        prio  = match[2] || '.10';
        ext   = match[3];

        // mixin md5 hash of original path
        move(file, name + prio + '._' + uniq + '_' + ext, callback);
      }, next);
    },
    //
    //
    // 1.4. move base themes (not inherited or extended) into results dir
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
          process_assets({
            handler : move,
            src_dir : Path.join(assets_tmp, app.name),
            dst_dir : source_tmp,
            src_id  : theme.id,
            dst_id  : theme.id
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
          process_assets({
            handler : move,
            src_dir : Path.join(assets_tmp, app.name),
            dst_dir : source_tmp,
            src_id  : theme.id,
            dst_id  : themes[theme.id].extends
          }, next_theme);
        }, next_app);
      }, next);
    },
    //
    //
    // 2.2. process all "inherits" themes
    ////////////////////////////////////////////////////////////////////////////
    //
    // 2.2.A) Clone base theme with new theme id
    function clone_base_theme(next) {
      var themes;

      // get theme ids
      themes = Underscore.filter(nodeca.themes, function (theme) {
        return !!theme.inherits;
      });

      // for each theme
      Async.forEach(Underscore.values(themes), function (theme, next_theme) {
        process_assets({
          handler : FsTools.copy,
          src_dir : source_tmp,
          dst_dir : source_tmp,
          src_id  : themes[theme.id].inherits,
          dst_id  : theme.id
        }, next_theme);
      }, next);
    },
    //
    // 2.2.B) Move original files of inherited theme to the result dir
    function override_changed_data(next) {
      var themes;

      // get theme ids
      themes = Underscore.filter(nodeca.themes, function (theme) {
        return !!theme.inherits;
      });

      // for each application
      Async.forEach(Underscore.values(nodeca.apps), function (app, next_app) {
        // for each theme
        Async.forEach(Underscore.values(themes), function (theme, next_theme) {
          process_assets({
            handler : move,
            src_dir : Path.join(assets_tmp, app.name),
            dst_dir : source_tmp,
            src_id  : theme.id,
            dst_id  : theme.id
          }, next_theme);
        }, next_app);
      }, next);
    },
    //
    //
    // 2.3. move non-theme assets (everything that left)
    ////////////////////////////////////////////////////////////////////////////
    function move_generic_assets(next) {
      // for each application
      Async.forEach(Underscore.values(nodeca.apps), function (app, next_app) {
        process_assets({
          handler : move,
          src_dir : Path.join(assets_tmp, app.name),
          dst_dir : source_tmp,
        }, next_app);
      }, next);
    },
    //
    // assets_tmp can be safely removed now
    Async.apply(FsTools.remove, assets_tmp),
    //
    //
    // 3.1.A) collect patches
    ////////////////////////////////////////////////////////////////////////////
    function collect_patches(next) {
      var patches, re;

      re = /^(.+?)[.](\d+)[.]_[a-z0-9]{8}_[.](patch|before|after)$/i;
      patches = {};

      FsTools.walk(source_tmp, re, function (filename, stats, next_file) {
        var match, realpath, priority, action;
        
        match = filename.match(re);
        realpath = match[1];
        priority = match[2];
        action   = match[3];

        // for each found path, create new stack if not found
        if (!patches[realpath]) {
          patches[realpath] = {
            patch   : new Types.SortedSet(),
            before  : new Types.SortedSet(),
            after   : new Types.SortedSet()
          };
        }

        patches[realpath][action.toLowerCase()].add(priority, filename);
        next_file();
      }, function (err) {
        next(err, patches);            
      });
    },
    //
    //
    // 3.1.B) apply patches
    ////////////////////////////////////////////////////////////////////////////
    function apply_patches(patches, next) {
      // parallel forEach
      Async.forEach(Underscore.keys(patches), function (orig_file, next_file) {
        Path.exists(orig_file, function (exists) {
          var tasks;

          if (!exists) {
            nodeca.logger.warn("[STATIC BUNDLER] Attempt to patch non-existence file", {
              logical_path: orig_file.replace(source_tmp, '')
            });
            next_file(null);
            return;
          }

          tasks = [];

          // apply all unified patches first
          tasks.push(function (next_task) {
            // waterfall forEach
            Async.forEachSeries(patches[orig_file].patch.sorted, function (patch_file, next_patch) {
              var exec_cmd, exec_opts;

              exec_cmd  = 'patch ' + orig_file + ' ' + patch_file;
              exec_opts = {cwd: Path.dirname(orig_file)};

              // apply and then remove patch file
              Async.waterfall([
                Async.apply(exec, exec_cmd, exec_opts),
                Async.apply(Fs.unlink, patch_file),
              ], next_patch);
            }, next_task);
          });

          // apply before|after patches
          tasks.push(function (next_task) {
            var before, after;

            before  = patches[orig_file].before.sorted;
            after   = patches[orig_file].after.sorted;

            concat_files(orig_file, [before, orig_file, after], next_task);
          });

          // run patching
          Async.waterfall(tasks, next_file);
        });
      }, next);
    },
    //
    //
    // 3.2.A) collect bundle (subdir) files
    ////////////////////////////////////////////////////////////////////////////
    function collect_bundle_files(next) {
      var files, re;

      re = /^(.+?)\/_([^\/]+)\//i;
      files = {};

      FsTools.walk(source_tmp, re, function (filename, stats, next_file) {
        var match, orig_file;

        match = re.exec(filename);
        orig_file = Path.join(match[1], match[2]);

        if (!files[orig_file]) {
          files[orig_file] = [];
        }

        files[orig_file].push(filename);
        next_file(null);
      }, function (err) {
        next(err, files);
      });
    },
    //
    //
    // 3.2.B) bundle files
    ////////////////////////////////////////////////////////////////////////////
    function bundle_files(files, next) {
      Async.forEachSeries(Underscore.keys(files), function (orig_file, next_file) {
        concat_files(files[orig_file], orig_file, next_file);
      }, next);
    },
    //
    //
    // Collect all filenames - in order to reduce FS walking on next stages
    ////////////////////////////////////////////////////////////////////////////
    function collect_all_files(next) {
      var files = [];
      
      FsTools.walk(source_tmp, function (file, lstat, next_file) {
        files.push(file);
        next_file();
      }, function (err) {
        next(err, files);
      });
    },
    //
    //
    // 4. localize view
    ////////////////////////////////////////////////////////////////////////////
    function localize_views(files, next) {
      // TODO: NOT IMPLEMENTED YET
      next(null, files);
    },
    //
    //
    // 5.1. compile JADE
    ////////////////////////////////////////////////////////////////////////////
    function compile_jade_assets(files, next) {
      // TODO: NOT IMPLEMENTED YET
      next(null, files);
    },
    //
    //
    // 5.2. compile Stylus
    ////////////////////////////////////////////////////////////////////////////
    function compile_styl_assets(files, next) {
      var re, styl_files;
      
      re = /\.styl$/i;
      styl_files = Underscore.filter(files, re.test);

      Async.forEach(styl_files, function (f, next_file) {
        var out = f.replace(re, '.css');

        if ('_' === Path.basename(f)[0]) {
        // skip partials
          next_file(null);
          return;
        }

        Async.waterfall([
          Async.apply(Fs.readFile, f, 'utf-8'),
          function (str, next) { Stylus.render(str, {filename: f}, next); },
          function (css, next) { Fs.writeFile(out, css, next); },
          function (next) { files.push(out); }
        ], next_file);
      }, function (err) {
        if (err) {
          next(err, files);
          return;
        }

        // cleanup styl files
        Async.forEach(styl_files, function (f, next_file) {
          delete files[files.indexOf(f)];
          Fs.unlink(f, next_file);
        }, function (err) {
          next(err, files);
        });
      });
    },
    //
    //
    // 5.3. minify assets (in production only)
    ////////////////////////////////////////////////////////////////////////////
    function minify_assets(files, next) {
      if ('production' !== nodeca.environment) {
        next(null);
        return;
      }

      // TODO: NOT IMPLEMENTED YET
      next();
    }
  ], callback);
}; // end of `module.exports.bundle`

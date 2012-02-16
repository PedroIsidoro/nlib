/** internal
 *  Application.StaticBundler
 *
 *  Collect and build views, assets, api trees etc from all applications
 **/


// TODO: Move bundler under application


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
var Jade = require('jade');
var Stylus = require('stylus');
var JASON = require('JASON');
var uglify = require('uglify-js');


// TODO: move should respect existing destinations


// PRIVATE /////////////////////////////////////////////////////////////////////


//  tmpname(name) -> String
//  - name (String): Base name of the directory
//
//  Returns unique name (for the temporary directory)
//
//  ##### Example:
//
//      tmpname('foobar'); // -> '/tmp/static-bundler.foobar.20134-512'
//      tmpname('foobar'); // -> '/tmp/static-bundler.foobar.20134-649'
//      tmpname('blabla'); // -> '/tmp/static-bundler.blabla.20134-461'
function tmpname(name) {
  return  '/tmp/static-bundler.' + name +
          '.' + process.pid +
          '-' + Math.floor(Math.random() * 1000);
}


//  dump_into_file(obj, file, callback) -> Void
//
//  Dumps given `obj` into file containing JSON object.
//  Dumped object containing only one key `dump` with
//  serialized value of `obj` suitable fo eval.
//
//  To unpack such data one my use following snippet:
//
//      var str = fs.readFileSync(file, 'utf8');
//      var obj = (new Function('return ' + JSON.parse(str).dump))();
function dump_into_file(obj, file, callback) {
  var data = JSON.stringify({
    "dump": JASON.stringify(obj)
  });

  Async.series([
    Async.apply(FsTools.mkdir, Path.dirname(file)),
    Async.apply(Fs.writeFile, file, data)
  ], function (err/*, results */) {
    callback(err);
  });
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
        global.nodeca.logger.debug('process_assets ' + src + ' -> ' + dst);
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
  Async.series([
    Async.apply(FsTools.copy, src, dst),
    Async.apply(FsTools.remove, src)
  ], callback);
}


// PUBLIC INTERFACE ////////////////////////////////////////////////////////////


/**
 *  Application.StaticBundler.bundle(nodeca, callback(err, bundle_dir)) -> Void
 *  - nodeca (Object): Nodeca API tree
 *  - init_env (Object): loaded apps, themes, locales
 *  - callback (Function): Executed once assets bundled with `err, bundle_dir`.
 *
 *  Build all assets and output result into directory.
 **/
module.exports.bundle = function(nodeca, init_env, callback) {
  var assets_tmp, bundle_tmp;


  // define some internal variable...


  assets_tmp = tmpname('assets');  // Temp dir for building theme views and assets
  bundle_tmp = tmpname('bundle');  // Temporary directory for assets, langs, etc.


  nodeca.logger.debug('[STATIC BUNDLER] assets_tmp: ' + assets_tmp);
  nodeca.logger.debug('[STATIC BUNDLER] bundle_tmp: ' + bundle_tmp);


  // start bundling...


  Async.waterfall([
    //
    //
    // Make sure all directories exists before we will start
    ////////////////////////////////////////////////////////////////////////////
    Async.apply(FsTools.mkdir, assets_tmp),
    Async.apply(FsTools.mkdir, bundle_tmp),
    //
    //
    // 1.1. prepare generated api-tree
    ////////////////////////////////////////////////////////////////////////////
    function build_api_tree(next) {
      nodeca.logger.debug('[STATIC BUNDLER] *** Build API tree');
      //  TODO: build_api_tree not implemented
      next();
    },
    //
    //
    // 1.1. prepare compiled languages (of babelfish)
    ////////////////////////////////////////////////////////////////////////////
    function build_language_files(next) {
      nodeca.logger.debug('[STATIC BUNDLER] *** Build language files');

      Async.forEach(nodeca.config.languages.enabled, function (lang, next_lang) {
        var data = nodeca.runtime.i18n.getCompiledData(lang);
        Async.forEach(Underscore.keys(data), function (ns, next_ns) {
          var file = Path.join(bundle_tmp, 'system', ns, 'i18n', lang + '.json');
          dump_into_file(data[ns], file, next_ns);
        }, next_lang);
      }, next);
    },
    //
    //
    // 1.2. make copy of all views and assets tmp directories by app
    ////////////////////////////////////////////////////////////////////////////
    function collect_views_and_assets(next) {
      nodeca.logger.debug('[STATIC BUNDLER] *** Collect views and assets');
      // for each application
      Async.forEach(init_env.apps, function (app, next_app) {
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

      nodeca.logger.debug('[STATIC BUNDLER] *** Make unique filenames');

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

      nodeca.logger.debug('[STATIC BUNDLER] *** Move base themes');

      // get theme ids
      themes = Underscore.filter(init_env.themes, function (theme) {
        return !theme.extends && !theme.inherits;
      });

      // for each application
      Async.forEach(init_env.apps, function (app, next_app) {
        // for each theme
        Async.forEach(Underscore.keys(themes), function (theme_id, next_theme) {
          process_assets({
            handler : move,
            src_dir : Path.join(assets_tmp, app.name),
            dst_dir : bundle_tmp,
            src_id  : theme_id,
            dst_id  : theme_id
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

      nodeca.logger.debug('[STATIC BUNDLER] *** Process extended themes');

      // get theme ids
      themes = Underscore.filter(init_env.themes, function (theme) {
        return !!theme.extends;
      });

      // for each application
      Async.forEach(init_env.apps, function (app, next_app) {
        // for each theme
        Async.forEach(Underscore.keys(themes), function (theme_id, next_theme) {
          process_assets({
            handler : move,
            src_dir : Path.join(assets_tmp, app.name),
            dst_dir : bundle_tmp,
            src_id  : theme_id,
            dst_id  : themes[theme_id].extends
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

      nodeca.logger.debug('[STATIC BUNDLER] *** Clone base themes');

      // get theme ids
      themes = Underscore.filter(init_env.themes, function (theme) {
        return !!theme.inherits;
      });

      // for each theme
      Async.forEach(Underscore.keys(themes), function (theme_id, next_theme) {
        process_assets({
          handler : FsTools.copy,
          src_dir : bundle_tmp,
          dst_dir : bundle_tmp,
          src_id  : themes[theme_id].inherits,
          dst_id  : theme_id
        }, next_theme);
      }, next);
    },
    //
    // 2.2.B) Move original files of inherited theme to the result dir
    function override_changed_data(next) {
      var themes;

      nodeca.logger.debug('[STATIC BUNDLER] *** Override files of inherited themes');

      // get theme ids
      themes = Underscore.filter(init_env.themes, function (theme) {
        return !!theme.inherits;
      });

      // for each application
      Async.forEach(init_env.apps, function (app, next_app) {
        // for each theme
        Async.forEach(Underscore.keys(themes), function (theme_id, next_theme) {
          process_assets({
            handler : move,
            src_dir : Path.join(assets_tmp, app.name),
            dst_dir : bundle_tmp,
            src_id  : theme_id,
            dst_id  : theme_id
          }, next_theme);
        }, next_app);
      }, next);
    },
    //
    //
    // 2.3. move non-theme assets (everything that left)
    ////////////////////////////////////////////////////////////////////////////
    function move_generic_assets(next) {
      nodeca.logger.debug('[STATIC BUNDLER] *** Move generic assets');
      // for each application
      Async.forEach(init_env.apps, function (app, next_app) {
        process_assets({
          handler : move,
          src_dir : Path.join(assets_tmp, app.name),
          dst_dir : bundle_tmp,
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

      nodeca.logger.debug('[STATIC BUNDLER] *** Collect patches');
      re = /^(.+?)[.](\d+)[.]_[a-z0-9]{8}_[.](patch|before|after)$/i;
      patches = {};

      FsTools.walk(bundle_tmp, re, function (filename, stats, next_file) {
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
      nodeca.logger.debug('[STATIC BUNDLER] *** Apply patches');
      // parallel forEach
      Async.forEach(Underscore.keys(patches), function (orig_file, next_file) {
        Path.exists(orig_file, function (exists) {
          var tasks;

          if (!exists) {
            nodeca.logger.warn("[STATIC BUNDLER] Attempt to patch non-existence file", {
              logical_path: orig_file.replace(bundle_tmp, '')
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

      nodeca.logger.debug('[STATIC BUNDLER] *** Collect files for bundling');

      re = /^(.+?)\/_([^\/]+)\//i;
      files = {};

      FsTools.walk(bundle_tmp, re, function (filename, stats, next_file) {
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
      nodeca.logger.debug('[STATIC BUNDLER] *** Bundle files');

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

      nodeca.logger.debug('[STATIC BUNDLER] *** Collect all files');

      FsTools.walk(bundle_tmp, function (file, lstat, next_file) {
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
      var views_files, filter_re;

      nodeca.logger.debug('[STATIC BUNDLER] *** Localize views');

      filter_re = new RegExp('^' + Path.join(bundle_tmp, 'views') + '.*[.]jade$');
      views_files = Underscore.filter(files, function (f) {
        return filter_re.test(f);
      });

      Async.forEachSeries(views_files, function (file, next_file) {
        var base = file.replace(/[.]jade$/, '');

        Async.forEachSeries(nodeca.config.languages.enabled, function (lang, next_lang) {
          var lang_file = base + '.' + lang + '.jade';
          // TODO: localize_views is stubbed and needs real implementation
          files.push(lang_file);
          FsTools.copy(file, lang_file, next_lang);
        }, function (err) {
          if (err) {
            next_file(err);
            return;
          }

          // remove original file once localized versions were created
          delete files[files.indexOf(file)];
          Fs.unlink(file, next_file);
        });
      }, function (err) {
        next(err, files);
      });
    },
    //
    //
    // 5.1. compile JADE
    ////////////////////////////////////////////////////////////////////////////
    function compile_jade_assets(files, next) {
      var views_files, filter_re;

      nodeca.logger.debug('[STATIC BUNDLER] *** Compile JADE files');

      filter_re = new RegExp('^' + Path.join(bundle_tmp, 'views') + '.*[.]jade$');
      views_files = Underscore.filter(files, function (f) {
        return filter_re.test(f);
      });

      Async.forEachSeries(views_files, function (file, next_file) {
        Async.waterfall([
          Async.apply(Fs.readFile, file, 'utf8'),
          function (data, callback) {
            var out, fun;

            out = file.replace(/[.]jade$/, '.json');
            fun = Jade.compile(data, {
              compileDebug: ('development' === nodeca.runtime.env),
              client: true
            });

            files.push(out);
            delete files[files.indexOf(file)];

            dump_into_file(fun, out, callback);
          },
          Async.apply(Fs.unlink, file)
        ], next_file);
      }, function (err) {
        next(err, files);
      });
    },
    //
    //
    // 5.2. compile Stylus
    ////////////////////////////////////////////////////////////////////////////
    function compile_styl_assets(files, next) {
      var re, styl_files;

      nodeca.logger.debug('[STATIC BUNDLER] *** Compile STYLUS files');

      re = /[.]styl$/i;
      styl_files = Underscore.filter(files, function (f) {
        return re.test(f);
      });

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
      var re, js_files;

      nodeca.logger.debug('[STATIC BUNDLER] *** Uglify files');

      if ('production' !== nodeca.environment) {
        next(null);
        return;
      }

      re = /[.]js$/i;
      js_files = Underscore.filter(files, function (f) {
        return re.test(f);
      });

      Async.forEach(js_files, function (f, next_file) {
        Async.waterfall([
          Async.apply(Fs.readFile, f, 'utf-8'),
          function (str, next) {
            var uglified;

            try {
              uglified = uglify(str);
              next(null, uglified);
            } catch (err) {
              next(err);
            }
          },
          function (js, next) { Fs.writeFile(f, js, next); }
        ], next_file);
      }, next);
    }
  ], function (err) {
    callback(err, bundle_tmp);
  });
}; // end of `module.exports.bundle`

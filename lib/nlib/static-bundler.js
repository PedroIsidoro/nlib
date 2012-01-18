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


//  merge_buffers(buf1, buf2[, bufN]) -> Buffer
//
//  Returns new `Buffer` with contents of all given bufers merged together.
//
//  **NOTICE** that _raw_ contents is merged:
//
//      var a = new Buffer(4), b = new Buffer(3);
//      a.write('abc');
//      b.write('def');
//
//      Utilities.mergeBuffers(a, b).toString();
//      // -> 'abc\u0000def'
function merge_buffers() {
  var result, idx = 0, len = 0, args;

  // filter out all non-buffers and calculate length of result buffer
  args = Underscore.filter(Underscore.toArray(arguments), function (buff) {
    if (Buffer.isBuffer(buff)) {
      len += buff.length;
      return true;
    }

    return false;
  });

  // initialize result buffer
  result = new Buffer(len);

  // copy buffers into resulting one
  Underscore.each(args, function (buff) {
    buff.copy(result, idx);
    idx += buff.length;
  });

  return result;
}


// RegExp describing rules of physycal files storage
//   /public/js/app.js
//   /public/js/_app.js/tipsy.js
//   /public/js/app.js.patch
//   /public/js/app.js.05.before
//   /public/js/app.js.10.patch
//   /public/js/app.js.15.after
//   /public/filename.with.lots.of.dots.css
var PATH_RE = new RegExp(
  '^'                         + // start
  '(.*?/)??'                  + // [1] path
  '('                         + // [2] >>> alternative
  '_([^/]+)/.*'               + // [3] filename (matching directory)
  '|'                         + // [2] --- or
  '([^/]+?)'                  + // [4] filename
  '('                         + // [5] >>> optional "patch" suffix
  '([.][0-9]+)?'              + // [6] .priority
  '([.]_[a-z0-9]{8}_)?'       + // [7] ._hash_
  '[.](before|patch|after)'   + // [8] before, patch or after
  ')?'                        + // [5] <<<
  ')'                         + // [2] <<<
  '$'                           // stop
);


// parse real path, extract priority, action and path visible to the world
function parse_path(realpath) {
  var m = realpath.toString().match(PATH_RE);
  return {
    path: Path.join(m[1], m[3] || m[4]),
    actn: m[3] ? 'after' : (m[8] || 'original'),
    prio: m[6] ? +(m[6].slice(1)) : null
  };
}


// move files/dirs
function move(src, dst, callback) {
  src = Path.normalize(src);
  dst = Path.normalize(dst);

  // sad but true - people make mistakes...
  if (src === dst) {
    callback(null);
    return;
  }

  // TODO: This will work within one partition ONLY
  Fs.lstat(src, function (err, stats) {
    if (err) {
      callback(err);
      return;
    }

    FsTools.mkdir(Path.dirname(dst), function (err) {
      if (err) {
        callback(err);
        return;
      }

      Fs.rename(src, dst, callback);
    });
  });
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
    ////////////////////////////////////////////////////////////////////////////
    function make_unique_filenames(next) {
      var re = /[.](patch|before|after)$/i;

      // for each patch|before|after file...
      FsTools.walk(assets_tmp, re, function (file, stats, callback) {
        var ext, name, uniq;

        ext   = Path.extname(file);
        name  = Path.basename(file, ext);
        uniq  = Crypto.createHash('md5').update(file).digest('hex').slice(0, 8);

        // mixin md5 hash of original path
        move(file, name + '._' + uniq + '_' + ext, callback);
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
    // 3.0. collect sources, patches, etc.
    ////////////////////////////////////////////////////////////////////////////
    function collect_sources(next) {
      var sources;
      
      sources = {}; // Source data (original file, patches etc.) for each file

      FsTools.walk(source_tmp, function (filename, stats, next_file) {
        var parsed = parse_path(filename.replace(source_tmp, ''));

        // for each found path, create stacks of patches and original buffer
        if (!sources[parsed.path]) {
          sources[parsed.path] = {
            original: null,
            patch   : new Types.SortedSet(),
            before  : new Types.SortedSet(),
            after   : new Types.SortedSet()
          };
        }

        if ('original' === parsed.actn) {
          // found override
          // TODO: WARN on overrides
          sources[parsed.path].original = filename;
        } else {
          sources[parsed.path][parsed.actn].add(parsed.prio || 10, filename);
        }

        next_file();
      }, function (err) {
        next(err, sources);            
      });
    },
    //
    //
    // 3.1. apply patches
    ////////////////////////////////////////////////////////////////////////////
    function apply_unified_patches(sources, next) {
      Async.forEach(Underscore.keys(sources), function (filename, next_file) {
        var data, dst_file, orig_file, patch_file, patches, exec_cmnd, exec_opts;

        data = sources[filename];
        patches = data.patches.sorted;

        // no patches. do nothing.
        if (0 === patches.length) {
          next_file(null);
          return;
        }

        dst_file    = Path.join(source_tmp, filename);
        orig_file   = dst_file + '.orig';
        patch_file  = dst_file + '.patch';
        exec_cmnd   = 'patch ' + orig_file + ' ' + patch_file;
        exec_opts   = {cwd: Path.dirname(orig_file)};

        Async.forEachSeries(patches, function (patch, next) {
          Async.waterfall([
            Async.apply(Fs.writeFile, orig_file, data.buffer),
            Async.apply(Fs.writeFile, patch_file, patch),
            Async.apply(exec, exec_cmnd, exec_opts),
            Async.apply(Fs.readFile, orig_file),
            function (buff, next) {
              data.buffer = buff;
              next();
            }
          ], next);
        }, function (err) {
          // falure. fuck up
          if (err) {
            next_file(err);
            return;
          }

          // success. cleanup
          Async.forEach([orig_file, patch_file], Fs.unlink, next_file);
        });
      }, function (err) {
        next(err, sources);
      });
    },
    //
    //
    // 3.2. apply merges (before|after, subdirs)
    ////////////////////////////////////////////////////////////////////////////
    function apply_simple_patches(sources, next) {
      var files;

      files = []; // Array of result filenames (full paths)

      Async.forEach(Underscore.keys(sources), function (filename, next_file) {
        var data = sources[filename], dst_file, before, after, buffer;

        dst_file  = Path.join(source_tmp, filename);
        before    = merge_buffers(data.before.sorted);
        after     = merge_buffers(data.after.sorted);
        buffer    = merge_buffers(before, data.buffer, after);

        files.push(dst_file);
        Fs.writeFile(dst_file, buffer, next_file);
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

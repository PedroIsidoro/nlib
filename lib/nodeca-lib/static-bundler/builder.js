/** internal
 *  class Builder
 **/

'use strict';


// stdlib
var Path = require('path');
var Fs = require('fs');
var Crypto = require('crypto');
var exec = require('child_process').exec;

// 3rd party
var Async = require('async');
var Types = require('types');
var FsTools = require('fs-tools');
var Underscore = require('underscore');


// TODO: TOTAL REFACTORING


// PRIVATE /////////////////////////////////////////////////////////////////////


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
  var result, idx = 0, len = 0, args = Underscore.toArray(arguments);

  // filter out ll non-buffers and calculate length of result buffer
  args = Underscore.filter(args, function (buff) {
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
  '[.](before|patch|after)'   + // [7] before, patch or after
  ')?'                        + // [5] <<<
  ')'                         + // [2] <<<
  '$'                           // stop
);


// RegExp describing filename with UNIQID
//   /public/js/app.js
//   /public/js/app._abcdef12_.js
//   /public/js/_app.js/tipsy.js
//   /public/js/_app.js/tipsy._abcdef12_.js
//   /public/js/app.js.10.patch
//   /public/js/app._abcdef12_.js.10.patch
//   /public/filename.with.lots.of.dots.css
//   /public/filename.with.lots.of.dots._abcdef12_.css
var UNIQ_RE = new RegExp(
  '^'                         + // start
  '(.*?)'                     + // [1] filename
  '([.]_[a-f0-9]{8}_)?'       + // [2] UNIQID
  '([.][^.]+)?'               + // [3] extension
  '('                         + // [4] >>> optional "patch" suffix
  '([.][0-9]+)?'              + // [5] .priority
  '[.](before|patch|after)'   + // [6] before, patch or after
  ')?'                        + // [4] <<<
  '$'                           // stop
);


// applies a serie of patches to the buffer
function apply_patches(dst, buff, patches, callback) {
  var orig_file, patch_file, exec_cmnd, exec_opts;
  
  orig_file   = dst + '.orig';
  patch_file  = dst + '.patch';
  exec_cmnd   = 'patch ' + orig_file + ' ' + patch_file;
  exec_opts   = {cwd: Path.dirname(orig_file)};

  // no patches. do nothing.
  if (0 === patches.length) {
    callback(null, buff);
    return;
  }

  FsTools.mkdir(exec_opts.cwd, function (err) {
    if (err) {
      callback(err);
      return;
    }

    Async.forEachSeries(patches, function (patch, next) {
      Async.waterfall([
        Async.apply(Fs.writeFile, orig_file, buff),
        Async.apply(Fs.writeFile, patch_file, patch),
        Async.apply(exec, exec_cmnd, exec_opts),
        Async.apply(Fs.readFile, orig_file),
        function (data, next) {
          buff = data;
          next();
        }
      ], next);
    }, function (err) {
      if (err) {
        callback(err);
        return;
      }

      Async.forEach([orig_file, patch_file], Fs.unlink, function (err) {
        callback(err, buff);
      });
    });
  });
}


// class constructor
var Builder = module.exports = function Builder(src) {
  var sources;

  // read and prepare all sources
  FsTools.walk(src, function (filename, stats, next) {
    var parsed = Builder.parsePath(Builder.norm_name(filename.replace(src, '')));

    fs.readFile(filename, function (err, buff) {
      if (err) {
        next(err);
        return;
      }

      // for each found path, create stacks of patches and original buffer
      if (!sources[parsed.path]) {
        sources[parsed.path] = {
          original: new Buffer(0),
          patch: new Types.SortedSet(),
          before: new Types.SortedSet(),
          after: new Types.SortedSet()
        };
      }

      if ('original' === parsed.actn) {
        // found another version of path, override it
        sources[parsed.path].original = buff;
      } else {
        sources[parsed.path][parsed.actn].add(parsed.prio || 10, buff);
      }

      next();
    });
  }, function (err) {
    is_ready.resolve(err, sources);
  });
};


// Constructor proxy
Builder.create = function create(src) {
  return new Builder(src);
};


// Patches and merges files into dst
Builder.prototype.output = function output(dst, callback) {
  this.isReady(function (err, sources) {
    var files = [],
        is_finished = new Promise.Joint();

    if (err) {
      callback(err);
      return;
    }

    // process each source file
    _.each(sources, function (data, filename) {
      var dst_file = path.join(dst, filename),
          promise = is_finished.promise();

      apply_patches(dst_file, data.original, data.patch.sorted, function (err, buffer) {
        var before, after;

        if (err) {
          is_finished.reject(err);
          return;
        }

        try {
          before = $$.mergeBuffers.apply(this, data.before.sorted);
          after = $$.mergeBuffers.apply(this, data.after.sorted);
          buffer = $$.mergeBuffers(before, buffer, after);
        } catch (err) {
          // SHOULD NEVER HAPPEN IRL, but mergeBuffers may throw an error
          is_finished.reject(err);
          return;
        }

        // write final result
        fstools.mkdir(path.dirname(dst_file), function (err) {
          if (err) {
            is_finished.reject(err);
            return;
          }

          fs.writeFile(dst_file, buffer, function (err) {
            if (err) {
              is_finished.reject(err);
              return;
            }

            files.push(dst_file);
            promise.resolve();
          });
        });
      });
    });

    // all files were patched and merged together
    is_finished.wait().done(function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, files);
    });
  });
};


// mixes in hash of salt into filename, e.g.
//   /js/app.js -> /js/app._abcdef12_.js
//   /css/app.css.05.patch -> /css/app._abcdef12_.css.05.patch
Builder.uniq_name = function uniq_name(filename, salt) {
  var parsed = filename.match(UNIQ_RE),
      uniqid = crypto.createHash('sha1').update(salt).digest('hex').slice(0, 8);

  return parsed[1] + '._' + uniqid + '_' + (parsed[3] || '') + (parsed[4] || '');
};


// removes uniq hash from the filename
//   /js/app._abcdef12_.js -> /js/app.js
//   /css/app._abcdef12_.css.05.patch -> /css/app.css.05.patch
Builder.norm_name = function norm_name(filename) {
  var parsed = filename.match(UNIQ_RE);

  return parsed[1] + (parsed[3] || '') + (parsed[4] || '');
};


// Compiles src into dst
Builder.run = function run(src, dst, plugins, callback) {
  Builder.create(src).output(dst, function (err, files) {
    var cleanup;

    if (err) {
      callback(err);
      return;
    }

    // list of files to be removed
    cleanup = [];

    $$.sequence(plugins, function (fn, next) {
      fn(dst, files, function (err, cleanup_list) {
        if (_.isArray(cleanup_list) && 0 < _.size(cleanup_list)) {
          files = _.difference(files, cleanup_list);
          cleanup = _.union(cleanup, cleanup_list);
        }
        next(err);
      });
    }, function (err) {
      if (0 === cleanup.length) {
        // no files need to be removed
        callback(err, files);
        return;
      }

      // remove files
      Async.forEach(cleanup, Fs.unlink, function (err) {
        callback(err, files);
      });
    });
  });
};


// parse real path, extract priority, action and path visible to the world
Builder.parsePath = function parsePath(realpath) {
  var m = realpath.toString().match(PATH_RE);
  return {
    path: path.join(m[1], m[3] || m[4]),
    actn: m[3] ? 'after' : (m[7] || 'original'),
    prio: m[6] ? +(m[6].slice(1)) : null
  };
};


/** internal
 *  Builder.Plugins
 **/

// Standard shipped in plugins
Builder.Plugins = {
  stylus: require('./builder/stylus'),
  uglify: require('./builder/uglify')
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

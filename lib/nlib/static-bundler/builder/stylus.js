/**
 *  Builder.Plugins.stylus(dst, files, callback) -> Void
 *
 *  Replace all `*.styl` with compiled `*.css`.
 **/


'use strict';


// stdlib
var fs = require('fs'),
    path = require('path');

// 3rd party
var stylus = require('stylus'),
    Promise = require('simple-promise');


// original file extension
var EXT_RE = new RegExp(/\.styl$/);


// compiles all found .styl files
// partials (_*.styl) are silently skipped
module.exports = function stylus_plugin(dst, files, callback) {
  var cleanup_list = [],
      is_finished = new Promise.Joint(function (err) {
        callback(err, cleanup_list);
      });

  files.forEach(function (file) {
    var promise, out_file;

    if (EXT_RE.test(file)) {
      cleanup_list.push(file);

      if ('_' === path.basename(file)[0]) {
        return;
      }

      promise = is_finished.promise();
      out_file = file.replace(EXT_RE, '.css');

      fs.readFile(file, 'utf-8', function (err, str) {
        if (err) {
          is_finished.reject(err);
          return;
        }

        stylus.render(str, {filename: file}, function (err, css) {
          if (err) {
            is_finished.reject(err);
            return;
          }

          fs.writeFile(out_file, css, function (err) {
            if (err) {
              is_finished.reject(err);
              return;
            }

            // push result file into files array
            files.push(out_file);
            promise.resolve();
          });
        });
      });
    }
  });

  is_finished.wait();
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

/**
 *  Builder.Plugins.uglify(dst, files, callback) -> Void
 *
 *  Replace all `*.js` files with uglified data.
 **/


'use strict';


// stdlib
var fs = require('fs');

// 3rd party
var uglify = require('uglify-js'),
    Promise = require('simple-promise');


// original file extension
var EXT_RE = new RegExp(/\.js$/);


// compiles all found .js files
module.exports = function uglify_plugin(dst, files, callback) {
  var is_finished = new Promise.Joint(callback);

  files.forEach(function (file) {
    var promise;

    if (EXT_RE.test(file)) {
      promise = is_finished.promise();

      fs.readFile(file, 'utf-8', function (err, str) {
        var uglified_js;

        if (err) {
          is_finished.reject(err);
          return;
        }

        try {
          uglified_js = uglify(str);
        } catch (err) {
          is_finished.reject(err);
          return;
        }

        fs.writeFile(file, uglified_js, function (err) {
          if (err) {
            is_finished.reject(err);
            return;
          }

          promise.resolve();
        });
      });
    }
  });

  is_finished.wait();
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

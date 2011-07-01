var fs = require('fs'),
    path = require('path'),
    $$ = require('../utilities');


// TODO: Prevent from dead-loops (when one of inner symlinks points to the
// directory that is under traversing tree, e.g. `ln -s . hang-the-dj`)


// TODO: Split recursion into more elegant version


/**
 *  Utilities.filewalker(dirname, maxDepth, callback) -> Void
 *  Utilities.filewalker(dirname, callback) -> Void
 *
 *  "Use this method for good, Luke."
 **/
var filewalker = module.exports = function filewalker(dirname, maxDepth, callback) {
  if (undefined === callback) {
    callback = maxDepth;
    maxDepth = -1;
  }

  fs.readdirSync(dirname).forEach(function (filename) {
    var fullpath = path.join(dirname, filename),
        stats = fs.lstatSync(fullpath);

    if (stats.isDirectory()) {
      if (0 !== maxDepth) {
        filewalker(fullpath, maxDepth - 1, function (innerFilename, innerStats) {
          callback(path.join(filename, innerFilename), innerStats);
        });
      }

      return;
    }

    // item is not a directory
    callback(filename, stats);
  });
};

////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

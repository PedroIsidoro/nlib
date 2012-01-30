/**
 *  class AssetsBuilder
 **/

'use strict';


// stdlib
var Fs = require('fs');
var Path = require('path');

// 3rd party
var Async = require('async'),
    FsTools = require('fs-tools'),
    Underscore = require('underscore');

// internal
var Builder = require('./assets_builder/builder');


// default settings
var DEFAULTS = {
  // Temporary path
  tmp: ('/tmp/assets-builder.' + process.pid),
  // Standard (shipped in) compiler plugins to register by default
  plugins: ['stylus', 'uglify']
};


/**
 *  new AssetsBuilder([options])
 *  - options (Object): Options. See details below.
 *
 *  Initiate new instance of AssetsBuilder.
 *
 *  ##### Options
 *
 *  - **tmp** Temporary path.
 *    Default: `/tmp/assets-builder.{PID}`
 *  - **plugins** Built-in compiler plugins to load.
 *    Default: `stylus, uglify`
 **/
var AssetsBuilder = module.exports = function AssetsBuilder(options) {
  options = Underscore.extend({}, options, DEFAULTS);

  var self = this, // self-reference
      src_path = Path.join(options.tmp, 'sources'), // source files
      dst_path = Path.join(options.tmp, 'compiled'), // patched, merged, compield files
      sources = [],   // array of sources initializers
      tmp_ready, // promise that builder is ready, see cleanup
      src_ready, // promise that all paths were added. see cleanup
      is_compiled, // promise that sources were compiled. see cleanup
      plugins = []; // plugins to be run after files were compiled


  /** chainable
   *  AssetsBuilder#addBuilderPlugin(handler) -> AssetsBuilder
   *  - handler (Function): Plugin function with three arguments: `dst`, `files`,
   *  and `callback`.
   *
   *  ##### Handler
   *
   *  - **dst**: Destination path, e.g. `/tmp/ab.123/compiled`
   *  - **files**: Array of compiled files
   *  - **callback**: Function with two arguments: `err`, `cleanup` (Array of
   *    compiled files that could be removed.
   *
   *  ##### See Also
   *
   *  - [[Builder.Plugins]]
   **/
  this.addBuilderPlugin = function addBuilderPlugin(handler) {
    plugins.push(handler);
    return this;
  };


  /** chainable
   *  AssetsBuilder#addSourceDir(dir) -> AssetsBuilder
   *  - dir (String): Directory with files to add as sources.
   *
   *  Add all files (relative to `dir`) as sources
   **/
  this.addSourceDir = function addSourceDir(dir) {
    sources.push(function(callback) {
      FsTools.walk(dir, function(orig_file, stats, callback) {
        var filename = orig_file.replace(dir, ''),
            // `orig_file` is a full path to source file, so it's always UNIQUE
            dest_file = Path.join(src_path, Builder.uniq_name(filename, orig_file));

        FsTools.copy(orig_file, dest_file, callback);
      }, callback);
    });

    return self;
  };


  /** chainable
   *  AssetsBuilder#addSourceString(filename, data[, callback]) -> AssetsBuilder
   *
   *  Similar to [[AssetsBuilder#addPath]] but adds `data` string as `filename`,
   *  thus provide interface to add dynamically created sripts etc.
   **/
  this.addSourceString = function addSourceString(filename, data) {
    sources.push(function(callback) {
      Fs.writeFile(Path.join(src_path, filename), data, callback);
    });
  };


  /** chainable
   *  AssetsBuilder#build(callback) -> AssetsBuilder
   *  - callback (Function): Called once compilation finished.
   *
   *  Run compilation and plugins processing. Once compilation and plugins
   *  execution finished, `callback(err, dst_path, files)` called. See callback
   *  arguments description below.
   *
   *  ##### Callback arguments
   *
   *  - **err** Error (if any).
   *  - **dst_path** Destination (where compiled files are stored) directory.
   *  - **files** Array of compiled files.
   **/
  this.build = function build(callback) {
    Async.
    if (null !== is_compiled) {
      is_compiled.done(callback);
      return;
    }

    // init compiled promise
    is_compiled = new Promise(callback, this);

    // start compilation once tmp dir is ready
    this.beforeBuild(function (err) {
      if (err) {
        is_compiled.resolve(err);
        return;
      }

      // run compilation
      Builder.run(src_path, dst_path, [].concat(plugins), function (err, files) {
        src_ready = new Promise.Joint(); // clean-up sources promise
        is_compiled.resolve(err, dst_path, files);
      });
    });

    return this;
  };


  /** chainable
   *  AssetsBuilder#beforeBuild(callback) -> AssetsBuilder
   *  - callback (Function): Called once all sources were added.
   *
   *  Waits for all sources to be added, and then calls `callback`.
   *
   *  **NOTICE** This is optional and will be called by [[AssetsBuilder#build]]
   *  automagically.
   *
   *  ##### Callback arguments
   *
   *  - **err** Error (if any).
   *  - **src_path** Directory with all source files.
   *
   *  ##### See Also
   *
   *  - [[AssetsBuilder#addSourceDir]]
   *  - [[AssetsBuilder#addSourceString]]
   **/
  this.beforeBuild = function beforeBuild(callback) {
    if (!src_ready.awaiting) {
      src_ready.wait();
    }

    src_ready.done(function (err) {
      callback(err, src_path);
    });

    return this;
  };


  /**
   *  AssetsBuilder#cleanup(callback) -> Void
   *
   *  Remove all temporary and compiled data.
   **/
  this.cleanup = function cleanup(callback) {
    FsTools.remove(options.tmp, callback);
  };


  // initial tmp dir cleanups
  sources.push(this.cleanup);


  // register stanard compiler plugins
  if (Array.isArray(options.plugins)) {
    options.plugins.forEach(function (name) {
      self.addBuilderPlugin(Builder.Plugins[name]);
    });
  }
};


/** alias: AssetsBuilder.new
 *  AssetsBuilder.create(options) -> AssetsBuilder
 *
 *  Constructor proxy.
 **/
AssetsBuilder.create = function create(options) {
  return new AssetsBuilder(options);
};

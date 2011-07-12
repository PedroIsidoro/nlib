/**
 *  class StaticManager
 *
 *  ##### How files are merged
 *
 *  - Fixate all ordinary files (e.g. `app.js`), override with latest found
 *  - Apply all patches (e.g. `app.js.05.patch`)
 *  - Apply all before/after patches (e.g. `app.js.15.before`, `_app.js/`)
 **/


'use strict';


var fs = require('fs'),
    path = require('path'),
    PriorityStack = require('./priority_stack'),
    VFS = require('./vfs'),
    $$ = require('./utilities'),
    middleware = require('./static_manager/middleware');


// RegExps matching different file extensions
var STYLUS_RE = new RegExp('\.styl$', 'i'),
    JAVASCRIPT_RE = new RegExp('\.js$', 'i');


// class constructor
var StaticManager = module.exports = function StaticManager() {
  var self = this,
      data = {},
      vfs = new VFS();

  // PROBLEM: vfs was compiled, and then new path was added
  // TODO: Flush vfs when new path given?

  this.add = function add(dirname) {
    $$.filewalker(dirname, function(realpath) {
      var parsed = StaticManager.parsePath(realpath),
          buff = fs.readFileSync(path.join(dirname, realpath));

      // for each found path, create stacks of patches and original buffer
      if (!data[parsed.path]) {
        data[parsed.path] = {
          original: new Buffer(0),
          patch: new PriorityStack(),
          before: new PriorityStack(),
          after: new PriorityStack()
        };
      }

      if ('override' === parsed.actn) {
        // found another version of path, override it
        data[parsed.path].original = buff;
      } else {
        data[parsed.path][parsed.actn].push(parsed.prio || 10, buff);
      }
    });

    return self;
  };

  // compile and return VFS
  this.compile = function compile() {
    // build vfs
    $$.each(data, function (vfs_path, data) {
      var buff = $$.grab(data, 'original'),
          patches = $$.mergeBuffers.apply($$, $$.grab(data, 'patch').flatten()),
          before = $$.mergeBuffers.apply($$, $$.grab(data, 'before').flatten()),
          after = $$.mergeBuffers.apply($$, $$.grab(data, 'after').flatten());

      // patch buffers with all patches first
      if (patches.length) {
        buff = $$.patchBuffers(buff, patches);
      }

      // merge all "dummy" patches with main buffer
      vfs.add(vfs_path, $$.mergeBuffers(before, buff, after));
    });

    // TODO: add option to disable uglification

    // uglify javascripts
    vfs.each(JAVASCRIPT_RE, VFS.plugins.uglify);

    // process stylus files
    vfs.each(STYLUS_RE, VFS.plugins.stylus);

    // remove original styl files
    vfs.each(STYLUS_RE, function(path, data) {
      vfs.add(path.replace(STYLUS_RE, '.css'), data.css);
      vfs.drop(path);
    });

    // attach checksums
    vfs.each(VFS.plugins.checksums);

    // add GZIPped buffers
    vfs.each(VFS.plugins.gzip);

    return vfs;
  };


  // create middleware serving our vfs
  this.middleware = middleware(vfs, new RegExp('\.[a-f0-9]{40}(\.[^.]+)$'));


  // provides helper to "fix" filnames of paths under VFS. needs to be exposed
  // to express static helpers
  this.linkTo = function linkTo(filename) {
    if (!vfs.has(filename)) {
      return null;
    }

    var id = vfs.get(filename).checksums.sha1,
        dir = path.dirname(filename),
        ext = path.extname(filename),
        file = path.basename(filename, ext);

    // /a.css -> /a.3f786850e387550fdab836ed7e6dc881de23001b.css
    return path.join(dir, file + '.' + id + ext);
  };
};


// RegExp describing rules of physycal files storage
var PATH_RE = new RegExp(
  '^'                         + // start
  '(.*?/)??'                  + // [1] path
  '('                         + // [2] >>> alternative
  '_([^/]+)/[^/]+'            + // [3] filename (matching directory)
  '|'                         + // [2] --- or
  '([^/]+?)'                  + // [4] filename
  '('                         + // [5] >>> optional "patch" suffix
  '(\.[0-9]+)?'               + // [6] .priority
  '\.(before|patch|after)'    + // [7] before, patch or after
  ')?'                        + // [5] <<<
  ')'                         + // [2] <<<
  '$'                           // stop
);


// parse real path, extract priority, action and path visible to the world
StaticManager.parsePath = function parsePath(realpath) {
  var m = realpath.toString().match(PATH_RE);
  return {
    path: path.join(m[1], m[3] || m[4]),
    actn: m[3] ? 'after' : (m[7] || 'override'),
    prio: m[6] ? +(m[6].slice(1)) : null
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

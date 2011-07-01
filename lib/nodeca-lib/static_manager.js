/**
 *  class StaticManager
 **/


'use strict';


var fs = require('fs'),
    path = require('path');


var PriorityStack = require('./application/priority_stack'),
    VFS = require('./vfs');


var StaticManager = module.exports = function StaticManager() {
  var self = this,
      data = {},
      vfs = new VFS();


  this.add = function add(dirname) {
    $$.filewalker(dirname, function(realpath) {
      var parsed = StaticManager.parsePath(realpath),
          buff = fs.readFileSync(path.join(dirname, realpath));

      if (!data[parsed.path]) {
        data[parsed.path] = {
          original: new Buffer(0),
          patch: new PriorityStack(),
          before: new PriorityStack(),
          after: new PriorityStack()
        };
      }

      if ('override' === parsed.actn) {
        data[parsed.path].original = buff;
      } else {
        data[parsed.path][parsed.actn].push(parsed.prio || 10, buff);
      }
    });
    return self;
  };

  this.compile = function compile() {
    $$.each(data, function (vfs_path, data) {
      var buff = $$.grab(data, 'original'),
          before = $$.mergeBuffers.apply($$, $$.grab(data, 'before').flatten()),
          after = $$.mergeBuffers.apply($$, $$.grab(data, 'after').flatten());

      // here we need to patch it. not eady yet
      delete(data.patch);

      vfs.add(vfs_path, $$.mergeBuffers(before, buff, after));
    });

    return vfs;
  };
};


var PATH_RE = new RegExp(
  '^'                         + // start
  '(.*?/)??'                  + // [1] path
  '('                         + // [2] >>> alternative
  '_([^/]+)/[^/]+'            + // [3] filename (mathing directory)
  '|'                         + // [2] --- or
  '([^/]+?)'                  + // [4] filename
  '('                         + // [5] >>> optional "patch" suffix
  '(\.[0-9]+)?'               + // [6] .priority
  '\.(before|patch|after)'    + // [7] before, patch or after
  ')?'                        + // [5] <<<
  ')'                         + // [2] <<<
  '$'                           // stop
);


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

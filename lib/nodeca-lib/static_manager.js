/**
 *  class StaticManager
 **/


'use strict';


var path = require('path');


var VFS = require('./vfs');


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

var StaticManager = module.exports = function StaticManager() {
  var self = this,
      data = {};

  this.addPath = function addPath(dirname) {
    return self;
  };

  this.compile = function compile() {
    return new VFS();
  };
};


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

/**
 *  class StaticManager
 **/


'use strict';


var VFS = require('./vfs');


var StaticManager = module.exports = function StaticManager() {
  var self = this,
      data = {};

  this.addPath = function addPath(path) {

    return self;
  };

  this.compile = function compile() {
    return new VFS();
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

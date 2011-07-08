/**
 *  class VFS
 *
 *  Virtual File System
 **/


'use strict';


var path = require('path'),
    mime = require('./mime');


var LEADING_SLASH = new RegExp('^\/?');


var normalize = function normalize(dirtyPath) {
  return path.normalize(dirtyPath).replace(LEADING_SLASH, '/');
}


var VFS = module.exports = function VFS() {
  if (!(this instanceof VFS)) {
    return new VFS();
  }

  var self = this,
      plugins = [],
      data = {};


  this.has = function has(path) {
    return undefined !== data[normalize(path)];
  };


  this.add = function add(path, buffer) {
    path = normalize(path);

    if (this.has(path)) {
      throw Error("Path already exists");
    }

    data[path] = {
      buffer: buffer,
      mime: (mime.type(path) || 'application/octet-stream')
    };

    plugins.forEach(function (plugin) {
      if (plugin.pattern.test(path)) {
        plugin.callback.call(self, path, data[path]);
      }
    });

    return self;
  };


  this.get = function get(path) {
    return data[normalize(path)] || null;
  };


  this.drop = function drop(path) {
    delete data[normalize(path)];

    return self;
  };


  this.rename = function rename(oldPath, newPath) {
    if (!self.has(oldPath)) {
      throw Error("Path not found");
    }

    data[normalize(newPath)] = data[normalize(oldPath)];
    self.drop(oldPath);

    return self;
  };


  this.each = function each(pattern, callback) {
    if (undefined === callback) {
      callback = pattern;
      pattern = '';
    }

    pattern = new RegExp(pattern);

    $$.each(data, function (path, obj) {
      if (pattern.test(path)) {
        callback.call(self, path, obj);
      }
    });
  };


  this.plugin = function plugin(pattern, callback) {
    if (undefined === callback) {
      callback = pattern;
      pattern = '';
    }

    pattern = new RegExp(pattern);

    plugins.push({pattern: pattern, callback: callback});
    self.each(pattern, callback);

    return self;
  };


  this.find = function find(pattern) {
    var matches = {};

    self.each(pattern, function (path, data) {
      matches[path] = data;
    });

    return matches;
  };
};


// expose VFS plugins
VFS.plugins = require('./vfs/plugins');


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

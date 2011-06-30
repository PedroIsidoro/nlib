/**
 *  class VFS
 *
 *  Virtual File System
 **/


'use strict';


var mime = require('./mime');


var VFS = module.exports = function VFS() {
  var self = this,
      plugins = [],
      data = {};


  this.has = function has(path) {
    return undefined !== data[path];
  };


  this.add = function add(path, buffer) {
    if (this.has(path)) {
      throw Error("Path lready exists");
    }

    data[path] = {
      data: buffer,
      mime: (mime.type(path) || 'application/octet-stream')
    };

    plugins.forEach(function (callback) {
      callback.call(self, path, data[path]);
    });

    return self;
  };


  this.get = function get(path) {
    return data[path] || null;
  };


  this.drop = function drop(path) {
    delete data[path];

    return self;
  };


  this.rename = function rename(oldPath, newPath) {
    if (!self.has(oldPath)) {
      throw Error("Path not found");
    }

    data[newPath] = data[oldPath];
    self.drop(oldPath);

    return self;
  };


  this.plugin = function plugin(callback) {
    plugins.push(callback);
    $$.each(data, function (path, obj) {
      callback.call(self, path, obj);
    });

    return self;
  };


  this.find = function find(pattern) {
    var matches = {}, re = new RegExp(pattern);

    $$.each(data, function (path, obj) {
      if (path.match(re)) {
        matches[path] = obj;
      }
    });

    return matches;
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

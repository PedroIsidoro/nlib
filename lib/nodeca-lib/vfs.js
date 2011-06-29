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
  };


  this.get = function get(path) {
    return data[path] || null;
  };


  this.drop = function drop(path) {
    delete data[path];
  };


  this.rename = function rename(oldPath, newPath) {
    if (!this.has(oldPath)) {
      throw Error("Path not found");
    }

    data[newPath] = data[oldPath];
    this.drop(oldPath);
  };


  this.plugin = function(callback) {
    plugins.push(callback);
    $$.each(data, function (path, obj) {
      callback.call(self, path, obj);
    });
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

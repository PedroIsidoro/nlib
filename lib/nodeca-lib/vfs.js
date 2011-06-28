/**
 *  class VFS
 *
 *  Virtual File System
 **/


'use strict';


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

    data[path] = {data: buffer};
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


VFS.prototype.get = function get() {};
VFS.prototype.add = function add() {};
VFS.prototype.drop = function drop() {};
VFS.prototype.rename = function rename() {};
VFS.prototype.plugin = function plugin() {};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

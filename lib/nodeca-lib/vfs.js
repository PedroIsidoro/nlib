/**
 *  class VFS
 *
 *  Virtual File System.
 *
 *  Each element of VFS is an object accessible by `path`. Elements, by default,
 *  contains:
 *
 *    - `mime` (String): Mime type of element (See [[VFS#add]])
 *    - `buffer` (Buffer): Associated buffer
 *
 *  **NOTICE** VFS treats all paths as relative to the root of itself. In other
 *  word there's no difference for VFS between `foo/bar` and `/foo/bar`.
 *
 *  **WARNING**
 *    VFS normalizes all paths. For example:
 *
 *    - `/foo/bar/../baz` becomes `/foo/baz`
 *    - `/foo/../../../baz` becomes /baz`
 **/


'use strict';


var path = require('path'),
    mime = require('./mime'),
    $$ = require('./utilities');


// matches leading slash. see normalize below.
var LEADING_SLASH = new RegExp('^\/+');


// normalizes path (resolve all `..` etc) and remove leading slash:
//   - /foo/bar/../baz    -> 'foo/baz'
//   - /foo/../../../baz  -> 'baz'
//   - /foo/..            -> ''
var normalize = function normalize(dirtyPath) {
  return path.normalize(dirtyPath).replace(LEADING_SLASH, '/');
}


/**
 *  new VFS()
 *
 *  Creates new, empty instance of VFS.
 **/
var VFS = module.exports = function VFS() {
  if (!(this instanceof VFS)) {
    return new VFS();
  }

  var self = this,  // self-reference
      plugins = [], // array of all registered plugins.
      data = {};    // hash of path => data


  // TODO:  replace array of plugins with priority stack, so it will become
  //        possible to register plugins with priorities.
  // TODO:  replace mime assignment with hardcore mime plugin


  /**
   *  VFS#has(path) -> Boolean
   *
   *  Tells whenever VFS has given `path` or not.
   *
   *  ##### See Also
   *
   *  - [[VFS#add]]
   **/
  this.has = function has(path) {
    return undefined !== data[normalize(path)];
  };


  /**
   *  VFS#add(path, buffer) -> VFS
   *
   *  Adds new element to VFS with given `path`, `buffer` and MIME type found by
   *  extension of `path`.
   *
   *  ##### Throws Error
   *
   *  - when VFS already has `path` element
   *  - when `buffer` is not instance of `Buffer`
   *
   *  ##### See Also
   *
   *  - [[VFS#has]]
   *  - [[VFS#plugin]]
   *  - [[Mime#type]]
   **/
  this.add = function add(path, buffer) {
    path = normalize(path);

    if (this.has(path)) {
      throw Error('Path already exists, path=' + path);
    }

    if (!Buffer.isBuffer(buffer)) {
      throw Error('Given buffer is not valid, buffer=' + buffer);
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


  /**
   *  VFS#get(path) -> Object|NULL
   *
   *  Returns element registered with specified `path`, or `NULL` if path was
   *  not found.
   **/
  this.get = function get(path) {
    return data[normalize(path)] || null;
  };


  /**
   *  VFS#drop(path) -> VFS
   *
   *  Removes element with specified `path` if it was found.
   *  Does nothing otherwise.
   **/
  this.drop = function drop(path) {
    delete data[normalize(path)];

    return self;
  };


  /**
   *  VFS#rename(oldPath, newPath) -> VFS
   *
   *  Adds `newPath` with buffer found by `oldPath`.
   *
   *  ##### Throws Error
   *
   *  - When oldPath does npt exists
   **/
  this.rename = function rename(oldPath, newPath) {
    if (!self.has(oldPath)) {
      throw Error('Path not found, path=' + oldPath);
    }

    self.add(newPath, self.get(oldPath).buffer);
    self.drop(oldPath);

    return self;
  };


  /**
   *  VFS#each(pattern, callback) -> VFS
   *  VFS#each(callback) -> VFS
   *
   *  Fires `callback(path, data)` on each element of VFS with path matching
   *  `pattern`. When no `pattern` given, will match ALL elements of VFS.
   **/
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

    return self;
  };


  /**
   *  VFS#plugin(pattern, callback) -> VFS
   *  VFS#plugin(callback) -> VFS
   *
   *  Same as [[VFS#each]] but in will fire `callback` on any element added
   *  later as well.
   *
   *  ##### Example
   *
   *  Following will call `ripOff` on both `/foo.txt` and `/bar.txt`.
   *
   *      vfs.add('/foo.txt', new Buffer(0));
   *      vfs.plugin(/\.txt$/i, function ripOff(path, data) {
   *        // do something
   *      });
   *      vfs.add('/bar.txt', new Buffer(0));
   *
   *  ##### See Also
   *
   *  - [[VFS#each]]
   **/
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


  /**
   *  VFS#find(pattern) -> Object
   *
   *  Returns `hash` of `path => element` pairs with `paths` matching `pattern`.
   **/
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

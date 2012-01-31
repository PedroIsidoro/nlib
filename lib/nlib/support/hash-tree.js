/** internal, belongs to: Support
 *  class HashTree
 *
 *  Extended object instance that allows to access leaves of the tree by paths.
 *
 *  ##### Example
 *
 *      var tree = new HashTree({
 *        forum: {
 *          posts: [ 1, 2, 3 ]
 *        }
 *      });
 *
 *      console.log(tree.forum.posts); // -> [ 1, 2, 3 ]
 *      console.log(tree.__get__('forum.posts')); // -> [ 1, 2, 3 ]
 **/


'use strict';


// 3rd-party
var Underscore = require('underscore');


var HashTree = module.exports = function HashTree(obj) {
  this.__paths__ = [];
  this.__cache__ = {};

  if (obj) {
    Underscore.each(obj, function (val, key) {
      this.__set__(key, val);
    }, this);
  }
};


HashTree.getByPath = function getByPath(obj, path) {
  var parts, tmp, key, processed = [];
 
  parts = path.split('.');
  key = parts.pop();

  while (0 < parts.length) {
    tmp = parts.shift();
    processed.push(tmp);

    if ('object' !== typeof obj[tmp]) {
      throw new TypeError(
        "Got unexpected non-object at '" + processed.join('.') + "' " +
        "when trying to reach: " + path
      );
    }

    obj = obj[tmp];
  }

  return obj[key];
};


HashTree.setByPath = function setByPath(obj, path, val) {
  var parts, tmp, key, processed = [];
 
  parts = path.split('.');
  key = parts.pop();

  while (0 < parts.length) {
    tmp = parts.shift();

    if (!!obj[tmp] && 'object' === typeof obj[tmp]) {
      obj = obj[tmp];
    } else {
      obj = {};
    }
  }

  obj[key] = val;
};


HashTree.prototype.__set__ = function __set__(path, val) {

};


HashTree.prototype.__get__ = function __get__(path) {
  return this.__paths__[path];
};


HashTree.prototype.__has__ = function __hash__(path) {
  return 0 <= this.__paths__.indexOf(path);
};


HashTree.create = function create(obj) {
  return new HashTree(obj);
};

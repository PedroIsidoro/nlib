/** internal, belongs to: Support
 *  Support.HashTree
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


//  If this will be separated into nodeca/types, these are TODOs:
//
//    - Add ability to recursively make sub-trees.
//    - Assign getter/setters, to effeciently update paths map.


// 3rd-party
var Underscore = require('underscore');
var Types = require('types');


var cache = new Types.Hash(false);


// return paths cache. create if needed
function get_cache(tree) {
  var data = cache.get(tree);

  if (false === data) {
    data = {};
    cache.store(tree, data);
  }

  return data;
}


var HashTree = module.exports = {};


/**
 *  Support.HashTree.get(tree, path) -> Mixed
 **/
HashTree.get = function get(tree, path) {
  var parts, tmp, key;

  // skip search if we hve found path before
  tmp = get_cache(tree)[path];
  if (undefined !== tmp) {
    return tmp;
  }

  parts = path.split('.');
  key = parts.pop();

  while (0 < parts.length) {
    tmp = parts.shift();

    if ('object' !== typeof tree[tmp]) {
      get_cache(tree)[path] = null;
      return null;
    }

    tree = tree[tmp];
  }

  return tree[key];
};


/**
 *  Support.HashTree.set(tree, path, val) -> Null|Error
 **/
HashTree.set = function set(tree, path, val) {
  var parts, tmp, key, processed = [];

  parts = path.split('.');
  key = parts.pop();

  while (0 < parts.length) {
    tmp = parts.shift();
    processed.push(tmp);

    if (!!tree[tmp] && 'object' === typeof tree[tmp]) {
      tree = tree[tmp];
    } else if (undefined === tree[tmp]) {
      tree = {};
    } else {
      return new TypeError(
        "Got unexpected non-object at '" + processed.join('.') + "' " +
        "when trying to set value of: " + path
      );
    }
  }

  get_cache(tree)[path] = tree[key] = val;
  return null;
};


/**
 *  Support.HashTree.getKnownPaths(tree) -> Array
 **/
HashTree.getKnownPaths = function getKnownPaths(tree) {
  return Underscore.keys(get_cache(tree));
};


/**
 *  Support.HashTree.has(tree, path) -> Boolean
 **/
HashTree.has = function has(tree, path) {
  return undefined !== get_cache(tree)[path];
};

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


//  If this will be separated into nodeca/types, these are TODOs:
//
//    - Add ability to recursively make sub-trees.
//    - Assign getter/setters, to effeciently update paths map.


// 3rd-party
var Underscore = require('underscore');


// return paths cache. create if needed
function hashtree_cache(tree) {
  if (!tree.__hashtree__) {
    tree.__hashtree__ = {};
  }

  return tree.__hashtree__;
}


var HashTree = module.exports = {};


HashTree.get = function get(tree, path, callback) {
  var parts, tmp, key, processed = [];

  // if we have found it earlier - no need to serch again
  tmp = hashtree_cache(tree)[path];
  if (tmp) {
    callback(null, tmp);
    return;
  }
 
  parts = path.split('.');
  key = parts.pop();

  while (0 < parts.length) {
    tmp = parts.shift();
    processed.push(tmp);

    if ('object' !== typeof tree[tmp]) {
      callback(new TypeError(
        "Got unexpected non-object at '" + processed.join('.') + "' " +
        "when trying to reach: " + path
      ));
      return;
    }

    tree = tree[tmp];
  }

  callback(null, tree[key]);
};


HashTree.set = function set(tree, path, val) {
  var parts, tmp, key, processed = [];
 
  parts = path.split('.');
  key = parts.pop();

  // set hashtree cache
  hashtree_cache(tree)[path] = val;

  while (0 < parts.length) {
    tmp = parts.shift();

    if (!!tree[tmp] && 'object' === typeof tree[tmp]) {
      tree = tree[tmp];
    } else {
      tree = {};
    }
  }

  tree[key] = val;
};

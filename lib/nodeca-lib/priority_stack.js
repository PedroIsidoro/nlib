/**
 *  class PriorityStack
 *
 *  Provides easy way to build sequences of objects (or functions) based on
 *  priority weight.
 *
 *  ##### Example
 *
 *      var stack = new PriorityStack();
 *
 *      stack.push(20, 'World!').push(10, 'Hello').unshift(10, 'Well,');
 *      stack.flatten().join(' ');
 *      // -> Well, Hello World!
 **/


'use strict';


var $$ = require('./utilities');


/**
 *  new PriorityStack()
 *
 *  Can be called without `new` keyword.
 **/
var PriorityStack = module.exports = function PriorityStack() {
  // allows create instance without `new` keyword
  if (!(this instanceof PriorityStack)) {
    return new PriorityStack();
  }


  var that = this,
      sequences = {},
      get_sequence = function get_sequence(priority) {
        if (undefined === sequences[priority]) {
          sequences[priority] = [];
        }

        return sequences[priority];
      };


  /** chainable
   *  PriorityStack#unshift(priority, obj) -> PriorityStack
   *  - priority (Number): Priority of sequence
   *  - obj (Mixed): Something to be unshifted into sequence
   *
   *  Prepends `obj` into the beginning of sequence for given `priority`.
   *
   *  ##### See Also
   *
   *  - [[PriorityStack#push]]
   **/
  this.unshift = function unshift(priority, obj) {
    get_sequence(+priority).unshift(obj);
    return that;
  };


  /** chainable
   *  PriorityStack#push(priority, obj) -> PriorityStack
   *  - priority (Number): Priority of sequence
   *  - obj (Mixed): Something to be pushed into sequence
   *
   *  Appends `obj` into the end of sequence for given `priority`.
   *
   *  ##### See Also
   *
   *  - [[PriorityStack#unshift]]
   **/
  this.push = function push(priority, obj) {
    get_sequence(+priority).push(obj);
    return that;
  };


  /** chainable
   *  PriorityStack#merge(stack) -> PriorityStack
   *  - stack (PriorityStack): Stack of instances to merge in
   *
   *  Merges all sequences of `stack` into current instance. Sequences are
   *  appended to the existing ones, or new sequences are created.
   *
   *  ##### Example
   *
   *      var stack = PriorityStack().push(10, 'a').push(30, 'c');
   *      stack.merge(PriorityStack().push(20, 'b'));
   *      stack.unshift(20, '-').push(20, '-');
   *      stack.flatten().join('');
   *      // -> a-b-c
   **/
  this.merge = function merge(stack) {
    $$.each(stack.__sequences__, function (priority, sequence) {
      sequences[priority] = get_sequence(priority).concat(sequence);
    });
    return that;
  };


  /**
   *  PriorityStack#flatten() -> Array
   *
   *  Returns resulting array of all elements from all sequences.
   *
   *  ##### Example
   *
   *      stack.push(20, 'b').push(30, 'c').push(10, 'a');
   *      stack.flatten().join('');
   *      // -> abc
   **/
  this.flatten = function flatten() {
    var arr = [];

    Object.getOwnPropertyNames(sequences).sort().forEach(function (priority) {
      get_sequence(priority).forEach(function (obj) {
        arr.push(obj);
      });
    });

    return arr;
  };


  /** internal
   *  PriorityStack#__sequences__ -> Object
   *
   *  Returns copy of sequences hash.
   **/
  this.__defineGetter__('__sequences__', function () {
    return $$.merge({}, sequences);
  });
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

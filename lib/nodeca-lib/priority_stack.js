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
 *      stack.push(20, 'World!').push(10, 'Hello');
 *      stack.flatten().join(' ');
 *      // -> Hello World!
 **/


'use strict';


// callback for Array#sort to sort numbers adequately :))
var sort_numbers_asc = function sort_numbers_asc(a, b) {
  return a - b;
}


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
   *  PriorityStack#push(priority, obj) -> PriorityStack
   *  - priority (Number): Priority of sequence
   *  - obj (Mixed): Something to be pushed into sequence
   *
   *  Appends `obj` into the end of sequence for given `priority`.
   **/
  this.push = function push(priority, obj) {
    get_sequence(+priority).push(obj);
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

    Object.getOwnPropertyNames(sequences).sort(sort_numbers_asc).forEach(function (priority) {
      get_sequence(priority).forEach(function (obj) {
        arr.push(obj);
      });
    });

    return arr;
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
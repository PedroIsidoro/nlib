var assert = require('assert'),
    vows = require('vows'),
    Stack = require('../lib/nodeca-lib/application/priority_stack');


vows.describe('Application.PriorityStack').addBatch({
  "When unshifting an object": {
    topic: function () {
      return Stack().unshift(0, 'c').unshift(0, 'b').unshift(0, 'a').flatten();
    },
    "given object is prepended into the priority sequence": function (arr) {
      assert.length(arr, 3);
      assert.equal(arr.join(''), 'abc');
    }
  },
  "When pushing an object": {
    topic: function () {
      return Stack().push(0, 'a').push(0, 'b').push(0, 'c').flatten();
    },
    "given object is prepended into the priority sequence": function (arr) {
      assert.length(arr, 3);
      assert.equal(arr.join(''), 'abc');
    }
  },
  "When stack is flatten": {
    topic: function () {
      return Stack().push(1, 'c').push(0, 'b').push(-1, 'a').flatten();
    },
    "sequences are linked with respet of their priorities": function (arr) {
      assert.length(arr, 3);
      assert.equal(arr.join(''), 'abc');
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

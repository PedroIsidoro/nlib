var assert = require('assert'),
    vows = require('vows'),
    $$ = require('../lib/nodeca-lib/utilities'),
    helpers = require('./helpers');


vows.describe('Utilities').addBatch({
  "When deepMerge'ing objects": {
    topic: function () {
      var a = {
            number: 123,
            string: 'abc',
            array: [1, 2, 3],
            inner: {
              number: 123,
              string: 'abc'
            },
            string_to_object: '',
            object_to_string: {}
          },
          b = {
            array: [9],
            string: 'cba',
            inner: {
              number: 321
            },
            string_to_object: {},
            object_to_string: ''
          };

      this.callback(null, a, $$.deepMerge(a, b));
    },
    "returned object is the same as receiver": function (nil, o1, o2) {
      assert.deepEqual(o1, o2);
    },
    "non-objects are overridden": function (nil, o) {
      assert.equal(o.string, 'cba');
      assert.length(o.array, 1);
      assert.include(o.array, 9);
    },
    "and objects are merged recursively": function (nil, o) {
      assert.isObject(o.inner);
      assert.equal(o.inner.string, 'abc');
      assert.equal(o.inner.number, 321);
    },
    "only if both sides' properties are objects": function (nil, o) {
      assert.isObject(o.string_to_object);
      assert.isString(o.object_to_string);
    }
  },
  "When deepMerge'ing more than one transmitter": {
    topic: function () {
      var a = {inner: {a: 1, b: 1, c: 1}},
          b = {inner: {b: 2, c: 2}},
          c = {inner: {c: 3}};

      return $$.deepMerge(a, b, c);
    },
    "transmitters are merged-in from left to right": function (o) {
      assert.equal(o.inner.a, 1);
      assert.equal(o.inner.b, 2);
      assert.equal(o.inner.c, 3);
    }
  },
  "When merge'ing objects": {
    topic: function () {
      var a = {foo: 1, inner: {foo: 1}},
          b = {foo: 2, inner: {bar: 2}},
          c = {inner: {bar: 3}};

      this.callback(null, a, $$.merge(a, b, c));
    },
    "returned object is the same as receiver": function (nil, o1, o2) {
      assert.deepEqual(o1, o2);
    },
    "all properties (even objects) are overridden": function (nil, o) {
      assert.isUndefined(o.inner.foo);
    },
    "and transmitters are merged-in from left to right": function (nil, o) {
      assert.equal(o.foo, 2)
      assert.equal(o.inner.bar, 3);
    }
  },
  "When grab'ing object's value": {
    topic: function () {
      var o = {a: 1, b: 2};
      return {o: o, b: $$.grab(o, 'b'), c: $$.grab(o, 'c')};
    },
    "undefined values are returned as is": function (r) {
      assert.isUndefined(r.o.c);
      assert.isUndefined(r.c);
    },
    "grabbed key is removed from object": function (r) {
      assert.isUndefined(r.o.b);
      assert.equal(r.b, 2);
    }
  }
}).addBatch(
  helpers.formatReaderTests('YAML', $$.readYaml, $$.readYamlSync)
).addBatch(
  helpers.formatReaderTests('JSON', $$.readJson, $$.readJsonSync)
).addBatch({
  "When iterating objects": {
    topic: function () {
      var keys = [], vals = [];

      $$.each({a: 1, b: 2, c: 3}, function (k, v) {
        keys.push(k);
        vals.push(v);
      });

      return {keys: keys, vals: vals};
    },
    "first argument of each() callback is property name": function (result) {
      assert.length(result.keys, 3);
      assert.include(result.keys, 'a');
      assert.include(result.keys, 'b');
      assert.include(result.keys, 'c');
    },
    "second argument of each() callback is property value": function (result) {
      assert.length(result.vals, 3);
      assert.include(result.vals, 1);
      assert.include(result.vals, 2);
      assert.include(result.vals, 3);
    }
  },
  "When iterating arrays": {
    topic: function () {
      var idxs = [], vals = [];

      $$.each(['a', 'b', 'c'], function (i, v) {
        idxs.push(i);
        vals.push(v);
      });

      return {idxs: idxs, vals: vals};
    },
    "first argument of each() callback is element index": function (result) {
      assert.length(result.idxs, 3);
      assert.include(result.idxs, 0);
      assert.include(result.idxs, 1);
      assert.include(result.idxs, 2);
    },
    "second argument of each() callback is property value": function (result) {
      assert.length(result.vals, 3);
      assert.include(result.vals, 'a');
      assert.include(result.vals, 'b');
      assert.include(result.vals, 'c');
    }
  }
}).addBatch({
  "When iterator callback returns false": {
    topic: function () {
      var processed = [];

      $$.each([1,2,3], function (i, v) {
        processed.push(v);
        return false;
      });

      return processed;
    },
    "iteration should be interrupted": function (processed) {
      assert.equal(processed.length, 1);
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

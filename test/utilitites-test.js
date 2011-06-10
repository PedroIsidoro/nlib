var assert = require('assert'),
    vows = require('vows'),
    $$ = require('../lib/utilities'),
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

      var aa = $$.deepMerge(a, b);
      this.callback(null, a, aa);
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

      $$.deepMerge(a, b, c);
      return a;
    },
    "transmitters are merged in from left to right": function (o) {
      assert.equal(o.inner.a, 1);
      assert.equal(o.inner.b, 2);
      assert.equal(o.inner.c, 3);
    }
  },
  "When grab'ing objcet's value": {
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
      var keys = [], vals = [], callback = this.callback;

      $$.iterate({a: 1, b: 2, c: 3}, function (k, v, next) {
        keys.push(k);
        vals.push(v);
        next();
      }, function () {
        callback(null, keys, vals);
      });
    },
    "first argument of each() callback is property name": function (nil, keys, vals) {
      assert.length(keys, 3);
      assert.include(keys, 'a');
      assert.include(keys, 'b');
      assert.include(keys, 'c');
    },
    "second argument of each() callback is property value": function (nil, keys, vals) {
      assert.length(vals, 3);
      assert.include(vals, 1);
      assert.include(vals, 2);
      assert.include(vals, 3);
    }
  },
  "When iterating arrays": {
    topic: function () {
      var idxs = [], vals = [], callback = this.callback;

      $$.iterate(['a', 'b', 'c'], function (i, v, next) {
        idxs.push(i);
        vals.push(v);
        next();
      }, function () {
        callback(null, idxs, vals);
      });
    },
    "first argument of each() callback is element index": function (nil, idxs, vals) {
      assert.length(idxs, 3);
      assert.include(idxs, 0);
      assert.include(idxs, 1);
      assert.include(idxs, 2);
    },
    "second argument of each() callback is property value": function (nil, keys, vals) {
      assert.length(vals, 3);
      assert.include(vals, 'a');
      assert.include(vals, 'b');
      assert.include(vals, 'c');
    }
  }
}).addBatch({
  "When exception is thrown inside iteration": {
    topic: function () {
      var callback = this.callback,
          processed = [];

      $$.iterate([1,2,3], function (i, v, next) {
        processed.push(v);

        if (2 == v) {
          throw Error('Should be catched');
        }

        next();
      }, function (err) {
        callback(null, err, processed);  
      });
    },
    "it should be catched and passed to final() callback": function (nil, err, processed) {
      assert.instanceOf(err, Error);
    },
    "and iteration should be interrupted": function (nil, err, processed) {
      assert.equal(processed.length, 2);
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

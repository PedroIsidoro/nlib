var assert = require('assert'),
    vows = require('vows'),
    $$ = require('../lib/utilities');


vows.describe('Utilities').addBatch({
  "Reading valid YAML file": {
    topic: function () {
      $$.readYaml(__dirname + '/fixtures/sample-valid.yml', this.callback);
    },
    "should return object": function (err, obj) {
      assert.isString(obj.str);
      assert.isNumber(obj.inner.nbr);
    }
  },
  "Reading invalid YAML file": {
    topic: function () {
      var callback = this.callback;
      $$.readYaml(__dirname + '/fixtures/sample-invalid.yml', function (err, obj) {
        // callback should be called with null first, otherwise it will drop
        // all other params that were left
        callback(null, err, obj);
      });
    },
    "should return error and no data": function (nil, err, obj) {
      assert.instanceOf(err, Error);
      assert.isUndefined(obj);
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

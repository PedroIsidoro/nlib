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
  }
}).addBatch({
  "Reading invalid YAML file": {
    topic: function () {
      var callback = this.callback;
      $$.readYaml(__dirname + '/fixtures/sample-invalid.yml', this.callback);
    },
    "should return error and no data": function (err, obj) {
      assert.instanceOf(err, Error);
      assert.isUndefined(obj);
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

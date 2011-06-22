var assert = require('assert'),
    vows = require('vows'),
    Application = require('../lib/nodeca-lib/application'),
    fixtures = __dirname + '/fixtures/';


vows.describe('Application').addBatch({
  "Reading valid JSON": {
    topic: function () {
      return Application.getPackageInfo(fixtures, 'sample-valid.json');
    },
    "should return object": function (obj) {
      assert.isObject(obj);
      assert.equal(obj.str, 'abc');
      assert.equal(obj.inner.nbr, 123);
    }
  },
  "Reading invalid JSON": {
    topic: function () {
      return Application.getPackageInfo(fixtures, 'sample-invalid.json');
    },
    "should silently return empty object": function (obj) {
      assert.deepEqual(obj, {});
    }
  },
  "When reading JSON file that does not exists": {
    topic: function () {
      return Application.getPackageInfo(fixtures);
    },
    "should silently return empty object": function (obj) {
      assert.deepEqual(obj, {});
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

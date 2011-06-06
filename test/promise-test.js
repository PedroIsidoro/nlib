var assert = require('assert'),
    vows = require('vows'),
    Promise = require('../lib/promise');


vows.describe('Promise').addBatch({
  "When promise resolved": {
    topic: function () {
      Promise(this.callback).done(this.callback).resolve(null, 123);
    },
    "it fires subscribed callbacks": function (err, result) {
      assert.equal(result, 123);
    }
  }
}).addBatch({
  "When subscriber appended after promise was resolved": {
    topic: function () {
      Promise().resolve(null, 123).done(this.callback);
    },
    "it is fired as well": function (err, result) {
      assert.equal(result, 123);
    }
  }
}).addBatch({
  "Trying to resolve promise more than once": {
    topic: function () {
      Promise().resolve(null, 123).resolve(null, 321).done(this.callback);
    },
    "does nothing": function (err, result) {
      assert.equal(result, 123);
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

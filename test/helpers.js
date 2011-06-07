var assert = require('assert'),
    vows = require('vows');

exports.formatReaderTests = function (format, reader, readerSync) {
  var formatName = format.toUpperCase(),
      validFile = __dirname + '/fixtures/sample-valid.' + format.toLowerCase(),
      invalidFile = __dirname + '/fixtures/sample-invalid.' + format.toLowerCase(),
      tests = {};

  tests["Reading valid " + formatName + " file asynchronously"] = {
    topic: function () {
      reader(validFile, this.callback);
    },
    "should fire callback with data object": function (err, obj) {
      assert.isObject(obj);
      assert.isString(obj.str);
      assert.isNumber(obj.inner.nbr);
    }
  };

  tests["Reading valid " + formatName + " file synchronously"] = {
    topic: readerSync(validFile),
    "should return object": function (obj) {
      assert.isObject(obj);
    }
  };

  tests["Reading invalid " + formatName + " file asynchronously"] = {
    topic: function () {
      var callback = this.callback;
      reader(invalidFile, function (err, obj) {
        // callback should be called with null first, otherwise it will drop
        // all other params that were left
        callback(null, err, obj);
      });
    },
    "should fire callback with error and no data object at all": function (nil, err, obj) {
      assert.instanceOf(err, Error);
      assert.isUndefined(obj);
    }
  };

  tests["Reading invalid " + formatName + " file synchronously"] = {
    "should throw error": function (obj) {
      assert.throws(function () {
        readerSync(invalidFile);
      }, Error);
    },
    "should silently return null, if silence asked": function (obj) {
      assert.doesNotThrow(function () {
        var obj = readerSync(invalidFile, true);
        assert.isNull(obj);
      }, Error);
    }
  };

  return tests;
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

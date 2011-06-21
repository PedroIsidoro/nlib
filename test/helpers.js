var assert = require('assert'),
    vows = require('vows');

exports.formatReaderTests = function (format, readerSync) {
  var formatName = format.toUpperCase(),
      validFile = __dirname + '/fixtures/sample-valid.' + format.toLowerCase(),
      invalidFile = __dirname + '/fixtures/sample-invalid.' + format.toLowerCase(),
      tests = {};

  tests["Reading valid " + formatName + " file"] = {
    topic: readerSync(validFile),
    "should return object": function (obj) {
      assert.isObject(obj);
    }
  };

  tests["Reading invalid " + formatName + " file"] = {
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

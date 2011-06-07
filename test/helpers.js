var assert = require('assert'),
    vows = require('vows');

exports.formatReaderTests = function (format, reader) {
  var formatName = format.toUpperCase(),
      validFile = __dirname + '/fixtures/sample-valid.' + format.toLowerCase(),
      invalidFile = __dirname + '/fixtures/sample-invalid.' + format.toLowerCase(),
      tests = {};

  tests["Reading valid " + formatName + " file"] = {
    topic: function () {
      reader(validFile, this.callback);
    },
    "should return object": function (err, obj) {
      assert.isString(obj.str);
      assert.isNumber(obj.inner.nbr);
    }
  };

  tests["Reading invalid " + formatName + " file"] = {
    topic: function () {
      var callback = this.callback;
      reader(invalidFile, function (err, obj) {
        // callback should be called with null first, otherwise it will drop
        // all other params that were left
        callback(null, err, obj);
      });
    },
    "should return error and no data": function (nil, err, obj) {
      assert.instanceOf(err, Error);
      assert.isUndefined(obj);
    }
  };

  return tests;
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

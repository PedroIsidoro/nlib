var assert = require('assert'),
    vows = require('vows');


exports.buildStringManglersTest = function (callback, pairs) {
  var tests = {};

  Object.getOwnPropertyNames(pairs).forEach(function (given) {
    var expected = pairs[given];
    tests[given + ' -> ' + expected] = function () {
      assert.equal(callback(given), expected);
    };
  });

  return tests;
};

////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

var assert = require('assert'),
    vows = require('vows');


exports.buildStringManglersTest = function (callback, pairs) {
  var tests = {};

  Object.getOwnPropertyNames(pairs).forEach(function (given) {
    var expected = pairs[given];

    tests[given] = {};
    
    tests[given]['topic'] = callback(given);
    tests[given]['should become ' + expected] = function (result) {
      assert.equal(result, expected);
    };
  });

  return tests;
};

////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

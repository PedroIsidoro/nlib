'use strict';


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


var mime_tests = function mime_tests(mimes, verb, callback) {
  var tests = {};

  Object.getOwnPropertyNames(mimes).forEach(function (type) {
    var ext = mimes[type];
    tests[verb + ' ' + ext.toUpperCase()] = function () {
      callback(type, ext);
    }
  });

  return tests;
};


exports.knowMimes = function (mime, map) {
  return mime_tests(map, 'knows about', function (type, ext) {
    assert.equal(mime.extension(type), ext);
    assert.equal(mime.type('foobar.' + ext), type);
  });
};


exports.knowNoMimes = function (mime, map) {
  return mime_tests(map, 'knows nothing about', function (type, ext) {
    assert.isUndefined(mime.extension(type));
    assert.isUndefined(mime.type('foobar.' + ext));
  });
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

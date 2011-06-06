/**
 *  class Promise.Joint
 *
 *  Provides way to guarntee that some particular code will be fired once all
 *  promises will become resolved.
 **/


var Promise = require('../promise');


/**
 *  new Promise.Joint([callback])
 *
 *  If `callback` was specified, passes it to [[Promise.Joint#done()]].
 **/
var Joint = module.exports = function Joint(callback) {
  // allow reate promise without new keyword
  if (!(this instanceof Joint)) {
    return new Joint(callback);
  }


  var self = this; // self-reference


  this.include = function include() {
    return self;
  };


  this.done = function done(callback) {
    return self;
  };


  this.wait = function wait() {
    return self;
  };


  this.reject = function reject(err) {
  };


  // register done callback if it was specified in the constructor
  if (callback) {
    this.done(callback);
  }
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

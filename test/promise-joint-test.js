var assert = require('assert'),
    vows = require('vows'),
    Promise = require('../lib/promise');


vows.describe('Promise.Joint').addBatch({
  "Joint instance": {
    topic: new Promise.Joint(),
    "response to include(), wait(), reject(), done()": function (joint) {
      assert.isFunction(joint.include);
      assert.isFunction(joint.wait);
      assert.isFunction(joint.reject);
      assert.isFunction(joint.done);
    }
  }
}).addBatch({
  "When joint resolved": {
    topic: function () {
      var p1 = Promise(),
          p2 = Promise();

      Promise.Joint(this.callback).include(p1, p2).wait();
      
      setTimeout(function () { p1.resolve(1); }, 200);
      setTimeout(function () { p2.resolve(2); }, 100);
    },
    "it passes arguments of each promise in order of their inclusion": function (err, r1, r2) {
      assert.equal(r1[0], 1);
      assert.equal(r2[0], 2);
    }
  }
}).addBatch({
  "When joint rejected": {
    topic: function () {
      var callback = this.callback,
          p1 = Promise(),
          p2 = Promise(),
          joint = Promise.Joint(function (err, r1, r2) {
            callback(null, err, r1, r2);  
          });

      joint.include(p1, p2).wait();

      setTimeout(function () { 
        p1.resolve(1);
        p2.resolve(2);
      }, 300);

      joint.reject(Error('Snap!'));
    },
    "it is resolved with error only": function (nil, err, r1, r2) {
      assert.instanceOf(err, Error);
      assert.isUndefined(r1);
      assert.isUndefined(r2);
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

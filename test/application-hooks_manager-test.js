var assert = require('assert'),
    vows = require('vows'),
    HooksManager = require('../lib/nodeca-lib/application/hooks_manager');


vows.describe('Application.HooksManager').addBatch({
  "Instance of HooksManager": {
    topic: new HooksManager(['a', 'b']),
    "adding an unknown hook cause error": function (hooks) {
      assert.throws(function () {
        hooks.add('c', 10, function () {});
      }, Error);
    },
    "adding a hook with handler which is not a funtion cause error": function (hooks) {
      assert.throws(function () {
        hooks.add('c', 10, null);
      }, Error);
    },
    "executing of an unknown hook cause an error": function (hooks) {
      assert.throws(function () {
        hooks.exec('c');
      }, Error);
    }
  },
  "When context is given": {
    topic: function () {
      var callback = this.callback,
          handler = function () { callback(null, this.foo); };

      HooksManager(['a'], {foo: 'bar'}).add('a', 10, handler).exec('a');
    },
    "hooks are fired with it as `this` context": function (nil, foo) {
      assert.equal(foo, 'bar');
    }
  },
  "When no context is given": {
    topic: function () {
      var callback = this.callback,
          handler = function () { callback(null, this.foo); };

      handler.foo = 'bar';

      HooksManager(['a']).add('a', 10, handler).exec('a');
    },
    "hooks are fired with handlers themselves as `this` context": function (nil, foo) {
      assert.equal(foo, 'bar');
    }
  },
  "When executing hook handlers": {
    topic: function () {
      var callback = this.callback,
          handler = function (name, foo) { callback(null, name, foo); };

      HooksManager(['a']).add('a', 10, handler).exec('a', 'bar');
    },
    "handlers receive same arguments as callee": function (nil, name, foo) {
      assert.equal(name, 'a');
      assert.equal(foo, 'bar');
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

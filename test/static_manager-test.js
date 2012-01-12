'use strict';


var assert = require('assert'),
    vows = require('vows'),
    VFS = require('../lib/nodeca-lib/vfs'),
    StaticManager = require('../lib/nodeca-lib/static_manager');


var FIXTURES = __dirname + '/fixtures/static_manager';


var testRealpathParser = function testRealpathParser(map) {
  var tests = {};
  
  Object.getOwnPropertyNames(map).forEach(function (realpath) {
    var path = map[realpath][0],
        actn = map[realpath][1],
        prio = map[realpath][2];

    tests[realpath + ' -> ' + actn + ' [' + prio + '] ' + path] = function () {
      var obj = StaticManager.parsePath(realpath);
      assert.strictEqual(obj.path, path);
      assert.strictEqual(obj.actn, actn);
      assert.strictEqual(obj.prio, prio);
    };
  });

  return tests;
};


vows.describe('StaticManager').addBatch({
  "compile()": {
    topic: function () {
      var sm = new StaticManager();

      sm.add(FIXTURES + '/pub_1')
        .add(FIXTURES + '/pub_2');

      return sm.compile();
    },
    "returns VFS instance": function (vfs) {
      assert.isFunction(vfs.constructor);
      assert.instanceOf(vfs, VFS);
    },
    "with real files only": function (vfs) {
      assert.isObject(vfs.get('/app.css'));
      assert.isObject(vfs.get('/mod/extra.css'));
      assert.isNull(vfs.get('/_app.css/baz.css'));
      assert.isNull(vfs.get('/app.css.05.before'));
      assert.isNull(vfs.get('/app.css.05.after'));
    },
    "and files are patched correctly": function (vfs) {
      var str = vfs.get('/app.css').buffer.toString().split('\n').join(' ');
      assert.match(str, new RegExp(
        'app\.css\.05\.before'    + '.*?' +
        'app\.css'                + '.*?' +
        'app\.css\.05\.after'     + '.*?' +
        '_app\.css/baz\.css'
      ));
    },
    "styl files are replaced with css": function (vfs) {
      assert.isObject(vfs.get('/demo.css'));
      assert.isNull(vfs.get('/demo.styl'));
    },
    "styl files are compield into css": function (vfs) {
      var str = vfs.get('/demo.css').buffer.toString().split('\n').join(' ');
      assert.match(str, /body.*{.*color.*}/);
    },
    "styl files works with vfs during it's compilation": function (vfs) {
      var str = vfs.get('/demo.css').buffer.toString().split('\n').join(' ');
      assert.match(str, /#000/);
    }
  },
  "When parsing file paths": testRealpathParser({
    'app.css':                ['app.css', 'override', null],
    'foobar/app.css':         ['foobar/app.css', 'override', null],
    'app.js.patch':           ['app.js', 'patch', null],
    'app.js.99.after':        ['app.js', 'after', 99],
    'app.js.99.before':       ['app.js', 'before', 99],
    '_app.styl/abc':          ['app.styl', 'after', null],
    'foobar/_app.styl/abc':   ['foobar/app.styl', 'after', null],
    'foo/_bar/_app.styl/abc': ['foo/_bar/app.styl', 'after', null],
    'foobar/_app.styl':       ['foobar/_app.styl', 'override', null]
  })
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

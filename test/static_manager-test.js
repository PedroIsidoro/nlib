var assert = require('assert'),
    vows = require('vows'),
    VFS = require('../lib/nodeca-lib/vfs'),
    StaticManager = require('../lib/nodeca-lib/static_manager');

vows.describe('StaticManager').addBatch({
  "compile()": {
    topic: function () {
      var sm = new StaticManager();

      sm.addPath(__dirname + '/fixtures/a')
        .addPath(__dirname + '/fixtures/b');

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
      assert.match(vfs.get('/app.css').toString(), new RegExp(
        '\s*/\* app.css.05.before \*/\s*' +
        '\s*/\* app.css \*/\s' +
        '\s*/\* app.css.05.after \*/\s*' +
        '\s*/\* _app.css/baz.css \*/\s*'
      ));
    },
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

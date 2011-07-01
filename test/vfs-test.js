var assert = require('assert'),
    vows = require('vows'),
    VFS = require('../lib/nodeca-lib/vfs');


vows.describe('VFS').addBatch({
  "Every object of path": {
    topic: function () {
      var vfs = new VFS();

      vfs.add('/a.txt', new Buffer(0));
      vfs.add('/b', new Buffer(0));

      return vfs;
    },
    "has data buffer": function (vfs) {
      assert.instanceOf(vfs.get("/a.txt").data, Buffer);
      assert.instanceOf(vfs.get("/b").data, Buffer);
    },
    "and mime type, found by it's extension": function (vfs) {
      assert.equal(vfs.get('/a.txt').mime, 'text/plain');
    },
    "or default mime type": function (vfs) {
      assert.equal(vfs.get('/b').mime, 'application/octet-stream');
    }
  },
  "When path exists": {
    topic: function () {
      var vfs = new VFS();
      vfs.add('/a', new Buffer(0));
      return vfs;
    },
    "add() same path throws Error": function (vfs) {
      assert.throws(function () { vfs.add('/a', new Buffer(0)); }, Error);
    }
  },
  "When path does not exists": {
    topic: new VFS(),
    "get() returns null": function (vfs) {
      assert.isNull(vfs.get('/not/found'));
    }
  },
  "When path is renamed": {
    topic: function () {
      var vfs = new VFS();

      vfs.add('/a', new Buffer('abc'));
      vfs.rename('/a', '/b');

      return vfs;
    },
    "old path is dropped": function (vfs) {
      assert.isNull(vfs.get('/a'));
    },
    "object become accessible by new path only": function (vfs) {
      assert.isObject(vfs.get('/b'));
    }
  },
  "When using plugin": {
    topic: function () {
      var vfs = new VFS();

      vfs.add('/a', new Buffer('abc'));
      vfs.plugin(function raiser(path, obj) {
        obj.dataUp = new Buffer(obj.data.toString().toUpperCase());
      });
      vfs.add('/b', new Buffer('def'));

      return vfs;
    },
    "plugin is called for all already registered paths": function (vfs) {
      assert.instanceOf(vfs.get("/a").dataUp, Buffer);
      assert.equal(vfs.get("/a").dataUp.toString(), 'ABC');
    },
    "plugin is called for all newly registered paths": function (vfs) {
      assert.instanceOf(vfs.get("/b").dataUp, Buffer);
      assert.equal(vfs.get("/b").dataUp.toString(), 'DEF');
    }
  },
  "When find()'ing paths": {
    topic: function () {
       var vfs = new VFS();

       vfs.add('/a.txt', new Buffer(0))
          .add('/b.txt', new Buffer(0))
          .add('/c.css', new Buffer(0));

       return vfs.find(/\.css$/);
    },
    "hash of {path => object} where path matches pattern returned": function (vfs) {
      assert.isUndefined(vfs['/a.txt']);
      assert.isUndefined(vfs['/b.txt']);
      assert.isObject(vfs['/c.css']);
    }
  },
  "Leading slash is not necessary": {
    topic: function () {
      return VFS().add('a').add('/b');
    },
    "neither when getting path": function (vfs) {
      assert.isObject(vfs.get('/a'));
      assert.isTrue(vfs.get('a') === vfs.get('/a'))
    },
    "nor when adding": function (vfs) {
      assert.isObject(vfs.get('b'));
      assert.isTrue(vfs.get('b') === vfs.get('/b'))
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

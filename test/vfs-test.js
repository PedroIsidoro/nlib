'use strict';


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
      assert.instanceOf(vfs.get("/a.txt").buffer, Buffer);
      assert.instanceOf(vfs.get("/b").buffer, Buffer);
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

      vfs.add('/a', new Buffer('abc'));
      vfs.get('/a').first = true;
      vfs.add('/a', new Buffer('123'));

      return vfs;
    },
    "add() overwrites old element": function (vfs) {
      assert.equal(vfs.get('a').buffer.toString(), '123');
      assert.isUndefined(vfs.get('a').first);
    }
  },
  "When path does not exists": {
    topic: new VFS(),
    "get() returns null": function (vfs) {
      assert.isNull(vfs.get('/not/found'));
    }
  },
  "When using plugin": {
    topic: function () {
      var vfs = new VFS();

      vfs.add('/a', new Buffer('abc'));
      vfs.plugin(function raiser(path, data) {
        data.buffer.upcase = new Buffer(data.buffer.toString().toUpperCase());
      });
      vfs.add('/b', new Buffer('def'));

      return vfs;
    },
    "plugin is called for all already registered paths": function (vfs) {
      assert.instanceOf(vfs.get("/a").buffer.upcase, Buffer);
      assert.equal(vfs.get("/a").buffer.upcase.toString(), 'ABC');
    },
    "plugin is called for all newly registered paths": function (vfs) {
      assert.instanceOf(vfs.get("/b").buffer.upcase, Buffer);
      assert.equal(vfs.get("/b").buffer.upcase.toString(), 'DEF');
    }
  },
  "When using plugin with pattern argument": {
    topic: function () {
      var vfs = new VFS();

      vfs.add('/a.foo', new Buffer('abc'));
      vfs.add('/b.txt', new Buffer('def'));

      vfs.plugin(/\.foo$/, function (path, data) {
        data.buffer.upcase = new Buffer(data.buffer.toString().toUpperCase());
      });

      return vfs;
    },
    "plugin is applied for matching paths only": function (vfs) {
      assert.instanceOf(vfs.get("/a.foo").buffer.upcase, Buffer);
      assert.isUndefined(vfs.get("/b.txt").buffer.upcase);
    }
  },
  "Leading slash is not necessary": {
    topic: function () {
      var buf = new Buffer(0);
      return VFS().add('a', buf).add('/b', buf);
    },
    "neither when getting path": function (vfs) {
      assert.isObject(vfs.get('/a'));
      assert.isTrue(vfs.get('a') === vfs.get('/a'))
    },
    "nor when adding": function (vfs) {
      assert.isObject(vfs.get('b'));
      assert.isTrue(vfs.get('b') === vfs.get('/b'))
    }
  },
  "#each()": {
    topic: function () {
      var vfs = new VFS();

      vfs.add('/a.txt', new Buffer(0))
         .add('/b.txt', new Buffer(0))
         .add('/c.css', new Buffer(0));

      return vfs;
    },
    "with pattern given": {
      topic: function (vfs) {
        var counts = [0, 0];

        vfs.each(/\.txt/, function () { counts[0]++; });
        vfs.each(/\.css$/, function () { counts[1]++; });

        return counts;
      },
      "iterates through each element of VFS matching given pattern": function (counts) {
        assert.equal(counts[0], 2);
        assert.equal(counts[1], 1);
      }
    },
    "without any pattern given": {
      topic: function (vfs) {
        var count = 0;

        vfs.each(function () { count++; });

        return count;
      },
      "iterates through ALL elements of VFS": function (count) {
        assert.equal(count, 3);
      }
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

/**
 *  class Settings.Store
 **/


'use strict';


// stdlib
var util = require('util');


// 3rd-party
var Promise = require('simple-promise'),
    _ = require('nodeca-lib').Underscore;


/**
 *  new Settings.Store()
 *
 *  Initiates store instance.
 *
 *  This is an abstract class. So you need to inherit it in order to make it
 *  your store work. In your store you must define following functions within
 *  `this.__` shared scope:
 *
 *  - preloader (Function): (optional) Backend of [[Settings.Store#preload]].
 *    Must be a function with 2 arguments `(env, callback)` if given.
 *  - getter (Function): Backend of [[Settings.Store#get]]
 *    Must be a function with 3 arguments `(keys, env, callback)`
 *  - setter (Function): Backend of [[Settings.Store#set]]
 *    Must be a function with 2 arguments `(data, env, callback)`
 *
 *
 *  TODO: describe preloader, setter and getter more preciously (what they
 *        should accept, waht they should return etc - returns object with
 *        value and strict fields and so on).
 *
 *
 *  ##### Example
 *
 *      var MyStore = function MyStore() {
 *        Settings.Store.call(this);
 *        // ...
 *        this.__.setter = funciton setter(data, env, callback) {
 *          // ...
 *        });
 *        // ...
 *      };
 *
 *      Settings.Store.adopts(MyStore);
 *
 *
 *  ##### See Also
 *
 *  - [[Settings#store]]
 *  - [[Settings.Store.adopts]]
 **/
var Store = module.exports = function Store() {
  // promise_id is uniq identifier generated for each store nd used to keep
  // preload promises of store per environment. think of it as of unique store
  // name within environment
  this.__ = {
    promise_id: 'store-promise-' + Math.floor(Math.random() * 10000000000).toString(),
    preloader:  function (env, callback) { callback(null); },
    setter:     function (data, env, callback) { callback(Error("Not implemented yet")); },
    getter:     function (keys, env, callback) { callback(Error("Not implemented yet")); }
  };
};


/**
 *  Settings.Store#get(key, env, callback) -> Void
 *  Settings.Store#get(key, callback) -> Void
 *  - key (String|Array)
 *  - env (Object): (optional) Default: empty object.
 *  - callback (Function)
 *
 *  Calls underlying getter to get value of given key(s). For each key
 *  underlying `getter` returns a `data` object that consist of:
 *
 *  - value (Mixed)
 *  - strict (Boolean)
 *
 *
 *  ##### When `key` given as a String
 *
 *  Will fire `callback` with `data` object for given key only.
 *
 *      store.get('foobar', function (err, data) {
 *        if (data.value && data.strict) {
 *          // ...
 *        }
 *      });
 *
 *
 *  ##### When `key` given as an Array
 *
 *  Will fire `callback` with hash of `key => data` pairs for the keys.
 *
 *      store.get(['foobar'], function (err, data) {
 *        if (data.foobar.value && data.foobar.strict) {
 *          // ...
 *        }
 *      });
 **/
Store.prototype.get = function get(key, env, callback) {
  var self = this;

  if (undefined === callback) {
    callback = env;
    env = {};
  }

  self.preload(env, function (err) {
    var single = false;
  
    if (err) {
      callback(err);
      return;
    }

    if (!Array.isArray(key)) {
      single = true;
      key = [key];
    }

    self.__.getter.call(self, key, env, function (err, data) {
      if (err) {
        callback(err);
        return;
      }

      // preserve defaults if getter returned nothing
      _.each(data, function (val, key) {
        if (!val || undefined === val.value) {
          data[key] = {value: self.getDefaultsFor(key), strict: false};
        }
      });

      if (single) {
        callback(null, data[key]);
        return;
      }

      callback(null, data);
    });
  });
};


/**
 *  Settings.Store#set(data, env, callback) -> Void
 *  Settings.Store#set(data, callback) -> Void
 *  - data (Object): key-value pairs to be set
 *  - env (Object): (optional) Default: empty object.
 *  - callback (Function)
 *
 *  Calls underlying setter to set values according to the given `data` map.
 *  Each key of `data` is a setting name (key) and value is an object with
 *  fields:
 *
 *  - value (Mixed)
 *  - strict (Boolean)
 *
 *
 *  ##### Example
 *
 *      var data = 
 *      store.set({foobar: {value: true, strict:false}}, function (err) {
 *        if (err) {
 *          // ...
 *        }
 *      });
 **/
Store.prototype.set = function set(data, env, callback) {
  var self = this;

  if (undefined === callback) {
    callback = env;
    env = {};
  }

  self.preload(env, function (err) {
    if (err) {
      callback(err);
      return;
    }

    self.__.setter.call(self, data, env, callback);
  });
};


/**
 *  Settings.Store#preload(env, callback) -> Void
 *  Settings.Store#preload(callback) -> Void
 *  - env (Object): (optional) Default: empty object.
 *  - callback (Function)
 *
 *  Calls underlying `preloader` for `env` if it was not preloaded before.
 **/
Store.prototype.preload = function preload(env, callback) {
  // NOTICE:
  // as preloader is an asynchronous function and it's exeuction may be delayed
  // we use Promise to guarantee, that `preloader` won't be called twice.

  if (env[this.promise_id]) {
    env[this.promise_id].done(callback);
    return;
  }

  env[this.promise_id] = new Promise(callback);
  this.__.preloader.call(this, env, env[this.promise_id].resolve);
};


/**
 *  Settings.Store#keys -> Array
 *
 *  Array of all settign keys, the store knows about.
 *
 *  ** WARNING **
 *  This property is a placeholder only. When `store` is being added to the
 *  [[Settings]] manager it receives real `keys` getter.
 **/
Store.prototype.keys = [];


/**
 *  Settings.Store#getDefaultsFor(key) -> Mixed
 *
 *  Returns default value for given setting key.
 *
 *  ** WARNING **
 *  This property is a placeholder only. When `store` is being added to the
 *  [[Settings]] manager it receives real function that returns values.
 **/
Store.prototype.getDefaultsFor = function (key) {};


/**
 *  Settings.Store.adopts(child) -> Store
 *
 *  Returns adopted `child`. Wrapper over `util.inherit` that assigns `adopts`
 *  method to the child class as well.
 *
 *      Settings.Store.adopts(AppStore);
 *      AppStore.adopts(MyStore);
 *
 *  As `adopts` returns `child`, above can be written in one line:
 *
 *      Settings.Store.adopts(AppStore).adopts(MyStore);
 **/
Store.adopts = function adopts(child) {
  util.inherits(child, this);
  child.adopts = this.adopts;
  return child;
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

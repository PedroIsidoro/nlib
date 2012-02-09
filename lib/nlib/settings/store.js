/**
 *  class Settings.Store
 **/


'use strict';


// stdlib
var util = require('util');


// 3rd-party
var Promise = require('simple-promise'),
    _ = require('underscore');


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
 *  See corresponding public API methods [[Settings.Store#preload]],
 *  [[Settings.Store#get]] and [[Settings.Store#set]] for informations about
 *  `preloader`, `getter` and `setter`.
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
    setter:     function (data, env, callback) { callback(new Error("Not implemented yet")); },
    getter:     function (keys, env, callback) { callback(new Error("Not implemented yet")); }
  };
};


/**
 *  Settings.Store#get(key[, env = {}], callback) -> Void
 *  - key (String|Array)
 *  - env (Object): context
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
 *
 *
 *  #### Underlying getter
 *
 *  Underlying getter (see [[Settings.Store]] constructor) must be a function
 *  with signature:
 *
 *      function getter(keys, env, callback);
 *
 *  and should accept an array of `keys`, e.g. `['is_frst_gump', 'can_run']`,
 *  `env` - an object preloaded by [[Settings.Store#preload]] and a `callback`.
 *
 *  It should fire `callback` with arguments `err, data`, where `err` is an
 *  error if any, and `data` is an object of `key => val` pairs and each
 *  `val` is a structure with at least `value` field, e.g.:
 *
 *      var getter = function (keys, env, callback) {
 *        var results = {};
 *
 *        keys.forEach(function (k) {
 *          results[k] = {value: !!(Date.now()%2)};
 *        });
 *
 *        callback(null, results);
 *      };
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

    self.__.getter(key, env, function (err, data) {
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
 *  Settings.Store#set(data[, env = {}], callback) -> Void
 *  - data (Object): key-value pairs to be set
 *  - env (Object): context
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
 *
 *
 *  #### Underlying setter
 *
 *  Underlying setter (see [[Settings.Store]] constructor) must be a function
 *  with signature:
 *
 *      function setter(data, env, callback);
 *
 *  and should accept an hash with `data`, e.g.
 *  `{is_frst_gump: true, can_run: true}`, `env` - an object preloaded
 *  by [[Settings.Store#preload]] and a `callback`.
 *
 *  It should fire `callback` with only one argument `err`, where `err` is an
 *  error if any, e.g.:
 *
 *      var setter = function (data, env, callback) {
 *        callback(Error("Not implemented yet");
 *      };
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

    self.__.setter(data, env, callback);
  });
};


/**
 *  Settings.Store#preload([env = {}], callback) -> Void
 *  - env (Object): context
 *  - callback (Function)
 *
 *  Calls underlying `preloader` for `env` if it was not preloaded before.
 *
 *
 *  #### Underlying preloader
 *
 *  Underlying preloader (see [[Settings.Store]] constructor) must be a function
 *  with signature:
 *
 *      function preloader(env, callback);
 *
 *  This method is being called once for each `env` before execution of `get` or
 *  `set` methods and prepares `env` to be used by underlying `getter` and
 *  `setter`.
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
  this.__.preloader(env, env[this.promise_id].resolve);
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

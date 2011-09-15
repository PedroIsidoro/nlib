/**
 *  class Settings.Store
 **/


'use strict';


// 3rd-party
var Promise = require('simple-promise');


var is_valid_function = function validates_is_function(func, argn) {
  return ('function' === typeof func && argn == func.length);
};


var env_has_store = function env_has_store(store, env) {
  var result = false;

  if (undefined === env.__stores) {
    env.__stores = [];
    return result;
  }

  $$.each(env.__stores, function (i, s) {
    if (store === s) {
      result = true;
      return false; // stop iterator
    }
  });

  return result;
};


var env_add_store = function env_add_store(store, env) {
  if (undefined === env.__stores) {
    env.__stores = [];
  }

  env.__stores.push(store);
};


/**
 *  new Settings.Store([schema = {}])
 *  - schema (Object)
 *
 *  Initiates store with given schema hash, which consist of following values:
 *
 *    - preloader (Function): executed at very first place and guarantees that
 *      store will be prepare. Will be called with `(req, next)` arguments.
 *    - getter (Function): underlying handler of [[Settings.Store#get]]
 *    - setter (Function): underlying handler of [[Settings.Store#set]]
 *
 *  **NOTICE** This constructor is not supposed to be called directly, as
 *  `getter` and `setter` should be binded to the specific environment object
 *  (e.g. request). See [[Settings#getStore]] instead.
 *
 *  ##### `getter` signature
 *
 *      function getter(key, callback) {
 *        var env     = this,   // environment object
 *            err     = null,   // error
 *            data    = {
 *              value:      null,   // value
 *              strict:     false,  // whenever value is strict (should be ANDed)
 *              inherited:  false   // whenever value is inherited
 *            };
 *        callback(err, data);
 *      };
 *
 *  ##### `setter` signature
 *
 *      function setter(key, data, callback) {
 *        var env     = this,   // environment object
 *            err     = null;   // error
 *
 *        data.value;     // value
 *        data.strict;    // whenever value is strict (should be ANDed)
 *        data.inherited; // whenever value is inherited
 *
 *        callback(err);
 *      };
 *
 *  ##### See Also
 *
 *  - [[Settings#getStore]]
 *  - [[Settings#setStoreSchema]]
 **/
var Store = module.exports = function Store(schema = {}) {
  // validate schema functions
  $$.each({ preloader: 2, getter: 2, setter: 3 }, function (func, argn) {
    if (!is_valid_function(schema[func], argn)) {
      throw new Error(func + " must be a function and accept " + argn + " arguments");
    }
  });

  this.__ = {schema: schema};
};


/**
 *  Settings.Store#get(key, env, callback) -> Void
 *
 *  Proxies call to `getter`.
 **/
Store.prototype.get = function get(key, env, callback) {
  if (undefined === callback) {
    callback = env;
    env = {};
  }

  this.__.getter.call(env, env, callback);
};


/**
 *  Settings.Store#set(key, env, callback) -> Void
 *
 *  Proxies call to `setter`.
 **/
Store.prototype.set = function set(key, val, env, callback) {
  if (undefined === callback) {
    callback = env;
    env = {};
  }

  this.__.setter.call(env, key, val, callback);
};


/**
 *  Settings.Store#preload(env, callback) -> Void
 *
 *  Preloads `env`ironment with `preloader`.
 **/
Store.prototype.preload = function preload(env, callback) {
  if (env_has_store(this, env)) {
    callback();
    return;
  }

  this.__.schema.preloader.call(env, function (err) {
    if (err) {
      callback(err);
      return;
    }

    env_add_store(this, env);
    callback();
  });
};


/**
 *  Settings.Store#getAllValues(env, callback) -> Void
 *
 *  Collects values of all keys for given store and fires `callback(err, data)`,
 *  where `data` is a hash of `key` => `setting`, and `setting` is a has with:
 *  `value`, `strict`, `inherited` keys.
 **/
Store.prototype.getAllValues = function getAllValues(env, callback) {
  var self = this,
      values = {},
      all_done = new Promise.Joint();

  if (undefined === callback) {
    callback = env;
    env = {};
  }

  // grab all keys
  this.keys.forEach(function (key) {
    var promise = all_done.promise();

    self.get(key, env, function(err, data) {
      if (err) {
        all_done.reject(err);
        return;
      }

      values[key] = data;
      promise.resolve();
    });
  });

  // wait for all values and fire resulting callback
  all_done.wait().done(function (err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, values);
  });
};


/**
 *  Settings.Store#keys -> Array
 *
 *  Array of all settign keys, the store knows about.
 **/
Store.prototype.keys = [];


// vim:ts=2:sw=2

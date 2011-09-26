/**
 *  class Settings.Store
 **/


'use strict';


// stdlib
var util = require('util');


// 3rd-party
var Promise = require('simple-promise');


// returns shared object of environment
var get_shared = function get_shared(env) {
  if (undefined === env.__) {
    env.__ = {
      stores: []
    };
  }

  return env.__;
};


// returns true whenever store was saved in environment
var has_store = function has_store(store, env) {
  var result = false;

  $$.each(get_shared(env).stores, function (i, s) {
    if (store === s) {
      result = true;
      return false; // stop iterator
    }
  });

  return result;
};


// saves store in the environment
var add_store = function add_store(store, env) {
  if (!has_store(store, env)) {
    get_shared(env).stores.push(store);
  }
};


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
 *    Must be a function with 2 arguments `(env, callback)` if given
 *  - getter (Function): Backend of [[Settings.Store#get]]
 *    Must be a function with 3 arguments `(keys, env, callback)`
 *  - setter (Function): Backend of [[Settings.Store#set]]
 *    Must be a function with 2 arguments `(data, env, callback)`
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
var Store = module.exports = function Store(schema) {
  this.__ = {
    preloader:  function (env, callback) { callback(null); },
    setter:     function (data, env, callback) { callback(Error("Not implemented yet")); },
    getter:     function (keys, env, callback) { callback(Error("Not implemented yet")); }
  };
};


/**
 *  Settings.Store#get(key, env, callback) -> Void
 *
 *  TODO: DESCRIPTION
 **/
Store.prototype.get = function get(key, env, callback) {
  var single = false;
  
  if (undefined === callback) {
    callback = env;
    env = {};
  }

  if (!Array.isArray(key)) {
    single = true;
    key = [key];
  }

  this.__.getter.call(this, key, env, function (err, data) {
    if (err) {
      callback(err);
      return;
    }

    if (single) {
      callback(null, data[key]);
      return;
    }

    callback(null, data);
  });
};


/**
 *  Settings.Store#set(data, env, callback) -> Void
 *
 *  TODO: DESCRIPTION
 **/
Store.prototype.set = function set(data, env, callback) {
  if (undefined === callback) {
    callback = env;
    env = {};
  }

  this.__.setter.call(this, data, env, callback);
};


/**
 *  Settings.Store#preload(env, callback) -> Void
 *
 *  TODO: DESCRIPTION
 **/
Store.prototype.preload = function preload(env, callback) {
  // TODO: replace with promises
  if (has_store(this, env)) {
    callback();
    return;
  }

  this.__.preloader.call(this, env, function (err) {
    if (err) {
      callback(err);
      return;
    }

    add_store(this, env);
    callback();
  });
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

/**
 *  class Settings.Store
 **/


'use strict';


// 3rd-party
var Promise = require('simple-promise');


// signatures of functions of schema in form of `key: args_amount`
// e.g. if `foobar` is required and expected to be something like
// `function (a, b, c) { ... }` then it should be listed here as:
// `foobar: {required: true, argn: 3}`
var SIGNATURES = {
  preloader:  {required: false, argn: 2},
  getter:     {required: true,  argn: 3},
  setter:     {required: true,  argn: 3}
};


// is_valid_function(func, argn)
// returns true whenever `func` is a function,
// that accepts `argn` amount of args
var is_valid_function = function is_valid_function(func, argn) {
  return ('function' === typeof func && argn == func.length);
};


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
 *  new Settings.Store([schema = {}])
 *  - schema (Object)
 *
 *  ** TODO: DESCRIPTION IS OBSOLETE NEEDS REVIEW **
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
var Store = module.exports = function Store(schema) {
  // validate schema functions
  $$.each(SIGNATURES, function (func, opts) {
    if (opts.required && undefined === schema[func]) {
      throw new Error(func + " is required.");
    }

    if (undefined !== schema[func] && false === is_valid_function(schema[func], opts.argn)) {
      throw new Error(func + " must be a function and accept " + opts.argn + " argument(s)");
    }
  });

  // store shared object
  this.__ = schema;
};


/**
 *  Settings.Store#get(key, env, callback) -> Void
 *
 *  ** TODO: DESCRIPTION IS OBSOLETE NEEDS REVIEW **
 *
 *  Proxies call to `getter`.
 **/
Store.prototype.get = function get(key, env, callback) {
  if (undefined === callback) {
    callback = env;
    env = {};
  }

  // TODO: make get() wok with multi-keys, single-key

  this.__.getter.call(this, key, env, callback);
};


/**
 *  Settings.Store#set(key, env, callback) -> Void
 *
 *  ** TODO: DESCRIPTION IS OBSOLETE NEEDS REVIEW **
 *
 *  Proxies call to `setter`.
 **/
Store.prototype.set = function set(key, val, env, callback) {
  if (undefined === callback) {
    callback = env;
    env = {};
  }

  // TODO: make set() wok with multi-keys, single-key

  this.__.setter.call(this, key, val, env, callback);
};


/**
 *  Settings.Store#preload(env, callback) -> Void
 *
 *  ** TODO: DESCRIPTION IS OBSOLETE NEEDS REVIEW **
 *
 *  Preloads `env`ironment with `preloader`.
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
 *  Settings.Store#getAllValues(env, callback) -> Void
 *
 *  ** TODO: DESCRIPTION IS OBSOLETE NEEDS REVIEW **
 *
 *  Collects values of all keys for given store and fires `callback(err, data)`,
 *  where `data` is a hash of `key` => `setting`, and `setting` is a has with:
 *  `value`, `strict`, `inherited` keys.
 **/
Store.prototype.getAllValues = function getAllValues(env, callback) {
  if (undefined === callback) {
    // getAllValues(function ( ... ) { ... });
    callback = env;
    env = {};
  }

  this.__.getter(this.keys, env, callback);
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


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

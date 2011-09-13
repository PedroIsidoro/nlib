/**
 *  class Settings.Store
 **/


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
  throw Error("Not implemented yet");
};


/**
 *  Settings.Store#get(key, env, callback) -> Void
 *
 *  Proxies call to `getter`.
 **/
Store.prototype.get = function get(key, env, callback) {
  callback(Error("Not implemented yet"));
};


/**
 *  Settings.Store#set(key, env, callback) -> Void
 *
 *  Proxies call to `setter`.
 **/
Store.prototype.set = function set(key, env, callback) {
  callback(Error("Not implemented yet"));
};


/**
 *  Settings.Store#preload(env, callback) -> Void
 *
 *  Preloads `env`ironment with `preloader`.
 **/
Store.prototype.preload = function preload(env, callback) {
  callback(Error("Not implemented yet"));
};


/**
 *  Settings.Store#getAllValues(env, callback) -> Void
 *
 *  Collects values of all keys for given store and fires `callback(err, data)`,
 *  where `data` is a hash of `key` => `setting`, and `setting` is a has with:
 *  `value`, `strict`, `inherited` keys.
 **/
Store.prototype.getAllValues = function getAllValues(env, callback) {
  callback(Error("Not implemented yet"));
};


/**
 *  Settings.Store#keys -> Array
 *
 *  Array of all settign keys, the store knows about.
 **/
Store.prototype.keys = [];


// vim:ts=2:sw=2

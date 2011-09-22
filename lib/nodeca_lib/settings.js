/** belongs to: Application
 *  class Settings
 *
 *  Provides class that reads and keeps info about all application settings
 **/


'use strict';


// 3rd-party
var Promise = require('simple-promise');


// internal
var Store = require('./settings/store');


/**
 *  new Settings()
 **/
var Settings = module.exports = function Settings() {
  if (!(this instanceof Settings)) {
    return new Settings();
  }


  var data = {},    // contains storages and definitions of settings
      stores = {},  // map of `key` => [store, store, ...]
      get_data;     // wrapper to get store&definitions hash from data


  // returns hash (creates if needed) for given storename.
  get_data = function get_data(name) {
    if (undefined === data[name]) {
      data[name] = {store: undefined, definitions: {}};
    }

    return data[name];
  };


  /**
   *  Settings#get(key, env, callback) -> Void
   *
   *  Finds given key in all available stores and fires `callback(err, val)`
   *  with aggregated (combined from different stores) value.
   **/
  this.get(key, env, callback) {
    if (undefined === stores[key]) {
      callback(Error("Unknown key=" + key + " specified"));
      return;
    }

    var self = this,
        all_done = new Promise.Joint();

    // query key in each store
    stores[key].forEach(function (name) {
      var key_promise = all_done.promise();

      self.store(name).get(key, env, function (err, data) {
        if (err) {
          all_done.reject(err);
          return;
        }

        key_promise.resolve(data);
      });
    });

    // wait for results from all stores
    all_done.wait().done(function (err) {
      var result, args;

      if (err) {
        callback(err);
        return;
      }

      args = Array.prototype.slice.call(arguments, 1);

      // initial result is TRUE if we have at least one `OR true`
      result = 0 < $$.select(args, function (i, data) { return !data.strict && data.value; }).length;
     
      // now apply all AND values
      $$.select(args, function (i, data) { return !!data.strict; }).forEach(function (data) {
        result = result && data.value;
      });

      callback(null, result);
    });
  };
  
  
  /**
   *  Settings#store(name[, options]) -> Settings.Store
   *
   *  [[Settings.Store]] accessor.
   *
   *  ##### Throws Error
   *
   *  - When store with `name` not found.
   *  - When adding store with duplicate name
   *
   *  ##### See Also
   *
   *  - [[Settings.Store]] constructor for `options` description
   **/
  this.store(name, options) {
    var data = get_data(name);

    if (undefined !== options) {
      if (undefined !== data.store) {
        throw new Error("Duplicate store name");
      }
      data.store = new Store(options);

      // reassign keys getter of store
      data.store.__defineGetter__('keys', function get_keys() {
        return Object.keys(data.definitions);
      });
    }

    if (undefined === data.store) {
      throw new Error("Store not found");
    }

    return data.store
  };
  
  
  /**
   *  Settings#definition(store, key[, options]) -> Object
   *
   *  ##### Throws Error
   *
   *  - When definition with `name` not found.
   *  - When adding definition with duplicate name
   **/
  this.definition(store, key, options) {
    var data = get_data(store).definitions;

    if (undefined !== options) {
      if (undefined !== data[key]) {
        throw new Error("Duplicate definition");
      }

      if (undefined === stores[key]) {
        stores[key] = [];
      }

      data[key] = options;
      stores[key].push(store);
    }

    if (undefined === data[key]) {
      throw new Error("Definition not found");
    }

    return data[key];
  };
};


// vim:ts=2:sw=2
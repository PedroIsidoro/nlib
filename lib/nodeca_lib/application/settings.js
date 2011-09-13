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
   *  Finds given key in all available stores and fires `callback(err, val,
   *  strict)` with aggregated (combined from different stores) value.
   **/
  this.get(key, env, callback) {
    if (undefined === stores[key]) {
      callback(Error("Unknown key=" + key + " specified"));
      return;
    }

    callback(Error("Not implemented yet"));
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

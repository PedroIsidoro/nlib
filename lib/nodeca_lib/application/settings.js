/** belongs to: Application
 *  class Settings
 *
 *  Provides class that reads and keeps info about all application settings
 **/


var Store = require('./settings/store');


/**
 *  Settings#get(key, env, callback) -> Void
 *
 *  Finds given key in all available stores and fires `callback(err, val,
 *  strict)` with aggregated (combined from different stores) value.
 **/
Settings.prototype.get(key, env, callback) {
  callback(Error("Not implemented yet"));
};


/**
 *  Settings#store(name[, options]) -> Settings.Store
 *
 *  [[Settings.Store]] accessor.
 *
 *  ##### Throws Error
 *
 *  - When permission with `name` not found.
 *  - When adding permission with duplicate name
 *
 *  ##### See Also
 *
 *  - [[Settings.Store]] constructor for `options` description
 **/
Settings.prototype.store(name, options) {
  throw new Error("Not implemented yet");
};


/**
 *  Settings#definition(store, key[, options]) -> Object
 *
 *  ##### Throws Error
 *
 *  - When permission with `name` not found.
 *  - When adding permission with duplicate name
 **/
Settings.prototype.definition(store, key, options) {

};


// vim:ts=2:sw=2

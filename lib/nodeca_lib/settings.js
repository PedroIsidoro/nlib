/**
 *  class Settings
 *
 *  Provides class that reads and keeps info about all application settings
 **/


'use strict';


// 3rd-party
var Promise = require('simple-promise'),
    _ = require('nodeca-lib').Underscore;


// default `default` values for each known type
var DEFAULTS = {
  'boolean':      false,
  'number':       0,
  'string':       '',
  'text':         '',
  'wysiwyg':      ''
  /* reserved for the future
  'dropdown':     [],
  'combobox':     [],
  'usergroups':   [],
  'users':        [],
  'forums':       []
  */
};


// list of known types built from keys of defaults
var KNOWN_TYPES = _(Object.keys(DEFAULTS));


// valid keys for setting definition. we have only one required field - type,
// so no need for separationg or extra validations at least for now.
var VALID_KEYS = _([
  'extends', 'type', 'values', 'default', 'group', 'title', 'description',
  'priority', 'before_show', 'before_save', 'validators'
]);


/**
 *  new Settings()
 **/
var Settings = module.exports = function Settings() {
  if (!(this instanceof Settings)) {
    return new Settings();
  }


  var data = {},        // contains stores and definitions of settings
      key2stores = {},  // map of `key` => [store, store, ...]
      get_data,         // wrapper to get store&definitions hash from data
      extended_definition,  // tries to extend definition with base one
      standard_definition,  // process base definition
      verify_options;       // verifies options


  // returns hash (creates if needed) for given storename.
  get_data = function get_data(name) {
    if (undefined === data[name]) {
      data[name] = {store: undefined, definitions: {}};
    }

    return data[name];
  };


  verify_options = function verify_options(options) {
    // filter out all valid keys. get first invalid one if any
    var unknown_key = _.keys(options).reject(function (k) {
      return VALID_KEYS.include(k);
    }).shift();

    // at least one key is invalid
    if (unknown_key) {
      throw Error("Unknown setting key=" + unknown_key.sift());
    }

    // invalid type
    if (!KNOWN_TYPES.include(options.type)) {
      throw Error("Unknown setting type=" + options.type);
    }
  };


  standard_definition = function standard_definition(key, options) {
    var has_base_definition = key2stores[key].any(function (store) {
      return !data[name].definitions[key].extend;
    });

    if (has_base_definition) {
      throw Error("Duplicate base definition of setting key=" + key);
    }

    verify_options(options);

    // make sure we have default value
    if (undefined === options.default) {
      options.default = DEFAULTS[options.type];
    }

    // make sure we have title
    if (undefined === options.title) {
      options.title = _.titleize(key.replace(/[-_]+/, ' '));
    }

    _(key2stores[key]).select(function (store) {
      return !!data[store].definitions[key].extend
    }).each(function (store) {
      _.defaults(data[store].definitions[key], options);
    });
  };


  extended_definition = function extended_definition(key, options) {
    var base = _(key2stores[key]).detect(function (name) {
      return !data[name].definitions[key].extend;
    });

    if (base) {
      _.defaults(options, data[base].definitions[key]);
      verify_options(options);
    }
  };


  /**
   *  Settings#get(key, env, callback) -> Void
   *
   *  Finds given key in all available stores and fires `callback(err, val)`
   *  with aggregated (combined from different stores) value.
   *
   *
   *  ##### Aggregated Value Calculation
   *
   *  Result depends on aggregation rules (OR/AND). We don't use scopes.
   *  OR rules are calculated first, then AND rules applied over.
   *
   *  AND values - are those flagged as `strict` (or `restrictive`).
   **/
  this.get(key, env, callback) {
    if (undefined === key2stores[key]) {
      callback(Error("Unknown key=" + key + " specified"));
      return;
    }

    // TODO: Handle non-bool vales properly

    var self = this,
        all_done = new Promise.Joint();

    // query key in each store
    key2stores[key].forEach(function (name) {
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

      args = _(Array.prototype.slice.call(arguments, 1));

      // first, seek if we have at least one `OR true`
      result = args.any(function (d) { return !d.strict && d.value; });

      // make sure all strict settigns are true
      args = args.select(function (d) { return !!d.strict; });
      result = result && args.all(function (d) { return !!d.value });
     
      callback(null, result);
    });
  };
  
  
  /**
   *  Settings#store(name[, store]) -> Settings.Store
   *  - store (Settings.Store)
   *
   *  When `store` given adds it and returns back.
   *  Otherwise returns previously added store.
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
  this.store(name, store) {
    var data = get_data(name);

    if (undefined !== store) {
      // Scenario (setter): store(name, store)
      if (undefined !== data.store) {
        throw new Error("Duplicate store name");
      }

      // set store instance
      data.store = store;

      // assign keys getter of store
      data.store.__defineGetter__('keys', function get_keys() {
        return _.keys(data.definitions);
      });

      // expose defaults to store
      data.store.getDefaultsFor = function getDefaultsFor(key) {
        return data.definitions[key].default;
      };
    } else if (undefined === data.store) {
      // Scenario (getter): store(name)
      throw new Error("Store not found");
    }

    return data.store
  };
  
  
  /**
   *  Settings#definition(store, key[, options]) -> Object
   *
   *  When `options` given, adds definition of the setting `key` under `store`
   *  name. Otherwise returns previously added `options` of the `key`.
   *
   *  ##### Throws Error
   *
   *  - When definition with `name` not found.
   *  - When adding definition with duplicate name
   **/
  this.definition(store, key, options) {
    var data = get_data(store).definitions;

    if (undefined !== options) {
      // Scenario (setter): definition(store, key, options)
      if (undefined !== data[key]) {
        throw new Error("Duplicate definition");
      }

      if (undefined === key2stores[key]) {
        key2stores[key] = [];
      }

      if (options.extend) {
        extended_definition(key, options);
      } else {
        standard_definition(key, options);
      }

      data[key] = options;
      key2stores[key].push(store);
    } else if (undefined === data[key]) {
      // Scenario (getter): definition(store, key)
      throw new Error("Definition not found");
    }

    return data[key];
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

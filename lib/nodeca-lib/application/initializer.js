//  Generally we can separate three main steps of init:
//
//    * warm up
//      - bootstrap main application
//    * preparation stages (see below)
//    * after init
//      - mount downstream applications into main application's router
//      - compile static files storage
//
//  The main and most complex part of above is preparations stages. It consist
//  of different stages. After each stage an associated hook is being fired.
//  Each stage takes place ONLY after previous stage and it's post-finish hooks
//  was finished. So it's a waterfall of: stage_a -> hook_a -> stage_b -> ...
//
//  These are preparations tages and their associated hooks
//
//    * load subapps (hook: subapps-loaded)
//      - require corresponding application module
//      - and bootstrap it
//    * load schemas (hook: schemas-loaded)
//      - load files under {app.dirname}/app/models directory
//      - register found Mongoose schemas
//      - register found non-schemas as models directly
//    * load models (hook: models-loaded)
//      - compile all Mongoose schemas into models
//      - register compiled models
//    * load controllers (hook: controllers-loaded)
//      - load files under {app.dirname}/app/controllers directory
//      - register found controllers
//      - propose each controller to (!) main app's dispatcher (!)
//    * load routes (hook: routes-loaded)
//      - configure each app's router
//      - propose to each router main app's dispatcher
//    * load static files (hook: init-complete)
//      - create and fill AssetsManager with /public directories


'use strict';


var Promise = require('../promise'),
    $$ = require('../utilities');


// provides easy way to stack stages in desired order
var create_stack = function create_stack(context) {
  return {
    queue: function queue(handler) {},
    run: function run(callback) {}
  };
};


// make sure to call this function with `this` context of callee
// e.g.:  create_stage_joint.call(this, 'foo', next);
var create_stage_joint = function (hookName, callback) {
  var hooks = this.hooks;

  return new Promise.Joint(function (err) {
    // joint was rejected
    if (err) {
      callback(err);
      return;
    }

    hooks.exec(hookName, function (err) {
      // one of hook handlers failed
      if (err) {
        callback(err);
        return;
      }

      // notify that stage is finished
      callback();
    });
  });
};


// expose module-function.
// private objects should be "binded" to the function:
//
// init.bind({
//   hooks: hooks
//   router: router
// })(function (err) {
//   if (err) {
//     // initializer failed
//   }
//
//   // otherwise callback is called with "extended" context:
//   this.hooks === hooks; // old references are kept
//   this.router; // new references are present as well
// });
module.exports = function init(self, appConfig, callback) {
  var context = this;

  // propose merged config of application to the init context
  context.config = $$.merge(self.config, appConfig);

  self.getLogger(function (err, logger) {
    if (err) {
      callback(err);
      return;
    }

    // propose initialized logger to the init context
    context.logger = logger;

    self.bootstrap(function (err) {
      if (err) {
        callback(err);
        return;
      }

      // stack and run all stages
      create_stack(context)
        .queue(load_subapps)
        .queue(load_schemas)
        .queue(load_models)
        .queue(load_controllers)
        .queue(load_routes)
        .queue(load_static_storage)
        .run(callback);
    });
  });
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////

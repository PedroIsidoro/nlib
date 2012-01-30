'use strict';


// stdlib
var Fs = require('fs');
var Path = require('path');


// 3rd-party
var Async = require('async');
var Underground = require('underground');


// internal
var Application = require('./../application');
var Hooker = require('./../support/hooker');


/**
 *  nodeca
 *
 *  Nodeca global object
 **/
var nodeca = global.nodeca = {
  hooks: {},
  models: {},
  runtime: {}
};


function find_model(name) {
  throw "Not implemented yet";
}


/**
 *  nodeca.hooks.models
 **/
nodeca.hooks.models = new Hooker();


/**
 *  nodeca.hooks.init
 **/
nodeca.hooks.init = new Hooker();


/**
 *  nodeca.hooks.models.on(name, priority, hook) -> Void
 **/
nodeca.hooks.models.on = function (name, priority, hook) {
  nodeca.hooks.models.after(name, priority, function (callback) {
    hook(find_model(name));
    callback();
  });
};


/**
 *  nodeca.hooks.init.on(name, priority, hook) -> Void
 **/
nodeca.hooks.init.on = function (name, priority, hook) {
  nodeca.hooks.init.after(name, priority, hook);
};


/**
 *  nodeca.runtime
 **/
nodeca.runtime = {};


////////////////////////////////////////////////////////////////////////////////


function init_config(next) {
  next(new Error("Not implemented yet"));
}


function init_logger(next) {
  next(new Error("Not implemented yet"));
}


function load_apps(mainApp, next) {
  next(new Error("Not implemented yet"));
}


function init_apps(next) {
  next(new Error("Not implemented yet"));
}


function init_models(next) {
  next(new Error("Not implemented yet"));
}


function init_settings(next) {
  next(new Error("Not implemented yet"));
}


function init_translations(next) {
  next(new Error("Not implemented yet"));
}


function init_bundler(next) {
  next(new Error("Not implemented yet"));
}


function init_router(next) {
  next(new Error("Not implemented yet"));
}


////////////////////////////////////////////////////////////////////////////////


// expose module-function.
module.exports = function initialize(main, callback) {
  var stage = function (name, fn) {
    return Async.apply(nodeca.hooks.init.run, name, fn);
  };

  Async.series([
    // load all apps
    Async.apply(load_apps, main),

    // run stages
    stage('config',       init_config),
    stage('logger',       init_logger),
    stage('apps',         init_apps),
    stage('models',       init_models),
    stage('settings',     init_settings),
    stage('translations', init_translations),
    stage('bundler',      init_bundler),
    stage('router',       init_router)
  ], callback);
};

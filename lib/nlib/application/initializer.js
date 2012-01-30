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


function init_bundler(next) {
  next(new Error("Not implemented yet"));
}


////////////////////////////////////////////////////////////////////////////////


// expose module-function.
module.exports = function initialize(main, callback) {
  var stage = function (name, fn) {
    return Async.apply(nodeca.hooks.init.run, name, fn);
  };

  Async.series([
    stage('logger', init_logger),
    Async.apply(load_apps, main),
    stage('apps', init_apps),
    stage('models', init_models),
    stage('bundler', init_bundler)
  ], callback);
};

nodeca-lib
==========


NodecaLib.Application lifecycle
-------------------------------

~~~
: new Application
  : read config and fullfills Application#getConfig's promise
  : read db config and fullfills Application#getMogoose's promise

: Application#init
  : Application#getConfig
    : Application#getMongoose
      : Application#bootstrap
        : require and embed all sub-apps
        : @bootstrap_sub_apps
          : hooks#exec 'bootstrapped'
            : @@init_schemas
              : hooks#exec 'shemas-loaded'
~~~

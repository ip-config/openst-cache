'use strict';

/*
 * Cache Related Constants:
 *
 * Load caching layer related constant variables from environment variables
 *
 * @module config/cache
 */

// Load internal libraries
const rootPrefix = '..',
  InstanceComposer = require(rootPrefix + '/instance_composer');

const GetCacheConfigHelper = function(configStrategy, instanceComposer) {
  const oThis = this;

  oThis.DEFAULT_TTL = configStrategy.OST_DEFAULT_TTL;
  oThis.REDIS_HOST = configStrategy.OST_REDIS_HOST;
  oThis.REDIS_PORT = configStrategy.OST_REDIS_PORT;
  oThis.REDIS_PASS = configStrategy.OST_REDIS_PASS;
  oThis.REDIS_TLS_ENABLED = configStrategy.OST_REDIS_TLS_ENABLED == '1';
  oThis.DEBUG_ENABLED = configStrategy.DEBUG_ENABLED;
  oThis.MEMCACHE_SERVERS = (configStrategy.OST_MEMCACHE_SERVERS || '')
    .split(',')
    .map(Function.prototype.call, String.prototype.trim);

  oThis.INMEMORY_CACHE_NAMESPACE = configStrategy.OST_INMEMORY_CACHE_NAMESPACE || '';
};

InstanceComposer.register(GetCacheConfigHelper, 'getCacheConfigHelper', true);

module.exports = GetCacheConfigHelper;

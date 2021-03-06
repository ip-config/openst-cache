'use strict';
/**
 * Implementation of the caching layer using Memcached.<br><br>
 *
 * @module lib/cache/memcached
 */

// Load external packages
const Memcached = require('memcached');

Object.assign(Memcached.config, { retries: 1, timeout: 500, reconnect: 1000, poolSize: 200 });

// Load internal libraries and create instances
const rootPrefix = '../..',
  helper = require(rootPrefix + '/lib/cache/helper'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/config/cache');

/**
 * Constructor for memcached implementation
 *
 * @param {boolean} isConsistentBehaviour - specifies if the cache behaviour be consistent across all cache engines
 *
 * @constructor
 */
const MemcachedCacheImplementer = function(isConsistentBehaviour) {
  const oThis = this;

  let cacheConfig = oThis.ic().getCacheConfigHelper();

  oThis.client = new Memcached(cacheConfig.MEMCACHE_SERVERS);
  // Error handling
  oThis.client.on('issue', function(details) {
    logger.info('Issue with Memcache server. Trying to resolve!');
  });
  oThis.client.on('failure', function(details) {
    logger.info('Server ' + details.server + 'went down due to: ' + details.messages.join(''));
  });
  oThis.client.on('reconnecting', function(details) {
    logger.info('Total downtime caused by server ' + details.server + ' :' + details.totalDownTime + 'ms');
  });

  oThis.defaultLifetime = Number(cacheConfig.DEFAULT_TTL);

  oThis._isConsistentBehaviour = isConsistentBehaviour;
};

MemcachedCacheImplementer.prototype = {
  _isConsistentBehaviour: null,

  /**
   * Get the cached value of a key.
   *
   * @param {string} key - cache key
   *
   * @return {Promise<result>} - On success, data.value has value. On failure, error details returned.
   */
  get: function(key) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      // error handling
      if (helper.validateCacheKey(key) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_g_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: {key: key}
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_m_g_2',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: {
              error: err
            }
          });
          return onResolve(errObj);
        } else {
          return onResolve(responseHelper.successWithData({ response: data === undefined ? null : data }));
        }
      };

      // Perform action
      oThis.client.get(key, callback);
    });
  },

  /**
   * Get the stored object value for the given key.
   *
   * @param {string} key - cache key
   *
   * @return {Promise<result>} - On success, data.value has value. On failure, error details returned.
   */
  getObject: function(key) {
    const oThis = this;

    // Perform action
    return oThis.get(key);
  },

  /**
   * Set a new key value or update the existing key value in cache
   *
   * @param {string} key - cache key
   * @param {mixed} value - data to be cached
   * @param {number} [ttl] - cache expiry in seconds. default: DEFAULT_TTL
   *
   * @return {Promise<result>} - On success, data.value is true. On failure, error details returned.
   */
  set: function(key, value, ttl) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      // error handling
      if (helper.validateCacheKey(key) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_s_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: {key: key}
        });
        return onResolve(errObj);
      }
      if (helper.validateCacheValue(value) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_s_2',
          api_error_identifier: 'invalid_cache_value',
          error_config: helper.fetchErrorConfig(),
          debug_options: {key: key}
        });
        return onResolve(errObj);
      }
      if (helper.validateCacheExpiry(ttl) === false) {
        ttl = oThis.defaultLifetime;
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_m_s_3',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          return onResolve(responseHelper.successWithData({ response: true }));
        }
      };

      // Perform action
      oThis.client.set(key, value, ttl, callback);
    });
  },

  /**
   * Cache object in cache
   *
   * @param {string} key - cache key
   * @param {mixed} object - object to be cached
   * @param {number} [ttl] - cache expiry in seconds. default: DEFAULT_TTL
   *
   * @return {Promise<result>} - On success, data.value is true. On failure, error details returned.
   */
  setObject: function(key, object, ttl) {
    const oThis = this;

    // validate value
    if (typeof object !== 'object') {
      let errObj = responseHelper.error({
        internal_error_identifier: 'l_c_m_so_1',
        api_error_identifier: 'invalid_cache_value',
        error_config: helper.fetchErrorConfig(),
        debug_options: {key: key}
      });
      return Promise.resolve(errObj);
    }

    // NOTE: To support redis implementation don't allow array
    if (oThis._isConsistentBehaviour && Array.isArray(object)) {
      let errObj = responseHelper.error({
        internal_error_identifier: 'l_c_m_so_2',
        api_error_identifier: 'array_is_invalid_cache_value',
        error_config: helper.fetchErrorConfig(),
        debug_options: {key: key}
      });
      return Promise.resolve(errObj);
    }

    // Perform action
    return oThis.set(key, object, ttl);
  },

  /**
   * Delete the key from cache
   *
   * @param {string} key - cache key
   *
   * @return {Promise<result>} - On success, data.value is true. On failure, error details returned.
   */
  del: function(key) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      // error handling
      if (helper.validateCacheKey(key) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_d_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: {key: key}
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_m_d_2',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          onResolve(errObj);
        } else {
          onResolve(responseHelper.successWithData({ response: true }));
        }
      };

      // Perform action
      oThis.client.del(key, callback);
    });
  },

  /**
   * Get the values of specified keys.
   *
   * @param {array} keys - cache keys
   *
   * @return {Promise<result>} - On success, data.value is object of keys and values. On failure, error details returned.
   */
  multiGet: function(keys) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      // error handling
      if (!Array.isArray(keys) || keys.length == 0) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_mg_1',
          api_error_identifier: 'cache_keys_non_array',
          error_config: helper.fetchErrorConfig(),
          debug_options: {keys: keys}
        });
        return onResolve(errObj);
      }
      for (let i = 0; i < keys.length; i++) {
        if (helper.validateCacheKey(keys[i]) === false) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_m_mg_2',
            api_error_identifier: 'invalid_cache_key',
            error_config: helper.fetchErrorConfig(),
            debug_options: { invalid_key: keys[i] }
          });
          return onResolve(errObj);
        }
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_m_g_2',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          // match behaviour with redis
          for (let i = 0; i < keys.length; i++) {
            data[keys[i]] = typeof data[keys[i]] === 'object' || data[keys[i]] === undefined ? null : data[keys[i]];
          }
          onResolve(responseHelper.successWithData({ response: data }));
        }
      };

      // Perform action
      oThis.client.getMulti(keys, callback);
    });
  },

  /**
   * Increment the numeric value for the given key, if key already exists.
   *
   * @param {string} key - cache key
   * @param {int} byValue - number by which cache need to be incremented. Default: 1
   *
   * @return {Promise<result>} - On success, data.value is true. On failure, error details returned.
   */
  increment: function(key, byValue) {
    const oThis = this;

    byValue = byValue === undefined ? 1 : byValue;

    return new Promise(function(onResolve, onReject) {
      // validate key and value
      if (helper.validateCacheKey(key) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_i_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: {key: key}
        });
        return onResolve(errObj);
      }
      if (byValue !== parseInt(byValue, 10) || byValue < 1 || helper.validateCacheValue(byValue) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_i_2',
          api_error_identifier: 'non_int_cache_value',
          error_config: helper.fetchErrorConfig(),
          debug_options: {byValue: byValue}
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_m_i_3',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          if (data === false) {
            let errObj = responseHelper.error({
              internal_error_identifier: 'l_c_m_i_4',
              api_error_identifier: 'missing_cache_key',
              error_config: helper.fetchErrorConfig(),
              debug_options: {}
            });
            return onResolve(errObj);
          } else {
            return onResolve(responseHelper.successWithData({ response: data }));
          }
        }
      };

      // Perform action
      oThis.client.incr(key, byValue, callback);
    });
  },

  /**
   * Change the expiry time of an existing cache key
   *
   * @param {string} key - cache key
   * @param {int} lifetime - new cache expiry in number of seconds
   *
   * @return {Promise<result>} - On success, data.value is true. On failure, error details returned.
   */
  touch: function(key, lifetime) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      // validate key and value
      if (helper.validateCacheKey(key) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_t_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: {key: key}
        });
        return onResolve(errObj);
      }
      if (lifetime !== parseInt(lifetime, 10) || lifetime < 0 || helper.validateCacheValue(lifetime) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_t_2',
          api_error_identifier: 'cache_expiry_nan',
          error_config: helper.fetchErrorConfig(),
          debug_options: {lifetime: lifetime}
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_m_t_3',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          if (data === false) {
            let errObj = responseHelper.error({
              internal_error_identifier: 'l_c_m_t_4',
              api_error_identifier: 'missing_cache_key',
              error_config: helper.fetchErrorConfig(),
              debug_options: {}
            });
            return onResolve(errObj);
          } else {
            return onResolve(responseHelper.successWithData({ response: data }));
          }
        }
      };

      // NOTE: To support redis implementation
      lifetime = lifetime == 0 && oThis._isConsistentBehaviour ? -1 : lifetime;

      // Perform action
      oThis.client.touch(key, lifetime, callback);
    });
  },

  /**
   * Decrement the numeric value for the given key, if key already exists.
   *
   * @param {string} key - cache key
   * @param {int} byValue - number by which cache need to be decremented. Default: 1
   *
   * @return {Promise<result>} - On success, data.value is true. On failure, error details returned.
   */
  decrement: function(key, byValue) {
    const oThis = this;

    byValue = byValue === undefined ? 1 : byValue;

    return new Promise(function(onResolve, onReject) {
      // validate key and value
      if (helper.validateCacheKey(key) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_d_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: {key: key}
        });
        return onResolve(errObj);
      }
      if (byValue !== parseInt(byValue, 10) || byValue < 1 || helper.validateCacheValue(byValue) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_m_d_2',
          api_error_identifier: 'non_numeric_cache_value',
          error_config: helper.fetchErrorConfig(),
          debug_options: {byValue: byValue}
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_m_d_3',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          if (data === false) {
            let errObj = responseHelper.error({
              internal_error_identifier: 'l_c_m_d_4',
              api_error_identifier: 'missing_cache_key',
              error_config: helper.fetchErrorConfig(),
              debug_options: {}
            });
            return onResolve(errObj);
          } else {
            return onResolve(responseHelper.successWithData({ response: data }));
          }
        }
      };

      // Perform action
      oThis.client.decr(key, byValue, callback);
    });
  },

  /**
   * Delete all keys from cache
   *
   * @return {Promise<result>}
   */
  delAll: function() {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      oThis.client.flush(function(err, succeeded) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_t_5',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          return onResolve(responseHelper.successWithData());
        }
      });
    });
  }
};

InstanceComposer.registerShadowableClass(MemcachedCacheImplementer, 'getMemcachedCacheImplementer');

module.exports = MemcachedCacheImplementer;

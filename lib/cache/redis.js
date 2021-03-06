'use strict';
/**
 * Implementation of the caching layer using Redis.
 * A persistent Redis connection per Node js worker is maintained and this connection is singleton.<br><br>
 *
 * @module lib/cache/redis
 */
// Load External packages
const redis = require('redis');

// Load internal libraries
const rootPrefix = '../..',
  helper = require(rootPrefix + '/lib/cache/helper'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/config/cache');

/**
 * Constructor for redis implementation
 *
 * @param {boolean} isConsistentBehaviour - specifies if the cache behaviour be consistent across all cache engines
 *
 * @constructor
 */

const RedisCacheImplementer = function(isConsistentBehaviour) {
  const oThis = this;

  let cacheConfig = oThis.ic().getCacheConfigHelper();

  oThis.clientOptions = {
    host: cacheConfig.REDIS_HOST,
    port: cacheConfig.REDIS_PORT,
    password: cacheConfig.REDIS_PASS,
    tls: cacheConfig.REDIS_TLS_ENABLED
  };

  oThis.client = redis.createClient(oThis.clientOptions);

  oThis.defaultLifetime = Number(cacheConfig.DEFAULT_TTL);

  oThis._isConsistentBehaviour = isConsistentBehaviour;
};

RedisCacheImplementer.prototype = {
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
          internal_error_identifier: 'l_c_r_g_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: { key: key }
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_g_2',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          return onResolve(responseHelper.successWithData({ response: data }));
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

    return new Promise(function(onResolve, onReject) {
      // error handling
      if (helper.validateCacheKey(key) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_r_go_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: { key: key }
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_go_2',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          // format data
          for (let i in data) {
            data[i] = JSON.parse(data[i]);
          }
          return onResolve(responseHelper.successWithData({ response: data }));
        }
      };

      // Perform action
      oThis.client.hgetall(key, callback);
    });
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
          internal_error_identifier: 'l_c_r_s_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: { key: key }
        });
        return onResolve(errObj);
      }
      if (typeof value === 'object' || helper.validateCacheValue(value) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_r_s_2',
          api_error_identifier: 'invalid_cache_value',
          error_config: helper.fetchErrorConfig(),
          debug_options: { key: key }
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
            internal_error_identifier: 'l_c_r_s_3',
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
      oThis.client.set(key, value, 'EX', ttl, callback);
    });
  },

  /**
   * Cache object in cache
   *
   * @param {string} key - cache key
   * @param {mixed} object - object to be cached
   *
   * @return {Promise<result>} - On success, data.value is true. On failure, error details returned.
   */
  setObject: function(key, object) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      // error handling
      if (helper.validateCacheKey(key) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_r_so_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: { key: key }
        });
        return onResolve(errObj);
      }
      if (typeof object !== 'object' || Array.isArray(object) || helper.validateCacheValue(object) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_r_so_2',
          api_error_identifier: 'invalid_cache_value',
          error_config: helper.fetchErrorConfig(),
          debug_options: {}
        });
        return onResolve(errObj);
      }

      //NOTE: hmset is always merge the value of the object, never overwrite key. So, delete before set.
      await oThis.del(key);

      // Set callback method
      let callback = function(err, res) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_so_3',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          return onResolve(responseHelper.successWithData({ response: true }));
        }
      };

      // format data
      let arrayRepresentation = [];
      for (let i in object) {
        arrayRepresentation.push(i);
        arrayRepresentation.push(JSON.stringify(object[i]));
      }

      // Perform action
      // NOTE: redis hmset does not support custom TTl as of now handle it when it does.
      oThis.client.hmset(key, arrayRepresentation, callback);
    });
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
          internal_error_identifier: 'l_c_r_d_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: { key: key }
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_d_2',
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
      oThis.client.del(key, callback);
    });
  },

  /**
   * Get the values of specified keys.<br><br>
   * <b>NOTE: Object cache retrieval is not support with multiGet. It returns null value, even if value is set in cache.</b>
   *
   * @param {array} keys - cache keys
   *
   * @return {Promise<result>} - On success, data.value is object of keys and values. On failure, error details returned.
   */
  multiGet: function(keys) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      // error handling
      if (!Array.isArray(keys) || keys.length === 0) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_r_mg_1',
          api_error_identifier: 'array_is_invalid_cache_value',
          error_config: helper.fetchErrorConfig(),
          debug_options: {}
        });
        return onResolve(errObj);
      }
      for (let i = 0; i < keys.length; i++) {
        if (helper.validateCacheKey(keys[i]) === false) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_mg_2',
            api_error_identifier: 'invalid_cache_key',
            error_config: helper.fetchErrorConfig(),
            debug_options: { key: keys[i] }
          });
          return onResolve(errObj);
        }
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_mg_3',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          let retVal = {};
          for (let i = 0; i < keys.length; i++) {
            retVal[keys[i]] = data[i];
          }
          return onResolve(responseHelper.successWithData({ response: retVal }));
        }
      };

      // Perform action
      oThis.client.mget(keys, callback);
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
          internal_error_identifier: 'l_c_r_i_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: { key: key }
        });
        return onResolve(errObj);
      }
      if (byValue !== parseInt(byValue, 10) || byValue < 1 || helper.validateCacheValue(byValue) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_r_i_2',
          api_error_identifier: 'non_int_cache_value',
          error_config: helper.fetchErrorConfig(),
          debug_options: { byValue: byValue }
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_i_3',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          if (data === false) {
            let errObj = responseHelper.error({
              internal_error_identifier: 'l_c_r_i_4',
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

      if (oThis._isConsistentBehaviour) {
        // Perform action
        let incrementValue = function(result) {
          if (result.isSuccess() && result.data.response > 0) {
            oThis.client.incrby(key, byValue, callback);
          } else {
            let errObj = responseHelper.error({
              internal_error_identifier: 'l_c_m_i_5',
              api_error_identifier: 'missing_cache_key',
              error_config: helper.fetchErrorConfig(),
              debug_options: {}
            });
            return onResolve(errObj);
          }
        };

        // NOTE: To support memcached implementation
        oThis.get(key).then(incrementValue);
      } else {
        oThis.client.incrby(key, byValue, callback);
      }
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
          internal_error_identifier: 'l_c_r_d_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: { key: key }
        });
        return onResolve(errObj);
      }
      if (byValue !== parseInt(byValue, 10) || byValue < 1 || helper.validateCacheValue(byValue) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_r_d_2',
          api_error_identifier: 'non_int_cache_value',
          error_config: helper.fetchErrorConfig(),
          debug_options: { byValue: byValue }
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_d_3',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          if (data === false) {
            let errObj = responseHelper.error({
              internal_error_identifier: 'l_c_r_d_4',
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

      if (oThis._isConsistentBehaviour) {
        // Perform action
        let decrementValue = function(result) {
          if (result.isSuccess() && result.data.response > 0) {
            // NOTE: To support memcached implementation
            byValue = result.data.response < byValue ? result.data.response : byValue;
            // decrement
            oThis.client.decrby(key, byValue, callback);
          } else {
            let errObj = responseHelper.error({
              internal_error_identifier: 'l_c_m_d_5',
              api_error_identifier: 'missing_cache_key',
              error_config: helper.fetchErrorConfig(),
              debug_options: {}
            });
            return onResolve(errObj);
          }
        };

        // NOTE: To support memcached implementation
        oThis.get(key).then(decrementValue);
      } else {
        oThis.client.decrby(key, byValue, callback);
      }
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
          internal_error_identifier: 'l_c_r_t_1',
          api_error_identifier: 'invalid_cache_key',
          error_config: helper.fetchErrorConfig(),
          debug_options: { key: key }
        });
        return onResolve(errObj);
      }
      if (lifetime !== parseInt(lifetime, 10) || lifetime < 0 || helper.validateCacheValue(lifetime) === false) {
        let errObj = responseHelper.error({
          internal_error_identifier: 'l_c_r_t_2',
          api_error_identifier: 'cache_expiry_nan',
          error_config: helper.fetchErrorConfig(),
          debug_options: { lifetime: lifetime }
        });
        return onResolve(errObj);
      }

      // Set callback method
      let callback = function(err, data) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_t_3',
            api_error_identifier: 'something_went_wrong',
            error_config: helper.fetchErrorConfig(),
            debug_options: { err: err }
          });
          return onResolve(errObj);
        } else {
          if (data === 0) {
            let errObj = responseHelper.error({
              internal_error_identifier: 'l_c_r_t_4',
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
      oThis.client.expire(key, lifetime, callback);
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
      oThis.client.flushdb(function(err, succeeded) {
        if (err) {
          let errObj = responseHelper.error({
            internal_error_identifier: 'l_c_r_t_5',
            api_error_identifier: 'flush_all_keys_failed',
            error_config: helper.fetchErrorConfig(),
            debug_options: {}
          });
          return onResolve(errObj);
        } else {
          return onResolve(responseHelper.successWithData());
        }
      });
    });
  }
};

InstanceComposer.registerShadowableClass(RedisCacheImplementer, 'getRedisCacheImplementer');

module.exports = RedisCacheImplementer;

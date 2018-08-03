// Load external packages
const chai = require('chai'),
  assert = chai.assert;

// Load cache service
const rootPrefix = '..',
  openSTCacheKlass = require(rootPrefix + '/index'),
  testCachingEngine = process.env.TEST_CACHING_ENGINE;

let configStrategy1;
let configStrategy2;
if (testCachingEngine == 'redis') {
  configStrategy1 = require(rootPrefix + '/test/env/redis.json');
  configStrategy2 = require(rootPrefix + '/test/env/redis2.json');
} else if (testCachingEngine == 'memcached') {
  configStrategy1 = require(rootPrefix + '/test/env/memcached.json');
  configStrategy2 = require(rootPrefix + '/test/env/memcached2.json');
} else if (testCachingEngine == 'none') {
  configStrategy1 = require(rootPrefix + '/test/env/in-memory.json');
  configStrategy2 = require(rootPrefix + '/test/env/in-memory2.json');
  // Config strategies are same as they won't change for in-memory.
}

const engineType = configStrategy1.OST_CACHING_ENGINE;

function performTest(cacheObj, keySuffix) {
  describe('Cache Set ' + keySuffix, function() {
    keySuffix = keySuffix + '_' + new Date().getTime();

    it('should return promise', async function() {
      var cKey = 'cache-key' + keySuffix,
        cValue = 'String Value',
        response = cacheObj.set(cKey, cValue);
      assert.typeOf(response, 'Promise');
    });

    it('should fail when key/value is not passed', async function() {
      var response = await cacheObj.set();
      assert.equal(response.isSuccess(), false);
    });

    it('should fail when key is undefined', async function() {
      var cValue = 'String Value',
        response = await cacheObj.set(undefined, cValue);
      assert.equal(response.isSuccess(), false);
    });

    it('should fail when key is blank', async function() {
      var cKey = '',
        cValue = 'String Value',
        response = await cacheObj.set(cKey, cValue);
      assert.equal(response.isSuccess(), false);
    });

    it('should fail when key is number', async function() {
      var cKey = 10,
        cValue = 'String Value',
        response = await cacheObj.set(cKey, cValue);
      assert.equal(response.isSuccess(), false);
    });

    it('should fail when key has space', async function() {
      var cKey = 'a b' + keySuffix,
        cValue = 'String Value',
        response = await cacheObj.set(cKey, cValue);
      assert.equal(response.isSuccess(), false);
    });

    it('should fail when key length is > 250 bytes', async function() {
      var cKey = Array(252).join('x'),
        cValue = 'String Value',
        response = await cacheObj.set(cKey, cValue);
      assert.equal(response.isSuccess(), false);
    });

    if (engineType != 'redis') {
      it('should pass when value is Object', async function() {
        var cKey = 'cache-key' + keySuffix,
          cValue = { a: 1 },
          response = await cacheObj.set(cKey, cValue);
        assert.equal(response.isSuccess(), true);
        assert.equal(response.data.response, true);
      });
    } else {
      it('should fail when value is Object', async function() {
        var cKey = 'cache-key' + keySuffix,
          cValue = { a: 1 },
          response = await cacheObj.set(cKey, cValue);
        assert.equal(response.isSuccess(), false);
      });
    }

    it('should fail when value is undefined', async function() {
      var cKey = 'cache-key' + keySuffix,
        response = await cacheObj.set(cKey);
      assert.equal(response.isSuccess(), false);
    });

    it('should fail when value size is > 1 MB', async function() {
      var cKey = 'cache-key' + keySuffix,
        cValue = Array(1050000).join('x'),
        response = await cacheObj.set(cKey, cValue);
      assert.equal(response.isSuccess(), false);
    });

    it('should pass when value is string', async function() {
      var cKey = 'cache-key' + keySuffix,
        cValue = 'String Value',
        response = await cacheObj.set(cKey, cValue);
      assert.equal(response.isSuccess(), true);
      assert.equal(response.data.response, true);
    });

    it('should pass when value is integer', async function() {
      var cKey = 'cache-key' + keySuffix,
        cValue = 10,
        response = await cacheObj.set(cKey, cValue);
      assert.equal(response.isSuccess(), true);
      assert.equal(response.data.response, true);
    });

    it('should pass when value is blank', async function() {
      var cKey = 'cache-key' + keySuffix,
        cValue = '',
        response = await cacheObj.set(cKey, cValue);
      assert.equal(response.isSuccess(), true);
      assert.equal(response.data.response, true);
    });

    it('should delete from cache after ttl', async function() {
      var cKey = 'cache-key' + keySuffix,
        cValue = 10,
        ttl = 6, // seconds
        response = await cacheObj.set(cKey, cValue, ttl);
      assert.equal(response.isSuccess(), true);
      assert.equal(response.data.response, true);
      setTimeout(async function() {
        response = await openSTCache.get(cKey);
        assert.equal(response.isSuccess(), true);
        assert.equal(response.data.response, null);
      }, ttl * 1000);
    });
  });
}

function performMultipleTest(cacheObj1, cacheObj2, keySuffix) {
  describe('Cache Multiple Set ' + keySuffix, function() {
    keySuffix = keySuffix + '_' + new Date().getTime();

    it('should set values to different cache instances', async function() {
      let cKey1 = 'cache-key' + keySuffix,
        cValue1 = 'value1',
        response1 = await cacheObj1.set(cKey1, cValue1),
        cKey2 = 'cache-key' + keySuffix,
        cValue2 = 'value2',
        response2 = await cacheObj2.set(cKey2, cValue2);
      assert.equal(response1.isSuccess(), true);
      assert.equal(response1.data.response, true);
      assert.equal(response2.isSuccess(), true);
      assert.equal(response2.data.response, true);
    });
  });
}

openSTCache1 = openSTCacheKlass.getInstance(configStrategy1);
cacheImplementer1 = openSTCache1.cacheInstance;

openSTCache2 = openSTCacheKlass.getInstance(configStrategy2);
cacheImplementer2 = openSTCache2.cacheInstance;

performTest(cacheImplementer1, 'ConsistentBehaviour');
performTest(cacheImplementer1, 'InconsistentBehaviour');
performMultipleTest(cacheImplementer1, cacheImplementer2, 'ConsistentBehaviour');
performMultipleTest(cacheImplementer1, cacheImplementer2, 'InconsistentBehaviour');

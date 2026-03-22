(function (global) {
  'use strict';

  var DIRECTORY_DB_NAME = 'voice-line-recorder';
  var DIRECTORY_STORE_NAME = 'directoryHandles';

  function getEnv(env) {
    return env || global;
  }

  function getStorage(env) {
    env = getEnv(env);
    return env.localStorage || null;
  }

  function getIndexedDB(env) {
    env = getEnv(env);
    return env.indexedDB || null;
  }

  function openDirectoryDatabase(env) {
    env = getEnv(env);
    return new Promise(function (resolve) {
      var indexedDb = getIndexedDB(env);
      if (!indexedDb) {
        resolve(null);
        return;
      }

      var request = indexedDb.open(DIRECTORY_DB_NAME, 1);
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (db.objectStoreNames && !db.objectStoreNames.contains(DIRECTORY_STORE_NAME)) {
          db.createObjectStore(DIRECTORY_STORE_NAME);
        }
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        resolve(null);
      };
    });
  }

  function runStoreRequest(request) {
    return new Promise(function (resolve) {
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        resolve(null);
      };
    });
  }

  function createPersistence(env) {
    env = getEnv(env);

    return {
      saveSession: function (sessionKey, data) {
        var storage = getStorage(env);
        if (!storage || !sessionKey) return;
        try {
          storage.setItem(sessionKey, JSON.stringify(data));
        } catch (error) {
          // Ignore storage failures in local-file contexts.
        }
      },

      loadSession: function (sessionKey) {
        var storage = getStorage(env);
        if (!storage || !sessionKey) return null;
        try {
          var raw = storage.getItem(sessionKey);
          if (!raw) return null;
          return JSON.parse(raw);
        } catch (error) {
          return null;
        }
      },

      clearSession: function (sessionKey) {
        var storage = getStorage(env);
        if (!storage || !sessionKey) return;
        try {
          storage.removeItem(sessionKey);
        } catch (error) {
          // Ignore storage failures in local-file contexts.
        }
      },

      persistDirectoryHandle: async function (sessionKey, handle) {
        if (!handle || !sessionKey) return false;

        var db = await openDirectoryDatabase(env);
        if (!db) return false;

        var store = db.transaction(DIRECTORY_STORE_NAME, 'readwrite').objectStore(DIRECTORY_STORE_NAME);
        await runStoreRequest(store.put({
          handle: handle,
          name: handle.name || ''
        }, sessionKey));
        return true;
      },

      loadPersistedDirectoryHandle: async function (sessionKey) {
        if (!sessionKey) return null;

        var db = await openDirectoryDatabase(env);
        if (!db) return null;

        var store = db.transaction(DIRECTORY_STORE_NAME, 'readonly').objectStore(DIRECTORY_STORE_NAME);
        var saved = await runStoreRequest(store.get(sessionKey));
        if (!saved || !saved.handle) return null;
        return saved;
      },

      clearPersistedDirectoryHandle: async function (sessionKey) {
        if (!sessionKey) return;

        var db = await openDirectoryDatabase(env);
        if (!db) return;

        var store = db.transaction(DIRECTORY_STORE_NAME, 'readwrite').objectStore(DIRECTORY_STORE_NAME);
        await runStoreRequest(store.delete(sessionKey));
      }
    };
  }

  var api = {
    createPersistence: createPersistence,
    openDirectoryDatabase: openDirectoryDatabase,
    runStoreRequest: runStoreRequest
  };

  global.VoiceLineRecorderPersistence = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
}(typeof window !== 'undefined' ? window : globalThis));

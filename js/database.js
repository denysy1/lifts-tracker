// Database management module
export class DatabaseManager {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("GymTrackerDB", 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const store = db.createObjectStore("lifts", { keyPath: "id", autoIncrement: true });
        store.createIndex("exercise", "exercise", { unique: false });

        if (!db.objectStoreNames.contains("config")) {
          db.createObjectStore("config", { keyPath: "key" });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error("Database error:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  async getExerciseRecords(exercise) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["lifts"], "readonly");
      const store = transaction.objectStore("lifts");
      const index = store.index("exercise");
      const request = index.getAll(exercise);

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async addLiftRecord(record) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
      const request = store.add(record);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async updateLiftRecord(record) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
      const request = store.put(record);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async deleteLastEntry(exercise) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
      const index = store.index("exercise");
      const request = index.getAllKeys(exercise);

      request.onsuccess = (event) => {
        const keys = event.target.result;
        if (keys.length > 0) {
          const lastKey = keys[keys.length - 1];
          store.delete(lastKey).onsuccess = () => {
            resolve();
          };
        } else {
          reject(new Error("No entry to clear"));
        }
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async exportFullBackup() {
    return new Promise((resolve, reject) => {
      const objectStoreNames = Array.from(this.db.objectStoreNames);
      const transaction = this.db.transaction(objectStoreNames, "readonly");

      const exportPromises = objectStoreNames.map(storeName => {
        return new Promise((resolveStore, rejectStore) => {
          const store = transaction.objectStore(storeName);
          const request = store.getAll();

          request.onsuccess = () => {
            resolveStore({
              storeName: storeName,
              data: request.result
            });
          };

          request.onerror = () => {
            rejectStore(new Error(`Failed to export ${storeName}: ${request.error}`));
          };
        });
      });

      Promise.all(exportPromises).then(storeData => {
        const fullBackup = {
          databaseName: this.db.name,
          version: this.db.version,
          exportDate: new Date().toISOString(),
          appVersion: "1.0",
          stores: {}
        };

        storeData.forEach(({ storeName, data }) => {
          fullBackup.stores[storeName] = data;
        });

        resolve(fullBackup);
      }).catch(reject);
    });
  }

  async importFullBackup(backupData) {
    return new Promise((resolve, reject) => {
      const objectStoreNames = Array.from(this.db.objectStoreNames);
      const transaction = this.db.transaction(objectStoreNames, "readwrite");

      // Clear all existing stores first
      const clearPromises = objectStoreNames.map(storeName => {
        return new Promise((resolveStore, rejectStore) => {
          const store = transaction.objectStore(storeName);
          const clearRequest = store.clear();

          clearRequest.onsuccess = () => resolveStore(storeName);
          clearRequest.onerror = () => rejectStore(new Error(`Failed to clear ${storeName}`));
        });
      });

      Promise.all(clearPromises).then(() => {
        // Restore data to each store
        const restorePromises = [];

        for (const [storeName, storeData] of Object.entries(backupData.stores)) {
          if (objectStoreNames.includes(storeName) && Array.isArray(storeData)) {
            const store = transaction.objectStore(storeName);

            storeData.forEach(record => {
              restorePromises.push(new Promise((resolveRecord, rejectRecord) => {
                const putRequest = store.put(record);
                putRequest.onsuccess = () => resolveRecord();
                putRequest.onerror = () => rejectRecord(putRequest.error);
              }));
            });
          }
        }

        Promise.all(restorePromises).then(() => {
          transaction.oncomplete = () => {
            resolve();
          };

          transaction.onerror = (event) => {
            reject(event.target.error);
          };
        }).catch(reject);
      }).catch(reject);
    });
  }

  getDB() {
    return this.db;
  }
}

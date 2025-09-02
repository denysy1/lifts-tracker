// Configuration management module
export const defaultConfig = {
  disableLeaderBlock: true,
  setPercentagesLeader: [0.65, 0.75, 0.85],
  setPercentagesAnchor: { 1: [0.65, 0.75, 0.85], 2: [0.70, 0.80, 0.90], 3: [0.75, 0.85, 0.95] },
  setRepsLeader: [5, 5, 5],
  setRepsAnchor: { 1: [5, 5, 5], 2: [3, 3, 3], 3: [5, 3, 1] },
  targetRepsAnchor: { 1: 10, 2: 8, 3: 6 },
  incrementValues: {
    "Overhead Press": 5,
    "Bench Press": 5,
    "Squat": 10,
    "Deadlift": 10
  },
  alternatives: {
    "Overhead Press": [{ name: "Dumbbell Overhead Press", scale: 0.8 }],
    "Bench Press": [
      { name: "Incline Bench Press", scale: 0.9 },
      { name: "Decline Bench Press", scale: 1.0 },
      { name: "Dumbbell Press", scale: 0.75 },
      { name: "Incline Dumbbell Press", scale: 0.7 }
    ],
    "Squat": [{ name: "Leg Press", scale: 2.0 }],
    "Deadlift": [{ name: "Leg Curls", scale: 0.5 }]
  },
  oneRM_correction_factor: 1.0,
  deloadPercentage: 0.7,
  amrapProgressionThresholds: [10, 15, 20],
  amrapProgressionIncrementMultipliers: [1, 1, 1],
  deloadTriggerConsecutiveLowAMRAP: 1,
  supplementWorkPercentage: 0.5,
  trainingMaxInitializationFactor: 0.9,
  cyclesPerBlockType: {
    leader: 2,
    anchor: 1
  },
  converter: {
    "1rm_formula_k": 30,
    "toBenchFactors": {
      "bench_press": 1.0,
      "incline_bench": 0.75,
      "decline_bench": 1.05,
      "dumbbell_bench_press": 0.85,
      "incline_dumbbell_bench_press": 0.80,
      "dumbbell_fly": 0.50,
      "overhead_press": 0.65,
      "dumbbell_overhead_press": 0.60,
      "decline_dumbbell_overhead_press": 0.60
    },
    "toSquatFactors": {
      "squat": 1.0,
      "front_squat": 0.80,
      "bulgarian_squat": 0.60,
      "leg_press": 1.75,
      "step_up": 0.45,
      "deadlift": 1.0,
      "stiff_legged_deadlift": 0.80,
      "sumo_deadlift": 1.08,
      "hex_bar_deadlift": 1.08,
      "lunge": 0.65
    }
  }
};

export class ConfigManager {
  constructor(db) {
    this.db = db;
    this.config = { ...defaultConfig };
  }

  async loadFromDB() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["config"], "readonly");
      const store = transaction.objectStore("config");

      store.getAll().onsuccess = (event) => {
        const configs = event.target.result;

        configs.forEach(({ key, value }) => {
          if (this.config.hasOwnProperty(key)) {
            this.config[key] = value;
          } else {
            console.warn(`Unknown config key: ${key}`);
          }
        });

        console.log("Configuration loaded successfully:", this.config);
        resolve(this.config);
      };

      store.getAll().onerror = (event) => {
        console.error("Error loading configuration from IndexedDB:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  async saveToDB(newConfig) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["config"], "readwrite");
      const store = transaction.objectStore("config");

      store.clear().onsuccess = () => {
        for (const [key, value] of Object.entries(newConfig)) {
          if (key in this.config) {
            store.put({ key, value });
            this.config[key] = value;
          } else {
            console.warn(`Skipping invalid or unknown config key: ${key}`);
          }
        }

        console.log("Updated config:", this.config);
        resolve();
      };

      transaction.onerror = (event) => {
        console.error("Error saving configuration to IndexedDB:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  get(key) {
    return this.config[key];
  }

  getAll() {
    return { ...this.config };
  }
}

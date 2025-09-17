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
    "Overhead Press": [
      { name: "Dumbbell Overhead Press", scale: 0.51 }
    ],
    "Bench Press": [
      { name: "Incline Bench Press", scale: 0.89 },
      { name: "Decline Bench Press", scale: 1.06 },
      { name: "Dumbbell Press", scale: 0.43 },
      { name: "Incline Dumbbell Press", scale: 0.41 },
      { name: "Decline Dumbbell Press", scale: 0.40 }
    ],
    "Squat": [
      { name: "Sled Leg Press", scale: 1.73 },
      { name: "Front Squat", scale: 0.80 },
      { name: "Bulgarian Split Squat", scale: 0.49 },
      { name: "Dumbbell Split Squat", scale: 0.24 },
      { name: "Barbell Lunge", scale: 0.64 },
      { name: "Dumbbell Lunge", scale: 0.24 }
    ],
    "Deadlift": [
      { name: "Leg Curls", scale: 0.44 },
      { name: "Stiff Legged Deadlift", scale: 0.81 },
      { name: "Sumo Deadlift", scale: 1.12 },
      { name: "Hex Bar Deadlift", scale: 1.09 }
    ]
  },
  oneRM_correction_factor: 0.968,
  deloadPercentage: 0.7,
  amrapProgressionThresholds: [10, 15, 20],
  amrapProgressionIncrementMultipliers: [1, 1, 1],
  deloadTriggerConsecutiveLowAMRAP: 1,
  supplementWorkPercentage: 0.5,
  trainingMaxInitializationFactor: 0.9,
  performanceWindowSize: 3,
  decThreshold: 2,
  accThreshold: 3,
  adjustFactor: 0.50,
  minIncrement: 2.5,
  maxIncrement: 20,
  cyclesPerBlockType: {
    leader: 2,
    anchor: 1
  },
  converter: {
    "1rm_formula_k": 30,
    "toBenchFactors": {
      "bench_press": 1.0,
      "incline_bench": 0.89,
      "decline_bench": 1.06,
      "dumbbell_bench_press": 0.43,
      "incline_dumbbell_bench_press": 0.41,
      "decline_dumbbell_press": 0.40,
      "dumbbell_fly": 0.25,
      "overhead_press": 0.65,
      "dumbbell_overhead_press": 0.33,
      "barbell_rows": 0.87,
      "dumbbell_rows": 0.44,
      "tbar_rows": 0.90,
      "cable_rows": 0.89,
      "barbell_curls": 0.49,
      "preacher_curls": 0.47
    },
    "toSquatFactors": {
      "squat": 1.0,
      "front_squat": 0.80,
      "bulgarian_split_squat": 0.49,
      "dumbbell_split_squat": 0.24,
      "sled_leg_press": 1.73,
      "deadlift": 1.17,
      "stiff_legged_deadlift": 0.95,
      "sumo_deadlift": 1.31,
      "hex_bar_deadlift": 1.28,
      "barbell_lunge": 0.64,
      "dumbbell_lunge": 0.24
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

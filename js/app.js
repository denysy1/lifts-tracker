let config = {
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
  oneRM_correction_factor: 1.0, // Adjusts 1RM calculation (default 1.0, increase to lower estimated 1RM)
  deloadPercentage: 0.7,
  amrapProgressionThresholds: [10, 15, 20],
  amrapProgressionIncrementMultipliers: [1, 1, 1],
  deloadTriggerConsecutiveLowAMRAP: 1,
  performanceWindowSize: 3,
  decThreshold: 2,
  accThreshold: 3,
  adjustFactor: 0.50,
  minIncrement: 2.5,
  maxIncrement: 20,
  supplementWorkPercentage: 0.5,
  trainingMaxInitializationFactor: 0.9,
  cyclesPerBlockType: {
    leader: 2,
    anchor: 1
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Main application class
  class LiftTracker {
    constructor() {
      this.db = null;
      this.currentExercise = null;
      this.trainingMax = {};
      this.consecutiveLowAMRAP = {
        "Overhead Press": 0,
        "Bench Press": 0,
        "Squat": 0,
        "Deadlift": 0
      };
      this.blockType = "anchor"; // Default block type
      this.blockCounter = 1; // Tracks number of leader/anchor blocks
      
      this.initDatabase();
      this.bindEventListeners();
    }

    getNextBlock(prevType, prevCount) {
      // If leader‑blocks are disabled, always anchor with counter = 1
      if (config.disableLeaderBlock) {
        return { blockType: "anchor", blockCounter: 1 };
      }
    
      const leaderCycles = config.cyclesPerBlockType.leader;
      const anchorCycles = config.cyclesPerBlockType.anchor;
    
      if (prevType === "leader") {
        // if we’ve done as many leader cycles as allowed → switch to anchor
        if (prevCount >= leaderCycles) {
          return { blockType: "anchor", blockCounter: 1 };
        }
        // otherwise stay in leader and bump the counter
        return { blockType: "leader", blockCounter: prevCount + 1 };
      } else {
        // prevType === "anchor"
        // if we’ve done as many anchor cycles as allowed → switch to leader
        if (prevCount >= anchorCycles) {
          return { blockType: "leader", blockCounter: 1 };
        }
        // otherwise stay in anchor and bump the counter
        return { blockType: "anchor", blockCounter: prevCount + 1 };
      }
    }

    initDatabase() {
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
        this.loadConfigFromDB();
      };
      
      request.onerror = (event) => {
        console.error("Database error:", event.target.error);
      };
    }

    bindEventListeners() {
      document.getElementById("overhead-press-btn").onclick = () => this.selectExercise("Overhead Press");
      document.getElementById("bench-press-btn").onclick = () => this.selectExercise("Bench Press");
      document.getElementById("squat-btn").onclick = () => this.selectExercise("Squat");
      document.getElementById("deadlift-btn").onclick = () => this.selectExercise("Deadlift");

      document.getElementById("initializeExercise").onclick = () => this.initializeTrainingMax();
      document.getElementById("save").onclick = () => this.saveProgress();
      document.getElementById("clear-last-entry").onclick = () => this.clearLastEntry();
      document.getElementById("view-history").onclick = () => this.viewHistory();
      document.getElementById("amrap-plus").onclick = () => this.adjustAmrapReps(1);
      document.getElementById("amrap-minus").onclick = () => this.adjustAmrapReps(-1);
      document.getElementById("actualWeight-plus").onclick = () => this.adjustActualWeight(5);
      document.getElementById("actualWeight-minus").onclick = () => this.adjustActualWeight(-5);
      document.getElementById("showAlternativeWeightsBtn").onclick = () => this.showAlternativeWeights();
      document.getElementById("export-history").onclick = () => this.exportHistory();
      document.getElementById("import-history").onclick = () => this.importHistory();
      document.getElementById("import-config").onclick = () => this.loadConfigFile();
    }

    loadConfigFromDB() {
      const transaction = this.db.transaction(["config"], "readonly");
      const store = transaction.objectStore("config");
    
      store.getAll().onsuccess = (event) => {
        const configs = event.target.result;
    
        configs.forEach(({ key, value }) => {
          if (config.hasOwnProperty(key)) {
            config[key] = value;
          } else {
            console.warn(`Unknown config key: ${key}`);
          }
        });
    
        console.log("Configuration loaded successfully:", config);
      };
    
      store.getAll().onerror = (event) => {
        console.error("Error loading configuration from IndexedDB:", event.target.error);
        alert("Error loading configuration. Using default values.");
      };
    }
     
    loadConfigFile() {
      const fileInput = document.getElementById("configFileInput");
      fileInput.click();
    
      fileInput.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const configData = JSON.parse(e.target.result);
              this.saveConfigToDB(configData);
            } catch (error) {
              alert("Invalid configuration file. Please upload a valid JSON file.");
            }
          };
          reader.readAsText(file);
        }
      };
    }
    
    saveConfigToDB(newConfig) {
      const transaction = this.db.transaction(["config"], "readwrite");
      const store = transaction.objectStore("config");
    
      // Clear existing config
      store.clear().onsuccess = () => {
        for (const [key, value] of Object.entries(newConfig)) {
          if (key in config) {
            store.put({ key, value });
            config[key] = value;
          } else {
            console.warn(`Skipping invalid or unknown config key: ${key}`);
          }
        }
    

        console.log("Updated config:", config);
      };
    
      transaction.onerror = (event) => {
        console.error("Error saving configuration to IndexedDB:", event.target.error);
        alert("Error saving configuration.");
      };
    }
    
    adjustAmrapReps(change) {
      const amrapField = document.getElementById("amrap");
      let currentValue = parseInt(amrapField.value);
      if (isNaN(currentValue)) {
        currentValue = 0;
      }
      currentValue += change;
      if (currentValue < 0) {
        currentValue = 0;
      }
      amrapField.value = currentValue;
    }
    
    adjustActualWeight(change) {
      const actualWeightField = document.getElementById("actualWeight");
      let currentValue = parseInt(actualWeightField.value);
      if (isNaN(currentValue)) {
        currentValue = 0;
      }
      currentValue += change;
      if (currentValue < 0) {
        currentValue = 0;
      }
      actualWeightField.value = currentValue;
    }
    
    effectiveReps(actualReps, actualWeight, prescribedWeight) {
      if (actualWeight <= 0) return 0;
      
      // Calculate the estimated 1RM from the actual performance
      const oneRM_actual = actualWeight / (config.oneRM_correction_factor * (1.0278 - 0.0278 * actualReps));
      
      // Solve for effective reps (R_eff)
      const effectiveRepsValue = (1.0278 - (prescribedWeight / oneRM_actual)) / 0.0278;
      return effectiveRepsValue;
    }

    computePerformanceLog(exercise) {
      console.log(`[tuning] 🔍 computePerformanceLog(${exercise})`);
      return new Promise((resolve, reject) => {
        const tx    = this.db.transaction(["lifts"], "readonly");
        const store = tx.objectStore("lifts");
        const idx   = store.index("exercise");
        idx.getAll(exercise).onsuccess = (evt) => {
          const allRecs = evt.target.result;
          const week3   = allRecs.filter(r => r.week === 3);
          console.log(`[tuning]   ↪ found ${allRecs.length} total, ${week3.length} week‑3 records`);
          const windowSize = config.performanceWindowSize;    // e.g. 6
          const recent = week3.slice(-windowSize);
    
          const minReps = config.amrapProgressionThresholds[0];
    
          const log = recent.map(r => {
            if (r.amrapReps === 0)               return "DEC";
            else if (r.amrapReps < minReps)      return "OK";
            else                                  return "ACC";
          });
    
          resolve(log);
        };
        tx.onerror = () => {
          console.error("[tuning] computePerformanceLog DB error", tx.error);
          reject(tx.error);
        };
      });
    }
    
    adjustIncrementIfNeeded(exercise, log) {
      console.log(
        `[tuning] ${exercise} — last‐${log.length} outcomes:`,
        log,
        `decs=${log.filter(x=>"DEC"===x).length}`,
        `accs=${log.filter(x=>"ACC"===x).length}`,
        `priorIncrement=${config.incrementValues[exercise]}`
      );
    
      if (log.length < Math.max(config.decThreshold, config.accThreshold)) {
        console.log("[tuning] skipping—window not full yet");
        return;
      }
    
      const decs = log.filter(x => x === "DEC").length;
      const accs = log.filter(x => x === "ACC").length;
      let newInc = config.incrementValues[exercise];
    
      if (decs >= config.decThreshold) {
        newInc *= (1 - config.adjustFactor);
        console.log(`[tuning] ${exercise} saw ${decs} DEC ≥ ${config.decThreshold} → newInc=${newInc}`);
      }
      if (accs >= config.accThreshold) {
        newInc *= (1 + config.adjustFactor);
        console.log(`[tuning] ${exercise} saw ${accs} ACC ≥ ${config.accThreshold} → newInc=${newInc}`);
      }
    
      // clamp
      newInc = Math.min(config.maxIncrement, Math.max(config.minIncrement, newInc));
      config.incrementValues[exercise] = newInc;
      console.log(`[tuning] clamped to ${newInc}, saving to DB...`);
    
      this.saveConfigToDB({ incrementValues: config.incrementValues });
    }
    
    
    
    
    showAlternativeWeights() {
      if (!this.currentExercise || !this.trainingMax[this.currentExercise]) {
        alert("Please select an exercise and initialize your training max first.");
        return;
      }

      const altExercises = config.alternatives[this.currentExercise];
      if (!altExercises) {
        alert("No alternative exercises available for this lift.");
        return;
      }

      // Get the weight of the third set from the prescribed sets
      const thirdSetWeight = parseInt(document.querySelector("#prescribedSets p:nth-child(4)").textContent.split(" ")[2]);

      const weights = altExercises.map(
        alt => `${alt.name}: ${Math.round(thirdSetWeight * alt.scale / 5) * 5} lbs`
      ).join("<br>");

      const alternativeWeightsText = `<h3>Alternative Weights</h3>${weights}`;
      const altWeightsElement = document.getElementById("alternativeWeights");

      altWeightsElement.innerHTML = alternativeWeightsText;
      altWeightsElement.style.display = "block";
    }
    
    hideAlternativeWeights() {
      const altWeightsElement = document.getElementById("alternativeWeights");
      if (altWeightsElement) {
        altWeightsElement.innerHTML = "";
        altWeightsElement.style.display = "none";
      } else {
        console.warn("#alternativeWeights element is missing or not loaded in the DOM.");
      }
    }
    
    selectExercise(exercise) {
      this.currentExercise = exercise;
      document.getElementById("exerciseName").textContent = exercise;

      const transaction = this.db.transaction(["lifts"], "readonly");
      const store = transaction.objectStore("lifts");
      const index = store.index("exercise");
      const request = index.getAll(exercise);

      request.onsuccess = (event) => {
        const records = event.target.result;
        if (records.length === 0) {
          document.getElementById("initialization").style.display = "block";
          document.getElementById("tracker").style.display = "none";
        } else {
          document.getElementById("initialization").style.display = "none";
          document.getElementById("tracker").style.display = "block";
          const lastEntry = records[records.length - 1];
          this.blockType = lastEntry.blockType || "leader";
          this.blockCounter = lastEntry.blockCounter || 1;
          this.consecutiveLowAMRAP[this.currentExercise] = lastEntry.consecutiveLowAMRAP || 0;
          this.displayCurrentWorkout(lastEntry);
        }
      };
    }
    
    initializeTrainingMax() {
      const weightUsed = parseFloat(document.getElementById("maxWeightInput").value);
      const maxReps = parseInt(document.getElementById("maxRepsInput").value);
    
      // Ensure valid input
      if (isNaN(weightUsed) || isNaN(maxReps) || weightUsed <= 0 || maxReps <= 0) {
        alert("Please enter valid weight and reps.");
        return;
      }
    
      // Calculate estimated 1RM using the formula
      const estimated1RM = weightUsed / (config.oneRM_correction_factor * (1.0278 - 0.0278 * maxReps));
    
      // Apply the training max initialization factor
      this.trainingMax[this.currentExercise] = Math.floor(estimated1RM * config.trainingMaxInitializationFactor);
    
      const transaction = this.db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");

      const startingBlockType = config.disableLeaderBlock ? "anchor" : "leader";
    
      const newEntry = {
        exercise: this.currentExercise,
        cycle: 1,
        week: 0,
        blockType: startingBlockType,
        blockCounter: 1,
        trainingMax: this.trainingMax[this.currentExercise],
        amrapReps: null,
        date: new Date().toLocaleString(),
        consecutiveLowAMRAP: 0
      };
    
      const request = store.add(newEntry);
    
      request.onsuccess = () => {
        document.getElementById("initialization").style.display = "none";
        document.getElementById("tracker").style.display = "block";
        this.displayCurrentWorkout(newEntry);
      };
      
    }
    
    displayCurrentWorkout(initialData) {
      const transaction = this.db.transaction(["lifts"], "readonly");
      const store = transaction.objectStore("lifts");
      const index = store.index("exercise");
      const request = index.getAll(this.currentExercise);

      request.onsuccess = (event) => {
        this.hideAlternativeWeights();
        const records = event.target.result;
        if (!records.length) {
          console.error("No records found for the selected exercise.");
          return;
        }

        const lastWorkout = initialData || records[records.length - 1];
        this.trainingMax[this.currentExercise] = lastWorkout.trainingMax;

        let cycle = lastWorkout.cycle;
        let week = lastWorkout.week;
        let isDeloadWeek = this.consecutiveLowAMRAP[this.currentExercise]
                      >= config.deloadTriggerConsecutiveLowAMRAP;


        if (!isDeloadWeek && week === 3) {
          week = 1;
          cycle++;
          // use the new helper:
          const next = this.getNextBlock(this.blockType, this.blockCounter);
          this.blockType    = next.blockType;
          this.blockCounter = next.blockCounter;
        } else if (!isDeloadWeek) {
          week++;
        }
        

        const weightPercents = this.blockType === "leader" ? config.setPercentagesLeader : config.setPercentagesAnchor[week];
        const reps = this.blockType === "leader" ? config.setRepsLeader : config.setRepsAnchor[week];
        const targetReps = this.blockType === "anchor" ? config.targetRepsAnchor[week] : reps[2];

        let deloadReps = reps;
        let deloadWeights = weightPercents.map(percent => Math.round(this.trainingMax[this.currentExercise] * percent));

        if (isDeloadWeek) {
          document.getElementById("deloadNotice").textContent = "Deload Week: Reduced volume for recovery";
          deloadReps = reps.map(r => Math.ceil(r * config.deloadPercentage));
          deloadWeights = deloadWeights.map(weight => Math.round(weight * config.deloadPercentage));
        } else {
          document.getElementById("deloadNotice").textContent = "";
        }

        let setsHtml = "<h3>Prescribed Sets</h3>";
        deloadWeights.forEach((weight, i) => {
          weight = Math.round(weight / 5) * 5;
          let repInfo = i === 2 ? ` (Target: ${targetReps} reps)` : "";
          setsHtml += `<p>Set ${i + 1}: ${weight} lbs x ${deloadReps[i]} reps${repInfo}</p>`;
        });
        document.getElementById("prescribedSets").innerHTML = setsHtml;

        let bbbWeight = Math.round(this.trainingMax[this.currentExercise] * config.supplementWorkPercentage / 5) * 5;
        let bbbHtml = `<h3>Supplement Work</h3><p>BBB: 5x10 @ ${bbbWeight} lbs</p>`;
        document.getElementById("supplementWork").innerHTML = bbbHtml;

        document.getElementById("amrap").value = reps[2];
        document.getElementById("actualWeight").value = Math.round((this.trainingMax[this.currentExercise] * weightPercents[2]) / 5) * 5;

        document.getElementById("cycleNumber").textContent = cycle || "N/A";
        document.getElementById("weekNumber").textContent = week || "N/A";
        document.getElementById("blockType").textContent = this.blockType ? this.blockType.charAt(0).toUpperCase() + this.blockType.slice(1) : "N/A";

        console.log(`Workout displayed: Cycle ${cycle}, Week ${week}, Block ${this.blockType}`);
      };

      request.onerror = (event) => {
        console.error("Error retrieving workout data:", event.target.error);
      };
    }
    
    saveProgress() {
      // Read the actual reps and the new actual weight for set 3
      const actualReps = parseInt(document.getElementById("amrap").value);
      const actualWeight = parseInt(document.getElementById("actualWeight").value);

      const transaction = this.db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
      const request = store.index("exercise").getAll(this.currentExercise);

      request.onsuccess = (event) => {
        const records = event.target.result;
        let cycle, week, trainingMax;
        let isFirstSave = records.length === 1 && records[0].week === 0;
        let isDeloadWeek = this.consecutiveLowAMRAP[this.currentExercise]
                       >= config.deloadTriggerConsecutiveLowAMRAP;

        // ▼ EARLY‑RETURN FOR A DELAYED (DELOAD) WEEK ▼
        if (isDeloadWeek) {
          alert("Deload week complete. Progress entry will not be recorded.");
          // clear the flag so we don’t get stuck in deload forever
          this.consecutiveLowAMRAP[this.currentExercise] = 0;
          // ── and persist that change to the last record in IndexedDB ──
          const lastRecord = records[records.length - 1];
          const updatedRecord = {
            ...lastRecord,
            consecutiveLowAMRAP: 0
          };
          // `id` is your keyPath on the object store
          store.put(updatedRecord).onsuccess = () => {
            // once that’s saved, refresh the UI
            this.selectExercise(this.currentExercise);
          };
          return;
        }

        if (isFirstSave) {
          cycle = 1;
          week = 1;
          trainingMax = records[0].trainingMax;
        } else {
          const lastEntry = records[records.length - 1];
          cycle = lastEntry.cycle;
          week = lastEntry.week;
          trainingMax = lastEntry.trainingMax;
          this.blockType = lastEntry.blockType;
          this.blockCounter = lastEntry.blockCounter;
          if (week === 3) {
            week = 1;
            cycle++;
            const next = this.getNextBlock(this.blockType, this.blockCounter);
            this.blockType    = next.blockType;
            this.blockCounter = next.blockCounter;
          } else {
            week++;
          }
          
        }

        // Calculate prescribed weight for the third set
        let weightPercents;
        if (this.blockType === "leader") {
          weightPercents = config.setPercentagesLeader;
        } else {
          weightPercents = config.setPercentagesAnchor[week];
        }
        
        let prescribedWeight;
        if (isDeloadWeek) {
          let baseWeight = trainingMax * weightPercents[2];
          baseWeight = Math.round(baseWeight * config.deloadPercentage);
          prescribedWeight = Math.round(baseWeight / 5) * 5;
        } else {
          let baseWeight = trainingMax * weightPercents[2];
          prescribedWeight = Math.round(baseWeight / 5) * 5;
        }

        // Compute effective reps
        let effectiveRepsValue = this.effectiveReps(actualReps, actualWeight, prescribedWeight);
        let effectiveRepsRounded = Math.round(effectiveRepsValue);

        const increment = config.incrementValues[this.currentExercise];

        // Update training max based on effective reps
        if (!isFirstSave && week === 3 && effectiveRepsRounded >= 0) {
          if (effectiveRepsRounded === 0) {
            trainingMax -= increment;
            this.consecutiveLowAMRAP[this.currentExercise]++;
          } else if (effectiveRepsRounded < 5) {
            trainingMax += increment;
            this.consecutiveLowAMRAP[this.currentExercise]++;
          } else {
            trainingMax += increment;
            // Accelerated incrementing logic:
            for (let i = 0; i < config.amrapProgressionThresholds.length; i++) {
              if (effectiveRepsRounded >= config.amrapProgressionThresholds[i]) {
                trainingMax += increment * config.amrapProgressionIncrementMultipliers[i];
              }
            }
            this.consecutiveLowAMRAP[this.currentExercise] = 0;
          }
        }

        const newEntry = {
          exercise: this.currentExercise,
          cycle,
          week,
          trainingMax,
          blockType: this.blockType,
          blockCounter: this.blockCounter,
          amrapReps: effectiveRepsRounded,
          date: new Date().toLocaleString(),
          consecutiveLowAMRAP: this.consecutiveLowAMRAP[this.currentExercise]
        };

        const addRequest = store.add(newEntry);
        addRequest.onsuccess = () => {
          // Easter egg logic
          if (this.currentExercise === "Squat" && effectiveRepsRounded >= 20) {
            const audio = new Audio("img/yb.mp3");
            audio.play();
          }
          alert("Progress saved!");
          console.log(`[tuning] 📥 Progress saved for ${this.currentExercise}`);
          this.selectExercise(this.currentExercise);
          console.log(`[tuning] ▶️ About to computePerformanceLog for ${this.currentExercise}`);
          if (newEntry.week === 3) {
            this.computePerformanceLog(this.currentExercise)
              .then(log => this.adjustIncrementIfNeeded(this.currentExercise, log));
          }      
        };

      };
    }
    
    clearLastEntry() {
      const transaction = this.db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
      const index = store.index("exercise");
      const request = index.getAllKeys(this.currentExercise);

      request.onsuccess = (event) => {
        const keys = event.target.result;
        if (keys.length > 0) {
          const lastKey = keys[keys.length - 1];
          store.delete(lastKey).onsuccess = () => {
            alert("Last entry cleared.");
            this.selectExercise(this.currentExercise);
          };
        } else {
          alert("No entry to clear.");
        }
      };
    }
    
    viewHistory() {
      const transaction = this.db.transaction(["lifts"], "readonly");
      const store = transaction.objectStore("lifts");
      const request = store.index("exercise").getAll(this.currentExercise);

      request.onsuccess = (event) => {
        const records = event.target.result;
        let historyHtml = `<h2>History for ${this.currentExercise}</h2>`;
        records.forEach(record => {
          if (record.date && record.amrapReps !== null) {
            historyHtml += `<p>${record.date}: Cycle ${record.cycle}, Week ${record.week}, Training Max: ${record.trainingMax} lbs, AMRAP (Effective) Reps: ${record.amrapReps}</p>`;
          }
        });
        document.getElementById("history").innerHTML = historyHtml;
      };
    }
    
    exportHistory() {
      const transaction = this.db.transaction(["lifts"], "readonly");
      const store = transaction.objectStore("lifts");
      const request = store.getAll();

      request.onsuccess = (event) => {
        const records = event.target.result;
        const historyJson = JSON.stringify(records, null, 2);
        const blob = new Blob([historyJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lifts-tracker-history.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      request.onerror = (event) => {
        console.error('Error retrieving history from IndexedDB:', event.target.error);
      };
    }
    
    importHistory() {
      const fileInput = document.getElementById('file-input');
      fileInput.click();
      fileInput.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const importedData = JSON.parse(e.target.result);
              if (Array.isArray(importedData)) {
                this.overwriteHistory(importedData);
              } else {
                alert('Invalid file format. Please upload a valid JSON file.');
              }
            } catch (error) {
              alert('Error reading file. Please upload a valid JSON file.');
            }
          };
          reader.readAsText(file);
        }
      };
    }
    
    overwriteHistory(data) {
      const transaction = this.db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");

      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        data.forEach(record => {
          store.add(record);
        });
        transaction.oncomplete = () => {
          alert('History imported successfully!');
        };
        transaction.onerror = (event) => {
          console.error('Error importing history:', event.target.error);
          alert('Error importing history. Please try again.');
        };
      };

      clearRequest.onerror = (event) => {
        console.error('Error clearing existing history:', event.target.error);
        alert('Error clearing existing history. Please try again.');
      };
    }
  }

  // Initialize the application
  const app = new LiftTracker();
});

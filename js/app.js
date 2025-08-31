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
      this.selectedAlternativeExercise = null; // Track selected alternative exercise
      this.currentScaleFactor = 1.0; // Track current scaling factor

      this.initDatabase();
      this.bindEventListeners();
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
      document.getElementById("backup").onclick = () => this.exportFullBackup();
      document.getElementById("restore").onclick = () => this.importFullBackup();
      document.getElementById("import-config").onclick = () => this.loadConfigFile();

      // Accordion event listeners
      document.getElementById("exerciseOptionsHeader").onclick = () => this.toggleAccordion();
      document.getElementById("exerciseSelect").onchange = () => this.onExerciseSelectionChange();
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

        alert("Configuration updated successfully!");
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

    // Accordion toggle functionality
    toggleAccordion() {
      const header = document.getElementById("exerciseOptionsHeader");
      const content = document.getElementById("exerciseOptionsContent");
      const isExpanded = content.style.display === "block";

      if (isExpanded) {
        content.style.display = "none";
        header.querySelector("span").textContent = "▶ Exercise Options";
      } else {
        content.style.display = "block";
        header.querySelector("span").textContent = "▼ Exercise Options";
        this.populateExerciseDropdown();
      }
    }

    // Populate the dropdown with exercise options
    populateExerciseDropdown() {
      if (!this.currentExercise) return;

      const select = document.getElementById("exerciseSelect");
      select.innerHTML = ""; // Clear existing options

      // Add original exercise as first option
      const originalOption = document.createElement("option");
      originalOption.value = "original";
      originalOption.textContent = `${this.currentExercise} (Original)`;
      select.appendChild(originalOption);

      // Add alternative exercises
      const alternatives = config.alternatives[this.currentExercise] || [];
      alternatives.forEach(alt => {
        const option = document.createElement("option");
        option.value = alt.name;
        option.textContent = alt.name;
        select.appendChild(option);
      });

      // Set to original by default
      select.value = "original";
    }

    // Handle exercise selection change
    onExerciseSelectionChange() {
      const select = document.getElementById("exerciseSelect");
      const selectedValue = select.value;

      if (selectedValue === "original") {
        this.selectedAlternativeExercise = null;
        this.currentScaleFactor = 1.0;
      } else {
        this.selectedAlternativeExercise = selectedValue;
        const alternatives = config.alternatives[this.currentExercise] || [];
        const selectedAlt = alternatives.find(alt => alt.name === selectedValue);
        this.currentScaleFactor = selectedAlt ? selectedAlt.scale : 1.0;
      }

      // Refresh the workout display with new scaling
      this.refreshWorkoutDisplay();
    }

    // Refresh the workout display with current scaling
    refreshWorkoutDisplay() {
      // Store current database query to avoid re-querying
      const transaction = this.db.transaction(["lifts"], "readonly");
      const store = transaction.objectStore("lifts");
      const index = store.index("exercise");
      const request = index.getAll(this.currentExercise);

      request.onsuccess = (event) => {
        const records = event.target.result;
        if (!records.length) return;

        const lastWorkout = records[records.length - 1];
        this.displayCurrentWorkoutWithScaling(lastWorkout);
      };
    }

    // Convert weight back to original exercise equivalent for saving
    convertToOriginalEquivalent(actualReps, actualWeight) {
      if (this.selectedAlternativeExercise && this.currentScaleFactor !== 1.0) {
        // Convert actual weight back to original exercise equivalent
        const originalEquivalentWeight = actualWeight / this.currentScaleFactor;

        // Calculate what this performance would be in terms of original exercise reps
        // Get the original prescribed weight for set 3
        const originalPrescribedWeight = this.getOriginalPrescribedWeight();

        // Use effective reps calculation with original equivalent weight
        const effectiveRepsValue = this.effectiveReps(actualReps, originalEquivalentWeight, originalPrescribedWeight);

        return {
          equivalentWeight: originalEquivalentWeight,
          effectiveReps: effectiveRepsValue
        };
      }

      // If using original exercise, return as-is
      const originalPrescribedWeight = this.getOriginalPrescribedWeight();
      const effectiveRepsValue = this.effectiveReps(actualReps, actualWeight, originalPrescribedWeight);

      return {
        equivalentWeight: actualWeight,
        effectiveReps: effectiveRepsValue
      };
    }

    // Get the original prescribed weight (without scaling)
    getOriginalPrescribedWeight() {
      // Calculate it directly since we need synchronous access
      let weightPercents;
      if (this.blockType === "leader") {
        weightPercents = config.setPercentagesLeader;
      } else {
        // We need the week info - let's get it from the UI
        const weekText = document.getElementById("weekNumber").textContent;
        const week = parseInt(weekText) || 1;
        weightPercents = config.setPercentagesAnchor[week];
      }

      const isDeloadWeek = this.consecutiveLowAMRAP[this.currentExercise] >= config.deloadTriggerConsecutiveLowAMRAP;
      let baseWeight = this.trainingMax[this.currentExercise] * weightPercents[2];

      if (isDeloadWeek) {
        baseWeight = Math.round(baseWeight * config.deloadPercentage);
      }

      return Math.round(baseWeight / 5) * 5;
    }

    // Display workout with scaling applied
    displayCurrentWorkoutWithScaling(initialData) {
      const lastWorkout = initialData;
      this.trainingMax[this.currentExercise] = lastWorkout.trainingMax;

      let cycle = lastWorkout.cycle;
      let week = lastWorkout.week;
      let isDeloadWeek = this.consecutiveLowAMRAP[this.currentExercise] >= config.deloadTriggerConsecutiveLowAMRAP;

      if (!isDeloadWeek && week === 3) {
        week = 1;
        cycle++;
        if (!config.disableLeaderBlock) {
          if (this.blockCounter === config.cyclesPerBlockType.leader && this.blockType === "leader") {
            this.blockType = "anchor";
            this.blockCounter = 1;
          } else if (this.blockCounter === config.cyclesPerBlockType.anchor && this.blockType === "anchor") {
            this.blockType = "leader";
            this.blockCounter = 1;
          } else {
            this.blockCounter++;
          }
        } else {
          this.blockType = "anchor";
        }
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

      // Apply scaling for alternative exercises
      let scaledWeights = deloadWeights.map(weight => Math.round((weight * this.currentScaleFactor) / 5) * 5);

      let setsHtml = "<h3>Prescribed Sets</h3>";
      scaledWeights.forEach((weight, i) => {
        let repInfo = i === 2 ? ` (Target: ${targetReps} reps)` : "";
        setsHtml += `<p>Set ${i + 1}: ${weight} lbs x ${deloadReps[i]} reps${repInfo}</p>`;
      });

      // Add alternative exercise styling if not using original
      const prescribedSetsElement = document.getElementById("prescribedSets");
      if (this.selectedAlternativeExercise) {
        prescribedSetsElement.classList.add("alternative-exercise");
        setsHtml = setsHtml.replace("<h3>Prescribed Sets</h3>", `<h3>Prescribed Sets (${this.selectedAlternativeExercise})</h3>`);
      } else {
        prescribedSetsElement.classList.remove("alternative-exercise");
      }

      prescribedSetsElement.innerHTML = setsHtml;

      let bbbWeight = Math.round(this.trainingMax[this.currentExercise] * config.supplementWorkPercentage / 5) * 5;
      let bbbHtml = `<h3>Supplement Work</h3><p>BBB: 5x10 @ ${bbbWeight} lbs</p>`;
      document.getElementById("supplementWork").innerHTML = bbbHtml;

      document.getElementById("amrap").value = reps[2];
      // Update actual weight with scaling
      const baseActualWeight = Math.round((this.trainingMax[this.currentExercise] * weightPercents[2]) / 5) * 5;
      const scaledActualWeight = Math.round((baseActualWeight * this.currentScaleFactor) / 5) * 5;
      document.getElementById("actualWeight").value = scaledActualWeight;

      document.getElementById("cycleNumber").textContent = cycle || "N/A";
      document.getElementById("weekNumber").textContent = week || "N/A";
      document.getElementById("blockType").textContent = this.blockType ? this.blockType.charAt(0).toUpperCase() + this.blockType.slice(1) : "N/A";

      console.log(`Workout displayed: Cycle ${cycle}, Week ${week}, Block ${this.blockType}, Scale: ${this.currentScaleFactor}`);
    }

    selectExercise(exercise) {
      this.currentExercise = exercise;
      document.getElementById("exerciseName").textContent = exercise;

      // Reset alternative exercise selection when switching exercises
      this.selectedAlternativeExercise = null;
      this.currentScaleFactor = 1.0;

      // Collapse accordion and reset to original
      const content = document.getElementById("exerciseOptionsContent");
      const header = document.getElementById("exerciseOptionsHeader");
      content.style.display = "none";
      header.querySelector("span").textContent = "▶ Exercise Options";

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
          if (!config.disableLeaderBlock) {
            if (this.blockCounter === config.cyclesPerBlockType.leader && this.blockType === "leader") {
              this.blockType = "anchor";
              this.blockCounter = 1;
            } else if (this.blockCounter === config.cyclesPerBlockType.anchor && this.blockType === "anchor") {
              this.blockType = "leader";
              this.blockCounter = 1;
            } else {
              this.blockCounter++;
            }
          } else {
            this.blockType = "anchor";
          }
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

        // Ensure alternative exercise styling is removed for original exercise display
        const prescribedSetsElement = document.getElementById("prescribedSets");
        prescribedSetsElement.classList.remove("alternative-exercise");
        prescribedSetsElement.innerHTML = setsHtml;

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
          if (!isDeloadWeek && week === 3) {
            week = 1;
            cycle++;
            if (!config.disableLeaderBlock) {
              if (this.blockCounter === 2 && this.blockType === "leader") {
                this.blockType = "anchor";
                this.blockCounter = 1;
              } else if (this.blockCounter === 1 && this.blockType === "anchor") {
                this.blockType = "leader";
                this.blockCounter = 1;
              } else {
                this.blockCounter++;
              }
            } else {
              this.blockType = "anchor";
            }
          } else if (!isDeloadWeek) {
            week++;
          }
        }

        // Convert to original exercise equivalent if using alternative exercise
        const conversionResult = this.convertToOriginalEquivalent(actualReps, actualWeight);
        let effectiveRepsRounded = Math.round(conversionResult.effectiveReps);

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
          this.selectExercise(this.currentExercise);
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


    exportFullBackup() {
      // Get all object store names dynamically
      const objectStoreNames = Array.from(this.db.objectStoreNames);
      const transaction = this.db.transaction(objectStoreNames, "readonly");

      const exportPromises = objectStoreNames.map(storeName => {
        return new Promise((resolve, reject) => {
          const store = transaction.objectStore(storeName);
          const request = store.getAll();

          request.onsuccess = () => {
            resolve({
              storeName: storeName,
              data: request.result
            });
          };

          request.onerror = () => {
            reject(new Error(`Failed to export ${storeName}: ${request.error}`));
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

        // Organize data by store name
        storeData.forEach(({ storeName, data }) => {
          fullBackup.stores[storeName] = data;
        });

        const backupJson = JSON.stringify(fullBackup, null, 2);
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifts-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('Complete backup exported successfully!');
        console.log('Full backup exported:', fullBackup);
      }).catch(error => {
        console.error('Error exporting full backup:', error);
        alert('Error exporting backup. Please try again.');
      });
    }

    importFullBackup() {
      const fileInput = document.getElementById('backup-input');
      if (!fileInput) {
        // Create the input element if it doesn't exist
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'backup-input';
        input.accept = '.json';
        input.style.display = 'none';
        document.body.appendChild(input);
      }

      const input = document.getElementById('backup-input');
      input.click();

      input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const backupData = JSON.parse(e.target.result);

            // Validate backup structure
            if (!backupData.stores || typeof backupData.stores !== 'object') {
              alert('Invalid backup file format. Please upload a valid backup file.');
              return;
            }

            // Confirm with user before proceeding
            const confirmMessage = `This will completely replace all your current data with the backup from ${backupData.exportDate ? new Date(backupData.exportDate).toLocaleDateString() : 'unknown date'}.\n\nAre you sure you want to continue?`;

            if (!confirm(confirmMessage)) {
              return;
            }

            this.restoreFullBackup(backupData);
          } catch (error) {
            console.error('Error parsing backup file:', error);
            alert('Error reading backup file. Please upload a valid JSON file.');
          }
        };
        reader.readAsText(file);
      };
    }

    restoreFullBackup(backupData) {
      const objectStoreNames = Array.from(this.db.objectStoreNames);
      const transaction = this.db.transaction(objectStoreNames, "readwrite");

      // Clear all existing stores first
      const clearPromises = objectStoreNames.map(storeName => {
        return new Promise((resolve, reject) => {
          const store = transaction.objectStore(storeName);
          const clearRequest = store.clear();

          clearRequest.onsuccess = () => resolve(storeName);
          clearRequest.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
        });
      });

      Promise.all(clearPromises).then(clearedStores => {
        console.log('Cleared stores:', clearedStores);

        // Restore data to each store
        const restorePromises = [];

        for (const [storeName, storeData] of Object.entries(backupData.stores)) {
          if (objectStoreNames.includes(storeName) && Array.isArray(storeData)) {
            const store = transaction.objectStore(storeName);

            storeData.forEach(record => {
              restorePromises.push(new Promise((resolve, reject) => {
                const putRequest = store.put(record);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
              }));
            });
          }
        }

        Promise.all(restorePromises).then(() => {
          // Update in-memory config from restored data
          if (backupData.stores.config) {
            backupData.stores.config.forEach(({ key, value }) => {
              if (config.hasOwnProperty(key)) {
                config[key] = value;
              }
            });
          }

          transaction.oncomplete = () => {
            alert('Backup restored successfully!');
            console.log('Full backup restored from:', backupData.exportDate);

            // Refresh the current exercise display if one is selected
            if (this.currentExercise) {
              this.selectExercise(this.currentExercise);
            }
          };

          transaction.onerror = (event) => {
            console.error('Error during restore transaction:', event.target.error);
            alert('Error restoring backup. Please try again.');
          };
        }).catch(error => {
          console.error('Error restoring individual records:', error);
          alert('Error restoring backup data. Please try again.');
        });

      }).catch(error => {
        console.error('Error clearing existing data:', error);
        alert('Error clearing existing data. Please try again.');
      });
    }
  }

  // Initialize the application
  const app = new LiftTracker();
});

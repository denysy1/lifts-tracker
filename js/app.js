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
    const db = event.target.result;

    let currentExercise = null;
    let trainingMax = {};

    let consecutiveLowAMRAP = {
      "Overhead Press": 0,
      "Bench Press": 0,
      "Squat": 0,
      "Deadlift": 0
    };

    // Load configuration from IndexedDB to overwrite defaults
    loadConfigFromDB();

    let blockType = "anchor"; // Default block type
    let blockCounter = 1; // Tracks number of leader/anchor blocks

    document.getElementById("overhead-press-btn").onclick = () => selectExercise("Overhead Press");
    document.getElementById("bench-press-btn").onclick = () => selectExercise("Bench Press");
    document.getElementById("squat-btn").onclick = () => selectExercise("Squat");
    document.getElementById("deadlift-btn").onclick = () => selectExercise("Deadlift");

    document.getElementById("initializeExercise").onclick = initializeTrainingMax;
    document.getElementById("save").onclick = saveProgress;
    document.getElementById("clear-last-entry").onclick = clearLastEntry;
    document.getElementById("view-history").onclick = viewHistory;
    document.getElementById("amrap-plus").onclick = () => adjustAmrapReps(1);
    document.getElementById("amrap-minus").onclick = () => adjustAmrapReps(-1);
    // New event listeners for Actual Weight plus/minus buttons
    document.getElementById("actualWeight-plus").onclick = () => adjustActualWeight(5);
    document.getElementById("actualWeight-minus").onclick = () => adjustActualWeight(-5);
    document.getElementById("showAlternativeWeightsBtn").onclick = () => showAlternativeWeights();
    document.getElementById("export-history").onclick = () => exportHistory();
    document.getElementById("import-history").onclick = () => importHistory();
    document.getElementById("import-config").onclick = loadConfigFile;

    function loadConfigFromDB() {
      const transaction = db.transaction(["config"], "readonly");
      const store = transaction.objectStore("config");
    
      store.getAll().onsuccess = (event) => {
        const configs = event.target.result;
    
        configs.forEach(({ key, value }) => {
          if (config.hasOwnProperty(key)) {
            config[key] = value; // Assign value to the config object
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
     
    function loadConfigFile() {
      const fileInput = document.getElementById("configFileInput");
      fileInput.click();
    
      fileInput.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const configData = JSON.parse(e.target.result);
              saveConfigToDB(configData);
            } catch (error) {
              alert("Invalid configuration file. Please upload a valid JSON file.");
            }
          };
          reader.readAsText(file);
        }
      };
    }
    
    function saveConfigToDB(newConfig) {
      const transaction = db.transaction(["config"], "readwrite");
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
    
    function adjustAmrapReps(change) {
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
    
    // adjust the actual weight input (in 5 lb increments)
    function adjustActualWeight(change) {
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
    
    // New effectiveReps function so the conversion logic is isolated
    function effectiveReps(actualReps, actualWeight, prescribedWeight) {

      if (actualWeight <= 0) return 0;
      // Calculate the estimated 1RM from the actual performance.
      // 1RM_actual = actualWeight / (1.0278 - 0.0278 * actualReps)
      const oneRM_actual = actualWeight / (config.oneRM_correction_factor * (1.0278 - 0.0278 * actualReps));
      // Now, solve for effective reps (R_eff)
      const effectiveRepsValue = (1.0278 - (prescribedWeight / oneRM_actual)) / 0.0278;
      return effectiveRepsValue;
    }
    
    function showAlternativeWeights() {
      if (!currentExercise || !trainingMax[currentExercise]) {
        alert("Please select an exercise and initialize your training max first.");
        return;
      }

      const altExercises = config.alternatives[currentExercise];
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
    
    function hideAlternativeWeights() {
      const altWeightsElement = document.getElementById("alternativeWeights");
      if (altWeightsElement) {
        altWeightsElement.innerHTML = "";
        altWeightsElement.style.display = "none";
      } else {
        console.warn("#alternativeWeights element is missing or not loaded in the DOM.");
      }
    }
    
    function selectExercise(exercise) {
      currentExercise = exercise;
      document.getElementById("exerciseName").textContent = exercise;

      const transaction = db.transaction(["lifts"], "readonly");
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
          blockType = lastEntry.blockType || "leader";
          blockCounter = lastEntry.blockCounter || 1;
          consecutiveLowAMRAP[currentExercise] = lastEntry.consecutiveLowAMRAP || 0;
          displayCurrentWorkout(lastEntry);
        }
      };
    }
    
    function initializeTrainingMax() {
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
      trainingMax[currentExercise] = Math.floor(estimated1RM * config.trainingMaxInitializationFactor);
    
      const transaction = db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
    
      const newEntry = {
        exercise: currentExercise,
        cycle: 1,
        week: 0,
        blockType: "leader",
        blockCounter: 1,
        trainingMax: trainingMax[currentExercise],
        amrapReps: null,
        date: new Date().toLocaleString(),
        consecutiveLowAMRAP: 0
      };
    
      const request = store.add(newEntry);
    
      request.onsuccess = () => {
        document.getElementById("initialization").style.display = "none";
        document.getElementById("tracker").style.display = "block";
        displayCurrentWorkout(newEntry);
      };
    }
    
    
    function displayCurrentWorkout(initialData) {
      const transaction = db.transaction(["lifts"], "readonly");
      const store = transaction.objectStore("lifts");
      const index = store.index("exercise");
      const request = index.getAll(currentExercise);

      request.onsuccess = (event) => {
        hideAlternativeWeights();
        const records = event.target.result;
        if (!records.length) {
          console.error("No records found for the selected exercise.");
          return;
        }

        const lastWorkout = initialData || records[records.length - 1];
        trainingMax[currentExercise] = lastWorkout.trainingMax;

        let cycle = lastWorkout.cycle;
        let week = lastWorkout.week;
        let isDeloadWeek = consecutiveLowAMRAP[currentExercise] >= config.deloadTriggerConsecutiveLowAMRAP;

        if (!isDeloadWeek && week === 3) {
          week = 1;
          cycle++;
          if (!config.disableLeaderBlock) {
            if (blockCounter === config.cyclesPerBlockType.leader && blockType === "leader") {
              blockType = "anchor";
              blockCounter = 1;
            } else if (blockCounter === config.cyclesPerBlockType.anchor && blockType === "anchor") {
              blockType = "leader";
              blockCounter = 1;
            } else {
              blockCounter++;
            }
          } else {
            blockType = "anchor";
          }
        } else if (!isDeloadWeek) {
          week++;
        }

        const weightPercents = blockType === "leader" ? config.setPercentagesLeader : config.setPercentagesAnchor[week];
        const reps = blockType === "leader" ? config.setRepsLeader : config.setRepsAnchor[week];
        const targetReps = blockType === "anchor" ? config.targetRepsAnchor[week] : reps[2];


        let deloadReps = reps;
        let deloadWeights = weightPercents.map(percent => Math.round(trainingMax[currentExercise] * percent));

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

        let bbbWeight = Math.round(trainingMax[currentExercise] * config.supplementWorkPercentage / 5) * 5;
        let bbbHtml = `<h3>Supplement Work</h3><p>BBB: 5x10 @ ${bbbWeight} lbs</p>`;
        document.getElementById("supplementWork").innerHTML = bbbHtml;

        document.getElementById("amrap").value = reps[2];
        // Optionally, you might set a default for actualWeight as well
        document.getElementById("actualWeight").value = Math.round((trainingMax[currentExercise] * weightPercents[2]) / 5) * 5;

        document.getElementById("cycleNumber").textContent = cycle || "N/A";
        document.getElementById("weekNumber").textContent = week || "N/A";
        document.getElementById("blockType").textContent = blockType ? blockType.charAt(0).toUpperCase() + blockType.slice(1) : "N/A";

        console.log(`Workout displayed: Cycle ${cycle}, Week ${week}, Block ${blockType}`);
      };

      request.onerror = (event) => {
        console.error("Error retrieving workout data:", event.target.error);
      };
    }
    
    function saveProgress() {
      // Read the actual reps and the new actual weight for set 3
      const actualReps = parseInt(document.getElementById("amrap").value);
      const actualWeight = parseInt(document.getElementById("actualWeight").value);

      const transaction = db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
      const request = store.index("exercise").getAll(currentExercise);

      request.onsuccess = (event) => {
        const records = event.target.result;
        let cycle, week, trainingMax;
        let isFirstSave = records.length === 1 && records[0].week === 0;
        let isDeloadWeek = consecutiveLowAMRAP[currentExercise] >= 1;

        if (isFirstSave) {
          cycle = 1;
          week = 1;
          trainingMax = records[0].trainingMax;
        } else {
          const lastEntry = records[records.length - 1];
          cycle = lastEntry.cycle;
          week = lastEntry.week;
          trainingMax = lastEntry.trainingMax;
          blockType = lastEntry.blockType;
          blockCounter = lastEntry.blockCounter;
          if (week === 3) {
            week = 1;
            cycle++;
            if (!config.disableLeaderBlock) {
              if (blockCounter === 2 && blockType === "leader") {
                blockType = "anchor";
                blockCounter = 1;
              } else if (blockCounter === 1 && blockType === "anchor") {
                blockType = "leader";
                blockCounter = 1;
              } else {
                blockCounter++;
              }
            } else {
              blockType = "anchor";
            }
          } else {
            week++;
          }
        }

        // Calculate prescribed weight for the third set
        let weightPercents;
        if (blockType === "leader") {
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

        // Compute effective reps using the new helper function
        let effectiveRepsValue = effectiveReps(actualReps, actualWeight, prescribedWeight);
        // For simplicity, round the effective reps to the nearest whole number
        let effectiveRepsRounded = Math.round(effectiveRepsValue);

        const increment = config.incrementValues[currentExercise];

        // Update training max based on effective reps instead of raw reps
        if (!isFirstSave && week === 3 && effectiveRepsRounded >= 0) {
          if (effectiveRepsRounded === 0) {
            trainingMax -= increment;
            consecutiveLowAMRAP[currentExercise]++;
          } else if (effectiveRepsRounded < 5) {
            trainingMax += increment;
            consecutiveLowAMRAP[currentExercise]++;
          } else {
            trainingMax += increment;
            // Accelerated incrementing logic:
            for (let i = 0; i < config.amrapProgressionThresholds.length; i++) {
              if (effectiveRepsRounded >= config.amrapProgressionThresholds[i]) {
                trainingMax += increment * config.amrapProgressionIncrementMultipliers[i];
              }
            }
            consecutiveLowAMRAP[currentExercise] = 0;
          }
        }

        const newEntry = {
          exercise: currentExercise,
          cycle,
          week,
          trainingMax,
          blockType,
          blockCounter,
          amrapReps: effectiveRepsRounded, // Store the effective reps for record-keeping
          date: new Date().toLocaleString(),
          consecutiveLowAMRAP: consecutiveLowAMRAP[currentExercise]
        };

        const addRequest = store.add(newEntry);
        addRequest.onsuccess = () => {
          // Easter egg logic
          if (currentExercise === "Squat" && effectiveRepsRounded >= 20) {
            const audio = new Audio("img/yb.mp3");
            audio.play();
          }
          alert("Progress saved!");
          selectExercise(currentExercise);
        };
      };
    }
    
    function clearLastEntry() {
      const transaction = db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
      const index = store.index("exercise");
      const request = index.getAllKeys(currentExercise);

      request.onsuccess = (event) => {
        const keys = event.target.result;
        if (keys.length > 0) {
          const lastKey = keys[keys.length - 1];
          store.delete(lastKey).onsuccess = () => {
            alert("Last entry cleared.");
            selectExercise(currentExercise);
          };
        } else {
          alert("No entry to clear.");
        }
      };
    }
    
    function viewHistory() {
      const transaction = db.transaction(["lifts"], "readonly");
      const store = transaction.objectStore("lifts");
      const request = store.index("exercise").getAll(currentExercise);

      request.onsuccess = (event) => {
        const records = event.target.result;
        let historyHtml = `<h2>History for ${currentExercise}</h2>`;
        records.forEach(record => {
          if (record.date && record.amrapReps !== null) {
            historyHtml += `<p>${record.date}: Cycle ${record.cycle}, Week ${record.week}, Training Max: ${record.trainingMax} lbs, AMRAP (Effective) Reps: ${record.amrapReps}</p>`;
          }
        });
        document.getElementById("history").innerHTML = historyHtml;
      };
    }
    
    function exportHistory() {
      const transaction = db.transaction(["lifts"], "readonly");
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
    
    function importHistory() {
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
                overwriteHistory(importedData);
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
    
    function overwriteHistory(data) {
      const transaction = db.transaction(["lifts"], "readwrite");
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
  };
});

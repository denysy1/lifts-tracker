document.addEventListener("DOMContentLoaded", () => {
    const request = indexedDB.open("GymTrackerDB", 1);
  
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const store = db.createObjectStore("lifts", { keyPath: "id", autoIncrement: true });
      store.createIndex("exercise", "exercise", { unique: false });
    };
  
    request.onsuccess = (event) => {
      const db = event.target.result;
  
      let currentExercise = null;
      let trainingMax = {};
      const setPercentagesLeader = [0.65, 0.75, 0.85]; // 5s PRO percentages
      const setPercentagesAnchor = { 1: [0.65, 0.75, 0.85], 2: [0.70, 0.80, 0.90], 3: [0.75, 0.85, 0.95] }; // Anchor percentages
      const setRepsLeader = [5, 5, 5]; // 5s PRO reps
      const setRepsAnchor = { 1: [5, 5, 5], 2: [3, 3, 3], 3: [5, 3, 1] };
  
      const incrementValues = {
        "Overhead Press": 5,
        "Bench Press": 5,
        "Squat": 10,
        "Deadlift": 10
      };
  
      let consecutiveLowAMRAP = {
        "Overhead Press": 0,
        "Bench Press": 0,
        "Squat": 0,
        "Deadlift": 0
      };
  
      let blockType = "leader"; // Default block type
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
      document.getElementById("showAlternativeWeightsBtn").onclick = () => showAlternativeWeights();

      function adjustAmrapReps(change) {
        const amrapField = document.getElementById("amrap");
        let currentValue = parseInt(amrapField.value);
    
        // Ensure the current value is a valid number
        if (isNaN(currentValue)) {
            currentValue = 0;
        }
    
        // Adjust the value
        currentValue += change;
    
        // Prevent negative reps
        if (currentValue < 0) {
            currentValue = 0;
        }
    
        // Update the input field with the new value
        amrapField.value = currentValue;
      }
    

      function showAlternativeWeights() {
        if (!currentExercise || !trainingMax[currentExercise]) {
            alert("Please select an exercise and initialize your training max first.");
            return;
        }
    
        // Define alternative exercises and scaling factors
        const alternatives = {
            "Overhead Press": [
                { name: "Dumbbell Overhead Press", scale: 0.8 }
            ],
            "Bench Press": [
                { name: "Incline Bench Press", scale: 0.9 },
                { name: "Decline Bench Press", scale: 1.0 },
                { name: "Dumbbell Press", scale: 0.75 },
                { name: "Incline Dumbbell Press", scale: 0.7 }
            ],
            "Squat": [
                { name: "Leg Press", scale: 2.0 }
            ],
            "Deadlift": [
                { name: "Leg Curls", scale: 0.5 }
            ]
        };
    
        const altExercises = alternatives[currentExercise];
        if (!altExercises) {
            alert("No alternative exercises available for this lift.");
            return;
        }
    
        // Calculate and display alternative weights
        const weights = altExercises.map(
            alt => `${alt.name}: ${Math.round(trainingMax[currentExercise] * alt.scale)} lbs`
        ).join("<br>");
    
        const alternativeWeightsText = `<h3>Alternative Weights</h3>${weights}`;
        const altWeightsElement = document.getElementById("alternativeWeights");
    
        altWeightsElement.innerHTML = alternativeWeightsText;
        altWeightsElement.style.display = "block"; // Explicitly make it visible
      }
    

        // Function to hide alternative weights
        function hideAlternativeWeights() {
            const altWeightsElement = document.getElementById("alternativeWeights");
        
            // Check if the element exists before modifying it
            if (altWeightsElement) {
                altWeightsElement.innerHTML = ""; // Clear contents
                altWeightsElement.style.display = "none"; // Hide element
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
        const oneRepMax = parseInt(document.getElementById("trainingMaxInput").value);
        trainingMax[currentExercise] = Math.floor(oneRepMax * 0.9);
  
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
            let isDeloadWeek = consecutiveLowAMRAP[currentExercise] >= 1;
    
            // Determine block type and transition logic
            if (!isDeloadWeek && week === 3) {
                week = 1;
                cycle++;
                if (blockCounter === 2 && blockType === "leader") {
                    blockType = "anchor";
                    blockCounter = 1;
                } else if (blockCounter === 1 && blockType === "anchor") {
                    blockType = "leader";
                    blockCounter = 1;
                } else {
                    blockCounter++;
                }
            } else if (!isDeloadWeek) {
                week++;
            }
    
            const weightPercents = blockType === "leader" ? setPercentagesLeader : setPercentagesAnchor[week];
            const reps = blockType === "leader" ? setRepsLeader : setRepsAnchor[week];
    
            let deloadReps = reps;
            let deloadWeights = weightPercents.map(percent => Math.round(trainingMax[currentExercise] * percent));
    
            // Deload adjustments
            if (isDeloadWeek) {
                document.getElementById("deloadNotice").textContent = "Deload Week: Reduced volume for recovery";
                deloadReps = reps.map(r => Math.ceil(r * 0.7)); // Reduce volume by 30%
                deloadWeights = deloadWeights.map(weight => Math.round(weight * 0.7)); // Reduce intensity by 30%
            } else {
                document.getElementById("deloadNotice").textContent = "";
            }
    
            // Display prescribed sets
            let setsHtml = "<h3>Prescribed Sets</h3>";
            deloadWeights.forEach((weight, i) => {
                setsHtml += `<p>Set ${i + 1}: ${weight} lbs x ${deloadReps[i]} reps</p>`;
            });
            document.getElementById("prescribedSets").innerHTML = setsHtml;
    
            // Add Supplement Work (BBB: 5 sets of 10 reps at 50% training max)
            let bbbWeight = Math.round(trainingMax[currentExercise] * 0.5);
            let bbbHtml = `<h3>Supplement Work</h3><p>BBB: 5x10 @ ${bbbWeight} lbs</p>`;
            document.getElementById("supplementWork").innerHTML = bbbHtml;
    
            // Update AMRAP, cycle/week info, and block type
            document.getElementById("amrap").value = reps[2];
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
        const amrapReps = parseInt(document.getElementById("amrap").value);
        const increment = incrementValues[currentExercise];
  
        const transaction = db.transaction(["lifts"], "readwrite");
        const store = transaction.objectStore("lifts");
  
        const request = store.index("exercise").getAll(currentExercise);
  
        request.onsuccess = (event) => {
          const records = event.target.result;
  
          let cycle, week, trainingMax;
          let isFirstSave = records.length === 1 && records[0].week === 0;
          let isDeloadWeek = consecutiveLowAMRAP[currentExercise] >= 1;

          if (isDeloadWeek) {
              alert("Deload Week: Rest and recovery. No progress saved.");
              consecutiveLowAMRAP[currentExercise] = 0;
              const lastRecord = records[records.length - 1];
              displayCurrentWorkout(lastRecord);
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
            blockType = lastEntry.blockType;
            blockCounter = lastEntry.blockCounter;
  
            if (week === 3) {
              week = 1;
              cycle++;
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
              week++;
            }
          }

          if (!isFirstSave && week === 3 && amrapReps >= 0) {
            if (amrapReps === 0) {
                trainingMax -= increment;
                consecutiveLowAMRAP[currentExercise]++;
            } else if (amrapReps < 5) {
                trainingMax += increment;
                consecutiveLowAMRAP[currentExercise]++;
            } else {
                trainingMax += increment;
                if (amrapReps >= 10) trainingMax += 5;
                if (amrapReps >= 15) trainingMax += 5;
                if (amrapReps >= 20) trainingMax += 5;
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
            amrapReps,
            date: new Date().toLocaleString(),
            consecutiveLowAMRAP: consecutiveLowAMRAP[currentExercise]
          };
  
          const addRequest = store.add(newEntry);
          addRequest.onsuccess = () => {
            alert("Progress saved!");
            displayCurrentWorkout(newEntry);
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
              historyHtml += `<p>${record.date}: Cycle ${record.cycle}, Week ${record.week}, Training Max: ${record.trainingMax} lbs, AMRAP Reps: ${record.amrapReps}</p>`;
            }
          });
  
          document.getElementById("history").innerHTML = historyHtml;
        };
      }
    };
  });
  
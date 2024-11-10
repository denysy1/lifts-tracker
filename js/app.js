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
      const setPercentages = { 1: [0.65, 0.75, 0.85], 2: [0.70, 0.80, 0.90], 3: [0.75, 0.85, 0.95] };
      const setReps = { 1: [5, 5, 5], 2: [3, 3, 3], 3: [5, 3, 1] };

      const incrementValues = {
          "Overhead Press": 5,
          "Bench Press": 5,
          "Squat": 10,
          "Deadlift": 10
      };

      // Track consecutive low AMRAP counts for each exercise
      let consecutiveLowAMRAP = {
          "Overhead Press": 0,
          "Bench Press": 0,
          "Squat": 0,
          "Deadlift": 0
      };

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
                  consecutiveLowAMRAP[currentExercise] = lastEntry.consecutiveLowAMRAP || 0; // Load saved value
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
              trainingMax: trainingMax[currentExercise],
              amrapReps: null,
              date: new Date().toLocaleString(),
              consecutiveLowAMRAP: 0
          };

          const request = store.add(newEntry);

          request.onsuccess = () => {
              console.log("Initial training max set:", trainingMax[currentExercise]);
              document.getElementById("initialization").style.display = "none";
              document.getElementById("tracker").style.display = "block";
              displayCurrentWorkout(newEntry); // Display the initialized workout
          };
      }

      function displayCurrentWorkout(initialData) {
          const transaction = db.transaction(["lifts"], "readonly");
          const store = transaction.objectStore("lifts");
          const index = store.index("exercise");
          const request = index.getAll(currentExercise);

          request.onsuccess = (event) => {
              const records = event.target.result;
              const lastWorkout = initialData || records[records.length - 1];
              trainingMax[currentExercise] = lastWorkout.trainingMax;

              let cycle = lastWorkout.cycle;
              let week = lastWorkout.week;

              let isDeloadWeek = consecutiveLowAMRAP[currentExercise] >= 2;

              if (isDeloadWeek) {
                  document.getElementById("deloadNotice").textContent = "Deload Week: Reduced volume for recovery";
                  //consecutiveLowAMRAP[currentExercise] = 0; // Reset counter after deload
              } else {
                  document.getElementById("deloadNotice").textContent = "";
                  if (week === 3) {
                      week = 1;
                      cycle++;
                  } else {
                      week++;
                  }
              }

              document.getElementById("cycleNumber").textContent = cycle;
              document.getElementById("weekNumber").textContent = week;

              const weightPercents = setPercentages[week];
              let reps = setReps[week];

              if (isDeloadWeek) {
                  reps = reps.map(r => Math.ceil(r * 0.7)); // Reduce reps by 30%
              }

              const weights = weightPercents.map(percent => Math.round(trainingMax[currentExercise] * percent));
              let setsHtml = "<h3>Prescribed Sets</h3>";
              weights.forEach((weight, i) => {
                  setsHtml += `<p>Set ${i + 1}: ${weight} lbs x ${reps[i]} reps</p>`;
              });
              document.getElementById("prescribedSets").innerHTML = setsHtml;
              document.getElementById("amrap").value = reps[2];

              console.log("Displayed workout for", currentExercise, "Cycle:", cycle, "Week:", week);
          };
      }

      function adjustAmrapReps(change) {
          const amrapInput = document.getElementById("amrap");
          amrapInput.value = Math.max(0, parseInt(amrapInput.value) + change);
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
            let isFirstSave = records.length === 1 && records[0].week === 0; // Check if this is the initial save
            let isDeloadWeek = consecutiveLowAMRAP[currentExercise] >= 2;
    
            if (isDeloadWeek) {
                // Skip saving progress and reset consecutiveLowAMRAP after deload week
                alert("Deload Week: Rest and recovery. No progress saved.");
                consecutiveLowAMRAP[currentExercise] = 0;
                return; // Exit the function without saving
            }
    
            if (isFirstSave) {
                // First save: start from week 1, cycle 1
                cycle = 1;
                week = 1;
                trainingMax = records[0].trainingMax;
            } else {
                const lastEntry = records[records.length - 1];
                cycle = lastEntry.cycle;
                week = lastEntry.week;
                trainingMax = lastEntry.trainingMax;
    
                // Regular week and cycle progression
                if (week === 3) {
                    week = 1;
                    cycle++;
                } else {
                    week++;
                }
            }
    
            // Handle AMRAP adjustments for non-initial weeks
            if (!isFirstSave && week === 3 && amrapReps >= 0) {
                if (amrapReps === 0) {
                    trainingMax -= increment;
                    consecutiveLowAMRAP[currentExercise]++;
                } else if (amrapReps < 5) {
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
                amrapReps,
                date: new Date().toLocaleString(),
                consecutiveLowAMRAP: consecutiveLowAMRAP[currentExercise]
            };
    
            const addRequest = store.add(newEntry);
            addRequest.onsuccess = () => {
                alert("Progress saved!");
                displayCurrentWorkout(newEntry);
            };
            addRequest.onerror = (err) => {
                console.error("Error adding new entry:", err);
            };
        };
        request.onerror = (err) => {
            console.error("Error retrieving last entry:", err);
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

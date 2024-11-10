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

    // Exercise buttons
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
          displayCurrentWorkout(records[records.length - 1]);
        }
      };
    }

    function initializeTrainingMax() {
      const oneRepMax = parseInt(document.getElementById("trainingMaxInput").value);
      trainingMax[currentExercise] = Math.floor(oneRepMax * 0.9);

      const transaction = db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");

      store.add({
        exercise: currentExercise,
        cycle: 1,
        week: 1,
        trainingMax: trainingMax[currentExercise],
        amrapReps: null,
        date: new Date().toLocaleString()
      });

      document.getElementById("initialization").style.display = "none";
      document.getElementById("tracker").style.display = "block";
      displayCurrentWorkout({
        cycle: 1,
        week: 1,
        trainingMax: trainingMax[currentExercise]
      });
    }

    function displayCurrentWorkout(data) {
      let { cycle, week, trainingMax: currentTrainingMax } = data;
      trainingMax[currentExercise] = currentTrainingMax;
      document.getElementById("cycleNumber").textContent = cycle;
      document.getElementById("weekNumber").textContent = week;
    
      const weights = setPercentages[week].map((percent) => Math.round(currentTrainingMax * percent));
      const reps = setReps[week];
      document.getElementById("prescribedSets").innerHTML = weights
        .map((weight, i) => `<p>Set ${i + 1}: ${weight} lbs x ${reps[i]} reps</p>`)
        .join("");
    
      document.getElementById("amrap").value = reps[2];
    }

    function adjustAmrapReps(change) {
      const amrapInput = document.getElementById("amrap");
      amrapInput.value = Math.max(0, parseInt(amrapInput.value) + change);
    }

    function saveProgress() {
      const amrapReps = parseInt(document.getElementById("amrap").value);
    
      const transaction = db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
    
      const request = store.index("exercise").getAll(currentExercise);
    
      request.onsuccess = (event) => {
        const records = event.target.result;
    
        let cycle, week, currentTrainingMax;
    
        if (records.length > 0) {
          const lastEntry = records[records.length - 1];
          ({ cycle, week, trainingMax: currentTrainingMax } = lastEntry);
    
          if (records.length === 1 && lastEntry.amrapReps === null) {
            store.put({
              ...lastEntry,
              amrapReps,
              date: new Date().toLocaleString()
            });
            week += 1;
          } else {
            if (week === 3) {
              currentTrainingMax += amrapReps >= 1 ? 5 : -5;
              week = 1;
              cycle += 1;
            } else {
              week += 1;
            }
    
            store.add({
              exercise: currentExercise,
              cycle,
              week,
              trainingMax: currentTrainingMax,
              amrapReps,
              date: new Date().toLocaleString()
            });
          }
    
        } else {
          cycle = 1;
          week = 1;
          currentTrainingMax = trainingMax[currentExercise];
    
          store.add({
            exercise: currentExercise,
            cycle,
            week,
            trainingMax: currentTrainingMax,
            amrapReps,
            date: new Date().toLocaleString()
          });
          week += 1;
        }
    
        alert("Progress saved!");
        displayCurrentWorkout({ cycle, week, trainingMax: currentTrainingMax });
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

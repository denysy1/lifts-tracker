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
      const maxWeight = parseInt(document.getElementById("trainingMax").value);
      if (!maxWeight) {
        alert("Please enter a valid training max");
        return;
      }
    
      const initialData = {
        exercise: currentExercise,
        cycle: 1,
        week: 1,
        trainingMax: maxWeight,
        amrapReps: null,
        date: new Date().toLocaleString()
      };
    
      const transaction = db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
      
      const request = store.add(initialData);
      request.onsuccess = () => {
        trainingMax[currentExercise] = maxWeight;
        displayCurrentWorkout(initialData);
        alert("Training max initialized!");
      };
    }
    
    function saveProgress() {
      // Get the currently displayed week/cycle (this is the workout being completed)
      const currentCycle = parseInt(document.getElementById("cycleNumber").textContent);
      const currentWeek = parseInt(document.getElementById("weekNumber").textContent);
      const amrapReps = parseInt(document.getElementById("amrap").value);
    
      const transaction = db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
    
      // Save the completed workout
      const entry = {
        exercise: currentExercise,
        cycle: currentCycle,
        week: currentWeek,
        trainingMax: trainingMax[currentExercise],
        amrapReps,
        date: new Date().toLocaleString()
      };
    
      const request = store.add(entry);
      request.onsuccess = () => {
        alert("Progress saved!");
        // displayCurrentWorkout will now show the next workout
        displayCurrentWorkout();
      };
    }

    function displayCurrentWorkout(initialData) {
      const transaction = db.transaction(["lifts"], "readonly");
      const store = transaction.objectStore("lifts");
      const index = store.index("exercise");
      const request = index.getAll(currentExercise);
    
      request.onsuccess = (event) => {
        const records = event.target.result;
        
        // If we have no records or we're initializing
        if (records.length === 0 || initialData) {
          const data = initialData || {
            cycle: 1,
            week: 1,
            trainingMax: trainingMax[currentExercise]
          };
          
          document.getElementById("cycleNumber").textContent = data.cycle;
          document.getElementById("weekNumber").textContent = data.week;
          trainingMax[currentExercise] = data.trainingMax;
        } 
        // If we have records, show the next workout based on the last completed one
        else {
          const lastWorkout = records[records.length - 1];
          trainingMax[currentExercise] = lastWorkout.trainingMax;
          
          let nextWeek = lastWorkout.week;
          let nextCycle = lastWorkout.cycle;
          
          if (nextWeek === 3) {
            nextWeek = 1;
            nextCycle++;
          } else {
            nextWeek++;
          }
          
          document.getElementById("cycleNumber").textContent = nextCycle;
          document.getElementById("weekNumber").textContent = nextWeek;
        }
    
        // Get the current display week and use it for calculations
        const displayWeek = parseInt(document.getElementById("weekNumber").textContent);
        const weightPercents = setPercentages[displayWeek];
        const reps = setReps[displayWeek];
        const weights = weightPercents.map(percent => 
          Math.round(trainingMax[currentExercise] * percent)
        );
    
        let setsHtml = "<h3>Prescribed Sets</h3>";
        weights.forEach((weight, i) => {
          setsHtml += `<p>Set ${i + 1}: ${weight} lbs x ${reps[i]} reps</p>`;
        });
        document.getElementById("prescribedSets").innerHTML = setsHtml;
        document.getElementById("amrap").value = reps[2];
      };
    }

    function adjustAmrapReps(change) {
      const amrapInput = document.getElementById("amrap");
      amrapInput.value = Math.max(0, parseInt(amrapInput.value) + change);
    }

    function saveProgress() {
      // Get the currently displayed week/cycle (this is the workout being completed)
      const currentCycle = parseInt(document.getElementById("cycleNumber").textContent);
      const currentWeek = parseInt(document.getElementById("weekNumber").textContent);
      const amrapReps = parseInt(document.getElementById("amrap").value);
    
      const transaction = db.transaction(["lifts"], "readwrite");
      const store = transaction.objectStore("lifts");
    
      // Save the completed workout
      const entry = {
        exercise: currentExercise,
        cycle: currentCycle,
        week: currentWeek,
        trainingMax: trainingMax[currentExercise],
        amrapReps,
        date: new Date().toLocaleString()
      };
    
      const request = store.add(entry);
      request.onsuccess = () => {
        alert("Progress saved!");
        // displayCurrentWorkout will now show the next workout
        displayCurrentWorkout();
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

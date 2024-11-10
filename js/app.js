const request = indexedDB.open("GymTrackerDB", 1);

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const store = db.createObjectStore("lifts", { keyPath: "id", autoIncrement: true });
  store.createIndex("exercise", "exercise", { unique: false });
};

request.onsuccess = (event) => {
  const db = event.target.result;

  let trainingMax = {};
  const setPercentages = { 1: [0.65, 0.75, 0.85], 2: [0.70, 0.80, 0.90], 3: [0.75, 0.85, 0.95] };
  const setReps = { 1: [5, 5, 5], 2: [3, 3, 3], 3: [5, 3, 1] };

  document.getElementById("initialize").onclick = initializeTrainingMax;
  document.getElementById("exercise").onchange = displayCurrentWorkout;
  document.getElementById("save").onclick = saveProgress;
  document.getElementById("view-history").onclick = viewHistory;
  document.getElementById("reset-history").onclick = resetHistory;
  document.getElementById("amrap-plus").onclick = () => adjustAmrapReps(1);
  document.getElementById("amrap-minus").onclick = () => adjustAmrapReps(-1);

  function initializeTrainingMax() {
    const oneRepMaxes = {
      "Overhead Press": parseInt(document.getElementById("overheadPressMax").value),
      "Bench Press": parseInt(document.getElementById("benchPressMax").value),
      "Squat": parseInt(document.getElementById("squatMax").value),
      "Deadlift": parseInt(document.getElementById("deadliftMax").value)
    };

    for (const exercise in oneRepMaxes) {
      trainingMax[exercise] = Math.floor(oneRepMaxes[exercise] * 0.9); // 90% of 1RM
      saveInitialData(exercise, trainingMax[exercise]);
    }

    document.getElementById("setup").style.display = "none";
    document.getElementById("tracker").style.display = "block";
    displayCurrentWorkout(); // Load the data for the selected exercise
  }

  function saveInitialData(exercise, initialTrainingMax) {
    // Store the initial training max in memory but don’t add to history
    const transaction = db.transaction(["lifts"], "readwrite");
    const store = transaction.objectStore("lifts");

    store.put({
      exercise,
      cycle: 1,
      week: 1,
      trainingMax: initialTrainingMax,
      amrapReps: null, // Set AMRAP Reps as null to indicate it's uninitialized
      date: null // Set date to null, so it doesn't show in history
    });
  }

  function displayCurrentWorkout() {
    const exercise = document.getElementById("exercise").value;

    const transaction = db.transaction(["lifts"], "readonly");
    const store = transaction.objectStore("lifts");
    const index = store.index("exercise");
    const request = index.getAll(exercise);

    request.onsuccess = (event) => {
      const records = event.target.result;
      if (records.length > 0) {
        const data = records[records.length - 1];
        trainingMax[exercise] = data.trainingMax;

        let cycle = data.cycle;
        let week = data.week;
        document.getElementById("cycleNumber").textContent = cycle;
        document.getElementById("weekNumber").textContent = week;

        const weightPercents = setPercentages[week];
        const reps = setReps[week];
        const weights = weightPercents.map(percent => Math.round(trainingMax[exercise] * percent));

        let setsHtml = "<h3>Prescribed Sets</h3>";
        weights.forEach((weight, i) => {
          setsHtml += `<p>Set ${i + 1}: ${weight} lbs x ${reps[i]} reps</p>`;
        });
        document.getElementById("prescribedSets").innerHTML = setsHtml;

        document.getElementById("amrap").value = reps[2]; // Default AMRAP reps to set 3 target
      } else {
        document.getElementById("cycleNumber").textContent = "1";
        document.getElementById("weekNumber").textContent = "1";
        document.getElementById("prescribedSets").innerHTML = "<p>Please initialize the training max.</p>";
      }
    };
  }

  function adjustAmrapReps(change) {
    const amrapInput = document.getElementById("amrap");
    amrapInput.value = parseInt(amrapInput.value) + change;
  }

  function saveProgress() {
    const exercise = document.getElementById("exercise").value;
    const amrapReps = parseInt(document.getElementById("amrap").value);

    const transaction = db.transaction(["lifts"], "readwrite");
    const store = transaction.objectStore("lifts");

    const request = store.index("exercise").getAll(exercise);

    request.onsuccess = (event) => {
      const records = event.target.result;
      const lastEntry = records[records.length - 1];
      let { cycle, week, trainingMax } = lastEntry;

      if (week === 3) {
        trainingMax += amrapReps >= 1 ? 5 : -5;
        week = 1;
        cycle += 1;
      } else {
        week += 1;
      }

      store.add({
        exercise,
        cycle,
        week,
        trainingMax,
        amrapReps,
        date: new Date().toLocaleString()
      });

      alert("Progress saved!");
      displayCurrentWorkout(); // Reload workout details for the updated cycle and week
    };
  }

  function viewHistory() {
    const exercise = document.getElementById("exercise").value;

    const transaction = db.transaction(["lifts"], "readonly");
    const store = transaction.objectStore("lifts");
    const request = store.index("exercise").getAll(exercise);

    request.onsuccess = (event) => {
      const records = event.target.result;
      let historyHtml = `<h2>History for ${exercise}</h2>`;

      records.forEach(record => {
        if (record.date && record.amrapReps !== null) { // Only show entries with actual data
          historyHtml += `<p>${record.date}: Cycle ${record.cycle}, Week ${record.week}, Training Max: ${record.trainingMax} lbs, AMRAP Reps: ${record.amrapReps}</p>`;
        }
      });

      document.getElementById("history").innerHTML = historyHtml;
    };
  }

function resetHistory() {
  const exercise = document.getElementById("exercise").value;
  
  if (confirm(`Are you sure you want to reset all history for ${exercise}? This action cannot be undone.`)) {
    const transaction = db.transaction(["lifts"], "readwrite");
    const store = transaction.objectStore("lifts");
    const index = store.index("exercise");
    const request = index.getAllKeys(exercise);

    request.onsuccess = (event) => {
      const keys = event.target.result;
      keys.forEach(key => store.delete(key));

      alert(`History for ${exercise} has been reset.`);
      location.reload(); // Reload the page to reset the state
    };

    request.onerror = (event) => {
      console.error("Error clearing history:", event.target.error);
      alert("An error occurred while resetting history. Please try again.");
    };
  }
}

};

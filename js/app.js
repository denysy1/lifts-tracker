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

  // Initialization and Save buttons
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
        // No history found, show initialization
        document.getElementById("initialization").style.display = "block";
        document.getElementById("tracker").style.display = "none";
      } else {
        // History found, display current workout
        document.getElementById("initialization").style.display = "none";
        document.getElementById("tracker").style.display = "block";
        displayCurrentWorkout();
      }
    };
  }

  function initializeTrainingMax() {
    const oneRepMax = parseInt(document.getElementById("trainingMaxInput").value);
    trainingMax[currentExercise] = Math.floor(oneRepMax * 0.9); // 90% of 1RM

    const transaction = db.transaction(["lifts"], "readwrite");
    const store = transaction.objectStore("lifts");

    store.add({
      exercise: currentExercise,
      cycle: 1,
      week: 1,
      trainingMax: trainingMax[currentExercise],
      amrapReps: null,
      date: null
    });

    document.getElementById("initialization").style.display = "none";
    document.getElementById("tracker").style.display = "block";
    displayCurrentWorkout();
  }

  function displayCurrentWorkout() {
    const transaction = db.transaction(["lifts"], "readonly");
    const store = transaction.objectStore("lifts");
    const index = store.index("exercise");
    const request = index.getAll(currentExercise);

    request.onsuccess = (event) => {
      const records = event.target.result;
      const data = records[records.length - 1];
      trainingMax[currentExercise] = data.trainingMax;

      let cycle = data.cycle;
      let week = data.week;
      document.getElementById("cycleNumber").textContent = cycle;
      document.getElementById("weekNumber").textContent = week;

      const weightPercents = setPercentages[week];
      const reps = setReps[week];
      const weights = weightPercents.map(percent => Math.round(trainingMax[currentExercise] * percent));

      let setsHtml = "<h3>Prescribed Sets</h3>";
      weights.forEach((weight, i) => {
        setsHtml += `<p>Set ${i + 1}: ${weight} lbs x ${reps[i]} reps</p>`;
      });
      document.getElementById("prescribedSets").innerHTML = setsHtml;

      document.getElementById("amrap").value = reps[2]; // Default AMRAP reps to set 3 target
    };
  }

  function adjustAmrapReps(change) {
    const amrapInput = document.getElementById("amrap");
    amrapInput.value = parseInt(amrapInput.value) + change;
  }

  function saveProgress() {
    const amrapReps = parseInt(document.getElementById("amrap").value);

    const transaction = db.transaction(["lifts"], "readwrite");
    const store = transaction.objectStore("lifts");

    const request = store.index("exercise").getAll(currentExercise);

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
        exercise: currentExercise,
        cycle,
        week,
        trainingMax,
        amrapReps,
        date: new Date().toLocaleString()
      });

      alert("Progress saved!");
      displayCurrentWorkout();
    };
  }

  function clearLastEntry() {
    const transaction = db.transaction(["lifts"], "readwrite");
    const store = transaction.objectStore("lifts");
    const

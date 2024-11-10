const request = indexedDB.open("GymTrackerDB", 1);

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const store = db.createObjectStore("lifts", { keyPath: "id", autoIncrement: true });
  store.createIndex("exercise", "exercise", { unique: false });
};

request.onsuccess = (event) => {
  const db = event.target.result;

  let currentCycle = 1;
  let currentWeek = 1;
  let trainingMax = {};
  const setPercentages = { 1: [0.65, 0.75, 0.85], 2: [0.70, 0.80, 0.90], 3: [0.75, 0.85, 0.95] };
  const setReps = { 1: [5, 5, 5], 2: [3, 3, 3], 3: [5, 3, 1] };

  document.getElementById("initialize").onclick = initializeTrainingMax;
  document.getElementById("exercise").onchange = displayCurrentWorkout;
  document.getElementById("save").onclick = saveProgress;
  document.getElementById("amrap-plus").onclick = () => adjustAmrapReps(1);
  document.getElementById("amrap-minus").onclick = () => adjustAmrapReps(-1);

  loadTrainingData();

  function initializeTrainingMax() {
    const oneRepMaxes = {
      "Overhead Press": parseInt(document.getElementById("overheadPressMax").value),
      "Bench Press": parseInt(document.getElementById("benchPressMax").value),
      "Squat": parseInt(document.getElementById("squatMax").value),
      "Deadlift": parseInt(document.getElementById("deadliftMax").value)
    };

    for (const exercise in oneRepMaxes) {
      trainingMax[exercise] = Math.floor(oneRepMaxes[exercise] * 0.9); // 90% of 1RM
    }

    saveTrainingData();
    document.getElementById("setup").style.display = "none";
    document.getElementById("tracker").style.display = "block";
    displayCurrentWorkout();
  }

  function loadTrainingData() {
    const transaction = db.transaction(["lifts"], "readonly");
    const store = transaction.objectStore("lifts");
    const request = store.openCursor(null, 'prev');

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const data = cursor.value;
        trainingMax[data.exercise] = data.trainingMax;
        currentCycle = data.cycle;
        currentWeek = data.week;
        document.getElementById("setup").style.display = "none";
        document.getElementById("tracker").style.display = "block";
        displayCurrentWorkout();
      }
    };
  }

  function saveTrainingData() {
    const transaction = db.transaction(["lifts"], "readwrite");
    const store = transaction.objectStore("lifts");

    for (const exercise in trainingMax) {
      store.put({
        exercise,
        cycle: currentCycle,
        week: currentWeek,
        trainingMax: trainingMax[exercise],
        date: new Date().toLocaleString()
      });
    }
  }

  function displayCurrentWorkout() {
    const exercise = document.getElementById("exercise").value;
    const weightPercents = setPercentages[currentWeek];
    const reps = setReps[currentWeek];
    const weights = weightPercents.map(percent => Math.round(trainingMax[exercise] * percent));

    document.getElementById("cycleNumber").textContent = currentCycle;
    document.getElementById("weekNumber").textContent = currentWeek;

    let setsHtml = "<h3>Prescribed Sets</h3>";
    weights.forEach((weight, i) => {
      setsHtml += `<p>Set ${i + 1}: ${weight} lbs x ${reps[i]} reps</p>`;
    });
    document.getElementById("prescribedSets").innerHTML = setsHtml;

    document.getElementById("amrap").value = reps[2]; // Default AMRAP reps to set 3 target
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

    store.add({
      exercise,
      cycle: currentCycle,
      week: currentWeek,
      trainingMax: trainingMax[exercise],
      amrapReps,
      date: new Date().toLocaleString()
    });

    if (currentWeek === 3) {
      trainingMax[exercise] += (amrapReps >= 1 ? 5 : -5); // Adjust training max at cycle end
      currentWeek = 1;
      currentCycle++;
    } else {
      currentWeek++;
    }

    saveTrainingData();
    alert("Progress saved!");
    displayCurrentWorkout();
  }
};

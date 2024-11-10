const request = indexedDB.open("GymTrackerDB", 1);

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  db.createObjectStore("lifts", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = (event) => {
  const db = event.target.result;
  let trainingMax = 100;  // Default initial training max, can be updated

  const setPercentages = {
    1: [0.65, 0.75, 0.85],
    2: [0.70, 0.80, 0.90],
    3: [0.75, 0.85, 0.95]
  };
  
  const setReps = {
    1: [5, 5, 5],
    2: [3, 3, 3],
    3: [5, 3, 1]
  };

  let currentCycle = 1;
  let currentWeek = 1;

  const exerciseSelect = document.getElementById("exercise");
  const trainingMaxInput = document.getElementById("trainingMax");
  const prescribedSetsDiv = document.getElementById("prescribedSets");
  const amrapInput = document.getElementById("amrap");

  // Load Training Max from DB or set default
  loadTrainingMax();

  document.getElementById("calculate").onclick = () => {
    trainingMax = parseInt(trainingMaxInput.value) || trainingMax;
    displayPrescribedSets(currentWeek);
  };

  document.getElementById("save").onclick = () => {
    const exercise = exerciseSelect.value;
    const amrapReps = parseInt(amrapInput.value);

    const transaction = db.transaction(["lifts"], "readwrite");
    const store = transaction.objectStore("lifts");

    store.add({
      exercise,
      cycle: currentCycle,
      week: currentWeek,
      trainingMax,
      amrapReps,
      date: new Date().toLocaleString()
    });

    adjustTrainingMax(amrapReps);

    alert("Progress saved!");
    currentWeek = (currentWeek % 3) + 1;
    if (currentWeek === 1) currentCycle++;
    loadTrainingMax();
  };

  function loadTrainingMax() {
    const transaction = db.transaction(["lifts"], "readonly");
    const store = transaction.objectStore("lifts");

    const request = store.openCursor(null, 'prev');
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        trainingMax = cursor.value.trainingMax;
        trainingMaxInput.value = trainingMax;
        currentCycle = cursor.value.cycle;
        currentWeek = cursor.value.week;
      }
    };
  }

  function displayPrescribedSets(week) {
    const weights = setPercentages[week].map(percentage => Math.round(trainingMax * percentage));
    const reps = setReps[week];
    prescribedSetsDiv.innerHTML = `<h3>Prescribed Sets for ${exerciseSelect.value}</h3>`;
    weights.forEach((weight, index) => {
      prescribedSetsDiv.innerHTML += `<p>Set ${index + 1}: ${weight} lbs x ${reps[index]} reps</p>`;
    });
  }

  function adjustTrainingMax(amrapReps) {
    if (currentWeek === 3) {
      trainingMax += (amrapReps >= 1 ? 5 : -5);
      trainingMaxInput.value = trainingMax;
    }
  }

  document.getElementById("view-history").onclick = () => {
    const transaction = db.transaction(["lifts"], "readonly");
    const store = transaction.objectStore("lifts");

    const historyDiv = document.getElementById("history");
    historyDiv.innerHTML = "<h2>History</h2>";

    store.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const { exercise, cycle, week, trainingMax, amrapReps, date } = cursor.value;
        historyDiv.innerHTML += `<p>${date}: ${exercise}, Cycle ${cycle}, Week ${week} - Training Max: ${trainingMax} lbs, AMRAP Reps: ${amrapReps}</p>`;
        cursor.continue();
      }
    };
  };
};

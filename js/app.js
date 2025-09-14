// Main application module - Refactored
import { ConfigManager } from './config.js';
import { DatabaseManager } from './database.js';
import { Stopwatch } from './stopwatch.js';
import { ExerciseConverter } from './exercise-converter.js';
import { UIManager } from './ui-utils.js';

class LiftTracker {
  constructor() {
    this.dbManager = new DatabaseManager();
    this.configManager = null;
    this.stopwatch = new Stopwatch();
    this.converter = null;
    this.ui = new UIManager();

    this.currentExercise = null;
    this.trainingMax = {};
    this.consecutiveLowAMRAP = {
      "Overhead Press": 0,
      "Bench Press": 0,
      "Squat": 0,
      "Deadlift": 0
    };
    this.blockType = "anchor";
    this.blockCounter = 1;
    this.selectedAlternativeExercise = null;
    this.currentScaleFactor = 1.0;

    this.init();
  }

  async init() {
    try {
      await this.dbManager.init();
      this.configManager = new ConfigManager(this.dbManager.getDB());
      await this.configManager.loadFromDB();
      this.converter = new ExerciseConverter(this.configManager.get('converter'));

      this.bindEventListeners();
      this.setupConverterModal();
      this.initPageNavigation(); // Initialize two-page system

      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.ui.showMessage('Failed to initialize application', 'error');
    }
  }

  bindEventListeners() {
    // Exercise selection buttons
    document.getElementById("overhead-press-btn").onclick = () => this.selectExercise("Overhead Press");
    document.getElementById("bench-press-btn").onclick = () => this.selectExercise("Bench Press");
    document.getElementById("squat-btn").onclick = () => this.selectExercise("Squat");
    document.getElementById("deadlift-btn").onclick = () => this.selectExercise("Deadlift");

    // Main action buttons
    document.getElementById("initializeExercise").onclick = () => this.initializeTrainingMax();
    document.getElementById("save").onclick = () => this.saveProgress();
    document.getElementById("clear-last-entry").onclick = () => this.clearLastEntry();
    document.getElementById("view-history").onclick = () => this.viewHistory();

    // Input adjustment buttons
    document.getElementById("amrap-plus").onclick = () => this.ui.adjustInputValue("amrap", 1);
    document.getElementById("amrap-minus").onclick = () => this.ui.adjustInputValue("amrap", -1);
    document.getElementById("actualWeight-plus").onclick = () => this.ui.adjustInputValue("actualWeight", 5);
    document.getElementById("actualWeight-minus").onclick = () => this.ui.adjustInputValue("actualWeight", -5);

    // Backup/restore buttons
    document.getElementById("backup").onclick = () => this.exportFullBackup();
    document.getElementById("restore").onclick = () => this.importFullBackup();
    document.getElementById("import-config").onclick = () => this.loadConfigFile();

    // Stopwatch controls
    document.getElementById("stopwatch-toggle").onclick = () => this.toggleStopwatch();
    document.getElementById("stopwatch-reset").onclick = () => this.resetStopwatch();

    // Exercise dropdown functionality
    document.getElementById("exerciseSelect").onchange = () => this.onExerciseSelectionChange();

    // Modal functionality
    document.getElementById("converter-btn").onclick = () => this.ui.openModal("converter-modal");
    document.querySelector(".close").onclick = () => this.ui.closeModal("converter-modal");
    document.getElementById("history-close").onclick = () => this.ui.closeModal("history-modal");
    window.onclick = (event) => {
      if (event.target === document.getElementById("converter-modal")) {
        this.ui.closeModal("converter-modal");
      }
      if (event.target === document.getElementById("history-modal")) {
        this.ui.closeModal("history-modal");
      }
    };
  }

  setupConverterModal() {
    // Setup converter form
    document.getElementById('converter-form').addEventListener('submit', (e) => this.handleConverterSubmit(e));

    // Setup mode toggle
    const modeRadios = document.querySelectorAll('input[name="targetMode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', () => this.toggleConverterTargetMode());
    });

    this.setupAwesompleteDropdowns();
  }

  setupAwesompleteDropdowns() {
    if (typeof Awesomplete === 'undefined' || !this.converter) return;

    const exerciseList = this.converter.getFormattedExerciseList();

    // Setup reference exercise dropdown
    const refComplete = new Awesomplete('input#refExerciseInput', {
      list: exerciseList,
      minChars: 0,
      maxItems: 20,
      autoFirst: true,
      sort: false,
      filter: (text, input) => {
        if (text === '────────────────────────────') return false;
        return Awesomplete.FILTER_CONTAINS(text, input);
      },
      item: (text, input) => {
        if (text === '────────────────────────────') {
          return Awesomplete.$.create("li", {
            innerHTML: '<span style="color: #999; font-size: 0.8em; pointer-events: none;">────────────────────────────</span>',
            "aria-selected": "false"
          });
        }
        return Awesomplete.ITEM(text, input);
      }
    });

    // Setup target exercise dropdown
    const targetComplete = new Awesomplete('input#targetExerciseInput', {
      list: exerciseList,
      minChars: 0,
      maxItems: 20,
      autoFirst: true,
      sort: false,
      filter: (text, input) => {
        if (text === '────────────────────────────') return false;
        return Awesomplete.FILTER_CONTAINS(text, input);
      },
      item: (text, input) => {
        if (text === '────────────────────────────') {
          return Awesomplete.$.create("li", {
            innerHTML: '<span style="color: #999; font-size: 0.8em; pointer-events: none;">────────────────────────────</span>',
            "aria-selected": "false"
          });
        }
        return Awesomplete.ITEM(text, input);
      }
    });

    // Add focus handlers
    document.getElementById('refExerciseInput').addEventListener('focus', function () {
      if (refComplete.ul.childNodes.length === 0) {
        refComplete.minChars = 0;
        refComplete.evaluate();
      }
      refComplete.open();
    });

    document.getElementById('targetExerciseInput').addEventListener('focus', function () {
      if (targetComplete.ul.childNodes.length === 0) {
        targetComplete.minChars = 0;
        targetComplete.evaluate();
      }
      targetComplete.open();
    });
  }

  toggleConverterTargetMode() {
    const mode = document.querySelector('input[name="targetMode"]:checked').value;

    if (mode === 'reps') {
      this.ui.showElement('targetRepsGroup');
      this.ui.hideElement('targetWeightGroup');
      document.getElementById('targetWeight').value = '';
    } else {
      this.ui.hideElement('targetRepsGroup');
      this.ui.showElement('targetWeightGroup');
      document.getElementById('targetReps').value = '';
    }
  }

  handleConverterSubmit(e) {
    e.preventDefault();
    this.clearConverterMessages();

    try {
      const refExerciseInput = document.getElementById('refExerciseInput').value.trim();
      const targetExerciseInput = document.getElementById('targetExerciseInput').value.trim();

      // Get exercise keys if provided, otherwise use null for no-exercise mode
      const refExercise = refExerciseInput ? this.converter.getExerciseKeyFromName(refExerciseInput) : null;
      const targetExercise = targetExerciseInput ? this.converter.getExerciseKeyFromName(targetExerciseInput) : null;

      const refWeight = parseFloat(document.getElementById('refWeight').value);
      const refReps = parseInt(document.getElementById('refReps').value, 10);
      const mode = document.querySelector('input[name="targetMode"]:checked').value;

      // Check if exercises are provided but invalid
      if (refExerciseInput && !refExercise) {
        this.showConverterError('Please select a valid reference exercise from the dropdown, or leave blank for same-exercise conversion.');
        return;
      }

      if (targetExerciseInput && !targetExercise) {
        this.showConverterError('Please select a valid target exercise from the dropdown, or leave blank for same-exercise conversion.');
        return;
      }

      if (isNaN(refWeight) || isNaN(refReps) || refWeight <= 0 || refReps <= 0) {
        this.showConverterError('Please enter valid reference weight and reps.');
        return;
      }

      let result;
      if (mode === 'reps') {
        const targetReps = parseInt(document.getElementById('targetReps').value, 10);
        if (isNaN(targetReps) || targetReps <= 0) {
          this.showConverterError('Please enter valid target reps.');
          return;
        }
        result = this.converter.convert({ refExercise, refWeight, refReps, targetExercise, targetReps, mode: 'reps' });
      } else {
        const targetWeight = parseFloat(document.getElementById('targetWeight').value);
        if (isNaN(targetWeight) || targetWeight <= 0) {
          this.showConverterError('Please enter valid target weight.');
          return;
        }
        result = this.converter.convert({ refExercise, refWeight, refReps, targetExercise, targetWeight, mode: 'weight' });
      }

      this.showConverterResult(result, { refExercise: refExercise || 'Same Exercise', refWeight, refReps }, { targetExercise: targetExercise || 'Same Exercise' });
    } catch (err) {
      this.showConverterError(err.message);
    }
  }

  showConverterResult(result, _ref, _target) {
    let resultHTML;

    if (result.mode === 'reps') {
      resultHTML = `Recommend: ${result.targetWeight.toFixed(1)} lbs x ${result.targetReps} reps`;
    } else {
      resultHTML = `Recommend: ${result.targetWeight.toFixed(1)} lbs x ${result.targetReps.toFixed(0)} reps`;
    }

    this.ui.updateHTML('converter-result', resultHTML);
  }

  showConverterError(message) {
    this.ui.updateHTML('converter-result', `<div style="color:#d32f2f;font-weight:bold;">${message}</div>`);
  }

  clearConverterMessages() {
    this.ui.updateHTML('converter-result', '');
    this.ui.updateHTML('converter-error-message', '');
  }

  toggleExerciseOptions() {
    const isExpanded = this.ui.toggleAccordion("exerciseOptionsHeader", "exerciseOptionsContent");
    if (isExpanded) {
      this.populateExerciseDropdown();
    }
  }

  populateExerciseDropdown() {
    if (!this.currentExercise) return;

    const options = [
      { value: "original", text: `${this.currentExercise} (Original)` }
    ];

    const alternatives = this.configManager.get('alternatives')[this.currentExercise] || [];
    alternatives.forEach(alt => {
      options.push({ value: alt.name, text: alt.name });
    });

    // Determine the correct selected value
    const selectedValue = this.selectedAlternativeExercise || "original";

    this.ui.populateSelect("exerciseSelect", options, selectedValue);

    // Re-bind the event listener after populating the dropdown
    const selectElement = document.getElementById("exerciseSelect");
    if (selectElement) {
      selectElement.onchange = () => this.onExerciseSelectionChange();
    }
  }

  onExerciseSelectionChange() {
    const selectedValue = document.getElementById("exerciseSelect").value;

    if (selectedValue === "original") {
      this.selectedAlternativeExercise = null;
      this.currentScaleFactor = 1.0;
    } else {
      this.selectedAlternativeExercise = selectedValue;
      const alternatives = this.configManager.get('alternatives')[this.currentExercise] || [];
      const selectedAlt = alternatives.find(alt => alt.name === selectedValue);
      this.currentScaleFactor = selectedAlt ? selectedAlt.scale : 1.0;
    }

    this.refreshWorkoutDisplay();
  }

  async refreshWorkoutDisplay() {
    try {
      const records = await this.dbManager.getExerciseRecords(this.currentExercise);
      if (records.length > 0) {
        const lastWorkout = records[records.length - 1];
        this.displayCurrentWorkoutWithScaling(lastWorkout);
      }
    } catch (error) {
      console.error('Error refreshing workout display:', error);
    }
  }

  async selectExercise(exercise) {
    this.currentExercise = exercise;
    this.ui.updateText("exerciseName", exercise);

    // Update exercise button visual states
    this.updateExerciseButtonStates(exercise);

    // Reset alternative exercise selection
    this.selectedAlternativeExercise = null;
    this.currentScaleFactor = 1.0;

    // Collapse accordion
    this.ui.hideElement("exerciseOptionsContent");
    const header = document.getElementById("exerciseOptionsHeader");
    if (header) {
      header.querySelector("span").textContent = "▶ Exercise Options";
    }

    try {
      const records = await this.dbManager.getExerciseRecords(exercise);

      if (records.length === 0) {
        // Hide stopwatch in initialization mode
        document.getElementById("stopwatch-section").classList.remove("show");
        this.ui.showElement("initialization");
        this.ui.hideElement("tracker");
      } else {
        // Show stopwatch when in tracker mode and update button state
        document.getElementById("stopwatch-section").classList.add("show");
        this.updateStopwatchButton();
        this.ui.hideElement("initialization");
        this.ui.showElement("tracker");
        const lastEntry = records[records.length - 1];
        this.blockType = lastEntry.blockType || "leader";
        this.blockCounter = lastEntry.blockCounter || 1;
        this.consecutiveLowAMRAP[this.currentExercise] = lastEntry.consecutiveLowAMRAP || 0;
        this.displayCurrentWorkout(lastEntry);
      }
    } catch (error) {
      console.error('Error selecting exercise:', error);
      this.ui.showMessage('Error loading exercise data', 'error');
    }
  }

  async initializeTrainingMax() {
    const weightUsed = parseFloat(document.getElementById("maxWeightInput").value);
    const maxReps = parseInt(document.getElementById("maxRepsInput").value);

    if (isNaN(weightUsed) || isNaN(maxReps) || weightUsed <= 0 || maxReps <= 0) {
      this.ui.showMessage("Please enter valid weight and reps.", 'error');
      return;
    }

    const config = this.configManager.getAll();
    const estimated1RM = weightUsed / (config.oneRM_correction_factor * (1.0278 - 0.0278 * maxReps));
    this.trainingMax[this.currentExercise] = Math.floor(estimated1RM * config.trainingMaxInitializationFactor);

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

    try {
      await this.dbManager.addLiftRecord(newEntry);
      // Show stopwatch when transitioning to tracker mode
      document.getElementById("stopwatch-section").classList.add("show");
      this.updateStopwatchButton();
      this.ui.hideElement("initialization");
      this.ui.showElement("tracker");
      this.displayCurrentWorkout(newEntry);
      this.ui.showMessage("Exercise initialized successfully!", 'success');
    } catch (error) {
      console.error('Error initializing training max:', error);
      this.ui.showMessage('Error initializing exercise', 'error');
    }
  }

  effectiveReps(actualReps, actualWeight, prescribedWeight) {
    if (actualWeight <= 0) return 0;

    const config = this.configManager.getAll();
    const oneRM_actual = actualWeight / (config.oneRM_correction_factor * (1.0278 - 0.0278 * actualReps));
    return (1.0278 - (prescribedWeight / oneRM_actual)) / 0.0278;
  }

  convertToOriginalEquivalent(actualReps, actualWeight) {
    if (this.selectedAlternativeExercise && this.currentScaleFactor !== 1.0) {
      const originalEquivalentWeight = actualWeight / this.currentScaleFactor;
      const originalPrescribedWeight = this.getOriginalPrescribedWeight();
      const effectiveRepsValue = this.effectiveReps(actualReps, originalEquivalentWeight, originalPrescribedWeight);

      return {
        equivalentWeight: originalEquivalentWeight,
        effectiveReps: effectiveRepsValue
      };
    }

    const originalPrescribedWeight = this.getOriginalPrescribedWeight();
    const effectiveRepsValue = this.effectiveReps(actualReps, actualWeight, originalPrescribedWeight);

    return {
      equivalentWeight: actualWeight,
      effectiveReps: effectiveRepsValue
    };
  }

  getOriginalPrescribedWeight() {
    const config = this.configManager.getAll();
    let weightPercents;

    if (this.blockType === "leader") {
      weightPercents = config.setPercentagesLeader;
    } else {
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

  displayCurrentWorkoutWithScaling(initialData) {
    const config = this.configManager.getAll();
    const lastWorkout = initialData;
    this.trainingMax[this.currentExercise] = lastWorkout.trainingMax;

    let { cycle, week } = this.calculateNextWorkout(lastWorkout);
    const isDeloadWeek = this.consecutiveLowAMRAP[this.currentExercise] >= config.deloadTriggerConsecutiveLowAMRAP;

    const { weightPercents, reps, targetReps } = this.getWorkoutParameters(week, isDeloadWeek);
    const { deloadReps, deloadWeights } = this.calculateDeloadAdjustments(reps, weightPercents, isDeloadWeek);

    // Apply scaling for alternative exercises
    const scaledWeights = deloadWeights.map(weight => Math.round((weight * this.currentScaleFactor) / 5) * 5);

    this.renderWorkoutDisplay(scaledWeights, deloadReps, targetReps, cycle, week, isDeloadWeek);
  }

  displayCurrentWorkout(initialData) {
    const config = this.configManager.getAll();

    try {
      const lastWorkout = initialData;
      this.trainingMax[this.currentExercise] = lastWorkout.trainingMax;

      let { cycle, week } = this.calculateNextWorkout(lastWorkout);
      const isDeloadWeek = this.consecutiveLowAMRAP[this.currentExercise] >= config.deloadTriggerConsecutiveLowAMRAP;

      const { weightPercents, reps, targetReps } = this.getWorkoutParameters(week, isDeloadWeek);
      const { deloadReps, deloadWeights } = this.calculateDeloadAdjustments(reps, weightPercents, isDeloadWeek);

      this.renderWorkoutDisplay(deloadWeights, deloadReps, targetReps, cycle, week, isDeloadWeek);
    } catch (error) {
      console.error('Error displaying current workout:', error);
      this.ui.showMessage('Error displaying workout', 'error');
    }
  }

  calculateNextWorkout(lastWorkout) {
    const config = this.configManager.getAll();
    let { cycle, week } = lastWorkout;
    const isDeloadWeek = this.consecutiveLowAMRAP[this.currentExercise] >= config.deloadTriggerConsecutiveLowAMRAP;

    if (!isDeloadWeek && week === 3) {
      week = 1;
      cycle++;
      this.updateBlockProgression(config);
    } else if (!isDeloadWeek) {
      week++;
    }

    return { cycle, week };
  }

  updateBlockProgression(config) {
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
  }

  getWorkoutParameters(week, isDeloadWeek) {
    const config = this.configManager.getAll();
    const weightPercents = this.blockType === "leader" ?
      config.setPercentagesLeader :
      config.setPercentagesAnchor[week];
    const reps = this.blockType === "leader" ?
      config.setRepsLeader :
      config.setRepsAnchor[week];
    const targetReps = this.blockType === "anchor" ?
      config.targetRepsAnchor[week] :
      reps[2];

    return { weightPercents, reps, targetReps };
  }

  calculateDeloadAdjustments(reps, weightPercents, isDeloadWeek) {
    const config = this.configManager.getAll();
    let deloadReps = reps;
    let deloadWeights = weightPercents.map(percent =>
      Math.round(this.trainingMax[this.currentExercise] * percent)
    );

    if (isDeloadWeek) {
      deloadReps = reps.map(r => Math.ceil(r * config.deloadPercentage));
      deloadWeights = deloadWeights.map(weight =>
        Math.round(weight * config.deloadPercentage)
      );
    }

    return { deloadReps, deloadWeights };
  }

  renderWorkoutDisplay(weights, reps, targetReps, cycle, week, isDeloadWeek) {

    // Update deload notice
    if (isDeloadWeek) {
      this.ui.updateText("deloadNotice", "Deload Week: Reduced volume for recovery");
    } else {
      this.ui.updateText("deloadNotice", "");
    }

    // Store original values for reset functionality
    this.originalPrescription = {
      weights: weights.map(w => Math.round(w / 5) * 5),
      reps: [...reps],
      targetReps: targetReps
    };

    // Initialize current prescription (will be modified by user interactions)
    if (!this.currentPrescription) {
      this.currentPrescription = {
        weights: [...this.originalPrescription.weights],
        reps: [...this.originalPrescription.reps],
        targetReps: this.originalPrescription.targetReps
      };
    } else {
      // Update to new original values but preserve any ongoing adjustments proportionally
      this.currentPrescription = {
        weights: [...this.originalPrescription.weights],
        reps: [...this.originalPrescription.reps],
        targetReps: this.originalPrescription.targetReps
      };
    }

    // Render prescribed sets with interactive controls
    this.renderInteractivePrescribedSets();

    // Handle alternative exercise styling
    const prescribedSetsElement = document.getElementById("prescribedSets");
    if (this.selectedAlternativeExercise) {
      prescribedSetsElement.classList.add("alternative-exercise");
      console.log('Added alternative-exercise class to:', prescribedSetsElement);
    } else {
      prescribedSetsElement.classList.remove("alternative-exercise");
      console.log('Removed alternative-exercise class from:', prescribedSetsElement);
    }


    // Update form inputs
    document.getElementById("amrap").value = reps[2];
    const actualWeight = Math.round(weights[2] / 5) * 5; // Round to nearest 5 lbs to match prescribed sets
    document.getElementById("actualWeight").value = actualWeight;

    // Update display info
    this.ui.updateText("cycleNumber", cycle || "N/A");
    this.ui.updateText("weekNumber", week || "N/A");
    this.ui.updateText("blockType", this.blockType ?
      this.blockType.charAt(0).toUpperCase() + this.blockType.slice(1) : "N/A");

    // Populate exercise dropdown
    this.populateExerciseDropdown();

    console.log(`Workout displayed: Cycle ${cycle}, Week ${week}, Block ${this.blockType}, Scale: ${this.currentScaleFactor}`);
  }

  async saveProgress() {
    const actualReps = parseInt(document.getElementById("amrap").value);
    const actualWeight = parseInt(document.getElementById("actualWeight").value);

    try {
      const records = await this.dbManager.getExerciseRecords(this.currentExercise);
      const { cycle, week, trainingMax, isFirstSave, isDeloadWeek } = this.calculateProgressionData(records);

      // Handle deload week
      if (isDeloadWeek) {
        await this.handleDeloadWeek(records);
        return;
      }

      // Calculate effective reps and update training max
      const conversionResult = this.convertToOriginalEquivalent(actualReps, actualWeight);
      const effectiveRepsRounded = Math.round(conversionResult.effectiveReps);
      const newTrainingMax = this.calculateNewTrainingMax(trainingMax, week, effectiveRepsRounded, isFirstSave);

      const newEntry = {
        exercise: this.currentExercise,
        cycle,
        week,
        trainingMax: newTrainingMax,
        blockType: this.blockType,
        blockCounter: this.blockCounter,
        amrapReps: effectiveRepsRounded,
        date: new Date().toLocaleString(),
        consecutiveLowAMRAP: this.consecutiveLowAMRAP[this.currentExercise]
      };

      await this.dbManager.addLiftRecord(newEntry);

      // Easter egg logic
      if (this.currentExercise === "Squat" && effectiveRepsRounded >= 20) {
        const audio = new Audio("img/yb.mp3");
        audio.play().catch(() => { }); // Ignore audio errors
      }

      this.ui.showMessage("Progress saved!", 'success');
      await this.selectExercise(this.currentExercise);
    } catch (error) {
      console.error('Error saving progress:', error);
      this.ui.showMessage('Error saving progress', 'error');
    }
  }

  calculateProgressionData(records) {
    const config = this.configManager.getAll();
    const isFirstSave = records.length === 1 && records[0].week === 0;
    const isDeloadWeek = this.consecutiveLowAMRAP[this.currentExercise] >= config.deloadTriggerConsecutiveLowAMRAP;

    let cycle, week, trainingMax;

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
        this.updateBlockProgression(config);
      } else if (!isDeloadWeek) {
        week++;
      }
    }

    return { cycle, week, trainingMax, isFirstSave, isDeloadWeek };
  }

  calculateNewTrainingMax(currentTrainingMax, week, effectiveReps, isFirstSave) {
    const config = this.configManager.getAll();
    const increment = config.incrementValues[this.currentExercise];
    let newTrainingMax = currentTrainingMax;

    if (!isFirstSave && week === 3 && effectiveReps >= 0) {
      if (effectiveReps === 0) {
        newTrainingMax -= increment;
        this.consecutiveLowAMRAP[this.currentExercise]++;
      } else if (effectiveReps < 5) {
        newTrainingMax += increment;
        this.consecutiveLowAMRAP[this.currentExercise]++;
      } else {
        newTrainingMax += increment;
        // Accelerated incrementing logic
        for (let i = 0; i < config.amrapProgressionThresholds.length; i++) {
          if (effectiveReps >= config.amrapProgressionThresholds[i]) {
            newTrainingMax += increment * config.amrapProgressionIncrementMultipliers[i];
          }
        }
        this.consecutiveLowAMRAP[this.currentExercise] = 0;
      }

      // Apply adaptive increment tuning after Week 3 saves
      this.applyAdaptiveIncrementTuning().catch(error => {
        console.error('Error applying adaptive increment tuning:', error);
      });
    }

    return newTrainingMax;
  }

  async applyAdaptiveIncrementTuning() {
    try {
      const config = this.configManager.getAll();

      // Get all records for the current exercise
      const allRecords = await this.dbManager.getExerciseRecords(this.currentExercise);

      // Filter to only Week 3 entries (AMRAP weeks) and exclude initialization entries
      const week3Records = allRecords.filter(record =>
        record.week === 3 && record.amrapReps !== null
      );

      // If we don't have enough data, skip adaptive tuning
      if (week3Records.length < 2) {
        console.log('Not enough Week 3 data for adaptive increment tuning');
        return;
      }

      // Take the last N entries based on performanceWindowSize
      const windowSize = Math.min(config.performanceWindowSize, week3Records.length);
      const recentRecords = week3Records.slice(-windowSize);

      console.log(`Analyzing last ${windowSize} Week 3 records for ${this.currentExercise}:`,
        recentRecords.map(r => ({ cycle: r.cycle, amrapReps: r.amrapReps })));

      // Count performances for acceleration and deceleration logic
      const zeroRepCounts = recentRecords.filter(record => record.amrapReps === 0).length;
      const highRepCounts = recentRecords.filter(record =>
        record.amrapReps >= config.amrapProgressionThresholds[0]
      ).length;

      let currentIncrement = config.incrementValues[this.currentExercise];
      let newIncrement = currentIncrement;
      let adjustmentMade = false;
      let adjustmentType = '';

      // Acceleration logic: If too many high-rep performances, increase increment
      if (highRepCounts >= config.accThreshold) {
        newIncrement = currentIncrement / config.adjustFactor;
        adjustmentMade = true;
        adjustmentType = 'acceleration';
        console.log(`Acceleration triggered: ${highRepCounts} high-rep performances >= ${config.accThreshold} threshold`);
      }
      // Deceleration logic: If too many zero-rep performances, decrease increment
      else if (zeroRepCounts >= config.decThreshold) {
        newIncrement = currentIncrement * config.adjustFactor;
        adjustmentMade = true;
        adjustmentType = 'deceleration';
        console.log(`Deceleration triggered: ${zeroRepCounts} zero-rep performances >= ${config.decThreshold} threshold`);
      }

      if (adjustmentMade) {
        // Clamp the new increment between min and max values
        newIncrement = Math.max(config.minIncrement, Math.min(config.maxIncrement, newIncrement));

        // Round to reasonable precision (0.5 lb increments)
        newIncrement = Math.round(newIncrement * 2) / 2;

        // Only update if the increment actually changed after clamping and rounding
        if (newIncrement !== currentIncrement) {
          // Update the config
          const updatedIncrementValues = { ...config.incrementValues };
          updatedIncrementValues[this.currentExercise] = newIncrement;

          await this.configManager.saveToDB({
            ...config,
            incrementValues: updatedIncrementValues
          });

          console.log(`Adaptive increment tuning applied (${adjustmentType}): ${this.currentExercise} increment changed from ${currentIncrement} to ${newIncrement}`);
          this.ui.showMessage(
            `Increment auto-adjusted for ${this.currentExercise}: ${currentIncrement} → ${newIncrement} lbs (${adjustmentType})`,
            'info'
          );
        } else {
          console.log(`Adaptive increment tuning calculated but no change needed (already at ${adjustmentType} limit)`);
        }
      } else {
        console.log('No adaptive increment adjustment needed based on recent performance');
      }

    } catch (error) {
      console.error('Error in adaptive increment tuning:', error);
      throw error;
    }
  }

  async handleDeloadWeek(records) {
    this.ui.showMessage("Deload week complete. Progress entry will not be recorded.", 'info');

    // Clear the deload flag
    this.consecutiveLowAMRAP[this.currentExercise] = 0;

    // Update the last record in the database
    const lastRecord = records[records.length - 1];
    const updatedRecord = {
      ...lastRecord,
      consecutiveLowAMRAP: 0
    };

    try {
      await this.dbManager.updateLiftRecord(updatedRecord);
      await this.selectExercise(this.currentExercise);
    } catch (error) {
      console.error('Error handling deload week:', error);
      this.ui.showMessage('Error updating deload status', 'error');
    }
  }

  async clearLastEntry() {
    try {
      await this.dbManager.deleteLastEntry(this.currentExercise);
      this.ui.showMessage("Last entry cleared.", 'success');
      await this.selectExercise(this.currentExercise);
    } catch (error) {
      console.error('Error clearing last entry:', error);
      this.ui.showMessage(error.message === "No entry to clear" ? "No entry to clear." : "Error clearing entry", 'error');
    }
  }

  async viewHistory() {
    if (!this.currentExercise) {
      this.ui.showMessage('Please select an exercise first', 'error');
      return;
    }

    try {
      const records = await this.dbManager.getExerciseRecords(this.currentExercise);

      // Update modal title
      document.getElementById("history-title").textContent = `History for ${this.currentExercise}`;

      let historyContent = '';

      if (records.length === 0) {
        historyContent = '<p style="text-align: center; color: #888; margin: 20px;">No history available for this exercise.</p>';
      } else {
        // Filter records that have actual workout data
        const workoutRecords = records.filter(record => record.date && record.amrapReps !== null);

        if (workoutRecords.length === 0) {
          historyContent = '<p style="text-align: center; color: #888; margin: 20px;">No completed workouts found.</p>';
        } else {
          historyContent = '<div style="max-height: 400px; overflow-y: auto; padding: 10px 0;">';

          // Show most recent first
          workoutRecords.reverse().forEach(record => {
            const date = new Date(record.date).toLocaleDateString();
            historyContent += `
              <div style="
                padding: 8px 12px;
                margin: 4px 0;
                background-color: #404040;
                border-radius: 6px;
                border: 1px solid #555;
                font-size: 0.85rem;
              ">
                <div style="font-weight: 600; color: #4da6ff; margin-bottom: 2px;">
                  ${date}
                </div>
                <div style="color: #e0e0e0;">
                  Cycle ${record.cycle}, Week ${record.week} •
                  Training Max: ${record.trainingMax} lbs •
                  AMRAP Reps: ${record.amrapReps}
                </div>
              </div>
            `;
          });

          historyContent += '</div>';
        }
      }

      this.ui.updateHTML("history-content", historyContent);
      this.ui.openModal("history-modal");
    } catch (error) {
      console.error('Error viewing history:', error);
      this.ui.showMessage('Error loading history', 'error');
    }
  }

  async exportFullBackup() {
    try {
      const backupData = await this.dbManager.exportFullBackup();
      const backupJson = JSON.stringify(backupData, null, 2);
      const filename = `lifts-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;

      this.ui.downloadFile(backupJson, filename);
      this.ui.showMessage('Complete backup exported successfully!', 'success');

      console.log('Full backup exported:', backupData);
    } catch (error) {
      console.error('Error exporting full backup:', error);
      this.ui.showMessage('Error exporting backup. Please try again.', 'error');
    }
  }

  async importFullBackup() {
    this.ui.triggerFileInput('backup-input', async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const text = await this.readFileAsText(file);
        const backupData = JSON.parse(text);

        // Validate backup structure
        if (!backupData.stores || typeof backupData.stores !== 'object') {
          this.ui.showMessage('Invalid backup file format. Please upload a valid backup file.', 'error');
          return;
        }

        // Confirm with user before proceeding
        const exportDate = backupData.exportDate ? new Date(backupData.exportDate).toLocaleDateString() : 'unknown date';
        const confirmMessage = `This will completely replace all your current data with the backup from ${exportDate}.\n\nAre you sure you want to continue?`;

        if (!confirm(confirmMessage)) {
          return;
        }

        await this.dbManager.importFullBackup(backupData);

        // Update in-memory config from restored data
        if (backupData.stores.config) {
          backupData.stores.config.forEach(({ key, value }) => {
            if (this.configManager.config.hasOwnProperty(key)) {
              this.configManager.config[key] = value;
            }
          });
          this.converter.updateConfig(this.configManager.get('converter'));
        }

        this.ui.showMessage('Backup restored successfully!', 'success');
        console.log('Full backup restored from:', backupData.exportDate);

        // Refresh current exercise display if one is selected
        if (this.currentExercise) {
          await this.selectExercise(this.currentExercise);
        }
      } catch (error) {
        console.error('Error importing backup:', error);
        this.ui.showMessage('Error reading backup file. Please upload a valid JSON file.', 'error');
      }
    });

    // Create backup input if it doesn't exist
    if (!document.getElementById('backup-input')) {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'backup-input';
      input.accept = '.json';
      input.style.display = 'none';
      document.body.appendChild(input);
    }
  }

  loadConfigFile() {
    this.ui.triggerFileInput('configFileInput', async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const text = await this.readFileAsText(file);
        const configData = JSON.parse(text);
        await this.configManager.saveToDB(configData);
        this.converter.updateConfig(this.configManager.get('converter'));
        this.ui.showMessage("Configuration updated successfully!", 'success');
      } catch (error) {
        console.error('Error loading config file:', error);
        this.ui.showMessage("Invalid configuration file. Please upload a valid JSON file.", 'error');
      }
    });
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Stopwatch Control Methods
  toggleStopwatch() {
    if (this.stopwatch.isRunning) {
      this.stopwatch.stop();
    } else {
      this.stopwatch.start();
    }
    this.updateStopwatchButton();
  }

  resetStopwatch() {
    this.stopwatch.reset();
    this.updateStopwatchButton();
  }

  updateStopwatchButton() {
    const toggleButton = document.getElementById('stopwatch-toggle');
    if (toggleButton) {
      if (this.stopwatch.isRunning) {
        toggleButton.textContent = '⏸';
        toggleButton.classList.remove('stopwatch-stopped');
        toggleButton.classList.add('stopwatch-running');
      } else {
        toggleButton.textContent = '▶';
        toggleButton.classList.remove('stopwatch-running');
        toggleButton.classList.add('stopwatch-stopped');
      }
    }
  }

  // Two-Page Navigation System
  initPageNavigation() {
    this.currentPage = 1;
    this.isTransitioning = false;

    // Touch/swipe variables
    this.startY = 0;
    this.currentY = 0;
    this.isScrolling = false;

    // Get page elements
    this.workoutPage = document.getElementById('page1');
    this.toolsPage = document.getElementById('page2');
    this.indicators = document.querySelectorAll('.indicator');

    // Bind touch events
    this.bindPageNavigation();
  }

  bindPageNavigation() {
    const appContainer = document.querySelector('.app-container');

    // Touch events for swipe detection
    appContainer.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    appContainer.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    appContainer.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

    // Page indicator clicks
    this.indicators.forEach(indicator => {
      indicator.addEventListener('click', (e) => {
        const targetPage = parseInt(e.target.dataset.page);
        this.goToPage(targetPage);
      });
    });

    // Keyboard navigation (optional)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && this.currentPage === 1) {
        this.goToPage(2);
      } else if (e.key === 'ArrowDown' && this.currentPage === 2) {
        this.goToPage(1);
      }
    });
  }

  handleTouchStart(e) {
    if (this.isTransitioning) return;

    this.startY = e.touches[0].clientY;
    this.currentY = this.startY;
    this.isScrolling = false;

    console.log('Touch start:', this.startY);
  }

  handleTouchMove(e) {
    if (this.isTransitioning) return;

    this.currentY = e.touches[0].clientY;
    const deltaY = this.currentY - this.startY;

    // If we've moved more than 10px, start tracking direction
    if (Math.abs(deltaY) > 10 && !this.isScrolling) {
      this.isScrolling = true;
      console.log('Touch move delta:', deltaY);
    }
  }

  handleTouchEnd(e) {
    if (this.isTransitioning) return;

    const deltaY = this.currentY - this.startY;
    const threshold = 80; // Increased threshold for more reliable detection

    console.log('Touch end delta:', deltaY, 'threshold:', threshold);

    // Upward swipe - go to tools page (user swiped up)
    if (deltaY < -threshold && this.currentPage === 1) {
      console.log('Swiping to page 2');
      this.goToPage(2);
    }
    // Downward swipe - go to workout page (user swiped down)
    else if (deltaY > threshold && this.currentPage === 2) {
      console.log('Swiping to page 1');
      this.goToPage(1);
    }

    // Reset for next gesture
    this.isScrolling = false;
  }

  goToPage(pageNumber) {
    if (this.isTransitioning || this.currentPage === pageNumber) return;

    this.isTransitioning = true;
    this.currentPage = pageNumber;

    // Update page classes
    if (pageNumber === 1) {
      this.workoutPage.classList.remove('slide-up');
      this.toolsPage.classList.remove('slide-up');
    } else {
      this.workoutPage.classList.add('slide-up');
      this.toolsPage.classList.add('slide-up');
    }

    // Update indicators
    this.indicators.forEach((indicator, index) => {
      if (index + 1 === pageNumber) {
        indicator.classList.add('active');
      } else {
        indicator.classList.remove('active');
      }
    });

    // Reset transition flag after animation
    setTimeout(() => {
      this.isTransitioning = false;
    }, 400);
  }

  renderInteractivePrescribedSets() {
    const titleText = this.selectedAlternativeExercise ?
      `Prescribed Sets (${this.selectedAlternativeExercise})` :
      "Prescribed Sets";

    let setsHtml = `<h3>${titleText}</h3>`;

    this.currentPrescription.weights.forEach((weight, i) => {
      const reps = this.currentPrescription.reps[i];
      const isAdjusted = this.isSetAdjusted(i);
      const adjustedClass = isAdjusted ? "adjusted-set" : "";

      // Special formatting for Set 3 (AMRAP set)
      let repDisplay;
      if (i === 2) {
        repDisplay = `${weight} lbs x ${Math.floor(reps)} - ${Math.floor(this.currentPrescription.targetReps)} reps`;
      } else {
        repDisplay = `${weight} lbs x ${Math.floor(reps)} reps`;
      }

      setsHtml += `
        <div class="set-container ${adjustedClass}">
          <div class="set-info">
            <span class="set-label">Set ${i + 1}:</span>
            <span class="set-details">${repDisplay}</span>
          </div>
          <div class="set-controls">
            ${isAdjusted ? `<button class="reset-btn" data-set="${i}">↺</button>` : ''}
            <button class="weight-btn minus" data-set="${i}" data-action="minus">-</button>
            <button class="weight-btn plus" data-set="${i}" data-action="plus">+</button>
          </div>
        </div>
      `;
    });


    this.ui.updateHTML("prescribedSets", setsHtml);
    this.bindSetControls();
  }

  bindSetControls() {
    // Bind weight adjustment buttons
    document.querySelectorAll('.weight-btn').forEach(btn => {
      btn.onclick = (e) => {
        const setIndex = parseInt(e.target.dataset.set);
        const action = e.target.dataset.action;
        this.adjustSetWeight(setIndex, action === 'plus' ? 5 : -5);
      };
    });

    // Bind individual reset buttons
    document.querySelectorAll('.reset-btn').forEach(btn => {
      btn.onclick = (e) => {
        const setIndex = parseInt(e.target.dataset.set);
        this.resetSet(setIndex);
      };
    });
  }

  adjustSetWeight(setIndex, weightChange) {
    const newWeight = Math.max(0, this.currentPrescription.weights[setIndex] + weightChange);
    this.currentPrescription.weights[setIndex] = Math.round(newWeight / 5) * 5;

    // Calculate equivalent reps using 1RM formula
    const newReps = this.calculateEquivalentReps(
      this.originalPrescription.weights[setIndex],
      this.originalPrescription.reps[setIndex],
      this.currentPrescription.weights[setIndex]
    );

    this.currentPrescription.reps[setIndex] = newReps;

    // For the AMRAP set (set 3), also update target reps and actual weight field
    if (setIndex === 2) {
      this.currentPrescription.targetReps = this.calculateEquivalentReps(
        this.originalPrescription.weights[2],
        this.originalPrescription.targetReps,
        this.currentPrescription.weights[2]
      );

      // Update the actual weight input field to match set 3
      document.getElementById("actualWeight").value = this.currentPrescription.weights[2];
    }

    this.renderInteractivePrescribedSets();
  }

  calculateEquivalentReps(originalWeight, originalReps, newWeight) {
    if (newWeight <= 0 || originalWeight <= 0) return originalReps;

    const config = this.configManager.getAll();

    // Calculate 1RM from original prescription
    const oneRM = originalWeight / (config.oneRM_correction_factor * (1.0278 - 0.0278 * originalReps));

    // Calculate equivalent reps for new weight
    const equivalentReps = (1.0278 - (newWeight / oneRM)) / 0.0278;

    // Ensure reasonable bounds (minimum 1 rep, maximum 50 reps)
    return Math.max(1, Math.min(50, equivalentReps));
  }

  resetSet(setIndex) {
    this.currentPrescription.weights[setIndex] = this.originalPrescription.weights[setIndex];
    this.currentPrescription.reps[setIndex] = this.originalPrescription.reps[setIndex];

    if (setIndex === 2) {
      this.currentPrescription.targetReps = this.originalPrescription.targetReps;
      // Also reset the actual weight input field to match set 3
      document.getElementById("actualWeight").value = this.originalPrescription.weights[2];
    }

    this.renderInteractivePrescribedSets();
  }

  isSetAdjusted(setIndex) {
    const weightAdjusted = this.currentPrescription.weights[setIndex] !== this.originalPrescription.weights[setIndex];
    const repsAdjusted = Math.abs(this.currentPrescription.reps[setIndex] - this.originalPrescription.reps[setIndex]) > 0.1;
    return weightAdjusted || repsAdjusted;
  }

  hasAnyAdjustedSets() {
    return this.currentPrescription.weights.some((_, i) => this.isSetAdjusted(i));
  }

  updateExerciseButtonStates(selectedExercise) {
    // Map exercise names to button IDs
    const exerciseButtonMap = {
      "Overhead Press": "overhead-press-btn",
      "Bench Press": "bench-press-btn",
      "Squat": "squat-btn",
      "Deadlift": "deadlift-btn"
    };

    // Remove active class from all exercise buttons
    Object.values(exerciseButtonMap).forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.classList.remove('active');
      }
    });

    // Add active class to the selected exercise button
    const selectedButtonId = exerciseButtonMap[selectedExercise];
    if (selectedButtonId) {
      const selectedButton = document.getElementById(selectedButtonId);
      if (selectedButton) {
        selectedButton.classList.add('active');
      }
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new LiftTracker();
});

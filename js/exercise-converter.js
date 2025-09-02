// Exercise converter module
export class ExerciseConverter {
  constructor(config) {
    this.config = config;
    this.upperBodyExercises = Object.keys(config.toBenchFactors);
    this.lowerBodyExercises = Object.keys(config.toSquatFactors);
    this.allExercises = [...this.upperBodyExercises, ...this.lowerBodyExercises];
  }

  updateConfig(newConfig) {
    this.config = newConfig;
    this.upperBodyExercises = Object.keys(newConfig.toBenchFactors);
    this.lowerBodyExercises = Object.keys(newConfig.toSquatFactors);
    this.allExercises = [...this.upperBodyExercises, ...this.lowerBodyExercises];
  }

  formatExerciseName(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getExerciseKeyFromName(exerciseName) {
    const normalizedName = exerciseName.trim().toLowerCase();
    return this.allExercises.find(ex => this.formatExerciseName(ex).toLowerCase() === normalizedName) || '';
  }

  getFactor(exercise, type) {
    if (type === 'bench') return this.config.toBenchFactors[exercise];
    if (type === 'squat') return this.config.toSquatFactors[exercise];
    return undefined;
  }

  isUpperBody(exercise) {
    return this.upperBodyExercises.includes(exercise);
  }

  isLowerBody(exercise) {
    return this.lowerBodyExercises.includes(exercise);
  }

  calculate1RM(weight, reps, k = 30) {
    return weight * (1 + reps / k);
  }

  calculateTargetWeight(target1RM, targetReps, k = 30) {
    return target1RM / (1 + targetReps / k);
  }

  calculateTargetReps(target1RM, targetWeight, k = 30) {
    return k * ((target1RM / targetWeight) - 1);
  }

  convert({ refExercise, refWeight, refReps, targetExercise, targetReps, targetWeight, mode }) {
    const k = this.config["1rm_formula_k"] || 30;
    let ref1RM = this.calculate1RM(refWeight, refReps, k);
    let base1RM, refFactor, targetFactor;

    // Validate exercise compatibility
    if ((this.isUpperBody(refExercise) && !this.isUpperBody(targetExercise)) ||
        (this.isLowerBody(refExercise) && !this.isLowerBody(targetExercise))) {
      throw new Error('Cannot convert between upper and lower body exercises.');
    }

    if (this.isUpperBody(refExercise)) {
      base1RM = ref1RM;
      refFactor = this.getFactor(refExercise, 'bench');
      targetFactor = this.getFactor(targetExercise, 'bench');
      if (refExercise !== 'bench_press') base1RM = ref1RM / refFactor;
      if (targetExercise !== 'bench_press') base1RM = base1RM * targetFactor;
    } else if (this.isLowerBody(refExercise)) {
      base1RM = ref1RM;
      refFactor = this.getFactor(refExercise, 'squat');
      targetFactor = this.getFactor(targetExercise, 'squat');
      if (refExercise !== 'squat') base1RM = ref1RM / refFactor;
      if (targetExercise !== 'squat') base1RM = base1RM * targetFactor;
    } else {
      throw new Error('Unknown exercise type');
    }

    if (mode === 'reps') {
      const calculatedWeight = this.calculateTargetWeight(base1RM, targetReps, k);
      return {
        ref1RM: ref1RM,
        target1RM: base1RM,
        targetWeight: calculatedWeight,
        mode: 'reps',
        targetReps: targetReps
      };
    } else {
      const calculatedReps = this.calculateTargetReps(base1RM, targetWeight, k);
      return {
        ref1RM: ref1RM,
        target1RM: base1RM,
        targetReps: calculatedReps,
        mode: 'weight',
        targetWeight: targetWeight
      };
    }
  }

  getFormattedExerciseList() {
    const upperBodyNames = this.upperBodyExercises.map(this.formatExerciseName);
    const lowerBodyNames = this.lowerBodyExercises.map(this.formatExerciseName);

    return [
      ...upperBodyNames,
      '────────────────────────────',
      ...lowerBodyNames
    ];
  }
}

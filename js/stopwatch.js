// Stopwatch utility module
export class Stopwatch {
  constructor(displayElementId = 'stopwatch-display') {
    this.startTime = 0;
    this.elapsedTime = 0;
    this.isRunning = false;
    this.intervalId = null;
    this.display = document.getElementById(displayElementId);
  }

  start() {
    if (!this.isRunning) {
      this.startTime = Date.now() - this.elapsedTime;
      this.intervalId = setInterval(() => this.updateDisplay(), 10);
      this.isRunning = true;
    }
  }

  stop() {
    if (this.isRunning) {
      clearInterval(this.intervalId);
      this.isRunning = false;
    }
  }

  reset() {
    clearInterval(this.intervalId);
    this.isRunning = false;
    this.elapsedTime = 0;
    this.startTime = 0;
    this.updateDisplay();
  }

  updateDisplay() {
    this.elapsedTime = this.isRunning ? Date.now() - this.startTime : this.elapsedTime;

    const totalMilliseconds = this.elapsedTime;
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((totalMilliseconds % 1000) / 10);

    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    if (this.display) {
      this.display.textContent = formattedTime;
    }
  }

  getElapsedTime() {
    return this.elapsedTime;
  }

  getFormattedTime() {
    const totalMilliseconds = this.elapsedTime;
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((totalMilliseconds % 1000) / 10);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }
}

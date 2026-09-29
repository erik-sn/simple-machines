// A moving mean over the last few steps: joint reaction forces jitter by a
// few percent between solver iterations, and the readouts should not.
export class ForceSampler {
  private readonly samples: number[] = [];
  private readonly window: number;

  constructor(window = 10) {
    this.window = window;
  }

  push(value: number): void {
    this.samples.push(value);
    if (this.samples.length > this.window) {
      this.samples.shift();
    }
  }

  mean(): number {
    if (this.samples.length === 0) {
      return 0;
    }
    let total = 0;
    for (const sample of this.samples) {
      total += sample;
    }
    return total / this.samples.length;
  }

  clear(): void {
    this.samples.length = 0;
  }
}

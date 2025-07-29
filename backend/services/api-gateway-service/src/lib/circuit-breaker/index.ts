// Circuit breaker pattern implementation
export class CircuitBreaker {
  private threshold: number; // Max number of failed request before updating the state to OPEN
  private timeout: number; // Number of milliseconds to wait before updating the state to HALF_OPEN
  private failureCount: number;
  private lastFailureTime: number | null;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN";

  constructor(threshold = 3, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = "CLOSED";
  }

  private async isHealthy(endpoint: string) {
    const response = await fetch(endpoint);
    return response.status === 200;
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = "OPEN";
    }
  }

  async execute(healthCheck: string) {
    if (this.state === "OPEN") {
      if (
        this.lastFailureTime === null ||
        Date.now() - this.lastFailureTime > this.timeout
      ) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    const result = await this.isHealthy(healthCheck);

    if (result) this.onSuccess();
    else this.onFailure();

    return result;
  }
}

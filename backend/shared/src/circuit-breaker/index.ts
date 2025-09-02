import EventEmitter from "events";

type CircuitBreakerEvents = {
  closed: [];
  open: [];
  half_open: [];
};

// Make the class generic over the callback's type
export class CircuitBreaker<
  T extends (...args: any[]) => any
> extends EventEmitter<CircuitBreakerEvents> {
  private threshold: number;
  private timeout: number;
  private failureCount: number;
  private lastFailureTime: number | null;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN";

  // Use the generic type T for the callback property
  private callback: T;

  constructor(callback: T, threshold = 3, timeout = 10 * 1000) {
    super();
    this.callback = callback;
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = "CLOSED";
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
    this.lastFailureTime = null;
    this.emit("closed");
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === "HALF_OPEN" || this.failureCount >= this.threshold) {
      this.state = "OPEN";
      this.emit("open");
    }
  }

  // Type the arguments of the execute method using Parameters<T>
  async execute(...args: Parameters<T>) {
    try {
      if (this.state === "OPEN") {
        if (
          this.lastFailureTime &&
          Date.now() - this.lastFailureTime > this.timeout
        ) {
          this.emit("half_open");
          this.state = "HALF_OPEN";
        } else {
          throw new Error("Circuit breaker is in OPEN state");
        }
      }

      // The call to `this.callback` is now correctly typed
      const result = await this.callback(...args);

      this.onSuccess();
      // Cast the result to the expected return type
      return result as Awaited<ReturnType<T>>;
    } catch (error) {
      this.onFailure();
      if (error instanceof Error) console.log(error.message);
      throw error;
    }
  }
}

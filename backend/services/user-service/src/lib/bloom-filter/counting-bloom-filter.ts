/**
 * A Counting Bloom Filter that supports element deletion while maintaining
 * similar performance characteristics to a standard Bloom Filter.
 *
 * The key insight: instead of storing single bits, we store small counters.
 * When adding an item, we increment counters. When removing, we decrement.
 * An item exists if ALL its counters are > 0.
 *
 * This approach trades a small amount of memory for the ability to delete items
 * while maintaining the same time complexity and similar space efficiency.
 */
export class CountingBloomFilter {
  private expectedElements: number;
  private falsePositiveRate: number;
  private numHashFunctions: number;
  private bitArraySize: number;

  private counterBits: number;
  private maxCounterValue: number;
  private countersPerByte: number;
  public elementsAdded: number;
  private counterMask: number;

  private counterArray: Uint8Array;

  /**
   * Initialize Counting Bloom Filter with optimal parameters.
   *
   * @param expectedElements - Number of elements you plan to insert
   * @param falsePositiveRate - Desired false positive probability
   * @param counterBits - Bits per counter (default: 4, supports counts up to 15)
   */
  constructor(
    expectedElements: number,
    falsePositiveRate = 0.01,
    counterBits = 4
  ) {
    this.expectedElements = expectedElements;
    this.falsePositiveRate = falsePositiveRate;
    this.counterBits = counterBits;
    this.maxCounterValue = (1 << counterBits) - 1;

    this.bitArraySize = Math.ceil(
      -(expectedElements * Math.log(falsePositiveRate)) / Math.log(2) ** 2
    );

    this.numHashFunctions = Math.ceil(
      (this.bitArraySize / expectedElements) * Math.log(2)
    );

    // Calculate how many counters we can pack into each byte
    this.countersPerByte = Math.floor(8 / counterBits);

    // Calculate total bytes needed for all counters
    const bytesNeeded = Math.ceil(this.bitArraySize / this.countersPerByte);

    // Initialize the counter array
    this.counterArray = new Uint8Array(bytesNeeded);

    // Track elements for debugging and overflow prevention
    this.elementsAdded = 0;

    // Create bit masks for efficient counter manipulation
    this.counterMask = (1 << counterBits) - 1; // Mask to isolate counter bits
  }

  /**
   * Get the counter value at a specific position.
   * This method efficiently extracts a counter from the packed byte array.
   *
   * @param position - Counter position
   * @returns Current counter value (0 to maxCounterValue)
   */
  _getCounter(position: number) {
    // Calculate which byte contains this counter
    const byteIndex = Math.floor(position / this.countersPerByte);

    // Calculate position within the byte (which counter in this byte)
    const counterIndex = position % this.countersPerByte;

    // Calculate bit offset within the byte
    const bitOffset = counterIndex * this.counterBits;

    // Extract the counter value using bit manipulation
    // We shift right to move our counter to the least significant bits,
    // then apply a mask to isolate just our counter bits
    const counterValue =
      (this.counterArray[byteIndex] >> bitOffset) & this.counterMask;

    return counterValue;
  }

  /**
   * Set the counter value at a specific position.
   * This method efficiently updates a counter in the packed byte array.
   *
   * @param position - Counter position
   * @param value - New counter value (0 to maxCounterValue)
   */
  _setCounter(position: number, value: number) {
    // Ensure value doesn't exceed our counter capacity
    value = Math.min(value, this.maxCounterValue);
    value = Math.max(value, 0);

    const byteIndex = Math.floor(position / this.countersPerByte);
    const counterIndex = position % this.countersPerByte;
    const bitOffset = counterIndex * this.counterBits;

    // Create a mask to clear the old counter value
    // We shift the counter mask to the correct position and invert it
    const clearMask = ~(this.counterMask << bitOffset);

    // Clear the old counter value and set the new one
    this.counterArray[byteIndex] =
      (this.counterArray[byteIndex] & clearMask) | (value << bitOffset);
  }

  /**
   * Increment a counter at the specified position.
   * This is the core operation for adding items.
   *
   * @param position - Counter position to increment
   * @returns True if increment succeeded, false if counter was at maximum
   */
  _incrementCounter(position: number) {
    const currentValue = this._getCounter(position);

    if (currentValue >= this.maxCounterValue) {
      // Counter overflow - this is a limitation of counting Bloom filters
      console.warn(
        `Counter overflow at position ${position}. Consider using more counter bits.`
      );
      return false;
    }

    this._setCounter(position, currentValue + 1);
    return true;
  }

  /**
   * Decrement a counter at the specified position.
   * This is the core operation for removing items.
   *
   * @param {number} position - Counter position to decrement
   * @returns {boolean} True if decrement succeeded, false if counter was already 0
   */
  _decrementCounter(position: number) {
    const currentValue = this._getCounter(position);

    if (currentValue === 0) {
      // Attempting to decrement a zero counter indicates the item wasn't in the filter
      return false;
    }

    this._setCounter(position, currentValue - 1);
    return true;
  }

  /**
   * Use the optimized FNV-1a hash function from the previous implementation.
   * This maintains the same high performance we achieved earlier.
   */
  _getHashValues(item: string) {
    const hash1 = this._fnv1aHash(item, 0x811c9dc5);
    const hash2 = this._fnv1aHash(item, 0xcbf29ce4);

    const hashValues = new Array<number>(this.numHashFunctions);

    for (let i = 0; i < this.numHashFunctions; i++) {
      hashValues[i] = (hash1 + i * hash2) % this.bitArraySize;
    }

    return hashValues;
  }

  /**
   * FNV-1a hash implementation (same as optimized version)
   */
  _fnv1aHash(str: string, offsetBasis: number) {
    const FNV_PRIME = 0x01000193;
    let hash = offsetBasis;

    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash *= FNV_PRIME;
      hash = hash >>> 0;
    }

    return hash;
  }

  /**
   * Add an item to the Counting Bloom Filter.
   * This increments all counters corresponding to the item's hash values.
   *
   * @param item - The item to add
   * @returns True if all counters were successfully incremented
   */
  add(item: unknown) {
    const element = String(item);
    const hashValues = this._getHashValues(element);
    let allSuccessful = true;

    // Increment all corresponding counters
    for (const hashValue of hashValues) {
      if (!this._incrementCounter(hashValue)) {
        allSuccessful = false;
      }
    }

    if (allSuccessful) {
      this.elementsAdded++;
    }

    if (this.elementsAdded > this.expectedElements) {
      console.warn(
        `Warning: Added ${this.elementsAdded} elements, ` +
          `but filter was designed for ${this.expectedElements}. ` +
          `False positive rate will be higher than expected.`
      );
    }

    return allSuccessful;
  }

  /**
   * Remove an item from the Counting Bloom Filter.
   * This is the key capability that standard Bloom filters lack!
   *
   * The algorithm works by decrementing all counters corresponding to
   * the item's hash values. This is safe because we only decrement
   * counters that are currently > 0.
   *
   * @param item - The item to remove
   * @returns True if item was likely in the filter and removed
   */
  remove(item: unknown) {
    const element = String(item);
    const hashValues = this._getHashValues(element);

    // First, check if the item is actually in the filter
    // If any counter is 0, the item definitely wasn't added
    for (const hashValue of hashValues) {
      if (this._getCounter(hashValue) === 0) {
        return false; // Item was never in the filter
      }
    }

    // All counters are > 0, so we can safely decrement them
    let allSuccessful = true;
    for (const hashValue of hashValues) {
      if (!this._decrementCounter(hashValue)) {
        allSuccessful = false;
      }
    }

    if (allSuccessful) {
      this.elementsAdded--;
    }

    return allSuccessful;
  }

  /**
   * Check if an item might be in the set.
   * Same logic as standard Bloom filter, but checking counters > 0 instead of bits = 1.
   *
   * @param item - The item to check
   * @returns True if item MIGHT be in set, False if DEFINITELY NOT in set
   */
  has(item: unknown) {
    const element = String(item);
    const hashValues = this._getHashValues(element);

    // Check if ALL corresponding counters are > 0
    for (const hashValue of hashValues) {
      if (this._getCounter(hashValue) === 0) {
        return false; // Definitely not in the set
      }
    }

    return true; // Might be in the set
  }
}

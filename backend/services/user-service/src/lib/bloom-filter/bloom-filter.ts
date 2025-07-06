interface BloomFilterObject {
  expectedElements: number;
  falsePositiveRate: number;
  bitArraySize: number;
  numHashFunctions: number;
  elementsAdded: number;
  bitArray: number[];
}

export class BloomFilter {
  private expectedElements: number;
  private falsePositiveRate: number;
  private numHashFunctions: number;
  private bitArraySize: number;
  private bitArray: Uint8Array;

  public elementsAdded: number;

  constructor(expectedElements: number, falsePositiveRate: number = 0.01) {
    this.expectedElements = expectedElements;
    this.falsePositiveRate = falsePositiveRate;

    // Calculate optimal bit array size using the mathematical formula:
    // m = -(n * ln(p)) / (ln(2)^2)
    // where n = expected elements, p = false positive rate
    this.bitArraySize = Math.ceil(
      -(expectedElements * Math.log(falsePositiveRate)) / Math.log(2) ** 2
    );

    // Calculate optimal number of hash functions:
    // k = (m/n) * ln(2)
    // where m = number of bits
    this.numHashFunctions = Math.ceil(
      (this.bitArraySize / expectedElements) * Math.log(2)
    );

    // Initialize the bit array using Uint8Array for memory efficiency
    // Each element stores 8 bits, so we need bitArraySize/8 elements
    this.bitArray = new Uint8Array(Math.ceil(this.bitArraySize / 8));

    // Track how many elements we've actually added
    this.elementsAdded = 0;
  }

  /**
   * Generate multiple hash values for an item using an optimized approach.
   * This implementation uses FNV-1a hash as the primary hash function combined
   * with double hashing for maximum efficiency and distribution quality.
   *
   * Key optimizations:
   * - FNV-1a provides excellent distribution with minimal computation
   * - Double hashing reduces clustering compared to simple linear combinations
   * - Bit manipulation operations for maximum speed
   *
   * @param item - The item to hash (will be converted to string)
   * @returns Array of hash values
   */
  private _getHashValues(item: string) {
    // Convert to string once to minimize overhead - this is critical for performance
    const itemStr = String(item);

    // Generate two high-quality base hash values using FNV-1a variants
    // FNV-1a is chosen because it's extremely fast and provides excellent distribution
    const hash1 = this._fnv1aHash(itemStr, 0x811c9dc5); // FNV offset basis
    const hash2 = this._fnv1aHash(itemStr, 0xcbf29ce4); // Alternative FNV offset for independence

    // Pre-allocate array for better performance - avoids repeated array resizing
    const hashValues = new Array<number>(this.numHashFunctions);

    // Double hashing to reduce the collision rate
    for (let i = 0; i < this.numHashFunctions; i++) {
      hashValues[i] = (hash1 + i * hash2) % this.bitArraySize;
    }

    return hashValues;
  }

  /**
   * FNV-1a - A non-cryptographic hash function implementation.
   *
   * The algorithm works by:
   * 1. Starting with a carefully chosen prime offset basis
   * 2. For each byte: XOR with the current hash, then multiply by FNV prime
   * 3. This order (XOR then multiply) gives better avalanche properties than FNV-1
   *
   * @param str - String to hash
   * @param offsetBasis - FNV offset basis for creating different hash functions
   * @returns 32-bit hash value
   */
  private _fnv1aHash(str: string, offsetBasis: number) {
    // FNV-1a constants - these are mathematically chosen for optimal distribution
    const FNV_PRIME = 0x01000193; // 16777619 in decimal
    let hash = offsetBasis;

    // Process each character - the order matters for FNV-1a
    for (let i = 0; i < str.length; i++) {
      // XOR first, then multiply (this is what makes it FNV-1a vs FNV-1)
      hash ^= str.charCodeAt(i);

      // Multiply by FNV prime - this provides the avalanche effect
      hash *= FNV_PRIME;

      // Keep as 32-bit integer using bitwise operations (much faster than other methods)
      // This is crucial for performance - JavaScript numbers are 64-bit floats by default
      hash = hash >>> 0; // Unsigned right shift by 0 converts to 32-bit unsigned int
    }

    return hash;
  }

  /**
   * Set a specific bit in the bit array to 1.
   *
   * @param position - Bit position to set
   */
  private _setBit(position: number) {
    // Calculate which byte contains this bit
    const byteIndex = Math.floor(position / 8);
    // Calculate which bit within that byte (0-7)
    const bitIndex = position % 8;

    this.bitArray[byteIndex] |= 1 << bitIndex;
  }

  /**
   * Check if a specific bit in the bit array is set to 1.
   *
   * @param position - Bit position to check
   * @returns True if bit is set, false otherwise
   */
  private _getBit(position: number) {
    const byteIndex = Math.floor(position / 8);
    const bitIndex = position % 8;

    return Boolean(this.bitArray[byteIndex] & (1 << bitIndex));
  }

  add(value: unknown) {
    const element = String(value);

    const hashValues = this._getHashValues(element);

    this.elementsAdded++;
    hashValues.forEach((value) => {
      this._setBit(value);
    });

    if (this.elementsAdded > this.expectedElements) {
      console.warn(
        `Warning: Added ${this.elementsAdded} elements, ` +
          `but filter was designed for ${this.expectedElements}. ` +
          `False positive rate will be higher than expected.`
      );
    }
  }

  /**
   * Check if an item might be in the set.
   *
   * @param item - The item to check
   * @returns True if item MIGHT be in set, False if DEFINITELY NOT in set
   */
  has(value: unknown) {
    const element = String(value);
    const hashValues = this._getHashValues(element);

    // Check if ALL corresponding bits are set to 1
    // If any bit is 0, the item is definitely not in the set
    for (const hashValue of hashValues) {
      if (!this._getBit(hashValue)) {
        return false; // Definitely not in the set
      }
    }

    return true; // Might be in the set (could be false positive)
  }

  /**
   * Export the filter state for persistence or transmission.
   * This allows you to save and restore filters across sessions.
   *
   * @returns Serializable filter state
   */
  export(): BloomFilterObject {
    return {
      expectedElements: this.expectedElements,
      falsePositiveRate: this.falsePositiveRate,
      bitArraySize: this.bitArraySize,
      numHashFunctions: this.numHashFunctions,
      elementsAdded: this.elementsAdded,
      bitArray: Array.from(this.bitArray), // Convert to regular array for JSON serialization
    };
  }

  /**
   * Import a previously exported filter state.
   *
   * @param filterState - Previously exported filter state
   * @returns New BloomFilter instance with imported state
   */
  static import(filterState: BloomFilterObject) {
    const filter = new BloomFilter(
      filterState.expectedElements,
      filterState.falsePositiveRate
    );

    filter.bitArraySize = filterState.bitArraySize;
    filter.numHashFunctions = filterState.numHashFunctions;
    filter.elementsAdded = filterState.elementsAdded;
    filter.bitArray = new Uint8Array(filterState.bitArray);

    return filter;
  }
}

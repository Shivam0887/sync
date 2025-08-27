class TrieNode<T> {
  isEnd: boolean;
  children: Map<string, TrieNode<T>>;
  meta: T | null;

  constructor() {
    this.isEnd = false;
    this.children = new Map();
    this.meta = null;
  }
}

export class PrefixTree<T> {
  private root: TrieNode<T>;

  constructor() {
    this.root = new TrieNode<T>();
  }

  insert(data: string, metaData: T) {
    let node = this.root;
    const dataLower = data.trim().toLowerCase();
    const depth = dataLower.length;

    for (let i = 0; i < depth; i++) {
      const char = dataLower[i];

      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode<T>());
      }

      node = node.children.get(char)!;
    }

    node.isEnd = true;
    node.meta = metaData;
  }

  startsWith(prefix: string, limit = 10) {
    if (!prefix) {
      return [];
    }

    let node = this.root;
    prefix = prefix.trim().toLowerCase();

    for (const char of prefix) {
      if (!node.children.has(char)) {
        return [];
      }

      node = node.children.get(char)!;
    }

    const results: T[] = [];

    this._collectPrefixes<T>(node, results, limit);

    return results;
  }

  search(data: string) {
    let node = this.root;
    data = data.trim().toLowerCase();

    for (const char of data) {
      if (!node.children.has(char)) {
        return false;
      }

      node = node.children.get(char)!;
    }

    return node.isEnd;
  }

  delete(data: string) {
    this._cleanupPrefix<typeof this.root.meta>(data, this.root, 0);
  }

  private _cleanupPrefix<T>(prefix: string, node: TrieNode<T>, index: number) {
    if (index > prefix.length) return false;

    if (index === prefix.length) {
      return node.isEnd && node.children.size === 0;
    }

    for (const [ch, childNode] of node.children.entries()) {
      if (ch !== prefix[index]) return false;

      const result = this._cleanupPrefix(prefix, childNode, index + 1);
      if (result) {
        node.children.delete(prefix[index]);
        return node.children.size === 0;
      }
    }

    return false;
  }

  private _collectPrefixes<T>(node: TrieNode<T>, results: T[], limit: number) {
    if (node.isEnd) {
      results.push(node.meta!);
    }

    for (const childNode of node.children.values()) {
      if (results.length === limit) break;
      this._collectPrefixes(childNode, results, limit);
    }
  }
}

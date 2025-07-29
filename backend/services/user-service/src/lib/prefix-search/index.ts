class TrieNode {
  isEndOfUsername: boolean;
  id: string;
  username: string;
  children: Map<string, TrieNode>;

  constructor() {
    this.isEndOfUsername = false;
    this.username = "";
    this.children = new Map();
    this.id = "";
  }
}

export class PrefixTree {
  private root: TrieNode;

  constructor() {
    this.root = new TrieNode();
  }

  insert(username: string, id: string) {
    let node = this.root;
    const usernameLower = username.toLowerCase();
    const depth = usernameLower.length;

    for (let i = 0; i < usernameLower.length; i++) {
      const char = usernameLower[i];

      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }

      node = node.children.get(char)!;
    }

    node.isEndOfUsername = true;
    node.username = username;
    node.id = id;
  }

  searchPrefix(prefix: string, limit = 10) {
    if (!prefix) {
      return [];
    }

    let node = this.root;
    const prefixLower = prefix.toLowerCase();

    for (const char of prefixLower) {
      if (!node.children.has(char)) {
        return [];
      }

      node = node.children.get(char)!;
    }

    const results: { username: string; id: string }[] = [];
    this._collectUsernames(node, results, limit);

    return results;
  }

  private _collectUsernames(
    node: TrieNode,
    results: { username: string; id: string }[],
    limit: number
  ) {
    if (results.length >= limit) return;

    if (node.isEndOfUsername) {
      results.push({
        username: node.username,
        id: node.id,
      });
    }

    for (const childNode of node.children.values()) {
      if (results.length >= limit) break;
      this._collectUsernames(childNode, results, limit);
    }
  }
}

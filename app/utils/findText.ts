interface FindTextOptions extends FindTextsOptions {
  index?: number;
}

export function findText(str: string, opts: FindTextOptions = {}) {
  const { index = 0 } = opts;
  let i = 0;

  for (const range of findTexts(str, opts)) {
    if (i === index) return range;
    i++;
  }
}

interface FindTextsOptions {
  root?: Node;
}

/**
 * Yield a range for each occurrence of `str` within the text of `root`.
 *
 * Matches may span multiple text nodes. Overlapping matches are included, so
 * searching for 'aa' in 'aaa' yields two ranges.
 */
export function* findTexts(
  str: string,
  { root = document.body }: FindTextsOptions = {},
) {
  if (!str) return;

  // Flatten the text nodes into a single string, keeping the offset each node
  // starts at, so a match position can be mapped back to a node & offset.
  const nodes: Text[] = [];
  const nodeStarts: number[] = [];
  let text = '';

  const ittr = document.createNodeIterator(root, NodeFilter.SHOW_TEXT);

  for (let node = ittr.nextNode(); node; node = ittr.nextNode()) {
    const value = node.nodeValue!;
    if (!value) continue;
    nodes.push(node as Text);
    nodeStarts.push(text.length);
    text += value;
  }

  if (nodes.length === 0) return;

  // Index into nodeStarts for the node containing `pos`.
  let searchNode = 0;

  const nodeIndexAt = (pos: number) => {
    while (
      searchNode + 1 < nodeStarts.length &&
      nodeStarts[searchNode + 1] <= pos
    ) {
      searchNode++;
    }
    return searchNode;
  };

  for (
    let pos = text.indexOf(str);
    pos !== -1;
    pos = text.indexOf(str, pos + 1)
  ) {
    const startNode = nodeIndexAt(pos);
    const endPos = pos + str.length;
    // The end is exclusive, so look up the node containing the final
    // character, otherwise the range ends at offset 0 of the following node.
    const endNode = nodeIndexAt(endPos - 1);

    const range = document.createRange();
    range.setStart(nodes[startNode], pos - nodeStarts[startNode]);
    range.setEnd(nodes[endNode], endPos - nodeStarts[endNode]);

    yield range;

    // Matches are yielded in order, so the next search can't start earlier.
    searchNode = startNode;
  }
}

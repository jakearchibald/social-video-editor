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

export function* findTexts(
  str: string,
  { root = document.body }: FindTextsOptions = {}
) {
  let matchPos = 0;
  let startContainer: Node | null = null;
  let rewindCount = 0;
  let startOffset = 0;

  const ittr = document.createNodeIterator(root, NodeFilter.SHOW_TEXT);

  while (true) {
    let textNode = ittr.nextNode();
    if (!textNode) return;

    let text = textNode.nodeValue!;

    // This lets us rewind if we don't find a match
    if (matchPos) rewindCount++;

    for (let i = 0; i < text.length; i++) {
      if (text[i] == str[matchPos]) {
        // Possible match
        if (matchPos == 0) {
          startContainer = textNode;
          startOffset = i;
        }

        matchPos++;

        // Total match
        if (matchPos == str.length) {
          const range = document.createRange();
          range.setStart(startContainer!, startOffset);
          range.setEnd(textNode!, i + 1);

          yield range;

          matchPos = 0;
          startContainer = null;
          startOffset = 0;
          rewindCount = 0;
        }
      }
      // Match failure
      else if (matchPos) {
        // Rewind everything to the first character of the initial match & continue
        while (rewindCount) {
          textNode = ittr.previousNode();
          rewindCount--;
        }
        text = textNode!.nodeValue!;
        i = startOffset;
        matchPos = 0;
        startContainer = null;
        startOffset = 0;
      }
    }
  }
}

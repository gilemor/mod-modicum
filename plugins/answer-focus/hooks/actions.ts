// The block opens a line and closes the answer, on lines of its own or all on one; a tag mentioned mid-sentence
// or in code is just text.
const BLOCK = /(?:^|\n)[ \t]*<te-toca>((?:(?!<\/te-toca>)[\s\S])*?)(<\/te-toca>[ \t]*)?\s*$/
// While the answer streams, the opening tag arrives a few characters at a time.
const PARTIAL_TAG = /\n[ \t]*<(?:t(?:e(?:-(?:t(?:o(?:c(?:a)?)?)?)?)?)?)?$/
const BLANK_LINE = /\n[ \t]*\n/
const FENCE = /^[ \t]*(`{3,}|~{3,})/
const MAX_ACTIONS = 4

// A fence closes only with its own marker, at least as long: a ~~~ inside ``` is code.
const isInFence = (text: string, at: number) => {
  let open = ''
  for (const line of text.slice(0, at).split('\n')) {
    const fence = FENCE.exec(line)?.[1]
    if (!fence) continue
    if (!open) open = fence
    else if (fence[0] === open[0] && fence.length >= open.length) open = ''
  }
  return open !== ''
}

// The lines are drawn as plain text, which shows markdown markers as written. `__` stays: it is part of names like `__init__.py`.
export const bare = (text: string) => text.replace(/\*\*|`/g, '')

/** What Claude is told once a session: how to hand the reader's next steps to the mod. */
export const BRIEFING = [
  'answer-focus: when your final answer asks the user to do, check or decide something, end it with a block:',
  '<te-toca>',
  '¿Subo la rama y abro el PR?',
  '</te-toca>',
  'One line per action, at most 4, in the user\'s language. Keep each line as short as it can be while still making sense on its own: ideally under 10 words.',
  'The block is hidden and its lines are shown highlighted right under your answer, so don\'t repeat them in your closing paragraph.',
  'Omit the block when nothing is asked of the user, and never write it in text between tool calls.',
].join('\n')

/** Splits off the `<te-toca>` block Claude ends an answer with: the text to draw, and one action per line of the block. */
export const splitActions = (text: string): { text: string; actions: string[] } => {
  const match = BLOCK.exec(text)
  // Unclosed is normal while streaming, but a blank line inside means the tag was only mentioned: the text goes on.
  if (!match || isInFence(text, match.index) || (!match[2] && BLANK_LINE.test(match[1] ?? ''))) {
    const partial = PARTIAL_TAG.exec(text)
    return { text: partial && !isInFence(text, partial.index) ? text.slice(0, partial.index).trimEnd() : text, actions: [] }
  }
  const lines = (match[1] ?? '')
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
  // Lines past the limit stay in the answer: an ask must never vanish.
  const rest = lines.slice(MAX_ACTIONS)
  const body = text.slice(0, match.index).trimEnd()
  return { text: rest.length ? `${body}\n\n${rest.join('\n')}`.trim() : body, actions: lines.slice(0, MAX_ACTIONS) }
}

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { BRIEFING, bare, splitActions } from './actions'

// Enough of a block to tell it apart, short enough that a long session's state stays small.
const KEY_CHARS = 160
const KEEP = 200
// The mod can't tell light mode from dark, so each colour is a translucent wash: pastel on light, deep on dark,
// under the app's own text colour. Alphas keep the text at 5.9:1 or more and the wash visible in both modes.
// The terminal, which can't blend, gets the nearest theme colour.
export const COLORS = {
  'ámbar': { wash: 'rgba(239, 159, 39, 0.32)', theme: 'warning' },
  amarillo: { wash: 'rgba(234, 179, 8, 0.4)', theme: 'warning' },
  verde: { wash: 'rgba(34, 197, 94, 0.32)', theme: 'success' },
  azul: { wash: 'rgba(59, 130, 246, 0.36)', theme: 'suggestion' },
  violeta: { wash: 'rgba(139, 92, 246, 0.36)', theme: 'permission' },
  rosa: { wash: 'rgba(236, 72, 153, 0.34)', theme: 'error' },
} as const
type ColorName = keyof typeof COLORS

const steps = atom({ plugin: 'answer-focus', key: 'steps' } as const, [])
const answers = atom({ plugin: 'answer-focus', key: 'answers' } as const, [])
const briefed = atom({ plugin: 'answer-focus', key: 'briefed' } as const, '')

const PERSON = ['composer', 'bridge', 'sdk']

const flat = (text: string) => text.replace(/\s+/g, ' ').trim()
export const keyOf = (text: string) => flat(text).slice(0, KEY_CHARS)

// A step's text can span several transcript blocks, so a block belongs to it when it holds the block's opening.
const holds = (texts: readonly string[], key: string) => key !== '' && texts.some(t => t.includes(key.slice(0, 80)))

const added = (texts: readonly string[], text: string) => [...texts.filter(t => t !== text), text].slice(-KEEP)

type RenderArg = Parameters<EngineInterface['ui']['resolve']>[0]

const actionLines = ($: EngineInterface, e: RenderArg, actions: string[], color: ColorName) => {
  const { Box, Text } = $.ui.resolve(e)
  const { wash, theme } = COLORS[color]
  const mark = e.surface === 'terminal' ? { backgroundColor: theme, color: 'inverseText' } : { backgroundColor: wash }
  return (
    <Box key="actions" flexDirection="column" marginTop={1}>
      {actions.map((action, i) => (
        <Text key={`action-${i}`}>
          <Text color={theme}>→ </Text>
          <Text {...mark}>{bare(action)}</Text>
        </Text>
      ))}
    </Box>
  )
}

export const register: Register = (on, options) => {
  const isOn = (name: 'dimSteps' | 'actionCard') => (options as Record<string, unknown> | undefined)?.[name] !== false
  const picked = (options as Record<string, unknown> | undefined)?.highlightColor
  const color: ColorName = typeof picked === 'string' && picked in COLORS ? (picked as ColorName) : 'ámbar'

  // Told beside the prompt rather than in the system prompt, so the prompt cache survives: once, again after a
  // compaction, and again when the briefing itself changed.
  on('prompt.submit', async ($, e, next) => {
    // A state hiccup must never hold the person's message back.
    const told = (await read($, briefed).catch(() => BRIEFING)) === BRIEFING
    if (!isOn('actionCard') || (e.origin && !PERSON.includes(e.origin.kind)) || told) return next(e)
    await update($, briefed, () => BRIEFING).catch(() => undefined)
    return next({ ...e, context: [...(e.context ?? []), BRIEFING] })
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    await update($, briefed, () => '').catch(() => undefined)
    return result
  })

  // A step that went on to call tools wrote working notes, not the answer.
  on('turn.step', async function* ($, e, next) {
    const response = yield* next(e)
    if (e.agentId === undefined && response.toolUses.length && response.answer.trim()) await update($, steps, texts => added(texts, flat(response.answer)))
    return response
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.answer.trim()) await update($, answers, texts => added(texts, flat(e.answer)))
    return next(e)
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.component !== 'AssistantMessage') return next(e)
    const key = keyOf(e.props.text)
    const [stepTexts, answerTexts] = await Promise.all([read($, steps), read($, answers)])
    const isAnswer = holds(answerTexts, key)

    const { text, actions } = splitActions(e.props.text)
    if (isOn('dimSteps') && !isAnswer && (e.props.isSummary || holds(stepTexts, key))) {
      const { Markdown } = $.ui.resolve(e)
      return <Markdown text={text} dimColor />
    }
    const drawn = text === e.props.text ? e : { ...e, props: { ...e.props, text } }
    if (!isOn('actionCard') || !actions.length) return next(drawn)
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {await next(drawn)}
        {actionLines($, e, actions, color)}
      </Box>
    )
  })
}

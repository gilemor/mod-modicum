import { expect, test } from 'claude-code/testing'
import { BRIEFING, bare, splitActions } from './actions'
import { COLORS } from './register'

test('answer-focus splits off the block of what the answer asks', () => {
  expect(splitActions('Hecho.\n\n<te-toca>\n- Sube la rama.\nDime si lo hago yo.\n</te-toca>')).toEqual({
    text: 'Hecho.',
    actions: ['Sube la rama.', 'Dime si lo hago yo.'],
  })
  expect(splitActions('Hecho. Pasan los tests.')).toEqual({ text: 'Hecho. Pasan los tests.', actions: [] })
  expect(splitActions('Hecho.\n\n<te-to')).toEqual({ text: 'Hecho.', actions: [] })
  expect(splitActions('Hecho.\n<te-toca>\nRecarga')).toEqual({ text: 'Hecho.', actions: ['Recarga'] })
  expect(splitActions('Te señalaré las discrepancias.\n<te-toca> ¿Me adjuntas el JSON? </te-toca>')).toEqual({
    text: 'Te señalaré las discrepancias.',
    actions: ['¿Me adjuntas el JSON?'],
  })
  const mention = 'Cierro con un bloque `<te-toca>`, una acción por línea.\n\nY sigo.'
  expect(splitActions(mention)).toEqual({ text: mention, actions: [] })
  const fenced = 'Así:\n```\n<te-toca>\nRecarga\n</te-toca>\n```'
  expect(splitActions(fenced)).toEqual({ text: fenced, actions: [] })
  const notLast = 'Antes.\n<te-toca>\nRecarga\n</te-toca>\nY después más texto.'
  expect(splitActions(notLast)).toEqual({ text: notLast, actions: [] })
})

test('answer-focus keeps names intact in what it draws', () => {
  expect(bare('Revisa `__init__.py` y **foo**')).toBe('Revisa __init__.py y foo')
})

test('answer-focus draws at most four asks and keeps the rest in the answer', () => {
  expect(splitActions('Ok.\n<te-toca>\n1\n2\n3\n4\n5\n6\n</te-toca>')).toEqual({ text: 'Ok.\n\n5\n6', actions: ['1', '2', '3', '4'] })
})

test('answer-focus leaves a tag that was only mentioned in the text', () => {
  const mention = 'La etiqueta es:\n<te-toca>\nAsí se explica.\n\nY sigue la respuesta.'
  expect(splitActions(mention)).toEqual({ text: mention, actions: [] })
  expect(splitActions('Ok.\n<te-toca>\nUno\n\nDos\n</te-toca>')).toEqual({ text: 'Ok.', actions: ['Uno', 'Dos'] })
})

test('answer-focus closes a fence only with its own marker', () => {
  expect(splitActions('```\n~~~\n```\n<te-toca>\nHazlo\n</te-toca>')).toEqual({ text: '```\n~~~\n```', actions: ['Hazlo'] })
  const open = '```\n~~~\n<te-toca>\nHazlo\n</te-toca>'
  expect(splitActions(open)).toEqual({ text: open, actions: [] })
})

const MESSAGE = (requestId: string, text: string) => ({
  plugin: 'answer-focus',
  component: 'AssistantMessage',
  surface: 'desktop',
  requestId,
  props: { text, isFirstOfReply: true },
} as const)

const ANSWER = 'Listo.\n\n<te-toca>\nRecarga la página y dime si se ve bien.\n</te-toca>'

test('answer-focus dims working notes and draws the asks under the answer', async ($, on) => {
  on('turn.step', async function* (_: unknown, e: any) {
    return e.index === 0
      ? { turnId: e.turnId, index: 0, answer: 'Miro el código primero.', toolUses: [{ id: 't1', name: 'Read', input: {} }], stopReason: 'tool_use', usage: null }
      : { turnId: e.turnId, index: 1, answer: ANSWER, toolUses: [], stopReason: 'end_turn', usage: null }
  } as any)
  on('turn.complete', (_: unknown, e: any) => ({ text: e.answer }))
  on('ui.render', ($: any, e: any) => {
    const { Markdown } = $.ui.resolve(e)
    return <Markdown text={e.props.text} />
  })

  for (const index of [0, 1]) {
    const stream = ($ as any).turn.step({ turnId: 't', index, messageCount: 1, model: 'claude-opus-5-5' })
    for await (const _ of stream);
    await stream.result
  }
  await $.turn.complete({ turnId: 't', answer: ANSWER, durationMs: 1, isAborted: false, reason: 'answer' } as any)

  const step = await $.ui.mount(MESSAGE('m1', 'Miro el código primero.'))
  expect((await step.find({ type: 'Markdown' }))?.props.dimColor).toBe(true)

  const answer = await $.ui.mount(MESSAGE('m2', ANSWER))
  expect((await answer.find({ type: 'Markdown' }))?.text).toBe('Listo.')
  const line = await answer.find({ type: 'Text', text: /^→ Recarga/ })
  expect(line?.children.at(-1)).toEqual({
    type: 'Text',
    props: { backgroundColor: expect.any(String) },
    children: ['Recarga la página y dime si se ve bien.'],
  })
})

test('answer-focus tells Claude how to mark asks once a session', async ($, on) => {
  on('prompt.submit', (_: unknown, e: any) => e)
  const first: any = await ($ as any).prompt.submit({ text: 'hola', origin: { kind: 'composer' } })
  const second: any = await ($ as any).prompt.submit({ text: 'otra', origin: { kind: 'composer' } })
  expect(first.context).toEqual([BRIEFING])
  expect(second.context ?? []).toEqual([])
})

test('answer-focus highlights in the colour picked in its options', { options: { highlightColor: 'verde' } }, async ($, on) => {
  on('ui.render', ($: any, e: any) => {
    const { Markdown } = $.ui.resolve(e)
    return <Markdown text={e.props.text} />
  })
  for (const surface of ['desktop', 'terminal'] as const) {
    const answer = await $.ui.mount({ ...MESSAGE('m', ANSWER), surface })
    const line = await answer.find({ type: 'Text', text: /^→ Recarga/ })
    expect((line?.children.at(-1) as any).props.backgroundColor).toBe(surface === 'desktop' ? COLORS.verde.wash : 'success')
    expect((line?.children[0] as any).props.color).toBe('success')
  }
})

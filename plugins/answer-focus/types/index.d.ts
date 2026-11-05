/** The briefing Claude was last given this session on how to mark what it asks the reader; empty before. */
export type Briefed = string

declare module 'claude-code' {
  interface PluginState {
    'answer-focus': {
      /** Text Claude wrote before calling tools, normalized, newest last. */
      steps: string[]
      /** Final answers, normalized, newest last: never dimmed, even when a step said the same. */
      answers: string[]
      briefed: Briefed
    }
  }
}


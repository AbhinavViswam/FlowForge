import { EventEmitter } from 'events'

// Live run updates (step started / finished / logs) for the editor. Runs happen
// in this same process, so a plain in-memory emitter is enough; index.ts
// forwards each event to the browsers watching that workflow.

export type WorkflowEvent = {
  executionId: string
  workflowId: string
  type: string
  payload: any
}

const emitter = new EventEmitter()
emitter.setMaxListeners(0)

export function publishWorkflowEvent(event: WorkflowEvent) {
  emitter.emit('event', event)
}

export function onWorkflowEvent(listener: (event: WorkflowEvent) => void) {
  emitter.on('event', listener)
  return () => emitter.off('event', listener)
}

import { executeWorkflow } from '@flowforge/workflow-engine'
import { prisma } from '../db'
import { publishWorkflowEvent } from '../events'
import { QUEUE_NAME, startQueue } from '../queue'
import { resolveConnectionsForUser } from '../routes/workflows'

export type ExecutionJob = {
  executionId: string
  workflowVersionId: string
  eventId?: string
  payload: any
}

/**
 * Run one queued execution. Steps that already completed on an earlier attempt
 * are skipped. Throwing makes the queue retry the job later.
 */
export async function runExecution(job: ExecutionJob, attempt = 1) {
  const { executionId, workflowVersionId, payload } = job
  console.log(`[Runner] Execution ${executionId} (attempt ${attempt})`)

  try {
    const version = await prisma.workflowVersion.findUnique({
      where: { id: workflowVersionId },
      include: { workflow: { select: { userId: true } } },
    })
    if (!version || !version.definition) {
      throw new Error(`Workflow version ${workflowVersionId} not found or missing definition`)
    }
    const definition = version.definition as any

    // Saved email accounts this workflow uses, decrypted, for its owner only.
    const connections = await resolveConnectionsForUser(definition, version.workflow.userId)

    const previousNodes = await prisma.nodeExecution.findMany({ where: { executionId } })
    const previousResults: Record<string, any> = {}
    for (const n of previousNodes) if (n.status === 'completed') previousResults[n.nodeId] = n

    const publish = (type: string, eventPayload: any) =>
      publishWorkflowEvent({ executionId, workflowId: version.workflowId, type, payload: eventPayload })

    const startTime = Date.now()
    publish('execution_started', { startedAt: new Date().toISOString(), attempt })

    const result = await executeWorkflow(
      definition,
      payload,
      previousResults,
      (log) => publish('log', log),
      (nodeResult) => publish('node_complete', nodeResult),
      { connections },
    )

    publish('execution_finished', { status: result.status, durationMs: Date.now() - startTime })

    await prisma.execution.update({
      where: { id: executionId },
      data: { status: result.status, finishedAt: new Date() },
    })

    for (const [nodeId, nResult] of Object.entries(result.nodeResults)) {
      // Already saved as completed on an earlier attempt.
      if (previousResults[nodeId] && nResult.status === 'completed') continue
      const existing = previousNodes.find((n) => n.nodeId === nodeId)
      if (existing) {
        await prisma.nodeExecution.update({
          where: { id: existing.id },
          data: {
            status: nResult.status,
            output: nResult.output || {},
            error: nResult.error || null,
            attempts: (existing.attempts || 0) + 1,
          },
        })
      } else {
        await prisma.nodeExecution.create({
          data: {
            executionId,
            nodeId,
            status: nResult.status,
            input: nResult.input || {},
            output: nResult.output || {},
            error: nResult.error || null,
            attempts: 1,
          },
        })
      }
    }

    console.log(`[Runner] Execution ${executionId} finished: ${result.status}`)
    if (result.status === 'failed') {
      throw new Error('Workflow execution failed at one or more steps.')
    }
    return result
  } catch (error: any) {
    console.error(`[Runner] Execution ${executionId} failed:`, error?.message || error)
    await prisma.execution
      .update({ where: { id: executionId }, data: { status: 'failed', finishedAt: new Date() } })
      .catch(() => {})
    throw error
  }
}

/** Start picking up queued runs in this process. */
export async function startRunner() {
  const boss = await startQueue()
  await boss.work(
    QUEUE_NAME,
    {
      localConcurrency: Number(process.env.RUNNER_CONCURRENCY) || 2,
      pollingIntervalSeconds: 2,
    },
    async (jobs: Array<{ data: ExecutionJob; retryCount: number }>) => {
      for (const job of jobs) await runExecution(job.data, job.retryCount + 1)
    },
  )
  console.log('[Runner] Ready to run workflows')
}

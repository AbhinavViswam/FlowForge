import { z } from 'zod';

export const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  prompt: z.string().optional(),
});
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

export const updateWorkflowSchema = z.object({
  name: z.string().optional(),
  definition: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any())
  }).optional(),
});
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;

// Strict schemas for activation
export const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.any()),
  position: z.object({
    x: z.number(),
    y: z.number()
  }).optional()
});

export const workflowEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
});

export const activateWorkflowSchema = z.object({
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema)
});
export type ActivateWorkflowInput = z.infer<typeof activateWorkflowSchema>;


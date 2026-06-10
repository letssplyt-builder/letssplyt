import { z } from 'zod';

export const ItemAssignmentSchema = z.object({
  item_id: z.string().uuid(),
  assigned_to: z.array(z.string().min(1)).min(1),
});

export const SplitAssignmentOutputSchema = z.object({
  assignments: z.array(ItemAssignmentSchema),
  unassigned_item_ids: z.array(z.string().uuid()),
  confidence: z.number().min(0).max(1),
});

export type SplitAssignmentOutput = z.infer<typeof SplitAssignmentOutputSchema>;

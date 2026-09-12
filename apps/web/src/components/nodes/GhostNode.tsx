import { Handle, Position, NodeProps } from '@xyflow/react';

export default function GhostNode({ data }: NodeProps) {
  return (
    <div className="px-3 py-1.5 rounded border border-dashed border-surface-container-highest bg-surface-container-lowest/60 text-label-sm font-label-sm text-on-surface-variant flex items-center gap-1.5">
       <Handle type="target" position={Position.Left} className="opacity-0" />
       <span className="material-symbols-outlined text-[14px]" data-icon="delete">delete</span>
       {data.label as string || 'Drop Stream'}
    </div>
  );
}


import { Handle, Position, NodeProps } from '@xyflow/react';
import { Ban } from 'lucide-react';

export default function GhostNode({ data }: NodeProps) {
  return (
    <div className="px-3 py-2 rounded-xl border border-dashed border-line bg-surface-2 text-sm font-medium text-muted flex items-center gap-2">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Ban size={14} />
      {(data.label as string) || 'Stop here'}
    </div>
  );
}

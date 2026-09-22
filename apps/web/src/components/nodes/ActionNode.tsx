import { Handle, Position, NodeProps } from '@xyflow/react';
import { Send, Mail, Database, Sparkles, Boxes, CheckCircle2, XCircle } from 'lucide-react';

const handleCls = '!w-3 !h-3 !rounded-full !bg-surface !border-2 !border-accent';

const ICONS: Record<string, any> = {
  http: Send,
  email: Mail,
  sink: Database,
  ai: Sparkles,
  enrich: Boxes,
};

export default function ActionNode({ data, selected }: NodeProps) {
  const state = data.executionState as string | undefined;
  const Icon = ICONS[(data.actionType as string) || ''] || Boxes;

  const ring =
    state === 'failed' ? 'border-danger ring-2 ring-danger/25'
    : state === 'completed' ? 'border-ok ring-2 ring-ok/25'
    : selected ? 'border-accent ring-2 ring-accent/25'
    : 'border-line hover:border-accent/40';

  return (
    <div className={`w-56 rounded-xl border bg-surface shadow-card px-3.5 py-3 transition-all ${state === 'skipped' ? 'opacity-50' : ''} ${ring}`}>
      <Handle type="target" position={Position.Left} className={`${handleCls} !-left-1.5`} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-surface-2 text-accent grid place-items-center shrink-0 border border-line">
            <Icon size={15} />
          </span>
          <span className="text-sm font-semibold text-ink truncate">{(data.label as string) || 'Action'}</span>
        </div>
        {state === 'completed' ? <CheckCircle2 size={15} className="text-ok shrink-0" />
          : state === 'failed' ? <XCircle size={15} className="text-danger shrink-0" /> : null}
      </div>
      <div className="mt-2 font-mono text-[11px] text-muted truncate">
        {(data.subtitle as string) || 'Do something…'}
      </div>
      <Handle type="source" position={Position.Right} className={`${handleCls} !-right-1.5`} />
    </div>
  );
}

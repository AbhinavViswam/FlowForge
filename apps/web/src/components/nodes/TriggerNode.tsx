import { Handle, Position, NodeProps } from '@xyflow/react';
import { Webhook, Clock, Radio, CheckCircle2 } from 'lucide-react';

const handleCls = '!w-3 !h-3 !rounded-full !bg-surface !border-2 !border-accent';

export default function TriggerNode({ data, selected }: NodeProps) {
  const state = data.executionState as string | undefined;
  const triggerType = (data.triggerType as string) || 'webhook';
  const Icon = triggerType === 'cron' ? Clock : triggerType === 'redis' ? Radio : Webhook;

  const ring =
    state === 'failed' ? 'border-danger ring-2 ring-danger/25'
    : state === 'completed' ? 'border-ok ring-2 ring-ok/25'
    : state === 'running' ? 'border-accent ring-2 ring-accent/30 animate-pulse'
    : selected ? 'border-accent ring-2 ring-accent/25'
    : 'border-line hover:border-accent/40';

  return (
    <div className={`w-56 rounded-xl border bg-surface shadow-card px-3.5 py-3 transition-all ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-accent-soft text-accent grid place-items-center shrink-0">
            <Icon size={15} />
          </span>
          <span className="text-sm font-semibold text-ink truncate">{(data.label as string) || 'Trigger'}</span>
        </div>
        {state === 'completed' && <CheckCircle2 size={15} className="text-ok shrink-0" />}
      </div>
      <div className="mt-2 font-mono text-[11px] text-muted truncate">
        {(data.subtitle as string) || 'When this fires…'}
      </div>
      <Handle type="source" position={Position.Right} className={`${handleCls} !-right-1.5`} />
    </div>
  );
}

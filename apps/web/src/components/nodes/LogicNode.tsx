import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

const handleCls = '!w-3 !h-3 !rounded-full !bg-surface !border-2';

export default function LogicNode({ data, selected }: NodeProps) {
  const state = data.executionState as string | undefined;
  const evalResult = data.evaluationResult as boolean | undefined;

  const ring =
    state === 'failed' ? 'border-danger ring-2 ring-danger/25'
    : state === 'completed' ? 'border-ok ring-2 ring-ok/25'
    : selected ? 'border-warn ring-2 ring-warn/25'
    : 'border-line hover:border-warn/40';

  return (
    <div className={`w-56 rounded-xl border bg-surface shadow-card px-3.5 py-3 transition-all ${ring}`}>
      <Handle type="target" position={Position.Left} className={`${handleCls} !border-warn !-left-1.5`} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-warn/10 text-warn grid place-items-center shrink-0">
            <GitBranch size={15} />
          </span>
          <span className="text-sm font-semibold text-ink truncate">{(data.label as string) || 'If / condition'}</span>
        </div>
        {state === 'completed' && evalResult !== undefined && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${evalResult ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'}`}>
            {evalResult ? 'TRUE' : 'FALSE'}
          </span>
        )}
      </div>
      <div className="mt-2 font-mono text-[11px] text-muted truncate">
        {(data.subtitle as string) || 'If a condition is met…'}
      </div>

      <div className="mt-2.5 flex flex-col gap-1">
        <div className={`flex items-center justify-between text-[10px] px-2 py-1 rounded-md ${evalResult === true ? 'bg-ok/15 text-ok font-semibold' : 'text-muted bg-surface-2'}`}>
          <span>True →</span><span>continue</span>
        </div>
        <div className={`flex items-center justify-between text-[10px] px-2 py-1 rounded-md ${evalResult === false ? 'bg-warn/15 text-warn font-semibold' : 'text-muted bg-surface-2'}`}>
          <span>False →</span><span>other path</span>
        </div>
      </div>

      <Handle type="source" id="true" position={Position.Right} style={{ top: '66%' }} className={`${handleCls} !border-ok !-right-1.5`} />
      <Handle type="source" id="false" position={Position.Right} style={{ top: '86%' }} className={`${handleCls} !border-warn !-right-1.5`} />
    </div>
  );
}

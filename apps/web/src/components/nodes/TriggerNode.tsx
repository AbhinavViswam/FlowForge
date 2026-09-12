import { Handle, Position, NodeProps } from '@xyflow/react';

export default function TriggerNode({ data, selected }: NodeProps) {
  const isExecCompleted = data.executionState === 'completed';
  const isExecFailed = data.executionState === 'failed';
  const isExecRunning = data.executionState === 'running';

  const borderClass = isExecFailed
    ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] ring-1 ring-rose-500'
    : isExecCompleted
    ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500'
    : isExecRunning
    ? 'border-primary animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.4)]'
    : selected
    ? 'border-primary ring-1 ring-primary'
    : 'border-surface-container-highest hover:border-primary';

  return (
    <div className={`w-52 bg-surface-container-low border ${borderClass} rounded p-space-sm shadow-lg transition-all duration-300`}>
      <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-highest">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-primary" data-icon="bolt">bolt</span>
          <span className="text-label-sm font-label-sm text-on-surface font-semibold truncate max-w-[120px]">
            {data.label as string}
          </span>
        </div>
        {isExecCompleted ? (
          <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            PASS
          </span>
        ) : isExecRunning ? (
          <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-tertiary"></span>
        )}
      </div>
      <div className="pt-space-xs flex flex-col gap-1">
        <span className="text-code-snippet font-code-snippet text-[10px] text-on-surface-variant truncate">
          {data.subtitle as string || 'POST /v1/events/webhook'}
        </span>
        <div className="flex items-center justify-between text-[10px] font-code-snippet mt-1">
          <span className={isExecCompleted ? 'text-emerald-400 font-medium' : 'text-tertiary'}>
            {data.status as string || 'Active'}
          </span>
          <span className="text-on-surface-variant">
            {data.substatus as string || '200 OK'}
          </span>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !rounded-full !bg-surface-container-lowest !border-2 !border-primary cursor-crosshair !-right-2"
      />
    </div>
  );
}


import { Handle, Position, NodeProps } from '@xyflow/react';

export default function ActionNode({ data, selected }: NodeProps) {
  const icon = (data.icon as string) || 'hub';
  const colorClass = (data.color as string) || 'primary-container';
  const isExecCompleted = data.executionState === 'completed';
  const isExecFailed = data.executionState === 'failed';
  const isExecSkipped = data.executionState === 'skipped';

  const borderColor = isExecFailed
    ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] ring-1 ring-rose-500'
    : isExecCompleted
    ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500'
    : selected 
    ? `border-${colorClass} shadow-[0_0_16px_rgba(225,29,72,0.25)] ring-1 ring-${colorClass}` 
    : 'border-surface-container-highest shadow-lg hover:border-secondary';

  const textClass = isExecCompleted ? 'text-emerald-400' : `text-${colorClass}`;
  const borderHandle = isExecCompleted ? '!border-emerald-500' : `!border-${colorClass}`;

  return (
    <div className={`w-52 bg-surface-container-low border ${borderColor} rounded p-space-sm transition-all duration-300 ${isExecSkipped ? 'opacity-40' : ''}`}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3.5 !h-3.5 !rounded-full !bg-surface-container-lowest !border-2 ${borderHandle} cursor-crosshair !-left-2`}
      />
      <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-highest">
        <div className="flex items-center gap-1.5">
          <span className={`material-symbols-outlined text-[14px] ${textClass}`} data-icon={icon}>{icon}</span>
          <span className="text-label-sm font-label-sm text-on-surface font-semibold truncate max-w-[130px]">{data.label as string}</span>
        </div>
        {isExecCompleted ? (
          <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            200 OK
          </span>
        ) : isExecSkipped ? (
          <span className="text-[9px] text-on-surface-variant font-code-snippet">SKIPPED</span>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-surface-container-highest"></span>
        )}
      </div>
      <div className="pt-space-xs flex flex-col gap-1">
        <span className="text-code-snippet font-code-snippet text-[10px] text-on-surface-variant truncate">{data.subtitle as string || 'Action'}</span>
        <div className="flex items-center justify-between text-[10px] font-code-snippet mt-1">
          <span className={textClass}>{data.status as string || 'Ready'}</span>
          <span className="text-on-surface-variant">{data.substatus as string || '0ms'}</span>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3.5 !h-3.5 !rounded-full !bg-surface-container-lowest !border-2 ${borderHandle} cursor-crosshair !-right-2`}
      />
    </div>
  );
}


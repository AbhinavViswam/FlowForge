import { Handle, Position, NodeProps } from '@xyflow/react';

export default function ActionNode({ data, selected }: NodeProps) {
  const icon = (data.icon as string) || 'hub';
  const colorClass = (data.color as string) || 'primary-container';
  const isExecCompleted = data.executionState === 'completed';
  const isExecFailed = data.executionState === 'failed';
  const isExecSkipped = data.executionState === 'skipped';

  const borderColor = isExecFailed
    ? 'border-rose-500 shadow-lg shadow-rose-500/20 ring-1 ring-rose-500'
    : isExecCompleted
    ? 'border-emerald-500 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500'
    : selected 
    ? `border-${colorClass} shadow-xl shadow-primary/20 ring-1 ring-${colorClass}` 
    : 'border-base-300 shadow-xl hover:shadow-2xl hover:border-secondary';

  const textClass = isExecCompleted ? 'text-emerald-400' : `text-${colorClass}`;
  const borderHandle = isExecCompleted ? '!border-emerald-500' : `!border-${colorClass}`;

  return (
    <div className={`w-64 bg-base-100 border ${borderColor} rounded-xl p-4 transition-all duration-300 ${isExecSkipped ? 'opacity-40' : ''}`}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3.5 !h-3.5 !rounded-full !bg-base-200 !border-2 ${borderHandle} cursor-crosshair !-left-2`}
      />
      <div className="flex items-center justify-between pb-3 border-b border-base-300">
        <div className="flex items-center gap-1.5">
          <span className={`material-symbols-outlined text-[14px] ${textClass}`} data-icon={icon}>{icon}</span>
          <span className="text-sm font-semibold text-base-content font-semibold truncate max-w-[130px]">{data.label as string}</span>
        </div>
        {isExecCompleted ? (
          <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded-xl text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            200 OK
          </span>
        ) : isExecSkipped ? (
          <span className="text-[9px] text-base-content/70 font-code-snippet">SKIPPED</span>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-base-200"></span>
        )}
      </div>
      <div className="pt-3 flex flex-col gap-1">
        <span className="font-mono text-[10px] text-base-content/70 truncate">{data.subtitle as string || 'Action'}</span>
        <div className="flex items-center justify-between text-[10px] font-code-snippet mt-1">
          <span className={textClass}>{data.status as string || 'Ready'}</span>
          <span className="text-base-content/70">{data.substatus as string || '0ms'}</span>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3.5 !h-3.5 !rounded-full !bg-base-200 !border-2 ${borderHandle} cursor-crosshair !-right-2`}
      />
    </div>
  );
}


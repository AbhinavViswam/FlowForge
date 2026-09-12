import { Handle, Position, NodeProps } from '@xyflow/react';

export default function LogicNode({ data, selected }: NodeProps) {
  const isExecCompleted = data.executionState === 'completed';
  const isExecFailed = data.executionState === 'failed';
  const evalResult = data.evaluationResult;

  const borderClass = isExecFailed
    ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] ring-1 ring-rose-500'
    : isExecCompleted
    ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500'
    : selected
    ? 'border-tertiary ring-1 ring-tertiary'
    : 'border-surface-container-highest hover:border-tertiary';

  return (
    <div className={`w-56 bg-surface-container-low border ${borderClass} rounded p-space-sm shadow-lg transition-all duration-300`}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !rounded-full !bg-surface-container-lowest !border-2 !border-tertiary cursor-crosshair !-left-2"
      />
      <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-highest">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-tertiary" data-icon="schema">schema</span>
          <span className="text-label-sm font-label-sm text-on-surface font-semibold truncate max-w-[130px]">
            {data.label as string}
          </span>
        </div>
        {isExecCompleted && evalResult !== undefined ? (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${evalResult ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
            {evalResult ? 'TRUE' : 'FALSE'}
          </span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-tertiary"></span>
        )}
      </div>
      <div className="pt-space-xs flex flex-col gap-1">
        <span className="text-code-snippet font-code-snippet text-[10px] text-on-surface-variant truncate">
          {data.subtitle as string || 'IF: account_tier === "enterprise"'}
        </span>
        
        <div className="relative mt-2 flex flex-col gap-2">
           <div className={`flex justify-between items-center text-[10px] font-code-snippet px-1.5 py-0.5 rounded ${evalResult === true ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40' : 'text-tertiary'}`}>
             <span>Branch True</span>
             {evalResult === true && <span className="text-[10px]">✓ Selected</span>}
           </div>
           <div className={`flex justify-between items-center text-[10px] font-code-snippet px-1.5 py-0.5 rounded ${evalResult === false ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40' : 'text-on-surface-variant'}`}>
             <span>Branch False</span>
             {evalResult === false && <span className="text-[10px]">✓ Selected</span>}
           </div>
        </div>
      </div>
      
      {/* Right Output Sockets */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '65%' }}
        className="!w-3.5 !h-3.5 !rounded-full !bg-surface-container-lowest !border-2 !border-tertiary cursor-crosshair !-right-2"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '85%' }}
        className="!w-3.5 !h-3.5 !rounded-full !bg-surface-container-lowest !border-2 !border-surface-container-highest cursor-crosshair !-right-2"
      />
    </div>
  );
}


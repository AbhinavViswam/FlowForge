import { Handle, Position, NodeProps } from '@xyflow/react';

export default function LogicNode({ data, selected }: NodeProps) {
  const isExecCompleted = data.executionState === 'completed';
  const isExecFailed = data.executionState === 'failed';
  const evalResult = data.evaluationResult;

  const borderClass = isExecFailed
    ? 'border-rose-500 shadow-lg shadow-rose-500/20 ring-1 ring-rose-500'
    : isExecCompleted
    ? 'border-emerald-500 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500'
    : selected
    ? 'border-tertiary ring-1 ring-tertiary'
    : 'border-base-300 hover:border-tertiary';

  return (
    <div className={`w-56 bg-base-100 border ${borderClass} rounded-xl p-4 shadow-xl hover:shadow-2xl transition-all duration-300`}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !rounded-full !bg-base-200 !border-2 !border-tertiary cursor-crosshair !-left-2"
      />
      <div className="flex items-center justify-between pb-3 border-b border-base-300">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-tertiary" data-icon="schema">schema</span>
          <span className="text-sm font-semibold text-base-content font-semibold truncate max-w-[130px]">
            {data.label as string}
          </span>
        </div>
        {isExecCompleted && evalResult !== undefined ? (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xl text-[9px] font-semibold ${evalResult ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
            {evalResult ? 'TRUE' : 'FALSE'}
          </span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-tertiary"></span>
        )}
      </div>
      <div className="pt-3 flex flex-col gap-1">
        <span className="font-mono text-[10px] text-base-content/70 truncate">
          {data.subtitle as string || 'IF: account_tier === "enterprise"'}
        </span>
        
        <div className="relative mt-2 flex flex-col gap-2">
           <div className={`flex justify-between items-center text-[10px] font-code-snippet px-1.5 py-0.5 rounded-xl ${evalResult === true ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40' : 'text-tertiary'}`}>
             <span>Branch True</span>
             {evalResult === true && <span className="text-[10px]">✓ Selected</span>}
           </div>
           <div className={`flex justify-between items-center text-[10px] font-code-snippet px-1.5 py-0.5 rounded-xl ${evalResult === false ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40' : 'text-base-content/70'}`}>
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
        className="!w-3.5 !h-3.5 !rounded-full !bg-base-200 !border-2 !border-tertiary cursor-crosshair !-right-2"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '85%' }}
        className="!w-3.5 !h-3.5 !rounded-full !bg-base-200 !border-2 !border-base-300 cursor-crosshair !-right-2"
      />
    </div>
  );
}


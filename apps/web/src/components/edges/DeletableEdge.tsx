import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { X } from 'lucide-react';

// A smoothstep edge with a delete control at its midpoint. The button sits in an
// overlay (EdgeLabelRenderer); it's subtle by default and brightens on hover so
// disconnecting is discoverable without needing the keyboard.
export default function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="ff-edge-delete nodrag nopan"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          title="Remove connection"
          onClick={(e) => { e.stopPropagation(); deleteElements({ edges: [{ id }] }); }}
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

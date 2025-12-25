import { useNavigate } from "@tanstack/react-router";
import {
  type Node,
  type NodeProps,
  Position,
  useReactFlow,
} from "@xyflow/react";
import { Cctv } from "lucide-react";
import { useCallback } from "react";
import { BaseNode } from "~/components/base-node";
import { LabeledHandle } from "~/components/labeled-handle";
import {
  NodeHeaderActions,
  NodeHeaderMenuAction,
  NodeHeaderTitle,
} from "~/components/node-header";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";

export type NumNode = Node<{
  value: number;
  name: string;
  path: string;
}>;

export function NumNode({ id, data }: NodeProps<NumNode>) {
  const { updateNodeData, setNodes } = useReactFlow();
  const navigate = useNavigate();

  const handleReset = useCallback(() => {
    updateNodeData(id, { value: 0 });
  }, [id, updateNodeData]);

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
  }, [id, setNodes]);

  const _handleIncr = useCallback(() => {
    updateNodeData(id, { value: data.value + 1 });
  }, [id, data.value, updateNodeData]);

  const _handleDecr = useCallback(() => {
    updateNodeData(id, { value: data.value - 1 });
  }, [id, data.value, updateNodeData]);

  const handleClick = useCallback(() => {
    if (data.path) {
      navigate({ to: data.path });
    }
  }, [data.path, navigate]);

  return (
    <BaseNode onClick={handleClick}>
      {/* <NodeHeader> */}

      <div className="flex gap-2 items-center mb-8">
        <NodeHeaderTitle>
          <Cctv />
        </NodeHeaderTitle>
        <NodeHeaderActions>
          <NodeHeaderMenuAction label="Open node menu">
            <DropdownMenuItem onSelect={handleReset}>Reset</DropdownMenuItem>
            <DropdownMenuItem onSelect={handleDelete}>Delete</DropdownMenuItem>
          </NodeHeaderMenuAction>
        </NodeHeaderActions>
      </div>

      <footer className="bg-gray-100 -m-5">
        <LabeledHandle
          title={data.name}
          type="source"
          position={Position.Right}
        />
      </footer>
    </BaseNode>
  );
}

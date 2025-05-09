import React, { useEffect, useRef, useState } from "react";
import { Info, Plus, Edit, Trash2, X, Save, ZoomIn, ZoomOut, Loader2 } from "lucide-react";

const typeColors = {
  person: "#4299e1", 
  trait: "#68d391",
  belief: "#f6ad55",
  goal: "#fc8181", 
  default: "#a0aec0" 
};

const typeBgColors = {
  person: "rgba(66, 153, 225, 0.8)",
  trait: "rgba(104, 211, 145, 0.8)",
  belief: "rgba(246, 173, 85, 0.8)",
  goal: "rgba(252, 129, 129, 0.8)",
  default: "rgba(160, 174, 192, 0.8)"
};

const typeIcons = {
  person: "👤",
  trait: "✨",
  belief: "💭",
  goal: "🎯",
  default: "📌"
};

const computeLayout = (nodes, edges, svgWidth, svgHeight) => {
  if (!nodes || nodes.length === 0) return [];

  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const alphaDecay = 0.02;
  const velocityDecay = 0.6;
  const repulsionStrength = .001; 
  const linkDistance = .0005;
  const linkStrength = 0.0001; 
  const iterations = 5;

  const layoutNodes = nodes.map(node => ({ ...node }));

  layoutNodes.forEach(node => {
    if (node.id === "1" || node.label.toLowerCase() === "you") {
      node.x = centerX;
      node.y = centerY;
      node.fx = centerX;
      node.fy = centerY; 
    } else {
      if (node.x == null || node.y == null || isNaN(node.x) || isNaN(node.y)) {
         node.x = centerX + (Math.random() - 0.5) * 100;
         node.y = centerY + (Math.random() - 0.5) * 100;
      }
      node.fx = null;
      node.fy = null;
    }
    node.vx = node.vx || 0;
    node.vy = node.vy || 0;
  });

    const isNodeConnected = (nodeId, allEdges) => {
        return allEdges.some(edge =>
            !edge.isTemporary && (edge.source === nodeId || edge.target === nodeId)
        );
    };

    const tempFloaterEdges = [];
    const youNode = layoutNodes.find(n => n.id === "1" || n.label.toLowerCase() === "you");
    const youNodeId = youNode?.id;

    if (youNodeId) {
      layoutNodes.forEach(node => {
          if (node.id !== youNodeId && !isNodeConnected(node.id, edges)) {
              tempFloaterEdges.push({ source: youNodeId, target: node.id, isTemporary: true });
          }
      });
    }
    const edgesForLayout = [...edges, ...tempFloaterEdges];

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;

    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const a = layoutNodes[i];
        const b = layoutNodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist2 = dx * dx + dy * dy + 1;
        const dist = Math.sqrt(dist2);
        const force = (repulsionStrength * alpha) / dist2;
        const fx = force * (dx / dist);
        const fy = force * (dy / dist);
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    edgesForLayout.forEach(({ source: sourceId, target: targetId, isTemporary }) => {
        const a = layoutNodes.find(n => n.id === sourceId);
        const b = layoutNodes.find(n => n.id === targetId);

        if (!a || !b) return;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const diff = dist - (isTemporary ? linkDistance * 1.5 : linkDistance); 
        const force = (linkStrength * alpha * diff) / (dist || 1); 
        const fx = dx * force;
        const fy = dy * force;

        if (a.fx == null) { a.vx += fx; a.vy += fy; }
        if (b.fx == null) { b.vx -= fx; b.vy += fy; }
    });

    layoutNodes.forEach(node => {
        node.vx *= velocityDecay;
        node.vy *= velocityDecay;

        if (node.fx == null) {
            node.x += node.vx;
            node.y += node.vy;
        } else {
            node.x = node.fx;
            node.y = node.fy;
            node.vx = 0;
            node.vy = 0;
        }
    });
  }

  return layoutNodes;
};

export default function GraphView({ data, onDataChange }) {
  const [layoutNodes, setLayoutNodes] = useState([]);

  const structuralEdges = data?.edges || [];
  const structuralNodes = data?.nodes || [];


  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null); 
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, type: null });
  const [isCreatingEdge, setIsCreatingEdge] = useState(false);
  const [sourceNode, setSourceNode] = useState(null);
  const [edgeForm, setEdgeForm] = useState({ visible: false, sourceId: null, targetId: null, label: "" });
  const [nodeForm, setNodeForm] = useState({
    visible: false,
    id: "",
    label: "",
    type: "person",
    description: "",
    isNew: false,
    x: 0, y: 0 
  });
  const [notification, setNotification] = useState({ visible: false, message: "", type: "success" });
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomStep = 0.1;
  const minZoom = 0.5;
  const maxZoom = 2.0;

  const svgRef = useRef(null);

  const nodeIdCounter = useRef(1);
   useEffect(() => {
       const nodeIds = structuralNodes.map(node => parseInt(node.id) || 0);
       const maxId = nodeIds.length > 0 ? Math.max(...nodeIds) : 0;
       nodeIdCounter.current = maxId >= 1 ? maxId + 1 : 2; 
   }, [structuralNodes]); 


  useEffect(() => {
      if (!svgRef.current || !structuralNodes || structuralNodes.length === 0) {
          setLayoutNodes([]);
          return;
      }

      const svgElement = svgRef.current;
      const svgWidth = svgElement.clientWidth;
      const svgHeight = svgElement.clientHeight;

      console.log("Running layout effect based on structural data change...");

      const nodesWithLayout = computeLayout(structuralNodes, structuralEdges, svgWidth, svgHeight);

      setLayoutNodes(nodesWithLayout);
  }, [structuralNodes.length, structuralEdges.length, svgRef.current]);
   useEffect(() => {
     const handleResize = () => {
       if (svgRef.current && structuralNodes.length > 0) {
         const svgElement = svgRef.current;
         const svgWidth = svgElement.clientWidth;
         const svgHeight = svgElement.clientHeight;
         const nodesWithLayout = computeLayout(structuralNodes, structuralEdges, svgWidth, svgHeight);
         setLayoutNodes(nodesWithLayout);
       }
     };

     const resizeTimer = setTimeout(() => {
       handleResize();
     }, 100);

     window.addEventListener('resize', handleResize);

     return () => {
       clearTimeout(resizeTimer);
       window.removeEventListener('resize', handleResize);
     };
   }, [structuralNodes.length, structuralEdges.length]);


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenu.visible && !event.target.closest('.context-menu')) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);


  const handleMouseDown = (event) => {
    if (event.button !== 0 || contextMenu.visible || nodeForm.visible || edgeForm.visible) return; 

    const svgRect = svgRef.current.getBoundingClientRect();
    setIsPanning(true);
    setStartPan({ x: event.clientX - svgRect.left, y: event.clientY - svgRect.top });
    event.preventDefault();
  };

  const handleMouseMove = (event) => {
    if (!isPanning) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const currentMouseX = event.clientX - svgRect.left;
    const currentMouseY = event.clientY - svgRect.top;

    const dx = currentMouseX - startPan.x;
    const dy = currentMouseY - startPan.y;

    setPanOffset(prev => ({
       x: prev.x + dx,
       y: prev.y + dy
    }));

    setStartPan({ x: currentMouseX, y: currentMouseY });

    event.preventDefault();
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
      setIsPanning(false);
  };


  const handleZoomIn = () => {
      setZoomLevel(prev => Math.min(maxZoom, prev + zoomStep));
  };

  const handleZoomOut = () => {
      setZoomLevel(prev => Math.max(minZoom, prev - zoomStep));
  };


  const handleRightClick = (event) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      type: 'canvas'
    });
    setSelectedNode(null);
  };

  const handleNodeRightClick = (event, layoutNode) => {
    event.preventDefault();
    event.stopPropagation(); 
    const structuralNode = structuralNodes.find(n => n.id === layoutNode.id);
    if (!structuralNode) return;

    setSelectedNode(structuralNode);
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      type: 'node'
    });
  };


  const handleAddNode = () => {
    setContextMenu({ ...contextMenu, visible: false });
     const svgRect = svgRef.current.getBoundingClientRect();
     const graphX = (contextMenu.x - svgRect.left - panOffset.x) / zoomLevel;
     const graphY = (contextMenu.y - svgRect.top - panOffset.y) / zoomLevel;

    setNodeForm({
      visible: true,
      id: String(nodeIdCounter.current), 
      label: "",
      type: "person",
      description: "",
      x: graphX, 
      y: graphY, 
      isNew: true
    });
  };

  const handleEditNode = () => {
    setContextMenu({ ...contextMenu, visible: false });
    if (selectedNode) {
      setNodeForm({
        visible: true,
        id: selectedNode.id,
        label: selectedNode.label,
        type: selectedNode.type || "default",
        description: selectedNode.description || "",
        isNew: false,
      });
    }
  };

  const handleDeleteNode = async () => {
    setContextMenu({ ...contextMenu, visible: false });

    if (!selectedNode) return;

    if (selectedNode.id === "1" || selectedNode.label.toLowerCase() === "you") {
      showNotification("Cannot delete the 'You' node", "error");
      return;
    }

    const updatedStructuralNodes = structuralNodes.filter(node => node.id !== selectedNode.id);
    const updatedStructuralEdges = structuralEdges.filter(
      edge => edge.source !== selectedNode.id && edge.target !== selectedNode.id
    );

    const updatedStructuralGraph = {
      nodes: updatedStructuralNodes,
      edges: updatedStructuralEdges
    };

    const success = await onDataChange(updatedStructuralGraph);

    showNotification(
      success ? "Node deleted successfully" : "Failed to delete node",
      success ? "success" : "error"
    );

    setSelectedNode(null); 
  };

  const handleStartEdge = () => {
    setContextMenu({ ...contextMenu, visible: false });
    if (selectedNode) {
      setSourceNode(selectedNode);
      setIsCreatingEdge(true);
      showNotification(`Connecting from "${selectedNode.label}". Click on another node to connect.`, "info");
    }
  };

  const handleNodeClick = (layoutNode) => {
      if (isPanning) return;

      if (isCreatingEdge && sourceNode && sourceNode.id !== layoutNode.id) {
          const edgeExists = structuralEdges.some(
              edge => (edge.source === sourceNode.id && edge.target === layoutNode.id) ||
                      (edge.source === layoutNode.id && edge.target === sourceNode.id)
          );

          if (edgeExists) {
              showNotification("Connection already exists.", "info");
              setIsCreatingEdge(false);
              setSourceNode(null);
              return;
          }

          setIsCreatingEdge(false);
          setEdgeForm({
              visible: true,
              sourceId: sourceNode.id, 
              targetId: layoutNode.id, 
              label: ""
          });
          setSourceNode(null); 
      } else {
      }
  };

  const saveNodeForm = async () => {
    const { id, label, type, description, isNew, x, y } = nodeForm;

    if (!label.trim()) {
      showNotification("Node label cannot be empty", "error");
      return;
    }

    setNodeForm({ ...nodeForm, visible: false }); 

    let updatedStructuralNodes;
    if (isNew) {
      const newNode = { id, label, type, description, x, y }; 
      updatedStructuralNodes = [...structuralNodes, newNode];
    } else {
      updatedStructuralNodes = structuralNodes.map(node =>
        node.id === id ? {
          ...node,
          label,
          type,
          description
        } : node
      );
    }

    const updatedStructuralGraph = {
      ...data,
      nodes: updatedStructuralNodes 
    };

    const success = await onDataChange(updatedStructuralGraph);

    showNotification(
      success ? `Node ${isNew ? 'created' : 'updated'} successfully` : `Failed to ${isNew ? 'create' : 'update'} node`,
      success ? "success" : "error"
    );
  };

  const saveEdgeForm = async () => {
    const { sourceId, targetId, label } = edgeForm;

    if (!label.trim()) {
      showNotification("Connection label cannot be empty", "error");
      return;
    }

    setEdgeForm({ ...edgeForm, visible: false }); 

     const edgeExists = structuralEdges.some(
         edge => (edge.source === sourceId && edge.target === targetId) ||
                 (edge.source === targetId && edge.target === sourceId)
     );

     let success = true;
     if (edgeExists) {
         showNotification("Connection already exists.", "info");
         success = false;
     } else {
         const newEdge = { source: sourceId, target: targetId, label };
         const updatedStructuralEdges = [...structuralEdges, newEdge];

         const updatedStructuralGraph = {
             ...data,
             edges: updatedStructuralEdges 
         };

         success = await onDataChange(updatedStructuralGraph);

         showNotification(
           success ? "Connection created successfully" : "Failed to create connection",
           success ? "success" : "error"
         );
     }
   };

  const showNotification = (message, type = "success") => {
    setNotification({ visible: true, message, type });
    setTimeout(() => {
      setNotification({ ...notification, visible: false });
    }, 3000);
  };

  const Arrow = () => (
    <defs>
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="9" 
        refY="3.5"
        orient="auto"
        markerUnits="strokeWidth" 
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
      </marker>
    </defs>
  );

   const getNodeLayoutPosition = (nodeId) => {
       return layoutNodes.find(n => n.id === nodeId);
   };

  const getEdgePath = (sourceId, targetId) => {
      const source = getNodeLayoutPosition(sourceId);
      const target = getNodeLayoutPosition(targetId);
      if (!source || !target) return "";
      return `M${source.x},${source.y} L${target.x},${target.y}`;
  };

  const getLabelPosition = (sourceId, targetId) => {
    const source = getNodeLayoutPosition(sourceId);
    const target = getNodeLayoutPosition(targetId);
    if (!source || !target) return { x: 0, y: 0 };
    return {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2
    };
  };

  const handleNodeHover = (layoutNode, event) => {
      if (layoutNode) {
          const svgRect = svgRef.current?.getBoundingClientRect();
          if (!svgRect) return;

          const nodeScreenX = layoutNode.x * zoomLevel + panOffset.x + svgRect.left;
          const nodeScreenY = layoutNode.y * zoomLevel + panOffset.y + svgRect.top;

          setTooltipPosition({
              x: nodeScreenX + 40,
              y: nodeScreenY - 40
          });
          setHoveredNode(layoutNode);
      } else {
          setHoveredNode(null);
      }
  };

  const NodeTooltip = () => {
    if (!hoveredNode) return null;

    return (
      <div
        className="fixed bg-white p-2 rounded shadow-lg border border-gray-200 z-30 pointer-events-none" 
        style={{
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`,
          width: "180px",
           transform: `translate(${tooltipPosition.x + 180 > window.innerWidth ? '-100%' : '0%'}, ${tooltipPosition.y + 100 > window.innerHeight ? '-100%' : '0%'})` 
        }}
      >
        <div className="font-bold text-sm mb-1 break-words">{hoveredNode.label}</div>
        <div className="text-xs text-gray-600 mb-1 capitalize">Type: {hoveredNode.type || "default"}</div>
        {hoveredNode.description && (
            <div className="text-xs text-gray-700 break-words">{hoveredNode.description}</div>
        )}
      </div>
    );
  };


  if (!data) {
    console.log("No data available for GraphView.");
    return (
           <div className="flex justify-center items-center h-full">
           </div>
      );
  }

   const isGraphReady = layoutNodes.length > 0 || structuralNodes.length === 0; 

  return (
    <div className="w-full h-full p-4 bg-gray-50 rounded-lg shadow-sm relative overflow-hidden">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-700">Knowledge Graph</h3>
        <div className="flex items-center space-x-4">
            <div className="flex items-center border rounded-md overflow-hidden shadow-sm">
                 <button
                     onClick={handleZoomOut}
                     disabled={zoomLevel <= minZoom}
                     className="p-1 border-r hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                     <ZoomOut size={18} />
                 </button>
                <span className="text-sm px-2 text-gray-700">{`${Math.round(zoomLevel * 100)}%`}</span>
                 <button
                     onClick={handleZoomIn}
                     disabled={zoomLevel >= maxZoom}
                     className="p-1 border-l hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                     <ZoomIn size={18} />
                 </button>
             </div>

          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-gray-600 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

        {/* {!isGraphReady && structuralNodes.length > 0 && (
             <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
               <Loader2 size={40} className="animate-spin text-blue-600" />
             </div>
           )} */}

        <svg
            ref={svgRef}
            width="100%"
            height="600px" 
            className="bg-white rounded-lg shadow-inner cursor-grab active:cursor-grabbing"
            onContextMenu={handleRightClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave} 
          >
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(0, 0, 0, 0.05)"
                strokeWidth="1"
              />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />

             <Arrow />

            <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>

            {structuralEdges.map((edge, i) => {
              const source = getNodeLayoutPosition(edge.source);
              const target = getNodeLayoutPosition(edge.target);
              if (!source || !target) return null; 

              const labelPos = getLabelPosition(edge.source, edge.target);
              const path = getEdgePath(edge.source, edge.target); 

              return (
                <g key={i} className="edge">
                  <path
                    d={path}
                    stroke="#666"
                    strokeWidth="1.5"
                    fill="none"
                    strokeOpacity="0.8"
                    markerEnd="url(#arrowhead)"
                  />
                  <rect
                    x={labelPos.x - 40 / zoomLevel}
                    y={labelPos.y - 10 / zoomLevel}
                    width={80 / zoomLevel}
                    height={20 / zoomLevel}
                    rx={4 / zoomLevel}
                    fill="white"
                    fillOpacity="0.8"
                     stroke="#ddd"
                     strokeWidth={0.5 / zoomLevel}
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 4 / zoomLevel}
                    fontSize={12 / zoomLevel}
                    fontWeight="500"
                    fill="#555"
                    textAnchor="middle"
                    className="select-none pointer-events-none"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {layoutNodes.map((node) => {
              const isHovered = hoveredNode && hoveredNode.id === node.id;
              const isYouNode = node.id === "1" || node.label.toLowerCase() === "you";

              const nodeRadius = (isYouNode ? 32 : 28) / zoomLevel;
              const strokeWidth = (isHovered ? 4 : 3) / zoomLevel;

              if (node.x == null || node.y == null || isNaN(node.x) || isNaN(node.y)) return null;


              return (
                <g
                  key={node.id}
                  onMouseEnter={(e) => handleNodeHover(node, e)}
                  onMouseLeave={() => handleNodeHover(null)}
                  onClick={() => handleNodeClick(node)}
                  onContextMenu={(e) => handleNodeRightClick(e, node)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeRadius}
                    fill={typeBgColors[node.type] || typeBgColors.default}
                    stroke={typeColors[node.type] || typeColors.default}
                    strokeWidth={strokeWidth}
                    filter={isHovered ? "drop-shadow(0px 0px 4px rgba(0,0,0,0.2))" : "none"}
                    className={isHovered ? "brightness-110" : ""}
                  />

                  <text
                    x={node.x}
                    y={node.y + (isYouNode ? 5 : 4) / zoomLevel}
                    fontSize={(isYouNode ? 14 : 12) / zoomLevel}
                    fontWeight={isYouNode ? "bold" : "normal"}
                    fill="white"
                    textAnchor="middle"
                    className="select-none pointer-events-none"
                    dominantBaseline="middle"
                  >
                     {node.label.length > (isYouNode ? 8 : 10) * zoomLevel ? node.label.substring(0, Math.floor((isYouNode ? 8 : 10) * zoomLevel)) + "..." : node.label}
                  </text>

                  <text
                    x={node.x + (isYouNode ? 24 : 20) / zoomLevel} 
                    y={node.y - (isYouNode ? 18 : 16) / zoomLevel} 
                    fontSize={12 / zoomLevel}
                    fill={typeColors[node.type]}
                    className="select-none pointer-events-none"
                  >
                    {typeIcons[node.type] || typeIcons.default}
                  </text>
                </g>
              );
            })}
            </g>
        </svg>


      <NodeTooltip />

       {contextMenu.visible && (
        <div
          className="context-menu absolute bg-white shadow-lg rounded-lg p-2 z-40 border border-gray-200"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
        >
          {contextMenu.type === 'canvas' && (
            <button
              onClick={handleAddNode}
              className="flex items-center w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded text-gray-700"
            >
              <Plus size={16} className="mr-2" />
              Add Node
            </button>
          )}

          {contextMenu.type === 'node' && selectedNode && (
            <>
              <button
                onClick={handleEditNode}
                className="flex items-center w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded text-gray-700"
              >
                <Edit size={16} className="mr-2" />
                Edit Node
              </button>
              {(selectedNode.id !== "1" && selectedNode.label.toLowerCase() !== "you") && (
                <button
                  onClick={handleDeleteNode}
                  className="flex items-center w-full text-left px-3 py-2 text-sm hover:bg-red-50 rounded text-red-600"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete Node
                </button>
              )}
              <button
                onClick={handleStartEdge}
                className="flex items-center w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded text-gray-700"
              >
                <Plus size={16} className="mr-2" />
                Create Connection
              </button>
            </>
          )}
        </div>
      )}

      {nodeForm.visible && (
        <div className="node-form-modal fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">{nodeForm.isNew ? "Add New Node" : "Edit Node"}</h3>
              <button onClick={() => setNodeForm({ ...nodeForm, visible: false })}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="node-label" className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  id="node-label"
                  type="text"
                  value={nodeForm.label}
                  onChange={(e) => setNodeForm({ ...nodeForm, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="node-type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  id="node-type"
                  value={nodeForm.type}
                  onChange={(e) => setNodeForm({ ...nodeForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="person">Person</option>
                  <option value="trait">Trait</option>
                  <option value="belief">Belief</option>
                  <option value="goal">Goal</option>
                  <option value="default">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="node-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  id="node-description"
                  value={nodeForm.description}
                  onChange={(e) => setNodeForm({ ...nodeForm, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setNodeForm({ ...nodeForm, visible: false })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNodeForm}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {edgeForm.visible && (
        <div className="edge-form-modal fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create Connection</h3>
              <button onClick={() => setEdgeForm({ ...edgeForm, visible: false })}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="edge-label" className="block text-sm font-medium text-gray-700 mb-1">Relationship Label</label>
                <input
                  id="edge-label"
                  type="text"
                  value={edgeForm.label}
                  onChange={(e) => setEdgeForm({ ...edgeForm, label: e.target.value })}
                  placeholder="e.g., is friends with, believes in, aspires to"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setEdgeForm({ ...edgeForm, visible: false })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdgeForm} 
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notification.visible && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center ${
            notification.type === 'success' ? 'bg-green-500' :
            notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}
        >
          <span className="text-white">{notification.message}</span>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500 flex items-center">
        <Info size={16} className="mr-2 flex-shrink-0" />
        <div>
          <p>Hover over nodes to see details. Right-click on empty space to add a node.</p>
          <p>Right-click on nodes to edit, delete, or create connections. Click and drag to pan.</p>
        </div>
      </div>
    </div>
  );
}
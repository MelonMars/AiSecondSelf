import React, { useEffect, useRef, useState } from "react";
import { Info, Plus, Edit, Trash2, X, Save } from "lucide-react";

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

const getGraphData = async () => {
  const authToken = localStorage.getItem("authToken");
  if (!authToken) return { nodes: [], edges: [] };
  try {
    const response = await fetch("http://localhost:8000/user_data", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      }
    });
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();
    console.log("Graph data:", data);

    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const edges = Array.isArray(data.edges) ? data.edges : [];
    return { nodes, edges };
  }
  catch (error) {
    console.error("Error fetching graph data:", error);
    return { nodes: [], edges: [] };
  }
};

const saveGraphData = async (graphData) => {
  const authToken = localStorage.getItem("authToken");
  if (!authToken) return false;
  
  try {
    console.log("Saving graph data:", graphData);

    const response = await fetch("http://localhost:8000/user_data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        user_data: graphData
      })
    });
    
    if (!response.ok) throw new Error("Failed to save graph data");
    return true;
  } catch (error) {
    console.error("Error saving graph data:", error);
    return false;
  }
};

export default function GraphView() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, type: null });
  const [isCreatingEdge, setIsCreatingEdge] = useState(false);
  const [sourceNode, setSourceNode] = useState(null);
  const [edgeForm, setEdgeForm] = useState({ visible: false, label: "" });
  const [nodeForm, setNodeForm] = useState({
    visible: false,
    id: "",
    label: "",
    type: "person",
    description: ""
  });
  const [notification, setNotification] = useState({ visible: false, message: "", type: "success" });
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  
  const svgRef = useRef();
  const nodeIdCounter = useRef(1);
  
const computeLayout = (nodes, edges) => {
  const svgWidth = 800;
  const svgHeight = 600;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const alphaDecay = 0.02;
  const velocityDecay = 0.6;
  const repulsionStrength = 1000;
  const linkDistance = 100;
  const linkStrength = 0.1;
  const iterations = 300;

  nodes.forEach(node => {
    if (node.id === "1" || node.label === "You") {
      node.x = centerX;
      node.y = centerY;
      node.fx = centerX;
      node.fy = centerY;
    } else {
      node.x = Math.random() * svgWidth;
      node.y = Math.random() * svgHeight;
    }
    node.vx = 0;
    node.vy = 0;
  });

  const adj = new Map();
  edges.forEach(({ source, target }) => {
    if (!adj.has(source)) adj.set(source, []);
    if (!adj.has(target)) adj.set(target, []);
    adj.get(source).push(target);
    adj.get(target).push(source);
  });

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist2 = dx * dx + dy * dy + 0.01;
        const force = repulsionStrength * alpha / dist2;
        const fx = force * dx;
        const fy = force * dy;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    edges.forEach(({ source, target }) => {
      const a = nodes.find(n => n.id === source);
      const b = nodes.find(n => n.id === target);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const diff = dist - linkDistance;
      const force = linkStrength * alpha * diff;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    });

    nodes.forEach(node => {
      node.vx *= velocityDecay;
      node.vy *= velocityDecay;
      if (!(node.id === "1" || node.label === "You")) {
        node.x += node.vx;
        node.y += node.vy;
      }
    });
  }

  return nodes;
};
  
  useEffect(() => {
    const updateLayout = () => {
      if (graph.nodes.length > 0) {
        setGraph(prev => ({ 
          ...prev, 
          nodes: computeLayout(prev.nodes, prev.edges)
        }));
      }
    };
    
    updateLayout();
    window.addEventListener('resize', updateLayout);
    
    return () => {
      window.removeEventListener('resize', updateLayout);
    };
  }, [svgRef.current]);
  
  useEffect(() => {
    let isMounted = true;
  
    const fetchData = async () => {
      const data = await getGraphData(); 
      console.log("Fetched graph data:", data);
      if (!isMounted) return;
      
      let nodes = data.nodes;
      
      const youNodeExists = nodes.some(node => node.id === "1" || node.label === "You");
      if (!youNodeExists) {
        const youNode = { id: "1", label: "You", type: "person", description: "" };
        nodes = [youNode];
        saveGraphData({ nodes: [youNode], edges: [] });
      }
      
      const nodesWithLayout = computeLayout(nodes, data.edges);
      
      setGraph({ 
        nodes: nodesWithLayout, 
        edges: data.edges 
      });
      
      const nodeIds = nodes.map(node => parseInt(node.id) || 0);
      const maxId = nodeIds.length > 0 ? Math.max(...nodeIds) : 0;
      nodeIdCounter.current = maxId + 1;
    };
  
    fetchData();
  
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {  
    const handleClickOutside = (event) => {
      if (contextMenu.visible && !event.target.closest('.context-menu')) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);
  
  const handleRightClick = (event) => {
    event.preventDefault();
    const svgRect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - svgRect.left;
    const y = event.clientY - svgRect.top;
    
    setContextMenu({
      visible: true,
      x,
      y,
      type: 'canvas'
    });
  };
  
  const handleNodeRightClick = (event, node) => {
    event.preventDefault();
    event.stopPropagation();
    const svgRect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - svgRect.left;
    const y = event.clientY - svgRect.top;
    
    setSelectedNode(node);
    setContextMenu({
      visible: true,
      x,
      y,
      type: 'node'
    });
  };
  
  const handleAddNode = () => {
    setContextMenu({ ...contextMenu, visible: false });
    setNodeForm({
      visible: true,
      id: String(nodeIdCounter.current),
      label: "",
      type: "person",
      description: "",
      x: contextMenu.x,
      y: contextMenu.y,
      isNew: true
    });
  };
  
  const handleEditNode = () => {
    setContextMenu({ ...contextMenu, visible: false });
    setNodeForm({
      visible: true,
      id: selectedNode.id,
      label: selectedNode.label,
      type: selectedNode.type || "default",
      description: selectedNode.description || "",
      isNew: false
    });
  };
  
  const handleDeleteNode = async () => {
    setContextMenu({ ...contextMenu, visible: false });
    
    if (selectedNode.id === "1" || selectedNode.label === "You") {
      showNotification("Cannot delete the 'You' node", "error");
      return;
    }
    
    const updatedNodes = graph.nodes.filter(node => node.id !== selectedNode.id);
    const updatedEdges = graph.edges.filter(
      edge => edge.source !== selectedNode.id && edge.target !== selectedNode.id
    );
    
    const updatedNodesWithLayout = computeLayout(updatedNodes, updatedEdges);
    
    const updatedGraph = { 
      nodes: updatedNodesWithLayout, 
      edges: updatedEdges 
    };
    
    setGraph(updatedGraph);
    
    const success = await saveGraphData(updatedGraph);
    showNotification(
      success ? "Node deleted successfully" : "Failed to delete node",
      success ? "success" : "error"
    );
  };
  
  const handleStartEdge = () => {
    setContextMenu({ ...contextMenu, visible: false });
    setSourceNode(selectedNode);
    setIsCreatingEdge(true);
    showNotification("Click on another node to create a connection", "info");
  };
  
  const handleNodeClick = (node) => {
    if (isCreatingEdge && sourceNode && sourceNode.id !== node.id) {
      setIsCreatingEdge(false);
      setEdgeForm({
        visible: true,
        sourceId: sourceNode.id,
        targetId: node.id,
        label: ""
      });
    }
  };
  
  const saveNodeForm = async () => {
    const { id, label, type, description, isNew } = nodeForm;
    
    if (!label.trim()) {
      showNotification("Node label cannot be empty", "error");
      return;
    }
    
    let updatedNodes;
    if (isNew) {
      const newNode = { id, label, type, description };
      updatedNodes = [...graph.nodes, newNode];
      nodeIdCounter.current += 1;
    } else {
      updatedNodes = graph.nodes.map(node => 
        node.id === id ? { 
          ...node, 
          label, 
          type, 
          description
        } : node
      );
    }
    
    const updatedNodesWithLayout = computeLayout(updatedNodes, graph.edges);
    
    const updatedGraph = { 
      ...graph, 
      nodes: updatedNodesWithLayout
    };
    
    setGraph(updatedGraph);
    setNodeForm({ ...nodeForm, visible: false });
    
    const success = await saveGraphData(updatedGraph);
    showNotification(
      success ? `Node ${isNew ? 'created' : 'updated'} successfully` : `Failed to ${isNew ? 'create' : 'update'} node`,
      success ? "success" : "error"
    );
  };
  
  const saveEdgeForm = async () => {
    const { sourceId, targetId, label } = edgeForm;
    
    if (!label.trim()) {
      showNotification("Edge label cannot be empty", "error");
      return;
    }
    
    const edgeExists = graph.edges.some(
      edge => edge.source === sourceId && edge.target === targetId
    );
    
    let updatedEdges;
    if (edgeExists) {
      updatedEdges = graph.edges.map(edge => 
        (edge.source === sourceId && edge.target === targetId) 
          ? { ...edge, label } 
          : edge
      );
    } else {
      const newEdge = { source: sourceId, target: targetId, label };
      updatedEdges = [...graph.edges, newEdge];
    }
    
    const updatedGraph = { ...graph, edges: updatedEdges };
    setGraph(updatedGraph);
    setEdgeForm({ ...edgeForm, visible: false });
    
    const success = await saveGraphData(updatedGraph);
    showNotification(
      success ? "Connection created successfully" : "Failed to create connection",
      success ? "success" : "error"
    );
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
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
      </marker>
    </defs>
  );
  
  const getEdgePath = (source, target) => {
    if (source.id === "1" || target.id === "1") {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const nodeRadius = 32;
      
      const scale = (distance - nodeRadius) / distance;
      const endX = source.x + dx * scale;
      const endY = source.y + dy * scale;
      
      return `M${source.x},${source.y} L${endX},${endY}`;
    }
    
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    const offX = (midX - (source.x + target.x) / 2) * 0.2;
    const offY = (midY - (source.y + target.y) / 2) * 0.2;
    
    return `M${source.x},${source.y} Q${midX + offX},${midY + offY} ${target.x},${target.y}`;
  };
  
  const getLabelPosition = (source, target) => {
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    
    if (source.id === "1") {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const ratio = 0.4;
      
      return {
        x: source.x + dx * ratio,
        y: source.y + dy * ratio
      };
    }
    
    return { x: midX, y: midY };
  };
  
  const handleNodeHover = (node, event) => {
    if (node) {
      const svgRect = svgRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: node.x + 40,
        y: node.y - 40
      });
    }
    setHoveredNode(node);
  };
  
  const NodeTooltip = () => {
    if (!hoveredNode) return null;
    
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return null;
    
    const x = hoveredNode.x + svgRect.left + panOffset.x + 40;
    const y = hoveredNode.y + svgRect.top + panOffset.y - 40;
    
    return (
      <div 
        className="fixed bg-white p-2 rounded shadow-lg border border-gray-200 z-30"
        style={{ 
          left: `${x}px`,
          top: `${y}px`,
          width: "180px" 
        }}
      >
        <div className="font-bold text-sm mb-1">{hoveredNode.label}</div>
        <div className="text-xs text-gray-600 mb-1 capitalize">Type: {hoveredNode.type || "default"}</div>
        <div className="text-xs text-gray-700">{hoveredNode.description || "No description"}</div>
      </div>
    );
  };

  const handleMouseDown = (event) => {
    if (contextMenu.visible) {
      setContextMenu({ ...contextMenu, visible: false });
      return;
    }
    setIsDragging(true);
    setStartPan({ x: event.clientX - panOffset.x, y: event.clientY - panOffset.y });
  };

  const handleMouseMove = (event) => {
    if (!isDragging) return;
    setPanOffset({ x: event.clientX - startPan.x, y: event.clientY - startPan.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full h-full p-4 bg-gray-50 rounded-lg shadow-sm relative">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-700">Knowledge Graph</h3>
        <div className="flex space-x-4">
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
      
      <svg
        ref={svgRef}
        width="100%"
        height="600px"
        className="bg-white rounded-lg shadow-inner"
        onContextMenu={handleRightClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
        
        <g transform={`translate(${panOffset.x}, ${panOffset.y})`}>
        {graph.edges.map((edge, i) => {
          const source = graph.nodes.find((n) => n.id === edge.source);
          const target = graph.nodes.find((n) => n.id === edge.target);
          if (!source || !target) return null;
          
          const labelPos = getLabelPosition(source, target);
          const path = getEdgePath(source, target);
          
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
                x={labelPos.x - 40}
                y={labelPos.y - 10}
                width="80"
                height="20"
                rx="4"
                fill="white"
                fillOpacity="0.8"
              />
              <text
                x={labelPos.x}
                y={labelPos.y + 4}
                fontSize="12"
                fontWeight="500"
                fill="#555"
                textAnchor="middle"
                className="select-none"
              >
                {edge.label}
              </text>
            </g>
          );
        })}
        
        {graph.nodes.map((node) => {
          const isHovered = hoveredNode && hoveredNode.id === node.id;
          const strokeWidth = isHovered ? 4 : 3;
          const isYouNode = node.id === "1" || node.label === "You";
          
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
                r={isYouNode ? "32" : "28"}
                fill={typeBgColors[node.type] || typeBgColors.default}
                stroke={typeColors[node.type] || typeColors.default}
                strokeWidth={strokeWidth}
                filter={isHovered ? "drop-shadow(0px 0px 4px rgba(0,0,0,0.2))" : "none"}
                className={isHovered ? "brightness-110" : ""}
              />
              
              <text
                x={node.x}
                y={node.y + 5}
                fontSize={isYouNode ? "14" : "12"}
                fontWeight={isYouNode ? "bold" : "normal"}
                fill="white"
                textAnchor="middle"
                className="select-none pointer-events-none"
              >
                {node.label.length > 10 ? node.label.substring(0, 8) + "..." : node.label}
              </text>
              
              <text
                x={node.x + 24}
                y={node.y - 18}
                fontSize="12"
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
      
      {hoveredNode && <NodeTooltip />}
      
      {contextMenu.visible && (
        <div 
          className="context-menu absolute bg-white shadow-lg rounded-lg p-2 z-10 border border-gray-200"
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
          
          {contextMenu.type === 'node' && (
            <>
              <button 
                onClick={handleEditNode}
                className="flex items-center w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded text-gray-700"
              >
                <Edit size={16} className="mr-2" />
                Edit Node
              </button>
              {(selectedNode?.id !== "1" && selectedNode?.label !== "You") && (
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
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">{nodeForm.isNew ? "Add New Node" : "Edit Node"}</h3>
              <button onClick={() => setNodeForm({ ...nodeForm, visible: false })}>
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  type="text"
                  value={nodeForm.label}
                  onChange={(e) => setNodeForm({ ...nodeForm, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
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
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create Connection</h3>
              <button onClick={() => setEdgeForm({ ...edgeForm, visible: false })}>
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship Label</label>
                <input
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
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-30 flex items-center ${
            notification.type === 'success' ? 'bg-green-500' : 
            notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}
        >
          <span className="text-white">{notification.message}</span>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-500 flex items-center">
        <Info size={16} className="mr-2" />
        <div>
          <p>Hover over nodes to see details. Right-click on empty space to add a node.</p>
          <p>Right-click on nodes to edit, delete, or create connections.</p>
        </div>
      </div>
    </div>
  );
}
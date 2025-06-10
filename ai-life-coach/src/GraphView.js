import React, { useEffect, useRef, useState } from "react";
import { Info, Plus, Edit, Trash2, X, Save, ZoomIn, ZoomOut, Loader2, Sparkles, Target, Brain, User, ChevronLeft, ChevronRight } from "lucide-react";

const typeColors = {
  person: "#3b82f6", 
  trait: "#10b981",
  belief: "#f59e0b",
  goal: "#ef4444", 
  default: "#6b7280" 
};

const typeBgColors = {
  person: "rgba(59, 130, 246, 0.9)",
  trait: "rgba(16, 185, 129, 0.9)",
  belief: "rgba(245, 158, 11, 0.9)",
  goal: "rgba(239, 68, 68, 0.9)",
  default: "rgba(107, 114, 128, 0.9)"
};

const typeIcons = {
  person: "👤",
  trait: "✨",
  belief: "💭",
  goal: "🎯",
  default: "📌"
};

const TypeIcon = ({ type, size = 16 }) => {
  const iconMap = {
    person: User,
    trait: Sparkles,
    belief: Brain,
    goal: Target,
    default: Plus
  };
  const Icon = iconMap[type] || iconMap.default;
  return <Icon size={size} />;
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

export default function GraphView({ graphHistory, currentGraphIndex, onDataChange, onGraphIndexChange, darkMode }) {
  const [layoutNodes, setLayoutNodes] = useState([]);

  let data;
  if (Array.isArray(graphHistory)) {
    data = graphHistory[currentGraphIndex] || { nodes: [], edges: [] };
  } else if (graphHistory && typeof graphHistory === "object" && Array.isArray(graphHistory.nodes) && Array.isArray(graphHistory.edges)) {
    data = graphHistory;
  } else {
    data = { nodes: [], edges: [] };
  }

  const structuralEdges = data?.edges || [];
  const structuralNodes = data?.nodes || [];
  console.log("GraphView data:", data);

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
  const [zoomOrigin, setZoomOrigin] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef(null);
  const [sliderValue, setSliderValue] = useState(0);
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

  const handleWheel = (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const svgRect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - svgRect.left;
    const mouseY = event.clientY - svgRect.top;
    setZoomOrigin({ x: mouseX, y: mouseY });
    
    const delta = event.deltaY > 0 ? -zoomStep : zoomStep;
    setZoomLevel(prev => Math.max(minZoom, Math.min(maxZoom, prev + delta)));
  };

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const wheelHandler = (event) => {
        event.preventDefault();
        handleWheel(event);
    };

    svgElement.addEventListener('wheel', wheelHandler, { passive: false });
    
    return () => {
        svgElement.removeEventListener('wheel', wheelHandler);
    };
  }, [handleWheel]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleSliderMouseMove);
      document.addEventListener('mouseup', handleSliderMouseUp);
      document.addEventListener('touchmove', handleSliderTouchMove, { passive: false });
      document.addEventListener('touchend', handleSliderTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleSliderMouseMove);
      document.removeEventListener('mouseup', handleSliderMouseUp);
      document.removeEventListener('touchmove', handleSliderTouchMove);
      document.removeEventListener('touchend', handleSliderTouchEnd);
    };
  }, [isDragging]);

  const handleSliderMouseDown = (e) => {
    setIsDragging(true);
    updateValue(e);
  };

  const handleSliderMouseMove = (e) => {
    if (isDragging) {
      updateValue(e);
    }
  };

  const handleSliderMouseUp = () => {
    setIsDragging(false);
  };

  const handleSliderTouchStart = (e) => {
    if (isDragging) {
      updateValue(e);
    }
  };

  const handleSliderTouchMove = (e) => {
    if (isDragging) {
      e.preventDefault();
      updateValue(e.touches[0]);
    }
  };

  const handleSliderTouchEnd = () => {
    setIsDragging(false);
  };

  const updateValue = (event) => {
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
      setSliderValue(Math.round(percentage));
    }
  };

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

  const HistoryControls = () => (
    <div className={`flex items-center space-x-2 rounded-xl overflow-hidden shadow-lg backdrop-blur-sm border ${
      darkMode 
        ? "border-gray-700/50 bg-gray-800/80" 
        : "border-gray-200/50 bg-white/80"
    }`}>
      <button
        onClick={() => onGraphIndexChange(Math.max(0, currentGraphIndex - 1))}
        disabled={currentGraphIndex === 0}
        className={`p-3 transition-all duration-200 ${
          darkMode 
            ? "hover:bg-gray-700/80 text-gray-300 hover:text-orange-400" 
            : "hover:bg-gray-100/80 text-gray-600 hover:text-blue-600"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <ChevronLeft size={18} />
      </button>
      
      <div className={`px-4 py-2 text-sm font-medium ${
        darkMode ? "text-gray-300" : "text-gray-700"
      }`}>
        {currentGraphIndex + 1} / {graphHistory.length}
      </div>
      
      <button
        onClick={() => onGraphIndexChange(Math.min(graphHistory.length - 1, currentGraphIndex + 1))}
        disabled={currentGraphIndex === graphHistory.length - 1}
        className={`p-3 transition-all duration-200 ${
          darkMode 
            ? "hover:bg-gray-700/80 text-gray-300 hover:text-orange-400" 
            : "hover:bg-gray-100/80 text-gray-600 hover:text-blue-600"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );

  const TimelineSlider = () => (
    <div className="flex items-center space-x-4">
      <span className={`text-sm font-medium ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
        Timeline
      </span>
      <div className="flex-1 relative group">
        <input
          type="range"
          min={0}
          max={Math.max(0, graphHistory.length - 1)}
          value={currentGraphIndex}
          onChange={(e) => onGraphIndexChange(parseInt(e.target.value))}
          className={`
            w-full h-3 rounded-lg appearance-none cursor-pointer transition-all duration-200 ease-out
            ${darkMode 
              ? 'bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500' 
              : 'bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400'
            }
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
            hover:shadow-lg hover:scale-y-110 active:scale-y-125
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-6
            [&::-webkit-slider-thumb]:h-6
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-gradient-to-br
            [&::-webkit-slider-thumb]:from-blue-400
            [&::-webkit-slider-thumb]:to-blue-600
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:duration-150
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-webkit-slider-thumb]:hover:shadow-xl
            [&::-webkit-slider-thumb]:active:scale-125
            [&::-webkit-slider-thumb]:active:shadow-2xl
            [&::-moz-range-thumb]:w-6
            [&::-moz-range-thumb]:h-6
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-gradient-to-br
            [&::-moz-range-thumb]:from-blue-400
            [&::-moz-range-thumb]:to-blue-600
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-white
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:transition-all
            [&::-moz-range-thumb]:duration-150
          `}
          style={{
            background: `linear-gradient(to right, 
              ${darkMode ? '#3b82f6' : '#60a5fa'} 0%, 
              ${darkMode ? '#3b82f6' : '#60a5fa'} ${(currentGraphIndex / Math.max(1, graphHistory.length - 1)) * 100}%, 
              ${darkMode ? '#374151' : '#d1d5db'} ${(currentGraphIndex / Math.max(1, graphHistory.length - 1)) * 100}%, 
              ${darkMode ? '#374151' : '#d1d5db'} 100%)`
          }}
        />
        
        <div className="flex justify-between absolute top-0 left-0 right-0 pointer-events-none">
          {Array.from({ length: Math.min(graphHistory.length, 10) }, (_, i) => {
            const dotIndex = Math.floor((i / Math.max(1, 9)) * Math.max(0, graphHistory.length - 1));
            const isActive = dotIndex <= currentGraphIndex;
            return (
              <div
                key={i}
                className={`w-1 h-1 rounded-full transition-all duration-300 ${
                  isActive 
                    ? 'bg-blue-400 shadow-sm' 
                    : darkMode ? 'bg-gray-600' : 'bg-gray-400'
                }`}
              />
            );
          })}
        </div>
        
        <div className="flex justify-between text-xs mt-2 transition-opacity duration-200 group-hover:opacity-100 opacity-75">
          <span className={`font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            Start
          </span>
          <span className={`font-medium ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
            {currentGraphIndex + 1} / {graphHistory.length}
          </span>
          <span className={`font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            Current
          </span>
        </div>
      </div>
    </div>
  );

  const handleDataChange = async (newData) => {
    const newHistory = [
        ...graphHistory.slice(0, currentGraphIndex + 1),
        newData
    ];
    
    const success = await onDataChange(newHistory, newHistory.length - 1);
    return success;
  };


  const handleZoomIn = (event) => {
    if (event) {
        const svgRect = svgRef.current.getBoundingClientRect();
        const mouseX = event.clientX - svgRect.left;
        const mouseY = event.clientY - svgRect.top;
        setZoomOrigin({ x: mouseX, y: mouseY });
    }
    setZoomLevel(prev => Math.min(maxZoom, prev + zoomStep));
  };

const handleZoomOut = (event) => {
    if (event) {
        const svgRect = svgRef.current.getBoundingClientRect();
        const mouseX = event.clientX - svgRect.left;
        const mouseY = event.clientY - svgRect.top;
        setZoomOrigin({ x: mouseX, y: mouseY });
    }
    setZoomLevel(prev => Math.max(minZoom, prev - zoomStep));
  };

  const handleRightClick = (event) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX-20,
      y: event.clientY-30,
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
      x: tooltipPosition.x,
      y: tooltipPosition.y,
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

   const getNodeLayoutPosition = (nodeId) => {
       return layoutNodes.find(n => n.id === nodeId);
   };

   const getEdgePath = (sourceId, targetId) => {
    const source = getNodeLayoutPosition(sourceId);
    const target = getNodeLayoutPosition(targetId);
    if (!source || !target) return "";
    
    const isSourceYou = source.id === "1" || source.label.toLowerCase() === "you";
    const isTargetYou = target.id === "1" || target.label.toLowerCase() === "you";
    const sourceRadius = (isSourceYou ? 32 : 28) / Math.sqrt(zoomLevel);
    const targetRadius = (isTargetYou ? 32 : 28) / Math.sqrt(zoomLevel);
    
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return "";
    
    const unitX = dx / distance;
    const unitY = dy / distance;
    
    const startX = source.x + unitX * sourceRadius;
    const startY = source.y + unitY * sourceRadius;
    const endX = target.x - unitX * targetRadius;
    const endY = target.y - unitY * targetRadius;
    
    return `M${startX},${startY} L${endX},${endY}`;
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

        const transformedX = (layoutNode.x * zoomLevel) + panOffset.x + zoomOrigin.x * (1 - zoomLevel);
        const transformedY = (layoutNode.y * zoomLevel) + panOffset.y + zoomOrigin.y * (1 - zoomLevel);
        
        const nodeScreenX = transformedX + svgRect.left;
        const nodeScreenY = transformedY + svgRect.top;

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
        className="fixed backdrop-blur-md bg-white/90 dark:bg-gray-900/90 p-4 rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 z-30 pointer-events-none transition-all duration-200"
        style={{
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`,
          width: "220px",
           transform: `translate(${tooltipPosition.x + 220 > window.innerWidth ? '-100%' : '0%'}, ${tooltipPosition.y + 120 > window.innerHeight ? '-100%' : '0%'})` 
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: typeColors[hoveredNode.type] || typeColors.default }}
          />
          <div className="font-semibold text-gray-900 dark:text-gray-100 break-words">{hoveredNode.label}</div>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mb-2 capitalize">
          <TypeIcon type={hoveredNode.type} size={12} />
          {hoveredNode.type || "default"}
        </div>
        {hoveredNode.description && (
            <div className="text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed">{hoveredNode.description}</div>
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
    <div className={`w-full h-full p-6 rounded-2xl shadow-2xl relative overflow-y-auto backdrop-blur-sm border transition-all duration-300 ${
      darkMode 
        ? "bg-gradient-to-br from-gray-900/95 to-gray-800/95 border-gray-700/50" 
        : "bg-gradient-to-br from-white/95 to-gray-50/95 border-gray-200/50"
    }`}>
      <div className="mb-6 flex justify-between items-center">        
        <div className="flex items-center space-x-6">

          <div className={`flex items-center rounded-xl overflow-hidden shadow-lg backdrop-blur-sm border transition-all duration-200 ${
            darkMode 
              ? "border-gray-700/50 bg-gray-800/80" 
              : "border-gray-200/50 bg-white/80"
          }`}>
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= minZoom}
              className={`p-3 border-r transition-all duration-200 ${
                darkMode 
                  ? "border-gray-700/50 hover:bg-gray-700/80 text-gray-300 hover:text-orange-400" 
                  : "border-gray-200/50 hover:bg-gray-100/80 text-gray-600 hover:text-blue-600"
              } disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95`}
            >
              <ZoomOut size={18} />
            </button>
            <div className={`px-4 py-3 font-mono text-sm font-medium ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}>
              {`${Math.round(zoomLevel * 100)}%`}
            </div>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= maxZoom}
              className={`p-3 border-l transition-all duration-200 ${
                darkMode 
                  ? "border-gray-700/50 hover:bg-gray-700/80 text-gray-300 hover:text-orange-400" 
                  : "border-gray-200/50 hover:bg-gray-100/80 text-gray-600 hover:text-blue-600"
              } disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95`}
            >
              <ZoomIn size={18} />
            </button>
          </div>

          {graphHistory.length > 1 && <HistoryControls />}
  
          <div className="flex items-center space-x-4">
            {Object.entries(typeColors).map(([type, color]) => (
              <div key={type} className="flex items-center group">
                <div
                  className="w-4 h-4 rounded-full mr-2 shadow-md border-2 border-white/20 transition-transform duration-200 group-hover:scale-110"
                  style={{ 
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}40`
                  }}
                />
                <span className={`text-sm font-medium capitalize transition-colors duration-200 ${
                  darkMode 
                    ? "text-gray-400 group-hover:text-gray-300" 
                    : "text-gray-600 group-hover:text-gray-700"
                }`}>
                  {type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
  
      <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ height: 'calc(100% - 160px)' }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className={`cursor-grab active:cursor-grabbing transition-all duration-300 ${
            darkMode 
              ? "bg-gradient-to-br from-gray-900 to-gray-800" 
              : "bg-gradient-to-br from-white to-gray-50"
          }`}
          onContextMenu={handleRightClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          style={{ touchAction: 'none' }}
        >
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke={darkMode ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)"}
                strokeWidth="1"
              />
              <circle
                cx="0"
                cy="0"
                r="0.5"
                fill={darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}
              />
            </pattern>
            
            <marker
              id="arrowhead"
              markerWidth="12"
              markerHeight="8"
              refX="11"
              refY="4"
              orient="auto"
            >
              <polygon
                points="0 0, 12 4, 0 8"
                fill={darkMode ? "#94a3b8" : "#64748b"}
                className="drop-shadow-sm"
              />
            </marker>
            
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            <filter id="nodeGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <rect width="100%" height="100%" fill="url(#grid)" />
  
          <g transform={`translate(${panOffset.x + zoomOrigin.x * (1 - zoomLevel)}, ${panOffset.y + zoomOrigin.y * (1 - zoomLevel)}) scale(${zoomLevel})`}>
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
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth="2.5"
                    fill="none"
                    transform="translate(1, 1)"
                  />
                  
                  <path
                    d={path}
                    stroke={darkMode ? "#94a3b8" : "#64748b"}
                    strokeWidth="2"
                    fill="none"
                    strokeOpacity="0.8"
                    markerEnd="url(#arrowhead)"
                    className="transition-all duration-300 hover:stroke-opacity-100"
                    style={{
                      filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.1))"
                    }}
                  />
                  
                  <rect
                    x={labelPos.x - 50 / zoomLevel}
                    y={labelPos.y - 12 / zoomLevel}
                    width={100 / zoomLevel}
                    height={24 / zoomLevel}
                    rx={12 / zoomLevel}
                    fill={darkMode ? "rgba(55, 65, 81, 0.95)" : "rgba(255, 255, 255, 0.95)"}
                    stroke={darkMode ? "rgba(156, 163, 175, 0.3)" : "rgba(209, 213, 219, 0.5)"}
                    strokeWidth={1 / zoomLevel}
                    className="transition-all duration-200"
                    style={{
                      filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.1))"
                    }}
                  />
                  
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 4 / zoomLevel}
                    fontSize={11 / zoomLevel}
                    fontWeight="600"
                    fill={darkMode ? "#e5e7eb" : "#374151"}
                    textAnchor="middle"
                    className="select-none pointer-events-none transition-all duration-200"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}
  
            {layoutNodes.map((node) => {
              const isHovered = hoveredNode && hoveredNode.id === node.id;
              const isYouNode = node.id === "1" || node.label.toLowerCase() === "you";
  
              const nodeRadius = (isYouNode ? 36 : 32) / Math.sqrt(zoomLevel);
              const strokeWidth = (isHovered ? 3 : 2) / zoomLevel;
  
              if (node.x == null || node.y == null || isNaN(node.x) || isNaN(node.y)) return null;
  
              return (
                <g
                  key={node.id}
                  onMouseEnter={(e) => handleNodeHover(node, e)}
                  onMouseLeave={() => handleNodeHover(null)}
                  onClick={() => handleNodeClick(node)}
                  onContextMenu={(e) => handleNodeRightClick(e, node)}
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                    transformOrigin: `${node.x}px ${node.y}px`
                  }}
                >
                  <circle
                    cx={node.x + 2}
                    cy={node.y + 2}
                    r={nodeRadius}
                    fill="rgba(0,0,0,0.15)"
                    className="transition-all duration-200"
                  />
                  
                  {isHovered && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={nodeRadius + 8}
                      fill={typeColors[node.type] || typeColors.default}
                      fillOpacity="0.2"
                      className="animate-pulse"
                    />
                  )}
                  
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeRadius}
                    fill={`url(#gradient-${node.type})`}
                    stroke={typeColors[node.type] || typeColors.default}
                    strokeWidth={strokeWidth}
                    filter={isHovered ? "url(#nodeGlow)" : "none"}
                    className="transition-all duration-200"
                  />
                  
                  <circle
                    cx={node.x - nodeRadius * 0.3}
                    cy={node.y - nodeRadius * 0.3}
                    r={nodeRadius * 0.3}
                    fill="rgba(255,255,255,0.2)"
                    className="pointer-events-none"
                  />
  
                  <text
                    x={node.x}
                    y={node.y + (isYouNode ? 5 : 4) / zoomLevel}
                    fontSize={(isYouNode ? 14 : 12) / zoomLevel}
                    fontWeight={isYouNode ? "bold" : "600"}
                    fill="white"
                    textAnchor="middle"
                    className="select-none pointer-events-none transition-all duration-200"
                    dominantBaseline="middle"
                    style={{
                      textShadow: "0px 1px 2px rgba(0,0,0,0.5)"
                    }}
                  >
                    {node.label.length > (isYouNode ? 8 : 10) * zoomLevel ? 
                      node.label.substring(0, Math.floor((isYouNode ? 8 : 10) * zoomLevel)) + "..." : 
                      node.label
                    }
                  </text>
  
                  <text
                    x={node.x + (isYouNode ? 26 : 22) / zoomLevel} 
                    y={node.y - (isYouNode ? 20 : 18) / zoomLevel} 
                    fontSize={14 / zoomLevel}
                    fill={typeColors[node.type]}
                    className="select-none pointer-events-none transition-all duration-200"
                    style={{
                      filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.3))"
                    }}
                  >
                    {typeIcons[node.type] || typeIcons.default}
                  </text>
                </g>
              );
            })}
          </g>
          
          <defs>
            {Object.entries(typeColors).map(([type, color]) => (
              <linearGradient key={type} id={`gradient-${type}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="1" />
                <stop offset="100%" stopColor={color} stopOpacity="0.7" />
              </linearGradient>
            ))}
          </defs>
        </svg>
      </div>
  
      <NodeTooltip />
  
      {contextMenu.visible && (
        <div
          className={`context-menu absolute shadow-2xl rounded-xl p-2 z-40 border backdrop-blur-sm transition-all duration-200 ${
            darkMode 
              ? "bg-gray-800/95 border-gray-700/50" 
              : "bg-white/95 border-gray-200/50"
          }`}
          style={{ 
            left: `${contextMenu.x}px`, 
            top: `${contextMenu.y}px`,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {contextMenu.type === 'canvas' && (
            <button
              onClick={handleAddNode}
              className={`flex items-center w-full text-left px-4 py-3 text-sm rounded-lg transition-all duration-200 ${
                darkMode 
                  ? "text-gray-300 hover:bg-gray-700/80 hover:text-orange-400" 
                  : "text-gray-700 hover:bg-blue-50/80 hover:text-blue-600"
              }`}
            >
              <Plus size={16} className="mr-3" />
              Add Node
            </button>
          )}
  
          {contextMenu.type === 'node' && selectedNode && (
            <>
              <button
                onClick={handleEditNode}
                className={`flex items-center w-full text-left px-4 py-3 text-sm rounded-lg transition-all duration-200 ${
                  darkMode 
                    ? "text-gray-300 hover:bg-gray-700/80 hover:text-orange-400" 
                    : "text-gray-700 hover:bg-blue-50/80 hover:text-blue-600"
                }`}
              >
                <Edit size={16} className="mr-3" />
                Edit Node
              </button>
              {(selectedNode.id !== "1" && selectedNode.label.toLowerCase() !== "you") && (
                <button
                  onClick={handleDeleteNode}
                  className={`flex items-center w-full text-left px-4 py-3 text-sm rounded-lg transition-all duration-200 ${
                    darkMode 
                      ? "text-red-400 hover:bg-red-900/30" 
                      : "text-red-600 hover:bg-red-50/80"
                  }`}
                >
                  <Trash2 size={16} className="mr-3" />
                  Delete Node
                </button>
              )}
              <button
                onClick={handleStartEdge}
                className={`flex items-center w-full text-left px-4 py-3 text-sm rounded-lg transition-all duration-200 ${
                  darkMode 
                    ? "text-gray-300 hover:bg-gray-700/80 hover:text-orange-400" 
                    : "text-gray-700 hover:bg-blue-50/80 hover:text-blue-600"
                }`}
              >
                <Plus size={16} className="mr-3" />
                Create Connection
              </button>
            </>
          )}
        </div>
      )}
  
      {nodeForm.visible && (
        <div className="node-form-modal fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
          <div className={`rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all duration-300 scale-100 ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-xl font-bold ${darkMode ? "text-gray-200" : "text-gray-800"}`}>
                {nodeForm.isNew ? "Add New Node" : "Edit Node"}
              </h3>
              <button 
                onClick={() => setNodeForm({ ...nodeForm, visible: false })} 
                className={`p-2 rounded-lg transition-all duration-200 ${
                  darkMode 
                    ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700" 
                    : "text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <X size={20} />
              </button>
            </div>
  
            <div className="space-y-6">
              <div>
                <label htmlFor="node-label" className={`block text-sm font-semibold mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Label
                </label>
                <input
                  id="node-label"
                  type="text"
                  value={nodeForm.label}
                  onChange={(e) => setNodeForm({ ...nodeForm, label: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 transition-all duration-200 ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
              </div>
  
              <div>
                <label htmlFor="node-type" className={`block text-sm font-semibold mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Type
                </label>
                <select
                  id="node-type"
                  value={nodeForm.type}
                  onChange={(e) => setNodeForm({ ...nodeForm, type: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 transition-all duration-200 ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                >
                  <option value="person">Person</option>
                  <option value="trait">Trait</option>
                  <option value="belief">Belief</option>
                  <option value="goal">Goal</option>
                  <option value="default">Other</option>
                </select>
              </div>
  
              <div>
                <label htmlFor="node-description" className={`block text-sm font-semibold mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Description
                </label>
                <textarea
                  id="node-description"
                  value={nodeForm.description}
                  onChange={(e) => setNodeForm({ ...nodeForm, description: e.target.value })}
                  rows="4"
                  className={`w-full px-4 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 transition-all duration-200 resize-none ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
              </div>
  
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  onClick={() => setNodeForm({ ...nodeForm, visible: false })}
                  className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                    darkMode 
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-105" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={saveNodeForm}
                  className={`px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 hover:scale-105 ${
                    darkMode 
                      ? "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700" 
                      : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  
      {edgeForm.visible && (
        <div className="edge-form-modal fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
          <div className={`rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all duration-300 scale-100 ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-xl font-bold ${darkMode ? "text-gray-200" : "text-gray-800"}`}>
                Create Connection
              </h3>
              <button 
                onClick={() => setEdgeForm({ ...edgeForm, visible: false })} 
                className={`p-2 rounded-lg transition-all duration-200 ${
                  darkMode 
                    ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700" 
                    : "text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <X size={20} />
              </button>
            </div>
  
            <div className="space-y-6">
              <div>
                <label htmlFor="edge-label" className={`block text-sm font-semibold mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Relationship Label
                </label>
                <input
                  id="edge-label"
                  type="text"
                  value={edgeForm.label}
                  onChange={(e) => setEdgeForm({ ...edgeForm, label: e.target.value })}
                  placeholder="e.g., is friends with, believes in, aspires to"
                  className={`w-full px-4 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 transition-all duration-200 ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  }`}
                />
              </div>
  
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  onClick={() => setEdgeForm({ ...edgeForm, visible: false })}
                  className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                    darkMode 
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-105" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdgeForm} 
                  className={`px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 hover:scale-105 ${
                    darkMode 
                      ? "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700" 
                      : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  }`}
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
          className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center backdrop-blur-sm border transition-all duration-300 transform ${
            notification.type === 'success' ? 
              (darkMode ? 'bg-green-600/90 border-green-500/50' : 'bg-green-500/90 border-green-400/50') :
            notification.type === 'error' ? 
              (darkMode ? 'bg-red-600/90 border-red-500/50' : 'bg-red-500/90 border-red-400/50') : 
              (darkMode ? 'bg-blue-600/90 border-blue-500/50' : 'bg-blue-500/90 border-blue-400/50')
          }`}
          style={{
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <span className="text-white font-medium">{notification.message}</span>
        </div>
      )}

      {graphHistory.length > 3 && (
          <div className="w-64">
            <TimelineSlider />
          </div>
        )}

      <div className={`mt-6 p-4 rounded-xl border transition-all duration-200 ${
        darkMode 
          ? "bg-gray-800/50 border-gray-700/50 text-gray-400" 
          : "bg-gray-50/50 border-gray-200/50 text-gray-600"
      }`}>
        <div className="flex items-start space-x-3">
          <Info size={18} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="mb-1">
              <strong>Hover</strong> over nodes to see details • <strong>Right-click</strong> empty space to add nodes
            </p>
            <p>
              <strong>Right-click</strong> nodes to edit, delete, or create connections • <strong>Click and drag</strong> to pan around
            </p>
          </div>
        </div>
      </div>
  
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
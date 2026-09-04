import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Maximize2, Minimize2, ZoomIn, ZoomOut,
  ChevronsDownUp, ChevronsUpDown, GitBranch, RotateCcw,
  MoreVertical, Check, ChevronDown
} from 'lucide-react';
import './PrerequisiteTree.css';

// ─── Tree Data (from CSE Undergraduate Prerequisites flow) ───
const TREE = {
  id: 'Root', code: '', name: 'CSE Undergraduate Prerequisites', type: 'root', children: [
    {
      id: 'Math', code: '', name: 'Mathematics Sequence', type: 'category', children: [
        {
          id: 'MATH1115', code: 'MATH1115', name: 'Math-I', type: 'core', children: [
            {
              id: 'MATH1219', code: 'MATH1219', name: 'Math-II', type: 'core', children: [
                {
                  id: 'MATH2101', code: 'MATH2101', name: 'Math-III', type: 'core', children: [
                    {
                      id: 'CSE3101', code: 'CSE3101', name: 'Math Analysis for CS', type: 'core', children: [
                        { id: 'CSE3207_M', code: 'CSE3207', name: 'Artificial Intelligence', type: 'elective' },
                        { id: 'CSE4137', code: 'CSE4137', name: 'Soft Computing', type: 'elective' },
                        { id: 'CSE4175_M', code: 'CSE4175', name: 'Natural Language Processing', type: 'elective' },
                        { id: 'CSE4223', code: 'CSE4223', name: 'Computational Complexity', type: 'elective' },
                        { id: 'CSE4265_M', code: 'CSE4265', name: 'Bioinformatics', type: 'elective' },
                      ],
                    },
                    { id: 'CSE4211', code: 'CSE4211', name: 'Simulation of Products', type: 'elective' },
                  ],
                },
              ],
            },
            {
              id: 'MATH2203', code: 'MATH2203', name: 'Math-IV', type: 'core', children: [
                { id: 'CSE4113_M', code: 'CSE4113', name: 'Pattern Recognition', type: 'elective' },
                { id: 'CSE4203', code: 'CSE4203', name: 'Computer Graphics', type: 'elective' },
                { id: 'CSE4209', code: 'CSE4209', name: 'Computer Vision', type: 'elective' },
                { id: 'CSE4219', code: 'CSE4219', name: 'Computational Geometry', type: 'elective' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'Prog', code: '', name: 'Programming & Software', type: 'category', children: [
        {
          id: 'CSE1101', code: 'CSE1101', name: 'Structured Programming', type: 'core', children: [
            { id: 'CSE1205', code: 'CSE1205', name: 'Object Oriented Programming', type: 'core' },
            {
              id: 'CSE2103', code: 'CSE2103', name: 'Data Structures', type: 'core', children: [
                {
                  id: 'CSE2207', code: 'CSE2207', name: 'Algorithms', type: 'core', children: [
                    { id: 'CSE3207_P', code: 'CSE3207', name: 'Artificial Intelligence', type: 'elective' },
                    { id: 'CSE4283_P', code: 'CSE4283', name: 'Advanced Algorithms', type: 'elective' },
                    { id: 'CSE4285_P', code: 'CSE4285', name: 'High Performance Computing', type: 'elective' },
                  ],
                },
                { id: 'CSE4283_D', code: 'CSE4283', name: 'Advanced Algorithms', type: 'elective' },
              ],
            },
          ],
        },
        {
          id: 'CSE3103', code: 'CSE3103', name: 'Database', type: 'core', children: [
            { id: 'CSE3223', code: 'CSE3223', name: 'Information System Design', type: 'elective' },
            { id: 'CSE4131', code: 'CSE4131', name: 'Multimedia Computing', type: 'elective' },
            { id: 'CSE4139', code: 'CSE4139', name: 'Advanced Database', type: 'elective' },
            { id: 'CSE4141', code: 'CSE4141', name: 'Data Warehousing', type: 'elective' },
            { id: 'CSE4261', code: 'CSE4261', name: 'Data Analytics', type: 'elective' },
          ],
        },
      ],
    },
    {
      id: 'Theory', code: '', name: 'Theory & Intelligence', type: 'category', children: [
        {
          id: 'CSE1203', code: 'CSE1203', name: 'Discrete Mathematics', type: 'core', children: [
            { id: 'CSE3101_T', code: 'CSE3101', name: 'Math Analysis for CS', type: 'core' },
            { id: 'CSE3103_T', code: 'CSE3103', name: 'Database', type: 'core' },
            { id: 'CSE3207_T', code: 'CSE3207', name: 'Artificial Intelligence', type: 'core' },
            { id: 'CSE4129', code: 'CSE4129', name: 'Formal Languages & Compilers', type: 'elective' },
            { id: 'CSE4175_T', code: 'CSE4175', name: 'Natural Language Processing', type: 'elective' },
            { id: 'CSE4221', code: 'CSE4221', name: 'Graph Theory', type: 'elective' },
          ],
        },
        {
          id: 'CSE3207_AI', code: 'CSE3207', name: 'Artificial Intelligence', type: 'core', children: [
            { id: 'CSE4113_AI', code: 'CSE4113', name: 'Machine Learning', type: 'elective' },
            { id: 'CSE4143', code: 'CSE4143', name: 'Expert Systems', type: 'elective' },
            { id: 'CSE4147', code: 'CSE4147', name: 'Neural Networks', type: 'elective' },
            { id: 'CSE4265_AI', code: 'CSE4265', name: 'Bioinformatics', type: 'elective' },
            { id: 'CSE4267', code: 'CSE4267', name: 'Cloud Computing', type: 'elective' },
          ],
        },
      ],
    },
    {
      id: 'Hardware', code: '', name: 'Hardware & Architecture', type: 'category', children: [
        {
          id: 'EEE1241', code: 'EEE1241', name: 'Basic Electrical Engineering', type: 'core', children: [
            { id: 'EEE2141', code: 'EEE2141', name: 'Electronic Devices & Circuits', type: 'core' },
          ],
        },
        {
          id: 'CSE2105', code: 'CSE2105', name: 'Digital Logic Design', type: 'core', children: [
            { id: 'CSE3109_H', code: 'CSE3109', name: 'Digital System Design', type: 'core' },
            { id: 'CSE3117_H', code: 'CSE3117', name: 'Microprocessors & Microcontrollers', type: 'core' },
          ],
        },
        {
          id: 'CSE2213', code: 'CSE2213', name: 'Computer Architecture', type: 'core', children: [
            { id: 'CSE3109_A', code: 'CSE3109', name: 'Digital System Design', type: 'core' },
            { id: 'CSE3117_A', code: 'CSE3117', name: 'Microprocessors & Microcontrollers', type: 'core' },
            { id: 'CSE4215', code: 'CSE4215', name: 'Advanced Computer Architecture', type: 'elective' },
            { id: 'CSE4245', code: 'CSE4245', name: 'Parallel Processing', type: 'elective' },
            { id: 'CSE4285_A', code: 'CSE4285', name: 'High Performance Computing', type: 'elective' },
          ],
        },
      ],
    },
    {
      id: 'Comm', code: '', name: 'Communications & Networks', type: 'category', children: [
        {
          id: 'CSE2211', code: 'CSE2211', name: 'Data Communication', type: 'core', children: [
            {
              id: 'CSE3201', code: 'CSE3201', name: 'Computer Networks', type: 'core', children: [
                { id: 'CSE4173', code: 'CSE4173', name: 'Cyber Security', type: 'elective' },
                { id: 'CSE4181', code: 'CSE4181', name: 'Web Computing', type: 'elective' },
                { id: 'CSE4235', code: 'CSE4235', name: 'Wireless Networks', type: 'elective' },
                { id: 'CSE4255', code: 'CSE4255', name: 'Telecommunication', type: 'elective' },
              ],
            },
            { id: 'CSE4173_C', code: 'CSE4173', name: 'Cyber Security', type: 'elective' },
            { id: 'CSE4235_C', code: 'CSE4235', name: 'Wireless Networks', type: 'elective' },
            { id: 'CSE4255_C', code: 'CSE4255', name: 'Telecommunication', type: 'elective' },
            { id: 'CSE4263', code: 'CSE4263', name: 'Internet of Things', type: 'elective' },
          ],
        },
      ],
    },
  ],
};

// ─── Static maps built once ───
const parentMap = {};   // id -> parent id
const nodeMap = {};     // id -> node
const parentIds = [];   // ids of all nodes that have children
(function index(node, parent) {
  nodeMap[node.id] = node;
  if (parent) parentMap[node.id] = parent.id;
  if (node.children?.length) {
    parentIds.push(node.id);
    node.children.forEach((c) => index(c, node));
  }
})(TREE, null);

const totalCourses = Object.values(nodeMap).filter((n) => n.code).length;

// ─── Neon accent per node type (resolved from the active theme in CSS) ───
const NEON_VAR = {
  root: 'var(--pt-root)',
  category: 'var(--pt-category)',
  core: 'var(--pt-core)',
  elective: 'var(--pt-elective)',
};

const ROW_H = 52;
const NODE_H = 34;
const COL_GAP = 90;
const PAD = 40;
const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

// ─── Estimate node pixel width from its label ───
function nodeWidth(node) {
  const text = node.code ? `${node.code}  ${node.name}` : node.name;
  const badge = node.children?.length ? 26 : 0;
  return Math.round(text.length * 6.6 + 30 + badge);
}

// ─── Layout the visible portion of the tree (left → right) ───
function computeLayout(expandedSet) {
  const visible = [];
  (function collect(node, depth) {
    visible.push({ node, depth });
    if (expandedSet.has(node.id) && node.children) {
      node.children.forEach((c) => collect(c, depth + 1));
    }
  })(TREE, 0);

  // column x positions (per-depth max width)
  const colWidths = [];
  visible.forEach(({ node, depth }) => {
    colWidths[depth] = Math.max(colWidths[depth] || 0, nodeWidth(node));
  });
  const colX = [];
  let acc = PAD;
  colWidths.forEach((w, i) => {
    colX[i] = acc;
    acc += w + COL_GAP;
  });

  // rows needed for each visible subtree
  const rowsOf = (node) => {
    if (!expandedSet.has(node.id) || !node.children?.length) return 1;
    return node.children.reduce((s, c) => s + rowsOf(c), 0);
  };

  const nodes = [];
  const edges = [];
  (function place(node, depth, topRow) {
    const rows = rowsOf(node);
    const x = colX[depth];
    const y = (topRow + rows / 2) * ROW_H + PAD;
    const w = nodeWidth(node);
    nodes.push({ node, x, y, w, depth });
    if (expandedSet.has(node.id) && node.children) {
      let r = topRow;
      node.children.forEach((child) => {
        const cr = rowsOf(child);
        edges.push({
          id: `${node.id}->${child.id}`,
          x1: x + w,
          y1: y,
          x2: colX[depth + 1],
          y2: (r + cr / 2) * ROW_H + PAD,
          type: child.type,
        });
        place(child, depth + 1, r);
        r += cr;
      });
    }
  })(TREE, 0, 0);

  const width = acc - COL_GAP + PAD;
  const height = rowsOf(TREE) * ROW_H + PAD * 2;
  return { nodes, edges, width, height };
}

// ─── Ancestor ids of a node (for search auto-expand) ───
function ancestorsOf(id) {
  const out = [];
  let cur = parentMap[id];
  while (cur) {
    out.push(cur);
    cur = parentMap[cur];
  }
  return out;
}

const DEPARTMENTS = [
  { id: 'CSE', label: 'CSE', available: true },
  { id: 'EEE', label: 'EEE', available: false },
  { id: 'CE',  label: 'CE',  available: false },
  { id: 'ME',  label: 'ME',  available: false },
  { id: 'IPE', label: 'IPE', available: false },
  { id: 'TE',  label: 'TE',  available: false },
  { id: 'ARCH',label: 'ARCH',available: false },
  { id: 'BBA', label: 'BBA', available: false },
];

export default function PrerequisiteTree() {
  const [dept, setDept] = useState('CSE');
  const [expanded, setExpanded] = useState(() => new Set(['Root']));
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef(null);
  // single transform state so zoom + pan update atomically (cursor-anchored zoom)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const zoomTimerRef = useRef(null);
  const [nodeOffsets, setNodeOffsets] = useState(() => new Map());
  const dragRef = useRef(null);

  const { scale, x: panX, y: panY } = view;

  // ─── Search: matched ids + auto-expanded ancestors ───
  const term = search.trim().toLowerCase();
  const matchedIds = useMemo(() => {
    if (!term) return new Set();
    const ids = new Set();
    Object.values(nodeMap).forEach((n) => {
      if (`${n.code} ${n.name}`.toLowerCase().includes(term)) ids.add(n.id);
    });
    return ids;
  }, [term]);

  const effectiveExpanded = useMemo(() => {
    if (!term) return expanded;
    const set = new Set(expanded);
    matchedIds.forEach((id) => ancestorsOf(id).forEach((a) => set.add(a)));
    return set;
  }, [expanded, matchedIds, term]);

  const { nodes, edges, width, height } = useMemo(
    () => computeLayout(effectiveExpanded),
    [effectiveExpanded]
  );

  const visibleCourses = nodes.filter((n) => n.node.code).length;

  // ─── Apply user offsets to nodes and edges (dragging) ───
  const offsetNodes = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      x: n.x + (nodeOffsets.get(n.node.id)?.dx || 0),
      y: n.y + (nodeOffsets.get(n.node.id)?.dy || 0),
    }));
  }, [nodes, nodeOffsets]);

  const offsetEdges = useMemo(() => {
    return edges.map(e => {
      const [parentId, childId] = e.id.split('->');
      const pOff = nodeOffsets.get(parentId) || { dx: 0, dy: 0 };
      const cOff = nodeOffsets.get(childId) || { dx: 0, dy: 0 };
      return {
        ...e,
        x1: e.x1 + pOff.dx,
        y1: e.y1 + pOff.dy,
        x2: e.x2 + cOff.dx,
        y2: e.y2 + cOff.dy,
      };
    });
  }, [edges, nodeOffsets]);

  // ─── Expand / collapse ───
  const toggleNode = useCallback((node) => {
    if (node.children?.length) {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    }
    if (node.code) {
      setSelected((prev) => (prev?.id === node.id ? null : node));
    }
  }, []);

  const expandAll = useCallback(() => setExpanded(new Set(parentIds)), []);
  const collapseAll = useCallback(() => {
    setExpanded(new Set(['Root']));
    setSelected(null);
  }, []);

  // ─── Zoom (anchored: keeps a focal point fixed while scaling) ───
  const flashZoom = useCallback(() => {
    setIsZooming(true);
    clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setIsZooming(false), 260);
  }, []);

  // Zoom toward a point in viewport coordinates (px, py)
  const zoomAt = useCallback((delta, px, py) => {
    setView((prev) => {
      const next = Math.min(Math.max(prev.scale + delta, MIN_ZOOM), MAX_ZOOM);
      if (next === prev.scale) return prev;
      const ratio = next / prev.scale;
      // keep the content point under (px, py) stationary
      const nv = {
        scale: next,
        x: px - (px - prev.x) * ratio,
        y: py - (py - prev.y) * ratio,
      };
      panOffsetRef.current = { x: nv.x, y: nv.y };
      return nv;
    });
    flashZoom();
  }, [flashZoom]);

  // Button zoom → anchor at viewport center
  const zoomFromCenter = useCallback((delta) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    zoomAt(delta, (rect?.width || 0) / 2, (rect?.height || 0) / 2);
  }, [zoomAt]);

  const zoomIn = useCallback(() => zoomFromCenter(ZOOM_STEP), [zoomFromCenter]);
  const zoomOut = useCallback(() => zoomFromCenter(-ZOOM_STEP), [zoomFromCenter]);

  const resetZoom = useCallback(() => {
    setView({ scale: 1, x: 0, y: 0 });
    panOffsetRef.current = { x: 0, y: 0 };
    flashZoom();
  }, [flashZoom]);

  // Wheel zoom → anchor at cursor position (plain scroll, no modifier needed)
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = wrapperRef.current?.getBoundingClientRect();
    const px = e.clientX - (rect?.left || 0);
    const py = e.clientY - (rect?.top || 0);
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    zoomAt(delta, px, py);
  }, [zoomAt]);

  // React attaches wheel as passive — bind manually so preventDefault works
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => () => clearTimeout(zoomTimerRef.current), []);

  // ─── Touch gestures: pinch-to-zoom + one-finger pan ───
  const touchRef = useRef({ dist: 0, panning: false, startX: 0, startY: 0 });

  const getTouchDist = (t) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e) => {
    if (e.target.closest('.pt-node')) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      touchRef.current.dist = getTouchDist(e.touches);
    } else if (e.touches.length === 1) {
      touchRef.current.panning = true;
      touchRef.current.startX = e.touches[0].clientX - panX;
      touchRef.current.startY = e.touches[0].clientY - panY;
    }
  }, [panX, panY]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches);
      const ratio = newDist / (touchRef.current.dist || 1);
      touchRef.current.dist = newDist;
      const rect = wrapperRef.current?.getBoundingClientRect();
      const cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - (rect?.left || 0);
      const cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - (rect?.top || 0);
      setView((prev) => {
        const next = Math.min(Math.max(prev.scale * ratio, MIN_ZOOM), MAX_ZOOM);
        if (next === prev.scale) return prev;
        const r = next / prev.scale;
        const nv = {
          scale: next,
          x: cx - (cx - prev.x) * r,
          y: cy - (cy - prev.y) * r,
        };
        panOffsetRef.current = { x: nv.x, y: nv.y };
        return nv;
      });
      flashZoom();
    } else if (e.touches.length === 1 && touchRef.current.panning) {
      const tx = e.touches[0].clientX - touchRef.current.startX;
      const ty = e.touches[0].clientY - touchRef.current.startY;
      setView((prev) => ({ ...prev, x: tx, y: ty }));
    }
  }, [flashZoom]);

  const handleTouchEnd = useCallback(() => {
    if (touchRef.current.panning) {
      touchRef.current.panning = false;
      panOffsetRef.current = { x: panX, y: panY };
    }
    touchRef.current.dist = 0;
  }, [panX, panY]);

  // Close the ⋮ menu on outside click
  useEffect(() => {
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close dept dropdown on outside click (mouse + touch) — also handles portal menu
  useEffect(() => {
    const handleClick = (event) => {
      const dd = deptDropdownRef.current;
      const menu = document.querySelector('.prereq-dept-menu');
      const insideDD = dd && dd.contains(event.target);
      const insideMenu = menu && menu.contains(event.target);
      if (!insideDD && !insideMenu) setDeptDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, []);

  // Mobile: keep menu fixed under trigger (no scroll-move) — close on scroll instead
  useEffect(() => {
    if (!deptDropdownOpen) return;
    const onScroll = () => setDeptDropdownOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [deptDropdownOpen]);



  // ─── Pan (drag empty canvas) ───
  const handlePanStart = useCallback((e) => {
    if (e.target.closest('.pt-node')) return;
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePanMove = useCallback((e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setView((prev) => ({
      ...prev,
      x: panOffsetRef.current.x + dx,
      y: panOffsetRef.current.y + dy,
    }));
  }, [isPanning]);

  const handlePanEnd = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      panOffsetRef.current = { x: panX, y: panY };
    }
  }, [isPanning, panX, panY]);

  // ─── Cleanup function for drag listeners ───
  const dragCleanupRef = useRef(null);

  useEffect(() => {
    return () => {
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
        dragCleanupRef.current = null;
      }
    };
  }, []);

  // ─── Draggable nodes ───
  const handleNodeMouseDown = useCallback((e, node) => {
    if (e.button !== 0) return; // left-click only
    e.stopPropagation();
    const currentOffset = nodeOffsets.get(node.id) || { dx: 0, dy: 0 };
    const drag = {
      nodeId: node.id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: currentOffset.dx,
      offsetY: currentOffset.dy,
      moved: false,
    };
    dragRef.current = drag;

    const handleMove = (ev) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragRef.current.moved = true;
      }
      if (!dragRef.current.moved) return;
      // Capture ref values locally BEFORE setState (React 18 batches functional updaters)
      const { nodeId, offsetX, offsetY } = dragRef.current;
      setNodeOffsets((prev) => {
        const next = new Map(prev);
        next.set(nodeId, {
          dx: offsetX + dx,
          dy: offsetY + dy,
        });
        return next;
      });
      document.body.style.cursor = 'move';
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      dragCleanupRef.current = null;
      document.body.style.cursor = '';
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag?.moved) {
        setSelected(node);
      } else {
        toggleNode(node);
      }
    };

    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [nodeOffsets, toggleNode]);

  const resetNodePositions = useCallback(() => {
    setNodeOffsets(new Map());
  }, []);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        const input = containerRef.current?.querySelector('.prereq-search-input');
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); zoomOut(); }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); resetZoom(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen, zoomIn, zoomOut, resetZoom]);

  const zoomPercent = Math.round(scale * 100);

  // Lock body scroll while fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [fullscreen]);

  const isDeptAvailable = DEPARTMENTS.find(d => d.id === dept)?.available;
  const statsCourses = isDeptAvailable ? `${visibleCourses}/${totalCourses}` : '—';
  const statsBranches = isDeptAvailable ? parentIds.length : '—';

  const content = (
    <div
      ref={containerRef}
      className={`prerequisite-tree glass-card-static schedule-widget st-widget prereq-widget animate-fadeInUp ${fullscreen ? 'prereq-fullscreen' : ''}`}
    >
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <GitBranch size={20} strokeWidth={2.2} />
          </div>
          <div className="schedule-title-text">
            <span className="schedule-overline">Grade Lab</span>
            <h2 className="schedule-title">Prerequisites</h2>
            <span className="schedule-subtitle">CSE undergraduate course flow</span>
          </div>
        </div>

        <div className="schedule-masthead-center schedule-stats">
          <div className="schedule-stat">
            <span className="schedule-stat-value">{statsCourses}</span>
            <span className="schedule-stat-label">Courses</span>
          </div>
          <div className="schedule-stat">
            <span className="schedule-stat-value">{statsBranches}</span>
            <span className="schedule-stat-label">Branches</span>
          </div>
          <div className="schedule-stat">
            <span className="schedule-stat-value">{dept}</span>
            <span className="schedule-stat-label">Department</span>
          </div>
        </div>

        <div className="schedule-actions">
          <div className="schedule-week-nav">
            <button className="schedule-nav-btn" onClick={zoomOut} disabled={scale <= MIN_ZOOM} title="Zoom out (⌘-)">
              <ZoomOut size={16} />
            </button>
            <span className="schedule-week-pill">
              <span className={`schedule-week-pill-value ${isZooming ? 'is-zooming' : ''}`}>{zoomPercent}%</span>
            </span>
            <button className="schedule-nav-btn" onClick={zoomIn} disabled={scale >= MAX_ZOOM} title="Zoom in (⌘=)">
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* Dept dropdown — 8 options below box */}
      <div className="prereq-dept-dropdown" ref={deptDropdownRef}>
        <button
          className="prereq-dept-trigger"
          onClick={() => setDeptDropdownOpen((v) => !v)}
          aria-expanded={deptDropdownOpen}
          aria-haspopup="true"
        >
          <span>{DEPARTMENTS.find((d) => d.id === dept)?.label || dept}</span>
          <ChevronDown size={14} className={deptDropdownOpen ? 'open' : ''} />
        </button>
        {deptDropdownOpen && (
          <div className="prereq-dept-menu">
            {DEPARTMENTS.map((d) => (
              <button
                key={d.id}
                className={`prereq-dept-item ${dept === d.id ? 'active' : ''}`}
                onClick={() => {
                  if (!d.available) return;
                  setDept(d.id);
                  setDeptDropdownOpen(false);
                }}
                disabled={!d.available}
              >
                <span>{d.label}</span>
                {!d.available && <em className="prereq-dept-soon">soon</em>}
                {dept === d.id && <Check size={12} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'none' }}>
          <div className="export-dropdown" ref={menuRef} style={{ display: 'none' }}>
            <button
              className="schedule-nav-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Tree options"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="export-menu prereq-menu">
                <div className="export-menu-sep" />
                <span className="export-menu-title">Department</span>
                {DEPARTMENTS.map((d) => (
                  <button
                    key={d.id}
                    className={`export-menu-item ${dept === d.id ? 'menu-active' : ''}`}
                    onClick={() => { setDept(d.id); setMenuOpen(false); }}
                  >
                    <Check size={13} style={{ opacity: dept === d.id ? 1 : 0 }} />
                    {d.label}
                    {!d.available && <em className="menu-tag">soon</em>}
                  </button>
                ))}
                <div className="export-menu-sep" />
                <button className="export-menu-item" onClick={expandAll}>
                  <ChevronsUpDown size={13} /> Expand All
                </button>
                <button className="export-menu-item" onClick={collapseAll}>
                  <ChevronsDownUp size={13} /> Collapse All
                </button>
                <button className="export-menu-item" onClick={resetNodePositions} disabled={nodeOffsets.size === 0}>
                  <RotateCcw size={13} /> Reset Positions
                </button>
                <div className="export-menu-sep" />
                <button className="export-menu-item" onClick={() => setFullscreen((p) => !p)}>
                  {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
              </div>
            )}
          </div>
        </div>

      <div className="prereq-coming-soon" style={{ display: !isDeptAvailable ? 'flex' : 'none' }}>
        <div className="prereq-coming-soon-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" opacity="0.3" />
            <path d="M12 8v4" />
            <path d="M12 16v0" />
          </svg>
        </div>
        <h3 className="prereq-coming-soon-title">Coming Soon</h3>
        <p className="prereq-coming-soon-desc">
          Prerequisite tree for <strong>{dept}</strong> is under development.
          Switch to <strong>CSE</strong> to explore the current prerequisite map.
        </p>
      </div>

      <div className="prereq-content" style={{ display: isDeptAvailable ? 'contents' : 'none' }}>
      {/* Search */}
      <div className="prereq-toolbar">
        <div className="prereq-search">
          <Search size={14} className="prereq-search-icon" />
          <input
            type="text"
            className="prereq-search-input"
            placeholder="Search courses... (⌘F)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Selected course info */}
      {selected && (
        <div className="prereq-course-detail">
          <div className="prereq-course-detail-header">
            <span className="prereq-course-detail-code">{selected.code}</span>
            <span className="prereq-course-detail-name">{selected.name}</span>
            <button className="prereq-course-detail-close" onClick={() => setSelected(null)} title="Dismiss">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="prereq-hint">
        <span>
          <strong>Click</strong> a node to expand / collapse &bull;
          <strong>Drag</strong> any node to reposition &bull;
          <strong>Scroll</strong> to zoom &bull;
          <strong>Drag</strong> canvas to pan
        </span>
      </div>

      {/* Canvas */}
      <div className={`prereq-canvas ${fullscreen ? 'fullscreen' : ''}`}>
        <div
          className="prereq-viewport"
          ref={wrapperRef}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
          <div
            className={`prereq-transform-layer ${isZooming ? 'is-zooming' : ''}`}
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
              transformOrigin: '0 0',
              transition: isPanning
                ? 'none'
                : isZooming
                  ? 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'transform 0.15s ease',
            }}
          >
            <svg
              className="pt-svg"
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
            >
              {/* Edges */}
              <g className="pt-edges">
                {offsetEdges.map((e) => {
                  const midX = (e.x1 + e.x2) / 2;
                  return (
                    <path
                      key={e.id}
                      className={`pt-edge pt-edge--${e.type}`}
                      d={`M ${e.x1} ${e.y1} C ${midX} ${e.y1}, ${midX} ${e.y2}, ${e.x2} ${e.y2}`}
                    />
                  );
                })}
              </g>

              {/* Nodes */}
              <g className="pt-nodes">
                {offsetNodes.map(({ node, x, y, w }) => {
                  const hasChildren = !!node.children?.length;
                  const isOpen = effectiveExpanded.has(node.id);
                  const isMatch = matchedIds.has(node.id);
                  const isSelected = selected?.id === node.id;
                  const dim = term && !isMatch && !hasChildren;
                  const neon = NEON_VAR[node.type] || NEON_VAR.core;
                  return (
                    <g
                      key={node.id}
                      className={[
                        'pt-node',
                        `pt-node--${node.type}`,
                        hasChildren ? 'pt-node--parent' : '',
                        isMatch ? 'pt-node--match' : '',
                        isSelected ? 'pt-node--selected' : '',
                        dim ? 'pt-node--dim' : '',
                      ].join(' ')}
                      transform={`translate(${x}, ${y - NODE_H / 2})`}
                      onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    >
                      <rect className="pt-node-rect" width={w} height={NODE_H} rx={9} />
                      <rect className="pt-node-accent" x={0} y={3} width={3} height={NODE_H - 6} rx={1.5} fill={neon} />
                      <text className="pt-node-text" x={18} y={NODE_H / 2 + 4}>
                        {node.code && <tspan className="pt-node-code">{node.code}</tspan>}
                        <tspan className="pt-node-name" dx={node.code ? 7 : 0}>{node.name}</tspan>
                      </text>
                      {hasChildren && (
                        <g transform={`translate(${w - 15}, ${NODE_H / 2})`}>
                          <circle className="pt-toggle-badge" r={8} />
                          <text className="pt-toggle-sign" y={3.5} textAnchor="middle">
                            {isOpen ? '−' : '+'}
                          </text>
                        </g>
                      )}
                      {hasChildren && !isOpen && (
                        <text className="pt-child-count" x={w + 8} y={NODE_H / 2 + 3.5} fill={neon}>
                          {node.children.length}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="prereq-legend">
        <div className="prereq-legend-group">
          <span className="prereq-legend-title">Legend</span>
          {[
            { label: 'Root', type: 'root' },
            { label: 'Category', type: 'category' },
            { label: 'Core Course', type: 'core' },
            { label: 'Elective', type: 'elective' },
          ].map((item) => (
            <div key={item.label} className="prereq-legend-item">
              <span
                className="prereq-legend-swatch"
                style={{ border: `2px solid ${NEON_VAR[item.type]}` }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <div className="prereq-legend-group">
          <span className="prereq-legend-title">Controls</span>
          <span className="prereq-legend-item" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            Click to expand/collapse &bull; Scroll to zoom &bull; ⌘F Search &bull; ⌘0 Reset &bull; Esc Exit fullscreen
          </span>
        </div>
      </div>
      </div>
    </div>
  );

  // Render into <body> when fullscreen so no parent transform/overflow can trap it
  return fullscreen ? createPortal(content, document.body) : content;
}

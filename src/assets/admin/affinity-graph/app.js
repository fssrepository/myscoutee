import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { DEMO_AFFINITY_GRAPH } from './data.js';

const GRAPH_STORE_KEY = new URLSearchParams(window.location.search).get('store') || 'adminAffinityGraph';
const GRAPH_DATA = normalizeGraphData(await readGraphSnapshotFromIndexedDb(GRAPH_STORE_KEY) ?? DEMO_AFFINITY_GRAPH);
const GRAPH_MEMBER_LABEL = GRAPH_DATA.source === 'http' ? 'Mongo members' : 'demo members';
const GRAPH_LAZY_ENABLED = GRAPH_DATA.source === 'http';
const GRAPH_LAYOUT_VERSION = GRAPH_DATA.layoutVersion || null;
const COMPONENT_CORE_NODE_BUDGET = 20;
const COMPONENT_CORE_EDGE_BUDGET = 56;

const canvas = document.querySelector('#graph-canvas');
const controlPanel = document.querySelector('.control-panel');
const memberCountEl = document.querySelector('#member-count');
const linkCountEl = document.querySelector('#link-count');
const componentCountEl = document.querySelector('#component-count');
const isolatedCountEl = document.querySelector('#isolated-count');
const memberPanel = document.querySelector('#member-panel');
const rangeField = document.querySelector('.range-field');
const depthField = document.querySelector('.depth-field');
const minWeightInput = document.querySelector('#min-weight');
const maxWeightInput = document.querySelector('#max-weight');
const weightRangeValue = document.querySelector('#weight-range-value');
const linkDepthInput = document.querySelector('#link-depth');
const linkDepthValue = document.querySelector('#link-depth-value');
const resetViewButton = document.querySelector('#reset-view');

const demoNodes = GRAPH_DATA.nodes.filter(node => node.id !== 'u-onboarding');
const hasServerNodeMetrics = demoNodes.some(node => Number(node.degree) > 0 || Number(node.weightedDegree) > 0);
const nodeById = new Map(demoNodes.map(node => [node.id, {
  ...node,
  degree: hasServerNodeMetrics ? Number(node.degree ?? 0) : 0,
  weightedDegree: hasServerNodeMetrics ? Number(node.weightedDegree ?? 0) : 0,
  visibleDegree: 0,
  collapseBadgeCount: 0,
  componentId: node.componentId ?? null,
  radius: 1.4,
  position: new THREE.Vector3()
}]));

const nodes = [...nodeById.values()];
const edges = GRAPH_DATA.edges
  .filter(edge => nodeById.has(edge.source) && nodeById.has(edge.target))
  .map(edge => ({
    ...edge,
    weight: clamp(Number(edge.weight ?? edge.affinityScore ?? 0), 0, 1)
  }));
const edgeKeys = new Set(edges.map(edge => graphEdgeKey(edge.source, edge.target)));

const adjacency = new Map(nodes.map(node => [node.id, []]));
for (const edge of edges) {
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  if (!hasServerNodeMetrics) {
    source.degree += 1;
    target.degree += 1;
    source.weightedDegree += edge.weight;
    target.weightedDegree += edge.weight;
  }
  adjacency.get(edge.source).push({ edge, other: target });
  adjacency.get(edge.target).push({ edge, other: source });
}

const components = buildComponents(nodes, edges);
const componentById = new Map(components.map(component => [String(component.id), component]));
enrichComponents(components, edges);
let serverPositionCenter = new THREE.Vector3();
placeNodes(nodes, edges, components);

const isolatedNodes = nodes.filter(node => node.degree === 0);
for (const node of nodes) {
  node.homePosition = node.position.clone();
  node.targetPosition = node.position.clone();
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111317);
scene.fog = new THREE.FogExp2(0x111317, 0.0038);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 24;
controls.maxDistance = 2200;
controls.enablePan = false;
controls.screenSpacePanning = true;
controls.mouseButtons = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE
};

const graphRoot = new THREE.Group();
const edgeGroup = new THREE.Group();
const selectedLinkGroup = new THREE.Group();
const forestGroup = new THREE.Group();
const nodeGroup = new THREE.Group();
graphRoot.add(edgeGroup, selectedLinkGroup, forestGroup, nodeGroup);
scene.add(graphRoot);

scene.add(new THREE.HemisphereLight(0xf8fbff, 0x182331, 1.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.25);
keyLight.position.set(36, 48, 52);
scene.add(keyLight);
const sideLight = new THREE.DirectionalLight(0xffd7b1, 0.85);
sideLight.position.set(-56, 18, -36);
scene.add(sideLight);

const grid = new THREE.GridHelper(360, 24, 0x3b4149, 0x242930);
grid.position.y = -28;
grid.material.transparent = true;
grid.material.opacity = 0.32;
scene.add(grid);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickTargets = [];
const forestClickTargets = [];
let selectedNode = null;
let activeComponentId = null;
let fullGraphExpanded = false;
let selectionReturnMode = null;
let hoverNode = null;
let hoverForest = null;
let edgeMesh = null;
let selectedLinkLines = null;
let pointerDown = null;
let visibleEdgeCount = 0;
let visibleEdges = [];
let visibleNodeIds = new Set(nodes.map(node => node.id));
let visibleNodeDepths = new Map(nodes.map(node => [node.id, 0]));
let nodeRefitTimer = null;
let nodeLayoutAnimation = null;
let cameraAnimation = null;
let selectionVisualAnimation = null;
let lazyTileTimer = null;
let lazyTileRequestSerial = 0;
const loadedTileKeys = new Set(GRAPH_LAZY_ENABLED ? ['0:0:0:*'] : []);
const pendingTileKeys = new Set();
const loadedComponentKeys = new Set();
const pendingComponentKeys = new Set();
const loadedNeighborhoodKeys = new Set();
const viewportPanOffset = { x: 0, y: 0 };

const selectionSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: createRingTexture(),
  transparent: true,
  fog: false,
  depthTest: false,
  opacity: 0.92
}));
selectionSprite.visible = false;
selectionSprite.renderOrder = 30;
nodeGroup.add(selectionSprite);

createNodes();
createForests();
resize();
rebuildEdges();
refitVisibleNodes({ immediate: true });
fitCamera(false);
renderMemberPanel(null);
animate();
scheduleLazyTileLoad(320);

memberCountEl.textContent = String(nodes.length);
linkCountEl.textContent = String(edges.length);
componentCountEl.textContent = String(components.length);
isolatedCountEl.textContent = String(isolatedNodes.length);

minWeightInput.addEventListener('input', () => handleWeightRangeInput('min'));
maxWeightInput.addEventListener('input', () => handleWeightRangeInput('max'));
linkDepthInput.addEventListener('input', handleLinkDepthInput);
controls.addEventListener('change', () => scheduleLazyTileLoad(260));

resetViewButton.addEventListener('click', () => {
  clearForest();
});
window.addEventListener('resize', resize);
window.addEventListener('keydown', handleKeyPan);
canvas.addEventListener('contextmenu', event => event.preventDefault());

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) {
    return;
  }
  pointerDown = {
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    pointerId: event.pointerId,
    dragged: false
  };
  canvas.setPointerCapture?.(event.pointerId);
});

canvas.addEventListener('pointermove', event => {
  if (pointerDown && (event.buttons & 1)) {
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    const deltaX = event.clientX - pointerDown.lastX;
    const deltaY = event.clientY - pointerDown.lastY;
    pointerDown.lastX = event.clientX;
    pointerDown.lastY = event.clientY;

    if (pointerDown.dragged || moved > 4) {
      pointerDown.dragged = true;
      panViewportByScreenDelta(deltaX, deltaY);
      canvas.style.cursor = 'grabbing';
      return;
    }
  }

  const nextHoverNode = pickNode(event);
  const nextHoverForest = nextHoverNode ? null : pickForest(event);
  if (nextHoverNode !== hoverNode || nextHoverForest !== hoverForest) {
    hoverNode = nextHoverNode;
    hoverForest = nextHoverForest;
    canvas.style.cursor = nextHoverNode || nextHoverForest ? 'pointer' : 'grab';
  }
});

canvas.addEventListener('pointerup', event => {
  if (!pointerDown) {
    return;
  }
  const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  const dragged = pointerDown.dragged;
  canvas.releasePointerCapture?.(pointerDown.pointerId);
  pointerDown = null;
  if (dragged || moved > 6) {
    canvas.style.cursor = hoverNode || hoverForest ? 'pointer' : 'grab';
    publishPreviewState();
    return;
  }
  const node = pickNode(event);
  if (node) {
    selectNode(node.id, { focus: false });
    return;
  }

  const forest = pickForest(event);
  if (forest) {
    selectForest(forest.id);
  } else if (selectedNode) {
    clearSelection();
  }
});

function createNodes() {
  for (const node of nodes) {
    createNodeBadge(node);
  }
}

function createNodeBadge(node) {
  const component = componentForId(node.componentId);
  const baseColor = colorForNode(node, component);
  updateNodeBadgeSizing(node);

  const badge = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createInitialsTexture(node, baseColor),
    transparent: true,
    fog: false,
    depthTest: false,
    depthWrite: false
  }));
  badge.position.copy(node.position);
  badge.scale.setScalar(node.badgeScale);
  badge.renderOrder = node.degree === 0 ? 22 : 20;
  badge.userData.nodeId = node.id;
  node.badge = badge;
  clickTargets.push(badge);
  nodeGroup.add(badge);
}

function createForests() {
  const forestPositions = forestOverviewPositions();
  for (const component of components) {
    const center = forestPositions.get(component.id) ?? new THREE.Vector3();
    component.forestPosition = center.clone();

    const badge = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createForestTexture(component, colorForComponent(component)),
      transparent: true,
      fog: false,
      depthTest: false,
      depthWrite: false
    }));
    const memberCount = component.memberCountEstimate ?? component.nodes.length;
    const scale = memberCount === 1 ? 5.2 : 8.5 + Math.sqrt(memberCount) * 1.35;
    component.forestScale = scale;
    badge.position.copy(center);
    badge.scale.setScalar(scale);
    badge.renderOrder = 24;
    badge.userData.componentId = component.id;
    component.forestBadge = badge;
    forestClickTargets.push(badge);
    forestGroup.add(badge);
  }
}

function forestOverviewPositions() {
  const sortedComponents = sortedForestComponents();
  const positions = new Map();
  const mainCount = sortedComponents[0]?.memberCountEstimate ?? sortedComponents[0]?.nodes.length ?? 1;
  const mainScale = mainCount === 1
    ? 5.2
    : 8.5 + Math.sqrt(mainCount) * 1.35;
  const step = Math.max(10, mainScale * 0.64 + 8);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  sortedComponents.forEach((component, index) => {
    if (index === 0) {
      positions.set(component.id, new THREE.Vector3(0, 0, 0));
      return;
    }

    const angle = index * goldenAngle;
    const radius = Math.sqrt(index) * step;
    positions.set(component.id, new THREE.Vector3(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    ));
  });

  return positions;
}

function rebuildEdges() {
  disposeObject(edgeMesh);
  edgeGroup.clear();

  const weightRange = currentWeightRange();
  updateWeightRangeUi(weightRange);
  updateLinkDepthUi();
  updateControlVisibility();
  const thresholdEdges = edges.filter(edge => isEdgeInWeightRange(edge, weightRange));
  const visibleGraph = visibleGraphForCurrentView(thresholdEdges);
  visibleEdges = visibleGraph.edges;
  visibleNodeIds = visibleGraph.nodeIds;
  visibleNodeDepths = visibleGraph.nodeDepths;
  visibleEdgeCount = visibleEdges.length;
  for (const node of nodes) {
    node.visibleDegree = 0;
    node.visibleWeightSum = 0;
    node.visibleStrongest = 0;
  }
  for (const edge of visibleEdges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    source.visibleDegree += 1;
    target.visibleDegree += 1;
    source.visibleWeightSum += edge.weight;
    target.visibleWeightSum += edge.weight;
    source.visibleStrongest = Math.max(source.visibleStrongest, edge.weight);
    target.visibleStrongest = Math.max(target.visibleStrongest, edge.weight);
  }
  updateCollapseBadgeCounts(thresholdEdges);

  const isDeepSelection = selectedNode && currentLinkDepth() > 1;
  edgeMesh = createEdgeMesh(visibleEdges, {
    opacity: isDeepSelection ? 0.82 : 0.66,
    brighten: isDeepSelection ? 0.26 : 0.04
  });
  if (edgeMesh) {
    edgeMesh.renderOrder = isDeepSelection ? 4 : 2;
    edgeGroup.add(edgeMesh);
  }
  rebuildSelectedEdges();
  applyNodeState();

  publishPreviewState();
}

function visibleGraphForCurrentView(thresholdEdges) {
  if (selectedNode) {
    return visibleGraphForSelectedDepth(thresholdEdges);
  }
  if (fullGraphExpanded) {
    return visibleGraphForFullGraph(thresholdEdges);
  }
  if (activeComponentId !== null) {
    return visibleGraphForComponent(activeComponentId, thresholdEdges);
  }
  return {
    edges: [],
    nodeIds: new Set(),
    nodeDepths: new Map()
  };
}

function visibleGraphForFullGraph(thresholdEdges) {
  return {
    edges: thresholdEdges,
    nodeIds: new Set(nodes.map(node => node.id)),
    nodeDepths: new Map(nodes.map(node => [node.id, 0]))
  };
}

function visibleGraphForComponent(componentId, thresholdEdges) {
  const component = componentForId(componentId);
  if (!component) {
    return {
      edges: [],
      nodeIds: new Set(),
      nodeDepths: new Map()
    };
  }

  const componentNodeIds = new Set(component.nodes.map(node => node.id));
  const componentEdges = thresholdEdges.filter(edge => componentNodeIds.has(edge.source) && componentNodeIds.has(edge.target));
  const coreGraph = strongestComponentCore(component, componentEdges);
  const nodeIds = coreGraph.nodeIds;
  return {
    edges: coreGraph.edges,
    nodeIds,
    nodeDepths: new Map([...nodeIds].map(nodeId => [nodeId, 0]))
  };
}

function strongestComponentCore(component, componentEdges) {
  if (!componentEdges.length) {
    const representative = forestRepresentativeForComponent(component) ?? component.nodes[0];
    return {
      edges: [],
      nodeIds: new Set(representative ? [representative.id] : [])
    };
  }

  const weightedDegree = new Map();
  const degree = new Map();
  const edgesByNode = new Map(component.nodes.map(node => [node.id, []]));
  for (const edge of componentEdges) {
    weightedDegree.set(edge.source, (weightedDegree.get(edge.source) ?? 0) + edge.weight);
    weightedDegree.set(edge.target, (weightedDegree.get(edge.target) ?? 0) + edge.weight);
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    edgesByNode.get(edge.source)?.push(edge);
    edgesByNode.get(edge.target)?.push(edge);
  }

  const rankedNodes = [...component.nodes]
    .filter(node => (degree.get(node.id) ?? 0) > 0)
    .sort((a, b) =>
      (weightedDegree.get(b.id) ?? 0) - (weightedDegree.get(a.id) ?? 0)
      || (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)
      || a.name.localeCompare(b.name)
      || a.id.localeCompare(b.id)
    );
  const remaining = new Set(rankedNodes.map(node => node.id));
  const selectedIds = new Set();
  const seedEdges = new Map();

  for (const seed of rankedNodes) {
    if (selectedIds.size >= COMPONENT_CORE_NODE_BUDGET) {
      break;
    }
    if (!remaining.has(seed.id)) {
      continue;
    }

    selectedIds.add(seed.id);
    remaining.delete(seed.id);
    const partnerLimit = selectedIds.size <= 1 ? 5 : 3;
    let partnerCount = 0;
    const partnerEdges = [...(edgesByNode.get(seed.id) ?? [])]
      .filter(edge => remaining.has(edge.source === seed.id ? edge.target : edge.source))
      .sort((a, b) => b.weight - a.weight || graphEdgeKey(a.source, a.target).localeCompare(graphEdgeKey(b.source, b.target)));

    for (const edge of partnerEdges) {
      if (selectedIds.size >= COMPONENT_CORE_NODE_BUDGET || partnerCount >= partnerLimit) {
        break;
      }
      const partnerId = edge.source === seed.id ? edge.target : edge.source;
      selectedIds.add(partnerId);
      remaining.delete(partnerId);
      seedEdges.set(graphEdgeKey(edge.source, edge.target), edge);
      partnerCount += 1;
    }
  }

  if (selectedIds.size < Math.min(6, rankedNodes.length)) {
    for (const node of rankedNodes) {
      if (selectedIds.size >= Math.min(COMPONENT_CORE_NODE_BUDGET, rankedNodes.length)) {
        break;
      }
      selectedIds.add(node.id);
    }
  }

  const selectedEdgeByKey = new Map(seedEdges);
  componentEdges
    .filter(edge => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .sort((a, b) => b.weight - a.weight || graphEdgeKey(a.source, a.target).localeCompare(graphEdgeKey(b.source, b.target)))
    .slice(0, COMPONENT_CORE_EDGE_BUDGET)
    .forEach(edge => selectedEdgeByKey.set(graphEdgeKey(edge.source, edge.target), edge));

  return {
    edges: [...selectedEdgeByKey.values()].slice(0, COMPONENT_CORE_EDGE_BUDGET),
    nodeIds: selectedIds
  };
}

function visibleGraphForSelectedDepth(thresholdEdges) {
  const maxDepth = currentLinkDepth();
  const nodeDepths = new Map([[selectedNode.id, 0]]);
  let frontier = new Set([selectedNode.id]);

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const nextFrontier = new Set();
    for (const edge of thresholdEdges) {
      const sourceInFrontier = frontier.has(edge.source);
      const targetInFrontier = frontier.has(edge.target);
      if (!sourceInFrontier && !targetInFrontier) {
        continue;
      }

      const nextId = sourceInFrontier ? edge.target : edge.source;
      if (!nodeDepths.has(nextId)) {
        nodeDepths.set(nextId, depth);
        nextFrontier.add(nextId);
      }
    }
    frontier = nextFrontier;
    if (!frontier.size) {
      break;
    }
  }

  const nodeIds = new Set(nodeDepths.keys());
  const graphEdges = maxDepth === 1
    ? thresholdEdges.filter(edge => edge.source === selectedNode.id || edge.target === selectedNode.id)
    : strongestLayerEdges(thresholdEdges, nodeDepths);

  return {
    edges: graphEdges,
    nodeIds,
    nodeDepths
  };
}

function strongestLayerEdges(thresholdEdges, nodeDepths) {
  const graphEdges = [];
  const edgeKeys = new Set();
  const parentEdgesByNode = new Map();
  const addEdge = edge => {
    const key = edge.source < edge.target ? `${edge.source}:${edge.target}` : `${edge.target}:${edge.source}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      graphEdges.push(edge);
    }
  };

  for (const edge of thresholdEdges) {
    const sourceDepth = nodeDepths.get(edge.source);
    const targetDepth = nodeDepths.get(edge.target);
    if (sourceDepth === undefined || targetDepth === undefined || Math.abs(sourceDepth - targetDepth) !== 1) {
      continue;
    }

    const deeperNodeId = sourceDepth > targetDepth ? edge.source : edge.target;
    const deeperDepth = Math.max(sourceDepth, targetDepth);
    if (deeperDepth === 1) {
      addEdge(edge);
      continue;
    }

    if (!parentEdgesByNode.has(deeperNodeId)) {
      parentEdgesByNode.set(deeperNodeId, []);
    }
    parentEdgesByNode.get(deeperNodeId).push(edge);
  }

  for (const nodeEdges of parentEdgesByNode.values()) {
    nodeEdges
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .forEach(addEdge);
  }

  return graphEdges;
}

function createEdgeMesh(renderEdges, options = {}) {
  if (!renderEdges.length) {
    return null;
  }
  const brighten = Number(options.brighten ?? 0);
  const white = new THREE.Color(0xffffff);
  const positions = new Float32Array(renderEdges.length * 6);
  const colors = new Float32Array(renderEdges.length * 6);
  renderEdges.forEach((edge, index) => {
    const source = nodeById.get(edge.source).position;
    const target = nodeById.get(edge.target).position;
    const color = colorForWeight(edge.weight).lerp(white, brighten);
    const offset = index * 6;
    positions.set([source.x, source.y, source.z, target.x, target.y, target.z], offset);
    colors.set([color.r, color.g, color.b, color.r, color.g, color.b], offset);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: Number(options.opacity ?? 0.56),
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.userData.edges = renderEdges;
  return lines;
}

function rebuildSelectedEdges() {
  disposeObject(selectedLinkLines);
  selectedLinkGroup.clear();
  if (!selectedNode) {
    return;
  }

  const selectedLinks = visibleEdges.filter(edge => edge.source === selectedNode.id || edge.target === selectedNode.id);
  selectedLinkLines = createEdgeMesh(selectedLinks, {
    opacity: 0.98,
    brighten: 0.14
  });
  if (selectedLinkLines) {
    selectedLinkLines.renderOrder = 6;
    selectedLinkGroup.add(selectedLinkLines);
  }
}

function selectNode(nodeId, options = {}) {
  const node = nodeById.get(nodeId) ?? null;
  const startScale = node?.badge?.scale.x ?? node?.badgeScale ?? 1;
  selectionReturnMode = fullGraphExpanded ? 'graph' : activeComponentId !== null ? 'forest' : 'graph';
  selectedNode = node;
  fullGraphExpanded = false;
  if (selectedNode) {
    activeComponentId = selectedNode.componentId;
  }
  if (selectedNode && options.focus) {
    controls.target.copy(selectedNode.position);
  }
  rebuildEdges();
  startSelectionVisualAnimation(startScale);
  renderMemberPanel(selectedNode);
  scheduleNodeRefit(70);
  scheduleLazyNeighborhoodLoad(80);
  publishPreviewState();
}

function selectForest(componentId) {
  if (!componentForId(componentId)) {
    return;
  }
  activeComponentId = componentId;
  selectedNode = null;
  selectionReturnMode = null;
  fullGraphExpanded = false;
  restoreHomeNodePositions();
  rebuildEdges();
  renderMemberPanel(null);
  refitVisibleNodes({ immediate: false });
  fitCameraToVisibleTargets(true);
  scheduleLazyComponentLoad(componentId, 60, { refresh: true });
  scheduleLazyTileLoad(80, { refresh: true });
  publishPreviewState();
}

function clearSelection() {
  const previousNode = selectedNode;
  const startScale = previousNode?.badge?.scale.x ?? previousNode?.badgeScale ?? 1;
  const startRingScale = selectionSprite.scale.x;
  const startRingOpacity = selectionSprite.visible ? selectionSprite.material.opacity : 0;
  selectionVisualAnimation = null;
  selectedNode = null;
  const returnMode = selectionReturnMode;
  selectionReturnMode = null;

  if (returnMode === 'forest' && activeComponentId !== null) {
    fullGraphExpanded = false;
    rebuildEdges();
    startDeselectionVisualAnimation(previousNode, startScale, startRingScale, startRingOpacity);
    renderMemberPanel(null);
    refitVisibleNodes({ immediate: false });
    fitCameraToVisibleTargets(true);
    scheduleLazyTileLoad(120, { refresh: true });
    publishPreviewState();
    return;
  }

  activeComponentId = null;
  fullGraphExpanded = true;
  rebuildEdges();
  startDeselectionVisualAnimation(previousNode, startScale, startRingScale, startRingOpacity);
  renderMemberPanel(null);
  refitVisibleNodes({ immediate: false });
  fitCameraToVisibleTargets(true);
  scheduleLazyTileLoad(120, { refresh: true });
  publishPreviewState();
}

function showFullGraph() {
  stopSelectionVisualAnimation();
  selectedNode = null;
  activeComponentId = null;
  selectionReturnMode = null;
  fullGraphExpanded = true;
  rebuildEdges();
  renderMemberPanel(null);
  refitVisibleNodes({ immediate: false });
  fitCameraToVisibleTargets(true);
  scheduleLazyTileLoad(120, { refresh: true });
  publishPreviewState();
}

function restoreHomeNodePositions() {
  nodeLayoutAnimation = null;
  if (nodeRefitTimer) {
    clearTimeout(nodeRefitTimer);
    nodeRefitTimer = null;
  }
  for (const node of nodes) {
    node.position.copy(node.homePosition);
    node.targetPosition.copy(node.homePosition);
  }
  syncGraphObjects();
}

function clearForest() {
  stopSelectionVisualAnimation();
  selectedNode = null;
  activeComponentId = null;
  selectionReturnMode = null;
  fullGraphExpanded = false;
  rebuildEdges();
  renderMemberPanel(null);
  refitVisibleNodes({ immediate: false });
  fitCamera(true);
  publishPreviewState();
}

function applyNodeState() {
  const showForestOverview = isForestOverview();
  const visibleNodes = nodes.filter(node => visibleNodeIds.has(node.id));
  const maxVisibleWeight = Math.max(1, ...visibleNodes.map(node => node.visibleWeightSum ?? 0));
  const maxVisibleDegree = Math.max(1, ...visibleNodes.map(node => node.visibleDegree ?? 0));
  updateInteractionMode(showForestOverview);
  forestGroup.visible = showForestOverview;
  for (const component of components) {
    if (component.forestBadge) {
      component.forestBadge.visible = showForestOverview;
    }
  }

  for (const node of nodes) {
    const isVisible = visibleNodeIds.has(node.id);
    const isSelected = node === selectedNode;
    const visualWeight = (node.visibleWeightSum ?? 0) / maxVisibleWeight;
    const visualDegree = (node.visibleDegree ?? 0) / maxVisibleDegree;
    const visualScore = clamp((Math.sqrt(visualWeight) * 0.68) + (visualDegree * 0.32), 0, 1);
    const nodeDepth = visibleNodeDepths.get(node.id) ?? 0;
    const depthFade = selectedNode ? Math.max(0.68, 1 - nodeDepth * 0.1) : 1;
    const baseScale = selectedNode || activeComponentId !== null
      ? 0.82 + visualScore * 0.58
      : 1;
    node.badge.visible = !showForestOverview && isVisible;
    node.badge.material.opacity = isSelected ? 1 : clamp((0.62 + visualScore * 0.36) * depthFade, 0.56, 0.98);
    node.badge.scale.setScalar(node.badgeScale * (isSelected ? 1.46 : baseScale * depthFade));
    node.badge.renderOrder = isSelected ? 36 : 18 + Math.round(visualScore * 10) - nodeDepth;
  }
  if (selectedNode) {
    selectionSprite.visible = true;
    selectionSprite.position.copy(selectedNode.position);
    selectionSprite.scale.setScalar(selectedNode.badgeScale * 1.42);
  } else {
    selectionSprite.visible = false;
  }
}

function updateInteractionMode(showForestOverview = isForestOverview()) {
  controls.enableRotate = !showForestOverview;
  controls.mouseButtons.RIGHT = showForestOverview ? null : THREE.MOUSE.ROTATE;
}

function publishPreviewState() {
  window.affinityGraphPreview = {
    members: nodes.length,
    links: edges.length,
    visibleLinks: visibleEdgeCount,
    components: components.length,
    isolated: isolatedNodes.length,
    visibleNodes: visibleNodeIds.size,
    visibleNodeIds: Array.from(visibleNodeIds),
    selected: selectedNode?.id ?? null,
    selectedName: selectedNode?.name ?? null,
    selectedType: selectedNode ? 'node' : null,
    activeComponentId,
    fullGraphExpanded,
    viewMode: selectedNode ? 'member' : activeComponentId !== null ? 'forest' : fullGraphExpanded ? 'graph' : 'overview',
    weightRange: currentWeightRange(),
    linkDepth: currentLinkDepth(),
    visibleNodeDepths: Object.fromEntries(visibleNodeDepths),
    visibleForests: isForestOverview() ? components.length : 0,
    nodeIds: nodes.map(node => node.id),
    rendererReady: true,
    cameraAnimating: Boolean(cameraAnimation),
    cameraPosition: camera.position.toArray(),
    cameraTarget: controls.target.toArray(),
    cameraState() {
      return {
        animating: Boolean(cameraAnimation),
        position: camera.position.toArray(),
        target: controls.target.toArray()
      };
    },
    screenPositionForForest(id) {
      const component = componentForId(id);
      if (!component?.forestPosition) {
        return null;
      }
      return screenPositionForWorldPosition(component.forestPosition);
    },
    screenPositionForNode(id) {
      const node = nodeById.get(id);
      if (!node) {
        return null;
      }
      return screenPositionForWorldPosition(node.position);
    }
  };
}

function componentForId(componentId) {
  return componentById.get(String(componentId)) ?? null;
}

function screenPositionForWorldPosition(position) {
  const rect = canvas.getBoundingClientRect();
  const projected = position.clone().project(camera);
  return {
    x: rect.left + ((projected.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - projected.y) / 2) * rect.height,
    z: projected.z
  };
}

function renderMemberPanel(node) {
  if (!node) {
    if (activeComponentId !== null) {
      renderForestPanel(componentForId(activeComponentId));
      return;
    }
    if (fullGraphExpanded) {
      memberPanel.innerHTML = `<p class="empty-state">${nodes.length} members visible · ${visibleEdgeCount} links in range · ${components.length} forests.</p>`;
      return;
    }
    if (isForestOverview()) {
      const memberTotal = Math.max(nodes.length, components.reduce((total, component) => total + (component.memberCountEstimate ?? component.nodes.length), 0));
      memberPanel.innerHTML = `<p class="empty-state">${components.length} clusters · ${memberTotal} ${GRAPH_MEMBER_LABEL} · ${isolatedNodes.length} isolated.</p>`;
      return;
    }
    const hiddenCount = Math.max(0, Math.max(nodes.length, components.reduce((total, component) => total + (component.memberCountEstimate ?? component.nodes.length), 0)) - visibleNodeIds.size);
    memberPanel.innerHTML = `<p class="empty-state">${visibleNodeIds.size} important members visible · ${hiddenCount} collapsed · ${isolatedNodes.length} isolated.</p>`;
    return;
  }

  const weightRange = currentWeightRange();
  const sortedNeighbors = adjacency.get(node.id)
    .map(({ edge, other }) => ({ edge, other }))
    .sort((a, b) => b.edge.weight - a.edge.weight);
  const filteredNeighbors = sortedNeighbors.filter(item => isEdgeInWeightRange(item.edge, weightRange));
  const topNeighbors = filteredNeighbors.slice(0, 5);
  const strongest = topNeighbors[0]?.edge.weight ?? 0;
  const visibleConnections = filteredNeighbors.length;
  const avatarColor = colorForNode(node, componentForId(node.componentId)).getStyle();
  const neighborItems = topNeighbors.length
    ? topNeighbors.map(({ edge, other }) => `
      <li>
        <strong>${escapeHtml(other.name)}</strong>
        <span>${Math.round(edge.weight * 100)}%</span>
      </li>
    `).join('')
    : node.degree === 0
      ? '<li><strong>Disconnected in affinity seed</strong><span>0%</span></li>'
      : '<li><strong>No links in range</strong><span>0%</span></li>';

  memberPanel.innerHTML = `
    <p class="member-kicker">${node.degree === 0 ? 'Isolated member' : 'Selected member'}</p>
    <div class="member-heading">
      <div class="avatar" style="background:${avatarColor}">${escapeHtml(node.initials || '?')}</div>
      <div>
        <h2>${escapeHtml(node.name)}</h2>
        <p class="member-subtitle">${escapeHtml([node.city, node.age ? `${node.age}` : null, node.traitLabel].filter(Boolean).join(' · '))}</p>
      </div>
    </div>
    <p class="member-headline">${escapeHtml(node.headline || node.statusText || 'Demo profile')}</p>
    <dl class="detail-grid">
      <div>
        <dt>Total links</dt>
        <dd>${node.degree}</dd>
      </div>
      <div>
        <dt>Visible</dt>
        <dd>${visibleConnections}</dd>
      </div>
      <div>
        <dt>Strongest</dt>
        <dd>${Math.round(strongest * 100)}%</dd>
      </div>
    </dl>
    <ul class="neighbor-list">${neighborItems}</ul>
  `;
}

function renderForestPanel(component) {
  if (!component) {
    return;
  }

  const representative = forestRepresentativeForComponent(component);
  const forestColor = colorForComponent(component).getStyle();
  const memberCount = component.memberCountEstimate ?? component.nodes.length;
  const edgeCount = component.edgeCountEstimate ?? component.edges.length;
  const coreMembers = component.nodes.filter(member => visibleNodeIds.has(member.id));
  const topMembers = (coreMembers.length ? coreMembers : component.nodes)
    .sort((a, b) =>
      (b.visibleWeightSum ?? 0) - (a.visibleWeightSum ?? 0)
      || (b.visibleDegree ?? 0) - (a.visibleDegree ?? 0)
      || b.degree - a.degree
      || b.weightedDegree - a.weightedDegree
      || a.name.localeCompare(b.name)
    )
    .slice(0, 5);
  const memberItems = topMembers.map(member => `
    <li>
      <strong>${escapeHtml(member.name)}</strong>
      <span>${member.visibleDegree || member.degree}</span>
    </li>
  `).join('');

  memberPanel.innerHTML = `
    <p class="member-kicker">${memberCount === 1 ? 'Isolated forest' : 'Expanded forest'}</p>
    <div class="member-heading">
      <div class="avatar" style="background:${forestColor}">${escapeHtml(representative.initials || '?')}</div>
      <div>
        <h2>${escapeHtml(representative.name)}</h2>
        <p class="member-subtitle">${memberCount} members · ${edgeCount} links</p>
      </div>
    </div>
    <p class="member-headline">${escapeHtml(representative.headline || representative.statusText || 'Most connected member')}</p>
    <dl class="detail-grid">
      <div>
        <dt>Members</dt>
        <dd>${memberCount}</dd>
      </div>
      <div>
        <dt>Visible</dt>
        <dd>${visibleNodeIds.size}</dd>
      </div>
      <div>
        <dt>Core links</dt>
        <dd>${visibleEdgeCount}</dd>
      </div>
    </dl>
    <ul class="neighbor-list">${memberItems}</ul>
  `;
}

function handleWeightRangeInput(changedHandle) {
  normalizeWeightRange(changedHandle);
  rebuildEdges();
  renderMemberPanel(selectedNode);
  scheduleNodeRefit(130);
  if (activeComponentId !== null && !selectedNode) {
    scheduleLazyComponentLoad(activeComponentId, 120, { refresh: true });
  } else {
    scheduleLazyTileLoad(180, { refresh: true });
  }
  scheduleLazyNeighborhoodLoad(180);
}

function handleLinkDepthInput() {
  updateLinkDepthUi();
  rebuildEdges();
  renderMemberPanel(selectedNode);
  scheduleNodeRefit(120);
  scheduleLazyNeighborhoodLoad(120);
}

function handleKeyPan(event) {
  if (!event.key.startsWith('Arrow') || event.defaultPrevented || event.target?.closest?.('.control-panel')) {
    return;
  }

  const step = event.shiftKey ? 86 : 46;
  if (event.key === 'ArrowLeft') {
    panViewportByScreenDelta(-step, 0);
  } else if (event.key === 'ArrowRight') {
    panViewportByScreenDelta(step, 0);
  } else if (event.key === 'ArrowUp') {
    panViewportByScreenDelta(0, -step);
  } else if (event.key === 'ArrowDown') {
    panViewportByScreenDelta(0, step);
  } else {
    return;
  }

  event.preventDefault();
}

function normalizeWeightRange(changedHandle) {
  let minWeight = Number(minWeightInput.value);
  let maxWeight = Number(maxWeightInput.value);

  if (changedHandle === 'min' && minWeight > maxWeight) {
    maxWeight = minWeight;
    maxWeightInput.value = maxWeight.toFixed(2);
  }

  if (changedHandle === 'max' && maxWeight < minWeight) {
    minWeight = maxWeight;
    minWeightInput.value = minWeight.toFixed(2);
  }

  minWeightInput.style.zIndex = changedHandle === 'min' ? '4' : '2';
  maxWeightInput.style.zIndex = changedHandle === 'max' ? '4' : '3';
  updateWeightRangeUi({ min: minWeight, max: maxWeight });
}

function currentWeightRange() {
  return {
    min: Number(minWeightInput.value),
    max: Number(maxWeightInput.value)
  };
}

function updateWeightRangeUi(weightRange = currentWeightRange()) {
  const minWeight = clamp(weightRange.min, 0, 1);
  const maxWeight = clamp(weightRange.max, 0, 1);
  weightRangeValue.textContent = `${minWeight.toFixed(2)} - ${maxWeight.toFixed(2)}`;
  document.documentElement.style.setProperty('--range-min', String(minWeight * 100));
  document.documentElement.style.setProperty('--range-max', String(maxWeight * 100));
}

function isEdgeInWeightRange(edge, weightRange = currentWeightRange()) {
  return edge.weight >= weightRange.min && edge.weight <= weightRange.max;
}

function graphEdgeKey(source, target) {
  return source < target ? `${source}:${target}` : `${target}:${source}`;
}

function currentLinkDepth() {
  return Math.round(clamp(Number(linkDepthInput.value) || 1, 1, 3));
}

function updateCollapseBadgeCounts(thresholdEdges) {
  const thresholdDegree = new Map(nodes.map(node => [node.id, 0]));
  for (const edge of thresholdEdges) {
    thresholdDegree.set(edge.source, (thresholdDegree.get(edge.source) ?? 0) + 1);
    thresholdDegree.set(edge.target, (thresholdDegree.get(edge.target) ?? 0) + 1);
  }

  for (const node of nodes) {
    const hiddenLinks = Math.max(0, (thresholdDegree.get(node.id) ?? 0) - (node.visibleDegree ?? 0));
    const hiddenForestMembers = isForestOverview() ? 0 : Math.max(0, Number(node.forestMemberCount ?? 0) - 1);
    const nextCount = Math.trunc(Math.max(hiddenLinks, hiddenForestMembers));
    if (node.collapseBadgeCount === nextCount) {
      continue;
    }
    node.collapseBadgeCount = nextCount;
    refreshNodeBadge(node);
  }
}

function overviewNodeScore(node) {
  if (!node) {
    return 0;
  }
  const collapsed = Math.max(0, Number(node.forestMemberCount ?? 0) - 1);
  return (Number(node.centrality ?? 0) * 220)
    + (Number(node.weightedDegree ?? 0) * 3.5)
    + (Number(node.degree ?? 0) * 2.2)
    + (Math.sqrt(collapsed) * 5.5);
}

function updateLinkDepthUi() {
  const depth = currentLinkDepth();
  linkDepthInput.value = String(depth);
  linkDepthValue.textContent = depth === 1 ? 'Direct' : `${depth} hops`;
}

function updateControlVisibility() {
  const forestOverview = isForestOverview();
  const hasSelectedNode = Boolean(selectedNode);
  rangeField.hidden = forestOverview;
  depthField.hidden = forestOverview || !hasSelectedNode;
}

function isForestOverview() {
  return !selectedNode && activeComponentId === null && !fullGraphExpanded;
}

function pickNode(event) {
  const rect = canvas.getBoundingClientRect();
  const eventX = event.clientX - rect.left;
  const eventY = event.clientY - rect.top;
  let closestNode = null;
  let closestScore = Infinity;

  for (const node of nodes) {
    if (!node.badge?.visible || !visibleNodeIds.has(node.id)) {
      continue;
    }

    const projected = node.position.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) {
      continue;
    }

    const x = ((projected.x + 1) / 2) * rect.width;
    const y = ((1 - projected.y) / 2) * rect.height;
    const radius = projectedSpriteRadius(node.badge, node.position, rect);
    const distance = Math.hypot(eventX - x, eventY - y);
    if (distance > radius) {
      continue;
    }

    const score = distance / Math.max(1, radius);
    if (score < closestScore) {
      closestNode = node;
      closestScore = score;
    }
  }

  return closestNode;
}

function pickForest(event) {
  if (!isForestOverview()) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const eventX = event.clientX - rect.left;
  const eventY = event.clientY - rect.top;
  let closestComponent = null;
  let closestDistance = Infinity;

  for (const component of components) {
    if (!component.forestBadge?.visible || !component.forestPosition) {
      continue;
    }

    const projected = component.forestPosition.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) {
      continue;
    }

    const x = ((projected.x + 1) / 2) * rect.width;
    const y = ((1 - projected.y) / 2) * rect.height;
    const distance = Math.hypot(eventX - x, eventY - y);
    const pixelRadius = projectedSpriteRadius(component.forestBadge, component.forestPosition, rect, 18);

    if (distance <= pixelRadius && distance < closestDistance) {
      closestComponent = component;
      closestDistance = distance;
    }
  }

  return closestComponent;
}

function projectedSpriteRadius(sprite, position, rect, minimum = 12) {
  const worldDistance = camera.position.distanceTo(position);
  const fovRadians = THREE.MathUtils.degToRad(camera.fov);
  return Math.max(
    minimum,
    (sprite.scale.x * rect.height) / (4 * Math.tan(fovRadians / 2) * Math.max(0.001, worldDistance))
  );
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  applyViewportOffset();
}

function fitCamera(animateTarget) {
  if (isForestOverview() && components.every(component => component.forestPosition)) {
    fitCameraToForestOverview(animateTarget);
    return;
  }
  fitCameraToVisible(animateTarget);
}

function fitCameraToVisible(animateTarget) {
  const points = nodes
    .filter(node => visibleNodeIds.has(node.id))
    .map(node => node.position);
  fitCameraToPoints(points.length ? points : nodes.map(node => node.position), animateTarget);
}

function fitCameraToVisibleTargets(animateTarget) {
  const points = nodes
    .filter(node => visibleNodeIds.has(node.id))
    .map(node => node.targetPosition ?? node.position);
  fitCameraToPoints(points.length ? points : nodes.map(node => node.position), animateTarget);
}

function fitCameraToForestOverview(animateTarget) {
  const forestComponents = sortedForestComponents();
  const center = forestComponents[0]?.forestPosition?.clone() ?? new THREE.Vector3();
  const radius = forestComponents.reduce((maxRadius, component) => {
    const position = component.forestPosition ?? center;
    const badgeRadius = (component.forestScale ?? 5) * 0.55;
    return Math.max(maxRadius, position.distanceTo(center) + badgeRadius);
  }, 8);
  fitCameraToCenterRadius(center, radius, animateTarget);
}

function fitCameraToPoints(points, animateTarget) {
  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  fitCameraToCenterRadius(center, sphere.radius, animateTarget);
}

function fitCameraToCenterRadius(center, radius, animateTarget) {
  const viewport = graphViewportMetrics();
  const safeWidthRatio = clamp(viewport.safeWidth / Math.max(1, viewport.fullWidth), 0.58, 1);
  const distance = Math.max(48, (radius * 1.68) / safeWidthRatio);
  const target = center.clone();
  const targetPosition = target.clone().add(new THREE.Vector3(distance * 0.24, distance * 0.34, distance));
  viewportPanOffset.x = 0;
  viewportPanOffset.y = 0;
  applyViewportOffset(viewport);
  if (animateTarget) {
    startCameraAnimation(targetPosition, target);
    return;
  }
  cameraAnimation = null;
  camera.position.copy(targetPosition);
  controls.target.copy(target);
  controls.update();
}

function applyViewportOffset(viewport = graphViewportMetrics()) {
  const width = Math.max(1, Math.round(viewport.fullWidth));
  const height = Math.max(1, Math.round(viewport.fullHeight));
  const offsetX = Math.round(viewport.centerOffsetPx + viewportPanOffset.x);
  const offsetY = Math.round(viewportPanOffset.y);

  if (Math.abs(offsetX) > 1 || Math.abs(offsetY) > 1) {
    camera.setViewOffset(width, height, offsetX, offsetY, width, height);
  } else {
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
}

function graphViewportMetrics() {
  const rect = canvas.getBoundingClientRect();
  let safeLeft = rect.left;
  let safeRight = rect.right;
  const panelRect = controlPanel?.getBoundingClientRect();
  const isSidePanel = panelRect
    && panelRect.left > rect.left + rect.width * 0.45
    && panelRect.width < rect.width * 0.5;

  if (isSidePanel) {
    safeRight = Math.max(rect.left + rect.width * 0.52, panelRect.left - 26);
  }

  const safeWidth = Math.max(1, safeRight - safeLeft);
  const fullCenterX = rect.left + rect.width / 2;
  const safeCenterX = safeLeft + safeWidth / 2;
  return {
    fullWidth: Math.max(1, rect.width),
    fullHeight: Math.max(1, rect.height),
    safeWidth,
    centerOffsetPx: fullCenterX - safeCenterX
  };
}

function panViewportByScreenDelta(deltaX, deltaY) {
  cameraAnimation = null;
  const viewport = graphViewportMetrics();
  viewportPanOffset.x = clamp(
    viewportPanOffset.x - deltaX,
    -viewport.fullWidth * 0.42,
    viewport.fullWidth * 0.42
  );
  viewportPanOffset.y = clamp(
    viewportPanOffset.y - deltaY,
    -viewport.fullHeight * 0.34,
    viewport.fullHeight * 0.34
  );
  applyViewportOffset(viewport);
  controls.update();
  publishPreviewState();
  scheduleLazyTileLoad(220);
}

function scheduleLazyTileLoad(delayMs = 180, options = {}) {
  if (!GRAPH_LAZY_ENABLED || isForestOverview()) {
    return;
  }
  if (lazyTileTimer) {
    clearTimeout(lazyTileTimer);
  }
  lazyTileTimer = setTimeout(() => {
    lazyTileTimer = null;
    void loadLazyTile(options);
  }, delayMs);
}

function scheduleLazyComponentLoad(componentId, delayMs = 120, options = {}) {
  if (!GRAPH_LAZY_ENABLED || !componentId) {
    return;
  }
  setTimeout(() => {
    void loadLazyComponent(componentId, options);
  }, delayMs);
}

async function loadLazyComponent(componentId, options = {}) {
  if (!GRAPH_LAZY_ENABLED || !componentForId(componentId)) {
    return;
  }
  const weightRange = currentWeightRange();
  const cacheKey = `${componentId}:${weightRange.min.toFixed(2)}:${weightRange.max.toFixed(2)}`;
  if (!options.refresh && (loadedComponentKeys.has(cacheKey) || pendingComponentKeys.has(cacheKey))) {
    return;
  }
  pendingComponentKeys.add(cacheKey);
  try {
    const result = await requestGraphData('tile', {
      layoutVersion: GRAPH_LAYOUT_VERSION,
      z: 0,
      x: 0,
      y: 0,
      minWeight: weightRange.min,
      maxWeight: weightRange.max,
      componentId
    });
    loadedComponentKeys.add(cacheKey);
    mergeGraphPayload(result);
    if (activeComponentId === componentId && !selectedNode) {
      rebuildEdges();
      renderMemberPanel(null);
      scheduleNodeRefit(60);
      fitCameraToVisibleTargets(true);
    }
  } catch {
    loadedComponentKeys.delete(cacheKey);
  } finally {
    pendingComponentKeys.delete(cacheKey);
  }
}

async function loadLazyTile(options = {}) {
  if (!GRAPH_LAZY_ENABLED || isForestOverview()) {
    return;
  }
  const request = tileRequestForCurrentView();
  const cacheKey = `${request.z}:${request.x}:${request.y}:${request.componentId ?? '*'}`;
  if (!options.refresh && (loadedTileKeys.has(cacheKey) || pendingTileKeys.has(cacheKey))) {
    return;
  }
  pendingTileKeys.add(cacheKey);
  const serial = ++lazyTileRequestSerial;
  try {
    const result = await requestGraphData('tile', request);
    if (serial < lazyTileRequestSerial - 8) {
      return;
    }
    loadedTileKeys.add(cacheKey);
    mergeGraphPayload(result);
  } catch {
    // Keep the current graph steady if the tile bridge is unavailable.
  } finally {
    pendingTileKeys.delete(cacheKey);
  }
}

function scheduleLazyNeighborhoodLoad(delayMs = 140) {
  if (!GRAPH_LAZY_ENABLED || !selectedNode) {
    return;
  }
  setTimeout(() => {
    void loadLazyNeighborhood();
  }, delayMs);
}

async function loadLazyNeighborhood() {
  if (!GRAPH_LAZY_ENABLED || !selectedNode) {
    return;
  }
  const weightRange = currentWeightRange();
  const key = `${selectedNode.id}:${currentLinkDepth()}:${weightRange.min.toFixed(2)}:${weightRange.max.toFixed(2)}`;
  if (loadedNeighborhoodKeys.has(key)) {
    return;
  }
  loadedNeighborhoodKeys.add(key);
  try {
    const result = await requestGraphData('neighborhood', {
      userId: selectedNode.id,
      depth: currentLinkDepth(),
      minWeight: weightRange.min,
      maxWeight: weightRange.max
    });
    mergeGraphPayload(result);
    rebuildEdges();
    renderMemberPanel(selectedNode);
    scheduleNodeRefit(80);
  } catch {
    loadedNeighborhoodKeys.delete(key);
  }
}

function tileRequestForCurrentView() {
  const target = controls.target.clone().add(serverPositionCenter);
  const distance = camera.position.distanceTo(controls.target);
  const zoom = Math.round(clamp(6 - distance / 26, 0, 6));
  const tiles = 1 << zoom;
  const x = Math.floor(clamp((target.x + 620) / 1240, 0, 0.999999) * tiles);
  const y = Math.floor(clamp((target.z + 620) / 1240, 0, 0.999999) * tiles);
  const weightRange = currentWeightRange();
  return {
    layoutVersion: GRAPH_LAYOUT_VERSION,
    z: zoom,
    x,
    y,
    minWeight: weightRange.min,
    maxWeight: weightRange.max,
    componentId: activeComponentId ?? undefined
  };
}

async function requestGraphData(method, params = {}) {
  if (!window.parent || window.parent === window) {
    throw new Error('Affinity graph bridge is unavailable.');
  }
  const requestId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Affinity graph request timed out.'));
    }, 8000);
    const onMessage = event => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data;
      if (data?.source !== 'admin-affinity-graph' || data.type !== 'response' || data.requestId !== requestId) {
        return;
      }
      clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      if (data.ok) {
        resolve(data.result);
      } else {
        reject(new Error(data.error || 'Affinity graph request failed.'));
      }
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({
      source: 'admin-affinity-graph',
      type: 'request',
      requestId,
      method,
      params
    }, window.location.origin);
  });
}

function mergeGraphPayload(payload) {
  const nextGraph = normalizeGraphData(payload);
  let changed = false;
  for (const node of nextGraph.nodes) {
    changed = mergeGraphNode(node) || changed;
  }
  for (const edge of nextGraph.edges) {
    changed = mergeGraphEdge(edge) || changed;
  }
  if (!changed) {
    return;
  }
  enrichComponents(components, edges);
  rebuildEdges();
  applyNodeState();
  memberCountEl.textContent = String(nodes.length);
  linkCountEl.textContent = String(edges.length);
  componentCountEl.textContent = String(components.length);
  isolatedCountEl.textContent = String(nodes.filter(node => node.degree === 0).length);
  publishPreviewState();
}

function mergeGraphNode(node) {
  const existing = nodeById.get(node.id);
  if (existing) {
    const before = nodeDataSignature(existing);
    const beforeVisual = nodeVisualSignature(existing);
    const previousComponentId = existing.componentId;
    existing.name = node.name || existing.name;
    existing.initials = node.initials || existing.initials;
    existing.gender = node.gender || existing.gender;
    existing.city = node.city || existing.city;
    existing.age = node.age ?? existing.age;
    existing.headline = node.headline || existing.headline;
    existing.traitLabel = node.traitLabel || existing.traitLabel;
    existing.statusText = node.statusText || existing.statusText;
    existing.profileStatus = node.profileStatus || existing.profileStatus;
    existing.image = node.image || existing.image;
    existing.images = node.images?.length ? node.images : existing.images;
    const nextComponentId = node.componentId ?? existing.componentId;
    existing.degree = Math.max(existing.degree ?? 0, Number(node.degree ?? 0));
    existing.weightedDegree = Math.max(existing.weightedDegree ?? 0, Number(node.weightedDegree ?? 0));
    existing.forestMemberCount = Math.max(existing.forestMemberCount ?? 0, Number(node.forestMemberCount ?? 0)) || existing.forestMemberCount;
    existing.forestEdgeCount = Math.max(existing.forestEdgeCount ?? 0, Number(node.forestEdgeCount ?? 0)) || existing.forestEdgeCount;
    setNodeComponent(existing, nextComponentId, previousComponentId);
    if (hasServerPosition(node)) {
      existing.homePosition = serverPositionForNode(node);
      if (!visibleNodeIds.has(existing.id)) {
        existing.position.copy(existing.homePosition);
      }
      existing.targetPosition.copy(existing.homePosition);
    }
    if (nodeVisualSignature(existing) !== beforeVisual) {
      refreshNodeBadge(existing);
    }
    return nodeDataSignature(existing) !== before;
  }

  const graphNode = {
    ...node,
    visibleDegree: 0,
    visibleWeightSum: 0,
    visibleStrongest: 0,
    radius: 1.4,
    position: hasServerPosition(node) ? serverPositionForNode(node) : fallbackPositionForNode(node)
  };
  graphNode.homePosition = graphNode.position.clone();
  graphNode.targetPosition = graphNode.position.clone();
  nodeById.set(graphNode.id, graphNode);
  nodes.push(graphNode);
  adjacency.set(graphNode.id, []);
  setNodeComponent(graphNode, graphNode.componentId);
  createNodeBadge(graphNode);
  return true;
}

function mergeGraphEdge(edge) {
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  if (!source || !target) {
    return false;
  }
  const key = graphEdgeKey(edge.source, edge.target);
  if (edgeKeys.has(key)) {
    return false;
  }
  edgeKeys.add(key);
  edges.push(edge);
  adjacency.get(edge.source)?.push({ edge, other: target });
  adjacency.get(edge.target)?.push({ edge, other: source });
  const component = componentForId(source.componentId);
  component?.edges?.push(edge);
  return true;
}

function ensureComponentForNode(node) {
  const componentId = node.componentId ?? `isolated:${node.id}`;
  node.componentId = componentId;
  let component = componentForId(componentId);
  if (!component) {
    component = { id: componentId, nodes: [], edges: [], representative: node };
    components.push(component);
    componentById.set(String(componentId), component);
  }
  if (!component.nodes.some(item => item.id === node.id)) {
    component.nodes.push(node);
  }
}

function setNodeComponent(node, nextComponentId, previousComponentId = node.componentId) {
  const componentId = nextComponentId ?? `isolated:${node.id}`;
  if (previousComponentId !== null && previousComponentId !== undefined && String(previousComponentId) !== String(componentId)) {
    const previousComponent = componentForId(previousComponentId);
    if (previousComponent) {
      previousComponent.nodes = previousComponent.nodes.filter(item => item.id !== node.id);
    }
  }
  node.componentId = componentId;
  ensureComponentForNode(node);
}

function serverPositionForNode(node) {
  return new THREE.Vector3(
    Number(node.x ?? 0) - serverPositionCenter.x,
    Number(node.y ?? 0) - serverPositionCenter.y,
    Number(node.z ?? 0) - serverPositionCenter.z
  );
}

function fallbackPositionForNode(node) {
  const component = componentForId(node.componentId);
  if (component?.nodes?.length) {
    const center = new THREE.Vector3();
    for (const item of component.nodes) {
      center.add(item.homePosition ?? item.position ?? new THREE.Vector3());
    }
    center.multiplyScalar(1 / component.nodes.length);
    const radius = Math.max(5, Math.sqrt(component.memberCountEstimate ?? component.nodes.length + 1) * 2.65);
    return center.addScaledVector(seededVector(node.id), radius);
  }
  return seededVector(node.id).multiplyScalar(16);
}

function animate() {
  requestAnimationFrame(animate);
  updateNodeLayoutAnimation();
  updateCameraAnimation();
  updateSelectionVisualAnimation();
  controls.update();
  renderer.render(scene, camera);
}

function startCameraAnimation(targetPosition, targetLookAt) {
  cameraAnimation = {
    startedAt: performance.now(),
    durationMs: 720,
    fromPosition: camera.position.clone(),
    toPosition: targetPosition.clone(),
    fromTarget: controls.target.clone(),
    toTarget: targetLookAt.clone()
  };
}

function updateCameraAnimation() {
  if (!cameraAnimation) {
    return;
  }
  const elapsed = performance.now() - cameraAnimation.startedAt;
  const progress = clamp(elapsed / cameraAnimation.durationMs, 0, 1);
  const eased = easeOutCubic(progress);
  camera.position.copy(cameraAnimation.fromPosition).lerp(cameraAnimation.toPosition, eased);
  controls.target.copy(cameraAnimation.fromTarget).lerp(cameraAnimation.toTarget, eased);
  if (progress >= 1) {
    cameraAnimation = null;
  }
}

function startSelectionVisualAnimation(startScale) {
  if (!selectedNode) {
    stopSelectionVisualAnimation();
    return;
  }

  const endScale = selectedNode.badgeScale * 1.46;
  selectionVisualAnimation = {
    type: 'select',
    node: selectedNode,
    startedAt: performance.now(),
    durationMs: 520,
    startScale,
    endScale,
    startRingScale: Math.max(startScale * 1.03, selectedNode.badgeScale * 0.72),
    endRingScale: selectedNode.badgeScale * 1.42,
    startRingOpacity: 0,
    endRingOpacity: 0.92
  };
  selectedNode.badge.scale.setScalar(startScale);
  selectionSprite.visible = true;
  selectionSprite.position.copy(selectedNode.position);
  selectionSprite.scale.setScalar(selectionVisualAnimation.startRingScale);
  selectionSprite.material.opacity = 0;
}

function startDeselectionVisualAnimation(node, startScale, startRingScale, startRingOpacity) {
  if (!node?.badge?.visible) {
    stopSelectionVisualAnimation();
    return;
  }

  const endScale = node.badge.scale.x;
  selectionVisualAnimation = {
    type: 'deselect',
    node,
    startedAt: performance.now(),
    durationMs: 460,
    startScale,
    endScale,
    startRingScale: Math.max(startRingScale, startScale * 0.98),
    endRingScale: Math.max(endScale * 1.05, node.badgeScale * 0.72),
    startRingOpacity: clamp(startRingOpacity, 0, 0.92),
    endRingOpacity: 0
  };
  node.badge.scale.setScalar(selectionVisualAnimation.startScale);
  selectionSprite.visible = true;
  selectionSprite.position.copy(node.position);
  selectionSprite.scale.setScalar(selectionVisualAnimation.startRingScale);
  selectionSprite.material.opacity = selectionVisualAnimation.startRingOpacity;
}

function stopSelectionVisualAnimation() {
  selectionVisualAnimation = null;
  selectionSprite.material.opacity = 0.92;
  if (!selectedNode) {
    selectionSprite.visible = false;
  }
}

function updateSelectionVisualAnimation() {
  if (!selectionVisualAnimation) {
    return;
  }
  const animatedNode = selectionVisualAnimation.node;
  if (!animatedNode?.badge || (selectionVisualAnimation.type === 'select' && animatedNode !== selectedNode)) {
    stopSelectionVisualAnimation();
    return;
  }

  const elapsed = performance.now() - selectionVisualAnimation.startedAt;
  const progress = clamp(elapsed / selectionVisualAnimation.durationMs, 0, 1);
  const eased = easeOutCubic(progress);
  const pulse = selectionVisualAnimation.type === 'select' ? Math.sin(progress * Math.PI) : 0;
  const badgeScale = THREE.MathUtils.lerp(
    selectionVisualAnimation.startScale,
    selectionVisualAnimation.endScale,
    eased
  ) + animatedNode.badgeScale * pulse * 0.055;
  const ringScale = THREE.MathUtils.lerp(
    selectionVisualAnimation.startRingScale,
    selectionVisualAnimation.endRingScale,
    eased
  ) + animatedNode.badgeScale * pulse * 0.04;
  const ringOpacity = THREE.MathUtils.lerp(
    selectionVisualAnimation.startRingOpacity,
    selectionVisualAnimation.endRingOpacity,
    eased
  );

  animatedNode.badge.scale.setScalar(badgeScale);
  selectionSprite.visible = true;
  selectionSprite.position.copy(animatedNode.position);
  selectionSprite.scale.setScalar(ringScale);
  selectionSprite.material.opacity = ringOpacity;

  if (progress >= 1) {
    animatedNode.badge.scale.setScalar(selectionVisualAnimation.endScale);
    selectionSprite.scale.setScalar(selectionVisualAnimation.endRingScale);
    selectionSprite.material.opacity = selectionVisualAnimation.endRingOpacity;
    selectionSprite.visible = selectionVisualAnimation.type === 'select';
    selectionVisualAnimation = null;
  }
}

function scheduleNodeRefit(delayMs = 100) {
  if (nodeRefitTimer) {
    clearTimeout(nodeRefitTimer);
  }
  nodeRefitTimer = setTimeout(() => {
    nodeRefitTimer = null;
    refitVisibleNodes({ immediate: false });
  }, delayMs);
}

function refitVisibleNodes({ immediate = false } = {}) {
  const targets = layoutTargetsForCurrentView();
  for (const node of nodes) {
    node.targetPosition = targets.get(node.id) ?? node.homePosition;
  }
  if (immediate) {
    nodeLayoutAnimation = null;
    for (const node of nodes) {
      node.position.copy(node.targetPosition);
    }
    syncGraphObjects();
    return;
  }
  nodeLayoutAnimation = {
    startedAt: performance.now(),
    durationMs: 620,
    from: new Map(nodes.map(node => [node.id, node.position.clone()]))
  };
}

function updateNodeLayoutAnimation() {
  if (!nodeLayoutAnimation) {
    return;
  }
  const elapsed = performance.now() - nodeLayoutAnimation.startedAt;
  const progress = clamp(elapsed / nodeLayoutAnimation.durationMs, 0, 1);
  const eased = easeOutCubic(progress);
  for (const node of nodes) {
    const start = nodeLayoutAnimation.from.get(node.id) ?? node.position;
    node.position.copy(start).lerp(node.targetPosition, eased);
  }
  syncGraphObjects();
  if (progress >= 1) {
    nodeLayoutAnimation = null;
  }
}

function syncGraphObjects() {
  for (const node of nodes) {
    node.badge?.position.copy(node.position);
  }
  if (selectedNode && selectionSprite.visible) {
    selectionSprite.position.copy(selectedNode.position);
  }
  updateEdgeLinePositions(edgeMesh);
  updateEdgeLinePositions(selectedLinkLines);
}

function updateEdgeLinePositions(lineObject) {
  if (!lineObject?.geometry?.attributes?.position || !Array.isArray(lineObject.userData?.edges)) {
    return;
  }
  const positions = lineObject.geometry.attributes.position.array;
  lineObject.userData.edges.forEach((edge, index) => {
    const source = nodeById.get(edge.source).position;
    const target = nodeById.get(edge.target).position;
    const offset = index * 6;
    positions.set([source.x, source.y, source.z, target.x, target.y, target.z], offset);
  });
  lineObject.geometry.attributes.position.needsUpdate = true;
  lineObject.geometry.computeBoundingSphere();
}

function layoutTargetsForCurrentView() {
  if (selectedNode) {
    return selectedNodeLayoutTargets();
  }
  if (fullGraphExpanded) {
    return forestLayoutTargets();
  }
  if (activeComponentId !== null) {
    return activeComponentLayoutTargets();
  }
  return new Map(nodes.map(node => [node.id, node.homePosition.clone()]));
}

function selectedNodeLayoutTargets() {
  const targets = new Map(nodes.map(node => [node.id, node.position.clone()]));
  const basis = viewBasis();
  const center = safeLayoutCenterForCamera();
  if (!visibleEdges.length) {
    targets.set(selectedNode.id, center.clone());
    return targets;
  }

  targets.set(selectedNode.id, center.clone());

  const strengthByNode = new Map();
  const visibleWeightByNode = new Map();
  for (const edge of visibleEdges) {
    strengthByNode.set(edge.source, Math.max(strengthByNode.get(edge.source) ?? 0, edge.weight));
    strengthByNode.set(edge.target, Math.max(strengthByNode.get(edge.target) ?? 0, edge.weight));
    visibleWeightByNode.set(edge.source, (visibleWeightByNode.get(edge.source) ?? 0) + edge.weight);
    visibleWeightByNode.set(edge.target, (visibleWeightByNode.get(edge.target) ?? 0) + edge.weight);
  }
  const maxVisibleWeight = Math.max(1, ...visibleWeightByNode.values());

  const depthGroups = new Map();
  for (const node of nodes) {
    if (node === selectedNode || !visibleNodeIds.has(node.id)) {
      continue;
    }
    const depth = clamp(Math.round(visibleNodeDepths.get(node.id) ?? 1), 1, currentLinkDepth());
    const strength = clamp(
      ((strengthByNode.get(node.id) ?? 0) * 0.58) + (((visibleWeightByNode.get(node.id) ?? 0) / maxVisibleWeight) * 0.42),
      0,
      1
    );
    if (!depthGroups.has(depth)) {
      depthGroups.set(depth, []);
    }
    depthGroups.get(depth).push({
      node,
      strength
    });
  }

  const placeOnShell = (item, index, count, radius) => {
    const point = sphereShellPoint(index, count, item.node.id);
    const target = center.clone()
      .addScaledVector(basis.right, point.x * radius)
      .addScaledVector(basis.up, point.y * radius)
      .addScaledVector(basis.forward, point.z * radius);
    targets.set(item.node.id, target);
  };
  const fallbackDirection = (node, index, count) => {
    const point = sphereShellPoint(index, count, `${node.id}:fallback`);
    return new THREE.Vector3()
      .addScaledVector(basis.right, point.x)
      .addScaledVector(basis.up, point.y)
      .addScaledVector(basis.forward, point.z)
      .normalize();
  };
  const previousHopDirection = (node, depth, fallbackIndex, fallbackCount) => {
    const direction = new THREE.Vector3();
    for (const edge of visibleEdges) {
      if (edge.source !== node.id && edge.target !== node.id) {
        continue;
      }
      const otherId = edge.source === node.id ? edge.target : edge.source;
      if ((visibleNodeDepths.get(otherId) ?? 0) !== depth - 1) {
        continue;
      }

      const otherTarget = targets.get(otherId);
      if (otherTarget) {
        direction.add(otherTarget.clone().normalize().multiplyScalar(edge.weight));
      }
    }

    if (direction.lengthSq() < 0.0001) {
      return fallbackDirection(node, fallbackIndex, fallbackCount);
    }
    return direction.normalize();
  };
  const spreadFromDirection = (direction, node, index, count) => {
    if (count <= 1) {
      return direction;
    }
    const shellDirection = fallbackDirection(node, index, count);
    const tangent = shellDirection.sub(direction.clone().multiplyScalar(shellDirection.dot(direction)));
    if (tangent.lengthSq() < 0.0001) {
      tangent.copy(basis.up).sub(direction.clone().multiplyScalar(basis.up.dot(direction)));
    }
    if (tangent.lengthSq() < 0.0001) {
      tangent.copy(basis.right).sub(direction.clone().multiplyScalar(basis.right.dot(direction)));
    }
    if (tangent.lengthSq() < 0.0001) {
      return direction;
    }
    const spread = 0.28 + Math.min(0.24, Math.sqrt(count) * 0.028);
    return direction.clone().add(tangent.normalize().multiplyScalar(spread)).normalize();
  };

  const innerItems = shellSortedItems(depthGroups.get(1) ?? []);
  innerItems.forEach((item, index) => {
    const radius = 14 + Math.sqrt(innerItems.length) * 0.78 + (1 - item.strength) * 2.2;
    placeOnShell(item, index, innerItems.length, radius);
  });

  for (let depth = 2; depth <= currentLinkDepth(); depth += 1) {
    const group = shellSortedItems(depthGroups.get(depth) ?? []);
    group.forEach((item, index) => {
      const parentDirection = previousHopDirection(item.node, depth, index, group.length);
      const direction = spreadFromDirection(parentDirection, item.node, index, group.length);
      const radius = 27 + Math.sqrt(group.length) * 1.04 + (depth - 2) * 12 + (1 - item.strength) * 2.4;
      targets.set(item.node.id, center.clone().addScaledVector(direction, radius));
    });
  }

  return targets;
}

function shellSortedItems(items) {
  return [...items].sort((a, b) => shellSortValue(a.node.id) - shellSortValue(b.node.id));
}

function safeLayoutCenterForCamera() {
  return controls.target.clone();
}

function activeComponentLayoutTargets() {
  const targets = new Map(nodes.map(node => [node.id, node.position.clone()]));
  const componentNodes = nodes
    .filter(node => visibleNodeIds.has(node.id))
    .map(node => ({
      id: node.id,
      position: new THREE.Vector3(),
      weightedDegree: node.visibleWeightSum || node.weightedDegree || 0
    }));
  if (!componentNodes.length) {
    return targets;
  }

  const center = safeLayoutCenterForCamera();
  if (componentNodes.length === 1) {
    targets.set(componentNodes[0].id, center.clone());
    return targets;
  }

  runForceLayout(componentNodes, visibleEdges, center);
  for (const layoutNode of componentNodes) {
    targets.set(layoutNode.id, layoutNode.position.clone());
  }
  return targets;
}

function forestLayoutTargets() {
  const layoutNodes = nodes.map(node => ({
    id: node.id,
    position: new THREE.Vector3(),
    weightedDegree: node.weightedDegree
  }));
  const layoutNodeById = new Map(layoutNodes.map(node => [node.id, node]));
  const layoutComponents = buildLayoutComponents(layoutNodes, visibleEdges);
  const sortedComponents = layoutComponents.sort((a, b) => b.length - a.length);
  const mainRadius = 13 + Math.sqrt(sortedComponents[0]?.length ?? 1) * 1.9;

  sortedComponents.forEach((componentNodes, index) => {
    let center = new THREE.Vector3();
    if (index > 0) {
      const angle = ((index - 1) / Math.max(1, sortedComponents.length - 1)) * Math.PI * 2;
      const radius = mainRadius + 12;
      center = new THREE.Vector3(
        Math.cos(angle) * radius,
        ((index % 2) - 0.5) * 10,
        Math.sin(angle) * radius
      );
    }
    if (componentNodes.length === 1) {
      componentNodes[0].position.copy(center);
      return;
    }
    const componentIds = new Set(componentNodes.map(node => node.id));
    const componentEdges = visibleEdges.filter(edge => componentIds.has(edge.source) && componentIds.has(edge.target));
    runForceLayout(componentNodes, componentEdges, center);
  });

  const targets = new Map();
  for (const node of nodes) {
    targets.set(node.id, layoutNodeById.get(node.id)?.position.clone() ?? node.homePosition.clone());
  }
  return targets;
}

function buildLayoutComponents(layoutNodes, layoutEdges) {
  const parent = new Map(layoutNodes.map(node => [node.id, node.id]));
  const find = id => {
    const parentId = parent.get(id);
    if (parentId === id) {
      return id;
    }
    const root = find(parentId);
    parent.set(id, root);
    return root;
  };
  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  };
  for (const edge of layoutEdges) {
    union(edge.source, edge.target);
  }
  const groups = new Map();
  for (const node of layoutNodes) {
    const root = find(node.id);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root).push(node);
  }
  return [...groups.values()];
}

function viewBasis() {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  return { right, up, forward };
}

function placeNodes(allNodes, allEdges, allComponents) {
  if (allNodes.some(node => hasServerPosition(node))) {
    const center = new THREE.Vector3();
    let positionedCount = 0;
    for (const node of allNodes) {
      if (hasServerPosition(node)) {
        center.add(new THREE.Vector3(node.x, node.y, node.z));
        positionedCount += 1;
      }
    }
    if (positionedCount > 0) {
      center.multiplyScalar(1 / positionedCount);
    }
    serverPositionCenter = center.clone();
    for (const node of allNodes) {
      if (hasServerPosition(node)) {
        node.position.set(node.x - center.x, node.y - center.y, node.z - center.z);
      }
    }
    for (const component of allComponents) {
      const positionedNodes = component.nodes.filter(node => hasServerPosition(node));
      const componentCenter = new THREE.Vector3();
      if (positionedNodes.length) {
        for (const node of positionedNodes) {
          componentCenter.add(node.position);
        }
        componentCenter.multiplyScalar(1 / positionedNodes.length);
      } else {
        componentCenter.copy(seededVector(String(component.id)).multiplyScalar(18));
      }

      const unpositionedNodes = component.nodes.filter(node => !hasServerPosition(node));
      const radius = Math.max(5, Math.sqrt(component.memberCountEstimate ?? component.nodes.length) * 2.65);
      unpositionedNodes.forEach((node, index) => {
        const direction = sphereShellPoint(index, unpositionedNodes.length, node.id);
        node.position.copy(componentCenter).addScaledVector(direction, radius);
      });
    }
    return;
  }

  const sortedComponents = [...allComponents].sort((a, b) => b.nodes.length - a.nodes.length);
  const componentCenterById = new Map();
  const mainRadius = 14 + Math.sqrt(sortedComponents[0]?.nodes.length ?? 1) * 2;
  sortedComponents.forEach((component, index) => {
    if (index === 0) {
      componentCenterById.set(component.id, new THREE.Vector3(0, 0, 0));
      return;
    }
    const angle = ((index - 1) / Math.max(1, sortedComponents.length - 1)) * Math.PI * 2;
    const radius = mainRadius + 13;
    componentCenterById.set(component.id, new THREE.Vector3(
      Math.cos(angle) * radius,
      ((index % 2) - 0.5) * 16,
      Math.sin(angle) * radius
    ));
  });

  const edgeByComponent = new Map(allComponents.map(component => [component.id, []]));
  for (const edge of allEdges) {
    const componentId = nodeById.get(edge.source)?.componentId;
    if (componentId !== undefined) {
      edgeByComponent.get(componentId)?.push(edge);
    }
  }

  for (const component of allComponents) {
    const center = componentCenterById.get(component.id) ?? new THREE.Vector3();
    if (component.nodes.length === 1) {
      component.nodes[0].position.copy(center);
      continue;
    }
    runForceLayout(component.nodes, edgeByComponent.get(component.id) ?? [], center);
  }
}

function runForceLayout(componentNodes, componentEdges, center) {
  const positions = new Map();
  const velocities = new Map();
  const count = componentNodes.length;
  const initialRadius = 7 + Math.sqrt(count) * 2.1;
  componentNodes.forEach((node, index) => {
    const point = fibonacciPoint(index, count).multiplyScalar(initialRadius);
    const jitter = seededVector(node.id).multiplyScalar(2.8);
    positions.set(node.id, point.add(jitter));
    velocities.set(node.id, new THREE.Vector3());
  });

  const layoutEdges = componentEdges
    .filter(edge => edge.weight >= 0.18)
    .sort((a, b) => b.weight - a.weight);

  for (let step = 0; step < 460; step += 1) {
    const cooling = 1 - step / 460;
    for (let i = 0; i < count; i += 1) {
      const a = componentNodes[i];
      const posA = positions.get(a.id);
      const velA = velocities.get(a.id);
      for (let j = i + 1; j < count; j += 1) {
        const b = componentNodes[j];
        const posB = positions.get(b.id);
        const delta = posA.clone().sub(posB);
        const distanceSq = Math.max(7, delta.lengthSq());
        const force = Math.min(0.46, 58 / distanceSq) * cooling;
        delta.normalize().multiplyScalar(force);
        velA.add(delta);
        velocities.get(b.id).sub(delta);
      }
    }

    for (const edge of layoutEdges) {
      const posA = positions.get(edge.source);
      const posB = positions.get(edge.target);
      if (!posA || !posB) {
        continue;
      }
      const delta = posB.clone().sub(posA);
      const distance = Math.max(0.01, delta.length());
      const desired = 6 + (1 - edge.weight) * 14;
      const force = (distance - desired) * (0.0032 + edge.weight * 0.009);
      delta.normalize().multiplyScalar(force);
      velocities.get(edge.source).add(delta);
      velocities.get(edge.target).sub(delta);
    }

    for (const node of componentNodes) {
      const position = positions.get(node.id);
      const velocity = velocities.get(node.id);
      velocity.add(position.clone().multiplyScalar(-0.006));
      position.add(velocity.multiplyScalar(0.82));
      velocity.multiplyScalar(0.64);
    }
  }

  for (const node of componentNodes) {
    node.position.copy(positions.get(node.id).add(center));
  }
}

function buildComponents(allNodes, allEdges) {
  const explicitComponentNodes = allNodes.filter(node => node.componentId !== null && node.componentId !== undefined && String(node.componentId).trim() !== '');
  if (explicitComponentNodes.length) {
    const groups = new Map();
    for (const node of allNodes) {
      const componentId = String(node.componentId ?? `isolated:${node.id}`).trim();
      node.componentId = componentId;
      if (!groups.has(componentId)) {
        groups.set(componentId, []);
      }
      groups.get(componentId).push(node);
    }
    return [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0])))
      .map(([id, componentNodes]) => ({ id, nodes: componentNodes }));
  }

  const parent = new Map(allNodes.map(node => [node.id, node.id]));
  const find = id => {
    const parentId = parent.get(id);
    if (parentId === id) {
      return id;
    }
    const root = find(parentId);
    parent.set(id, root);
    return root;
  };
  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  };
  for (const edge of allEdges) {
    union(edge.source, edge.target);
  }

  const groups = new Map();
  for (const node of allNodes) {
    const root = find(node.id);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root).push(node);
  }

  return [...groups.values()]
    .sort((a, b) => b.length - a.length)
    .map((componentNodes, index) => {
      for (const node of componentNodes) {
        node.componentId = index;
      }
      return { id: index, nodes: componentNodes };
    });
}

function enrichComponents(allComponents, allEdges) {
  const edgesByComponent = new Map(allComponents.map(component => [component.id, []]));
  for (const edge of allEdges) {
    const componentId = nodeById.get(edge.source)?.componentId;
    edgesByComponent.get(componentId)?.push(edge);
  }

  for (const component of allComponents) {
    component.edges = edgesByComponent.get(component.id) ?? [];
    const representative = [...component.nodes]
      .sort((a, b) => b.degree - a.degree || b.weightedDegree - a.weightedDegree || a.name.localeCompare(b.name))[0];
    component.representative = representative;
    component.forestRepresentative = [...component.nodes]
      .filter(node => Number(node.forestMemberCount ?? 0) > 0 || Number(node.forestEdgeCount ?? 0) > 0)
      .sort((a, b) =>
        Number(b.forestMemberCount ?? 0) - Number(a.forestMemberCount ?? 0)
        || Number(b.forestEdgeCount ?? 0) - Number(a.forestEdgeCount ?? 0)
        || b.degree - a.degree
        || b.weightedDegree - a.weightedDegree
        || a.name.localeCompare(b.name)
      )[0] ?? representative;
    component.memberCountEstimate = Math.max(
      component.nodes.length,
      ...component.nodes.map(node => Number(node.forestMemberCount ?? 0))
    );
    component.edgeCountEstimate = Math.max(
      component.edges.length,
      ...component.nodes.map(node => Number(node.forestEdgeCount ?? 0))
    );
  }
}

function sortedForestComponents() {
  return [...components].sort((a, b) =>
    (b.memberCountEstimate ?? b.nodes.length) - (a.memberCountEstimate ?? a.nodes.length)
    || String(a.id).localeCompare(String(b.id))
  );
}

function forestRepresentativeForComponent(component) {
  return component?.forestRepresentative ?? component?.representative ?? component?.nodes?.[0] ?? null;
}

function colorForWeight(weight) {
  const stops = [
    [0, new THREE.Color(0xb9e6ff)],
    [0.36, new THREE.Color(0x68b7ff)],
    [0.62, new THREE.Color(0xefb655)],
    [0.82, new THREE.Color(0xff725d)],
    [1, new THREE.Color(0xff2744)]
  ];
  for (let index = 0; index < stops.length - 1; index += 1) {
    const [leftStop, leftColor] = stops[index];
    const [rightStop, rightColor] = stops[index + 1];
    if (weight <= rightStop) {
      const t = (weight - leftStop) / (rightStop - leftStop);
      return leftColor.clone().lerp(rightColor, clamp(t, 0, 1));
    }
  }
  return stops[stops.length - 1][1].clone();
}

function colorForComponent(component) {
  const representative = forestRepresentativeForComponent(component);
  if (!representative) {
    return colorForGender('unknown');
  }
  return colorForNode(representative);
}

function colorForNode(node) {
  const color = colorForGender(genderForNode(node));
  const lift = node.degree === 0 ? 0.1 : Math.min(0.08, node.weightedDegree / 260);
  return color.lerp(new THREE.Color(0xffffff), lift);
}

function genderForNode(node) {
  const gender = String(node?.gender ?? '').trim().toLowerCase();
  if (gender === 'woman' || gender === 'man') {
    return gender;
  }
  const image = String(node?.image ?? '').toLowerCase();
  if (image.includes('/women/')) {
    return 'woman';
  }
  if (image.includes('/men/')) {
    return 'man';
  }
  return 'unknown';
}

function colorForGender(gender) {
  if (gender === 'woman') {
    return new THREE.Color(0xff4f6f);
  }
  if (gender === 'man') {
    return new THREE.Color(0x4aa8ff);
  }
  return new THREE.Color(0xffd83d);
}

function updateNodeBadgeSizing(node) {
  node.radius = node.degree === 0 ? 1.75 : 1.5 + Math.min(0.45, Math.sqrt(node.degree) * 0.06);
  node.badgeScale = node.radius * 2;
}

function refreshNodeBadge(node) {
  updateNodeBadgeSizing(node);
  if (!node.badge?.material) {
    return;
  }
  const previousTexture = node.badge.material.map;
  node.badge.material.map = createInitialsTexture(node, colorForNode(node, componentForId(node.componentId)));
  node.badge.material.needsUpdate = true;
  previousTexture?.dispose?.();
}

function nodeDataSignature(node) {
  return [
    node.name,
    node.initials,
    node.gender,
    node.city,
    node.age,
    node.headline,
    node.traitLabel,
    node.statusText,
    node.profileStatus,
    node.componentId,
    node.degree,
    Math.round((node.weightedDegree ?? 0) * 1000),
    node.forestMemberCount,
    node.forestEdgeCount
  ].join('|');
}

function nodeVisualSignature(node) {
  return [
    node.initials,
    genderForNode(node),
    node.degree,
    Math.round((node.weightedDegree ?? 0) * 1000),
    node.componentId,
    nodeBadgeCount(node)
  ].join('|');
}

function createInitialsTexture(node, fillColor) {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 256;
  canvasEl.height = 256;
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.fillStyle = fillColor.getStyle();
  ctx.fill();
  ctx.lineWidth = node.degree === 0 ? 14 : 10;
  ctx.strokeStyle = node.degree === 0 ? '#fff3b5' : '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#111317';
  ctx.font = '900 70px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((node.initials || '?').slice(0, 3), 128, 132);
  const count = nodeBadgeCount(node);
  if (count > 0) {
    const label = count > 99 ? '99+' : String(count);
    ctx.beginPath();
    ctx.arc(198, 58, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#111317';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = label.length > 2 ? '850 24px system-ui, sans-serif' : '900 29px system-ui, sans-serif';
    ctx.fillText(label, 198, 60);
  }
  const texture = new THREE.CanvasTexture(canvasEl);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function nodeBadgeCount(node) {
  return Math.max(0, Math.trunc(Number(node?.collapseBadgeCount ?? 0)));
}

function createForestTexture(component, fillColor) {
  const representative = forestRepresentativeForComponent(component);
  const memberCount = component.memberCountEstimate ?? component.nodes.length;
  const glowColor = fillColor.clone().lerp(new THREE.Color(0xffffff), 0.2).getStyle();
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 256;
  canvasEl.height = 256;
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = 0.22;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(128, 128, 108, 0, Math.PI * 2);
  ctx.fillStyle = fillColor.getStyle();
  ctx.fill();
  ctx.lineWidth = memberCount === 1 ? 12 : 10;
  ctx.strokeStyle = memberCount === 1 ? '#fff4a8' : '#e9fffb';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
  ctx.stroke();
  ctx.fillStyle = '#111317';
  ctx.font = '900 62px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((representative.initials || '?').slice(0, 3), 128, 108);
  ctx.font = '850 34px system-ui, sans-serif';
  ctx.fillText(String(memberCount), 128, 168);
  const texture = new THREE.CanvasTexture(canvasEl);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRingTexture() {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 256;
  canvasEl.height = 256;
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 106, 0, Math.PI * 2);
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 128, 84, 0, Math.PI * 2);
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#ff374d';
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvasEl);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function fibonacciPoint(index, count) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = count <= 1 ? 0 : 1 - (index / (count - 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * index;
  return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
}

function sphereShellPoint(index, count, nodeId) {
  const base = fibonacciPoint(index, count);
  const jitter = seededVector(`${nodeId}:shell`).multiplyScalar(count <= 2 ? 0.05 : 0.12);
  base.add(jitter);
  if (base.lengthSq() < 0.0001) {
    base.set(1, 0, -0.25);
  }
  return base.normalize();
}

function shellSortValue(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededVector(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const a = ((hash >>> 0) % 997) / 997;
  const b = (((hash >>> 8) % 991) / 991) * Math.PI * 2;
  return new THREE.Vector3(
    Math.cos(b) * Math.sin(a * Math.PI),
    Math.cos(a * Math.PI),
    Math.sin(b) * Math.sin(a * Math.PI)
  );
}

async function readGraphSnapshotFromIndexedDb(storeKey) {
  if (typeof indexedDB === 'undefined') {
    return null;
  }
  const db = await openGraphIndexedDb();
  if (!db) {
    return null;
  }
  try {
    return await new Promise(resolve => {
      const tx = db.transaction('tables', 'readonly');
      const request = tx.objectStore('tables').get(storeKey);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  } finally {
    db.close();
  }
}

function openGraphIndexedDb() {
  return new Promise(resolve => {
    const request = indexedDB.open('myscoutee-memory-db', 5);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('tables')) {
        db.createObjectStore('tables');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function normalizeGraphData(data) {
  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const nodeIds = new Set();
  const normalizedNodes = nodes
    .map(normalizeGraphNode)
    .filter(node => {
      if (!node || nodeIds.has(node.id)) {
        return false;
      }
      nodeIds.add(node.id);
      return true;
    });
  const normalizedEdges = (Array.isArray(data?.edges) ? data.edges : [])
    .map(normalizeGraphEdge)
    .filter(edge => edge && nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target);
  return {
    source: data?.source === 'http' ? 'http' : 'demo',
    layoutVersion: String(data?.layoutVersion ?? '').trim(),
    nodes: normalizedNodes,
    edges: normalizedEdges
  };
}

function normalizeGraphNode(node) {
  const id = String(node?.id ?? '').trim();
  if (!id) {
    return null;
  }
  const images = Array.isArray(node?.images)
    ? node.images.map(image => String(image ?? '').trim()).filter(Boolean)
    : [];
  const image = String(node?.image ?? images[0] ?? '').trim();
  return {
    ...node,
    id,
    name: String(node?.name ?? '').trim() || id,
    initials: String(node?.initials ?? '').trim().slice(0, 3).toUpperCase() || 'M',
    gender: String(node?.gender ?? '').trim().toLowerCase(),
    city: String(node?.city ?? '').trim(),
    age: Number.isFinite(Number(node?.age)) ? Math.trunc(Number(node.age)) : null,
    headline: String(node?.headline ?? '').trim(),
    traitLabel: String(node?.traitLabel ?? '').trim(),
    statusText: String(node?.statusText ?? '').trim(),
    profileStatus: String(node?.profileStatus ?? '').trim(),
    image,
    images,
    componentId: String(node?.componentId ?? '').trim() || null,
    x: finiteOrNull(node?.x),
    y: finiteOrNull(node?.y),
    z: finiteOrNull(node?.z),
    degree: Number.isFinite(Number(node?.degree)) ? Math.max(0, Math.trunc(Number(node.degree))) : 0,
    weightedDegree: Number.isFinite(Number(node?.weightedDegree)) ? Math.max(0, Number(node.weightedDegree)) : 0,
    centrality: Number.isFinite(Number(node?.centrality)) ? clamp(Number(node.centrality), 0, 1) : 0,
    forestMemberCount: Number.isFinite(Number(node?.forestMemberCount)) ? Math.max(0, Math.trunc(Number(node.forestMemberCount))) : null,
    forestEdgeCount: Number.isFinite(Number(node?.forestEdgeCount)) ? Math.max(0, Math.trunc(Number(node.forestEdgeCount))) : null
  };
}

function hasServerPosition(node) {
  return Number.isFinite(node?.x) && Number.isFinite(node?.y) && Number.isFinite(node?.z);
}

function finiteOrNull(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeGraphEdge(edge) {
  const source = String(edge?.source ?? '').trim();
  const target = String(edge?.target ?? '').trim();
  if (!source || !target || source === target) {
    return null;
  }
  const weight = clamp(Number(edge?.weight ?? edge?.affinityScore ?? 0), 0, 1);
  if (weight <= 0) {
    return null;
  }
  return {
    ...edge,
    id: String(edge?.id ?? '').trim() || (source < target ? `${source}:${target}` : `${target}:${source}`),
    source,
    target,
    weight,
    affinityScore: Number.isFinite(Number(edge?.affinityScore)) ? Number(edge.affinityScore) : weight
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function escapeHtml(value) {
  return `${value ?? ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function disposeObject(object) {
  if (!object) {
    return;
  }
  const geometries = new Set();
  const materials = new Set();
  object.traverse?.(child => {
    if (child.geometry) {
      geometries.add(child.geometry);
    }
    if (Array.isArray(child.material)) {
      child.material.forEach(material => materials.add(material));
    } else if (child.material) {
      materials.add(child.material);
    }
  });
  if (object.geometry) {
    geometries.add(object.geometry);
  }
  if (Array.isArray(object.material)) {
    object.material.forEach(material => materials.add(material));
  } else if (object.material) {
    materials.add(object.material);
  }
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

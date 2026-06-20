import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const GRAPH_DATA = normalizeGraphData(await loadInitialGraphData());
const GRAPH_MEMBER_LABEL = GRAPH_DATA.source === 'http' ? 'Mongo members' : 'demo members';
const GRAPH_LAZY_ENABLED = GRAPH_DATA.source === 'http' || (window.parent && window.parent !== window);
const GRAPH_LAYOUT_VERSION = GRAPH_DATA.layoutVersion || null;
const COMPONENT_CORE_NODE_BUDGET = 20;
const COMPONENT_CORE_EDGE_BUDGET = 56;
const REFIT_ANIMATION_MS = 620;
const SEMANTIC_RENDER_NODE_LIMIT = 1200;
const SEMANTIC_RENDER_EDGE_LIMIT = 5000;
const FOREST_OVERVIEW_BASE_BUDGET = 16;
const FOREST_OVERVIEW_LOAD_BUFFER = 4;
const GRAPH_LABEL_KEYS = {
  graphView: 'admin.affinity.graph.view',
  clusterDetail: 'admin.affinity.graph.cluster.detail',
  clusterEyebrow: 'admin.affinity.graph.cluster.eyebrow',
  clusterViewLabel: 'admin.affinity.graph.cluster.view.label',
  clusterTitle: 'admin.affinity.graph.cluster.title',
  clusterIsolatedTitle: 'admin.affinity.graph.cluster.isolated.title',
  clusterExpandedKicker: 'admin.affinity.graph.cluster.expanded.kicker',
  clusterIsolatedKicker: 'admin.affinity.graph.cluster.isolated.kicker',
  clusterSummary: 'admin.affinity.graph.cluster.summary'
};

const graphApp = document.querySelector('.graph-app');
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
const panelToggleButton = document.querySelector('#panel-toggle');
const panelToggleLabel = document.querySelector('#panel-toggle-label');
const panelViewLabel = document.querySelector('#panel-view-label');
const panelCompactSummary = document.querySelector('#panel-compact-summary');
const panelExpandedBody = document.querySelector('#panel-expanded-body');
const helpPanel = document.querySelector('.help-panel');
const mobilePanelQuery = window.matchMedia('(max-width: 760px)');

const demoNodes = GRAPH_DATA.nodes;
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
applyForestMetadata(components, GRAPH_DATA.forests);
let serverPositionCenter = new THREE.Vector3();
placeNodes(nodes, edges, components);

const isolatedNodes = nodes.filter(node => node.degree === 0);
let graphTotals = {
  members: Math.max(nodes.length, positiveInteger(GRAPH_DATA.memberCount, nodes.length)),
  links: Math.max(edges.length, positiveInteger(GRAPH_DATA.linkCount, edges.length)),
  components: Math.max(components.length, positiveInteger(GRAPH_DATA.componentCount ?? GRAPH_DATA.forestCount, components.length)),
  isolated: Math.max(isolatedNodes.length, positiveInteger(GRAPH_DATA.isolatedCount, isolatedNodes.length)),
  maxZoom: positiveInteger(GRAPH_DATA.maxZoom, null)
};
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
const DEFAULT_MIN_DISTANCE = 16;
controls.minDistance = DEFAULT_MIN_DISTANCE;
controls.maxDistance = 2200;
controls.zoomToCursor = true;
controls.enablePan = false;
controls.screenSpacePanning = true;
controls.touches = {
  ONE: null,
  TWO: THREE.TOUCH.DOLLY_ROTATE
};
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
let pendingComponentGraphId = null;
let fullGraphExpanded = false;
let selectionReturnMode = null;
let hoverNode = null;
let hoverForest = null;
let edgeMesh = null;
let selectedLinkLines = null;
let pointerDown = null;
const activeTouchPointers = new Map();
let touchPinchDistance = null;
let touchGestureWasMultiTouch = false;
let visibleEdgeCount = 0;
let visibleEdges = [];
let visibleNodeIds = new Set(nodes.map(node => node.id));
let visibleNodeDepths = new Map(nodes.map(node => [node.id, 0]));
let nodeRefitTimer = null;
let nodeLayoutAnimation = null;
let cameraAnimation = null;
let selectionVisualAnimation = null;
let layoutCenterAnchor = null;
let lazyTileTimer = null;
let lazyTileRequestSerial = 0;
let lazyTileSuppressUntil = 0;
const loadedTileKeys = new Set(GRAPH_LAZY_ENABLED ? ['0:0:0:*'] : []);
const pendingTileKeys = new Set();
const loadedComponentKeys = new Set();
const pendingComponentKeys = new Set();
const loadedNeighborhoodKeys = new Set();
const loadedForestKeys = new Set();
const pendingForestKeys = new Set();
const viewportPanOffset = { x: 0, y: 0 };
let lastPublishedZoomProgress = -1;
let lastPublishedZoomMode = '';
let zoomReferenceFitDistance = 48;
let semanticZoomLevel = 0;
let semanticZoomInputUntil = 0;
let visibleForestComponentIds = new Set();
let lazyForestTimer = null;
let lazyForestRequestSerial = 0;
let collapseBadgeMin = 1;
let collapseBadgeMax = 1;
const badgeCountAnimations = new Set();
const loadedMemberImageUrls = new Set();
const pendingMemberImageUrls = new Set();
let memberPanelRenderSignature = '';
let panelCompactSignature = '';
let panelsExpanded = !mobilePanelQuery.matches;
let panelExpansionTouched = false;
if (GRAPH_LAZY_ENABLED) {
  loadedForestKeys.add(`0:${forestLoadLimitForLevel(0)}`);
}

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

syncPanelChrome();
createNodes();
createForests();
updateVisibleForestComponents();
resize();
rebuildEdges();
refitVisibleNodes({ immediate: true });
fitCamera(false);
renderMemberPanel(null);
updateStatBadges();
graphApp?.classList.remove('graph-app--booting');
publishGraphState(true);
animate();
scheduleLazyForestLoad(360);
scheduleLazyTileLoad(320);

minWeightInput.addEventListener('input', () => handleWeightRangeInput('min'));
maxWeightInput.addEventListener('input', () => handleWeightRangeInput('max'));
linkDepthInput.addEventListener('input', handleLinkDepthInput);
controls.addEventListener('change', () => {
  if (performance.now() >= lazyTileSuppressUntil) {
    scheduleLazyTileLoad(260);
  }
  refreshSemanticZoomFromCamera();
  publishGraphState();
});

resetViewButton.addEventListener('click', () => {
  clearForest();
});
panelToggleButton?.addEventListener('click', () => {
  panelExpansionTouched = true;
  setPanelsExpanded(!panelsExpanded);
});
if (typeof mobilePanelQuery.addEventListener === 'function') {
  mobilePanelQuery.addEventListener('change', () => {
    if (!panelExpansionTouched) {
      setPanelsExpanded(!mobilePanelQuery.matches);
    }
  });
}
window.addEventListener('resize', resize);
window.addEventListener('keydown', handleKeyPan);
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('wheel', () => {
  semanticZoomInputUntil = performance.now() + 520;
}, { passive: true, capture: true });

canvas.addEventListener('pointermove', event => {
  if (event.pointerType !== 'touch' || activeTouchPointers.size < 2) {
    return;
  }
  activeTouchPointers.set(event.pointerId, touchPointFromEvent(event));
  updateTouchZoomInput();
}, { passive: true, capture: true });

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) {
    return;
  }
  if (event.pointerType === 'touch') {
    activeTouchPointers.set(event.pointerId, touchPointFromEvent(event));
    if (activeTouchPointers.size >= 2) {
      touchGestureWasMultiTouch = true;
      touchPinchDistance = activeTouchDistance();
      semanticZoomInputUntil = performance.now() + 620;
      pointerDown = null;
      return;
    }
  }
  pointerDown = {
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    pointerId: event.pointerId,
    dragged: false
  };
  if (event.pointerType !== 'touch') {
    canvas.setPointerCapture?.(event.pointerId);
  }
});

canvas.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') {
    activeTouchPointers.set(event.pointerId, touchPointFromEvent(event));
    if (activeTouchPointers.size >= 2) {
      touchGestureWasMultiTouch = true;
      updateTouchZoomInput();
      pointerDown = null;
      return;
    }
  }

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
  if (event.pointerType === 'touch') {
    activeTouchPointers.delete(event.pointerId);
    if (activeTouchPointers.size < 2) {
      touchPinchDistance = null;
    }
    if (touchGestureWasMultiTouch) {
      pointerDown = null;
      if (activeTouchPointers.size === 0) {
        touchGestureWasMultiTouch = false;
      }
      return;
    }
  }

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

canvas.addEventListener('pointercancel', event => {
  if (event.pointerType === 'touch') {
    activeTouchPointers.delete(event.pointerId);
    if (activeTouchPointers.size < 2) {
      touchPinchDistance = null;
    }
    if (activeTouchPointers.size === 0) {
      touchGestureWasMultiTouch = false;
      pointerDown = null;
    }
  }
});

function touchPointFromEvent(event) {
  return {
    x: event.clientX,
    y: event.clientY
  };
}

function activeTouchDistance() {
  const touches = [...activeTouchPointers.values()];
  if (touches.length < 2) {
    return null;
  }
  return Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
}

function updateTouchZoomInput() {
  const nextDistance = activeTouchDistance();
  if (!Number.isFinite(nextDistance)) {
    return;
  }
  if (touchPinchDistance === null || Math.abs(nextDistance - touchPinchDistance) > 2) {
    semanticZoomInputUntil = performance.now() + 620;
  }
  touchPinchDistance = nextDistance;
}

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
    map: createNodeTexture(node, baseColor),
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
  updateForestBadges({ refreshTextures: true });
}

function updateForestBadges(options = {}) {
  const forestPositions = forestOverviewPositions();
  for (const component of components) {
    const center = forestPositions.get(component.id) ?? new THREE.Vector3();
    component.forestPosition = center.clone();

    const memberCount = component.memberCountEstimate ?? component.nodes.length;
    const scale = forestBadgeScale(memberCount);
    component.forestScale = scale;

    if (!component.forestBadge) {
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createForestTexture(component, colorForComponent(component)),
        transparent: true,
        fog: false,
        depthTest: false,
        depthWrite: false
      }));
      badge.renderOrder = 24;
      badge.userData.componentId = component.id;
      component.forestBadge = badge;
      forestClickTargets.push(badge);
      forestGroup.add(badge);
    } else if (options.refreshTextures) {
      const previousTexture = component.forestBadge.material.map;
      component.forestBadge.material.map = createForestTexture(component, colorForComponent(component));
      component.forestBadge.material.needsUpdate = true;
      component.forestBadge.userData.componentId = component.id;
      disposeTexture(previousTexture);
    }

    component.forestBadge.position.copy(center);
    component.forestBadge.scale.setScalar(scale);
  }
  syncForestBadgeVisibility();
}

function forestOverviewPositions() {
  const sortedComponents = sortedForestComponents();
  const positions = new Map();
  const mainCount = sortedComponents[0]?.memberCountEstimate ?? sortedComponents[0]?.nodes.length ?? 1;
  const mainScale = forestBadgeScale(mainCount);
  const step = Math.max(13, mainScale * 0.54 + 8);
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
  const nodeBudget = semanticNodeBudget(nodes.length);
  const coreGraph = strongestComponentCore(
    { nodes, representative: nodes[0] ?? null },
    thresholdEdges,
    nodeBudget,
    semanticEdgeBudget(nodeBudget)
  );
  const nodeIds = coreGraph.nodeIds;
  return {
    edges: coreGraph.edges,
    nodeIds,
    nodeDepths: new Map([...nodeIds].map(nodeId => [nodeId, 0]))
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
  const nodeBudget = semanticNodeBudget(Math.max(component.nodes.length, component.memberCountEstimate ?? 0));
  const coreGraph = strongestComponentCore(component, componentEdges, nodeBudget, semanticEdgeBudget(nodeBudget));
  const nodeIds = coreGraph.nodeIds;
  return {
    edges: coreGraph.edges,
    nodeIds,
    nodeDepths: new Map([...nodeIds].map(nodeId => [nodeId, 0]))
  };
}

function strongestComponentCore(component, componentEdges, nodeBudget = COMPONENT_CORE_NODE_BUDGET, edgeBudget = COMPONENT_CORE_EDGE_BUDGET) {
  const visibleNodeBudget = Math.max(1, Math.trunc(nodeBudget));
  const visibleEdgeBudget = Math.max(0, Math.trunc(edgeBudget));
  if (!componentEdges.length) {
    const representative = memberRepresentativeForComponent(component);
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
    if (selectedIds.size >= visibleNodeBudget) {
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
      if (selectedIds.size >= visibleNodeBudget || partnerCount >= partnerLimit) {
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
      if (selectedIds.size >= Math.min(visibleNodeBudget, rankedNodes.length)) {
        break;
      }
      selectedIds.add(node.id);
    }
  }

  const selectedEdgeByKey = new Map(seedEdges);
  componentEdges
    .filter(edge => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .sort((a, b) => b.weight - a.weight || graphEdgeKey(a.source, a.target).localeCompare(graphEdgeKey(b.source, b.target)))
    .slice(0, visibleEdgeBudget)
    .forEach(edge => selectedEdgeByKey.set(graphEdgeKey(edge.source, edge.target), edge));

  return {
    edges: [...selectedEdgeByKey.values()].slice(0, visibleEdgeBudget),
    nodeIds: selectedIds
  };
}

function visibleGraphForSelectedDepth(thresholdEdges) {
  const maxDepth = currentLinkDepth();
  const allNodeDepths = selectedNodeDepthMap(thresholdEdges, maxDepth);
  const nodeBudget = semanticNodeBudget(allNodeDepths.size);
  const nodeIds = new Set(rankedSelectedNodeIds(thresholdEdges, allNodeDepths, nodeBudget));
  const nodeDepths = new Map([...allNodeDepths].filter(([nodeId]) => nodeIds.has(nodeId)));
  const visibleThresholdEdges = thresholdEdges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const graphEdges = maxDepth === 1
    ? visibleThresholdEdges.filter(edge => edge.source === selectedNode.id || edge.target === selectedNode.id)
    : strongestLayerEdges(visibleThresholdEdges, nodeDepths);

  return {
    edges: graphEdges.slice(0, semanticEdgeBudget(nodeBudget)),
    nodeIds,
    nodeDepths
  };
}

function selectedNodeDepthMap(thresholdEdges, maxDepth = currentLinkDepth()) {
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

  return nodeDepths;
}

function rankedSelectedNodeIds(thresholdEdges, nodeDepths, nodeBudget) {
  const maxNodeCount = Math.max(1, Math.trunc(nodeBudget));
  if (nodeDepths.size <= maxNodeCount) {
    return [...nodeDepths.keys()];
  }

  const strengthByNode = new Map();
  const weightByNode = new Map();
  for (const edge of thresholdEdges) {
    if (!nodeDepths.has(edge.source) || !nodeDepths.has(edge.target)) {
      continue;
    }
    strengthByNode.set(edge.source, Math.max(strengthByNode.get(edge.source) ?? 0, edge.weight));
    strengthByNode.set(edge.target, Math.max(strengthByNode.get(edge.target) ?? 0, edge.weight));
    weightByNode.set(edge.source, (weightByNode.get(edge.source) ?? 0) + edge.weight);
    weightByNode.set(edge.target, (weightByNode.get(edge.target) ?? 0) + edge.weight);
  }

  const selectedId = selectedNode.id;
  const ranked = [...nodeDepths.keys()]
    .filter(nodeId => nodeId !== selectedId)
    .sort((a, b) =>
      (nodeDepths.get(a) ?? 0) - (nodeDepths.get(b) ?? 0)
      || (strengthByNode.get(b) ?? 0) - (strengthByNode.get(a) ?? 0)
      || (weightByNode.get(b) ?? 0) - (weightByNode.get(a) ?? 0)
      || (nodeById.get(b)?.weightedDegree ?? 0) - (nodeById.get(a)?.weightedDegree ?? 0)
      || (nodeById.get(b)?.degree ?? 0) - (nodeById.get(a)?.degree ?? 0)
      || (nodeById.get(a)?.name ?? '').localeCompare(nodeById.get(b)?.name ?? '')
      || a.localeCompare(b)
    );

  return [selectedId, ...ranked.slice(0, maxNodeCount - 1)];
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
  const previousVisibleNodeIds = new Set(visibleNodeIds);
  const startScale = node?.badge?.scale.x ?? node?.badgeScale ?? 1;
  selectionReturnMode = fullGraphExpanded ? 'graph' : activeComponentId !== null ? 'forest' : 'graph';
  selectedNode = node;
  fullGraphExpanded = false;
  resetSemanticZoomLevel();
  if (selectedNode) {
    activeComponentId = selectedNode.componentId;
    layoutCenterAnchor = selectedNode.position.clone();
  }
  if (selectedNode && options.focus) {
    controls.target.copy(selectedNode.position);
  }
  rebuildEdges();
  startSelectionVisualAnimation(startScale);
  renderMemberPanel(selectedNode);
  startVisibleRefit({ fitCamera: true, previousVisibleNodeIds });
  scheduleLazyNeighborhoodLoad(80);
  publishPreviewState();
}

function selectForest(componentId) {
  const component = componentForId(componentId);
  if (!component) {
    return;
  }
  activeComponentId = componentId;
  pendingComponentGraphId = componentId;
  selectedNode = null;
  selectionReturnMode = null;
  fullGraphExpanded = false;
  layoutCenterAnchor = componentLayoutCenter(component);
  resetSemanticZoomLevel();
  restoreHomeNodePositions();
  rebuildEdges();
  renderMemberPanel(null);
  if (GRAPH_LAZY_ENABLED) {
    scheduleLazyComponentLoad(componentId, 60, { refresh: true, reveal: true });
  } else {
    revealComponentGraph(componentId, new Set(visibleNodeIds));
  }
  publishPreviewState();
}

function revealComponentGraph(componentId, previousVisibleNodeIds = new Set()) {
  if (activeComponentId !== componentId || selectedNode) {
    return;
  }
  pendingComponentGraphId = null;
  rebuildEdges();
  renderMemberPanel(null);
  startVisibleRefit({ fitCamera: true, previousVisibleNodeIds });
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
  pendingComponentGraphId = null;

  if (returnMode === 'forest' && activeComponentId !== null) {
    fullGraphExpanded = false;
    layoutCenterAnchor = componentLayoutCenter(componentForId(activeComponentId));
    resetSemanticZoomLevel();
    rebuildEdges();
    startDeselectionVisualAnimation(previousNode, startScale, startRingScale, startRingOpacity);
    renderMemberPanel(null);
    startVisibleRefit({ fitCamera: true });
    scheduleLazyTileLoad(120, { refresh: true });
    publishPreviewState();
    return;
  }

  activeComponentId = null;
  pendingComponentGraphId = null;
  fullGraphExpanded = true;
  layoutCenterAnchor = null;
  resetSemanticZoomLevel();
  rebuildEdges();
  startDeselectionVisualAnimation(previousNode, startScale, startRingScale, startRingOpacity);
  renderMemberPanel(null);
  startVisibleRefit({ fitCamera: true });
  scheduleLazyTileLoad(120, { refresh: true });
  publishPreviewState();
}

function showFullGraph() {
  stopSelectionVisualAnimation();
  selectedNode = null;
  activeComponentId = null;
  pendingComponentGraphId = null;
  selectionReturnMode = null;
  fullGraphExpanded = true;
  layoutCenterAnchor = null;
  resetSemanticZoomLevel();
  rebuildEdges();
  renderMemberPanel(null);
  startVisibleRefit({ fitCamera: true });
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
  pendingComponentGraphId = null;
  selectionReturnMode = null;
  fullGraphExpanded = false;
  layoutCenterAnchor = null;
  resetSemanticZoomLevel();
  rebuildEdges();
  renderMemberPanel(null);
  refitVisibleNodes({ immediate: false });
  fitCamera(true);
  scheduleLazyForestLoad(120, { refresh: true });
  publishPreviewState();
}

function applyNodeState() {
  const showForestOverview = isForestOverview();
  const graphRevealPending = isComponentGraphRevealPending();
  const visibleNodes = nodes.filter(node => visibleNodeIds.has(node.id));
  const maxVisibleWeight = Math.max(1, ...visibleNodes.map(node => node.visibleWeightSum ?? 0));
  const maxVisibleDegree = Math.max(1, ...visibleNodes.map(node => node.visibleDegree ?? 0));
  updateInteractionMode(showForestOverview);
  forestGroup.visible = showForestOverview;
  edgeGroup.visible = !graphRevealPending;
  selectedLinkGroup.visible = !graphRevealPending;
  nodeGroup.visible = !graphRevealPending;
  syncForestBadgeVisibility();

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
    node.badge.visible = !showForestOverview && !graphRevealPending && isVisible;
    node.badge.material.opacity = isSelected ? 1 : clamp((0.62 + visualScore * 0.36) * depthFade, 0.56, 0.98);
    node.badge.scale.setScalar(node.badgeScale * (isSelected ? 1.46 : baseScale * depthFade));
    node.badge.renderOrder = isSelected ? 36 : 18 + Math.round(visualScore * 10) - nodeDepth;
  }
  if (selectedNode && !graphRevealPending) {
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

function updateGraphTotals(data = {}) {
  graphTotals = {
    members: Math.max(graphTotals.members, positiveInteger(data.memberCount, nodes.length)),
    links: Math.max(graphTotals.links, positiveInteger(data.linkCount, edges.length)),
    components: Math.max(graphTotals.components, positiveInteger(data.componentCount ?? data.forestCount, components.length)),
    isolated: Math.max(graphTotals.isolated, positiveInteger(data.isolatedCount, nodes.filter(node => node.degree === 0).length)),
    maxZoom: positiveInteger(data.maxZoom, graphTotals.maxZoom)
  };
}

function updateStatBadges() {
  memberCountEl.textContent = String(Math.max(graphTotals.members, nodes.length));
  linkCountEl.textContent = String(Math.max(graphTotals.links, edges.length));
  componentCountEl.textContent = String(Math.max(graphTotals.components, components.length));
  isolatedCountEl.textContent = String(Math.max(graphTotals.isolated, nodes.filter(node => node.degree === 0).length));
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
    visibleForests: isForestOverview() ? visibleForestComponentIds.size : 0,
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

function publishGraphState(force = false) {
  if (!window.parent || window.parent === window) {
    return;
  }

  const zoomMode = isForestOverview()
    ? 'forest'
    : selectedNode
      ? 'member'
      : activeComponentId !== null
        ? 'forest-graph'
        : 'graph';
  const zoomProgress = currentZoomProgress();
  if (
    !force
    && zoomMode === lastPublishedZoomMode
    && Math.abs(zoomProgress - lastPublishedZoomProgress) < 0.002
  ) {
    return;
  }

  lastPublishedZoomMode = zoomMode;
  lastPublishedZoomProgress = zoomProgress;
  window.parent.postMessage({
    source: 'admin-affinity-graph',
    type: 'state',
    zoomMode,
    zoomProgress
  }, window.location.origin);
}

function componentForId(componentId) {
  return componentById.get(String(componentId)) ?? null;
}

function setPanelsExpanded(expanded) {
  panelsExpanded = Boolean(expanded);
  syncPanelChrome();
  requestAnimationFrame(() => {
    resize();
    publishGraphState(true);
  });
}

function syncPanelChrome() {
  graphApp?.classList.toggle('graph-app--panels-expanded', panelsExpanded);
  graphApp?.classList.toggle('graph-app--panels-collapsed', !panelsExpanded);
  if (panelToggleButton) {
    panelToggleButton.setAttribute('aria-expanded', String(panelsExpanded));
    panelToggleButton.setAttribute('aria-label', panelsExpanded ? 'Collapse graph panel' : 'Expand graph panel');
    panelToggleButton.title = panelsExpanded ? 'Collapse panel' : 'Expand panel';
  }
  if (panelToggleLabel) {
    panelToggleLabel.textContent = panelsExpanded ? 'Collapse' : 'Expand';
  }
  panelExpandedBody?.setAttribute('aria-hidden', String(!panelsExpanded));
  helpPanel?.setAttribute('aria-hidden', String(!panelsExpanded));
}

function setPanelCompactSummary(signature, options) {
  const nextSignature = String(signature);
  if (panelViewLabel) {
    panelViewLabel.textContent = options.viewLabel ?? options.eyebrow ?? 'Affinity graph view';
  }
  if (!panelCompactSummary || panelCompactSignature === nextSignature) {
    return false;
  }
  panelCompactSignature = nextSignature;
  panelCompactSummary.innerHTML = `
    ${options.avatarHtml}
    <span class="compact-copy">
      <span class="compact-eyebrow">${escapeHtml(options.eyebrow ?? 'Affinity graph view')}</span>
      <strong>${escapeHtml(options.title ?? 'Overview')}</strong>
      <small>${escapeHtml(options.detail ?? '')}</small>
    </span>
  `;
  hydrateLazyMemberImages(panelCompactSummary);
  return true;
}

function graphCompactAvatarHtml(label = 'AG', tone = 'graph') {
  const normalizedTone = tone === 'forest' ? 'compact-avatar--forest' : 'compact-avatar--graph';
  return `<span class="compact-avatar ${normalizedTone}" aria-hidden="true">${escapeHtml(label)}</span>`;
}

function setMemberPanelHtml(signature, html, options = {}) {
  const nextSignature = String(signature);
  if (memberPanelRenderSignature === nextSignature) {
    return false;
  }
  memberPanelRenderSignature = nextSignature;
  memberPanel.innerHTML = html;
  if (options.hydrateImages) {
    hydrateLazyMemberImages(memberPanel);
  }
  return true;
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
      const collapsedMembers = Math.max(0, nodes.length - visibleNodeIds.size);
      setPanelCompactSummary(
        `compact-full:${visibleNodeIds.size}:${collapsedMembers}:${visibleEdgeCount}`,
        {
          avatarHtml: graphCompactAvatarHtml('AG'),
          eyebrow: 'Affinity graph view',
          viewLabel: 'Expanded graph',
          title: 'Expanded graph',
          detail: `${visibleNodeIds.size} visible · ${collapsedMembers} collapsed · ${visibleEdgeCount} links`
        }
      );
      setMemberPanelHtml(
        `full:${visibleNodeIds.size}:${collapsedMembers}:${visibleEdgeCount}`,
        `<p class="empty-state">${visibleNodeIds.size} important members visible · ${collapsedMembers} collapsed · ${visibleEdgeCount} links in range.</p>`
      );
      return;
    }
    if (isForestOverview()) {
      const visibleForests = visibleForestComponentIds.size || visibleForestComponents().length;
      const totalForests = forestTotalCount();
      const forestLabel = visibleForests >= totalForests
        ? `${totalForests} clusters`
        : `${visibleForests} of ${totalForests} clusters`;
      setPanelCompactSummary(
        `compact-overview:${visibleForests}:${totalForests}:${graphTotals.members}:${graphTotals.isolated}`,
        {
          avatarHtml: graphCompactAvatarHtml('AG'),
          eyebrow: 'Affinity graph view',
          viewLabel: 'Forest overview',
          title: 'Forest overview',
          detail: `${forestLabel} · ${graphTotals.members} ${GRAPH_MEMBER_LABEL}`
        }
      );
      setMemberPanelHtml(
        `overview:${visibleForests}:${totalForests}:${graphTotals.members}:${graphTotals.isolated}`,
        `<p class="empty-state">${forestLabel} · ${graphTotals.members} ${GRAPH_MEMBER_LABEL} · ${graphTotals.isolated} isolated.</p>`
      );
      return;
    }
    const hiddenCount = Math.max(0, Math.max(nodes.length, components.reduce((total, component) => total + (component.memberCountEstimate ?? component.nodes.length), 0)) - visibleNodeIds.size);
    setPanelCompactSummary(
      `compact-empty:${visibleNodeIds.size}:${hiddenCount}:${isolatedNodes.length}`,
      {
        avatarHtml: graphCompactAvatarHtml('AG'),
        eyebrow: 'Affinity graph view',
        viewLabel: 'Overview',
        title: 'Overview',
        detail: `${visibleNodeIds.size} visible · ${hiddenCount} collapsed · ${isolatedNodes.length} isolated`
      }
    );
    setMemberPanelHtml(
      `empty:${visibleNodeIds.size}:${hiddenCount}:${isolatedNodes.length}`,
      `<p class="empty-state">${visibleNodeIds.size} important members visible · ${hiddenCount} collapsed · ${isolatedNodes.length} isolated.</p>`
    );
    return;
  }

  const weightRange = currentWeightRange();
  const sortedNeighbors = adjacency.get(node.id)
    .map(({ edge, other }) => ({ edge, other }))
    .sort((a, b) => b.edge.weight - a.edge.weight);
  const filteredNeighbors = sortedNeighbors.filter(item => isEdgeInWeightRange(item.edge, weightRange));
  const visibleNeighbors = filteredNeighbors.filter(item => visibleNodeIds.has(item.other.id));
  const topNeighbors = visibleNeighbors.slice(0, 5);
  const strongest = topNeighbors[0]?.edge.weight ?? 0;
  const visibleConnections = visibleNeighbors.length;
  const avatarColor = colorForNode(node, componentForId(node.componentId)).getStyle();
  const avatarImageUrl = avatarImageUrlForNode(node);
  const avatarMarkup = memberAvatarHtml(node, avatarColor);
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

  const panelSignature = JSON.stringify({
    type: 'member',
    id: node.id,
    name: node.name,
    city: node.city,
    age: node.age,
    traitLabel: node.traitLabel,
    headline: node.headline,
    statusText: node.statusText,
    degree: node.degree,
    visibleConnections,
    strongest: Math.round(strongest * 1000),
    minWeight: Math.round(weightRange.min * 1000),
    maxWeight: Math.round(weightRange.max * 1000),
    avatarImageUrl,
    neighbors: topNeighbors.map(({ edge, other }) => [
      other.id,
      other.name,
      Math.round(edge.weight * 1000)
    ])
  });

  setPanelCompactSummary(`compact:${panelSignature}`, {
    avatarHtml: avatarMarkup,
    eyebrow: 'Affinity graph view · Selected member',
    viewLabel: 'Selected member',
    title: node.name || 'Selected member',
    detail: [node.city, node.age ? `${node.age}` : null, node.traitLabel].filter(Boolean).join(' · ')
      || `${visibleConnections} visible links`
  });
  setMemberPanelHtml(panelSignature, `
    <p class="member-kicker">${node.degree === 0 ? 'Isolated member' : 'Selected member'}</p>
    <div class="member-heading member-heading--profile">
      ${avatarMarkup}
      <div class="member-copy">
        <h2>${escapeHtml(node.name)}</h2>
        <p class="member-subtitle">${escapeHtml([node.city, node.age ? `${node.age}` : null, node.traitLabel].filter(Boolean).join(' · '))}</p>
        <p class="member-headline">${escapeHtml(node.headline || node.statusText || 'Demo profile')}</p>
      </div>
    </div>
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
  `, { hydrateImages: true });
}

function memberAvatarHtml(node, avatarColor) {
  const imageUrl = avatarImageUrlForNode(node);
  const initials = escapeHtml(node.initials || '?');
  if (!imageUrl) {
    return `<div class="avatar" style="background:${avatarColor}">${initials}</div>`;
  }

  const imageLoaded = loadedMemberImageUrls.has(imageUrl);
  const imageStateAttrs = imageLoaded
    ? ` src="${escapeHtml(imageUrl)}" class="is-loaded"`
    : '';

  return `
    <div class="avatar avatar--photo" style="background:${avatarColor}; border-color:${avatarColor}" aria-label="${escapeHtml(node.name || 'Member')}">
      <span class="avatar-fallback">${initials}</span>
      <img data-lazy-src="${escapeHtml(imageUrl)}"${imageStateAttrs} alt="" loading="lazy" decoding="async">
    </div>
  `;
}

function hydrateLazyMemberImages(root) {
  for (const image of root.querySelectorAll('img[data-lazy-src]')) {
    const imageUrl = image.dataset.lazySrc?.trim();
    if (!imageUrl) {
      continue;
    }

    if (loadedMemberImageUrls.has(imageUrl)) {
      if (image.getAttribute('src') !== imageUrl) {
        image.src = imageUrl;
      }
      image.classList.add('is-loaded');
      continue;
    }

    const revealImage = () => {
      if (!image.isConnected || image.dataset.lazySrc !== imageUrl) {
        return;
      }
      image.addEventListener('load', () => {
        loadedMemberImageUrls.add(imageUrl);
        image.classList.add('is-loaded');
      }, { once: true });
      image.addEventListener('error', () => {
        loadedMemberImageUrls.delete(imageUrl);
        image.classList.remove('is-loaded');
      }, { once: true });
      if (image.getAttribute('src') !== imageUrl) {
        image.src = imageUrl;
      }
      if (image.complete && image.naturalWidth > 0) {
        loadedMemberImageUrls.add(imageUrl);
        image.classList.add('is-loaded');
      }
    };

    if (window.parent && window.parent !== window && !pendingMemberImageUrls.has(imageUrl)) {
      pendingMemberImageUrls.add(imageUrl);
      void requestGraphData('lazyImage', { imageUrl })
        .then(result => {
          if (result?.loaded) {
            loadedMemberImageUrls.add(imageUrl);
          }
        })
        .catch(() => null)
        .finally(() => pendingMemberImageUrls.delete(imageUrl));
    }
    revealImage();
  }
}

function renderForestPanel(component) {
  if (!component) {
    return;
  }

  const memberCount = component.memberCountEstimate ?? component.nodes.length;
  const edgeCount = component.edgeCountEstimate ?? component.edges.length;
  const visibleMembers = visibleNodeIds.size;
  const collapsedMembers = Math.max(0, memberCount - visibleMembers);
  const representative = forestRepresentativeForComponent(component);
  const compactAvatarLabel = String(representative?.initials ?? '').trim().slice(0, 3).toUpperCase() || 'CG';

  const panelSignature = JSON.stringify({
    type: 'forest',
    id: component.id,
    memberCount,
    edgeCount,
    visibleMembers,
    collapsedMembers,
    visibleEdgeCount
  });

  setPanelCompactSummary(`compact:${panelSignature}`, {
    avatarHtml: graphCompactAvatarHtml(compactAvatarLabel, 'forest'),
    eyebrow: graphLabel('clusterEyebrow'),
    viewLabel: graphLabel('clusterViewLabel'),
    title: memberCount === 1 ? graphLabel('clusterIsolatedTitle') : graphLabel('clusterTitle'),
    detail: graphLabel('clusterDetail', { visibleMembers, collapsedMembers, edgeCount })
  });
  setMemberPanelHtml(panelSignature, `
    <p class="member-kicker">${memberCount === 1 ? graphLabel('clusterIsolatedKicker') : graphLabel('clusterExpandedKicker')}</p>
    <p class="empty-state">${graphLabel('clusterSummary', { visibleMembers, collapsedMembers, edgeCount })}</p>
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
        <dt>Links</dt>
        <dd>${visibleEdgeCount}</dd>
      </div>
    </dl>
  `);
}

function handleWeightRangeInput(changedHandle) {
  normalizeWeightRange(changedHandle);
  rebuildEdges();
  renderMemberPanel(selectedNode);
  refitVisibleNodes({ immediate: true });
  if (activeComponentId !== null && !selectedNode) {
    scheduleLazyComponentLoad(activeComponentId, 120, { refresh: true });
  } else {
    scheduleLazyTileLoad(180, { refresh: true });
  }
  scheduleLazyNeighborhoodLoad(180);
}

function handleLinkDepthInput() {
  updateLinkDepthUi();
  const previousVisibleNodeIds = new Set(visibleNodeIds);
  rebuildEdges();
  renderMemberPanel(selectedNode);
  startVisibleRefit({ fitCamera: true, previousVisibleNodeIds });
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

function resetSemanticZoomLevel() {
  semanticZoomLevel = 0;
  semanticZoomInputUntil = 0;
  if (isForestOverview()) {
    updateVisibleForestComponents(0);
  }
}

function updateCollapseBadgeCounts(thresholdEdges) {
  const collapsedCounts = collapsedMemberCounts(thresholdEdges);
  const visibleCounts = [...visibleNodeIds]
    .map(nodeId => Math.trunc(collapsedCounts.get(nodeId) ?? 0))
    .filter(count => count > 0);
  const nextMin = visibleCounts.length ? Math.min(...visibleCounts) : 1;
  const nextMax = visibleCounts.length ? Math.max(...visibleCounts) : 1;
  const previousMin = collapseBadgeMin;
  const previousMax = collapseBadgeMax;
  const colorScaleChanged = nextMin !== collapseBadgeMin || nextMax !== collapseBadgeMax;
  collapseBadgeMin = nextMin;
  collapseBadgeMax = nextMax;

  for (const node of nodes) {
    const nextCount = Math.trunc(collapsedCounts.get(node.id) ?? 0);
    if (node.collapseBadgeCount === nextCount) {
      if (colorScaleChanged && nextCount > 0) {
        animateNodeBadgeCount(node, nextCount, nextCount, {
          fromMin: previousMin,
          fromMax: previousMax,
          toMin: nextMin,
          toMax: nextMax
        });
      }
      continue;
    }
    const previousDisplayCount = currentBadgeDisplayCount(node);
    node.collapseBadgeCount = nextCount;
    animateNodeBadgeCount(node, previousDisplayCount, nextCount, {
      fromMin: previousMin,
      fromMax: previousMax,
      toMin: nextMin,
      toMax: nextMax
    });
  }
}

function animateNodeBadgeCount(node, fromCount, toCount, range = {}) {
  badgeCountAnimations.delete(node);
  const fromVisibleCount = fromCount > 0 ? fromCount : toCount;
  const toVisibleCount = toCount > 0 ? toCount : fromVisibleCount;
  const fromStyle = colorForCounterBadgeCount(
    fromVisibleCount,
    range.fromMin ?? collapseBadgeMin,
    range.fromMax ?? collapseBadgeMax
  );
  const toStyle = colorForCounterBadgeCount(
    toVisibleCount,
    range.toMin ?? collapseBadgeMin,
    range.toMax ?? collapseBadgeMax
  );
  node.badgeCountAnimation = {
    from: Number(fromCount) || 0,
    to: Number(toCount) || 0,
    fromBadgeColor: fromStyle.color.getHex(),
    toBadgeColor: toStyle.color.getHex(),
    fromTextColor: fromStyle.textColor,
    toTextColor: toStyle.textColor,
    startedAt: performance.now(),
    durationMs: 360
  };
  badgeCountAnimations.add(node);
}

function updateBadgeCountAnimations() {
  if (!badgeCountAnimations.size) {
    return;
  }

  const now = performance.now();
  for (const node of [...badgeCountAnimations]) {
    const animation = node.badgeCountAnimation;
    if (!animation) {
      badgeCountAnimations.delete(node);
      continue;
    }

    const progress = clamp((now - animation.startedAt) / animation.durationMs, 0, 1);
    const eased = easeOutCubic(progress);
    animation.progress = progress;
    animation.eased = eased;
    refreshNodeBadge(node);

    if (progress >= 1) {
      node.badgeCountAnimation = null;
      badgeCountAnimations.delete(node);
      refreshNodeBadge(node);
    }
  }
}

function currentBadgeDisplayCount(node) {
  const animation = node.badgeCountAnimation;
  if (!animation) {
    return Number(node.collapseBadgeCount ?? 0);
  }
  return (animation.progress ?? 0) < 0.5
    ? Number(animation.from ?? 0)
    : Number(animation.to ?? 0);
}

function collapsedMemberCounts(thresholdEdges) {
  const counts = new Map(nodes.map(node => [node.id, 0]));
  if (isForestOverview() || !visibleNodeIds.size) {
    return counts;
  }

  const hiddenNodeIds = hiddenNodeIdsForCurrentView(thresholdEdges);
  if (selectedNode && currentLinkDepth() === 1) {
    counts.set(selectedNode.id, hiddenNodeIds.size);
    return counts;
  }

  const bestVisibleByHidden = new Map();
  const visibleScore = new Map([...visibleNodeIds].map(nodeId => [nodeId, overviewNodeScore(nodeById.get(nodeId))]));
  const assignHiddenNode = (hiddenNodeId, visibleNodeId, weight = 0) => {
    if (!hiddenNodeIds.has(hiddenNodeId) || !visibleNodeIds.has(visibleNodeId)) {
      return;
    }
    const previous = bestVisibleByHidden.get(hiddenNodeId);
    const score = visibleScore.get(visibleNodeId) ?? 0;
    if (
      !previous
      || weight > previous.weight
      || (weight === previous.weight && score > previous.score)
      || (weight === previous.weight && score === previous.score && String(visibleNodeId).localeCompare(String(previous.visibleNodeId)) < 0)
    ) {
      bestVisibleByHidden.set(hiddenNodeId, {
        visibleNodeId,
        weight,
        score
      });
    }
  };

  for (const edge of thresholdEdges) {
    assignHiddenNode(edge.source, edge.target, edge.weight);
    assignHiddenNode(edge.target, edge.source, edge.weight);
  }

  for (const hiddenNodeId of hiddenNodeIds) {
    if (!bestVisibleByHidden.has(hiddenNodeId)) {
      assignHiddenNodeToComponentCore(hiddenNodeId, bestVisibleByHidden);
    }
  }

  for (const assignment of bestVisibleByHidden.values()) {
    counts.set(assignment.visibleNodeId, (counts.get(assignment.visibleNodeId) ?? 0) + 1);
  }
  return counts;
}

function hiddenNodeIdsForCurrentView(thresholdEdges) {
  let candidateIds = new Set();
  if (selectedNode) {
    candidateIds = new Set(selectedNodeDepthMap(thresholdEdges).keys());
  } else if (activeComponentId !== null) {
    const component = componentForId(activeComponentId);
    candidateIds = new Set(component?.nodes?.map(node => node.id) ?? []);
  } else if (fullGraphExpanded) {
    candidateIds = new Set(nodes.map(node => node.id));
  }

  for (const visibleNodeId of visibleNodeIds) {
    candidateIds.delete(visibleNodeId);
  }
  return candidateIds;
}

function assignHiddenNodeToComponentCore(hiddenNodeId, bestVisibleByHidden) {
  const hiddenNode = nodeById.get(hiddenNodeId);
  const component = componentForId(hiddenNode?.componentId);
  const visibleComponentNodes = (component?.nodes ?? [])
    .filter(node => visibleNodeIds.has(node.id))
    .sort((a, b) =>
      overviewNodeScore(b) - overviewNodeScore(a)
      || b.weightedDegree - a.weightedDegree
      || b.degree - a.degree
      || a.name.localeCompare(b.name)
      || a.id.localeCompare(b.id)
    );
  const visibleNode = visibleComponentNodes[0];
  if (visibleNode) {
    bestVisibleByHidden.set(hiddenNodeId, {
      visibleNodeId: visibleNode.id,
      weight: 0,
      score: overviewNodeScore(visibleNode)
    });
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

function isComponentGraphRevealPending() {
  return pendingComponentGraphId !== null
    && activeComponentId === pendingComponentGraphId
    && !selectedNode;
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

function currentZoomProgress() {
  const fitDistance = Math.max(graphMinimumFitDistance(), zoomReferenceFitDistance);
  const nearDistance = Math.max(controls.minDistance, fitDistance * 0.18);
  const distance = camera.position.distanceTo(controls.target);
  return clamp((fitDistance - distance) / Math.max(1, fitDistance - nearDistance), 0, 1);
}

function refreshSemanticZoomFromCamera() {
  if (performance.now() > semanticZoomInputUntil) {
    return;
  }

  if (isForestOverview()) {
    refreshForestSemanticZoomFromCamera();
    return;
  }

  const population = semanticPopulationForCurrentView();
  const nextLevel = semanticLevelForProgress(currentZoomProgress(), population);
  if (nextLevel === semanticZoomLevel) {
    return;
  }

  const previewGraph = visibleGraphForSemanticLevel(nextLevel);
  const previewVisibleEdges = visibleEdgeSignature(previewGraph.edges);
  const hasSemanticChange = !sameSet(visibleNodeIds, previewGraph.nodeIds)
    || visibleEdgeSignature(visibleEdges) !== previewVisibleEdges;
  if (!hasSemanticChange) {
    semanticZoomLevel = nextLevel;
    return;
  }

  const previousVisibleNodeIds = new Set(visibleNodeIds);
  semanticZoomLevel = nextLevel;
  rebuildEdges();
  renderMemberPanel(selectedNode);
  settleSemanticZoomLayout(previousVisibleNodeIds);
  if (selectedNode) {
    scheduleLazyNeighborhoodLoad(120);
  } else {
    scheduleLazyTileLoad(120);
  }
}

function refreshForestSemanticZoomFromCamera() {
  const nextLevel = forestSemanticLevelForProgress(currentZoomProgress());
  if (nextLevel === semanticZoomLevel) {
    return;
  }

  const nextIds = forestIdsForSemanticLevel(nextLevel);
  const hasSemanticChange = !sameSet(visibleForestComponentIds, nextIds);
  semanticZoomLevel = nextLevel;
  if (hasSemanticChange) {
    visibleForestComponentIds = nextIds;
    syncForestBadgeVisibility();
    renderMemberPanel(null);
    clampViewportPanOffset();
    publishPreviewState();
  }
  scheduleLazyForestLoad(80);
}

function visibleGraphForSemanticLevel(level) {
  const previousLevel = semanticZoomLevel;
  semanticZoomLevel = level;
  try {
    const thresholdEdges = edges.filter(edge => isEdgeInWeightRange(edge));
    return visibleGraphForCurrentView(thresholdEdges);
  } finally {
    semanticZoomLevel = previousLevel;
  }
}

function settleSemanticZoomLayout(previousVisibleNodeIds) {
  const addedNodes = nodes.filter(node => visibleNodeIds.has(node.id) && !previousVisibleNodeIds.has(node.id));
  const fromPositions = new Map(nodes.map(node => [node.id, node.position.clone()]));

  for (const node of nodes) {
    if (!visibleNodeIds.has(node.id) || previousVisibleNodeIds.has(node.id)) {
      node.targetPosition = node.position.clone();
    }
  }

  if (!addedNodes.length) {
    nodeLayoutAnimation = null;
    syncGraphObjects();
    clampViewportPanOffset();
    return;
  }

  const localTargets = semanticLocalTargetsForAddedNodes(addedNodes, previousVisibleNodeIds);
  for (const node of addedNodes) {
    const target = localTargets.get(node.id) ?? node.position.clone();
    const anchor = semanticAnchorForNode(node, previousVisibleNodeIds).position;
    const entry = semanticEntryPosition(anchor, target, node.id);
    node.position.copy(entry);
    node.targetPosition.copy(target);
    fromPositions.set(node.id, entry.clone());
  }

  nodeLayoutAnimation = {
    startedAt: performance.now(),
    durationMs: Math.min(440, REFIT_ANIMATION_MS),
    from: fromPositions
  };
  syncGraphObjects();
  clampViewportPanOffset();
}

function semanticLocalTargetsForAddedNodes(addedNodes, previousVisibleNodeIds) {
  const basis = viewBasis();
  const anchorGroups = new Map();
  const targetByNode = new Map();

  for (const node of addedNodes) {
    const anchor = semanticAnchorForNode(node, previousVisibleNodeIds);
    if (!anchorGroups.has(anchor.key)) {
      anchorGroups.set(anchor.key, {
        anchor,
        nodes: []
      });
    }
    anchorGroups.get(anchor.key).nodes.push(node);
  }

  for (const group of anchorGroups.values()) {
    group.nodes
      .sort((a, b) =>
        (b.visibleStrongest ?? 0) - (a.visibleStrongest ?? 0)
        || (b.weightedDegree ?? 0) - (a.weightedDegree ?? 0)
        || (a.name ?? '').localeCompare(b.name ?? '')
        || a.id.localeCompare(b.id)
      )
      .forEach((node, index) => {
        const count = group.nodes.length;
        const angle = seededAngle(`${group.anchor.key}:${node.id}`) + (index / Math.max(1, count)) * Math.PI * 2;
        const anchorNode = group.anchor.node;
        const anchorScale = anchorNode?.badge?.scale?.x ?? anchorNode?.badgeScale ?? 2.8;
        const nodeScale = node.badge?.scale?.x ?? node.badgeScale ?? 2.8;
        const shellRadius = Math.max(5.5, anchorScale * 0.62 + nodeScale * 1.05 + Math.sqrt(count) * 0.92);
        const depthOffset = ((index % 3) - 1) * Math.min(2.2, shellRadius * 0.18);
        const target = group.anchor.position.clone()
          .addScaledVector(basis.right, Math.cos(angle) * shellRadius)
          .addScaledVector(basis.up, Math.sin(angle) * shellRadius)
          .addScaledVector(basis.forward, depthOffset);
        targetByNode.set(node.id, target);
      });
  }

  return targetByNode;
}

function semanticAnchorForNode(node, previousVisibleNodeIds) {
  let best = null;
  for (const edge of visibleEdges) {
    if (edge.source !== node.id && edge.target !== node.id) {
      continue;
    }
    const otherId = edge.source === node.id ? edge.target : edge.source;
    if (!previousVisibleNodeIds.has(otherId)) {
      continue;
    }
    if (!best || edge.weight > best.weight) {
      const other = nodeById.get(otherId);
      if (other) {
        best = {
          key: other.id,
          node: other,
          position: other.position.clone(),
          weight: edge.weight
        };
      }
    }
  }

  if (best) {
    return best;
  }

  if (selectedNode && selectedNode !== node) {
    return {
      key: selectedNode.id,
      node: selectedNode,
      position: selectedNode.position.clone(),
      weight: 0
    };
  }

  const fallbackNode = [...previousVisibleNodeIds]
    .map(nodeId => nodeById.get(nodeId))
    .filter(Boolean)
    .sort((a, b) => a.position.distanceToSquared(node.position) - b.position.distanceToSquared(node.position))[0];
  if (fallbackNode) {
    return {
      key: fallbackNode.id,
      node: fallbackNode,
      position: fallbackNode.position.clone(),
      weight: 0
    };
  }

  return {
    key: 'view-center',
    node: null,
    position: controls.target.clone(),
    weight: 0
  };
}

function semanticEntryPosition(anchor, target, seed) {
  const direction = target.clone().sub(anchor);
  if (direction.lengthSq() < 0.0001) {
    direction.copy(seededVector(seed));
  }
  const distance = direction.length();
  return anchor.clone().add(direction.normalize().multiplyScalar(Math.min(distance, 2.8)));
}

function visibleEdgeSignature(renderEdges) {
  return renderEdges
    .map(edge => graphEdgeKey(edge.source, edge.target))
    .sort()
    .join('|');
}

function sameSet(left, right) {
  if (left.size !== right.size) {
    return false;
  }
  for (const item of left) {
    if (!right.has(item)) {
      return false;
    }
  }
  return true;
}

function semanticPopulationForCurrentView() {
  if (selectedNode) {
    const weightRange = currentWeightRange();
    const thresholdEdges = edges.filter(edge => isEdgeInWeightRange(edge, weightRange));
    return selectedNodeDepthMap(thresholdEdges).size;
  }
  if (activeComponentId !== null) {
    const component = componentForId(activeComponentId);
    return Math.max(component?.nodes?.length ?? 0, component?.memberCountEstimate ?? 0, 1);
  }
  if (fullGraphExpanded) {
    return nodes.length;
  }
  return components.length;
}

function forestTotalCount() {
  return Math.max(components.length, positiveInteger(graphTotals.components, components.length));
}

function forestSemanticMaxZoomLevel(totalCount = forestTotalCount()) {
  const total = Math.max(1, Number(totalCount) || 1);
  return Math.max(0, Math.ceil(Math.log2(total / FOREST_OVERVIEW_BASE_BUDGET)));
}

function forestSemanticLevelForProgress(progress, totalCount = forestTotalCount()) {
  const maxLevel = forestSemanticMaxZoomLevel(totalCount);
  return Math.round(clamp(progress, 0, 1) * maxLevel);
}

function forestSemanticBudget(level = semanticZoomLevel) {
  const loadedTotal = components.length;
  const total = forestTotalCount();
  const maxLevel = forestSemanticMaxZoomLevel(total);
  const clampedLevel = Math.trunc(clamp(level, 0, maxLevel));
  const requestedBudget = FOREST_OVERVIEW_BASE_BUDGET * (2 ** clampedLevel);
  return Math.min(loadedTotal, total, Math.max(1, Math.round(requestedBudget)));
}

function forestLoadLimitForLevel(level = semanticZoomLevel) {
  const total = forestTotalCount();
  const maxLevel = forestSemanticMaxZoomLevel(total);
  const clampedLevel = Math.trunc(clamp(level, 0, maxLevel));
  return Math.min(total, Math.max(1, Math.round(FOREST_OVERVIEW_BASE_BUDGET * (2 ** clampedLevel) + FOREST_OVERVIEW_LOAD_BUFFER)));
}

function forestIdsForSemanticLevel(level = semanticZoomLevel) {
  return new Set(sortedForestComponents()
    .slice(0, forestSemanticBudget(level))
    .map(component => String(component.id)));
}

function updateVisibleForestComponents(level = semanticZoomLevel) {
  visibleForestComponentIds = forestIdsForSemanticLevel(level);
  syncForestBadgeVisibility();
}

function visibleForestComponents(level = semanticZoomLevel) {
  const visibleIds = visibleForestComponentIds.size
    ? visibleForestComponentIds
    : forestIdsForSemanticLevel(level);
  return sortedForestComponents().filter(component => visibleIds.has(String(component.id)));
}

function syncForestBadgeVisibility() {
  const showForestOverview = isForestOverview();
  for (const component of components) {
    if (component.forestBadge) {
      component.forestBadge.visible = showForestOverview && visibleForestComponentIds.has(String(component.id));
    }
  }
}

function semanticMaxZoomLevel(totalCount) {
  const total = Math.max(1, Number(totalCount) || 1);
  return Math.max(0, Math.ceil(Math.log2(total / COMPONENT_CORE_NODE_BUDGET)));
}

function semanticLevelForProgress(progress, totalCount) {
  const maxLevel = semanticMaxZoomLevel(totalCount);
  return Math.round(clamp(progress, 0, 1) * maxLevel);
}

function semanticNodeBudget(totalCount) {
  const total = Math.max(1, Math.trunc(Number(totalCount) || 1));
  const maxLevel = semanticMaxZoomLevel(total);
  const level = Math.trunc(clamp(semanticZoomLevel, 0, maxLevel));
  const budget = COMPONENT_CORE_NODE_BUDGET * (2 ** level);
  return Math.min(total, SEMANTIC_RENDER_NODE_LIMIT, Math.max(1, Math.round(budget)));
}

function semanticEdgeBudget(nodeBudget) {
  return Math.min(SEMANTIC_RENDER_EDGE_LIMIT, Math.max(COMPONENT_CORE_EDGE_BUDGET, Math.round(nodeBudget * 3.2)));
}

function currentViewRadius() {
  if (isForestOverview()) {
    return forestOverviewRadius();
  }

  const points = nodes
    .filter(node => visibleNodeIds.has(node.id))
    .map(node => node.targetPosition ?? node.position);
  return radiusForPoints(points.length ? points : nodes.map(node => node.position));
}

function forestOverviewRadius() {
  return forestOverviewBounds().radius;
}

function forestOverviewBounds() {
  const forestComponents = visibleForestComponents();
  if (forestComponents.length === 0) {
    return {
      center: new THREE.Vector3(),
      radius: 8
    };
  }

  const box = new THREE.Box3();
  for (const component of forestComponents) {
    const position = component.forestPosition ?? new THREE.Vector3();
    const badgeRadius = Math.max(5, (component.forestScale ?? 5) * 0.82);
    box.expandByPoint(new THREE.Vector3(
      position.x - badgeRadius,
      position.y - badgeRadius,
      position.z - badgeRadius
    ));
    box.expandByPoint(new THREE.Vector3(
      position.x + badgeRadius,
      position.y + badgeRadius,
      position.z + badgeRadius
    ));
  }

  const sphere = box.getBoundingSphere(new THREE.Sphere());
  return {
    center: sphere.center,
    radius: Math.max(8, sphere.radius)
  };
}

function radiusForPoints(points) {
  if (!points.length) {
    return 8;
  }
  const sphere = new THREE.Box3()
    .setFromPoints(points)
    .getBoundingSphere(new THREE.Sphere());
  return Math.max(8, sphere.radius);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  refreshGraphVisualSizing();
  clampViewportPanOffset();
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

function fitCameraToVisibleTargets(animateTarget, durationMs) {
  const points = nodes
    .filter(node => visibleNodeIds.has(node.id))
    .map(node => node.targetPosition ?? node.position);
  fitCameraToPoints(points.length ? points : nodes.map(node => node.position), animateTarget, durationMs);
}

function fitCameraToForestOverview(animateTarget) {
  updateVisibleForestComponents();
  const bounds = forestOverviewBounds();
  fitCameraToCenterRadius(bounds.center, bounds.radius, animateTarget, undefined, {
    lockZoomIfFitted: shouldLockForestOverviewZoom(),
    fitPadding: 1.04
  });
}

function fitCameraToPoints(points, animateTarget, durationMs) {
  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  fitCameraToCenterRadius(center, sphere.radius, animateTarget, durationMs);
}

function fitCameraToCenterRadius(center, radius, animateTarget, durationMs, options = {}) {
  const viewport = graphViewportMetrics();
  const safeWidthRatio = clamp(viewport.safeWidth / Math.max(1, viewport.fullWidth), 0.58, 1);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const tanHalfFov = Math.tan(verticalFov / 2);
  const aspect = Math.max(0.1, camera.aspect || (viewport.fullWidth / Math.max(1, viewport.fullHeight)));
  const fitPadding = options.fitPadding ?? 1.12;
  const verticalDistance = (radius * fitPadding) / Math.max(0.001, tanHalfFov);
  const horizontalDistance = (radius * fitPadding) / Math.max(0.001, tanHalfFov * aspect * safeWidthRatio);
  const distance = Math.max(graphMinimumFitDistance(), verticalDistance, horizontalDistance);
  const target = center.clone();
  const defaultDirection = new THREE.Vector3(0.24, 0.34, 1);
  const fittedOrbitDistance = distance * defaultDirection.length();
  const targetPosition = target.clone().addScaledVector(cameraFitDirection(defaultDirection), fittedOrbitDistance);
  zoomReferenceFitDistance = fittedOrbitDistance;
  const nextMinDistance = options.lockZoomIfFitted
    ? fittedOrbitDistance
    : DEFAULT_MIN_DISTANCE;
  controls.minDistance = Math.min(nextMinDistance, fittedOrbitDistance);
  const cappedMaxDistance = Math.max(controls.minDistance + 1, fittedOrbitDistance);
  viewportPanOffset.x = 0;
  viewportPanOffset.y = 0;
  applyViewportOffset(viewport);
  if (animateTarget) {
    controls.maxDistance = Math.max(cappedMaxDistance, camera.position.distanceTo(controls.target));
    startCameraAnimation(targetPosition, target, cappedMaxDistance, durationMs);
    return;
  }
  cameraAnimation = null;
  controls.maxDistance = cappedMaxDistance;
  camera.position.copy(targetPosition);
  controls.target.copy(target);
  controls.update();
}

function cameraFitDirection(defaultDirection) {
  const currentDirection = camera.position.clone().sub(controls.target);
  if (currentDirection.lengthSq() > 0.0001) {
    return currentDirection.normalize();
  }
  return defaultDirection.clone().normalize();
}

function shouldLockForestOverviewZoom() {
  return forestSemanticMaxZoomLevel() <= 0;
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
  viewportPanOffset.x -= deltaX;
  viewportPanOffset.y -= deltaY;
  applyViewportOffset(viewport);
  controls.update();
  publishPreviewState();
  scheduleLazyTileLoad(220);
}

function clampViewportPanOffset(viewport = graphViewportMetrics()) {
  applyViewportOffset(viewport);
  return false;
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

function scheduleLazyForestLoad(delayMs = 140, options = {}) {
  if (!GRAPH_LAZY_ENABLED || !isForestOverview()) {
    return;
  }
  if (lazyForestTimer) {
    clearTimeout(lazyForestTimer);
  }
  lazyForestTimer = setTimeout(() => {
    lazyForestTimer = null;
    void loadLazyForests(options);
  }, delayMs);
}

async function loadLazyForests(options = {}) {
  if (!GRAPH_LAZY_ENABLED || !isForestOverview()) {
    return;
  }
  const level = Math.trunc(clamp(semanticZoomLevel, 0, forestSemanticMaxZoomLevel()));
  const limit = forestLoadLimitForLevel(level);
  const cacheKey = `${level}:${limit}`;
  if (!options.refresh && (loadedForestKeys.has(cacheKey) || pendingForestKeys.has(cacheKey))) {
    return;
  }
  pendingForestKeys.add(cacheKey);
  const serial = ++lazyForestRequestSerial;
  try {
    const result = await requestGraphData('forests', {
      layoutVersion: GRAPH_LAYOUT_VERSION,
      forestLevel: level,
      limit,
      offset: 0
    });
    if (serial < lazyForestRequestSerial - 4) {
      return;
    }
    loadedForestKeys.add(cacheKey);
    mergeGraphPayload(result);
    if (isForestOverview()) {
      updateVisibleForestComponents(level);
      renderMemberPanel(null);
      clampViewportPanOffset();
      publishPreviewState();
    }
  } catch {
    loadedForestKeys.delete(cacheKey);
  } finally {
    pendingForestKeys.delete(cacheKey);
  }
}

function scheduleLazyComponentLoad(componentId, delayMs = 120, options = {}) {
  if (!GRAPH_LAZY_ENABLED || componentId === null || componentId === undefined || String(componentId).trim() === '') {
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
    const beforeSignature = visibleSceneSignature();
    const previousVisibleNodeIds = new Set(visibleNodeIds);
    const changed = mergeGraphPayload(result);
    if (activeComponentId === componentId && !selectedNode) {
      if (options.reveal && pendingComponentGraphId === componentId) {
        revealComponentGraph(componentId, previousVisibleNodeIds);
      } else if (changed && visibleSceneSignature() !== beforeSignature) {
        renderMemberPanel(null);
        startVisibleRefit({ fitCamera: true, previousVisibleNodeIds });
      }
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
    const beforeSignature = visibleSceneSignature();
    const previousVisibleNodeIds = new Set(visibleNodeIds);
    const changed = mergeGraphPayload(result);
    if (changed && visibleSceneSignature() !== beforeSignature) {
      startVisibleRefit({ previousVisibleNodeIds });
    }
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
  const requestedNodeId = selectedNode.id;
  const requestedDepth = currentLinkDepth();
  const weightRange = currentWeightRange();
  const key = `${requestedNodeId}:${requestedDepth}:${weightRange.min.toFixed(2)}:${weightRange.max.toFixed(2)}`;
  if (loadedNeighborhoodKeys.has(key)) {
    return;
  }
  loadedNeighborhoodKeys.add(key);
  try {
    const result = await requestGraphData('neighborhood', {
      userId: requestedNodeId,
      depth: requestedDepth,
      minWeight: weightRange.min,
      maxWeight: weightRange.max
    });
    if (selectedNode?.id !== requestedNodeId || currentLinkDepth() !== requestedDepth) {
      return;
    }
    const beforeSignature = visibleSceneSignature();
    const previousVisibleNodeIds = new Set(visibleNodeIds);
    const changed = mergeGraphPayload(result);
    if (changed && visibleSceneSignature() !== beforeSignature) {
      startVisibleRefit({ previousVisibleNodeIds });
    }
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
  updateGraphTotals(nextGraph);
  let changed = false;
  let forestMetadataChanged = false;
  for (const node of nextGraph.nodes) {
    changed = mergeGraphNode(node) || changed;
  }
  for (const edge of nextGraph.edges) {
    changed = mergeGraphEdge(edge) || changed;
  }
  if (nextGraph.forests.length) {
    forestMetadataChanged = mergeGraphForests(nextGraph.forests);
    changed = forestMetadataChanged || changed;
  }
  if (!changed) {
    return false;
  }
  enrichComponents(components, edges);
  applyForestMetadata(components, GRAPH_DATA.forests);
  updateForestBadges({ refreshTextures: forestMetadataChanged });
  rebuildEdges();
  applyNodeState();
  updateStatBadges();
  publishPreviewState();
  return true;
}

function visibleSceneSignature() {
  return [
    [...visibleNodeIds].sort().join(','),
    visibleEdgeSignature(visibleEdges)
  ].join('|');
}

function mergeGraphForests(nextForests) {
  const forestsById = new Map((GRAPH_DATA.forests ?? []).map(forest => [String(forest.componentId), forest]));
  let changed = false;
  for (const forest of nextForests) {
    const key = String(forest.componentId);
    const previous = forestsById.get(key);
    const previousSignature = previous ? JSON.stringify(previous) : '';
    const nextSignature = JSON.stringify(forest);
    if (previousSignature !== nextSignature) {
      forestsById.set(key, forest);
      changed = true;
    }
  }
  GRAPH_DATA.forests = [...forestsById.values()];
  return changed;
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
  updateBadgeCountAnimations();
  controls.update();
  publishGraphState();
  renderer.render(scene, camera);
}

function startCameraAnimation(targetPosition, targetLookAt, maxDistanceAfterAnimation = null, durationMs = 720) {
  lazyTileSuppressUntil = Math.max(lazyTileSuppressUntil, performance.now() + durationMs + 120);
  cameraAnimation = {
    startedAt: performance.now(),
    durationMs,
    fromPosition: camera.position.clone(),
    toPosition: targetPosition.clone(),
    fromTarget: controls.target.clone(),
    toTarget: targetLookAt.clone(),
    maxDistanceAfterAnimation
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
    if (Number.isFinite(cameraAnimation.maxDistanceAfterAnimation)) {
      controls.maxDistance = Math.max(controls.minDistance + 1, cameraAnimation.maxDistanceAfterAnimation);
    }
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

function startVisibleRefit(options = {}) {
  if (nodeRefitTimer) {
    clearTimeout(nodeRefitTimer);
    nodeRefitTimer = null;
  }
  refitVisibleNodes({
    immediate: false,
    previousVisibleNodeIds: options.previousVisibleNodeIds
  });
  if (options.fitCamera) {
    semanticZoomInputUntil = 0;
    fitCameraToVisibleTargets(true, options.durationMs ?? REFIT_ANIMATION_MS);
  }
}

function scheduleNodeRefit(delayMs = 100, options = {}) {
  if (nodeRefitTimer) {
    clearTimeout(nodeRefitTimer);
  }
  nodeRefitTimer = setTimeout(() => {
    nodeRefitTimer = null;
    startVisibleRefit(options);
  }, delayMs);
}

function refitVisibleNodes({ immediate = false, previousVisibleNodeIds = null } = {}) {
  const targets = layoutTargetsForCurrentView();
  let changed = false;
  for (const node of nodes) {
    const nextTarget = targets.get(node.id) ?? node.homePosition;
    if (!node.targetPosition || node.targetPosition.distanceToSquared(nextTarget) > 0.0001) {
      changed = true;
    }
    node.targetPosition = nextTarget;
  }
  if (!immediate && previousVisibleNodeIds instanceof Set) {
    changed = seedNewVisibleNodeEntries(previousVisibleNodeIds, targets) || changed;
  }
  if (immediate) {
    nodeLayoutAnimation = null;
    for (const node of nodes) {
      node.position.copy(node.targetPosition);
    }
    syncGraphObjects();
    return true;
  }
  if (!changed && !nodeLayoutAnimation) {
    syncGraphObjects();
    return false;
  }
  nodeLayoutAnimation = {
    startedAt: performance.now(),
    durationMs: REFIT_ANIMATION_MS,
    from: new Map(nodes.map(node => [node.id, node.position.clone()]))
  };
  return true;
}

function seedNewVisibleNodeEntries(previousVisibleNodeIds, targets) {
  let seeded = false;
  for (const node of nodes) {
    if (!visibleNodeIds.has(node.id) || previousVisibleNodeIds.has(node.id) || !targets.has(node.id)) {
      continue;
    }
    const target = node.targetPosition ?? targets.get(node.id);
    const anchor = semanticAnchorForNode(node, previousVisibleNodeIds).position;
    const entry = semanticEntryPosition(anchor, target, node.id);
    if (node.position.distanceToSquared(entry) > 0.0001) {
      node.position.copy(entry);
      seeded = true;
    }
  }
  if (seeded) {
    syncGraphObjects();
  }
  return seeded;
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
  return layoutCenterAnchor?.clone?.() ?? controls.target.clone();
}

function componentLayoutCenter(component) {
  const componentNodes = component?.nodes ?? [];
  const visibleComponentNodes = componentNodes.filter(node => visibleNodeIds.has(node.id));
  const sourceNodes = visibleComponentNodes.length ? visibleComponentNodes : componentNodes;
  if (!sourceNodes.length) {
    return controls.target.clone();
  }
  const center = new THREE.Vector3();
  for (const node of sourceNodes) {
    center.add(node.position);
  }
  return center.multiplyScalar(1 / sourceNodes.length);
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
      const seededComponentIds = new Map();
      for (const node of componentNodes) {
        if (node.componentId !== null && node.componentId !== undefined && String(node.componentId).trim()) {
          const componentId = String(node.componentId);
          seededComponentIds.set(componentId, (seededComponentIds.get(componentId) ?? 0) + 1);
        }
      }
      const componentId = [...seededComponentIds.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? index;
      for (const node of componentNodes) {
        node.componentId = componentId;
      }
      return { id: componentId, nodes: componentNodes };
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
    component.forestRepresentative = representative;
    component.memberCountEstimate = component.nodes.length;
    component.edgeCountEstimate = component.edges.length;
  }
}

function applyForestMetadata(allComponents, allForests = []) {
  for (const forest of allForests) {
    let component = componentForId(forest.componentId);
    if (!component) {
      component = {
        id: forest.componentId,
        nodes: [],
        edges: [],
        representative: null,
        forestRepresentative: null
      };
      allComponents.push(component);
      componentById.set(String(component.id), component);
    }
    component.forest = forest;
    component.forestRepresentative = representativeFromForest(forest);
    component.memberCountEstimate = Math.max(component.nodes.length, Number(forest.memberCount ?? 0));
    component.edgeCountEstimate = Math.max(component.edges?.length ?? 0, Number(forest.edgeCount ?? 0));
  }
}

function representativeFromForest(forest) {
  const name = String(forest?.representativeName ?? forest?.representativeUserId ?? forest?.componentId ?? '').trim();
  return {
    id: `forest:${forest.componentId}`,
    representativeUserId: String(forest?.representativeUserId ?? '').trim(),
    isForestSummary: true,
    name: name || String(forest.componentId),
    initials: String(forest?.representativeInitials ?? '').trim().slice(0, 3).toUpperCase() || 'F',
    gender: String(forest?.gender ?? '').trim().toLowerCase(),
    headline: Number(forest?.memberCount ?? 0) === 1 ? 'Isolated forest' : 'Most connected member',
    statusText: '',
    image: '',
    degree: Math.max(0, Math.trunc(Number(forest?.edgeCount ?? 0))),
    weightedDegree: Math.max(0, Number(forest?.weightedDegree ?? 0)),
    visibleDegree: 0,
    visibleWeightSum: 0,
    visibleStrongest: 0,
    collapseBadgeCount: 0,
    componentId: forest.componentId,
    forestMemberCount: Math.max(0, Math.trunc(Number(forest?.memberCount ?? 0))),
    forestEdgeCount: Math.max(0, Math.trunc(Number(forest?.edgeCount ?? 0)))
  };
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

function memberRepresentativeForComponent(component) {
  return component?.representative ?? component?.nodes?.[0] ?? null;
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
  const visualScale = graphVisualScaleMultiplier();
  node.radius = node.degree === 0 ? 2.45 : 2.1 + Math.min(0.85, Math.sqrt(node.degree) * 0.1);
  node.badgeScale = node.radius * 2 * visualScale;
}

function refreshGraphVisualSizing() {
  for (const node of nodes) {
    updateNodeBadgeSizing(node);
  }
  updateForestBadges();
  applyNodeState();
}

function forestBadgeScale(memberCount) {
  const count = Math.max(1, Math.trunc(Number(memberCount) || 1));
  const baseScale = count === 1 ? 8.8 : 11.2 + Math.sqrt(count) * 2.05;
  return baseScale * graphVisualScaleMultiplier();
}

function graphVisualScaleMultiplier() {
  const width = Math.max(1, window.innerWidth || 1);
  if (width >= 1280) {
    return 1.32;
  }
  if (width >= 900) {
    return 1.22;
  }
  if (width >= 700) {
    return 1.14;
  }
  return 1.08;
}

function graphMinimumFitDistance() {
  const width = Math.max(1, window.innerWidth || 1);
  if (width >= 1280) {
    return 30;
  }
  if (width >= 760) {
    return 28;
  }
  return 26;
}

function refreshNodeBadge(node) {
  updateNodeBadgeSizing(node);
  if (!node.badge?.material) {
    return;
  }
  const previousTexture = node.badge.material.map;
  node.badge.material.map = createNodeTexture(node, colorForNode(node, componentForId(node.componentId)));
  node.badge.material.needsUpdate = true;
  disposeTexture(previousTexture);
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

function createNodeTexture(node, ringColor) {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 256;
  canvasEl.height = 256;
  const ctx = canvasEl.getContext('2d');
  const texture = new THREE.CanvasTexture(canvasEl);
  texture.colorSpace = THREE.SRGBColorSpace;
  drawNodeTexture(ctx, node, ringColor);
  texture.needsUpdate = true;
  return texture;
}

function drawNodeTexture(ctx, node, ringColor) {
  ctx.clearRect(0, 0, 256, 256);
  const ringStyle = ringColor.getStyle();

  const fillColor = ringColor.clone().lerp(new THREE.Color(0x111317), 0.78);
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.fillStyle = fillColor.getStyle();
  ctx.fill();
  ctx.fillStyle = '#f4f7fb';
  ctx.font = '900 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((node.initials || '?').slice(0, 3), 128, 132);

  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.lineWidth = node.degree === 0 ? 16 : 13;
  ctx.strokeStyle = ringStyle;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(128, 128, 97, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.stroke();

  const count = nodeBadgeCount(node);
  if (count > 0) {
    drawCounterBadge(ctx, node, count);
  }
}

function drawCounterBadge(ctx, node, count, range = null) {
  const animation = node?.badgeCountAnimation;
  const progress = clamp(Number(animation?.progress ?? 1), 0, 1);
  const entering = animation && animation.from <= 0 && animation.to > 0;
  const leaving = animation && animation.to <= 0;
  const changing = animation && animation.from > 0 && animation.to > 0 && animation.from !== animation.to;
  const pop = animation ? Math.sin(progress * Math.PI) : 0;
  const scale = entering
    ? 0.72 + easeOutCubic(progress) * 0.28 + pop * 0.12
    : leaving
      ? 1 - easeOutCubic(progress) * 0.24
      : 1 + pop * 0.12;
  const radius = 34 * scale;
  const badgeStyle = counterBadgeStyleForAnimation(animation, count, range, progress);

  ctx.save();
  ctx.translate(198, 58);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = badgeStyle.color.getStyle();
  ctx.globalAlpha = leaving ? 1 - easeOutCubic(progress) : 1;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.86)';
  ctx.stroke();
  ctx.clip();

  if (changing) {
    const eased = easeOutCubic(progress);
    const direction = animation.to > animation.from ? -1 : 1;
    drawCounterBadgeLabel(ctx, animation.from, badgeStyle.fromTextColor, direction * eased * 22, 1 - eased);
    drawCounterBadgeLabel(ctx, animation.to, badgeStyle.toTextColor, direction * (eased - 1) * 22, eased);
  } else {
    drawCounterBadgeLabel(ctx, count, badgeStyle.textColor, 0, leaving ? 1 - easeOutCubic(progress) : 1);
  }

  ctx.restore();
}

function counterBadgeStyleForAnimation(animation, count, range, progress) {
  if (animation?.fromBadgeColor === undefined || animation?.toBadgeColor === undefined) {
    return range
      ? colorForCounterBadgeCount(count, range.min, range.max)
      : colorForCollapseBadgeCount(count);
  }

  const eased = easeOutCubic(progress);
  const fromColor = new THREE.Color(animation.fromBadgeColor);
  const toColor = new THREE.Color(animation.toBadgeColor);
  const textColor = eased < 0.5 ? animation.fromTextColor : animation.toTextColor;
  return {
    color: fromColor.lerp(toColor, eased),
    textColor,
    fromTextColor: animation.fromTextColor,
    toTextColor: animation.toTextColor
  };
}

function drawCounterBadgeLabel(ctx, count, textColor, yOffset, alpha) {
  const label = count > 99 ? '99+' : String(count);
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = textColor;
  ctx.font = label.length > 2 ? '850 24px system-ui, sans-serif' : '900 29px system-ui, sans-serif';
  ctx.fillText(label, 0, 2 + yOffset);
  ctx.restore();
}

function colorForCollapseBadgeCount(count) {
  return colorForCounterBadgeCount(count, collapseBadgeMin, collapseBadgeMax);
}

function colorForCounterBadgeCount(count, minCount, maxCount) {
  const min = Math.max(1, minCount);
  const max = Math.max(min, maxCount);
  const t = max === min
    ? clamp(count / Math.max(8, max), 0, 1)
    : clamp((count - min) / Math.max(1, max - min), 0, 1);
  const color = new THREE.Color(0xb9e6ff)
    .lerp(new THREE.Color(0xefb655), clamp(t * 1.25, 0, 1))
    .lerp(new THREE.Color(0xff2744), Math.max(0, (t - 0.52) / 0.48));
  return {
    color,
    textColor: t > 0.56 ? '#ffffff' : '#111317'
  };
}

function avatarImageUrlForNode(node) {
  return String(node?.image || node?.images?.[0] || '').trim();
}

function disposeTexture(texture) {
  if (!texture) {
    return;
  }
  texture.userData.disposed = true;
  texture.dispose?.();
}

function nodeBadgeCount(node) {
  return Math.max(0, Math.trunc(currentBadgeDisplayCount(node)));
}

function createForestTexture(component, fillColor) {
  const representative = forestRepresentativeForComponent(component) ?? { initials: '?' };
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
  ctx.fillText((representative.initials || '?').slice(0, 3), 128, 132);
  if (memberCount > 0) {
    drawCounterBadge(ctx, null, memberCount, forestCounterRange());
  }
  const texture = new THREE.CanvasTexture(canvasEl);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function forestCounterRange() {
  const counts = components
    .map(component => Math.max(1, Math.trunc(Number(component.memberCountEstimate ?? component.nodes?.length ?? 1))))
    .filter(Number.isFinite);
  return {
    min: counts.length ? Math.min(...counts) : 1,
    max: counts.length ? Math.max(...counts) : 1
  };
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

function seededAngle(text) {
  return (shellSortValue(text) / 0xffffffff) * Math.PI * 2;
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

async function loadInitialGraphData() {
  if (!window.parent || window.parent === window) {
    throw new Error('Affinity graph bridge is required.');
  }
  return await requestGraphData('initialGraph');
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
  const normalizedForests = (Array.isArray(data?.forests) ? data.forests : [])
    .map(normalizeGraphForest)
    .filter(Boolean);
  return {
    source: data?.source === 'http' ? 'http' : 'demo',
    layoutVersion: String(data?.layoutVersion ?? '').trim(),
    memberCount: positiveInteger(data?.memberCount, normalizedNodes.length),
    linkCount: positiveInteger(data?.linkCount, normalizedEdges.length),
    componentCount: positiveInteger(data?.componentCount ?? data?.forestCount, normalizedForests.length),
    isolatedCount: positiveInteger(data?.isolatedCount, 0),
    forestCount: positiveInteger(data?.forestCount ?? data?.componentCount, normalizedForests.length),
    forestLevel: positiveInteger(data?.forestLevel, 0),
    maxForestLevel: positiveInteger(data?.maxForestLevel, 0),
    maxZoom: positiveInteger(data?.maxZoom, 0),
    labels: normalizeGraphLabels(data?.labels),
    nodes: normalizedNodes,
    edges: normalizedEdges,
    forests: normalizedForests
  };
}

function graphLabel(key, values = {}) {
  const template = GRAPH_DATA.labels?.[key] ?? key;
  return interpolateGraphLabel(template, values);
}

function interpolateGraphLabel(template, values) {
  return String(template ?? '').replace(/\{(\w+)}/g, (_match, key) => {
    const value = values?.[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

function normalizeGraphLabels(labels) {
  if (!labels || typeof labels !== 'object') {
    return {};
  }
  const normalized = {};
  for (const [key, value] of Object.entries(labels)) {
    const normalizedKey = String(key ?? '').trim();
    const normalizedValue = String(value ?? '').trim();
    if (normalizedKey && normalizedValue) {
      normalized[normalizedKey] = normalizedValue;
    }
  }
  return normalized;
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

function normalizeGraphForest(forest) {
  const componentId = String(forest?.componentId ?? '').trim();
  if (!componentId) {
    return null;
  }
  const representativeUserId = String(forest?.representativeUserId ?? '').trim();
  const representativeName = String(forest?.representativeName ?? '').trim() || representativeUserId || componentId;
  const memberCount = Number.isFinite(Number(forest?.memberCount))
    ? Math.max(0, Math.trunc(Number(forest.memberCount)))
    : 0;
  const edgeCount = Number.isFinite(Number(forest?.edgeCount))
    ? Math.max(0, Math.trunc(Number(forest.edgeCount)))
    : 0;
  return {
    componentId,
    representativeUserId,
    representativeName,
    representativeInitials: String(forest?.representativeInitials ?? '').trim().slice(0, 3).toUpperCase()
      || initialsForName(representativeName)
      || 'F',
    gender: String(forest?.gender ?? '').trim().toLowerCase(),
    memberCount,
    edgeCount,
    weightedDegree: Number.isFinite(Number(forest?.weightedDegree)) ? Math.max(0, Number(forest.weightedDegree)) : 0,
    x: finiteOrNull(forest?.x) ?? 0,
    y: finiteOrNull(forest?.y) ?? 0,
    z: finiteOrNull(forest?.z) ?? 0,
    radius: Number.isFinite(Number(forest?.radius)) ? Math.max(0, Number(forest.radius)) : Math.max(3, Math.sqrt(memberCount) * 5.5)
  };
}

function initialsForName(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function positiveInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }
  return Math.trunc(number);
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

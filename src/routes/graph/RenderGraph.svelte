<script lang="ts">
	import { onMount } from 'svelte';
	import { DataSet } from 'vis-data';
	import { Network, type Node, type Edge } from 'vis-network';
	import type Graph from 'graphology';
	import { nip19 } from 'nostr-tools';
	import { toasts } from 'svelte-toasts';
	import { allSimplePaths } from 'graphology-simple-path';

	const renderData = {
		nodes: new DataSet<Node>(),
		edges: new DataSet<Edge>()
	};

	const physics = {
		enabled: true,
		barnesHut: {
			theta: 0,
			gravitationalConstant: -1000,
			centralGravity: 0.05,
			springLength: 80,
			springConstant: 3 * 10 ** -5,
			damping: 0.1,
			avoidOverlap: 1
		},
		solver: 'barnesHut'
	};

	export let graph: Graph<Node, Edge>;

	export let source: string | undefined;

	export let target: string | undefined;

	export let positiveReviewsEnabled: boolean;

	export let negativeReviewsEnabled: boolean;

	export function render() {
		function clearData() {
			renderData.nodes.clear();
			renderData.edges.clear();
		}

		if (!source && !target) {
			clearData();
			return;
		}

		function getData() {
			function defaultData() {
				const filteredGraph = graph.copy();

				const edgesToRemove = new Set<string>();

				filteredGraph.forEachEdge((edge) => {
					const edgeColor = graph.getEdgeAttribute(edge, 'color');

					if (!positiveReviewsEnabled) {
						if (edgeColor === 'green') edgesToRemove.add(edge);
					}

					if (!negativeReviewsEnabled) {
						if (edgeColor === 'red') edgesToRemove.add(edge);
					}
				});

				edgesToRemove.forEach((edge) => filteredGraph.dropEdge(edge));

				const nodesToRemove = new Set<string>();

				filteredGraph.forEachNode((node) => {
					if (node === source || node === target) return;

					const degree = filteredGraph.degree(node);

					if (degree <= 0) nodesToRemove.add(node);
				});

				nodesToRemove.forEach((node) => filteredGraph.dropNode(node));

				return {
					nodes: filteredGraph.nodes().map((node) => {
						const data = graph.getNodeAttributes(node);

						return {
							id: node,
							...data
						};
					}),
					edges: filteredGraph.edges().map((edge) => {
						const data = graph.getEdgeAttributes(edge);

						return {
							id: edge,
							...data
						};
					})
				};
			}

			if (!source || !target) return defaultData();

			const simplePaths = allSimplePaths(graph, source, target);

			const relevantPaths = simplePaths.filter((pathGroup) => {
				function pathHasProhibitedEdge(prohibitedColor: 'green' | 'red') {
					for (const i in pathGroup.slice(1)) {
						const previousNodeIndex = Number(i);

						const nodeIndex = Number(i) + 1;

						const node = pathGroup[nodeIndex];

						const previousNode = pathGroup[previousNodeIndex];

						const edgeId = graph.edge(previousNode, node)!;

						const edgeData = graph.getEdgeAttributes(edgeId);

						if (edgeData.color === prohibitedColor) return true;
					}

					return false;
				}

				if (!positiveReviewsEnabled) {
					if (pathHasProhibitedEdge('green')) return false;
				}

				if (!negativeReviewsEnabled) {
					if (pathHasProhibitedEdge('red')) return false;
				}

				return true;
			});

			const relevantNodes = new Set<string>([source, target]);

			const relevantEdgeCombinations = new Set<string>();

			relevantPaths.forEach((nodeGroup) => nodeGroup.forEach((node) => relevantNodes.add(node)));

			relevantPaths.forEach((path) =>
				path.slice(1).forEach((node, i) => {
					const previousNodeIndex = i;

					const previousNode = path[previousNodeIndex];

					const edgeCombination = `${previousNode}:${node}`;

					relevantEdgeCombinations.add(edgeCombination);
				})
			);

			const nodes = graph
				.filterNodes((node) => relevantNodes.has(node))
				.map((node) => {
					const data = graph.getNodeAttributes(node);

					return {
						id: node,
						...data
					};
				});

			const edges = graph
				.filterEdges((edge) => {
					const data = graph.getEdgeAttributes(edge);

					const edgeIndex = `${data.from}:${data.to}`;

					return relevantEdgeCombinations.has(edgeIndex);
				})
				.map((edge) => {
					const data = graph.getEdgeAttributes(edge);

					return {
						id: edge,
						...data
					};
				});

			return {
				nodes,
				edges
			};
		}

		const { nodes, edges } = getData();

		if (nodes.length === 0 && edges.length === 0) {
			clearData();
			return;
		}

		nodes.forEach((node) => renderData.nodes.update(node));
		edges.forEach((edge) => renderData.edges.update(edge));

		function clearOldNodes() {
			if (nodes.length === renderData.nodes.length) return;

			const nodeIds = nodes.map((node) => node.id!);

			const excludedNodeIds = renderData.nodes
				.map((node) => node.id!)
				.filter((node) => !nodeIds.includes(node));

			renderData.nodes.remove(excludedNodeIds);
		}

		function clearOldEdges() {
			if (edges.length === renderData.edges.length) return;

			const edgeIds = edges.map((edge) => edge.id!);

			const excludedEdgeIds = renderData.edges
				.map((edge) => edge.id!)
				.filter((edge) => !edgeIds.includes(edge));

			renderData.edges.remove(excludedEdgeIds);
		}

		clearOldNodes();
		clearOldEdges();
	}

	$: positiveReviewsEnabled, negativeReviewsEnabled, render();

	interface HoverWidths {
		width: number;
		hoverWidth: number;
	}

	export let nodeWidths: HoverWidths;

	export let edgeWidths: HoverWidths;

	export let physicsEnabled: boolean;

	let graphContainer: HTMLDivElement;

	let network: Network | undefined;

	interface TogglePhysicsParams {
		physicsEnabled: boolean;
	}

	function togglePhysics({ physicsEnabled }: TogglePhysicsParams) {
		network?.setOptions({
			physics: physicsEnabled ? physics : false
		});
	}

	$: togglePhysics({ physicsEnabled });

	onMount(() => {
		network = new Network(graphContainer, renderData, {
			physics: physicsEnabled ? physics : false,
			nodes: {
				shape: 'circularImage',
				font: {
					size: 40
				},
				brokenImage: '/avatar.svg',
				chosen: false,
				color: '#6b7891',
				borderWidth: nodeWidths.width
			},
			groups: {
				principal: {
					size: 128
				},
				common: {
					size: 64
				}
			},
			edges: {
				width: edgeWidths.width,
				arrows: {
					to: true
				},
				chosen: false,
				smooth: {
					type: 'continuous',
					enabled: true,
					forceDirection: 'none',
					roundness: 0.1
				}
			},
			interaction: { hover: true }
		});

		network.on('hoverNode', (event) => {
			const nodeId = event.node as string;

			renderData.nodes.update({
				id: nodeId,
				borderWidth: nodeWidths.hoverWidth
			});
		});

		network.on('blurNode', (event) => {
			const nodeId = event.node as string;

			renderData.nodes.update({
				id: nodeId,
				borderWidth: nodeWidths.width
			});
		});

		network.on('hoverEdge', (event) => {
			const edgeId = event.edge as string;

			renderData.edges.update({
				id: edgeId,
				width: edgeWidths.hoverWidth
			});
		});

		network.on('blurEdge', (event) => {
			const edgeId = event.edge as string;

			renderData.edges.update({
				id: edgeId,
				width: edgeWidths.width
			});
		});

		network.on('click', async (event) => {
			const nodes = event.nodes as string[];

			const edges = event.edges as string[];

			function getActionType() {
				if (nodes.length === 1) return 'pubkey';

				if (edges.length === 1) return 'rating';
			}

			const actionType = getActionType();

			if (!actionType) return;

			const actions = {
				pubkey: async () => {
					const [node] = nodes;

					const npub = nip19.npubEncode(node);

					await navigator.clipboard.writeText(npub);

					toasts.success({
						title: 'Copied!',
						description: 'NPUB copied to clipboard!'
					});
				},
				rating: async () => {
					const [edge] = edges;

					const edgeData = graph.getEdgeAttributes(edge);

					const fromNpub = nip19.npubEncode(edgeData.from as string);

					const toNpub = nip19.npubEncode(edgeData.to as string);

					const url = new URL('/table', window.location.origin);

					url.searchParams.set('rater', fromNpub);

					url.searchParams.set('rated', toNpub);

					window.open(url.toString(), '_blank');
				}
			} as Record<typeof actionType, () => Promise<void>>;

			await actions[actionType]?.();
		});

		network.moveTo({ position: { x: 0, y: 0 }, scale: 0.5 });
	});
</script>

<div bind:this={graphContainer} class="w-full flex-1 bg-slate-400" />

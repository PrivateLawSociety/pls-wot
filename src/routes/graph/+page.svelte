<script lang="ts">
	import Graph from 'graphology';
	import { Network, type Node, type Edge } from 'vis-network';
	import 'vis-network/styles/vis-network.css';
	import { DataSet } from 'vis-data';
	import { onMount } from 'svelte';

	import { dfsFromNode } from 'graphology-traversal';
	import {
		getProfileMetadata,
		nostrAuth,
		parseProfileFromJsonString,
		relayList,
		relayPool,
		type ProfileType,
		type Rating
	} from '$lib/nostr';
	import type { SubCloser } from 'nostr-tools/abstract-pool';
	import { ReviewEvent } from '$lib';
	import { npubEncode } from 'nostr-tools/nip19';
	import GraphRatingText from '$lib/components/GraphRatingText.svelte';
	import { renderVirtualSvelteElement } from '$lib/rendering';
	import { Input, Label } from 'flowbite-svelte';

	interface GraphRating extends Rating {
		parentRatings: GraphRating[];
		childrenRatings: GraphRating[];
		currentDepth: number;
	}

	let ratings: GraphRating[] = [];

	const subscriptions: SubCloser[] = [];

	let ratingsCount: number = 0;

	let pubkey: string | undefined = nostrAuth.getPubkey();

	let graph: Graph<Node, Edge> = new Graph();

	interface SubscribeRatingEventsParams {
		depth: number;
		originalPubkey: string;
	}

	async function subscribeRatingEvents({ depth, originalPubkey }: SubscribeRatingEventsParams) {
		ratingsCount = 0;
		// Empty older subscriptions in favor of new ones (ideally it will never occurs)
		subscriptions.forEach((subscription) => subscription.close());
		subscriptions.splice(0);

		async function startEventHandling(
			pubkey: string,
			currentDepth: number,
			parentRating?: GraphRating
		): Promise<GraphRating[]> {
			const baseRatings: GraphRating[] = [];

			const subscription = relayPool.subscribeMany(
				relayList,
				[
					{
						authors: [pubkey],
						kinds: [ReviewEvent],
						'#l': ['pls-wot-rating']
					}
				],
				{
					async onevent(e) {
						try {
							const c = JSON.parse(e.content);

							const from: ProfileType = {
								npub: npubEncode(c.from),
								pubkey: e.pubkey
							};

							const to: ProfileType = {
								npub: npubEncode(c.to),
								pubkey: c.to
							};

							const newRating: GraphRating = {
								eventId: e.id,
								from,
								to,
								date: e.created_at * 1000,
								score: c.score,
								businessAlreadyDone: c.businessAlreadyDone,
								description: c.description,
								parentRatings: [],
								childrenRatings: [],
								currentDepth
							};

							const ratingIndex = baseRatings.findIndex((r) => r.eventId === newRating.eventId);

							if (ratingIndex >= 0) {
								const oldRating = baseRatings[ratingIndex];

								if (parentRating) {
									const parentRatingIndex = oldRating.parentRatings.findIndex(
										(p) => p.eventId === parentRating.eventId
									);

									if (parentRatingIndex >= 0) {
										oldRating.parentRatings[parentRatingIndex] = parentRating;
									} else {
										oldRating.parentRatings.push(parentRating);
									}
								}

								baseRatings[ratingIndex] = newRating;
							} else {
								if (parentRating) newRating.parentRatings.push(parentRating);

								baseRatings.push(newRating);

								if (currentDepth < depth) {
									const childrenRatings = await startEventHandling(
										to.pubkey,
										currentDepth + 1,
										newRating
									);
									newRating.childrenRatings = childrenRatings;
								}
							}

							await Promise.all([getProfileMetadata(c.from), getProfileMetadata(c.to)])
								.then(([fromEvent, toEvent]) => {
									Object.assign(from, parseProfileFromJsonString(fromEvent?.content || '{}', from));

									Object.assign(to, parseProfileFromJsonString(toEvent?.content || '{}', to));
								})
								.catch((error) => {
									console.error('Error when processing the profile metadata:', error);
								});

							populateGraph({ pubkey: originalPubkey, ratings: baseRatings });
							// renderGraph({ pubkey: originalPubkey, ratings });
						} catch (err) {
							console.error('Error processing the event:', err);
						}
					}
				}
			);

			subscriptions.push(subscription);

			return baseRatings;
		}

		ratings = await startEventHandling(originalPubkey, 0);
	}

	interface RenderGraphParams {
		pubkey?: string;
		ratings: GraphRating[];
	}

	interface PopupateGraphParams {
		pubkey: string;
		ratings: GraphRating[];
	}

	async function populateGraph({ pubkey, ratings }: PopupateGraphParams) {
		if (ratings.length === 0) return;

		if (!graph.hasNode(pubkey)) {
			const profileMetadata = await getProfileMetadata(pubkey);
			const parsedMetadata = parseProfileFromJsonString(profileMetadata?.content || '{}', {
				pubkey
			});
			const displayName = parsedMetadata.displayName || parsedMetadata.display_name;

			const titleText = displayName ? `${displayName} (You)` : '(You)';

			graph.addNode(pubkey, {
				x: 0,
				y: 256,
				size: 96,
				label: titleText,
				title: titleText,
				image: parsedMetadata.picture
			});
		}

		ratings.forEach((rating, i) => {
			const profile = rating.to;

			if (graph.hasNode(profile.pubkey)) return;

			const evenRatings = ratings.length % 2 === 0;

			const middle = ratings.length / 2;

			const x = evenRatings ? i - middle + 0.5 : i - middle;

			const displayName = profile.displayName || profile.display_name || profile.name;

			graph.addNode(profile.pubkey, {
				label: displayName || 'Unknown (No profile name)',
				x: x * 256,
				y: -rating.currentDepth * 512,
				size: 64,
				title: displayName || 'Unknown (No profile name)',
				image: profile.picture
			});
		});

		ratings.forEach((rating) => {
			const ratingComponent = renderVirtualSvelteElement(GraphRatingText, {
				text: rating.description
			});

			graph.mergeDirectedEdge(rating.from.pubkey, rating.to.pubkey, {
				from: rating.from.pubkey,
				to: rating.to.pubkey,
				color: rating.score ? 'green' : 'red',
				dashes: rating.businessAlreadyDone ? undefined : [2, 2, 10, 10],
				title: ratingComponent
			});
		});
	}

	$: if (pubkey) subscribeRatingEvents({ originalPubkey: pubkey, depth: 3 });

	let graphContainer: HTMLDivElement;

	onMount(() => {
		const data = {
			nodes: new DataSet<Node>(),
			edges: new DataSet<Edge>()
		};

		const network = new Network(graphContainer, data, {
			physics: {
				enabled: true,
				repulsion: {
					centralGravity: 0.1,
					springLength: 100,
					springConstant: 10 ** -4,
					nodeDistance: 100 // Increase this value to create more space
				},
				solver: 'repulsion' // You can also try 'barnesHut' or 'hierarchicalRepulsion'
			},
			nodes: {
				shape: 'circularImage',
				font: {
					size: 40
				}
			},
			edges: {
				width: 5,
				arrows: {
					to: true
				}
			},
			autoResize: true,
			interaction: { hover: true }
		});

		// Necessary to handle popups
		network.on('hoverEdge', () => {});
		network.on('blurEdge', () => {});

		network.moveTo({ position: { x: 0, y: 0 }, scale: 0.5 });

		graph.on('nodeAdded', (node) => {
			data.nodes.add({
				id: node.key,
				...node.attributes
			});
		});

		graph.on('nodeDropped', (node) => {
			data.nodes.remove(node.key);
		});

		graph.on('nodeAttributesUpdated', (node) => {
			data.nodes.update({
				id: node.key,
				...node.attributes
			});
		});

		graph.on('edgeAdded', (edge) => {
			data.edges.add({
				id: edge.key,
				...edge.attributes
			});
		});

		graph.on('edgeDropped', (edge) => {
			data.edges.remove(edge.key);
		});

		graph.on('edgeAttributesUpdated', (edge) => {
			data.edges.update({
				id: edge.key,
				...edge.attributes
			});
		});

		// removeIrrelevantEdges(graph, yourPubkey, otherPubkey);
	});

	function removeIrrelevantEdges(graph: Graph, sourceNode: string, targetNode: string) {
		const reachableNodes = new Set<string>([sourceNode, targetNode]);

		dfsFromNode(
			graph,
			sourceNode,
			(key) => {
				reachableNodes.add(key);
			},
			{
				mode: 'out'
			}
		);

		graph
			.filterNodes((node) => !reachableNodes.has(node))
			.forEach((node) => {
				graph.dropNode(node);
			});
	}
</script>

<div class="flex w-full flex-col flex-wrap items-center justify-center gap-8 p-4">
	<div class="flex flex-col">
		<Label for="filterFrom" class="font-semibold">Main rater npub</Label>
		<Input id="filterFrom" placeholder="Enter main rater npub" autocomplete="off" />
	</div>

	<div>
		<Label for="filterTo">
			<Input id="filterTo" placeholder="Enter target npub" autocomplete="off" />
		</Label>
	</div>
</div>

<div bind:this={graphContainer} class="h-full w-full bg-slate-400" />

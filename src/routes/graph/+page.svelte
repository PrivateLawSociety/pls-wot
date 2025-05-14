<script lang="ts">
	import Graph from 'graphology';
	import { Network, type Node, type Edge } from 'vis-network';
	import 'vis-network/styles/vis-network.css';
	import { DataSet } from 'vis-data';
	import { onMount } from 'svelte';

	import { allSimplePaths } from 'graphology-simple-path';
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
	import { nip19 } from 'nostr-tools';
	import GraphRatingText from '$lib/components/GraphRatingText.svelte';
	import { renderVirtualSvelteElement } from '$lib/rendering';
	import { Helper, Input, Label } from 'flowbite-svelte';

	interface GraphRating extends Rating {
		parentRatings: GraphRating[];
		childrenRatings: GraphRating[];
		currentDepth: number;
	}

	const depth = 3;

	const subscriptions: Record<string, SubCloser> = {};

	let ratings: GraphRating[] = [];

	let pubkey: string | undefined = loadPubkey();

	let npub: string | undefined = loadNpub();

	let processNpubError: boolean = false;

	let graph: Graph<Node, Edge> = new Graph();

	function loadNpub() {
		const pubkey = nostrAuth.getPubkey();

		if (!pubkey) return;

		return nip19.npubEncode(pubkey);
	}

	function loadPubkey() {
		return nostrAuth.getPubkey();
	}

	function updatePubkey(npub: string | undefined) {
		function clearPubkey(error: boolean) {
			processNpubError = error;
			pubkey = undefined;
		}

		function setPubkey(newPubkey: string) {
			pubkey = newPubkey;
			processNpubError = false;
		}

		if (!npub) {
			return void clearPubkey(false);
		}

		try {
			const newPubkey = nip19.decode(npub);

			if (newPubkey.type !== 'npub') {
				return clearPubkey(true);
			}

			setPubkey(newPubkey.data);
		} catch {
			clearPubkey(true);
		}
	}

	$: updatePubkey(npub);

	let targetPubkey: string | undefined = undefined;

	let targetNpub: string | undefined = undefined;

	let processTargetNpubError: boolean = false;

	let updatedTargetPubkey: boolean = false;

	function updateTargetPubkey(targetNpub: string | undefined) {
		function clearPubkey(error: boolean) {
			processTargetNpubError = error;
			targetPubkey = undefined;
			updatedTargetPubkey = true;
		}

		function setPubkey(newPubkey: string) {
			targetPubkey = newPubkey;
			processTargetNpubError = false;
			updatedTargetPubkey = true;
		}

		if (!targetNpub) {
			return void clearPubkey(false);
		}

		try {
			const newTargetPubkey = nip19.decode(targetNpub);

			if (newTargetPubkey.type !== 'npub') {
				return void clearPubkey(true);
			}

			setPubkey(newTargetPubkey.data);
		} catch {
			clearPubkey(true);
		}
	}

	$: updateTargetPubkey(targetNpub);

	interface SubscribeRatingEventsParams {
		depth: number;
		originalPubkey: string;
	}

	async function subscribeRatingEvents({ depth, originalPubkey }: SubscribeRatingEventsParams) {
		// Empty older subscriptions in favor of new ones (ideally it will never occurs)
		for (const pubkey of Object.keys(subscriptions)) {
			const subscription = subscriptions[pubkey];
			subscription.close();
			delete subscriptions[pubkey];
		}

		async function startEventHandling(
			pubkey: string,
			currentDepth: number,
			parentRating?: GraphRating
		): Promise<GraphRating[]> {
			const baseRatings: GraphRating[] = [];

			const subscription =
				subscriptions[pubkey] ||
				relayPool.subscribeMany(
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
									npub: nip19.npubEncode(c.from),
									pubkey: e.pubkey
								};

								const to: ProfileType = {
									npub: nip19.npubEncode(c.to),
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

								Promise.all([getProfileMetadata(c.from), getProfileMetadata(c.to)])
									.then(([fromEvent, toEvent]) => {
										Object.assign(
											from,
											parseProfileFromJsonString(fromEvent?.content || '{}', from)
										);
										Object.assign(to, parseProfileFromJsonString(toEvent?.content || '{}', to));

										populateGraph({ rating: newRating });
									})
									.catch((error) => {
										console.error('Error when processing the profile metadata:', error);
									});

								populateGraph({ rating: newRating });
							} catch (err) {
								console.error('Error processing the event:', err);
							}
						}
					}
				);

			subscriptions[pubkey] = subscription;

			return baseRatings;
		}

		ratings = await startEventHandling(originalPubkey, 0);
	}

	interface AddSelfNodeParams {
		pubkey: string;
	}

	async function addSelfNode({ pubkey }: AddSelfNodeParams) {
		const profileMetadata = await getProfileMetadata(pubkey);
		const parsedMetadata = parseProfileFromJsonString(profileMetadata?.content || '{}', {
			pubkey
		});
		const displayName = parsedMetadata.displayName || parsedMetadata.display_name;

		const titleText = displayName ? `${displayName} (You)` : '(You)';

		graph.mergeNode(pubkey, {
			size: 96,
			label: titleText,
			title: titleText,
			image: parsedMetadata.picture || '/avatar.svg'
		});
	}

	$: if (pubkey) addSelfNode({ pubkey });

	interface PopupateGraphParams {
		rating: GraphRating;
	}

	async function populateGraph({ rating }: PopupateGraphParams) {
		const profile = rating.to;

		(() => {
			if (profile.pubkey === pubkey) return;

			const username = profile.displayName || profile.display_name || profile.name;

			const displayName = username || 'Unknown (No profile name)';

			const image = profile.picture || '/avatar.svg';

			if (graph.hasNode(profile.pubkey)) {
				graph.mergeNode(profile.pubkey, {
					label: displayName,
					title: displayName,
					image
				});
			} else {
				graph.addNode(profile.pubkey, {
					label: displayName,
					size: 64,
					title: displayName,
					image
				});
			}
		})();

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
	}

	$: if (pubkey) subscribeRatingEvents({ originalPubkey: pubkey, depth });

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
					springConstant: 10 ** -5,
					nodeDistance: 150
				},
				solver: 'repulsion'
			},
			nodes: {
				shape: 'circularImage',
				font: {
					size: 40
				},
				brokenImage: '/avatar.svg',
				color: '#6b7891'
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
	});

	interface RemoveIrrelevantEdgesParams {
		sourcePubkey: string;
		targetPubkey: string;
	}

	function removeIrrelevantEdges({ sourcePubkey, targetPubkey }: RemoveIrrelevantEdgesParams) {
		const relevantPaths = allSimplePaths(graph, sourcePubkey, targetPubkey);

		const relevantNodes = new Set<string>();
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

		graph
			.filterNodes((node) => !relevantNodes.has(node))
			.forEach((node) => {
				graph.dropNode(node);
			});

		const edgesToMaintain = graph.filterEdges((edge) => {
			const edgeData = graph.getEdgeAttributes(edge);

			const edgeIndex = `${edgeData.from}:${edgeData.to}`;

			return relevantEdgeCombinations.has(edgeIndex);
		});

		graph
			.filterEdges((edge) => !edgesToMaintain.includes(edge))
			.forEach((edge) => graph.dropEdge(edge));
	}

	$: if (pubkey && targetPubkey)
		removeIrrelevantEdges({
			sourcePubkey: pubkey,
			targetPubkey: targetPubkey
		});

	interface RepopulateGraph {
		ratings: GraphRating[];
	}

	async function repopulateGraph({ ratings }: RepopulateGraph) {
		await Promise.all(
			ratings.map(async (rating) => {
				await populateGraph({ rating });

				await repopulateGraph({ ratings: rating.childrenRatings });
			})
		);
	}

	$: if (pubkey && !targetPubkey && updatedTargetPubkey) repopulateGraph({ ratings });
</script>

<div class="flex flex-col items-center gap-8 pt-4">
	<div class="flex w-full flex-wrap justify-center gap-4">
		<div class="flex flex-col">
			<Label for="filterFrom" class="font-semibold">Main rater npub</Label>
			<Input
				id="filterFrom"
				placeholder="Enter main rater npub"
				bind:value={npub}
				autocomplete="off"
			/>
			{#if processNpubError}
				<Helper class="mt-2" color="red">
					<span class="font-bold">Invalid npub</span>
				</Helper>
			{/if}
		</div>

		<div>
			<Label for="filterTo">Target rated npub</Label>
			<Input
				id="filterTo"
				placeholder="Enter target npub"
				bind:value={targetNpub}
				autocomplete="off"
			/>
			{#if processTargetNpubError}
				<Helper class="mt-2" color="red">
					<span>Invalid npub</span>
				</Helper>
			{/if}
		</div>
	</div>
</div>

<div class="flex w-full flex-col flex-wrap items-center justify-center gap-8 p-4"></div>

<div bind:this={graphContainer} class="h-full w-full bg-slate-400" />

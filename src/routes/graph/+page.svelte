<script lang="ts">
	import Graph from 'graphology';
	import type { Node, Edge } from 'vis-network';
	import 'vis-network/styles/vis-network.css';
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
	import { Checkbox, Helper, Input, Label } from 'flowbite-svelte';
	import RenderGraph from './RenderGraph.svelte';

	const depth = 3;

	const nodeWidths = {
		width: 5,
		hoverWidth: 10
	};

	const edgeWidths = {
		width: 5,
		hoverWidth: 10
	};

	const subscriptions: Record<string, SubCloser> = {};

	const graph: Graph<Node, Edge> = new Graph();

	interface GraphRating extends Rating {
		parentRatings: GraphRating[];
		childrenRatings: GraphRating[];
		currentDepth: number;
	}

	let ratings: GraphRating[] = [];

	let pubkey: string | undefined = loadPubkey();

	let npub: string | undefined = loadNpub();

	let processNpubError: boolean = false;

	function loadPubkey() {
		return nostrAuth.getPubkey();
	}

	function loadNpub() {
		const pubkey = nostrAuth.getPubkey();

		if (!pubkey) return;

		return nip19.npubEncode(pubkey);
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

	function updateTargetPubkey(targetNpub: string | undefined) {
		function clearPubkey(error: boolean) {
			processTargetNpubError = error;
			targetPubkey = undefined;
		}

		function setPubkey(newPubkey: string) {
			targetPubkey = newPubkey;
			processTargetNpubError = false;
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
		fromTarget: boolean;
	}

	async function subscribeRatingEvents({
		depth,
		originalPubkey,
		fromTarget
	}: SubscribeRatingEventsParams) {
		clearGraph();

		interface StartEventHandlingParams {
			pubkey: string;
			currentDepth: number;
			relatedRating?: GraphRating;
			relatedIsParent?: boolean;
		}

		async function startEventHandling({
			pubkey,
			currentDepth,
			relatedRating,
			relatedIsParent
		}: StartEventHandlingParams): Promise<GraphRating[]> {
			const baseRatings: GraphRating[] = [];

			const subscription =
				subscriptions[pubkey] ||
				relayPool.subscribeMany(
					relayList,
					[
						{
							authors: relatedIsParent ? [pubkey] : undefined,
							'#d': relatedIsParent ? undefined : ['pls-wot-rating-' + pubkey],
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

								const relatedRatingArr = relatedIsParent ? 'parentRatings' : 'childrenRatings';

								const fallbackRelatedRatingArr = relatedIsParent
									? 'childrenRatings'
									: 'parentRatings';

								if (ratingIndex >= 0) {
									const oldRating = baseRatings[ratingIndex];

									if (relatedRating) {
										const relatedRatingIndex = oldRating[relatedRatingArr].findIndex(
											(p) => p.eventId === relatedRating.eventId
										);

										if (relatedRatingIndex >= 0) {
											oldRating[relatedRatingArr][relatedRatingIndex] = relatedRating;
										} else {
											oldRating[relatedRatingArr].push(relatedRating);
										}
									}

									baseRatings[ratingIndex] = newRating;
								} else {
									if (relatedRating) newRating[relatedRatingArr].push(relatedRating);

									baseRatings.push(newRating);

									const currentDepthCheck = relatedIsParent
										? currentDepth < depth
										: currentDepth > 0;

									const currentDepthIncrement = currentDepth + (relatedIsParent ? 1 : -1);

									if (currentDepthCheck) {
										const pubkey = relatedIsParent ? to.pubkey : from.pubkey;

										const fallbackRatings = await startEventHandling({
											pubkey,
											currentDepth: currentDepthIncrement,
											relatedRating: newRating,
											relatedIsParent
										});
										newRating[fallbackRelatedRatingArr] = fallbackRatings;
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

		ratings = await startEventHandling({
			pubkey: originalPubkey,
			currentDepth: fromTarget ? depth : 0,
			relatedIsParent: !fromTarget
		});
	}

	function clearGraph() {
		for (const pubkey of Object.keys(subscriptions)) {
			const subscription = subscriptions[pubkey];
			subscription.close();
			delete subscriptions[pubkey];
		}

		graph.clear();

		ratings = [];
	}

	$: if (!npub && !targetNpub) clearGraph();

	interface UpdateSelfNodeParams {
		pubkey: string;
	}

	async function updateSelfNode({ pubkey }: UpdateSelfNodeParams) {
		const profileMetadata = await getProfileMetadata(pubkey);
		const parsedMetadata = parseProfileFromJsonString(profileMetadata?.content || '{}', {
			pubkey
		});
		const displayName =
			parsedMetadata.displayName || parsedMetadata.display_name || parsedMetadata.name;

		const titleText = displayName ? `${displayName} (You)` : '(You)';

		graph.mergeNode(pubkey, {
			label: titleText,
			title: titleText,
			image: parsedMetadata.picture || '/avatar.svg',
			color: 'mediumblue',
			group: 'principal'
		});
	}

	$: if (pubkey) updateSelfNode({ pubkey });

	interface UpdateTargetNodeParams {
		pubkey: string;
	}

	async function updateTargetNode({ pubkey }: UpdateTargetNodeParams) {
		const profileMetadata = await getProfileMetadata(pubkey);
		const parsedMetadata = parseProfileFromJsonString(profileMetadata?.content || '{}', {
			pubkey
		});
		const displayName =
			parsedMetadata.displayName || parsedMetadata.display_name || parsedMetadata.name;

		const titleText = displayName ? `${displayName} (Target)` : '(Target)';

		graph.mergeNode(pubkey, {
			label: titleText,
			title: titleText,
			image: parsedMetadata.picture || '/avatar.svg',
			color: 'yellow',
			group: 'principal'
		});
	}

	$: if (targetPubkey) updateTargetNode({ pubkey: targetPubkey });

	interface PopupateGraphParams {
		rating: GraphRating;
	}

	async function populateGraph({ rating }: PopupateGraphParams) {
		if (pubkey && !graph.hasNode(pubkey)) {
			await updateSelfNode({ pubkey });
		}

		if (targetPubkey && !graph.hasNode(pubkey)) {
			await updateTargetNode({ pubkey: targetPubkey });
		}

		async function mergeNode(profile: ProfileType) {
			if (profile.pubkey === pubkey) return;

			if (profile.pubkey === targetPubkey) return;

			const username = profile.displayName || profile.display_name || profile.name;

			const displayName = username || 'Unknown (No profile name)';

			const image = profile.picture || '/avatar.svg';

			graph.mergeNode(profile.pubkey, {
				label: displayName,
				title: displayName,
				image,
				color: undefined,
				group: 'common'
			});
		}

		await Promise.all([mergeNode(rating.from), mergeNode(rating.to)]);

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

	$: if ((pubkey && !targetPubkey) || (targetPubkey && !pubkey))
		subscribeRatingEvents({
			originalPubkey: pubkey || (targetPubkey as string),
			depth,
			fromTarget: !pubkey
		});

	let physicsEnabled = true;

	let renderGraph: RenderGraph;

	onMount(() => {
		graph.on('nodeAdded', (node) => {
			renderGraph.render({ nodes: [node.key] });
		});

		graph.on('nodeDropped', (node) => {
			renderGraph.render({ nodes: [node.key] });
		});

		graph.on('nodeAttributesUpdated', (node) => {
			renderGraph.render({ nodes: [node.key] });
		});

		graph.on('edgeAdded', (edge) => {
			renderGraph.render({ edges: [edge.key] });
		});

		graph.on('edgeDropped', (edge) => {
			renderGraph.render({ edges: [edge.key] });
		});

		graph.on('edgeAttributesUpdated', (edge) => {
			renderGraph.render({ edges: [edge.key] });
		});

		graph.on('cleared', () => {
			renderGraph.render();
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

	$: if (pubkey && targetPubkey) {
		removeIrrelevantEdges({
			sourcePubkey: pubkey,
			targetPubkey: targetPubkey
		});
		updateSelfNode({ pubkey });
		updateTargetNode({ pubkey: targetPubkey });
	}

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

	$: if ((pubkey && !targetPubkey) || (!pubkey && targetPubkey)) repopulateGraph({ ratings });
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
	<div class="flex flex-col items-center gap-8 p-6">
		<div class="flex w-full flex-wrap items-center justify-center gap-4">
			<div class="flex flex-col">
				<Label for="filterFrom" class="font-semibold">Main rater npub (You)</Label>
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

			<div class="flex flex-col">
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

			<div class="flex flex-col">
				<Checkbox bind:checked={physicsEnabled}>Physics enabled</Checkbox>
			</div>
		</div>
	</div>

	<RenderGraph bind:this={renderGraph} nodeWidths={nodeWidths} edgeWidths={edgeWidths} bind:physicsEnabled={physicsEnabled} graph={graph} />
</div>

<script lang="ts">
	import Graph from 'graphology';
	import type { Node, Edge } from 'vis-network';
	import type { GraphRating, ReviewFilterType } from './types';
	import 'vis-network/styles/vis-network.css';

	import {
		getProfileMetadata,
		nostrAuth,
		parseProfileFromJsonString,
		relayList,
		relayPool,
		type ProfileType
	} from '$lib/nostr';
	import type { SubCloser } from 'nostr-tools/abstract-pool';
	import { ReviewEvent } from '$lib';
	import { nip19 } from 'nostr-tools';
	import GraphRatingText from '$lib/components/GraphRatingText.svelte';
	import { renderVirtualSvelteElement } from '$lib/rendering';
	import { Checkbox, Helper, Input, Label, Select } from 'flowbite-svelte';
	import RenderGraph from './RenderGraph.svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';

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

	let ratings: GraphRating[] = [];

	let pageInitialized = false;

	const userPubkey = nostrAuth.getPubkey();

	let pubkey: string | undefined = loadPubkey();

	let npub: string | undefined = loadNpub();

	let processNpubError: boolean = false;

	function loadPubkey() {
		const urlNpub = page.url.searchParams.get('mainNpub');

		try {
			if (urlNpub) {
				const newPubkey = nip19.decode(urlNpub);

				if (newPubkey.type !== 'npub') {
					processNpubError = true;
					return;
				}

				return newPubkey.data;
			}
		} catch {
			processNpubError = true;
			return;
		}

		return nostrAuth.getPubkey();
	}

	function loadNpub() {
		const urlNpub = page.url.searchParams.get('mainNpub');

		if (urlNpub) return urlNpub;

		const pubkey = nostrAuth.getPubkey();

		if (!pubkey) return;

		const npub = nip19.npubEncode(pubkey);

		return npub;
	}

	function updatePubkey(npub: string | undefined) {
		function clearPubkey(error: boolean) {
			processNpubError = error;

			pubkey = undefined;
			page.url.searchParams.delete('mainNpub');
			replaceState(page.url, page.state);
		}

		function setPubkey(newPubkey: string) {
			processNpubError = false;

			pubkey = newPubkey;
			page.url.searchParams.set('mainNpub', npub!);
			replaceState(page.url, page.state);
		}

		if (!pageInitialized) return;

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

	let targetPubkey: string | undefined = loadTargetPubkey();

	let targetNpub: string | undefined = loadTargetNpub();

	let processTargetNpubError: boolean = false;

	function loadTargetPubkey() {
		const urlNpub = page.url.searchParams.get('targetNpub');

		try {
			if (!urlNpub) return;

			const newTargetPubkey = nip19.decode(urlNpub);

			if (newTargetPubkey.type !== 'npub') {
				processTargetNpubError = true;
				return;
			}

			return newTargetPubkey.data;
		} catch {
			processTargetNpubError = true;
			return;
		}
	}

	function loadTargetNpub() {
		const urlNpub = page.url.searchParams.get('targetNpub');

		if (urlNpub) return urlNpub;
	}

	function updateTargetPubkey(targetNpub: string | undefined) {
		function clearPubkey(error: boolean) {
			processTargetNpubError = error;

			targetPubkey = undefined;
			page.url.searchParams.delete('targetNpub');
			replaceState(page.url, page.state);
		}

		function setPubkey(newPubkey: string) {
			processTargetNpubError = false;

			targetPubkey = newPubkey;
			page.url.searchParams.set('targetNpub', targetNpub!);
			replaceState(page.url, page.state);
		}

		if (!pageInitialized) return;

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

	let firstSubscriptionEvent = true;

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
		firstSubscriptionEvent = false;
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

	$: if (!npub && !targetNpub) {
		clearGraph();

		renderGraph?.render();
	}

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

		const isUserPubkey = userPubkey && pubkey === userPubkey;

		const helperText = isUserPubkey ? '(You)' : '(Main rater)';

		const titleText = displayName ? `${displayName} ${helperText}` : helperText;

		const olderNodeId = graph.findNode((node) => {
			const nodeColor = graph.getNodeAttribute(node, 'color');

			if (nodeColor === 'mediumblue') return true;

			return false;
		});

		if (olderNodeId) {
			const profileMetadata = await getProfileMetadata(olderNodeId);
			const parsedMetadata = parseProfileFromJsonString(profileMetadata?.content || '{}', {
				pubkey
			});
			const displayName =
				parsedMetadata.displayName || parsedMetadata.display_name || parsedMetadata.name;

			graph.mergeNode(olderNodeId, {
				label: displayName,
				title: displayName,
				image: parsedMetadata.picture || '/avatar.svg',
				color: '#6b7492',
				group: 'common'
			});
		}

		graph.mergeNode(pubkey, {
			label: titleText,
			title: titleText,
			image: parsedMetadata.picture || '/avatar.svg',
			color: 'mediumblue',
			group: 'principal'
		});

		renderGraph?.render();
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

		const olderNodeId = graph.findNode((node) => {
			const nodeColor = graph.getNodeAttribute(node, 'color');

			if (nodeColor === 'yellow') return true;

			return false;
		});

		if (olderNodeId) {
			const profileMetadata = await getProfileMetadata(olderNodeId);
			const parsedMetadata = parseProfileFromJsonString(profileMetadata?.content || '{}', {
				pubkey
			});
			const displayName =
				parsedMetadata.displayName || parsedMetadata.display_name || parsedMetadata.name;

			graph.mergeNode(olderNodeId, {
				label: displayName,
				title: displayName,
				image: parsedMetadata.picture || '/avatar.svg',
				color: '#6b7492',
				group: 'common'
			});
		}

		graph.mergeNode(pubkey, {
			label: titleText,
			title: titleText,
			image: parsedMetadata.picture || '/avatar.svg',
			color: 'yellow',
			group: 'principal'
		});

		renderGraph?.render();
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
				color: '#6b7492',
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

		renderGraph?.render();
	}

	interface RenewSubscriptionsParams {
		pubkey?: string;
		targetPubkey?: string;
		firstSubscriptionEvent: boolean;
	}

	async function renewSubscriptions({
		pubkey,
		targetPubkey,
		firstSubscriptionEvent
	}: RenewSubscriptionsParams) {
		const originalPubkey = pubkey || targetPubkey;

		if (!originalPubkey) return;

		const ratingEventsProps: SubscribeRatingEventsParams = {
			originalPubkey,
			depth,
			fromTarget: !pubkey
		};

		if (firstSubscriptionEvent) {
			if (pubkey || targetPubkey) {
				await subscribeRatingEvents(ratingEventsProps);
			}

			return;
		}

		if ((pubkey && !targetPubkey) || (targetPubkey && !pubkey)) {
			await subscribeRatingEvents(ratingEventsProps);
		}
	}

	$: renewSubscriptions({ pubkey, targetPubkey, firstSubscriptionEvent });

	let physicsEnabled = true;

	let reviewFilter: ReviewFilterType = 'all';

	let renderGraph: RenderGraph | undefined;

	onMount(() => {
		pageInitialized = true;
	});
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
	<div class="flex flex-col items-center gap-8 p-6">
		<div class="flex w-full flex-wrap items-center justify-center gap-4">
			<div class="flex flex-col">
				<Label for="filterFrom" class="font-semibold"
					>Main rater npub {userPubkey && pubkey === userPubkey ? '(You)' : ''}</Label
				>
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
				<Label for="filterReview">Filter ratings type</Label>
				<div class="flex flex-row items-center gap-x-3">
					<Select
						id="filterReview"
						bind:value={reviewFilter}
						items={[
							{ value: 'all', name: 'All' },
							{ value: 'positive', name: '✅ Positive' },
							{ value: 'negative', name: '❌ Negative' }
						]}
					/>
				</div>
			</div>

			<div class="flex flex-col">
				<Checkbox bind:checked={physicsEnabled}>Physics enabled</Checkbox>
			</div>
		</div>
	</div>

	<RenderGraph
		bind:source={pubkey}
		bind:target={targetPubkey}
		bind:this={renderGraph}
		bind:reviewFilter
		bind:physicsEnabled
		{nodeWidths}
		{edgeWidths}
		{graph}
	/>
</div>

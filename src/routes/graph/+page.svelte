<script lang="ts">
	import Graph from 'graphology';
	import {
		isRatingFilterHadBusiness,
		isRatingFilterScore,
		type EdgeData,
		type GraphRating,
		type NodeData,
		type RatingFilterHadBusinessType,
		type RatingFilterScoreType
	} from './types';
	import 'vis-network/styles/vis-network.css';

	/*
	TODO:
	- Isolate renderization layer and data layer
	*/

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
	import { Button, Checkbox, Helper, Input, Label, Select } from 'flowbite-svelte';
	import RenderGraph from './RenderGraph.svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { toasts } from 'svelte-toasts';

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

	const graph: Graph<NodeData, EdgeData> = new Graph();

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

		page.url.searchParams.set('mainNpub', npub);
		replaceState(page.url, page.state);

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

	interface PopupateGraphParams {
		rating: GraphRating;
	}

	async function populateGraph({ rating }: PopupateGraphParams) {
		async function mergeNode(profile: ProfileType) {
			const username = profile.displayName || profile.display_name || profile.name;

			const displayName = username;

			graph.mergeNode(profile.pubkey, {
				displayName,
				picture: profile.picture
			});
		}

		await Promise.all([mergeNode(rating.from), mergeNode(rating.to)]);

		graph.mergeDirectedEdge(rating.from.pubkey, rating.to.pubkey, {
			from: rating.from.pubkey,
			to: rating.to.pubkey,
			score: rating.score,
			businessAlreadyDone: rating.businessAlreadyDone,
			description: rating.description
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

	let ratingScoreFilter: RatingFilterScoreType = loadRatingScoreFilter();

	function loadRatingScoreFilter(): RatingFilterScoreType {
		const urlRatingFilter = page.url.searchParams.get('ratingType');

		if (!urlRatingFilter) return 'all';

		if (!isRatingFilterScore(urlRatingFilter)) {
			return 'all';
		}

		return urlRatingFilter;
	}

	function updateRatingScoreFilterUrl(ratingFilter: RatingFilterScoreType) {
		if (!pageInitialized) return;

		if (ratingFilter === 'all') {
			page.url.searchParams.delete('ratingType');
		} else {
			page.url.searchParams.set('ratingType', ratingFilter);
		}

		replaceState(page.url, page.state);
	}

	$: updateRatingScoreFilterUrl(ratingScoreFilter);

	let ratingHadBusinessFilter: RatingFilterHadBusinessType = loadRatingHadBusinessFilter();

	function loadRatingHadBusinessFilter(): RatingFilterHadBusinessType {
		const urlRatingFilter = page.url.searchParams.get('hadBusiness');

		if (!urlRatingFilter) return 'all';

		if (!isRatingFilterHadBusiness(urlRatingFilter)) return 'all';

		return urlRatingFilter;
	}

	function updateRatingHadBusinessFilterUrl(ratingFilter: RatingFilterHadBusinessType) {
		if (!pageInitialized) return;

		if (ratingFilter === 'all') {
			page.url.searchParams.delete('hadBusiness');
		} else {
			page.url.searchParams.set('hadBusiness', ratingFilter);
		}

		replaceState(page.url, page.state);
	}

	$: updateRatingHadBusinessFilterUrl(ratingHadBusinessFilter);

	let renderGraph: RenderGraph | undefined;

	onMount(() => {
		pageInitialized = true;
	});

	async function copyLinkToClipboard() {
		await navigator.clipboard.writeText(page.url.toString());
		toasts.success({
			title: 'Copied!',
			description: 'Link copied to clipboard!'
		});
	}
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
						bind:value={ratingScoreFilter}
						items={[
							{ value: 'all', name: 'All' },
							{ value: 'positive', name: '✅ Positive' },
							{ value: 'negative', name: '❌ Negative' }
						]}
					/>
				</div>
			</div>

			<div class="flex flex-col">
				<Label for="filterReview">Filter by business already done</Label>
				<div class="flex flex-row items-center gap-x-3">
					<Select
						id="filterReview"
						bind:value={ratingHadBusinessFilter}
						items={[
							{ value: 'all', name: 'All' },
							{ value: 'yes', name: '✅ Yes' },
							{ value: 'no', name: '❌ No' }
						]}
					/>
				</div>
			</div>

			<div class="flex flex-col">
				<Checkbox bind:checked={physicsEnabled}>Physics enabled</Checkbox>
			</div>

			<div class="flex flex-col">
				<Button on:click={() => copyLinkToClipboard()}>Share this view</Button>
			</div>
		</div>
	</div>

	<RenderGraph
		bind:source={pubkey}
		bind:target={targetPubkey}
		bind:this={renderGraph}
		bind:ratingScoreFilter
		bind:ratingHadBusinessFilter
		bind:physicsEnabled
		{userPubkey}
		{nodeWidths}
		{edgeWidths}
		{graph}
	/>
</div>

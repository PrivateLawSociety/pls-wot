<script lang="ts">
	import { ReviewEvent } from "$lib";

	import { getPublicKey } from "nostr-tools/pure";
	import { broadcastToNostr } from "$lib/nostr";
	import { decode, npubEncode } from "nostr-tools/nip19";
	import { goto } from "$app/navigation";
	import { nostrAuth } from "$lib/nostr";
	import { Button, Input, Label, Textarea, Radio } from "flowbite-svelte";

	function parsePubKey(str: string) {
		try {
			const nip19 = decode(str)

			if (nip19.type == "npub") return hexStringToBuffer(nip19.data)
		} catch {
			try {
				const buf = hexStringToBuffer(str)

				if (buf.length !== 32) return;

				return buf
			} catch {}
		}
	}

	function hexStringToBuffer(str: string) {
		return Uint8Array.from(toHex(str))
	}

	function toHex(hexString: string) {
		let hex = []

		let i = 0
		while (i < hexString.length) {
			hex[i/2] = parseInt(
				hexString[i] + hexString[i+1],
				16
			)

			i += 2
		}

		return hex
	}

	function numberToHex(i: number) {
		return ('0' + i.toString(16)).slice(-2);
	}

	function bufToHexString(buf: Uint8Array) {
		return buf.reduce((memo, i) => memo + numberToHex(i), '');
	}

	interface Review {
		from: string,
		to: string,
		score: boolean,
		businessAlreadyDone: boolean,
		description: string
	}

	let otherPersonPubKey = ""
	let ratingDescription = ""
	let score: number | undefined
	let businessAlreadyDone: number | undefined

	async function handleSubmit() {
		if (ratingDescription.length >= 1000)
			return alert("2000 characters is the max for a rating description")

		if (score == undefined || businessAlreadyDone == undefined)
			return alert("You forgot to fill some checkbox")

		const privkey = nostrAuth.getPrivkey();

		if (privkey) {
			nostrAuth.loginWithPrivkey(privkey)
		}
		
		if (!nostrAuth) return alert("Invalid secret key")
		
		const myPubkey = !!nostrAuth ? nostrAuth.getPubkey()! : getPublicKey(Buffer.from(privkey!, 'hex'))

		const otherPubKey = parsePubKey(otherPersonPubKey)
		if (!otherPubKey) return alert("Invalid public key")

		const ratedPubKey = bufToHexString(otherPubKey)
		let rating: Review = {
			from: myPubkey,
			to: ratedPubKey,
			score: Boolean(score),
			businessAlreadyDone: Boolean(businessAlreadyDone),
			description: ratingDescription,
		};

		const labelTag = ['l', `pls-wot-rating`]
		const dTag = ['d', `pls-wot-rating-${ratedPubKey}`]
		const event = await nostrAuth.makeEvent(ReviewEvent, JSON.stringify(rating), [labelTag, dTag])

		// const event = finalizeEvent({
		// 		content: JSON.stringify(rating),
		// 		created_at: Math.floor(Date.now() / 1000),
		// 		kind: ReviewEvent,
		// 		tags: []
		// }, mySecKey)

		console.log(event)

		// TODO: Sign review, let user download it, and disabled 'send to nostr' button
		// 'send to nostr' should be in a parameterized replaceable event (but just do ephemeral for now)

		// relayPool.publish(relayList, event)
		broadcastToNostr(event)

		if (confirm("Event published. Would you like to see the ratings table?")) {
			goto("/table")
		}

		otherPersonPubKey = ""
		ratingDescription = ""
		score = undefined
		businessAlreadyDone = undefined
	}

	$: if (!$nostrAuth?.pubkey) goto("/");
</script>


<form
	on:submit={(e)=>{
		e.preventDefault()
		handleSubmit()
	}}
	class="flex flex-col h-full justify-center items-center gap-4 pt-4"
>
	{#if $nostrAuth?.pubkey}
		<Label class="flex flex-col w-1/2">
			Your npub
			<code class="font-bold">{npubEncode($nostrAuth.pubkey)}</code>
		</Label>
	{/if}

	<Label class="flex flex-col w-1/2">
		Other person pubkey
		<Input class="border-2" bind:value={otherPersonPubKey} type="text" />
	</Label>

	<div class="flex flex-col w-1/2">
		<p>What rating do you give to this person?</p>
		<Label>
			<Radio bind:group={score} value={1} />
			positive
		</Label>
		<Label>
			<Radio bind:group={score} value={0} />
			negative
		</Label>
	</div>

	<div class="flex flex-col w-1/2">
		<p>Have you ever done business with this person?</p>
		<Label>
			<Radio bind:group={businessAlreadyDone} value={1} />
			yes
		</Label>
		<Label>
			<Radio bind:group={businessAlreadyDone} value={0} />
			no
		</Label>
	</div>

	<Label class="flex flex-col w-1/2">
		Rating description
		<Textarea rows={6} class="border-2" bind:value={ratingDescription} />
	</Label>

	<Button type="submit" class="w-48 m:w-64">Create rating</Button>
</form>


<script lang="ts">
	import { ReviewEvent } from "$lib";
	import { finalizeEvent } from "nostr-tools"

	import { getPublicKey } from "nostr-tools/pure";
	import { relayList, relayPool } from "$lib/nostr";
	import { decode } from "nostr-tools/nip19";
	import { goto } from "$app/navigation";

	function parseSecKey(str: string) {
		try {
			const nip19 = decode(str)

			if (nip19.type == "nsec") return nip19.data
		} catch {
			try {
				const buf = hexStringToBuffer(str)
				
				if (buf.length !== 32) return;

				return buf
			} catch {}
		}
	}

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
	
	let mySecretKey = ""
	let otherPersonPubKey = ""
	let ratingDescription = ""
	let score: boolean | undefined
	let businessAlreadyDone: boolean | undefined

	async function handleSubmit() {
		if (ratingDescription.length >= 1000) 
			return alert("2000 characters is the max for a rating description")
		
		if (score == undefined || businessAlreadyDone == undefined) 
			return alert("You forgot to fill some checkbox")
		
		const mySecKey = parseSecKey(mySecretKey)
		if (!mySecKey) return alert("Invalid secret key")

		const myPubkey = getPublicKey(mySecKey)

		const otherPubKey = parsePubKey(otherPersonPubKey)
		if (!otherPubKey) return alert("Invalid public key")

		let rating: Review = {
			from: myPubkey,
			to: bufToHexString(otherPubKey),
			score,
			businessAlreadyDone,
			description: ratingDescription,
		};

		const event = finalizeEvent({
			content: JSON.stringify(rating),
			created_at: Math.floor(Date.now() / 1000),
			kind: ReviewEvent,
			tags: []
		}, mySecKey)

		console.log(event)

		// TODO: Sign review, let user download it, and disabled 'send to nostr' button
		// 'send to nostr' should be in a parameterized replaceable event (but just do ephemeral for now)
	
		relayPool.publish(relayList, event)

		if (confirm("Event published. Would you like to see the ratings table?")) {
			goto("/table")
		}

		mySecretKey = ""
		otherPersonPubKey = ""
		ratingDescription = ""
		score = undefined
		businessAlreadyDone = undefined
	}
</script>


<form 
	on:submit={(e)=>{
		e.preventDefault()
		handleSubmit()
	}}
	class="flex flex-col items-center gap-4 pt-4"
>	
	<a
		class="underline text-blue-600 hover:text-blue-800 visited:text-purple-600"
		href="https://nostrtool.com/"
		target="_blank"
		rel="noopener noreferrer"
	>
		Generate keys here
	</a>
	
	<label class="flex flex-col w-1/2">
		Your secret key (hex)
		<input class="border-2" bind:value={mySecretKey} type="text" >
	</label>
	
	<label class="flex flex-col w-1/2">
		Other person pubkey (hex)
		<input class="border-2" bind:value={otherPersonPubKey} type="text" >
	</label>

	<div class="flex flex-col w-1/2">
		<p>What rating do you give to this person?</p>
		<label>
			<input bind:group={score} value={true} type="radio">
			positive
		</label>
		<label>
			<input bind:group={score} value={false} type="radio">
			negative
		</label>
	</div>

	<div class="flex flex-col w-1/2">
		<p>Have you ever done business with this person?</p>
		<label>
			<input bind:group={businessAlreadyDone} value={true} type="radio">
			yes
		</label>
		<label>
			<input bind:group={businessAlreadyDone} value={false} type="radio">
			no
		</label>
	</div>
	
	<label class="flex flex-col w-1/2">
		Rating description
		<textarea rows=6 class="border-2" bind:value={ratingDescription}></textarea>
	</label>

	<button type="submit" class="px-2 py-2 border-2">Create rating</button>
</form>


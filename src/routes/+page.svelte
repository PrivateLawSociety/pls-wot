<script lang="ts">
	import { ReviewEvent } from "$lib";
	import { finalizeEvent } from "nostr-tools"
	// import { ECPairFactory } from "ecpair"
	// import {  } from "tiny-secp256k1"
	// import { Buffer } from "buffer"

	import { page } from "$app/stores";

	$: console.log($page.url.hash)

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

	// const ECPair = ECPairFactory();

	interface Review {
		mySecretKey: string
		otherPersonPubKey: string
		rating: number
		reviewDescription: string
	}
	
	let mySecretKey = ""
	let otherPersonPubKey = ""
	let ratingDescription = ""
	let certainty = ""
	let trust = ""

	// function handleSubmit() {
	// 	if (ratingDescription.length >= 2000) {
	// 		alert("2000 characters is the max for a rating description")
	// 		return
	// 	}

	// 	let rating: Review = {
	// 		mySecretKey,
	// 		otherPersonPubKey,
	// 		reviewDescription: ratingDescription,
	// 	};

	// 	const seckey = Uint8Array.from(
	// 		toHex(mySecretKey)
	// 	)

	// 	console.log(seckey)

	// 	const event = finalizeEvent({
	// 		content: JSON.stringify(rating),
	// 		created_at: Date.now() / 1000,
	// 		kind: ReviewEvent,
	// 		tags: []
	// 	}, seckey)

		

	// 	console.log(event)

	// 	// TODO: Sign review, let user download it, and disabled 'send to nostr' button
	// 	// 'send to nostr' should be in a parameterized replaceable event (but just do ephemeral for now)
	// 	// 
	// }
</script>

<a href="#abc">abc</a>
<a href="#def">def</a>

<form 
	on:submit={(e)=>{
		e.preventDefault()
		// handleSubmit()
	}}
	class="flex flex-col items-center gap-4"
>
	<label class="flex flex-col w-1/2">
		Your secret key
		<input class="border-2" bind:value={mySecretKey} type="text" >
	</label>
	
	<label class="flex flex-col w-1/2">
		Other person pubkey
		<input class="border-2" bind:value={otherPersonPubKey} type="text" >
	</label>

	<div class="flex flex-col w-1/2">
		<p>Do you trust this person/public key?</p>
		<label>
			<input bind:group={trust} value={"yes"} type="radio">
			yes
		</label>
		<label>
			<input bind:group={trust} value={"neutral"} type="radio">
			neutral
		</label>
		<label>
			<input bind:group={trust} value={"no"} type="radio">
			no
		</label>
	</div>

	<div class="flex flex-col  w-1/2">
		<p>Are you certain?</p>
		<label>
			<input bind:group={certainty} value={"uncertain"} type="radio">
			uncertain
		</label>
		<label>
			<input bind:group={certainty} value={"marginal"} type="radio">
			marginal
		</label>
		<label>
			<input bind:group={certainty} value={"full"} type="radio">
			full
		</label>
		<label>
			<input bind:group={certainty} value={"ultimate"} type="radio">
			ultimate
		</label>
	</div>
	
	<label class="flex flex-col w-1/2">
		Rating description
		<textarea rows=6 class="border-2" bind:value={ratingDescription}></textarea>
	</label>

	<button type="submit">Create rating</button>
</form>


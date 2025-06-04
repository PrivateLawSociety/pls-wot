import { Buffer } from 'buffer';
import {
	getPublicKey,
	SimplePool,
	type Event,
	generateSecretKey,
	nip04,
	finalizeEvent
} from 'nostr-tools';
import { Metadata } from 'nostr-tools/kinds';
import { decode, npubEncode } from 'nostr-tools/nip19';
import { getZapEndpoint, makeZapRequest } from 'nostr-tools/nip57';

import { get, writable } from 'svelte/store';

export let relayPool = new SimplePool();

export let relayList = [
	'wss://nostr-pub.wellorder.net',
	'wss://relay.nostr.band',
	'wss://relay.damus.io',
	'wss://nostr.fmt.wiz.biz',
	'wss://offchain.pub',
	'wss://relay.current.fyi',
	'wss://nos.lol'
];

export interface Rating {
	eventId: string;
	from: ProfileType;
	to: ProfileType;
	date: number;
	score: boolean;
	businessAlreadyDone: boolean;
	description: string;
}

export interface ProfileType {
	npub: string;
	name?: string;
	picture?: string;
	banner?: string;
	about?: string;
	nip05?: string;
	website?: string;
	lud16?: string;
	pubkey: string;
	display_name?: string;
	displayName?: string;
}

export function parseProfileFromJsonString(
	content: string,
	profile: Partial<ProfileType> & { pubkey: string }
) {
	let metadata = {} as any;
	metadata = JSON.parse(content || '{}');

	if (!profile.npub) {
		profile.npub = npubEncode(profile.pubkey);
	}

	const targetProfile = Object.assign({}, profile) as ProfileType;

	targetProfile.name = metadata?.name || '';
	targetProfile.picture = metadata?.picture || '';
	targetProfile.banner = metadata?.banner || '';
	targetProfile.about = metadata?.about || '';
	targetProfile.nip05 = metadata?.nip05 || '';
	targetProfile.website = metadata?.website || '';
	targetProfile.lud16 = metadata?.lud16 || '';
	targetProfile.display_name = metadata?.display_name || '';
	targetProfile.displayName = metadata?.displayName || '';

	return targetProfile;
}

export function broadcastToNostr(event: Event) {
	return relayPool.publish(relayList, event);
}

export let nostrAuth = (() => {
	let initialPrivateKey = sessionStorage.getItem('private-key');

	const store = writable<{ privkey?: string; pubkey: string } | null>(
		initialPrivateKey
			? {
					privkey: initialPrivateKey,
					pubkey: getPublicKey(Uint8Array.from(Buffer.from(initialPrivateKey, 'hex')))
				}
			: null
	);

	store.subscribe((keys) => {
		if (keys?.privkey) sessionStorage.setItem('private-key', keys.privkey);
	});

	function loginWithRandomKeys() {
		const privkey = generateSecretKey();
		const privkeyStr = Buffer.from(privkey).toString('hex');
		const pubkey = getPublicKey(privkey);

		navigator.clipboard.writeText(
			`private key: ${privkey}
public key: ${pubkey}`
		);

		alert(
			'Using a nostr extension such as getalby.com is recommended, but a keypair was copied to your clipboard so you can try out PLS without it'
		);

		store.set({
			privkey: privkeyStr,
			pubkey
		});

		return true;
	}

	function nostrNowBasic() {
		return Math.floor(Date.now() / 1000);
	}

	async function makeNostrEvent(privkey: string, kind: number, content: string, tags: string[][]) {
		return finalizeEvent(
			{
				content,
				created_at: nostrNowBasic(),
				kind,
				tags
			},
			Buffer.from(privkey, 'hex')
		);
	}

	return {
		signOut() {
			store.set(null);
			sessionStorage.removeItem('private-key');
		},
		loginWithRandomKeys,
		loginWithPrivkey(privkey: string) {
			const pubkey = getPublicKey(Uint8Array.from(Buffer.from(privkey, 'hex')));

			store.set({
				privkey,
				pubkey
			});
		},
		getPrivkey() {
			return get(store)?.privkey;
		},
		getPubkey() {
			return get(store)?.pubkey;
		},
		async tryLogin() {
			if (get(store)?.pubkey) return true;

			if (window.nostr) {
				try {
					const pubkey: string = await window.nostr.getPublicKey();

					store.set({ pubkey });

					return true;
				} catch (error) {
					return loginWithRandomKeys();
				}
			} else {
				return loginWithRandomKeys();
			}
		},
		async encryptDM(otherPubkey: string, text: string) {
			const privkey = get(store)?.privkey;

			if (privkey) {
				return await nip04.encrypt(privkey, otherPubkey, text);
			} else {
				return await window.nostr!.nip04.encrypt(otherPubkey, text);
			}
		},
		async decryptDM(otherPubkey: string, text: string) {
			const privkey = get(store)?.privkey;

			if (privkey) {
				return await nip04.decrypt(privkey, otherPubkey, text);
			} else {
				return await window.nostr!.nip04.decrypt(otherPubkey, text);
			}
		},
		async makeEvent(kind: number, content: string, tags: string[][]) {
			const { pubkey, privkey } = get(store)!;

			if (privkey) {
				return makeNostrEvent(privkey, kind, content, tags);
			} else {
				const blankEvent = {
					kind,
					content,
					created_at: nostrNowBasic(),
					tags,
					pubkey
				} as Event;

				return window.nostr!.signEvent(blankEvent);
			}
		},
		subscribe: store.subscribe
	};
})();

export const profilesMetadata = writable<Record<string, Event>>({});
export const getProfileMetadata = async (publicKey: string): Promise<Event | null> => {
	try {
		async function queryMetadata() {
			const metadataEvent = await relayPool.get(relayList, {
				kinds: [Metadata],
				authors: [publicKey],
				limit: 1
			});

			if (metadataEvent) {
				const olderProfile = get(profilesMetadata)[publicKey];

				const olderCreatedAt = olderProfile?.created_at || 0;

				if (olderCreatedAt < metadataEvent?.created_at) {
					profilesMetadata.update((profiles) => {
						profiles[publicKey] = metadataEvent;

						return profiles;
					});
				}
			}

			const profileMetadata = get(profilesMetadata)[publicKey];

			return profileMetadata;
		}

		const profiles = get(profilesMetadata);

		const olderProfile = profiles[publicKey];

		if (olderProfile) {
			// It ensures that the latest
			queryMetadata();

			return olderProfile;
		}

		return await queryMetadata();
	} catch (error) {
		console.error('Unable get profile metadata', error);
		return null;
	}
};

export const createInvoice = async (
	destination: string,
	message: string,
	amount: number,
	eventId: string
) => {
	try {
		const publicKey: string = decode(destination).data.toString();
		const profileMetadata = await getProfileMetadata(publicKey);

		if (!profileMetadata) {
			const error = new Error('Unable get profile metadata');
			error.name = 'ProfileMetadata';
			throw error;
		}

		const zapEndpoint = await getZapEndpoint(profileMetadata);

		if (!zapEndpoint) {
			const error = new Error('Unable get profile LUD-16');
			error.name = 'ZapEndpoint';
			throw error;
		}

		const zapRequestEvent = makeZapRequest({
			profile: publicKey,
			event: eventId,
			amount: amount,
			relays: relayList,
			comment: message
		});

		const callbackUrl = new URL(zapEndpoint);

		const params = new URLSearchParams({
			...Object.fromEntries(callbackUrl.searchParams),
			comment: message || '',
			amount: Math.floor(amount * 1000).toString(),
			nostr: JSON.stringify(zapRequestEvent)
		});

		const baseUrl = `${callbackUrl.protocol}//${callbackUrl.host}${callbackUrl.pathname}`;

		const invoiceRequest = await fetch(`${baseUrl}?${params}`);

		if (!invoiceRequest.ok) {
			const error = Error('Unable to make request invoice');
			error.name = 'InvoiceRequest';
			throw error;
		}

		return await invoiceRequest.json();
	} catch (error) {
		console.error('Unable to create invoice', error);
		throw error;
	}
};

export const checkPayment = async (verify: string) => {
	try {
		const verifyRequest = await fetch(verify);

		if (!verifyRequest.ok) {
			const error = Error('Unable to make verify invoice request');
			error.name = 'VerifyRequest';
			throw error;
		}

		return await verifyRequest.json();
	} catch (error) {
		console.error('Unable to verify payment', error);
		throw error;
	}
};

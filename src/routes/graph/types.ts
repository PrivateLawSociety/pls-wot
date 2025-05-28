import type { Rating } from '$lib/nostr';

export interface GraphRating extends Rating {
	parentRatings: GraphRating[];
	childrenRatings: GraphRating[];
	currentDepth: number;
}

export type ReviewFilterType = 'positive' | 'negative' | 'all';

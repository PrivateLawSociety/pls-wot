import type { Rating } from '$lib/nostr';

export interface GraphRating extends Rating {
	parentRatings: GraphRating[];
	childrenRatings: GraphRating[];
	currentDepth: number;
}

export const RatingFilterTypes = ['positive', 'negative', 'all'] as const;

export type RatingFilterType = (typeof RatingFilterTypes)[number];

export function isRatingFilter(filter: string): filter is RatingFilterType {
	return RatingFilterTypes.includes(filter as RatingFilterType);
}

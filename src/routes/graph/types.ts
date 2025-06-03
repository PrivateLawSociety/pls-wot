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

export type NodeDataType = 'source' | 'target' | 'common';

export interface NodeData {
	displayName?: string;
	picture?: string;
	type: NodeDataType;
}

export interface EdgeData {
	from: string;
	to: string;
	score: boolean;
	businessAlreadyDone: boolean;
	description: string;
}

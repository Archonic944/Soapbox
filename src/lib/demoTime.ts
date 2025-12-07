// Demo time utilities for time skip feature
// This allows simulating time passing for demo purposes
// The time offset is stored globally per group in the database

import { writable, get } from 'svelte/store';

// Store for the current group's time offset in milliseconds (client-side cache)
export const timeOffset = writable(0);

// Get the simulated "now" time (real time + offset)
export function getDemoNow(offset: number = 0): Date {
	return new Date(Date.now() + offset);
}

// Get the simulated timestamp
export function getDemoTimestamp(offset: number = 0): number {
	return Date.now() + offset;
}

// Format the time offset for display
export function formatTimeOffset(offsetMs: number): string {
	if (offsetMs === 0) return 'Real time';
	
	const totalSeconds = Math.floor(offsetMs / 1000);
	const days = Math.floor(totalSeconds / (24 * 60 * 60));
	const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
	const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
	
	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	
	return parts.length > 0 ? `+${parts.join(' ')}` : 'Real time';
}

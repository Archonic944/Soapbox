import { json } from '@sveltejs/kit';
import { getGroupTimeOffset, skipGroupTime, resetGroupTimeOffset } from '$lib/db';

// GET - Get current time offset for a group
export async function GET({ url }) {
	try {
		const groupId = url.searchParams.get('groupId');
		if (!groupId) {
			return json({ error: 'groupId query parameter required' }, { status: 400 });
		}

		const offset = await getGroupTimeOffset(groupId);
		return json({ offset });
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

// POST - Skip time forward for a group
export async function POST({ request }) {
	try {
		const body = await request.json();
		const { groupId, skipHours, skipDays, reset } = body;

		if (!groupId) {
			return json({ error: 'groupId is required' }, { status: 400 });
		}

		if (reset) {
			await resetGroupTimeOffset(groupId);
			return json({ offset: 0, message: 'Time reset to real time' });
		}

		let skipMs = 0;
		if (skipHours) {
			skipMs += skipHours * 60 * 60 * 1000;
		}
		if (skipDays) {
			skipMs += skipDays * 24 * 60 * 60 * 1000;
		}

		if (skipMs === 0) {
			return json({ error: 'Specify skipHours, skipDays, or reset' }, { status: 400 });
		}

		const result = await skipGroupTime(groupId, skipMs);
		return json({ 
			offset: result.demo_time_offset, 
			message: `Time skipped forward by ${skipHours || 0} hours and ${skipDays || 0} days` 
		});
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

import { json } from '@sveltejs/kit';
import { joinGroup, submitTopic } from '$lib/db';

export async function POST({ request, cookies }) {
	try {
		const body = await request.json();
		const result = await joinGroup(body.invite_code, body.name);
		
		// Store member and group IDs in cookies
		cookies.set('member_id', result.member.id, { 
			path: '/',
			maxAge: 60 * 60 * 24 * 365 // 1 year
		});
		cookies.set('group_id', result.group.id, { 
			path: '/',
			maxAge: 60 * 60 * 24 * 365 // 1 year
		});
		
		// If topic was provided, create it for rotation cycle 1
		if (body.topic) {
			try {
				await submitTopic(result.group.id, result.member.id, body.topic, 1);
			} catch (topicErr) {
				console.error('Failed to create topic:', topicErr);
				// Don't fail the whole join if topic creation fails
			}
		}
		
		return json(result, { status: 201 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

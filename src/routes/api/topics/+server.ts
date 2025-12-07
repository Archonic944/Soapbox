import { json } from '@sveltejs/kit';
import { submitTopic } from '$lib/db';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const result = await submitTopic(
			body.group_id,
			body.member_id,
			body.topic_text,
			body.rotation_cycle
		);
		return json(result, { status: 201 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

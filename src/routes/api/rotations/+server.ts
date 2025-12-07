import { json } from '@sveltejs/kit';
import { saveRotation } from '$lib/db';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const result = await saveRotation(body.group_id, body.rotation_number, body.assignments);
		return json(result, { status: 201 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

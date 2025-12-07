import { json } from '@sveltejs/kit';
import { createGroup } from '$lib/db';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const result = await createGroup(body);
		return json(result, { status: 201 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

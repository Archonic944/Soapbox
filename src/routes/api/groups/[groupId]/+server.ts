import { json } from '@sveltejs/kit';
import { getLandingPageData } from '$lib/db';

export async function GET({ params }) {
	try {
		const result = await getLandingPageData(params.groupId);
		return json(result);
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

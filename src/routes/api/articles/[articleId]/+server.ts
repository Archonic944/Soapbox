import { json } from '@sveltejs/kit';
import { getArticle, markArticleRead } from '$lib/db';

export async function GET({ params }) {
	try {
		const { articleId } = params;
		const article = await getArticle(articleId);
		return json(article);
	} catch (error: any) {
		return json({ error: error.message }, { status: 404 });
	}
}

// PATCH - Mark article as read
export async function PATCH({ params }) {
	try {
		const { articleId } = params;
		const result = await markArticleRead(articleId);
		return json(result);
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

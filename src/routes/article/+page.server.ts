import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const memberId = cookies.get('member_id');
	const articleId = url.searchParams.get('id');
	
	return {
		articleId,
		memberId
	};
};

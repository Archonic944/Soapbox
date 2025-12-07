import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLandingPageData, getArticles, getQuizAttemptsForMember } from '$lib/db';

export const load: PageServerLoad = async ({ cookies }) => {
	const groupId = cookies.get('group_id');
	const memberId = cookies.get('member_id');

	if (!groupId || !memberId) {
		// Redirect to home if not in a group
		throw redirect(307, '/');
	}

	try {
		const [landingData, articles, quizAttempts] = await Promise.all([
			getLandingPageData(groupId),
			getArticles(groupId),
			getQuizAttemptsForMember(memberId)
		]);

		// Map quiz attempts to article IDs for easy lookup
		const completedQuizArticleIds = quizAttempts
			?.filter(attempt => attempt.quizzes?.article_id)
			.map(attempt => attempt.quizzes.article_id) || [];

		return {
			group: landingData.group,
			members: landingData.members,
			topics: landingData.topics,
			rotations: landingData.rotations,
			articles,
			currentMemberId: memberId,
			completedQuizArticleIds
		};
	} catch (error) {
		console.error('Error loading group data:', error);
		throw redirect(307, '/');
	}
};

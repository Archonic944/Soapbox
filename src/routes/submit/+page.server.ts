import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLandingPageData, getGroupTimeOffset } from '$lib/db';

export const load: PageServerLoad = async ({ cookies }) => {
	const groupId = cookies.get('group_id');
	const memberId = cookies.get('member_id');

	if (!groupId || !memberId) {
		throw redirect(307, '/');
	}

	try {
		const landingData = await getLandingPageData(groupId);
		
		// Get demo time offset
		const demoTimeOffset = await getGroupTimeOffset(groupId);
		
		// Find the current member
		const currentMember = landingData.members?.find((m: any) => m.id === memberId);
		
		// Find the member's topic for the current rotation
		const latestRotation = Math.max(...(landingData.topics?.map((t: any) => t.rotation_cycle) || [1]), 1);
		const memberTopic = landingData.topics?.find(
			(t: any) => t.member_id === memberId && t.rotation_cycle === latestRotation
		);

		// Calculate due date based on member's position in queue
		// Apply demo time offset to simulate time passing
		const memberIndex = landingData.members?.findIndex((m: any) => m.id === memberId) || 0;
		const rotationPeriod = landingData.group?.rotation_period || 7;
		const demoNow = new Date(Date.now() + demoTimeOffset);
		const dueDate = new Date(demoNow);
		dueDate.setDate(dueDate.getDate() + (rotationPeriod * (memberIndex + 1)));

		return {
			group: landingData.group,
			currentMember,
			topic: memberTopic?.topic_text || 'Write about something that interests you',
			dueDate: dueDate.toISOString(),
			maxWordCount: landingData.group?.max_word_count || 1000,
			memberId,
			groupId,
			demoTimeOffset
		};
	} catch (error) {
		console.error('Error loading submit page data:', error);
		throw redirect(307, '/group');
	}
};

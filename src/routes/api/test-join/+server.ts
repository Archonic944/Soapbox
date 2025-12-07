import { json } from '@sveltejs/kit';
import { supabase } from '$lib/client/supabase';
import { createGroup } from '$lib/db';

export async function POST({ cookies }) {
	try {
		// Try to get the first group from the database
		let { data: group, error: groupErr } = await supabase
			.from('groups')
			.select('*')
			.order('created_at', { ascending: true })
			.limit(1)
			.single();

		// If no group exists, create one with default settings
		if (groupErr || !group) {
			group = await createGroup({
				rotation_period: 7,
				max_word_count: 1000,
				quizzes_enabled: true,
				archive_enabled: false,
				archive_time_period: null,
				anonymous: false
			});
		}

		// Generate a random test name
		const testNames = ['TestUser', 'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
		const randomName = testNames[Math.floor(Math.random() * testNames.length)] + '_' + Math.random().toString(36).substring(2, 6);

		// Add member to the group
		const { data: member, error: memberErr } = await supabase
			.from('group_members')
			.insert([{ group_id: group.id, name: randomName }])
			.select()
			.single();

		if (memberErr) throw memberErr;

		// Set session cookies
		cookies.set('member_id', member.id, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365 // 1 year
		});
		cookies.set('group_id', group.id, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365 // 1 year
		});

		return json({ 
			success: true, 
			group, 
			member,
			message: `Joined group as ${randomName}`
		}, { status: 200 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 400 });
	}
}

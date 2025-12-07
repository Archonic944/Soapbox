import { redirect, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getGroupByInvite } from '$lib/db';

export async function GET({ params, cookies }: RequestEvent) {
  const invite = params.invite_code;
  if (!invite) return json({ error: 'Missing invite code' }, { status: 400 });

  const group = await getGroupByInvite(invite);
  if (!group) return json({ error: 'Group not found' }, { status: 404 });

  // Set cookie to point to the found group and redirect to join page
  cookies.set('group_id', group.id, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365 // 1 year
  });

  throw redirect(307, '/join-page');
}

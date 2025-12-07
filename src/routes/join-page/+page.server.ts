import type { PageServerLoad } from './$types';
import { getLandingPageData, getLatestGroup } from '$lib/db';

export const load: PageServerLoad = async ({ cookies }) => {
  let groupId = cookies.get('group_id');

  // Try loading landing data for cookie groupId if present.
  if (groupId) {
    try {
      const landing = await getLandingPageData(groupId);
      return { landing };
    } catch (err) {
      // cookie referenced a deleted/invalid group — fall through to pick newest
    }
  }

  // If no valid cookie group or loading failed, pick the newest group and set it
  const newest = await getLatestGroup();
  if (!newest) return { landing: null };
  groupId = newest.id;
  cookies.set('group_id', groupId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365 // 1 year
  });

  try {
    const landing = await getLandingPageData(groupId);
    return { landing };
  } catch (err) {
    return { landing: null };
  }
};

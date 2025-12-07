<script lang="ts">
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    export let data;
    import { createGroup } from '../Quiz.svelte';

    let userSettings = data.settings;

    // UI state for created group + members
    let createdGroup: any = null;
    let createdMembers: any[] = [];

    async function handleSave() {
        try {
            // Map UI fields to the shape expected by `createGroup` in `src/lib/db.ts`.
            // The DB `groups` table expects: rotation_period, max_word_count, quizzes_enabled, archive_enabled, archive_time_period?, anonymous
            const payload = {
                rotation_period: Number(userSettings.rotationTime),
                max_word_count: Number(userSettings.maxWC) || 0,
                quizzes_enabled: !!userSettings.quizzes,
                archive_enabled: false,
                archive_time_period: null,
                anonymous: !!userSettings.anonymous
            };

            const result = await createGroup(payload);
            console.log('createGroup result', result);

            // result should be the created group object with an `id`.
            createdGroup = result;

            // Persist group id in a cookie so other pages can reference it after navigation/refresh
            try {
                const gid = result.id ?? result.invite_code;
                if (gid) {
                    // set cookie for 1 year
                    document.cookie = `group_id=${gid}; path=/; max-age=${60 * 60 * 24 * 365}`;
                }
            } catch (e) {
                console.warn('Could not set group_id cookie', e);
            }

            // Fetch landing data (group + members) from the API so we can list members
            try {
                const res = await fetch(`/api/groups/${result.id}`);
                if (res.ok) {
                    const landing = await res.json();
                    // `landing` follows getLandingPageData structure: { group, members, topics, rotations }
                    createdGroup = landing.group ?? createdGroup;
                    createdMembers = landing.members ?? [];
                } else {
                    console.warn('Could not fetch landing data', await res.text());
                }
            } catch (err) {
                console.warn('fetch landing data failed', err);
            }
        } catch (err: any) {
            console.error('createGroup error', err);
            alert('Failed to create group: ' + (err?.message || err));
        }
    }

    function getCookie(name: string) {
        const v = `; ${document.cookie}`;
        const parts = v.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
    }

    function openJoin() {
        // try in-memory createdGroup (several possible shapes), then cookie
        const idCandidates = [
            createdGroup?.id,
            createdGroup?.group?.id,
            createdGroup?.invite_code,
            getCookie('group_id')
        ];
        const id = idCandidates.find(Boolean);
        if (!id) {
            alert('No recently created group found. Create a group first.');
            return;
        }

        goto(`/join-page?groupId=${id}`);
    }
</script>

<h1>Settings</h1>

<form method="POST" use:enhance>
    <label style="font-family: Monomaniac One; font-size: 48px; display: flex; align-items: center; gap: 1rem;">
    Rotation Period:
    <select id="rotationTimes" name="rotationTimes" bind:value={userSettings.rotationTime} style="font-family: Monomaniac One; font-size: 48px;">
        <option value=1>1 Day</option>
        <option value=7>7 Days</option>
        <option value=14>2 Weeks</option>
        <option value=30>1 Month</option>
    </select>
    </label>

    <br />

    <label style="font-family: Monomaniac One; font-size: 48px; display: flex; align-items: center; gap: 1rem;">
        Max Word Count (0 for no maximum):
        <input type="text" name="maxWC" bind:value={userSettings.maxWC} />
    </label>

    <br />

    <label style="font-family: Monomaniac One; font-size: 48px; display: flex; align-items: center; gap: 1rem;">
        Quizzes?
        <input type="checkbox" name="quizzes" bind:checked={userSettings.quizzes} />
    </label>

    <br />

    <label style="font-family: Monomaniac One; font-size: 48px; display: flex; align-items: center; gap: 1rem;">
        Anonymous?
        <input type="checkbox" name="anonymous" bind:checked={userSettings.anonymous} />
    </label>

    <br />

    {#if userSettings.anonymous}
        <label>
            Quiz question about who wrote the article?
            <input type="checkbox" name="guessname" bind:checked={userSettings.guessname} />
        </label>
        <br />
    {/if}

    <br />

    <button type="button" on:click={handleSave}>Save</button>

</form>

<div style="margin-top:1rem; text-align:center;">
    <button
        on:click={openJoin}
        style="padding:0.6rem 1rem; background:#3ba8d8; color:white; border:none; border-radius:6px; cursor:pointer;"
    >
        Go to Join Page
    </button>
</div>
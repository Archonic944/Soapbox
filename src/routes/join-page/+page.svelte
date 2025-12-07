<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  export let data: { landing: any } | null;

  // landing is mutable — we'll refresh it client-side when needed
  let landing = data?.landing ?? null;
  let polling = false;
  let pollInterval: number | null = null;

  // Join form state
  let name = '';
  let topic = '';
  let joining = false;
  let joinError = '';
  let hasJoined = false;

  // Check if user has already joined this group
  function checkIfJoined() {
    const memberId = document.cookie.split('; ').find(row => row.startsWith('member_id='))?.split('=')[1];
    if (memberId && landing?.members?.some((m: any) => m.id === memberId)) {
      hasJoined = true;
    }
  }

  async function handleJoin() {
    if (!name.trim()) {
      joinError = 'Please enter your name';
      return;
    }
    if (!topic.trim()) {
      joinError = 'Please enter a topic for your first article';
      return;
    }
    
    joining = true;
    joinError = '';
    
    try {
      const res = await fetch(`/api/groups/${landing.group.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          invite_code: landing.group.invite_code, 
          name: name.trim(),
          topic: topic.trim()
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join group');
      }
      
      const result = await res.json();
      hasJoined = true;
      
      // Refresh landing data to show new member
      await fetchLanding();
      
      // Navigate to group page
      goto('/group');
    } catch (err: any) {
      joinError = err.message || 'Failed to join group';
    } finally {
      joining = false;
    }
  }

  async function fetchLanding() {
    try {
      const groupId = landing?.group?.id;
      // if we don't have a group id yet, nothing to fetch
      if (!groupId) return;
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) return;
      const json = await res.json();
      // update landing data (reactive)
      landing = json;
    } catch (err) {
      console.error('Failed to fetch landing data', err);
    }
  }

  function startPolling(intervalMs = 15000) {
    if (pollInterval) return;
    polling = true;
    pollInterval = setInterval(() => fetchLanding(), intervalMs) as unknown as number;
  }

  function stopPolling() {
    polling = false;
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  onMount(() => {
    // Check if user has already joined
    checkIfJoined();
    // keep initial data fresh for a short time by polling
    // but do not poll by default — let user start it if desired
  });

  onDestroy(() => stopPolling());
</script>

{#if !landing}
  <div class="card">
    <h2>No group selected</h2>
    <p>Please join a group first (enter an invite code on the join form).</p>
  </div>
{:else}
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <h2>Group Settings Recap</h2>
      <div>
        <button on:click={fetchLanding} aria-label="Refresh">Refresh</button>
        {#if !polling}
          <button on:click={() => startPolling()}>Start Auto-refresh</button>
        {:else}
          <button on:click={stopPolling}>Stop Auto-refresh</button>
        {/if}
      </div>
    </div>

    <ul>
      <li><strong>Rotation period:</strong> {landing.group.rotation_period}</li>
      <li><strong>Invite code:</strong> <code id="invite-code">{landing.group.invite_code}</code>
        <button on:click={() => navigator.clipboard?.writeText(landing.group.invite_code)} style="margin-left:0.5rem">Copy code</button>
        <button on:click={() => navigator.clipboard?.writeText(`${location.origin}/api/groups/goto/${landing.group.invite_code}`)} style="margin-left:0.5rem">Copy invite link</button>
        <a href={`/?invite=${landing.group.invite_code}`} style="margin-left:0.5rem">Use on start page</a>
      </li>
      <li><strong>Max word count:</strong> {landing.group.max_word_count}</li>
      <li><strong>Quizzes enabled:</strong> {landing.group.quizzes_enabled ? 'Yes' : 'No'}</li>
      <li><strong>Archive enabled:</strong> {landing.group.archive_enabled ? 'Yes' : 'No'}</li>
      {#if landing.group.archive_time_period}
        <li><strong>Archive after:</strong> {landing.group.archive_time_period}</li>
      {/if}
      <li><strong>Anonymous:</strong> {landing.group.anonymous ? 'Yes' : 'No'}</li>
    </ul>
  </div>

  <div class="card">
    <h2>Members ({landing.members?.length ?? 0})</h2>
    {#if !landing.members || landing.members.length === 0}
      <p>No one has joined yet.</p>
    {:else}
      <ul>
        {#each landing.members as member}
          <li>{member.name}</li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Join Form -->
  {#if !hasJoined}
    <div class="card join-card">
      <h2>Join This Group</h2>
      <form on:submit|preventDefault={handleJoin}>
        <label>
          <span>Your Name</span>
          <input 
            type="text" 
            bind:value={name} 
            placeholder="Enter your name"
            disabled={joining}
          />
        </label>
        <label>
          <span>Your Topic</span>
          <input 
            type="text" 
            bind:value={topic} 
            placeholder="What will your first article be about?"
            disabled={joining}
          />
          <small>This is what you'll write about when it's your turn</small>
        </label>
        {#if joinError}
          <p class="error">{joinError}</p>
        {/if}
        <button type="submit" class="join-btn" disabled={joining}>
          {joining ? 'Joining...' : 'Join Group'}
        </button>
      </form>
    </div>
  {:else}
    <div class="card">
      <p style="color: green; font-weight: 500;">✓ You've already joined this group!</p>
      <div style="margin-top:1rem; text-align:center;">
        <button
          on:click={() => {
            document.cookie = `group_id=${landing.group.id}; path=/; max-age=${60 * 60 * 24 * 365}`;
            goto('/group');
          }}
          style="padding:0.6rem 1rem; background:#3ba8d8; color:white; border:none; border-radius:6px; cursor:pointer;"
        >
          Open Group Page
        </button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .card {
    border: 1px solid var(--border, #e6e6e6);
    padding: 1rem;
    margin: 0.75rem 0;
    border-radius: 6px;
    background: var(--card-bg, #fff);
  }
  ul { margin: 0.5rem 0 0 1rem; }
  
  .join-card form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .join-card label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .join-card label span {
    font-weight: 500;
  }
  
  .join-card input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }
  
  .join-card input:focus {
    outline: none;
    border-color: #3ba8d8;
    box-shadow: 0 0 0 2px rgba(59, 168, 216, 0.2);
  }
  
  .join-card small {
    color: #666;
    font-size: 0.85rem;
  }
  
  .join-btn {
    padding: 0.75rem 1.5rem;
    background: #3ba8d8;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .join-btn:hover:not(:disabled) {
    background: #2d8ab8;
  }
  
  .join-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .error {
    color: #dc2626;
    margin: 0;
    font-size: 0.9rem;
  }
</style>

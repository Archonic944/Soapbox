 import { supabase } from './client/supabase';

/* -------------------------------------------
   GROUP CREATION
-------------------------------------------- */

export async function createGroup(settings: {
  rotation_period: number;
  max_word_count: number;
  quizzes_enabled: boolean;
  archive_enabled: boolean;
  archive_time_period?: number | null;
  anonymous: boolean;
}) {
  // generate random invite code
  const invite_code = Math.random().toString(36).substring(2, 8);

  const { data, error } = await supabase
    .from('groups')
    .insert([{ invite_code, ...settings }])
    .select()
    .single();

  if (error) throw error;
  return data; // returns group object incl. id + invite_code
}

/* -------------------------------------------
   JOIN GROUP
-------------------------------------------- */

export async function joinGroup(invite_code: string, name: string) {
  // find group
  const { data: group, error: groupErr } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', invite_code)
    .single();

  if (groupErr) throw groupErr;
  if (!group) throw new Error("Group not found");

  // add member
  const { data: member, error: memberErr } = await supabase
    .from('group_members')
    .insert([{ group_id: group.id, name }])
    .select()
    .single();

  if (memberErr) throw memberErr;

  return { group, member };
}

/* -------------------------------------------
   SUBMIT TOPIC
-------------------------------------------- */

export async function submitTopic(
  groupId: string,
  memberId: string,
  topicText: string,
  rotationCycle: number
) {
  const { data, error } = await supabase
    .from('topics')
    .insert([
      {
        group_id: groupId,
        member_id: memberId,
        topic_text: topicText,
        rotation_cycle: rotationCycle
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* -------------------------------------------
   CREATE ROTATION (assignments JSON)
-------------------------------------------- */

export async function saveRotation(
  groupId: string,
  rotationNumber: number,
  assignments: Record<string, string>
) {
  const { data, error } = await supabase
    .from('rotations')
    .insert([
      {
        group_id: groupId,
        rotation_number: rotationNumber,
        assignments
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* -------------------------------------------
   GET LANDING PAGE DATA
-------------------------------------------- */

export async function getLandingPageData(groupId: string) {
  // group settings
  const { data: group, error: gErr } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (gErr) throw gErr;

  // members
  const { data: members, error: mErr } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId);

  if (mErr) throw mErr;

  // topics for latest rotation
  const { data: topics, error: tErr } = await supabase
    .from('topics')
    .select('*')
    .eq('group_id', groupId);

  if (tErr) throw tErr;

  // rotations
  const { data: rotations, error: rErr } = await supabase
    .from('rotations')
    .select('*')
    .eq('group_id', groupId);

  if (rErr) throw rErr;

  return { group, members, topics, rotations };
}

export async function getLatestGroup() {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No groups or other safe condition — return null so caller can handle it
      return null;
    }
    return data ?? null;
  } catch (err) {
    return null;
  }
}

// Find a group by its invite code
export async function getGroupByInvite(inviteCode: string) {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (error) return null;
    return data ?? null;
  } catch (err) {
    return null;
  }
}

/* -------------------------------------------
   OPTIONAL — SAVE ARTICLE
-------------------------------------------- */

export async function submitArticle(
  groupId: string,
  memberId: string,
  rotationNumber: number,
  content: string
) {
  const wordCount = content.trim().split(/\s+/).length;

  const { data, error } = await supabase
    .from('articles')
    .insert([
      {
        group_id: groupId,
        member_id: memberId,
        rotation_number: rotationNumber,
        content,
        word_count: wordCount,
        article_read: false // default value
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* -------------------------------------------
   GET ARTICLES FOR A GROUP (if needed)
-------------------------------------------- */

export async function getArticles(groupId: string) {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/* -------------------------------------------
   GET SINGLE ARTICLE BY ID
-------------------------------------------- */

export async function getArticle(articleId: string) {
  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      group_members (
        id,
        name
      )
    `)
    .eq('id', articleId)
    .single();

  if (error) throw error;
  return data;
}

/* -------------------------------------------
   GET ARTICLE BY MEMBER ID (latest)
-------------------------------------------- */

export async function getArticleByMember(memberId: string) {
  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      group_members (
        id,
        name
      )
    `)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;
  return data;
}

/* -------------------------------------------
   QUIZ MANAGEMENT
-------------------------------------------- */

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
};

export type Quiz = {
  id: string;
  article_id: string;
  questions: QuizQuestion[];
  created_at: string;
};

export async function saveQuiz(
  articleId: string,
  questions: QuizQuestion[]
) {
  const { data, error } = await supabase
    .from('quizzes')
    .insert([
      {
        article_id: articleId,
        questions: questions,
        quiz_score: -1 // default value
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getQuiz(articleId: string) {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('article_id', articleId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveQuizAttempt(
  quizId: string,
  memberId: string,
  answers: number[],
  score: number
) {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert([
      {
        quiz_id: quizId,
        member_id: memberId,
        answers: answers,
        score: score
      }
    ])
    .select()
    .single();

  if (error) throw error;

  // Update quiz_score for this quiz (if needed)
  await supabase
    .from('quizzes')
    .update({ quiz_score: score })
    .eq('id', quizId);

  return data;

}

// Mark an article as read for a member
export async function markArticleRead(articleId: string) {
  const { data, error } = await supabase
    .from('articles')
    .update({ article_read: true })
    .eq('id', articleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Get quiz attempts for a member
export async function getQuizAttemptsForMember(memberId: string) {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select(`
      *,
      quizzes (
        id,
        article_id
      )
    `)
    .eq('member_id', memberId);
  if (error) throw error;
  return data;
}

// Check if a member has completed a quiz for a specific article
export async function hasCompletedQuizForArticle(memberId: string, articleId: string) {
  const { data, error } = await supabase
    .from('quizzes')
    .select(`
      id,
      quiz_attempts!inner (
        member_id
      )
    `)
    .eq('article_id', articleId)
    .eq('quiz_attempts.member_id', memberId);
  
  if (error) throw error;
  return data && data.length > 0;
}

// Get all quiz attempts for an article (for author to see scores)
export async function getQuizAttemptsForArticle(articleId: string) {
  // First get the quiz for this article
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('id')
    .eq('article_id', articleId)
    .maybeSingle();
  
  if (quizError) throw quizError;
  if (!quiz) return [];

  // Then get all attempts for this quiz with member names
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select(`
      *,
      group_members (
        id,
        name
      )
    `)
    .eq('quiz_id', quiz.id)
    .order('attempted_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

/* -------------------------------------------
   DEMO TIME OFFSET (for time skip feature)
-------------------------------------------- */

// Get the time offset for a group (in milliseconds)
export async function getGroupTimeOffset(groupId: string): Promise<number> {
  const { data, error } = await supabase
    .from('groups')
    .select('demo_time_offset')
    .eq('id', groupId)
    .single();
  
  if (error) throw error;
  return data?.demo_time_offset || 0;
}

// Update the time offset for a group (in milliseconds)
export async function setGroupTimeOffset(groupId: string, offsetMs: number) {
  const { data, error } = await supabase
    .from('groups')
    .update({ demo_time_offset: offsetMs })
    .eq('id', groupId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Skip time forward for a group by a certain amount (in milliseconds)
export async function skipGroupTime(groupId: string, skipMs: number) {
  // First get current offset
  const currentOffset = await getGroupTimeOffset(groupId);
  const newOffset = currentOffset + skipMs;
  return setGroupTimeOffset(groupId, newOffset);
}

// Reset time offset for a group
export async function resetGroupTimeOffset(groupId: string) {
  return setGroupTimeOffset(groupId, 0);
}
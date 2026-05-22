import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { GoogleWorkspaceAuthError, googleWorkspaceFetch } from '../../_lib/googleWorkspace.js';
import { allowCors, getQuery, requireMethod, sendJson } from '../../_lib/http.js';
import { resolveGoogleAccounts } from '../googleApp/resolveAccounts.js';

const APP_ID = 'classroom';
const POST_SECTIONS = [
  {
    key: 'announcements',
    path: 'announcements',
    responseKey: 'announcements',
    stateParam: 'announcementStates',
    type: 'announcement',
  },
  {
    key: 'courseWork',
    path: 'courseWork',
    responseKey: 'courseWork',
    stateParam: 'courseWorkStates',
    type: 'coursework',
  },
  {
    key: 'courseWorkMaterials',
    path: 'courseWorkMaterials',
    responseKey: 'courseWorkMaterial',
    stateParam: 'courseWorkMaterialStates',
    type: 'material',
  },
];

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET'])) return;

  const user = await requireDashboardUser(req, res, 'LuClassroom');
  if (!user) return;

  try {
    const query = getQuery(req);
    const accountId = String(query.get('accountId') || '');
    const courseId = String(query.get('courseId') || '');
    const pageSize = clampNumber(Number(query.get('pageSize') || 20), 5, 50);

    if (!accountId || accountId === 'all') {
      sendJson(res, 400, { error: 'A Classroom accountId is required.' });
      return;
    }
    if (!courseId) {
      sendJson(res, 400, { error: 'A Classroom courseId is required.' });
      return;
    }

    const [account] = await resolveGoogleAccounts(APP_ID, user.id, accountId);
    if (!account) {
      sendJson(res, 404, { error: 'Classroom account was not found.', needsReconnect: true });
      return;
    }

    const { posts, errors } = await listCoursePostsForAccount(user.id, account, courseId, pageSize);
    posts.sort((a, b) => Date.parse(b.updateTime || b.creationTime || '') - Date.parse(a.updateTime || a.creationTime || ''));
    sendJson(res, 200, { posts, errors });
  } catch (error) {
    if (error instanceof GoogleWorkspaceAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuClassroom posts request failed.' });
  }
}

async function listCoursePostsForAccount(ownerId, account, courseId, pageSize) {
  const results = await Promise.all(POST_SECTIONS.map((section) => listSection(ownerId, account, courseId, pageSize, section)));
  return results.reduce(
    (acc, result) => {
      acc.posts.push(...result.posts);
      acc.errors.push(...result.errors);
      return acc;
    },
    { posts: [], errors: [] },
  );
}

async function listSection(ownerId, account, courseId, pageSize, section) {
  const url = new URL(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/${section.path}`);
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('orderBy', 'updateTime desc');
  url.searchParams.append(section.stateParam, 'PUBLISHED');

  try {
    const data = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
    return {
      posts: (data[section.responseKey] || []).map((post) => normalizePost(post, account, courseId, section.type)),
      errors: [],
    };
  } catch (error) {
    return {
      posts: [],
      errors: [{
        section: section.key,
        accountId: account.accountId,
        email: account.email,
        error: error instanceof Error ? error.message : 'Unable to load Classroom stream items.',
        needsReconnect: error instanceof GoogleWorkspaceAuthError,
      }],
    };
  }
}

function normalizePost(post, account, courseId, type) {
  return {
    id: post.id || '',
    courseId,
    type,
    title: post.title || post.text || typeLabel(type),
    text: post.description || post.text || '',
    state: post.state || '',
    workType: post.workType || '',
    alternateLink: post.alternateLink || '',
    creationTime: post.creationTime || '',
    updateTime: post.updateTime || '',
    dueDateText: formatDueDate(post.dueDate, post.dueTime),
    materials: normalizeMaterials(post.materials || []),
    accountId: account.accountId,
    accountEmail: account.email,
  };
}

function normalizeMaterials(materials) {
  return materials.map((material) => {
    if (material.driveFile?.driveFile) {
      const file = material.driveFile.driveFile;
      return { title: file.title || 'Drive file', url: file.alternateLink || '', kind: 'Drive' };
    }
    if (material.youtubeVideo) {
      return { title: material.youtubeVideo.title || 'YouTube video', url: material.youtubeVideo.alternateLink || '', kind: 'YouTube' };
    }
    if (material.link) {
      return { title: material.link.title || material.link.url || 'Link', url: material.link.url || '', kind: 'Link' };
    }
    if (material.form) {
      return { title: material.form.title || 'Form', url: material.form.formUrl || '', kind: 'Form' };
    }
    return { title: 'Material', url: '', kind: 'Material' };
  });
}

function formatDueDate(dueDate, dueTime) {
  if (!dueDate?.year) return '';
  const month = String(dueDate.month || 1).padStart(2, '0');
  const day = String(dueDate.day || 1).padStart(2, '0');
  const hour = dueTime?.hours != null ? String(dueTime.hours).padStart(2, '0') : '';
  const minute = dueTime?.minutes != null ? String(dueTime.minutes).padStart(2, '0') : '';
  return hour ? `${dueDate.year}-${month}-${day} ${hour}:${minute || '00'}` : `${dueDate.year}-${month}-${day}`;
}

function typeLabel(type) {
  if (type === 'coursework') return 'Course work';
  if (type === 'material') return 'Material';
  return 'Announcement';
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

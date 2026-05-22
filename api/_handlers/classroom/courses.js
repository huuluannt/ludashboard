import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { GoogleWorkspaceAuthError, googleWorkspaceFetch } from '../../_lib/googleWorkspace.js';
import { allowCors, getQuery, requireMethod, sendJson } from '../../_lib/http.js';
import { resolveGoogleAccounts } from '../googleApp/resolveAccounts.js';

const APP_ID = 'classroom';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET'])) return;

  const user = await requireDashboardUser(req, res, 'LuClassroom');
  if (!user) return;

  try {
    const query = getQuery(req);
    const accountId = String(query.get('accountId') || 'all');
    const search = String(query.get('q') || '').trim().toLowerCase();
    const pageSize = clampNumber(Number(query.get('pageSize') || 50), 10, 100);
    const accounts = await resolveGoogleAccounts(APP_ID, user.id, accountId);
    const courses = [];
    const errors = [];

    for (const account of accounts) {
      try {
        courses.push(...(await listCoursesForAccount(user.id, account, pageSize)));
      } catch (error) {
        errors.push({
          accountId: account.accountId,
          email: account.email,
          error: error instanceof Error ? error.message : 'Unable to load Classroom courses.',
          needsReconnect: error instanceof GoogleWorkspaceAuthError,
        });
      }
    }

    const filtered = search
      ? courses.filter((course) => `${course.name} ${course.section} ${course.descriptionHeading}`.toLowerCase().includes(search))
      : courses;
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    sendJson(res, 200, { courses: filtered, errors });
  } catch (error) {
    if (error instanceof GoogleWorkspaceAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuClassroom courses request failed.' });
  }
}

async function listCoursesForAccount(ownerId, account, pageSize) {
  const url = new URL('https://classroom.googleapis.com/v1/courses');
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.append('courseStates', 'ACTIVE');
  const data = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
  return (data.courses || []).map((course) => normalizeCourse(course, account));
}

function normalizeCourse(course, account) {
  return {
    id: course.id || '',
    name: course.name || '(Untitled course)',
    section: course.section || '',
    descriptionHeading: course.descriptionHeading || '',
    room: course.room || '',
    ownerId: course.ownerId || '',
    courseState: course.courseState || '',
    alternateLink: course.alternateLink || '',
    creationTime: course.creationTime || '',
    updateTime: course.updateTime || '',
    accountId: account.accountId,
    accountEmail: account.email,
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

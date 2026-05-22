import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import ConnectedGoogleModule from '@/modules/google-workspace/ConnectedGoogleModule';
import { googleAppApi } from '@/modules/google-workspace/googleAppApi';

interface ClassroomCourse {
  id: string;
  name: string;
  section: string;
  descriptionHeading: string;
  room: string;
  courseState: string;
  alternateLink: string;
  updateTime: string;
  accountId: string;
  accountEmail: string;
}

interface ClassroomPostMaterial {
  title: string;
  url: string;
  kind: string;
}

interface ClassroomPost {
  id: string;
  courseId: string;
  type: string;
  title: string;
  text: string;
  state: string;
  workType: string;
  alternateLink: string;
  creationTime: string;
  updateTime: string;
  dueDateText: string;
  materials: ClassroomPostMaterial[];
  accountId: string;
  accountEmail: string;
}

interface ClassroomPostsResponse {
  posts: ClassroomPost[];
  errors?: Array<{
    section: string;
    accountId: string;
    email: string;
    error: string;
    needsReconnect?: boolean;
  }>;
}

export default function LuClassroomModule() {
  return (
    <ConnectedGoogleModule<ClassroomCourse>
      appId="classroom"
      apiBasePath="/api/classroom"
      title="LuClassroom"
      icon="notebook-pen"
      accountLabel="Classroom"
      itemLabel="course"
      endpointPath="/api/classroom/courses"
      responseKey="courses"
      searchPlaceholder="Search Classroom courses..."
      connectTitle="Connect Google Classroom"
      connectDescription="LuClassroom reads your Google Classroom course list through the Classroom API."
      emptyTitle="No courses found"
      emptyHint="Try another account or search term."
      loadingText="Loading Classroom courses..."
      getItemKey={getCourseKey}
      getItemTitle={(course) => course.name}
      getItemIcon={() => 'notebook-pen'}
      renderItemContent={(course) => (
        <>
          <p className="truncate text-xs font-semibold">{course.name}</p>
          <p className="mt-1 truncate text-[11px] text-[var(--color-text-tertiary)]">
            {course.section || course.room || course.courseState || 'Classroom course'} | {course.accountEmail}
          </p>
        </>
      )}
      renderDetail={(course) => (
        <div className="space-y-3">
          <InfoRow label="Section" value={course.section || 'None'} />
          <InfoRow label="Room" value={course.room || 'None'} />
          <InfoRow label="State" value={course.courseState || 'Unknown'} />
          <InfoRow label="Updated" value={formatDate(course.updateTime)} />
          {course.descriptionHeading && (
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm leading-6">
              {course.descriptionHeading}
            </div>
          )}
          {course.alternateLink && (
            <button type="button" onClick={() => window.open(course.alternateLink, '_blank', 'noopener,noreferrer')} className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black">
              <Icon name="external-link" size={13} />
              Open in Classroom
            </button>
          )}
          <CoursePosts course={course} />
        </div>
      )}
    />
  );
}

function CoursePosts({ course }: { course: ClassroomCourse }) {
  const [posts, setPosts] = useState<ClassroomPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadPosts = useCallback(async () => {
    if (!course.accountId || !course.id) return;

    setLoading(true);
    setStatus('');
    setError('');
    try {
      const data = await googleAppApi<ClassroomPostsResponse>('/api/classroom/posts', 'LuClassroom', {
        query: {
          accountId: course.accountId,
          courseId: course.id,
          pageSize: '30',
        },
      });
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setStatus(data.errors?.length ? data.errors.map((item) => `${labelSection(item.section)}: ${item.error}`).join(' | ') : '');
    } catch (postsError) {
      setPosts([]);
      setError(postsError instanceof Error ? postsError.message : 'Unable to load Classroom posts.');
    } finally {
      setLoading(false);
    }
  }, [course.accountId, course.id]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  return (
    <section className="space-y-3 border-t border-[var(--color-border-subtle)] pt-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">Class posts</h4>
        <button
          type="button"
          onClick={() => void loadPosts()}
          disabled={loading}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-2 text-xs font-semibold transition-colors hover:bg-[var(--color-surface-subtle)] disabled:opacity-50"
        >
          <Icon name="rotate-cw" size={13} />
          Refresh
        </button>
      </div>

      {status && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {status}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-3 text-xs text-[var(--color-text-tertiary)]">
          Loading Classroom posts...
        </p>
      ) : posts.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-3 text-xs leading-5 text-[var(--color-text-tertiary)]">
          No published announcements, coursework, or materials were returned. Reconnect LuClassroom if this course was connected before the post scopes were added.
        </p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <article key={`${post.type}:${post.id}`} className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
                  <Icon name={post.type === 'announcement' ? 'mail' : post.type === 'material' ? 'file-text' : 'notebook-pen'} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-semibold">{post.title || labelType(post.type)}</p>
                    <span className="rounded-full bg-[var(--color-accent-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
                      {labelType(post.type)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                    {formatDate(post.updateTime || post.creationTime)}
                    {post.dueDateText ? ` | Due ${post.dueDateText}` : ''}
                    {post.workType ? ` | ${post.workType}` : ''}
                  </p>
                  {post.text && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--color-text-secondary)]">{post.text}</p>}
                  {post.materials.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {post.materials.map((material) => (
                        material.url ? (
                          <button
                            key={`${material.kind}:${material.url}:${material.title}`}
                            type="button"
                            onClick={() => window.open(material.url, '_blank', 'noopener,noreferrer')}
                            className="flex min-h-7 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-2 text-[11px] font-medium transition-colors hover:bg-[var(--color-surface-subtle)]"
                          >
                            <Icon name="external-link" size={12} />
                            <span className="max-w-[220px] truncate">{material.title}</span>
                          </button>
                        ) : (
                          <span key={`${material.kind}:${material.title}`} className="rounded-lg border border-[var(--color-border-subtle)] px-2 py-1 text-[11px] text-[var(--color-text-tertiary)]">
                            {material.title}
                          </span>
                        )
                      ))}
                    </div>
                  )}
                  {post.alternateLink && (
                    <button
                      type="button"
                      onClick={() => window.open(post.alternateLink, '_blank', 'noopener,noreferrer')}
                      className="mt-3 flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black"
                    >
                      <Icon name="external-link" size={13} />
                      Open post
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function getCourseKey(course: ClassroomCourse) {
  return `${course.accountId}:${course.id}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 break-words text-xs font-medium">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function labelType(type: string) {
  if (type === 'coursework') return 'Coursework';
  if (type === 'material') return 'Material';
  return 'Announcement';
}

function labelSection(section: string) {
  if (section === 'courseWork') return 'Coursework';
  if (section === 'courseWorkMaterials') return 'Materials';
  return 'Announcements';
}

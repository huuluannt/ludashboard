import ConnectedGoogleModule from '@/modules/google-workspace/ConnectedGoogleModule';

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
              Open in Classroom
            </button>
          )}
        </div>
      )}
    />
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

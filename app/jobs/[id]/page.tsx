import { JobPanel } from "@/components/JobPanel";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="wrap narrow" style={{ padding: "32px 0 64px" }}>
      <JobPanel id={id} />
    </main>
  );
}

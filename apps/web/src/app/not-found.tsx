import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap stack max-w-[720px] gap-4">
      <h1 className="d2">We could not find that page</h1>
      <p className="lead">It may have moved. Your answers are not affected.</p>
      <Link className="btn pri self-start" href="/">
        Back to the start
      </Link>
    </div>
  );
}

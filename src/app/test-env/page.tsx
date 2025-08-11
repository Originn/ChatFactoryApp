export default function TestEnvPage() {
  return (
    <div className="p-8">
      <h1>Environment Variable Test</h1>
      <p>NEXT_PUBLIC_COMING_SOON: {process.env.NEXT_PUBLIC_COMING_SOON}</p>
      <p>Should be: "true"</p>
    </div>
  );
}
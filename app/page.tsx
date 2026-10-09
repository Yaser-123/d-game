import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-3xl space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter">
            SURVIVE THE <span className="text-danger">SYSTEM</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-[600px] mx-auto">
            A dark social PvP survival game where information is your greatest asset and your Sigil is your only hope.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <Link href="/register" className="btn btn-danger w-full sm:w-auto px-8 h-12 text-base">
            Enter the Game
          </Link>
          <Link href="/login" className="btn btn-outline w-full sm:w-auto px-8 h-12 text-base">
            Authenticate
          </Link>
        </div>
      </div>
    </div>
  );
}

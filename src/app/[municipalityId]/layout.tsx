import { notFound } from "next/navigation";
import { NavBar } from "@/components/layout/nav-bar";
import { Footer } from "@/components/layout/footer";
import { getMunicipalityById } from "@/lib/db/municipalities";

interface Props {
  params: Promise<{ municipalityId: string }>;
  children: React.ReactNode;
}

export default async function MunicipalityLayout({ params, children }: Props) {
  const { municipalityId } = await params;
  const municipality = await getMunicipalityById(municipalityId);

  if (!municipality) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar
        municipalityId={municipalityId}
        municipalityName={municipality.nameJa}
      />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}

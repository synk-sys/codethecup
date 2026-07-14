import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/challenges")({
  component: ChallengesPage,
});

const BADGE_COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#34A853"];

const CODE_THE_CUP_CHALLENGES = [
  { name: "Match Predictor AI", description: "Build a tool that predicts match outcomes using historical stats, team form, or fan sentiment. Bonus points for explaining why it predicts what it predicts." },
  { name: "Fan Translator", description: "A real-time translation or phrasebook app so fans from different countries can chat, order food, or trash-talk rival teams at the stadium." },
  { name: "Stadium Navigator", description: "An AI assistant that helps fans find their gate, nearest washroom, food stall, or exit in a crowded stadium using a simple chat or voice interface." },
  { name: "Fan Watch Party Finder", description: "An app that connects fans to local watch parties or bars showing their team's matches, with filters like country, language, or vibe." },
  { name: "Chant & Banner Creator", description: "An AI tool that generates custom fan chants, banners, or social posts for a chosen team, personalized with player names and country flair." },
  { name: "Referee Decision Explainer", description: "A tool that explains offside calls, VAR decisions, or common rules to new fans in plain language, using diagrams or simple Q&A." },
  { name: "Culture & Cuisine Guide", description: "An app that pairs each participating country with its food, traditions, or fun facts, useful for fans hosting a World Cup watch party at home." },
  { name: "Accessibility Companion", description: "A tool that makes match-day more accessible: live captions for commentary, sign-language avatar overlays, or audio descriptions for visually impaired fans." },
];

function ChallengesPage() {
  const q = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      let { data } = await supabase.from("challenges").select("*").eq("event_id", event.id).order("sort_order");
      if (!data || data.length === 0) {
        const rows = CODE_THE_CUP_CHALLENGES.map((c, i) => ({
          ...c,
          event_id: event.id,
          sort_order: i,
        }));
        await supabase.from("challenges").insert(rows);
        ({ data } = await supabase.from("challenges").select("*").eq("event_id", event.id).order("sort_order"));
      }
      return { event, challenges: data ?? [] };
    },
  });
  if (!q.data) return <div>Loading...</div>;
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-black">Challenges</h1>
      <Card className="glass divide-y divide-border">
        {q.data.challenges.map((c, i) => (
          <div key={c.id} className="p-4 flex items-start gap-4">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: BADGE_COLORS[i % BADGE_COLORS.length] }}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{c.name}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{c.sponsor && `${c.sponsor} • `}{c.description}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

interface Speech {
  id: string;
  sequence: number;
  speakerNameRaw: string;
  speechText: string;
  speaker: { nameJa: string; role: string } | null;
}

interface SpeechTimelineProps {
  speeches: Speech[];
}

const roleColors: Record<string, string> = {
  chair: "border-yellow-500/40",
  mayor: "border-red-500/40",
  councilor: "border-accent/40",
  executive: "border-blue-500/40",
  staff: "border-purple-500/40",
  unknown: "border-card-border",
};

export function SpeechTimeline({ speeches }: SpeechTimelineProps) {
  return (
    <div className="space-y-3">
      {speeches.map((speech) => {
        const role = speech.speaker?.role ?? "unknown";
        const borderColor = roleColors[role] ?? roleColors.unknown;

        return (
          <div
            key={speech.id}
            className={`border-l-2 ${borderColor} pl-4 py-2`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] text-muted">
                #{speech.sequence}
              </span>
              <span className="font-mono text-xs font-bold text-foreground">
                {speech.speaker?.nameJa ?? speech.speakerNameRaw}
              </span>
              {speech.speaker?.role && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {speech.speaker.role}
                </span>
              )}
            </div>
            <p className="font-sans text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {speech.speechText.length > 500
                ? speech.speechText.slice(0, 500) + "..."
                : speech.speechText}
            </p>
          </div>
        );
      })}
    </div>
  );
}

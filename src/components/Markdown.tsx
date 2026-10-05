import Link from "next/link";

// Renders the small subset of Markdown the assistant is told to use: **bold**, [links](/in-app), "- " lists and paragraphs.
function inline(text: string, key: string) {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g).map((part, i) => {
    const k = `${key}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={k}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    // Only links inside the app: the model never sends you somewhere else.
    if (link) return link[2].startsWith("/") && !link[2].startsWith("//") ? <Link key={k} href={link[2]} className="md-link">{link[1]} →</Link> : <span key={k}>{link[1]}</span>;
    return <span key={k}>{part}</span>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`ul${blocks.length}`}>{list.map((l, i) => <li key={i}>{inline(l, `li${i}`)}</li>)}</ul>);
    list = [];
  };
  text.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (/^[-*•]\s+/.test(t)) list.push(t.replace(/^[-*•]\s+/, ""));
    else {
      flush();
      if (t) blocks.push(<p key={`p${i}`}>{inline(t.replace(/^#+\s*/, ""), `p${i}`)}</p>);
    }
  });
  flush();
  return <>{blocks}</>;
}

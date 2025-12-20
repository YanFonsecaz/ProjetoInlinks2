import { normalizeText } from "../src/utils/text-matcher";

const targets = [
  {
    url: "https://neilpatel.com/br/blog/como-usar-o-facebook-live/",
    clusters: ["facebook live", "live streaming", "video marketing"],
    theme: "Redes Sociais",
    intencao: "Informativa",
  },
];

const targetTopic = "Facebook Live Tips"; // LLM output

const targetTopicLower = normalizeText(targetTopic);

const target = targets.find((t) => {
  const clusters = t.clusters.map((c) => normalizeText(c));
  const theme = t.theme ? normalizeText(t.theme) : "";
  const url = normalizeText(t.url);

  console.log(`Checking target: ${t.url}`);
  console.log(`Clusters: ${clusters}`);
  console.log(`Target Topic: ${targetTopicLower}`);

  const match =
    url.includes(targetTopicLower) ||
    targetTopicLower.includes(url) ||
    clusters.some(
      (c) => targetTopicLower.includes(c) || c.includes(targetTopicLower)
    ) ||
    (theme && targetTopicLower.includes(theme));

  console.log(`Match: ${match}`);
  return match;
});

console.log("Found target:", target ? target.url : "None");

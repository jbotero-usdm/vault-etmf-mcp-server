export default async function handler(req, res) {
  const payload = {
    status: "ok",
    generatedAt: new Date().toISOString(),
    intake: {
      source: "Box intake",
      folder: "ABC BioPharma intake",
      newItems: 0,
      readyForClassification: 0,
      readyForIndexing: 0,
      agingItems: 0,
      note: "Live Box intake metrics not wired yet"
    }
  };

  res.status(200).json(payload);
}
